import {gameAudio, shuffle} from '../../utils/helper';
import {EquippedItem, SimulationState} from '../types/entities';
import {ITEM_DEFS, ItemDef} from '../types/items';
import {calculateDerivedStats, DerivedStats} from './Player';

export function generateDraftChoices(sim: SimulationState): ItemDef[] {
  const pool: ItemDef[] = [];

  // Check Level 5 + Level 5 Weapon Fusions first (or Level 1+ if Fusion Catalyst is active!)
  if (sim.weapons.length >= 2) {
    const wepIds = sim.weapons
      .filter((w) => w.level >= 5 || sim.fusionCatalystAvailable)
      .map((w) => w.id);

    // 1. Arcane Phantom Vortex (Missile + Daggers)
    if (
      wepIds.includes('magic_missile') &&
      wepIds.includes('spinning_dagger') &&
      !sim.weapons.some((w) => w.id === 'arcane_phantom_vortex')
    ) {
      pool.push(ITEM_DEFS.arcane_phantom_vortex);
    }

    // 2. Cataclysmic Supernova (Flame Blast + Thunder Strike)
    if (
      wepIds.includes('flame_blast') &&
      wepIds.includes('thunder_strike') &&
      !sim.weapons.some((w) => w.id === 'cataclysmic_nova')
    ) {
      pool.push(ITEM_DEFS.cataclysmic_nova);
    }

    // 3. Plague Sanctuary (Radiant Aura + Toxic Spores)
    if (
      wepIds.includes('radiant_aura') &&
      wepIds.includes('venom_spores') &&
      !sim.weapons.some((w) => w.id === 'toxic_sanctuary')
    ) {
      pool.push(ITEM_DEFS.toxic_sanctuary);
    }

    // 4. Shatterstorm (Glacial Shards + Thunder Strike)
    if (
      wepIds.includes('frost_shard') &&
      wepIds.includes('thunder_strike') &&
      !sim.weapons.some((w) => w.id === 'shatterstorm')
    ) {
      pool.push(ITEM_DEFS.shatterstorm);
    }

    // 5. Frostbite Chakrams (Glacial Shards + Orbiting Daggers)
    if (
      wepIds.includes('frost_shard') &&
      wepIds.includes('spinning_dagger') &&
      !sim.weapons.some((w) => w.id === 'frostbite_chakrams')
    ) {
      pool.push(ITEM_DEFS.frostbite_chakrams);
    }
  }

  // Check Weapon + Passive Evolutions
  Object.values(ITEM_DEFS).forEach((item) => {
    if (item.isEvolution && !item.isFusion) {
      if (item.id === 'chrono_missiles') {
        const wand = sim.weapons.find((w) => w.id === 'magic_missile');
        const boots = sim.passives.find((p) => p.id === 'swift_boots');
        if (wand && wand.level >= 5 && boots && !sim.weapons.some((w) => w.id === item.id)) {
          pool.push(item);
        }
      } else if (item.id === 'hellfire_nova') {
        const staff = sim.weapons.find((w) => w.id === 'flame_blast');
        const might = sim.passives.find((p) => p.id === 'might_talisman');
        if (staff && staff.level >= 5 && might && !sim.weapons.some((w) => w.id === item.id)) {
          pool.push(item);
        }
      } else if (item.id === 'phantom_storm') {
        const dagger = sim.weapons.find((w) => w.id === 'spinning_dagger');
        const might = sim.passives.find((p) => p.id === 'might_talisman');
        if (dagger && dagger.level >= 5 && might && !sim.weapons.some((w) => w.id === item.id)) {
          pool.push(item);
        }
      } else if (item.id === 'absolute_zero') {
        const frost = sim.weapons.find((w) => w.id === 'frost_shard');
        const amulet = sim.passives.find((p) => p.id === 'frost_amulet');
        if (frost && frost.level >= 5 && amulet && !sim.weapons.some((w) => w.id === item.id)) {
          pool.push(item);
        }
      } else if (item.id === 'mjolnir_conduit') {
        const thunder = sim.weapons.find((w) => w.id === 'thunder_strike');
        const boots = sim.passives.find((p) => p.id === 'swift_boots');
        if (thunder && thunder.level >= 5 && boots && !sim.weapons.some((w) => w.id === item.id)) {
          pool.push(item);
        }
      } else if (item.id === 'solar_eclipse') {
        const aura = sim.weapons.find((w) => w.id === 'radiant_aura');
        const charm = sim.passives.find((p) => p.id === 'vitality_charm');
        if (aura && aura.level >= 5 && charm && !sim.weapons.some((w) => w.id === item.id)) {
          pool.push(item);
        }
      } else if (item.id === 'necrotic_blight') {
        const spores = sim.weapons.find((w) => w.id === 'venom_spores');
        const vial = sim.passives.find((p) => p.id === 'toxic_vial');
        if (spores && spores.level >= 5 && vial && !sim.weapons.some((w) => w.id === item.id)) {
          pool.push(item);
        }
      } else if (item.id === 'midas_wrath') {
        const chakram = sim.weapons.find((w) => w.id === 'gilded_chakram');
        const coin = sim.passives.find((p) => p.id === 'greed_coin');
        if (chakram && chakram.level >= 5 && coin && !sim.weapons.some((w) => w.id === item.id)) {
          pool.push(item);
        }
      }
      return;
    }

    // Standard Weapons & Passives
    if (item.type === 'WEAPON' && !item.isEvolution) {
      const equipped = sim.weapons.find((w) => w.id === item.id);
      if (equipped) {
        if (equipped.level < item.maxLevel) pool.push(item);
      } else if (sim.weapons.length < 4) {
        pool.push(item);
      }
    } else if (item.type === 'PASSIVE') {
      const equipped = sim.passives.find((p) => p.id === item.id);
      if (equipped) {
        if (equipped.level < item.maxLevel) pool.push(item);
      } else if (sim.passives.length < 4) {
        pool.push(item);
      }
    }
  });

  // If no regular upgrades or evolutions are available, offer the 3 rewarding fallback choices
  if (pool.length === 0) {
    return [
      ITEM_DEFS.bag_of_gold,
      ITEM_DEFS.elixir_vitality,
      ITEM_DEFS.orb_obliteration,
    ];
  }

  const shuffled = shuffle(pool);
  const fallbackPool = [
    ITEM_DEFS.bag_of_gold,
    ITEM_DEFS.elixir_vitality,
    ITEM_DEFS.orb_obliteration,
  ];
  let pickIndex = 0;
  while (shuffled.length < 3 && pickIndex < fallbackPool.length) {
    const fb = fallbackPool[pickIndex++];
    if (!shuffled.some((i) => i.id === fb.id)) {
      shuffled.push(fb);
    }
  }
  return shuffled.slice(0, 3);
}

