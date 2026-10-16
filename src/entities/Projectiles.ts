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

  // 2. Process all projectiles
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
      // Homing for plague beetles
      if (proj.type === 'beetle') {
        let target = sim.enemies.find((e) => e.id === proj.targetId);
        if (!target && sim.enemies.length > 0) {
          target = sim.enemies[0];
          proj.targetId = target.id;
        }
        if (target) {
          const bAngle = Math.atan2(target.y - proj.y, target.x - proj.x);
          proj.vx += Math.cos(bAngle) * 900 * dt;
          proj.vy += Math.sin(bAngle) * 900 * dt;
          const curSpeed = Math.hypot(proj.vx, proj.vy);
          if (curSpeed > 450) {
            proj.vx = (proj.vx / curSpeed) * 450;
            proj.vy = (proj.vy / curSpeed) * 450;
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

            if (proj.type === 'flame' && proj.splashRadius) {
              gameAudio.playChiptuneExplosion();
              sim.screenShake = 6;
              sim.enemies.forEach((other) => {
                if (other.id !== enemy.id) {
                  const splashDist = Math.hypot(other.x - proj.x, other.y - proj.y);
                  if (splashDist <= proj.splashRadius! + other.size) {
                    other.hp -= proj.damage * 0.7;
                    if (proj.sourceWeapon) {
                      sim.weaponDamageDealt[proj.sourceWeapon] =
                        (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage * 0.7;
                    }
                    spawnDamageNumber(other.x, other.y, Math.round(proj.damage * 0.7).toString(), '#ea580c');
                    if (proj.inflictsPoison) applyEnemyPoison(other, proj.damage * 0.4);
                  }
                }
              });
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
