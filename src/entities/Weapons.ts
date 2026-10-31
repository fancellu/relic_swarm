import {gameAudio} from '../../utils/helper';
import {EnemyEntity, EquippedItem, SimulationState} from '../types/entities';
import {ITEM_DEFS} from '../types/items';
import {spatialGrid} from '../core/spatial';
import {applyEnemySlow, DerivedStats} from './Player';

export function applyEnemyPoison(enemy: EnemyEntity, dps: number, duration = 4.0): void {
  enemy.poisonDps = Math.max(enemy.poisonDps, dps);
  enemy.poisonTimer = Math.max(enemy.poisonTimer, duration);
}

function getClosestEnemies(x: number, y: number, enemies: EnemyEntity[], count: number): EnemyEntity[] {
  const best: {enemy: EnemyEntity; distSq: number}[] = [];
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.hp <= 0) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const dSq = dx * dx + dy * dy;

    if (best.length < count) {
      best.push({enemy: e, distSq: dSq});
      best.sort((a, b) => a.distSq - b.distSq);
    } else if (dSq < best[best.length - 1].distSq) {
      best[best.length - 1] = {enemy: e, distSq: dSq};
      best.sort((a, b) => a.distSq - b.distSq);
    }
  }
  const result: EnemyEntity[] = [];
  for (let i = 0; i < best.length; i++) result.push(best[i].enemy);
  return result;
}