export function applyUpgradeSelection(
  sim: SimulationState,
  item: ItemDef,
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
  // Check Consumable Fallback Cards
  if (
    item.isConsumable ||
    item.id === 'bag_of_gold' ||
    item.id === 'elixir_vitality' ||
    item.id === 'orb_obliteration'
  ) {
    if (item.id === 'bag_of_gold') {
      sim.gold += 60;
      callbacks.onGoldChange(sim.gold);
      spawnParticles(sim.x, sim.y, 25, '#facc15', 180);
      spawnDamageNumber(sim.x, sim.y, '+60 GOLD!', '#facc15');
      gameAudio.playCoinPickup();
    } else if (item.id === 'elixir_vitality') {
      const heal = Math.round(sim.maxHp * 0.4);
      sim.hp = Math.min(sim.maxHp, sim.hp + heal);
      sim.rapidRegenTimer = 5.0; // 5 seconds of rapid regen
      callbacks.onHpChange(Math.round(sim.hp));
      spawnParticles(sim.x, sim.y, 30, '#22c55e', 180);
      spawnDamageNumber(sim.x, sim.y, `+${heal} HP RESTORED!`, '#22c55e');
      gameAudio.playPotionGulp();
    } else if (item.id === 'orb_obliteration') {
      sim.screenShake = 22;
      gameAudio.playChiptuneExplosion();
      spawnParticles(sim.x, sim.y, 80, '#f43f5e', 360);
      spawnDamageNumber(sim.x, sim.y, 'SUPER NOVA OBLITERATION!', '#f43f5e');

      // Screen-wide holy shockwave: instantly incinerates non-bosses, deals 800 damage to bosses
      sim.enemies.forEach((e) => {
        if (e.isBoss) {
          e.hp -= 800;
          spawnDamageNumber(e.x, e.y, '800 HOLY CRIT', '#f43f5e');
        } else {
          e.hp = 0;
          spawnDamageNumber(e.x, e.y, 'OBLITERATED', '#fb7185');
        }
        spawnParticles(e.x, e.y, 10, '#f43f5e', 160);
      });
    }
    return;
  }

  gameAudio.playPowerupChime();

  if (item.isFusion && item.consumedWeapons) {
    // Weapon-Weapon Merge: remove the 2 source weapons and equip the fusion weapon
    sim.weapons = sim.weapons.filter((w) => !item.consumedWeapons!.includes(w.id));
    sim.weapons.push({id: item.id, level: 1});
    sim.screenShake = 15;
    spawnParticles(sim.x, sim.y, 40, '#facc15', 240);
    spawnDamageNumber(sim.x, sim.y, 'WEAPON FUSION UNLEASHED!', '#facc15');
  } else if (item.isEvolution) {
    // Weapon + Passive Evolution: replace base weapon with evolved weapon
    if (item.id === 'chrono_missiles') {
      sim.weapons = sim.weapons.filter((w) => w.id !== 'magic_missile');
      sim.weapons.push({id: item.id, level: 1});
    } else if (item.id === 'hellfire_nova') {
      sim.weapons = sim.weapons.filter((w) => w.id !== 'flame_blast');
      sim.weapons.push({id: item.id, level: 1});
    } else if (item.id === 'phantom_storm') {
      sim.weapons = sim.weapons.filter((w) => w.id !== 'spinning_dagger');
      sim.weapons.push({id: item.id, level: 1});
    } else if (item.id === 'absolute_zero') {
      sim.weapons = sim.weapons.filter((w) => w.id !== 'frost_shard');
      sim.weapons.push({id: item.id, level: 1});
    } else if (item.id === 'mjolnir_conduit') {
      sim.weapons = sim.weapons.filter((w) => w.id !== 'thunder_strike');
      sim.weapons.push({id: item.id, level: 1});
    } else if (item.id === 'solar_eclipse') {
      sim.weapons = sim.weapons.filter((w) => w.id !== 'radiant_aura');
      sim.weapons.push({id: item.id, level: 1});
    } else if (item.id === 'necrotic_blight') {
      sim.weapons = sim.weapons.filter((w) => w.id !== 'venom_spores');
      sim.weapons.push({id: item.id, level: 1});
    } else if (item.id === 'midas_wrath') {
      sim.weapons = sim.weapons.filter((w) => w.id !== 'gilded_chakram');
      sim.weapons.push({id: item.id, level: 1});
    }
    if (sim.fusionCatalystAvailable && item.isFusion) {
      sim.fusionCatalystAvailable = false;
    }
    sim.screenShake = 10;
    spawnParticles(sim.x, sim.y, 30, '#38bdf8', 200);
  } else if (item.type === 'WEAPON') {
    const existing = sim.weapons.find((w) => w.id === item.id);
    if (existing) {
      existing.level += 1;
    } else if (sim.weapons.length < 4) {
      sim.weapons.push({id: item.id, level: 1});
    }
  } else {
    const existing = sim.passives.find((p) => p.id === item.id);
    if (existing) {
      existing.level += 1;
    } else if (sim.passives.length < 4) {
      sim.passives.push({id: item.id, level: 1});
    }
  }

  callbacks.onWeaponsChange([...sim.weapons]);
  callbacks.onPassivesChange([...sim.passives]);

  const updatedStats = calculateDerivedStats(sim, metaLevels);
  sim.maxHp = updatedStats.maxHp;
  sim.maxStamina = updatedStats.maxStamina;
  sim.speed = updatedStats.speed;
  callbacks.onStatsUpdate(updatedStats.maxHp, updatedStats.maxStamina);
}

