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
  {name: 'GOTHIC SANCTUM', bg: '#0a0814', grid: '#1a162b', border: '#e11d48'},
  {name: 'BLOOD CATACOMBS', bg: '#14080c', grid: '#2b141d', border: '#f97316'},
  {name: 'GLACIAL ABYSS', bg: '#071318', grid: '#122932', border: '#06b6d4'},
  {name: 'BLIGHTED NECROPOLIS', bg: '#09140b', grid: '#162b1a', border: '#22c55e'},
  {name: 'ASTRAL VOID', bg: '#12081c', grid: '#261438', border: '#a855f7'},
];

export class LevelManager {
  private stage = 1;

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
    const theme = STAGE_THEMES[(s - 1) % STAGE_THEMES.length];
    return {
      stage: s,
      enemyHpMult: Math.pow(1.10, s - 1),
      enemyDamageMult: Math.pow(1.10, s - 1),
      playerSpeedMult: 1 + 0.10 * (s - 1),
      theme,
      floorBgColor: theme.bg,
      floorGridColor: theme.grid,
      borderAccentColor: theme.border,
    };
  }

  /**
   * Advances the simulation state to the next endless stage,
   * carrying over gold, 1 chosen weapon, and auto-refunding unchosen gear at 70% gold.
   */
  public advanceToNextStage(
    sim: SimulationState,
    chosenWeaponId: string,
  ): {refundGold: number; carriedWeaponId: string; nextStage: number} {
    this.stage += 1;
    sim.stage = this.stage;

    // 1. Identify the weapon to carry over (fallback to first equipped or hero starting weapon)
    const carriedWeapon: EquippedItem =
      sim.weapons.find((w) => w.id === chosenWeaponId) ||
      sim.weapons[0] || {id: sim.hero.startingWeapon, level: 1};

    // 2. Auto-refund 70% gold for unchosen weapons and passives
    let refundGold = 0;
    for (let i = 0; i < sim.weapons.length; i++) {
      const w = sim.weapons[i];
      if (w.id !== carriedWeapon.id) {
        const def = ITEM_DEFS[w.id];
        const val = Math.round((def?.cost || 50) * w.level * 0.7);
        refundGold += val;
      }
    }
    for (let i = 0; i < sim.passives.length; i++) {
      const p = sim.passives[i];
      const def = ITEM_DEFS[p.id];
      const val = Math.round((def?.cost || 40) * p.level * 0.7);
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

    // 6. Set weapons to only the carried weapon, and restore hero's innate starting passive
    sim.weapons = [{id: carriedWeapon.id, level: carriedWeapon.level}];
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
      nextStage: this.stage,
    };
  }
}

export const levelManager = new LevelManager();