export function updateWeaponCasting(
  sim: SimulationState,
  stats: DerivedStats,
  dt: number,
  spawnDamageNumber: (x: number, y: number, text: string, color: string) => void,
  spawnParticles: (x: number, y: number, count: number, color: string, speed?: number) => void,
): void {
  sim.weapons.forEach((wep) => {
    const def = ITEM_DEFS[wep.id];
    if (!def) return;

    const timerKey = wep.id;
    sim.weaponTimers[timerKey] = (sim.weaponTimers[timerKey] || 0) + dt;

    const baseCd = def.cooldown || 1.0;
    const actualCd = baseCd * (1 - stats.cdr);

    // --- Magic Missile & Chrono Missiles ---
    if (wep.id === 'magic_missile' || wep.id === 'chrono_missiles') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();

        const count = wep.id === 'chrono_missiles' ? 5 : 1 + Math.floor(wep.level / 2);
        const dmg = (def.baseDamage || 20) * stats.mightMult * (1 + (wep.level - 1) * 0.2);

        const sorted = getClosestEnemies(sim.x, sim.y, sim.enemies, count);

        for (let i = 0; i < count; i++) {
          const target = sorted[i % sorted.length];
          if (!target) break;

          const angle = Math.atan2(target.y - sim.y, target.x - sim.x) + (Math.random() * 0.4 - 0.2);
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'missile',
            sourceWeapon: wep.id,
            x: sim.x,
            y: sim.y,
            vx: Math.cos(angle) * 500,
            vy: Math.sin(angle) * 500,
            damage: dmg,
            radius: 12 * stats.areaMult,
            duration: 2.5,
            maxDuration: 2.5,
            pierce: wep.id === 'chrono_missiles' ? 4 : 1,
            hitList: [],
            color: '#38bdf8',
            inflictsPoison: stats.toxicLevel > 0 && Math.random() < 0.35,
          });
        }
      }
    }

    // --- Flame Blast & Hellfire Nova ---
    else if (wep.id === 'flame_blast' || wep.id === 'hellfire_nova') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();

        const dmg = (def.baseDamage || 35) * stats.mightMult * (1 + (wep.level - 1) * 0.25);
        const splashRad = (wep.id === 'hellfire_nova' ? 160 : 70 + wep.level * 10) * stats.areaMult;

        const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
        const angle = Math.atan2(target.y - sim.y, target.x - sim.x);

        sim.projectiles.push({
          id: sim.nextProjId++,
          type: 'flame',
          sourceWeapon: wep.id,
          x: sim.x,
          y: sim.y,
          vx: Math.cos(angle) * 360,
          vy: Math.sin(angle) * 360,
          damage: dmg,
          radius: 16 * stats.areaMult,
          duration: 1.2,
          maxDuration: 1.2,
          pierce: 1,
          hitList: [],
          color: '#f97316',
          splashRadius: splashRad,
          inflictsPoison: stats.toxicLevel > 0 && Math.random() < 0.35,
        });
      }
    }

    // --- Scattershot (short-range cone) ---
    else if (wep.id === 'scattershot' || wep.id === 'starfall_scattergun') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();

        let target = sim.enemies[0];
        let closestDistSq = Number.POSITIVE_INFINITY;
        for (let i = 0; i < sim.enemies.length; i++) {
          const enemy = sim.enemies[i];
          const dx = enemy.x - sim.x;
          const dy = enemy.y - sim.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < closestDistSq) {
            closestDistSq = distSq;
            target = enemy;
          }
        }

        const isStarfall = wep.id === 'starfall_scattergun';
        const pelletCount = isStarfall ? 13 : 5 + wep.level;
        const centerAngle = Math.atan2(target.y - sim.y, target.x - sim.x);
        const spread = isStarfall ? 0.85 : 0.7;
        const damage = (def.baseDamage || 15) * stats.mightMult * (1 + (wep.level - 1) * 0.18);

        for (let i = 0; i < pelletCount; i++) {
          const offset = pelletCount === 1 ? 0 : (i / (pelletCount - 1) - 0.5) * spread;
          const angle = centerAngle + offset;
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'shotgun_pellet',
            sourceWeapon: wep.id,
            x: sim.x,
            y: sim.y,
            vx: Math.cos(angle) * (isStarfall ? 620 : 540),
            vy: Math.sin(angle) * (isStarfall ? 620 : 540),
            damage,
            radius: 6 * stats.areaMult,
            duration: isStarfall ? 0.7 : 0.48,
            maxDuration: isStarfall ? 0.7 : 0.48,
            pierce: isStarfall ? 2 : 1,
            hitList: [],
            color: isStarfall ? '#fef08a' : '#fbbf24',
            inflictsPoison: stats.toxicLevel > 0 && Math.random() < 0.35,
          });
        }
        spawnParticles(sim.x, sim.y, 8, '#fbbf24', 110);
      }
    }

    // --- Homing Missiles ---
    else if (wep.id === 'homing_missiles' || wep.id === 'swarm_seekers' || wep.id === 'stormfront_barrage') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();

        const isSwarmSeekers = wep.id === 'swarm_seekers';
        const isStormfront = wep.id === 'stormfront_barrage';
        const missileCount = isStormfront ? 9 : isSwarmSeekers ? 5 : 1 + Math.floor((wep.level - 1) / 2);
        const damage = (def.baseDamage || 42) * stats.mightMult * (1 + (wep.level - 1) * 0.22);

        for (let i = 0; i < missileCount; i++) {
          const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
          if (!target) continue;

          const targetAngle = Math.atan2(target.y - sim.y, target.x - sim.x);
          // Launch sideways so the target-seeking force draws an obvious curved flight path.
          const launchSide = i % 2 === 0 ? 1 : -1;
          const angle = targetAngle + launchSide * Math.PI / 2 + (i - (missileCount - 1) / 2) * 0.1;
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'homing_missile',
            sourceWeapon: wep.id,
            x: sim.x,
            y: sim.y,
            vx: Math.cos(angle) * (isStormfront ? 360 : 300),
            vy: Math.sin(angle) * (isStormfront ? 360 : 300),
            damage,
            radius: (isStormfront ? 8 : 11) * stats.areaMult,
            duration: isStormfront ? 3.2 : 4.0,
            maxDuration: isStormfront ? 3.2 : 4.0,
            pierce: isStormfront ? 2 : isSwarmSeekers ? 4 : 1 + Math.floor((wep.level - 1) / 2),
            hitList: [],
            color: isStormfront ? '#fbbf24' : isSwarmSeekers ? '#c4b5fd' : '#a78bfa',
            targetId: target.id,
            inflictsPoison: stats.toxicLevel > 0 && Math.random() < 0.35,
          });
        }
        spawnParticles(sim.x, sim.y, 6, '#a78bfa', 100);
      }
    }

    // --- Chain Lightning Gun ---
    else if (wep.id === 'chain_lightning_gun' || wep.id === 'tesla_tempest') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();

        let firstTarget = sim.enemies[0];
        let closestDistSq = Number.POSITIVE_INFINITY;
        for (let i = 0; i < sim.enemies.length; i++) {
          const enemy = sim.enemies[i];
          const dx = enemy.x - sim.x;
          const dy = enemy.y - sim.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < closestDistSq) {
            closestDistSq = distSq;
            firstTarget = enemy;
          }
        }

        const isTeslaTempest = wep.id === 'tesla_tempest';
        const hitIds = [firstTarget.id];
        const baseDamage = (def.baseDamage || 48) * stats.mightMult * (1 + (wep.level - 1) * 0.2);
        const chainChance = isTeslaTempest ? 1 : Math.min(0.9, 0.55 + wep.level * 0.07);
        const maxChains = isTeslaTempest ? 5 : 1 + Math.floor((wep.level - 1) / 2);
        const chainRangeSq = ((isTeslaTempest ? 300 : 240) * stats.areaMult) ** 2;
        const zap = (fromX: number, fromY: number, target: EnemyEntity, damage: number): void => {
          target.hp -= damage;
          sim.weaponDamageDealt[wep.id] = (sim.weaponDamageDealt[wep.id] || 0) + damage;
          if (stats.toxicLevel > 0 && Math.random() < 0.35) applyEnemyPoison(target, damage * 0.5);
          spawnDamageNumber(target.x, target.y, Math.round(damage).toString(), '#67e8f9');
          spawnParticles(target.x, target.y, 5, '#67e8f9', 115);
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'chain_lightning',
            sourceWeapon: wep.id,
            x: fromX,
            y: fromY,
            vx: 0,
            vy: 0,
            damage: 0,
            radius: 0,
            duration: 0.12,
            maxDuration: 0.12,
            pierce: 0,
            hitList: [],
            color: '#67e8f9',
            chainEndX: target.x,
            chainEndY: target.y,
          });
        };

        zap(sim.x, sim.y, firstTarget, baseDamage);
        let chainSource = firstTarget;
        let chainDamage = baseDamage * 0.72;

        for (let jump = 0; jump < maxChains && Math.random() < chainChance; jump++) {
          let nextTarget: EnemyEntity | undefined;
          let nextDistSq = chainRangeSq;
          for (let i = 0; i < sim.enemies.length; i++) {
            const enemy = sim.enemies[i];
            if (hitIds.includes(enemy.id)) continue;
            const dx = enemy.x - chainSource.x;
            const dy = enemy.y - chainSource.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < nextDistSq) {
              nextDistSq = distSq;
              nextTarget = enemy;
            }
          }
          if (!nextTarget) break;

          hitIds.push(nextTarget.id);
          zap(chainSource.x, chainSource.y, nextTarget, chainDamage);

          // At high levels the first bounce forks into a second nearby target.
          if ((wep.level >= 4 || isTeslaTempest) && jump === 0 && Math.random() < chainChance) {
            let splitTarget: EnemyEntity | undefined;
            let splitDistSq = chainRangeSq;
            for (let i = 0; i < sim.enemies.length; i++) {
              const enemy = sim.enemies[i];
              if (hitIds.includes(enemy.id)) continue;
              const dx = enemy.x - chainSource.x;
              const dy = enemy.y - chainSource.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < splitDistSq) {
                splitDistSq = distSq;
                splitTarget = enemy;
              }
            }
            if (splitTarget) {
              hitIds.push(splitTarget.id);
              zap(chainSource.x, chainSource.y, splitTarget, chainDamage * 0.7);
            }
          }

          chainSource = nextTarget;
          chainDamage *= 0.72;
        }
      }
    }

    // --- Thunder Strike & Mjolnir's Conduit ---
    else if (wep.id === 'thunder_strike' || wep.id === 'mjolnir_conduit') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();

        const isConduit = wep.id === 'mjolnir_conduit';
        const strikes = isConduit ? 4 : 1 + Math.floor(wep.level / 2);
        const dmg = (def.baseDamage || 50) * stats.mightMult * (1 + (wep.level - 1) * 0.3);

        for (let i = 0; i < strikes; i++) {
          const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
          if (!target) continue;

          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'thunder',
            sourceWeapon: wep.id,
            x: target.x,
            y: target.y,
            vx: 0,
            vy: 0,
            damage: dmg,
            radius: (isConduit ? 55 : 40) * stats.areaMult,
            duration: 0.35,
            maxDuration: 0.35,
            pierce: 999,
            hitList: [],
            color: '#38bdf8',
          });
          spawnParticles(target.x, target.y, 10, '#38bdf8', 150);

          // If Mjolnir's Conduit, plant a conduit pylon for laser arcing
          if (isConduit) {
            if (!sim.conduitPylons) sim.conduitPylons = [];
            sim.conduitPylons.push({x: target.x, y: target.y, life: 5.0});
            if (sim.conduitPylons.length > 6) sim.conduitPylons.shift();
          }
        }
      }
    }

    // --- Toxic Spores & Necrotic Blight (Poison DoT) ---
    else if (wep.id === 'venom_spores' || wep.id === 'necrotic_blight') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playPotionGulp();

        const isBlight = wep.id === 'necrotic_blight';
        const sporeCount = isBlight ? 5 : 2 + Math.floor(wep.level / 2);
        const dmg = (def.baseDamage || 16) * stats.mightMult * (1 + (wep.level - 1) * 0.2);

        for (let i = 0; i < sporeCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 80 + Math.random() * 220;
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'spore',
            sourceWeapon: wep.id,
            x: sim.x + Math.cos(angle) * dist,
            y: sim.y + Math.sin(angle) * dist,
            vx: 0,
            vy: 0,
            damage: dmg,
            radius: (isBlight ? 75 : 45 + wep.level * 10) * stats.areaMult,
            duration: isBlight ? 4.0 : 3.0,
            maxDuration: isBlight ? 4.0 : 3.0,
            pierce: 999,
            hitList: [],
            color: isBlight ? '#10b981' : '#22c55e',
            inflictsPoison: true,
          });
        }
      }
    }

    // --- Glacial Shards & Absolute Zero (Slow Mechanics) ---
    else if (wep.id === 'frost_shard' || wep.id === 'absolute_zero') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();

        const count = wep.id === 'absolute_zero' ? 6 : 2 + Math.floor(wep.level / 2);
        const dmg = (def.baseDamage || 26) * stats.mightMult * (1 + (wep.level - 1) * 0.2);

        for (let i = 0; i < count; i++) {
          const angle = (i * (Math.PI * 2)) / count + (Math.random() * 0.2 - 0.1);
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'ice',
            sourceWeapon: wep.id,
            x: sim.x,
            y: sim.y,
            vx: Math.cos(angle) * 440,
            vy: Math.sin(angle) * 440,
            damage: dmg,
            radius: (14 + wep.level * 2) * stats.areaMult,
            duration: 2.0,
            maxDuration: 2.0,
            pierce: wep.id === 'absolute_zero' ? 5 : 2,
            hitList: [],
            color: '#06b6d4',
            inflictsSlow: true,
          });
        }
      }
    }

    // --- Radiant Aura & Solar Eclipse ---
    else if (wep.id === 'radiant_aura' || wep.id === 'solar_eclipse') {
      if (sim.weaponTimers[timerKey] >= actualCd) {
        sim.weaponTimers[timerKey] = 0;
        const isEclipse = wep.id === 'solar_eclipse';
        const auraRadius = (isEclipse ? 130 : 70 + wep.level * 15) * stats.areaMult;
        const dmg = (def.baseDamage || 14) * stats.mightMult * (1 + (wep.level - 1) * 0.2);

        if (isEclipse) {
          sim.solarPulseCounter = (sim.solarPulseCounter || 0) + 1;
        }

        const isGravitationalPulse = isEclipse && sim.solarPulseCounter! % 5 === 0;
        if (isGravitationalPulse) {
          sim.screenShake = 6;
          gameAudio.playPowerupChime();
          spawnParticles(sim.x, sim.y, 25, '#fbbf24', 160);
          spawnDamageNumber(sim.x, sim.y, 'SOLAR GRAVITATIONAL BURST!', '#fbbf24');
        }

        spatialGrid.forEachNearby(sim.x, sim.y, auraRadius + 40, (enemy) => {
          const dist = Math.hypot(enemy.x - sim.x, enemy.y - sim.y);
          if (dist <= auraRadius + enemy.size) {
            const hitDmg = isGravitationalPulse ? dmg * 2.2 : dmg;
            enemy.hp -= hitDmg;
            sim.weaponDamageDealt[wep.id] = (sim.weaponDamageDealt[wep.id] || 0) + hitDmg;
            spawnDamageNumber(enemy.x, enemy.y, Math.round(hitDmg).toString(), isEclipse ? '#f59e0b' : '#fde047');
            if (Math.random() < 0.2) spawnParticles(enemy.x, enemy.y, 3, '#fde047', 80);
            if (stats.toxicLevel > 0 && Math.random() < 0.3) {
              applyEnemyPoison(enemy, hitDmg * 0.6);
            }

            // Knockback on 5th pulse
            if (isGravitationalPulse && dist > 1) {
              const nx = (enemy.x - sim.x) / dist;
              const ny = (enemy.y - sim.y) / dist;
              enemy.x += nx * 60;
              enemy.y += ny * 60;
            }
          }
        });

        // Vacuum XP drops on gravitational pulse
        if (isGravitationalPulse) {
          sim.drops.forEach((d) => {
            if (Math.hypot(d.x - sim.x, d.y - sim.y) <= 450) {
              d.attracted = true;
            }
          });
        }
      }
    }

    // --- Orbiting Daggers & Phantom Storm ---
    else if (wep.id === 'spinning_dagger' || wep.id === 'phantom_storm') {
      const bladeCount = wep.id === 'phantom_storm' ? 8 : 2 + wep.level;
      let existingBladeCount = 0;
      for (let p = 0; p < sim.projectiles.length; p++) {
        if (sim.projectiles[p].type === 'dagger') existingBladeCount++;
      }
      if (existingBladeCount < bladeCount) {
        for (let i = existingBladeCount; i < bladeCount; i++) {
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'dagger',
            sourceWeapon: wep.id,
            x: sim.x,
            y: sim.y,
            vx: 0,
            vy: 0,
            damage: (def.baseDamage || 18) * stats.mightMult * (1 + (wep.level - 1) * 0.2),
            radius: 14 * stats.areaMult,
            duration: 9999,
            maxDuration: 9999,
            orbitAngle: (i * (Math.PI * 2)) / bladeCount,
            orbitDist: 65 * stats.areaMult,
            pierce: 999,
            hitList: [],
            color: wep.id === 'phantom_storm' ? '#c084fc' : '#e2e8f0',
            inflictsPoison: stats.toxicLevel > 0 && Math.random() < 0.35,
          });
        }
      }
    }

    // --- FUSION 1: Arcane Phantom Vortex ---
    else if (wep.id === 'arcane_phantom_vortex') {
      const bladeCount = 8;
      let existingVortexCount = 0;
      for (let p = 0; p < sim.projectiles.length; p++) {
        if (sim.projectiles[p].type === 'vortex') existingVortexCount++;
      }
      if (existingVortexCount < bladeCount) {
        for (let i = existingVortexCount; i < bladeCount; i++) {
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'vortex',
            sourceWeapon: 'arcane_phantom_vortex',
            x: sim.x,
            y: sim.y,
            vx: 0,
            vy: 0,
            damage: (def.baseDamage || 48) * stats.mightMult,
            radius: 18 * stats.areaMult,
            duration: 9999,
            maxDuration: 9999,
            orbitAngle: (i * (Math.PI * 2)) / bladeCount,
            orbitDist: 85 * stats.areaMult,
            pierce: 999,
            hitList: [],
            color: '#38bdf8',
          });
        }
      }
      // Extra rapid homing lasers from vortex
      if (sim.weaponTimers[timerKey] >= actualCd * 3 && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();
        const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
        const angle = Math.atan2(target.y - sim.y, target.x - sim.x);
        sim.projectiles.push({
          id: sim.nextProjId++,
          type: 'missile',
          sourceWeapon: 'arcane_phantom_vortex',
          x: sim.x,
          y: sim.y,
          vx: Math.cos(angle) * 580,
          vy: Math.sin(angle) * 580,
          damage: 60 * stats.mightMult,
          radius: 14 * stats.areaMult,
          duration: 2.0,
          maxDuration: 2.0,
          pierce: 3,
          hitList: [],
          color: '#a855f7',
        });
      }
    }

    // --- FUSION 2: Cataclysmic Supernova ---
    else if (wep.id === 'cataclysmic_nova') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playChiptuneExplosion();
        sim.screenShake = 12;

        for (let k = 0; k < 3; k++) {
          const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
          if (!target) continue;

          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'flame',
            sourceWeapon: 'cataclysmic_nova',
            x: target.x + (Math.random() * 80 - 40),
            y: target.y + (Math.random() * 80 - 40),
            vx: 0,
            vy: 0,
            damage: 110 * stats.mightMult,
            radius: 40 * stats.areaMult,
            duration: 0.8,
            maxDuration: 0.8,
            pierce: 999,
            hitList: [],
            color: '#ef4444',
            splashRadius: 180 * stats.areaMult,
          });

          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'thunder',
            sourceWeapon: 'cataclysmic_nova',
            x: target.x,
            y: target.y,
            vx: 0,
            vy: 0,
            damage: 90 * stats.mightMult,
            radius: 50 * stats.areaMult,
            duration: 0.4,
            maxDuration: 0.4,
            pierce: 999,
            hitList: [],
            color: '#facc15',
          });
        }
      }
    }

    // --- FUSION 3: Plague Sanctuary ---
    else if (wep.id === 'toxic_sanctuary') {
      if (sim.weaponTimers[timerKey] >= actualCd) {
        sim.weaponTimers[timerKey] = 0;
        const sanctuaryRadius = 160 * stats.areaMult;
        const dmg = (def.baseDamage || 38) * stats.mightMult;

        spatialGrid.forEachNearby(sim.x, sim.y, sanctuaryRadius + 40, (enemy) => {
          const dist = Math.hypot(enemy.x - sim.x, enemy.y - sim.y);
          if (dist <= sanctuaryRadius + enemy.size) {
            enemy.hp -= dmg;
            sim.weaponDamageDealt['toxic_sanctuary'] = (sim.weaponDamageDealt['toxic_sanctuary'] || 0) + dmg;
            spawnDamageNumber(enemy.x, enemy.y, Math.round(dmg).toString(), '#22c55e');
            applyEnemyPoison(enemy, dmg * 0.7);
            applyEnemySlow(enemy, 0.4, 0.5);
            if (Math.random() < 0.2) spawnParticles(enemy.x, enemy.y, 4, '#22c55e', 90);
          }
        });
      }
    }

    // --- FUSION 4: Shatterstorm (Glacial Shards L5 + Thunder Strike L5) ---
    else if (wep.id === 'shatterstorm') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();

        // 1. Launch 5 piercing glacial lances that freeze targets
        for (let i = 0; i < 5; i++) {
          const angle = (i * (Math.PI * 2)) / 5 + (Math.random() * 0.2 - 0.1);
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'ice',
            sourceWeapon: 'shatterstorm',
            x: sim.x,
            y: sim.y,
            vx: Math.cos(angle) * 520,
            vy: Math.sin(angle) * 520,
            damage: (def.baseDamage || 85) * stats.mightMult,
            radius: 18 * stats.areaMult,
            duration: 2.2,
            maxDuration: 2.2,
            pierce: 6,
            hitList: [],
            color: '#38bdf8',
            inflictsSlow: true,
          });
        }

        // 2. Chain lightning strikes down onto slowed/frozen enemies
        for (let k = 0; k < 3; k++) {
          let target: EnemyEntity | null = null;
          let slowedCount = 0;
          for (let e = 0; e < sim.enemies.length; e++) {
            if (sim.enemies[e].slowTimer > 0) {
              slowedCount++;
              if (Math.random() < 1 / slowedCount) {
                target = sim.enemies[e];
              }
            }
          }
          if (!target && sim.enemies.length > 0) {
            target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
          }
          if (target) {
            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'thunder',
              sourceWeapon: 'shatterstorm',
              x: target.x,
              y: target.y,
              vx: 0,
              vy: 0,
              damage: 95 * stats.mightMult,
              radius: 50 * stats.areaMult,
              duration: 0.35,
              maxDuration: 0.35,
              pierce: 999,
              hitList: [],
              color: '#67e8f9',
            });
            spawnDamageNumber(target.x, target.y, 'SHATTER CRIT!', '#38bdf8');
            spawnParticles(target.x, target.y, 12, '#38bdf8', 160);
          }
        }
      }
    }

    // --- FUSION 5: Frostbite Chakrams (Glacial Shards L5 + Orbiting Daggers L5) ---
    else if (wep.id === 'frostbite_chakrams') {
      const bladeCount = 8;
      let existingChakramCount = 0;
      for (let p = 0; p < sim.projectiles.length; p++) {
        if (sim.projectiles[p].type === 'chakram') existingChakramCount++;
      }
      if (existingChakramCount < bladeCount) {
        for (let i = existingChakramCount; i < bladeCount; i++) {
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'chakram',
            sourceWeapon: 'frostbite_chakrams',
            x: sim.x,
            y: sim.y,
            vx: 0,
            vy: 0,
            damage: (def.baseDamage || 42) * stats.mightMult,
            radius: 16 * stats.areaMult,
            duration: 9999,
            maxDuration: 9999,
            orbitAngle: (i * (Math.PI * 2)) / bladeCount,
            orbitDist: 75 * stats.areaMult,
            pierce: 999,
            hitList: [],
            color: '#06b6d4',
            inflictsSlow: true,
          });
        }
      }
    }

    // --- Gilded Chakram & Midas' Wrath (Unbanked Gold Scaling) ---
    else if (wep.id === 'gilded_chakram' || wep.id === 'midas_wrath') {
      if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
        sim.weaponTimers[timerKey] = 0;
        gameAudio.playArcadeLaser();

        const isMidas = wep.id === 'midas_wrath';
        // Wealth Scaling: +1% damage per 50 unbanked gold (+2% for Midas' Wrath)
        const goldRatio = Math.max(0, sim.gold / 50);
        const goldDmgMult = 1 + goldRatio * (isMidas ? 0.02 : 0.01);

        const count = isMidas ? 6 : 2 + Math.floor(wep.level / 2);
        const dmg =
          (def.baseDamage || 28) *
          stats.mightMult *
          goldDmgMult *
          (1 + (wep.level - 1) * 0.22);

        // Find nearest enemies
        const sorted = [...sim.enemies].sort(
          (a, b) => Math.hypot(a.x - sim.x, a.y - sim.y) - Math.hypot(b.x - sim.x, b.y - sim.y),
        );

        for (let i = 0; i < count; i++) {
          const target = sorted[i % sorted.length];
          const baseAngle = target ? Math.atan2(target.y - sim.y, target.x - sim.x) : Math.random() * Math.PI * 2;
          const spread = count > 1 ? (i - (count - 1) / 2) * 0.35 : 0;
          const angle = baseAngle + spread;

          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'gilded_disc',
            sourceWeapon: wep.id,
            x: sim.x,
            y: sim.y,
            vx: Math.cos(angle) * (isMidas ? 480 : 400),
            vy: Math.sin(angle) * (isMidas ? 480 : 400),
            damage: dmg,
            radius: (isMidas ? 18 : 13 + wep.level * 1.5) * stats.areaMult,
            duration: isMidas ? 2.8 : 2.0,
            maxDuration: isMidas ? 2.8 : 2.0,
            pierce: isMidas ? 6 : 2 + wep.level,
            hitList: [],
            color: '#facc15',
            inflictsPoison: stats.toxicLevel > 0 && Math.random() < 0.35,
          });
        }
      }
    }
  });
}