export function sellEquippedItem(
  sim: SimulationState,
  itemId: string,
  metaLevels: Record<string, number>,
  callbacks: {
    onGoldChange: (gold: number) => void;
    onStatsUpdate: (maxHp: number, maxStamina: number) => void;
    onWeaponsChange: (weps: EquippedItem[]) => void;
    onPassivesChange: (passives: EquippedItem[]) => void;
  },
): void {
  const def = ITEM_DEFS[itemId];
  if (!def) return;

  const isWep = sim.weapons.some((w) => w.id === itemId);
  const isPas = sim.passives.some((p) => p.id === itemId);

  if (!isWep && !isPas) return;

  const currentItem = isWep
    ? sim.weapons.find((w) => w.id === itemId)!
    : sim.passives.find((p) => p.id === itemId)!;

  const refundGold = Math.round((def.cost || 50) * currentItem.level * 0.7);

  if (isWep) {
    sim.weapons = sim.weapons.filter((w) => w.id !== itemId);
    callbacks.onWeaponsChange([...sim.weapons]);
  } else {
    sim.passives = sim.passives.filter((p) => p.id !== itemId);
    callbacks.onPassivesChange([...sim.passives]);
  }

  sim.gold += refundGold;
  callbacks.onGoldChange(sim.gold);
  gameAudio.playCoinPickup();

  const updatedStats = calculateDerivedStats(sim, metaLevels);
  sim.maxHp = updatedStats.maxHp;
  sim.maxStamina = updatedStats.maxStamina;
  sim.speed = updatedStats.speed;
  callbacks.onStatsUpdate(updatedStats.maxHp, updatedStats.maxStamina);
}

