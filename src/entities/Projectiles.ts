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
  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const proj = sim.projectiles[i];
    proj.duration -= dt;

    if (
      (proj.type === 'dagger' || proj.type === 'vortex') &&
      proj.orbitAngle !== undefined &&
      proj.orbitDist !== undefined
    ) {
      const spinSpeed = proj.type === 'vortex' ? 5.0 : 3.5;
      proj.orbitAngle += spinSpeed * dt;
      proj.x = sim.x + Math.cos(proj.orbitAngle) * proj.orbitDist;
      proj.y = sim.y + Math.sin(proj.orbitAngle) * proj.orbitDist;

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
