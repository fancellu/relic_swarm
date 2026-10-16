import {gameAudio} from '../../utils/helper';
import {ChestRewardData, EquippedItem, SimulationState} from '../types/entities';
import {ItemDef} from '../types/items';
import {applyUpgradeSelection, generateDraftChoices} from './Draft';
import {calculateDerivedStats} from './Player';

export function generateChestReward(sim: SimulationState): ChestRewardData {
  const goldBounty = 50 + Math.floor(Math.random() * 51); // 50-100 gold
  const draftChoices = generateDraftChoices(sim);
  const realUpgradeChoices = draftChoices.filter((c: ItemDef) => !c.isConsumable);

  // If real upgrades or evolutions are available, 65% chance to award an upgrade/evolution directly
  if (realUpgradeChoices.length > 0 && Math.random() < 0.65) {
    const chosenItem = realUpgradeChoices[0];
    return {
      title: chosenItem.isFusion
        ? 'LEGENDARY FUSION CHEST!'
        : chosenItem.isEvolution
        ? 'AWAKENED EVOLUTION CHEST!'
        : 'ARSENAL TREASURE!',
      type: 'ITEM',
      description: chosenItem.desc,
      gold: goldBounty,
      item: chosenItem,
      isEvo: chosenItem.isEvolution,
    };
  }

  // Expanded chest reward pool when maxed or rolled
  const specialPool: ChestRewardData[] = [
    {
      title: 'TITAN MIGHT INFUSION',
      type: 'STAT_BUFF',
      statName: 'might',
      description: 'Permanent Run Buff: +10% Global Damage to all weapons and spells.',
      gold: goldBounty,
    },
    {
      title: 'VITALITY ELIXIR BLESSING',
      type: 'STAT_BUFF',
      statName: 'maxHp',
      description: 'Permanent Run Buff: +25 Max HP and instantly restores Health to full.',
      gold: goldBounty,
    },
    {
      title: 'HERMES HASTE SURGE',
      type: 'STAT_BUFF',
      statName: 'speed',
      description: 'Permanent Run Buff: +8% Move Speed & +20 Max Sprint Stamina.',
      gold: goldBounty,
    },
    {
      title: 'CHRONO FLUX SIGIL',
      type: 'STAT_BUFF',
      statName: 'cdr',
      description: 'Permanent Run Buff: +5% Cooldown Haste on all auto-cast weapons.',
      gold: goldBounty,
    },
    {
      title: 'IRONCLAD BULWARK',
      type: 'STAT_BUFF',
      statName: 'armor',
      description: 'Permanent Run Buff: +1 Armor (Flat Damage Resistance).',
      gold: goldBounty,
    },
    {
      title: 'MAGNETIC SINGULARITY',
      type: 'MAGNET_SURGE',
      description: 'Instant Event: Draws every single XP gem, potion, and coin on the entire map straight to you!',
      gold: goldBounty + 25,
    },
    {
      title: 'SCREEN-CLEARING HOLY BOMB',
      type: 'HOLY_BOMB',
      description: 'Instant Cataclysm: Purifies the screen, eradicating all common mobs and inflicting 1000 holy damage on bosses!',
      gold: goldBounty + 15,
    },
    {
      title: 'DIVINE AEGIS SHIELD',
      type: 'AEGIS_SHIELD',
      description: 'Divine Blessing: Grants 12 seconds of invulnerability immunity + restores 50 HP!',
      gold: goldBounty + 20,
    },
  ];

  return specialPool[Math.floor(Math.random() * specialPool.length)];
}