export function extractItemEssence(
  sim: SimulationState,
  itemId: string,
  metaLevels: Record<string, number>,
  callbacks: {
    onGoldChange: (gold: number) => void;
    onStatsUpdate: (maxHp: number, maxStamina: number) => void;
    onWeaponsChange: (weps: EquippedItem[]) => void;
    onPassivesChange: (passives: EquippedItem[]) => void;
  },
  spawnDamageNumber: (x: number, y: number, text: string, color: string) => void,
  spawnParticles: (x: number, y: number, count: number, color: string, speed?: number) => void,
): void {
  const def = ITEM_DEFS[itemId];
  if (!def) return;

  const isWep = sim.weapons.some((w) => w.id === itemId);
  const isPas = sim.passives.some((p) => p.id === itemId);
  if (!isWep && !isPas) return;

  const currentItem = isWep
    ? sim.weapons.find((w) => w.id === itemId)!
    : sim.passives.find((p) => p.id === itemId)!;

  // Only max level items (level >= 5 or evolved) can be sacrificed for essence
  if (currentItem.level < (def.maxLevel || 5) && !def.isEvolution) return;

  let bonusDesc = '';
  if (itemId === 'magic_missile') {
    sim.bonusCdr = (sim.bonusCdr || 0) + 0.10;
    sim.bonusArea = (sim.bonusArea || 0) + 0.15;
    bonusDesc = '+10% CDR & +15% Area';
  } else if (itemId === 'flame_blast') {
    sim.bonusMight = (sim.bonusMight || 0) + 0.18;
    sim.bonusStamina = (sim.bonusStamina || 0) + 20;
    bonusDesc = '+18% Might & +20 Stamina';
  } else if (itemId === 'spinning_dagger') {
    sim.bonusSpeed = (sim.bonusSpeed || 0) + 0.15;
    sim.bonusMight = (sim.bonusMight || 0) + 0.10;
    bonusDesc = '+15% Speed & +10% Might';
  } else if (itemId === 'thunder_strike') {
    sim.bonusCdr = (sim.bonusCdr || 0) + 0.12;
    sim.bonusStamina = (sim.bonusStamina || 0) + 25;
    bonusDesc = '+12% CDR & +25 Stamina';
  } else if (itemId === 'radiant_aura') {
    sim.bonusMaxHp = (sim.bonusMaxHp || 0) + 35;
    sim.bonusRegen = (sim.bonusRegen || 0) + 1.0;
    bonusDesc = '+35 Max HP & +1 HP/s Regen';
  } else if (itemId === 'venom_spores') {
    sim.bonusSpeed = (sim.bonusSpeed || 0) + 0.15;
    sim.bonusRegen = (sim.bonusRegen || 0) + 1.0;
    bonusDesc = '+15% Speed & +1 HP/s Regen';
  } else if (itemId === 'frost_shard') {
    sim.bonusMight = (sim.bonusMight || 0) + 0.15;
    sim.bonusArmor = (sim.bonusArmor || 0) + 2;
    bonusDesc = '+15% Might & +2 Armor';
  } else if (itemId === 'gilded_chakram') {
    sim.bonusGreed = (sim.bonusGreed || 0) + 0.25;
    sim.bonusMight = (sim.bonusMight || 0) + 0.15;
    bonusDesc = '+25% Gold Drops & +15% Might';
  } else if (itemId === 'might_talisman') {
    sim.bonusMight = (sim.bonusMight || 0) + 0.18;
    bonusDesc = '+18% Global Attack Damage';
  } else if (itemId === 'swift_boots') {
    sim.bonusSpeed = (sim.bonusSpeed || 0) + 0.15;
    sim.bonusStamina = (sim.bonusStamina || 0) + 20;
    bonusDesc = '+15% Move Speed & +20 Stamina';
  } else if (itemId === 'vitality_charm') {
    sim.bonusMaxHp = (sim.bonusMaxHp || 0) + 35;
    sim.bonusRegen = (sim.bonusRegen || 0) + 0.8;
    bonusDesc = '+35 Max HP & +0.8 HP/s Regen';
  } else if (itemId === 'magnet_rune') {
    sim.bonusMagnet = (sim.bonusMagnet || 0) + 0.45;
    bonusDesc = '+45% Pickup Vacuum Radius';
  } else if (itemId === 'toxic_vial') {
    sim.bonusPoisonChance = (sim.bonusPoisonChance || 0) + 0.25;
    bonusDesc = '+25% Poison Strike Chance';
  } else if (itemId === 'frost_amulet') {
    sim.bonusArmor = (sim.bonusArmor || 0) + 2;
    sim.bonusMight = (sim.bonusMight || 0) + 0.10;
    bonusDesc = '+2 Armor & +10% Might';
  } else if (itemId === 'greed_coin') {
    sim.bonusGreed = (sim.bonusGreed || 0) + 0.35;
    bonusDesc = '+35% Gold Coin Value Drops';
  } else {
    sim.bonusMight = (sim.bonusMight || 0) + 0.22;
    sim.bonusMaxHp = (sim.bonusMaxHp || 0) + 30;
    sim.bonusSpeed = (sim.bonusSpeed || 0) + 0.10;
    bonusDesc = '+22% Might, +30 HP, +10% Speed';
  }

  if (isWep) {
    sim.weapons = sim.weapons.filter((w) => w.id !== itemId);
    callbacks.onWeaponsChange([...sim.weapons]);
  } else {
    sim.passives = sim.passives.filter((p) => p.id !== itemId);
    callbacks.onPassivesChange([...sim.passives]);
  }

  if (!sim.extractedEssences) sim.extractedEssences = [];
  sim.extractedEssences.push({
    id: itemId,
    name: def.name,
    desc: bonusDesc,
    icon: def.icon,
    bonusType: bonusDesc,
  });

  gameAudio.playPowerupChime();
  sim.screenShake = 12;
  spawnParticles(sim.x, sim.y, 40, '#a855f7', 220);
  spawnParticles(sim.x, sim.y, 30, '#facc15', 200);
  spawnDamageNumber(sim.x, sim.y, `ESSENCE EXTRACTED: ${bonusDesc}!`, '#c084fc');

  const updatedStats = calculateDerivedStats(sim, metaLevels);
  sim.maxHp = updatedStats.maxHp;
  sim.maxStamina = updatedStats.maxStamina;
  sim.speed = updatedStats.speed;
  callbacks.onStatsUpdate(updatedStats.maxHp, updatedStats.maxStamina);
}
