import {BOOSTER_IDS, BOOSTERS, BoosterId, BoosterStacks} from '../types/boosters';
import {EquippedItem, MAX_PARTICLES, SimulationState, EnemyEntity} from '../types/entities';
import {applyEnemySlow} from './Player';
import {damageEnemy} from './Spawner';
import {gameAudio} from '../../utils/helper';

// --- Per-stack tuning ---
const BURN_DPS_FRACTION = 0.3; // of the hit's damage, per stack, as burn DPS
const BURN_DURATION = 3.0;
const POISON_DPS_FRACTION = 0.3;
const POISON_DURATION = 4.0;
const FROST_BASE = 0.25; // slow factor at 1 stack
const FROST_PER_STACK = 0.15;
const FROST_MAX = 0.8; // 4+ stacks: nearly frozen
const FROST_DURATION = 1.5;
const KNOCKBACK_BASE = 10; // px at 1 stack = base + perStack
const KNOCKBACK_PER_STACK = 8;
const KNOCKBACK_COOLDOWN = 0.3; // per enemy, so rapid tickers cannot fling enemies across the map

/**
 * Damages an enemy with a weapon hit and applies that weapon's boosters.
 * Use this (instead of `damageEnemy`) for discrete weapon hits; continuous chip damage, DoT ticks
 * and reaction bursts stay on plain `damageEnemy` so boosters never loop or proc every frame.
 * Returns the damage actually dealt (after armour).
 */
export function hitEnemy(
  sim: SimulationState,
  enemy: EnemyEntity,
  amount: number,
  weaponId: string | undefined,
  armorScale = 1,
): number {
  const dealt = damageEnemy(enemy, amount, armorScale);
  if (!weaponId) return dealt;

  let boosters: BoosterStacks | undefined;
  for (let i = 0; i < sim.weapons.length; i++) {
    if (sim.weapons[i].id === weaponId) {
      boosters = sim.weapons[i].boosters;
      break;
    }
  }
  if (!boosters) return dealt;

  // DoT boosters scale from the pre-armour hit so they remain the answer to Armoured enemies.
  const burn = boosters.burn || 0;
  if (burn > 0) {
    enemy.burnTimer = Math.max(enemy.burnTimer, BURN_DURATION);
    enemy.burnDps = Math.max(enemy.burnDps, amount * BURN_DPS_FRACTION * burn);
  }
  const poison = boosters.poison || 0;
  if (poison > 0) {
    enemy.poisonTimer = Math.max(enemy.poisonTimer, POISON_DURATION);
    enemy.poisonDps = Math.max(enemy.poisonDps, amount * POISON_DPS_FRACTION * poison);
  }
  const frost = boosters.frost || 0;
  if (frost > 0) {
    applyEnemySlow(enemy, Math.min(FROST_MAX, FROST_BASE + FROST_PER_STACK * (frost - 1)), FROST_DURATION);
  }
  const knockback = boosters.knockback || 0;
  if (knockback > 0 && enemy.boosterKnockCd <= 0) {
    const dx = enemy.x - sim.x;
    const dy = enemy.y - sim.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const resist = enemy.isBoss ? 0.1 : enemy.isElite || enemy.isBrute ? 0.4 : 1;
      const push = (KNOCKBACK_BASE + KNOCKBACK_PER_STACK * knockback) * resist;
      enemy.x += (dx / dist) * push;
      enemy.y += (dy / dist) * push;
      enemy.boosterKnockCd = KNOCKBACK_COOLDOWN;
    }
  }

  // Occasional colour-matched hit spark
  if (Math.random() < 0.35 && sim.particles.length < MAX_PARTICLES) {
    const color = pickBoosterColor(boosters);
    if (color) {
      sim.particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: (Math.random() * 2 - 1) * 70,
        vy: (Math.random() * 2 - 1) * 70,
        life: 0.3,
        maxLife: 0.3,
        size: 4,
        color,
        alpha: 0.85,
      });
    }
  }
  return dealt;
}

/** Picks a random booster colour among those present on a weapon, or null if it has none. */
function pickBoosterColor(boosters: BoosterStacks): string | null {
  const start = Math.floor(Math.random() * BOOSTER_IDS.length);
  for (let i = 0; i < BOOSTER_IDS.length; i++) {
    const id = BOOSTER_IDS[(start + i) % BOOSTER_IDS.length];
    if (boosters[id]) return BOOSTERS[id].color;
  }
  return null;
}

