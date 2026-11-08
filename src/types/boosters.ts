// Boosters: uncommon pickups assigned to a weapon to give it an on-hit effect.
// A weapon can carry several booster types, and each type can stack many times.
// Pure data (no imports) so entity and UI modules can use it without import cycles.

export type BoosterId = 'burn' | 'poison' | 'frost' | 'knockback';

/** Stack counts per booster type, stored on an equipped weapon. */
export type BoosterStacks = Partial<Record<BoosterId, number>>;

export interface BoosterDef {
  id: BoosterId;
  name: string;
  icon: string;
  color: string;
  desc: string;
}

export const BOOSTER_IDS: BoosterId[] = ['burn', 'poison', 'frost', 'knockback'];

export const BOOSTERS: Record<BoosterId, BoosterDef> = {
  burn: {
    id: 'burn',
    name: 'Ember Booster',
    icon: 'assets/images/booster_burn.png',
    color: '#f97316',
    desc: 'Hits set enemies ablaze. Each stack burns harder. Burn ignores armour.',
  },
  poison: {
    id: 'poison',
    name: 'Toadstool Booster',
    icon: 'assets/images/booster_poison.png',
    color: '#22c55e',
    desc: 'Hits poison enemies. Each stack poisons harder. Poison ignores armour.',
  },
  frost: {
    id: 'frost',
    name: 'Frost Booster',
    icon: 'assets/images/booster_frost.png',
    color: '#67e8f9',
    desc: 'Hits slow enemies. Each stack slows more; at 4 stacks they are nearly frozen.',
  },
  knockback: {
    id: 'knockback',
    name: 'Brawler Booster',
    icon: 'assets/images/booster_knockback.png',
    color: '#ef4444',
    desc: 'Hits shove enemies away. Each stack shoves farther; elites and bosses resist.',
  },
};

export function randomBoosterId(): BoosterId {
  return BOOSTER_IDS[Math.floor(Math.random() * BOOSTER_IDS.length)];
}

/** Total booster stacks on a weapon, across all types. */
export function totalBoosterStacks(boosters: BoosterStacks | undefined): number {
  if (!boosters) return 0;
  let total = 0;
  for (let i = 0; i < BOOSTER_IDS.length; i++) total += boosters[BOOSTER_IDS[i]] || 0;
  return total;
}
