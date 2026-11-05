import {gameAudio} from '../../utils/helper';
import {EnemyEntity, MAX_PROJECTILES, ProjectileEntity, SimulationState} from '../types/entities';
import {spatialGrid} from '../core/spatial';
import {applyEnemySlow} from './Player';
import {applyEnemyPoison} from './Weapons';
import {isEnemyInvulnerable, handleEnemyInvulnerableDeflect} from './Spawner';
import {stageManager} from '../core/Stage';

// --- Inferno Lance beam tuning ---
const BEAM_TICK_INTERVAL = 0.1;
const BEAM_TURN_RATE = 7.0; // radians per second the beam sweeps toward its target
const BEAM_WALL_STEP = 18;
const BEAM_MAX_PIERCE = 16;
// Preallocated scratch buffers so the per-frame beam scan never allocates.
const beamHitEnemies: (EnemyEntity | null)[] = new Array(BEAM_MAX_PIERCE).fill(null);
const beamHitAlong = new Float64Array(BEAM_MAX_PIERCE);
const BEAM_MAX_SIBLINGS = 8;
const beamClaimedIds = new Float64Array(BEAM_MAX_SIBLINGS);
// Phoenix Ray lifesteal: HP restored per enemy seared per tick, capped per tick.
const PHOENIX_HEAL_PER_HIT = 0.25;
const PHOENIX_HEAL_CAP_PER_TICK = 0.6;
// Frostfire Prism: every Nth tick the frost sheath ruptures burning targets with Thermal Shock.
const PRISM_SHOCK_EVERY_TICKS = 5;

