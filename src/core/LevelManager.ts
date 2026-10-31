import {EquippedItem, SimulationState} from '../types/entities';
import {ITEM_DEFS} from '../types/items';

export interface StageTheme {
  name: string;
  bg: string;
  grid: string;
  border: string;
}

export interface LevelModifiers {
  stage: number;
  enemyHpMult: number;
  enemyDamageMult: number;
  playerSpeedMult: number;
  theme: StageTheme;
  floorBgColor: string;
  floorGridColor: string;
  borderAccentColor: string;
}

export const STAGE_THEMES: StageTheme[] = [
  {name: 'Gothic Sanctum', bg: '#0a0814', grid: '#1a162b', border: '#e11d48'},
  {name: 'Blood Catacombs', bg: '#14080c', grid: '#2b141d', border: '#f97316'},
  {name: 'Glacial Abyss', bg: '#071318', grid: '#122932', border: '#06b6d4'},
  {name: 'Blighted Necropolis', bg: '#09140b', grid: '#162b1a', border: '#22c55e'},
  {name: 'Astral Void', bg: '#12081c', grid: '#261438', border: '#a855f7'},
];

export class LevelManager {
  private stage = 1;
  private cachedModifiers: Record<number, LevelModifiers> = {};

  public reset(): void {
    this.stage = 1;
  }

  public getStage(): number {
    return this.stage;
  }

  public setStage(stage: number): void {
    this.stage = Math.max(1, stage);
  }

  public getModifiers(customStage?: number): LevelModifiers {
    const s = customStage !== undefined ? Math.max(1, customStage) : this.stage;
    if (this.cachedModifiers[s]) {
      return this.cachedModifiers[s];
    }
    const theme = STAGE_THEMES[(s - 1) % STAGE_THEMES.length];
    const mods: LevelModifiers = {
      stage: s,
      enemyHpMult: Math.pow(1.10, s - 1),
      enemyDamageMult: Math.pow(1.10, s - 1),
      playerSpeedMult: 1 + 0.10 * (s - 1),
      theme,
      floorBgColor: theme.bg,
      floorGridColor: theme.grid,
      borderAccentColor: theme.border,
    };
    this.cachedModifiers[s] = mods;
    return mods;
  }

  /**
   * Advances the simulation state to the next endless stage,
   * carrying over gold, 1 chosen weapon, and auto-refunding unchosen gear at 70% gold.
   */
  public advanceToNextStage(
    sim: SimulationState,
    chosenWeaponId: string,
  ): {
    refundGold: number;
    carriedWeaponId: string;
    carriedWeaponLevel: number;
    reducedLevels: number;
    nextStage: number;
  } {
    this.stage += 1;
    sim.stage = this.stage;

    // 1. Identify the weapon to carry over (fallback to first equipped or hero starting weapon)
    const carriedWeapon: EquippedItem =
      sim.weapons.find((w) => w.id === chosenWeaponId) ||
      sim.weapons[0] || {id: sim.hero.startingWeapon, level: 1};

    // 2. Cap carried weapon level to stage * 5 (e.g., Stage 2 caps at L10) to preserve challenge
    const maxCarriedLevel = this.stage * 5;
    const def = ITEM_DEFS[carriedWeapon.id];
    let effectiveCarriedLevel = carriedWeapon.level;
    let levelReductionRefund = 0;
    let reducedLevels = 0;

    if (!def?.isEvolution && !def?.isFusion && carriedWeapon.level > maxCarriedLevel) {
      reducedLevels = carriedWeapon.level - maxCarriedLevel;
      effectiveCarriedLevel = maxCarriedLevel;
      levelReductionRefund = Math.round(reducedLevels * (def?.cost || 50) * 0.7);
    }

    // 3. Auto-refund 70% gold for unchosen weapons, passives, and excess levels
    let refundGold = levelReductionRefund;
    for (let i = 0; i < sim.weapons.length; i++) {
      const w = sim.weapons[i];
      if (w.id !== carriedWeapon.id) {
        const itemDef = ITEM_DEFS[w.id];
        const val = Math.round((itemDef?.cost || 50) * w.level * 0.7);
        refundGold += val;
      }
    }
    for (let i = 0; i < sim.passives.length; i++) {
      const p = sim.passives[i];
      const itemDef = ITEM_DEFS[p.id];
      const val = Math.round((itemDef?.cost || 40) * p.level * 0.7);
      refundGold += val;
    }
    sim.gold += refundGold;

    // 3. Reset player position, velocity, camera, and arena entities
    sim.x = 0;
    sim.y = 0;
    sim.vx = 0;
    sim.vy = 0;
    sim.camera.x = 0;
    sim.camera.y = 0;
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.drops.length = 0;
    sim.particles.length = 0;
    sim.damageNumbers.length = 0;
    if (sim.conduitPylons) sim.conduitPylons.length = 0;

    // Clear active spatial mechanics
    sim.obelisk = null;
    sim.obeliskSpawnTimer = 0;
    sim.inObeliskZone = false;
    sim.cursedArena = null;
    sim.merchant = null;
    sim.nextMerchantSpawnTime = 180;

    // 4. Reset stage timers and boss flags
    sim.runTimer = 0;
    sim.spawnTimer = 0;
    sim.bossSpawned = false;
    sim.bossDefeated = false;

    // 5. Reset character XP progression for the new stage so level-up drafts remain frequent
    sim.level = 1;
    sim.xp = 0;
    sim.nextXp = 10;

    // 6. Set weapons to only the carried weapon at effective level, and restore hero's innate starting passive
    sim.weapons = [{id: carriedWeapon.id, level: effectiveCarriedLevel}];
    sim.passives = sim.hero.startingPassive
      ? [{id: sim.hero.startingPassive, level: 1}]
      : [];
    sim.weaponTimers = {};

    // 7. Full health & stamina restore
    sim.hp = sim.maxHp;
    sim.stamina = sim.maxStamina;

    return {
      refundGold,
      carriedWeaponId: carriedWeapon.id,
      carriedWeaponLevel: effectiveCarriedLevel,
      reducedLevels,
      nextStage: this.stage,
    };
  }
}

export const levelManager = new LevelManager();
