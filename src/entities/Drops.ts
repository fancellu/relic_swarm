import {gameAudio} from '../../utils/helper';
import {SimulationState} from '../types/entities';
import {DerivedStats} from './Player';

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

    if (dist <= stats.magnetRadius || drop.attracted) {
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
      }

      sim.drops.splice(i, 1);
    }
  }
}
