import {gameAudio} from '../../utils/helper';
import {SimulationState} from '../types/entities';
import {applyEnemySlow} from './Player';
import {applyEnemyPoison} from './Weapons';

export function updateProjectiles(
  sim: SimulationState,
  dt: number,
  spawnDamageNumber: (x: number, y: number, text: string, color: string) => void,
  spawnParticles: (x: number, y: number, count: number, color: string, speed?: number) => void,
  onPlayerHit: (damage: number) => void,
): void {
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

      // Collision with enemies
      sim.enemies.forEach((enemy) => {
        if (!proj.hitList.includes(enemy.id)) {
          const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
          if (dist < proj.radius + enemy.size) {
            enemy.hp -= proj.damage;
            proj.hitList.push(enemy.id);
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

            setTimeout(() => {
              proj.hitList = proj.hitList.filter((id) => id !== enemy.id);
            }, 350);
          }
        }
      });
    } else if (proj.type === 'spore') {
      // Lingering toxic cloud field
      sim.enemies.forEach((enemy) => {
        const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
        if (dist <= proj.radius + enemy.size) {
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
      // Lingering flame pool on the ground
      sim.enemies.forEach((enemy) => {
        const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
        if (dist <= proj.radius + enemy.size) {
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
        sim.enemies.forEach((enemy) => {
          const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
          if (dist <= proj.radius + enemy.size) {
            enemy.hp -= proj.damage;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
            }
            spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage).toString(), '#38bdf8');
          }
        });
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
      } else {
        for (let e = 0; e < sim.enemies.length; e++) {
          const enemy = sim.enemies[e];
          if (proj.hitList.includes(enemy.id)) continue;

          const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
          if (dist < proj.radius + enemy.size) {
            proj.hitList.push(enemy.id);
            enemy.hp -= proj.damage;
            if (proj.sourceWeapon) {
              sim.weaponDamageDealt[proj.sourceWeapon] =
                (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
            }
            spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage).toString(), proj.color);
            spawnParticles(proj.x, proj.y, 5, proj.color, 100);

            if (proj.inflictsPoison) applyEnemyPoison(enemy, proj.damage * 0.5);
            if (proj.inflictsSlow) applyEnemySlow(enemy, 0.5, 3.0);
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
                sim.enemies.forEach((other) => {
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
              break;
            }

            proj.pierce -= 1;
            if (proj.pierce <= 0) {
              proj.duration = 0;
              break;
            }
          }
        }
      }
    }

    if (proj.duration <= 0) {
      sim.projectiles.splice(i, 1);
    }
  }
}