function updateBeam(
  sim: SimulationState,
  proj: ProjectileEntity,
  dt: number,
  spawnDamageNumber: (x: number, y: number, text: string, color: string) => void,
  spawnParticles: (x: number, y: number, count: number, color: string, speed?: number) => void,
): void {
  const range = proj.beamRange || 400;

  // 1. Anchor the emitter to the hero.
  proj.x = sim.x;
  proj.y = sim.y;

  const isPhoenix = proj.sourceWeapon === 'phoenix_ray';
  const isPrism = proj.sourceWeapon === 'frostfire_prism';

  // 2a. Multi-beam weapons: note which targets sibling beams already hold (older beams keep priority).
  let claimedCount = 0;
  let ownTargetClaimed = false;
  if (isPrism) {
    for (let p = 0; p < sim.projectiles.length && claimedCount < BEAM_MAX_SIBLINGS; p++) {
      const other = sim.projectiles[p];
      if (other === proj || other.type !== 'beam' || other.sourceWeapon !== proj.sourceWeapon) continue;
      if (other.targetId === undefined) continue;
      beamClaimedIds[claimedCount++] = other.targetId;
      if (other.targetId === proj.targetId && other.id < proj.id) ownTargetClaimed = true;
    }
  }

  // 2b. Keep the current target, or retarget the nearest unclaimed living foe in range.
  let target: EnemyEntity | null = null;
  if (!ownTargetClaimed) {
    for (let e = 0; e < sim.enemies.length; e++) {
      const enemy = sim.enemies[e];
      if (enemy.id === proj.targetId && enemy.hp > 0) {
        target = enemy;
        break;
      }
    }
  }
  if (!target) {
    proj.targetId = undefined;
    let bestSq = range * range;
    for (let e = 0; e < sim.enemies.length; e++) {
      const enemy = sim.enemies[e];
      if (enemy.hp <= 0) continue;
      let claimed = false;
      for (let c = 0; c < claimedCount; c++) {
        if (beamClaimedIds[c] === enemy.id) {
          claimed = true;
          break;
        }
      }
      if (claimed) continue;
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestSq) {
        bestSq = dSq;
        target = enemy;
      }
    }
    if (target) proj.targetId = target.id;
  }

  // 3. Sweep the beam toward the target at a capped turn rate (it scythes through crowds).
  let angle = proj.rotation || 0;
  if (target) {
    let diff = Math.atan2(target.y - proj.y, target.x - proj.x) - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = BEAM_TURN_RATE * dt;
    angle += diff > maxTurn ? maxTurn : diff < -maxTurn ? -maxTurn : diff;
    proj.rotation = angle;
  }
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  // 4. Solid terrain blocks the beam.
  let maxLen = range;
  for (let t = BEAM_WALL_STEP; t <= range; t += BEAM_WALL_STEP) {
    if (!stageManager.isWalkable(proj.x + dirX * t, proj.y + dirY * t, 4)) {
      maxLen = t;
      break;
    }
  }

  // 5. Collect the nearest `pierce` enemies along the beam corridor (insertion sort into scratch buffers).
  const pierce = Math.max(1, Math.min(BEAM_MAX_PIERCE, proj.pierce));
  let hitCount = 0;
  for (let e = 0; e < sim.enemies.length; e++) {
    const enemy = sim.enemies[e];
    if (enemy.hp <= 0) continue;
    const rx = enemy.x - proj.x;
    const ry = enemy.y - proj.y;
    const along = rx * dirX + ry * dirY;
    if (along < -enemy.size || along > maxLen + enemy.size) continue;
    const perp = Math.abs(rx * dirY - ry * dirX);
    if (perp > proj.radius + enemy.size) continue;
    if (hitCount === pierce && along >= beamHitAlong[hitCount - 1]) continue;

    let slot = hitCount < pierce ? hitCount++ : hitCount - 1;
    while (slot > 0 && beamHitAlong[slot - 1] > along) {
      beamHitAlong[slot] = beamHitAlong[slot - 1];
      beamHitEnemies[slot] = beamHitEnemies[slot - 1];
      slot--;
    }
    beamHitAlong[slot] = along;
    beamHitEnemies[slot] = enemy;
  }

  // 6. Beam terminates at the last enemy it burns through once its pierce is exhausted.
  const beamLen = hitCount === pierce ? Math.max(0, Math.min(maxLen, beamHitAlong[hitCount - 1])) : maxLen;
  proj.beamEndX = proj.x + dirX * beamLen;
  proj.beamEndY = proj.y + dirY * beamLen;

  // 7. Apply damage on a fixed tick.
  proj.beamTickTimer = (proj.beamTickTimer || 0) + dt;
  if (proj.beamTickTimer >= BEAM_TICK_INTERVAL) {
    proj.beamTickTimer -= BEAM_TICK_INTERVAL;
    proj.beamTicks = (proj.beamTicks || 0) + 1;
    const showNumber = proj.beamTicks % 3 === 0;
    const shockTick = isPrism && proj.beamTicks % PRISM_SHOCK_EVERY_TICKS === 0;
    let healed = 0;

    for (let h = 0; h < hitCount; h++) {
      const enemy = beamHitEnemies[h]!;
      beamHitEnemies[h] = null;
      if (isEnemyInvulnerable(enemy, sim)) {
        handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
        continue;
      }
      enemy.hp -= proj.damage;
      if (proj.sourceWeapon) {
        sim.weaponDamageDealt[proj.sourceWeapon] = (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
      }
      // Ignite: keeps a refreshed burn on everything the lance touches.
      enemy.burnTimer = Math.max(enemy.burnTimer, 2.0);
      enemy.burnDps = Math.max(enemy.burnDps, proj.damage * 1.2);
      if (proj.inflictsPoison) applyEnemyPoison(enemy, proj.damage * 0.5);

      if (isPrism) {
        applyEnemySlow(enemy, 0.45, 1.0);
        // Thermal Shock: the frost sheath ruptures the burn the fire core just applied.
        if (shockTick && enemy.burnTimer > 0) {
          const shockBonus = proj.damage * 2 + enemy.burnDps;
          enemy.hp -= shockBonus;
          if (proj.sourceWeapon) {
            sim.weaponDamageDealt[proj.sourceWeapon] = (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + shockBonus;
          }
          enemy.burnTimer = 0;
          spawnDamageNumber(enemy.x, enemy.y, `THERMAL SHOCK ${Math.round(shockBonus)}!`, '#38bdf8');
          spawnParticles(enemy.x, enemy.y, 6, '#38bdf8', 120);
          spawnParticles(enemy.x, enemy.y, 4, '#f97316', 100);
          if (sim.screenShake < 3) sim.screenShake = 3;
        }
      }
      if (isPhoenix) healed += PHOENIX_HEAL_PER_HIT;

      if (showNumber) {
        spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage * 3).toString(), isPhoenix ? '#fbbf24' : '#fb923c');
      }
      if (Math.random() < 0.35) spawnParticles(enemy.x, enemy.y, 2, isPrism ? '#a5f3fc' : '#fdba74', 90);
    }

    // Phoenix Ray lifesteal
    if (healed > 0 && sim.hp > 0 && sim.hp < sim.maxHp) {
      sim.hp = Math.min(sim.maxHp, sim.hp + Math.min(healed, PHOENIX_HEAL_CAP_PER_TICK));
      if (Math.random() < 0.3) spawnParticles(sim.x, sim.y, 1, '#fde68a', 50);
    }
  } else {
    for (let h = 0; h < hitCount; h++) beamHitEnemies[h] = null;
  }

  // 8. Drifting embers along the beam and at the impact point.
  if (Math.random() < 0.3) {
    const t = Math.random() * beamLen;
    spawnParticles(proj.x + dirX * t, proj.y + dirY * t, 1, '#f97316', 40);
  }
  if (beamLen < maxLen && Math.random() < 0.25) {
    spawnParticles(proj.beamEndX, proj.beamEndY, 1, '#fef3c7', 70);
  }
}