/** Trail colour for a boosted weapon's projectiles, or null if the weapon carries no boosters. */
export function getBoosterTrailColor(sim: SimulationState, weaponId: string | undefined): string | null {
  if (!weaponId) return null;
  for (let i = 0; i < sim.weapons.length; i++) {
    if (sim.weapons[i].id === weaponId) {
      const boosters = sim.weapons[i].boosters;
      return boosters ? pickBoosterColor(boosters) : null;
    }
  }
  return null;
}

/** Adds one stack of a booster to a weapon. */
export function addBooster(weapon: EquippedItem, id: BoosterId): void {
  if (!weapon.boosters) weapon.boosters = {};
  weapon.boosters[id] = (weapon.boosters[id] || 0) + 1;
}

/**
 * After an evolution or fusion replaces weapons, carries the boosters of every weapon that disappeared
 * over to the new weapon, so a boosted weapon never loses its personality when it evolves.
 */
export function inheritBoosters(before: EquippedItem[], after: EquippedItem[], newWeaponId: string): void {
  const next = after.find((w) => w.id === newWeaponId);
  if (!next) return;
  for (let i = 0; i < before.length; i++) {
    const old = before[i];
    if (!old.boosters || after.some((w) => w.id === old.id)) continue;
    for (let b = 0; b < BOOSTER_IDS.length; b++) {
      const id = BOOSTER_IDS[b];
      const stacks = old.boosters[id];
      if (stacks) {
        if (!next.boosters) next.boosters = {};
        next.boosters[id] = (next.boosters[id] || 0) + stacks;
      }
    }
  }
}

// Thermal Shock gating: each enemy can be shocked at most once per THERMAL_SHOCK_COOLDOWN seconds, so
// fire-on-chill cannot proc on every hit (e.g. Flame Blast inside the Permafrost Sigil aura), and the
// clash sound is throttled globally so a crowd of shocks does not become noise.
const THERMAL_SHOCK_COOLDOWN = 1.0;
const THERMAL_SHOCK_SOUND_INTERVAL = 0.12;
let lastShockSoundTime = -1;

/**
 * Triggers a Thermal Shock elemental reaction when Fire and Frost collide on an enemy.
 * Symmetrically triggers when Frost strikes a burning enemy or Fire strikes a frozen/chilled enemy.
 * Bypasses armour (armorScale = 0), consumes the burn, inflicts screen shake, and emits visual feedback.
 * Returns 0 (and does nothing) while the enemy is on its shock cooldown, unless `ignoreCooldown` is set
 * (Frostfire Prism, whose shocks are already self-throttled to every 5th beam tick).
 */
export function triggerThermalShock(
  sim: SimulationState,
  enemy: EnemyEntity,
  hitDamage: number,
  sourceWeapon?: string,
  spawnDamageNumber?: (x: number, y: number, text: string, color: string) => void,
  spawnParticles?: (x: number, y: number, count: number, color: string, speed?: number) => void,
  ignoreCooldown = false,
): number {
  if (!ignoreCooldown && enemy.shockCd > 0) return 0;
  enemy.shockCd = THERMAL_SHOCK_COOLDOWN;
  const shockBonus = hitDamage * 1.8 + (enemy.burnDps || 0) * 2.0;
  damageEnemy(enemy, shockBonus, 0); // Thermal Shock cracks armour
  if (sourceWeapon) {
    sim.weaponDamageDealt[sourceWeapon] = (sim.weaponDamageDealt[sourceWeapon] || 0) + shockBonus;
  }
  enemy.burnTimer = 0;
  enemy.burnDps = 0;
  sim.screenShake = Math.max(sim.screenShake, 5);
  if (sim.runTimer - lastShockSoundTime >= THERMAL_SHOCK_SOUND_INTERVAL || sim.runTimer < lastShockSoundTime) {
    lastShockSoundTime = sim.runTimer;
    gameAudio.playSwordClash();
  }
  if (spawnDamageNumber) {
    spawnDamageNumber(enemy.x, enemy.y, `THERMAL SHOCK ${Math.round(shockBonus)}!`, '#38bdf8');
  }
  if (spawnParticles) {
    spawnParticles(enemy.x, enemy.y, 10, '#38bdf8', 130);
    spawnParticles(enemy.x, enemy.y, 8, '#f97316', 100);
  }
  return shockBonus;
}
