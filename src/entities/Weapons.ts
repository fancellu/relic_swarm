import {gameAudio} from '../../utils/helper';
import {EnemyEntity, EquippedItem, SimulationState} from '../types/entities';
import {ITEM_DEFS} from '../types/items';
import {applyEnemySlow, DerivedStats} from './Player';

export function applyEnemyPoison(enemy: EnemyEntity, dps: number, duration = 4.0): void {
  enemy.poisonDps = Math.max(enemy.poisonDps, dps);
  enemy.poisonTimer = Math.max(enemy.poisonTimer, duration);
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

        const sorted = [...sim.enemies].sort(
          (a, b) => Math.hypot(a.x - sim.x, a.y - sim.y) - Math.hypot(b.x - sim.x, b.y - sim.y),
        );

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

        sim.enemies.forEach((enemy) => {
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
      const existingBlades = sim.projectiles.filter((p) => p.type === 'dagger');
      if (existingBlades.length < bladeCount) {
        for (let i = existingBlades.length; i < bladeCount; i++) {
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
      const existingBlades = sim.projectiles.filter((p) => p.type === 'vortex');
      if (existingBlades.length < bladeCount) {
        for (let i = existingBlades.length; i < bladeCount; i++) {
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

        sim.enemies.forEach((enemy) => {
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
        const slowedEnemies = sim.enemies.filter((e) => e.slowTimer > 0);
        const candidates = slowedEnemies.length > 0 ? slowedEnemies : sim.enemies;
        const strikeCount = Math.min(3, candidates.length);
        for (let k = 0; k < strikeCount; k++) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
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
      const existingChakrams = sim.projectiles.filter((p) => p.type === 'chakram');
      if (existingChakrams.length < bladeCount) {
        for (let i = existingChakrams.length; i < bladeCount; i++) {
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
  });
}
