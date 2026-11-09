import {SpriteAnimationState} from '../SpriteRenderer';
import {BoosterId, BoosterStacks} from './boosters';
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
  boosters?: BoosterStacks; // Booster stacks assigned to this weapon
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
  burnTimer: number;
  burnDps: number;
  burnTickTimer: number;
  // Tanky variants (all zero/false for ordinary enemies, bosses and escorts)
  armor: number; // flat damage removed from each hit (DoTs bypass); min 25% always gets through
  regenPerSec: number; // HP regained per second once regenDelay has elapsed
  regenDelay: number; // seconds of no damage remaining before regen resumes
  isBrute: boolean; // oversized high-HP variant
  boosterKnockCd: number; // seconds until Brawler-booster knockback can move this enemy again
  shockCd: number; // seconds until this enemy can suffer another Thermal Shock
  // Enrage: a wounded enemy gets one roll to become faster and harder-hitting (never bosses)
  enraged: boolean;
  enrageRolled: boolean;
  enrageLabelTimer: number; // seconds the floating "ENRAGED!" label remains
}

export interface ProjectileEntity {
  id: number;
  type:
    | 'missile'
    | 'flame'
    | 'flame_pool'
    | 'dagger'
    | 'thunder'
    | 'sorcerer_orb'
    | 'spore'
    | 'ice'
    | 'vortex'
    | 'chakram'
    | 'gilded_disc'
    | 'beetle'
    | 'shotgun_pellet'
    | 'homing_missile'
    | 'chain_lightning'
    | 'gravity_well'
    | 'grenade'
    | 'beam'
    | 'kinetic_wave'
    | 'axe'
    | 'slash'
    | 'meteor'
    | 'flask'
    | 'acid_pool'
    | 'astral_orb';
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
  hitTimes?: Record<number, number>;
  color: string;
  splashRadius?: number;
  inflictsPoison?: boolean;
  inflictsSlow?: boolean;
  targetId?: number;
  chainEndX?: number;
  chainEndY?: number;
  // Parabolic Arc Lob Properties
  arcStartX?: number;
  arcStartY?: number;
  arcTargetX?: number;
  arcTargetY?: number;
  arcPeakHeight?: number;
  rotation?: number;
  spinSpeed?: number;
  isCluster?: boolean;
  // Channelled Beam Properties (anchored to the hero, angle stored in `rotation`)
  beamRange?: number;
  beamEndX?: number;
  beamEndY?: number;
  beamTickTimer?: number;
  beamTicks?: number;
  // Signature weapons
  returning?: boolean; // Whirling Axe: on its way back to the hero
  pulseTimer?: number; // Astral Orb: seconds until the next bolt volley
  arcAngle?: number; // Greatsword slash: half-width of the cone in radians (>= PI = full circle)
  boltCount?: number; // Astral Orb: bolts fired per volley
}

export interface DerivedStats {
  maxHp: number;
  maxStamina: number;
  mightMult: number;
  speed: number;
  cdr: number;
  magnetRadius: number;
  greedMult: number;
  areaMult: number;
  vitalityLevel: number;
  toxicLevel: number;
  frostAmuletLevel: number;
  baseRegen: number;
  armor: number;
}

export const MAX_DROPS = 160;
export const MAX_PARTICLES = 250;
export const MAX_DAMAGE_NUMBERS = 50;
export const MAX_PROJECTILES = 120;

export function addDrop(sim: SimulationState, drop: DropEntity): void {
  if (sim.drops.length >= MAX_DROPS) {
    // Drop is full: remove oldest drop, preferring non-critical drops (not chest/chalice)
    let removeIdx = -1;
    for (let i = 0; i < sim.drops.length; i++) {
      const type = sim.drops[i].type;
      if (type !== 'chest' && type !== 'blood_chalice' && type !== 'booster') {
        removeIdx = i;
        break;
      }
    }
    if (removeIdx === -1) {
      removeIdx = 0;
    }
    sim.drops.splice(removeIdx, 1);
  }
  sim.drops.push(drop);
}

export interface DropEntity {
  id: number;
  type: 'xp_blue' | 'xp_purple' | 'gold' | 'potion' | 'magnet' | 'chest' | 'blood_chalice' | 'booster';
  boosterId?: BoosterId;
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

export interface ObeliskEntity {
  id: number;
  x: number;
  y: number;
  radius: number;
  charge: number;
  maxCharge: number;
}

export interface CursedArena {
  active: boolean;
  x: number;
  y: number;
  size: number;
  duration: number;
  maxDuration: number;
  miniBossId?: number;
}

export interface ExtractedEssence {
  id: string;
  name: string;
  desc: string;
  icon: string;
  bonusType: string;
}

export interface MerchantEntity {
  id: number;
  x: number;
  y: number;
  radius: number;
  visited: boolean;
  hasOverdrive: boolean;
  hasForceUpgrade: boolean;
  hasCatalyst: boolean;
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
  // Phase Dash: remaining i-frame/burst time, sprint rising-edge tracking, once-per-dash "PHASED!" flag
  dashTimer: number;
  prevWantsSprint: boolean;
  dashPhased: boolean;
  // Sprint input ignored until every sprint binding is released (set when gameplay resumes after a dialog)
  sprintLatched: boolean;
  // Kinetic Charge: 0-100 Momentum built by sprinting; releases a shockwave when a full sprint ends
  momentum: number;
  // Pact of the Swarm curses active this run (PactId values from types/meta)
  pacts: string[];
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
  totalRunTimer: number;
  stage: number;
  kills: number;
  gold: number;
  nextEnemyId: number;
  nextProjId: number;
  nextDropId: number;
  nextDmgId: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  bossShieldActive: boolean;
  bossMinionsInitial: number;
  bossMinionsRemaining: number;
  bossImmuneSoundTimer?: number;
  auraVisualAngle: number;
  sprintParticlesTimer: number;
  rapidRegenTimer: number;
  bonusMaxHp: number;
  bonusMight: number;
  bonusSpeed: number;
  bonusCdr: number;
  bonusArmor: number;
  bonusStamina: number;
  bonusRegen: number;
  bonusArea: number;
  bonusMagnet: number;
  bonusGreed: number;
  bonusPoisonChance: number;
  aegisShieldTimer: number;
  solarPulseCounter?: number;
  conduitPylons?: {x: number; y: number; life: number}[];
  // Arena Objectives & Spatial Mechanics
  obelisk: ObeliskEntity | null;
  obeliskSpawnTimer: number;
  inObeliskZone: boolean;
  cursedArena: CursedArena | null;
  // Economy & Mid-Run Pivoting
  merchant: MerchantEntity | null;
  nextMerchantSpawnTime: number;
  overdriveTimer: number;
  fusionCatalystAvailable: boolean;
  extractedEssences: ExtractedEssence[];
  bannedItemIds?: string[];
  derivedStats?: DerivedStats;
}