export function applyChestReward(
  sim: SimulationState,
  chestReward: ChestRewardData,
  metaLevels: Record<string, number>,
  spawnParticles: (x: number, y: number, count: number, color: string, speed?: number) => void,
  spawnDamageNumber: (x: number, y: number, text: string, color: string) => void,
  callbacks: {
    onGoldChange: (gold: number) => void;
    onHpChange: (hp: number) => void;
    onStatsUpdate: (maxHp: number, maxStamina: number) => void;
    onWeaponsChange: (weps: EquippedItem[]) => void;
    onPassivesChange: (passives: EquippedItem[]) => void;
  },
): void {
  // Apply chest gold
  sim.gold += chestReward.gold;
  callbacks.onGoldChange(sim.gold);

  if (chestReward.type === 'ITEM' && chestReward.item) {
    applyUpgradeSelection(
      sim,
      chestReward.item,
      metaLevels,
      spawnParticles,
      spawnDamageNumber,
      callbacks,
    );
  } else if (chestReward.type === 'STAT_BUFF') {
    if (chestReward.statName === 'maxHp') {
      sim.bonusMaxHp += 25;
      const updated = calculateDerivedStats(sim, metaLevels);
      sim.maxHp = updated.maxHp;
      sim.hp = sim.maxHp;
      callbacks.onStatsUpdate(updated.maxHp, sim.maxStamina);
      callbacks.onHpChange(Math.round(sim.hp));
      spawnDamageNumber(sim.x, sim.y, '+25 MAX HP & FULL HEAL!', '#22c55e');
    } else if (chestReward.statName === 'might') {
      sim.bonusMight += 0.1;
      spawnDamageNumber(sim.x, sim.y, '+10% TITAN DAMAGE!', '#f59e0b');
    } else if (chestReward.statName === 'speed') {
      sim.bonusSpeed += 0.08;
      sim.bonusStamina += 20;
      const updated = calculateDerivedStats(sim, metaLevels);
      sim.speed = updated.speed;
      sim.maxStamina = updated.maxStamina;
      callbacks.onStatsUpdate(sim.maxHp, updated.maxStamina);
      spawnDamageNumber(sim.x, sim.y, '+8% MOVE SPEED & +20 STAMINA!', '#38bdf8');
    } else if (chestReward.statName === 'cdr') {
      sim.bonusCdr += 0.05;
      spawnDamageNumber(sim.x, sim.y, '+5% COOLDOWN HASTE!', '#a855f7');
    } else if (chestReward.statName === 'armor') {
      sim.bonusArmor += 1;
      spawnDamageNumber(sim.x, sim.y, '+1 DAMAGE RESISTANCE (ARMOR)!', '#94a3b8');
    }
    gameAudio.playPowerupChime();
    spawnParticles(sim.x, sim.y, 25, '#facc15', 180);
  } else if (chestReward.type === 'MAGNET_SURGE') {
    gameAudio.playPowerupChime();
    sim.drops.forEach((d) => (d.attracted = true));
    spawnDamageNumber(sim.x, sim.y, 'MAGNETIC SINGULARITY VACUUM!', '#38bdf8');
    spawnParticles(sim.x, sim.y, 35, '#38bdf8', 220);
  } else if (chestReward.type === 'HOLY_BOMB') {
    sim.screenShake = 22;
    gameAudio.playChiptuneExplosion();
    spawnParticles(sim.x, sim.y, 70, '#f43f5e', 320);
    spawnDamageNumber(sim.x, sim.y, 'SCREEN-CLEARING HOLY BOMB!', '#f43f5e');
    sim.enemies.forEach((e) => {
      if (e.isBoss) {
        e.hp -= 1000;
        spawnDamageNumber(e.x, e.y, '1000 HOLY CRIT', '#f43f5e');
      } else {
        e.hp = 0;
        spawnDamageNumber(e.x, e.y, 'PURIFIED', '#fb7185');
      }
      spawnParticles(e.x, e.y, 10, '#f43f5e', 140);
    });
  } else if (chestReward.type === 'AEGIS_SHIELD') {
    sim.aegisShieldTimer = 12.0;
    sim.hp = Math.min(sim.maxHp, sim.hp + 50);
    callbacks.onHpChange(Math.round(sim.hp));
    gameAudio.playPowerupChime();
    spawnParticles(sim.x, sim.y, 30, '#06b6d4', 200);
    spawnDamageNumber(sim.x, sim.y, 'DIVINE AEGIS SHIELD (12s)!', '#06b6d4');
  }

  gameAudio.playConfirmSelect();
}
