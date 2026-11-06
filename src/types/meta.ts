export interface MetaUpgrade {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  costBase: number;
  costStep: number;
  bonusPerLevel: number;
  unit: string;
}

export const MAX_WORLD_CHESTS = 4;

export const META_UPGRADES: Record<string, MetaUpgrade> = {
  maxHp: {
    id: 'maxHp',
    name: 'Stamina Infusion',
    desc: 'Increases Maximum Health',
    maxLevel: 5,
    costBase: 100,
    costStep: 150,
    bonusPerLevel: 10,
    unit: '%',
  },
  might: {
    id: 'might',
    name: 'Might of the Sanctum',
    desc: 'Increases All Outgoing Damage',
    maxLevel: 5,
    costBase: 120,
    costStep: 180,
    bonusPerLevel: 6,
    unit: '%',
  },
  speed: {
    id: 'speed',
    name: 'Haste Footwork',
    desc: 'Increases Character Move Speed & Sprint Recovery',
    maxLevel: 5,
    costBase: 100,
    costStep: 150,
    bonusPerLevel: 5,
    unit: '%',
  },
  haste: {
    id: 'haste',
    name: 'Arcane Flow (CDR)',
    desc: 'Reduces Weapon Auto-Cast Cooldowns',
    maxLevel: 5,
    costBase: 150,
    costStep: 200,
    bonusPerLevel: 4,
    unit: '%',
  },
  magnet: {
    id: 'magnet',
    name: 'Aetheric Magnetism',
    desc: 'Expands Pickup Attraction Radius',
    maxLevel: 5,
    costBase: 80,
    costStep: 120,
    bonusPerLevel: 15,
    unit: '%',
  },
  greed: {
    id: 'greed',
    name: 'Golden Fortune',
    desc: 'Increases Gold Coin Drop Values',
    maxLevel: 5,
    costBase: 90,
    costStep: 130,
    bonusPerLevel: 12,
    unit: '%',
  },
  rerolls: {
    id: 'rerolls',
    name: 'Fate Rerolls',
    desc: 'Grants Free Draft Rerolls per Run',
    maxLevel: 3,
    costBase: 200,
    costStep: 250,
    bonusPerLevel: 1,
    unit: ' roll',
  },
  bans: {
    id: 'bans',
    name: 'Banishment Rites',
    desc: 'Grants Free Item Bans per Run',
    maxLevel: 3,
    costBase: 150,
    costStep: 200,
    bonusPerLevel: 1,
    unit: ' ban',
  },
};

export const GOLD_STORAGE_KEY = 'relic_swarm_sanctum_gold';
export const LEGACY_GOLD_STORAGE_KEY = 'relic_swarm_gold';
export const META_STORAGE_KEY = 'relic_swarm_meta';

export function getStoredGold(): number {
  try {
    const val = localStorage.getItem(GOLD_STORAGE_KEY) || localStorage.getItem(LEGACY_GOLD_STORAGE_KEY);
    return val ? Math.max(0, parseInt(val, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

export function getStoredMeta(): Record<string, number> {
  try {
    const saved = localStorage.getItem(META_STORAGE_KEY);
    return saved
      ? JSON.parse(saved)
      : {
          maxHp: 0,
          might: 0,
          speed: 0,
          haste: 0,
          magnet: 0,
          greed: 0,
          rerolls: 0,
          bans: 0,
        };
  } catch {
    return {
      maxHp: 0,
      might: 0,
      speed: 0,
      haste: 0,
      magnet: 0,
      greed: 0,
      rerolls: 0,
      bans: 0,
    };
  }
}

// --- Pact of the Swarm: optional pre-run curses, each adding +25% banked Sanctum Gold ---
export type PactId = 'swarm_frenzy' | 'titans_wrath' | 'fragile_glass';

export interface PactDef {
  id: PactId;
  name: string;
  short: string;
  curse: string;
}

export const PACTS: PactDef[] = [
  {id: 'swarm_frenzy', name: 'Swarm Frenzy', short: 'Frenzy', curse: 'Enemies move 20% faster'},
  {id: 'titans_wrath', name: "Titan's Wrath", short: 'Titans', curse: 'The boss spawns as a pair of Titans'},
  {id: 'fragile_glass', name: 'Fragile Glass', short: 'Glass', curse: '-50% Max HP'},
];

export const PACT_GOLD_BONUS = 0.25;
export const PACTS_STORAGE_KEY = 'relic_swarm_pacts';
export const SWARM_FRENZY_SPEED_MULT = 1.2;
export const FRAGILE_GLASS_HP_MULT = 0.5;

export function getPactGoldMult(pacts: readonly string[]): number {
  return 1 + pacts.length * PACT_GOLD_BONUS;
}

/** Loads the remembered Pact selection, keeping only known pact ids. */
export function getStoredPacts(): PactId[] {
  try {
    const saved = localStorage.getItem(PACTS_STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return PACTS.filter((p) => parsed.includes(p.id)).map((p) => p.id);
  } catch {
    return [];
  }
}

export function storePacts(pacts: readonly PactId[]): void {
  try {
    localStorage.setItem(PACTS_STORAGE_KEY, JSON.stringify(pacts));
  } catch (error) {
    console.warn(error);
  }
}
