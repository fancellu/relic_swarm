import {gameAudio} from '../../utils/helper';
import {MAX_DROPS, SimulationState} from '../types/entities';
import {DerivedStats} from './Player';
import {createEnemy} from './Spawner';

export function updateDrops(
  sim: SimulationState,
  stats: DerivedStats,
  dt: number,
  spawnDamageNumber: (x: number, y: number, text: string, color: string) => void,
  spawnParticles: (x: number, y: number, count: number, color: string, speed?: number) => void,
  onLevelUp: () => void,
  onChestRewardReady: () => void,
  onHpChange: (hp: number) => void,
  onGoldChange: (gold: number) => void,
  onScoreAdd: (score: number) => void,
  onXpChange: (xp: number, nextXp: number) => void,
): void {
  // Cap drops at MAX_DROPS (200), pruning oldest drops
  while (sim.drops.length > MAX_DROPS) {
    let removeIdx = -1;
    for (let j = 0; j < sim.drops.length; j++) {
      const type = sim.drops[j].type;
      if (type !== 'chest' && type !== 'blood_chalice') {
        removeIdx = j;
        break;
      }
    }
    if (removeIdx === -1) removeIdx = 0;
    sim.drops.splice(removeIdx, 1);
  }
  for (let i = sim.drops.length - 1; i >= 0; i--) {
    const drop = sim.drops[i];
    const dx = sim.x - drop.x;
    const dy = sim.y - drop.y;
    const dist = Math.hypot(dx, dy);

    if (drop.type === 'chest') {
      // Chests have a distinct pickup channel / opening delay to prevent instant gameplay interruption
      if (dist <= 48) {
        drop.isOpening = true;
        drop.openingTimer = (drop.openingTimer || 0) + dt;

        // Spawn opening particles
        if (Math.random() < 0.4) {
          spawnParticles(drop.x, drop.y, 2, '#facc15', 60);
        }

        if (drop.openingTimer >= 0.45) {
          gameAudio.playVictoryFanfare();
          sim.screenShake = 8;
          spawnParticles(drop.x, drop.y, 25, '#facc15', 180);

          onChestRewardReady();
          sim.drops.splice(i, 1);
        }
      } else {
        drop.isOpening = false;
        drop.openingTimer = 0;
      }
      continue;
    }

    if (drop.type === 'blood_chalice') {
      // Periodic blood vapor particles around stationary chalice
      if (Math.random() < 0.25) {
        spawnParticles(drop.x, drop.y, 1, '#dc2626', 30);
      }
    } else if (dist <= stats.magnetRadius || drop.attracted) {
      drop.attracted = true;
      const flySpeed = 550;
      drop.x += (dx / dist) * flySpeed * dt;
      drop.y += (dy / dist) * flySpeed * dt;
    }

    if (dist <= 25) {
      if (drop.type === 'xp_blue' || drop.type === 'xp_purple') {
        sim.xp += drop.value;
        gameAudio.playCoinPickup();
        onScoreAdd(drop.value * 2);

        if (sim.xp >= sim.nextXp) {
          sim.xp -= sim.nextXp;
          sim.level += 1;
          sim.nextXp = Math.round(sim.nextXp * 1.35 + 5);
          onLevelUp();
        }

        onXpChange(sim.xp, sim.nextXp);
      } else if (drop.type === 'gold') {
        sim.gold += drop.value;
        onGoldChange(sim.gold);
        gameAudio.playCoinPickup();
        spawnDamageNumber(sim.x, sim.y, `+${drop.value}g`, '#eab308');
      } else if (drop.type === 'potion') {
        sim.hp = Math.min(sim.maxHp, sim.hp + drop.value);
        onHpChange(Math.round(sim.hp));
        gameAudio.playPotionGulp();
        spawnDamageNumber(sim.x, sim.y, `+${drop.value} HP`, '#22c55e');
      } else if (drop.type === 'magnet') {
        gameAudio.playPowerupChime();
        sim.drops.forEach((d) => (d.attracted = true));
        spawnDamageNumber(sim.x, sim.y, 'MAGNET PULSE!', '#38bdf8');
      } else if (drop.type === 'blood_chalice') {
        gameAudio.playChiptuneExplosion();
        sim.screenShake = 16;
        spawnDamageNumber(sim.x, sim.y, 'BLOOD TRIAL: SURVIVE 20s!', '#ef4444');
        spawnParticles(sim.x, sim.y, 35, '#dc2626', 220);
        const mbId = sim.nextEnemyId++;
        sim.cursedArena = {
          active: true,
          x: sim.x,
          y: sim.y,
          size: 600,
          duration: 20,
          maxDuration: 20,
          miniBossId: mbId,
        };
        const mbAngle = Math.random() * Math.PI * 2;
        sim.enemies.push(
          createEnemy(
            mbId,
            'hound',
            sim.x + Math.cos(mbAngle) * 160,
            sim.y + Math.sin(mbAngle) * 160,
            Math.round((1200 + (sim.runTimer / 10) * 150) * Math.pow(1.10, Math.max(1, sim.stage || 1) - 1)),
            180,
            Math.round(24 * Math.pow(1.10, Math.max(1, sim.stage || 1) - 1)),
            38,
            '#ef4444',
            true,
            false,
          ),
        );
      }

      sim.drops.splice(i, 1);
    }
  }
}