export function updateProjectiles(
  sim: SimulationState,
  dt: number,
  spawnDamageNumber: (x: number, y: number, text: string, color: string) => void,
  spawnParticles: (x: number, y: number, count: number, color: string, speed?: number) => void,
  onPlayerHit: (damage: number) => void,
): void {
  // Hard cap active projectiles to prevent lag spikes
  while (sim.projectiles.length > MAX_PROJECTILES) {
    let removeIdx = -1;
    for (let p = 0; p < sim.projectiles.length; p++) {
      const type = sim.projectiles[p].type;
      if (
        type !== 'dagger' &&
        type !== 'vortex' &&
        type !== 'chakram' &&
        type !== 'gravity_well' &&
        type !== 'grenade' &&
        type !== 'beam'
      ) {
        removeIdx = p;
        break;
      }
    }
    if (removeIdx !== -1) sim.projectiles.splice(removeIdx, 1);
    else break;
  }
  // 1. Process Mjolnir's Conduit electrified laser arcing between pylons
  if (sim.conduitPylons && sim.conduitPylons.length >= 2) {
    for (let p = sim.conduitPylons.length - 1; p >= 0; p--) {
      sim.conduitPylons[p].life -= dt;
      if (sim.conduitPylons[p].life <= 0) {
        sim.conduitPylons.splice(p, 1);
      }
    }

    const pylons = sim.conduitPylons;
    for (let a = 0; a < pylons.length; a++) {
      for (let b = a + 1; b < pylons.length; b++) {
        const p1 = pylons[a];
        const p2 = pylons[b];
        const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (segDist > 0 && segDist < 600) {
          // Arc damage to any enemy near the laser segment
          for (let e = 0; e < sim.enemies.length; e++) {
            const enemy = sim.enemies[e];
            const cross = (enemy.x - p1.x) * (p2.y - p1.y) - (enemy.y - p1.y) * (p2.x - p1.x);
            const lineDist = Math.abs(cross) / segDist;
            if (lineDist < 25) {
              const dot = (enemy.x - p1.x) * (p2.x - p1.x) + (enemy.y - p1.y) * (p2.y - p1.y);
              if (dot >= 0 && dot <= segDist * segDist) {
                if (isEnemyInvulnerable(enemy, sim)) {
                  handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
                  continue;
                }
                const arcDmg = 80 * dt;
                enemy.hp -= arcDmg;
                sim.weaponDamageDealt['mjolnir_conduit'] = (sim.weaponDamageDealt['mjolnir_conduit'] || 0) + arcDmg;
                if (Math.random() < 0.15) {
                  spawnParticles(enemy.x, enemy.y, 2, '#38bdf8', 70);
                }
              }
            }
          }
        }
      }
    }
  }

  // 2. Elemental Ground Synergy: Spore Cloud + Flame Pool Overlap Detonation
  for (let s = 0; s < sim.projectiles.length; s++) {
    const spore = sim.projectiles[s];
    if (spore.type !== 'spore' || spore.duration <= 0) continue;

    for (let f = 0; f < sim.projectiles.length; f++) {
      const flame = sim.projectiles[f];
      if ((flame.type !== 'flame_pool' && flame.type !== 'flame') || flame.duration <= 0) continue;

      const overlapDist = Math.hypot(spore.x - flame.x, spore.y - flame.y);
      if (overlapDist <= spore.radius + flame.radius) {
        // Vapor ignition! Chemical blast
        gameAudio.playChiptuneExplosion();
        sim.screenShake = 11;
        const midX = (spore.x + flame.x) / 2;
        const midY = (spore.y + flame.y) / 2;
        const blastRad = (spore.radius + flame.radius) * 1.25;
        const blastDmg = spore.damage * 2.8 + flame.damage * 2.2;

        spawnDamageNumber(midX, midY, `VAPOR IGNITION ${Math.round(blastDmg)}!`, '#22c55e');
        spawnParticles(midX, midY, 16, '#22c55e', 180);
        spawnParticles(midX, midY, 16, '#ea580c', 180);

        sim.enemies.forEach((enemy) => {
          const eDist = Math.hypot(enemy.x - midX, enemy.y - midY);
          if (eDist <= blastRad + enemy.size) {
            if (isEnemyInvulnerable(enemy, sim)) {
              handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
              return;
            }
            enemy.hp -= blastDmg;
            enemy.burnTimer = 3.5;
            enemy.burnDps = Math.max(enemy.burnDps, blastDmg * 0.35);
            applyEnemyPoison(enemy, blastDmg * 0.45, 4.0);
            spawnDamageNumber(enemy.x, enemy.y, Math.round(blastDmg).toString(), '#f97316');
          }
        });

        spore.duration = 0; // Consume the spore cloud
        break;
      }
    }
  }

  // 3. Process all projectiles
  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const proj = sim.projectiles[i];
    proj.duration -= dt;

    if (
      (proj.type === 'dagger' || proj.type === 'vortex' || proj.type === 'chakram') &&
      proj.orbitAngle !== undefined &&
      proj.orbitDist !== undefined
    ) {
      const spinSpeed = proj.type === 'vortex' ? 5.0 : proj.type === 'chakram' ? 6.0 : 3.5;
      proj.orbitAngle += spinSpeed * dt;

      // Frostbite chakrams oscillate radially
      const effectiveDist = proj.type === 'chakram'
        ? proj.orbitDist + Math.sin(sim.runTimer * 4 + proj.orbitAngle) * 35
        : proj.orbitDist;

      proj.x = sim.x + Math.cos(proj.orbitAngle) * effectiveDist;
      proj.y = sim.y + Math.sin(proj.orbitAngle) * effectiveDist;

      // Leave freezing slipstream particles behind chakrams
      if (proj.type === 'chakram' && Math.random() < 0.2) {
        spawnParticles(proj.x, proj.y, 1, '#06b6d4', 30);
      }

      // Collision with enemies (spatial query + timestamp hit tracking)
      if (!proj.hitTimes) proj.hitTimes = {};
      spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 60, (enemy) => {
        const lastHit = proj.hitTimes![enemy.id] || 0;
        if (sim.runTimer - lastHit >= 0.35) {
          const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
          if (dist < proj.radius + enemy.size) {
            if (isEnemyInvulnerable(enemy, sim)) {
              proj.hitTimes![enemy.id] = sim.runTimer;
              handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
              return;
            }
            enemy.hp -= proj.damage;
            proj.hitTimes![enemy.id] = sim.runTimer;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
            }
            gameAudio.playSwordClash();
            spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage).toString(), proj.color);
            spawnParticles(proj.x, proj.y, 4, proj.color, 90);

            if (proj.inflictsPoison) applyEnemyPoison(enemy, proj.damage * 0.5);
            if (proj.inflictsSlow) applyEnemySlow(enemy, 0.45, 2.5);

            // Thermal Shock reaction with burning enemies
            if (proj.inflictsSlow && enemy.burnTimer > 0) {
              const shockBonus = proj.damage * 1.5 + enemy.burnDps * 2;
              enemy.hp -= shockBonus;
              sim.screenShake = 5;
              spawnDamageNumber(enemy.x, enemy.y, `THERMAL SHOCK ${Math.round(shockBonus)}!`, '#38bdf8');
              spawnParticles(enemy.x, enemy.y, 10, '#38bdf8', 130);
              spawnParticles(enemy.x, enemy.y, 8, '#f97316', 100);
              enemy.burnTimer = 0;
            }
          }
        }
      });
    } else if (proj.type === 'chain_lightning') {
      // Damage is applied at cast time; retain the projectile only for its brief visual arc.
    } else if (proj.type === 'spore') {
      // Lingering toxic cloud field (spatial query)
      spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 40, (enemy) => {
        const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
        if (dist <= proj.radius + enemy.size) {
          if (isEnemyInvulnerable(enemy, sim)) return;
          applyEnemyPoison(enemy, proj.damage * 0.7, 3.5);
          if (Math.random() < 0.1) {
            enemy.hp -= proj.damage * dt;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage * dt;
            }
          }
        }
      });
    } else if (proj.type === 'flame_pool') {
      // Lingering flame pool on the ground (spatial query)
      spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 40, (enemy) => {
        const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
        if (dist <= proj.radius + enemy.size) {
          if (isEnemyInvulnerable(enemy, sim)) return;
          enemy.burnTimer = 3.0;
          enemy.burnDps = Math.max(enemy.burnDps, proj.damage * 0.85);
          if (Math.random() < 0.12) {
            enemy.hp -= proj.damage * dt * 1.5;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage * dt * 1.5;
            }
          }
        }
      });
      if (Math.random() < 0.2) {
        spawnParticles(proj.x + (Math.random() * 20 - 10), proj.y + (Math.random() * 20 - 10), 1, '#ea580c', 35);
      }
    } else if (proj.type === 'thunder') {
      if (proj.duration >= proj.maxDuration - dt * 1.5) {
        spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 40, (enemy) => {
          const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
          if (dist <= proj.radius + enemy.size) {
            if (isEnemyInvulnerable(enemy, sim)) {
              handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
              return;
            }
            enemy.hp -= proj.damage;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
            }
            spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage).toString(), '#38bdf8');
          }
        });
      }
    } else if (proj.type === 'gravity_well') {
      if (!proj.hitTimes) proj.hitTimes = {};
      const isEventHorizon = proj.sourceWeapon === 'event_horizon';
      const isCryo = proj.sourceWeapon === 'cryo_singularity';

      // Pull enemies toward singularity center & apply periodic crushing DoT
      spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 60, (enemy) => {
        const dx = proj.x - enemy.x;
        const dy = proj.y - enemy.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= proj.radius + enemy.size) {
          if (dist > 10) {
            const pullFactor = (1 - dist / (proj.radius + enemy.size)) * 340 + 90;
            const massRes = enemy.isBoss ? 0.3 : enemy.isElite ? 0.65 : 1.0;
            const nx = dx / dist;
            const ny = dy / dist;
            enemy.x += nx * pullFactor * massRes * dt;
            enemy.y += ny * pullFactor * massRes * dt;
          }

          const lastHit = proj.hitTimes![enemy.id] || 0;
          if (sim.runTimer - lastHit >= 0.35) {
            proj.hitTimes![enemy.id] = sim.runTimer;
            if (isEnemyInvulnerable(enemy, sim)) {
              handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
              return;
            }
            enemy.hp -= proj.damage;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
            }
            spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage).toString(), proj.color);
            if (Math.random() < 0.25) {
              spawnParticles(enemy.x, enemy.y, 2, proj.color, 60);
            }
            if (proj.inflictsSlow || isCryo) {
              applyEnemySlow(enemy, 0.65, 2.5);
            }
            if (proj.inflictsPoison) {
              applyEnemyPoison(enemy, proj.damage * 0.5);
            }
          }
        }
      });

      // Pull ground drops inward (or vacuum directly to player if Event Horizon)
      for (let d = 0; d < sim.drops.length; d++) {
        const drop = sim.drops[d];
        if (drop.type === 'chest' || drop.type === 'blood_chalice') continue;
        const ddx = proj.x - drop.x;
        const ddy = proj.y - drop.y;
        const ddist = Math.hypot(ddx, ddy);
        if (ddist <= proj.radius) {
          if (isEventHorizon) {
            drop.attracted = true;
          } else if (ddist > 12) {
            const dropPull = 220 * dt;
            drop.x += (ddx / ddist) * dropPull;
            drop.y += (ddy / ddist) * dropPull;
          }
        }
      }

      // Ambient inward cosmic particles
      if (Math.random() < 0.25) {
        const randAngle = Math.random() * Math.PI * 2;
        const randR = proj.radius * 0.75;
        spawnParticles(proj.x + Math.cos(randAngle) * randR, proj.y + Math.sin(randAngle) * randR, 1, proj.color, 45);
      }
    } else if (proj.type === 'beam') {
      updateBeam(sim, proj, dt, spawnDamageNumber, spawnParticles);
    } else if (proj.type === 'grenade') {
      // Parabolic flight: update ground coordinates & rotation
      const progress = Math.min(1, Math.max(0, 1 - proj.duration / proj.maxDuration));
      if (proj.arcStartX !== undefined && proj.arcTargetX !== undefined) {
        proj.x = proj.arcStartX + (proj.arcTargetX - proj.arcStartX) * progress;
        proj.y = proj.arcStartY! + (proj.arcTargetY! - proj.arcStartY!) * progress;
      }
      proj.rotation = (proj.rotation || 0) + (proj.spinSpeed || 10) * dt;

      // Trailing fuse sparks
      if (Math.random() < 0.25) {
        spawnParticles(proj.x, proj.y, 1, '#f97316', 25);
      }
    } else {
      // Homing projectiles retarget automatically when their current prey dies.
      if (proj.type === 'beetle' || proj.type === 'homing_missile') {
        let target = sim.enemies.find((e) => e.id === proj.targetId);
        if (!target && sim.enemies.length > 0) {
          target = sim.enemies[0];
          proj.targetId = target.id;
        }
        if (target) {
          const bAngle = Math.atan2(target.y - proj.y, target.x - proj.x);
          const turnForce = proj.type === 'homing_missile' ? 1050 : 900;
          const maxSpeed = proj.type === 'homing_missile' ? 420 : 450;
          proj.vx += Math.cos(bAngle) * turnForce * dt;
          proj.vy += Math.sin(bAngle) * turnForce * dt;
          const curSpeed = Math.hypot(proj.vx, proj.vy);
          if (curSpeed > maxSpeed) {
            proj.vx = (proj.vx / curSpeed) * maxSpeed;
            proj.vy = (proj.vy / curSpeed) * maxSpeed;
          }
        }
      }

      // Linear / Homing Projectiles
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      if (proj.isEnemy) {
        // Tactical cover: enemy orbs dissipate against solid terrain
        if (!stageManager.isWalkable(proj.x, proj.y, proj.radius)) {
          proj.duration = 0;
          spawnParticles(proj.x, proj.y, 6, proj.color, 80);
        } else {
          const dist = Math.hypot(sim.x - proj.x, sim.y - proj.y);
          if (dist < proj.radius + 20 && sim.invulnTimer <= 0 && sim.aegisShieldTimer <= 0) {
            sim.hp -= proj.damage;
            sim.invulnTimer = 0.5;
            sim.screenShake = 12;
            gameAudio.playMeleePunch();
            spawnDamageNumber(sim.x, sim.y, `-${Math.round(proj.damage)}`, '#ef4444');
            onPlayerHit(proj.damage);
            proj.duration = 0;
          }
        }
      } else {
        // Physical player projectiles explode against solid obstacles
        if (
          (proj.type === 'missile' || proj.type === 'shotgun_pellet' || proj.type === 'flame') &&
          !stageManager.isWalkable(proj.x, proj.y, proj.radius)
        ) {
          proj.duration = 0;
          spawnParticles(proj.x, proj.y, 6, proj.color, 90);
        }
        spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 50, (enemy) => {
          if (proj.duration <= 0 || proj.hitList.includes(enemy.id)) return;

          const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
          if (dist < proj.radius + enemy.size) {
            proj.hitList.push(enemy.id);
            if (isEnemyInvulnerable(enemy, sim)) {
              proj.pierce -= 1;
              handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
              if (proj.pierce <= 0) proj.duration = 0;
              return;
            }
            enemy.hp -= proj.damage;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
            }
            spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage).toString(), proj.color);
            spawnParticles(proj.x, proj.y, 5, proj.color, 100);

            if (proj.inflictsPoison) applyEnemyPoison(enemy, proj.damage * 0.5);
            if (proj.inflictsSlow) applyEnemySlow(enemy, 0.5, 3.0);
            if (proj.type === 'shotgun_pellet') {
              const speed = Math.hypot(proj.vx, proj.vy);
              if (speed > 1) {
                const knockback = proj.sourceWeapon === 'starfall_scattergun' ? 28 : 20;
                enemy.x += (proj.vx / speed) * knockback;
                enemy.y += (proj.vy / speed) * knockback;
              }
            }
            if (proj.type === 'gilded_disc' && Math.random() < 0.25) {
              gameAudio.playCoinPickup();
            }

            // Thermal Shock: Glacial / Ice hits a burning enemy
            if ((proj.type === 'ice' || proj.inflictsSlow) && enemy.burnTimer > 0) {
              const shockBonus = proj.damage * 1.8 + enemy.burnDps * 2.2;
              enemy.hp -= shockBonus;
              sim.screenShake = 6;
              gameAudio.playSwordClash();
              spawnDamageNumber(enemy.x, enemy.y, `THERMAL SHOCK ${Math.round(shockBonus)}!`, '#38bdf8');
              spawnParticles(enemy.x, enemy.y, 12, '#38bdf8', 140);
              spawnParticles(enemy.x, enemy.y, 8, '#f97316', 110);
              enemy.burnTimer = 0;
            }

            if (proj.type === 'flame') {
              // Apply burn to primary target
              enemy.burnTimer = 3.0;
              enemy.burnDps = Math.max(enemy.burnDps, proj.damage * 0.5);

              // Spawn lingering flame pool at impact location
              sim.projectiles.push({
                id: sim.nextProjId++,
                type: 'flame_pool',
                sourceWeapon: proj.sourceWeapon || 'flame_blast',
                x: enemy.x,
                y: enemy.y,
                vx: 0,
                vy: 0,
                damage: proj.damage * 0.45,
                radius: Math.max(35, (proj.splashRadius || 60) * 0.65),
                duration: 2.5,
                maxDuration: 2.5,
                pierce: 999,
                hitList: [],
                color: '#ea580c',
              });

              if (proj.splashRadius) {
                gameAudio.playChiptuneExplosion();
                sim.screenShake = 6;
                spatialGrid.forEachNearby(proj.x, proj.y, proj.splashRadius + 40, (other) => {
                  if (other.id !== enemy.id) {
                    const splashDist = Math.hypot(other.x - proj.x, other.y - proj.y);
                    if (splashDist <= proj.splashRadius! + other.size) {
                      other.hp -= proj.damage * 0.7;
                      other.burnTimer = 3.0;
                      other.burnDps = Math.max(other.burnDps, proj.damage * 0.4);
                      if (proj.sourceWeapon) {
                        sim.weaponDamageDealt[proj.sourceWeapon] =
                          (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage * 0.7;
                      }
                      spawnDamageNumber(other.x, other.y, Math.round(proj.damage * 0.7).toString(), '#ea580c');
                      if (proj.inflictsPoison) applyEnemyPoison(other, proj.damage * 0.4);
                    }
                  }
                });
              }
              proj.duration = 0;
              return;
            }

            proj.pierce -= 1;
            if (proj.pierce <= 0) {
              proj.duration = 0;
              return;
            }
          }
        });
      }
    }

    if (proj.duration <= 0) {
      if (proj.type === 'gravity_well') {
        gameAudio.playChiptuneExplosion();
        const isEventHorizon = proj.sourceWeapon === 'event_horizon';
        const isCryo = proj.sourceWeapon === 'cryo_singularity';
        sim.screenShake = isEventHorizon ? 16 : isCryo ? 13 : 10;
        const blastRadius = proj.splashRadius || proj.radius * 1.15;
        const burstDmg = proj.damage * (isEventHorizon ? 3.2 : isCryo ? 2.8 : 2.5);

        spawnDamageNumber(
          proj.x,
          proj.y,
          isEventHorizon
            ? `SUPERNOVA ${Math.round(burstDmg)}!`
            : isCryo
            ? `CRYO SHATTER ${Math.round(burstDmg)}!`
            : `IMPLOSION ${Math.round(burstDmg)}!`,
          proj.color,
        );
        spawnParticles(proj.x, proj.y, isEventHorizon ? 35 : 24, proj.color, 240);

        spatialGrid.forEachNearby(proj.x, proj.y, blastRadius + 50, (enemy) => {
          const bdx = enemy.x - proj.x;
          const bdy = enemy.y - proj.y;
          const bdist = Math.hypot(bdx, bdy);
          if (bdist <= blastRadius + enemy.size) {
            if (isEnemyInvulnerable(enemy, sim)) {
              handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
              return;
            }
            enemy.hp -= burstDmg;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + burstDmg;
            }
            spawnDamageNumber(enemy.x, enemy.y, Math.round(burstDmg).toString(), proj.color);

            // Radial knockback outward
            if (bdist > 1) {
              const knockback = enemy.isBoss ? 8 : enemy.isElite ? 22 : 45;
              enemy.x += (bdx / bdist) * knockback;
              enemy.y += (bdy / bdist) * knockback;
            }

            if (isCryo) {
              applyEnemySlow(enemy, 0.8, 3.5);
              // Thermal Shock if burning
              if (enemy.burnTimer > 0) {
                const shockBonus = burstDmg * 1.6 + enemy.burnDps * 2;
                enemy.hp -= shockBonus;
                spawnDamageNumber(enemy.x, enemy.y, `THERMAL SHOCK ${Math.round(shockBonus)}!`, '#38bdf8');
                spawnParticles(enemy.x, enemy.y, 10, '#38bdf8', 130);
                enemy.burnTimer = 0;
              }
            }
          }
        });
      }

      if (proj.type === 'grenade') {
        gameAudio.playChiptuneExplosion();
        const isNapalm = proj.sourceWeapon === 'napalm_mortar';
        const isMirv = proj.sourceWeapon === 'cluster_mirv';
        sim.screenShake = isNapalm ? 14 : isMirv ? 12 : 9;

        const blastRadius = proj.splashRadius || 85;
        const coreRadius = blastRadius * 0.35;

        spawnDamageNumber(
          proj.x,
          proj.y,
          isNapalm ? 'NAPALM BLAST!' : isMirv && !proj.isCluster ? 'CLUSTER DETONATION!' : 'BLAST!',
          proj.color,
        );
        spawnParticles(proj.x, proj.y, isNapalm ? 30 : 20, proj.color, 180);
        spawnParticles(proj.x, proj.y, 10, '#facc15', 120);

        spatialGrid.forEachNearby(proj.x, proj.y, blastRadius + 50, (enemy) => {
          const bdx = enemy.x - proj.x;
          const bdy = enemy.y - proj.y;
          const bdist = Math.hypot(bdx, bdy);
          if (bdist <= blastRadius + enemy.size) {
            if (isEnemyInvulnerable(enemy, sim)) {
              handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
              return;
            }
            let falloff = 1;
            if (bdist > coreRadius) {
              falloff = Math.max(0.35, 1 - ((bdist - coreRadius) / (blastRadius - coreRadius)) * 0.65);
            }
            const hitDmg = proj.damage * falloff;
            enemy.hp -= hitDmg;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + hitDmg;
            }
            spawnDamageNumber(enemy.x, enemy.y, Math.round(hitDmg).toString(), proj.color);

            // High kinetic radial knockback
            if (bdist > 1) {
              const baseKnock = enemy.isBoss ? 12 : enemy.isElite ? 28 : 65;
              const knockback = baseKnock * falloff;
              enemy.x += (bdx / bdist) * knockback;
              enemy.y += (bdy / bdist) * knockback;
            }

            if (proj.inflictsPoison) applyEnemyPoison(enemy, hitDmg * 0.5);
            if (isNapalm) {
              enemy.burnTimer = 4.0;
              enemy.burnDps = Math.max(enemy.burnDps, hitDmg * 0.45);
              applyEnemySlow(enemy, 0.35, 3.0);
            }
          }
        });

        // Napalm Mortar: Coat ground in 3 lingering napalm pools
        if (isNapalm) {
          for (let p = 0; p < 3; p++) {
            const poolAngle = (p * Math.PI * 2) / 3 + Math.random() * 0.5;
            const poolDist = p === 0 ? 0 : 35 + Math.random() * 25;
            const poolX = proj.x + Math.cos(poolAngle) * poolDist;
            const poolY = proj.y + Math.sin(poolAngle) * poolDist;
            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'flame_pool',
              sourceWeapon: 'napalm_mortar',
              x: poolX,
              y: poolY,
              vx: 0,
              vy: 0,
              damage: proj.damage * 0.5,
              radius: 45,
              duration: 3.5,
              maxDuration: 3.5,
              pierce: 999,
              hitList: [],
              color: '#ea580c',
            });
          }
        }

        // MIRV Cluster Mortar: Spawn 4 cascading mini-bomblets
        if (isMirv && !proj.isCluster) {
          for (let c = 0; c < 4; c++) {
            const clusterAngle = (c * Math.PI * 2) / 4 + (Math.random() * 0.4 - 0.2);
            const clusterDist = 60 + Math.random() * 35;
            const cTargetX = proj.x + Math.cos(clusterAngle) * clusterDist;
            const cTargetY = proj.y + Math.sin(clusterAngle) * clusterDist;
            const cDuration = 0.28 + Math.random() * 0.1;

            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'grenade',
              sourceWeapon: 'cluster_mirv',
              x: proj.x,
              y: proj.y,
              vx: (cTargetX - proj.x) / cDuration,
              vy: (cTargetY - proj.y) / cDuration,
              damage: proj.damage * 0.55,
              radius: 10,
              splashRadius: blastRadius * 0.65,
              duration: cDuration,
              maxDuration: cDuration,
              pierce: 999,
              hitList: [],
              color: '#c084fc',
              arcStartX: proj.x,
              arcStartY: proj.y,
              arcTargetX: cTargetX,
              arcTargetY: cTargetY,
              arcPeakHeight: 35,
              rotation: Math.random() * Math.PI * 2,
              spinSpeed: (Math.random() > 0.5 ? 1 : -1) * 16,
              isCluster: true,
              inflictsPoison: proj.inflictsPoison,
            });
          }
        }
      }
      sim.projectiles.splice(i, 1);
    }
  }
}
