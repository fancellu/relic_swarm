import {SpriteAnimationState} from '../SpriteRenderer';
import {ItemDef} from './items';

// --- Hero Definitions ---
export interface HeroData {
  id: string;
  name: string;
  title: string;
  desc: string;
  startingWeapon: string;
  startingPassive?: string;
  statBonus: string;
  baseHp: number;
  baseSpeed: number;
  areaBonus: number;
  cdrBonus: number;
  mightBonus: number;
  armorBonus: number;
  regenBonus: number;
  color: string;
  idleSheet: string;
  spriteKey: string;
}

export interface EquippedItem {
  id: string;
  level: number;
}

export interface EnemyEntity {
  id: number;
  type: 'skeleton' | 'hound' | 'bat' | 'sorcerer' | 'titan';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  size: number;
  isElite: boolean;
  isBoss: boolean;
  color: string;
  animState: SpriteAnimationState;
  facingLeft: boolean;
  shootTimer?: number;
  specialTimer?: number;
  // Status effects
  poisonTimer: number;
  poisonDps: number;
  poisonTickTimer: number;
  slowTimer: number;
  slowFactor: number;
}

export interface ProjectileEntity {
  id: number;
  type: 'missile' | 'flame' | 'dagger' | 'thunder' | 'sorcerer_orb' | 'spore' | 'ice' | 'vortex' | 'chakram' | 'beetle';
  sourceWeapon?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  duration: number;
  maxDuration: number;
  isEnemy?: boolean;
  orbitAngle?: number;
  orbitDist?: number;
  pierce: number;
  hitList: number[];
  color: string;
  splashRadius?: number;
  inflictsPoison?: boolean;
  inflictsSlow?: boolean;
  targetId?: number;
}

export interface DropEntity {
  id: number;
  type: 'xp_blue' | 'xp_purple' | 'gold' | 'potion' | 'magnet' | 'chest';
  x: number;
  y: number;
  value: number;
  attracted: boolean;
  openingTimer?: number;
  isOpening?: boolean;
}

export interface ParticleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

export interface DamageNumber {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface ChestRewardData {
  title: string;
  type: 'ITEM' | 'STAT_BUFF' | 'MAGNET_SURGE' | 'HOLY_BOMB' | 'AEGIS_SHIELD';
  description: string;
  gold: number;
  statName?: string;
  item?: ItemDef;
  isEvo?: boolean;
}

export interface SimulationState {
  hero: HeroData;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  facingLeft: boolean;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  isSprinting: boolean;
  invulnTimer: number;
  heroAnim: SpriteAnimationState;
  xp: number;
  nextXp: number;
  level: number;
  weapons: EquippedItem[];
  passives: EquippedItem[];
  weaponTimers: Record<string, number>;
  weaponDamageDealt: Record<string, number>;
  enemies: EnemyEntity[];
  projectiles: ProjectileEntity[];
  drops: DropEntity[];
  particles: ParticleEntity[];
  damageNumbers: DamageNumber[];
  camera: {x: number; y: number};
  screenShake: number;
  spawnTimer: number;
  runTimer: number;
  kills: number;
  gold: number;
  nextEnemyId: number;
  nextProjId: number;
  nextDropId: number;
  nextDmgId: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  auraVisualAngle: number;
  sprintParticlesTimer: number;
  rapidRegenTimer: number;
  bonusMaxHp: number;
  bonusMight: number;
  bonusSpeed: number;
  bonusCdr: number;
  bonusArmor: number;
  bonusStamina: number;
  aegisShieldTimer: number;
  solarPulseCounter?: number;
  conduitPylons?: {x: number; y: number; life: number}[];
}
