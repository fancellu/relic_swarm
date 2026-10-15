// tslint:disable
/* eslint-disable */
import {
  Activity,
  Coins,
  DollarSign,
  Flame,
  Heart,
  HelpCircle,
  Menu,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Shield,
  Skull,
  Snowflake,
  Sparkles,
  Sword,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {getConfig} from './constants';
import {SpriteActionConfig, SpriteAnimationState, SpriteRenderer} from './SpriteRenderer';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  clamp,
  createFixedStepper,
  drawAsset,
  formatTime,
  gameAudio,
  GameState,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  shuffle,
  useAssets,
  useAutoFocus,
  useInput,
  useIsMobile,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

const BACKGROUND_MUSIC_URL = 'assets/audio/bgm_survivor_theme.mp3';

const GOLD_STORAGE_KEY = 'relic_swarm_sanctum_gold';
const LEGACY_GOLD_STORAGE_KEY = 'relic_swarm_gold';
const META_STORAGE_KEY = 'relic_swarm_meta';

function getStoredGold(): number {
  try {
    const val = localStorage.getItem(GOLD_STORAGE_KEY) || localStorage.getItem(LEGACY_GOLD_STORAGE_KEY);
    return val ? Math.max(0, parseInt(val, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

function getStoredMeta(): Record<string, number> {
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
    };
  }
}

// --- Animated Hero Portrait Component for Character Select ---
function AnimatedHeroPortrait({
  imgUrl,
  color,
  isSelected,
  size = 48,
  totalFrames = 4,
  fps = 6,
}: {
  imgUrl: string;
  color: string;
  isSelected: boolean;
  size?: number;
  totalFrames?: number;
  fps?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgUrl;

    let animId: number;
    const startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const frameIndex = Math.floor(elapsed * fps) % totalFrames;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (img.complete && img.naturalWidth > 0) {
        const fw = 512;
        const fh = 512;
        const sx = frameIndex * fw;
        const sy = 0;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, fw, fh, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    img.onload = () => {
      animId = requestAnimationFrame(render);
    };
    if (img.complete) {
      animId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [imgUrl, color, totalFrames, fps]);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        imageRendering: 'pixelated',
      }}
      className="pointer-events-none"
    />
  );
}

// --- Hero Definitions ---
interface HeroData {
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
  spriteKey: 'hero_spellblade' | 'hero_pyromancer' | 'hero_voidstalker';
}

const HEROES: HeroData[] = [
  {
    id: 'vael',
    name: 'Arcanist Vael',
    title: 'Grand Sorcerer',
    desc: 'Wields rapid seeking Arcane Magic Missiles with broad area and cooldown haste.',
    startingWeapon: 'magic_missile',
    startingPassive: 'might_talisman',
    statBonus: '+15% Spell Area & +10% Cooldown Reduction',
    baseHp: 100,
    baseSpeed: 1.1,
    areaBonus: 1.15,
    cdrBonus: 0.1,
    mightBonus: 0.1,
    armorBonus: 0,
    regenBonus: 0,
    color: '#38bdf8',
    idleSheet: 'assets/images/hero_spellblade_idle.png',
    spriteKey: 'hero_spellblade',
  },
  {
    id: 'roland',
    name: 'Knight Commander Roland',
    title: 'Spectral Vanguard',
    desc: 'Commands orbiting spectral blades, bolstered by heavy fortress vitality and armor.',
    startingWeapon: 'spinning_dagger',
    startingPassive: 'vitality_charm',
    statBonus: '+50 Base Max HP & +2 Damage Resistance',
    baseHp: 150,
    baseSpeed: 1.0,
    areaBonus: 1.0,
    cdrBonus: 0.05,
    mightBonus: 0.05,
    armorBonus: 2,
    regenBonus: 0.5,
    color: '#a855f7',
    idleSheet: 'assets/images/hero_voidstalker_idle.png',
    spriteKey: 'hero_voidstalker',
  },
  {
    id: 'ignis',
    name: 'Pyromancer Ignis',
    title: 'Infernal Conjuror',
    desc: 'Unleashes devastating explosive flame blasts with colossal splash radii.',
    startingWeapon: 'flame_blast',
    startingPassive: 'might_talisman',
    statBonus: '+25% Global Damage & +20% Blast Area',
    baseHp: 90,
    baseSpeed: 1.05,
    areaBonus: 1.25,
    cdrBonus: 0.0,
    mightBonus: 0.25,
    armorBonus: 0,
    regenBonus: 0,
    color: '#f97316',
    idleSheet: 'assets/images/hero_pyromancer_idle.png',
    spriteKey: 'hero_pyromancer',
  },
  {
    id: 'mortis',
    name: 'Plague Alchemist Mortis',
    title: 'Venomous Harvester',
    desc: 'Infects hordes with toxic spore clouds while swiftly maneuvering and regenerating.',
    startingWeapon: 'venom_spores',
    startingPassive: 'toxic_vial',
    statBonus: '+20% Move Speed, +1 HP/s Regen & Toxic Mastery',
    baseHp: 95,
    baseSpeed: 1.2,
    areaBonus: 1.1,
    cdrBonus: 0.15,
    mightBonus: 0.1,
    armorBonus: 0,
    regenBonus: 1.0,
    color: '#22c55e',
    idleSheet: 'assets/images/hero_voidstalker_idle.png',
    spriteKey: 'hero_voidstalker',
  },
];

// --- Weapons & Passives Definitions ---
export interface ItemDef {
  id: string;
  name: string;
  type: 'WEAPON' | 'PASSIVE';
  icon: string;
  desc: string;
  maxLevel: number;
  baseDamage?: number;
  cooldown?: number;
  isEvolution?: boolean;
  isFusion?: boolean;
  consumedWeapons?: string[];
  cost?: number;
  evolutionPair?: string;
  inflictsPoison?: boolean;
  inflictsSlow?: boolean;
  damageDealtByWeapon?: Record<string, number>;
  isConsumable?: boolean;
}

const ITEM_DEFS: Record<string, ItemDef> = {
  // Consumable Fallback Rewards (3 distinct choices offered when all slots/items are maxed out)
  bag_of_gold: {
    id: 'bag_of_gold',
    name: 'Bag of Gold',
    type: 'PASSIVE',
    icon: 'assets/images/item_gold_coin.png',
    desc: 'Bountiful royal coin cache. Instantly grants +60 Sanctum Gold.',
    maxLevel: 99,
    cost: 0,
    isConsumable: true,
  },
  elixir_vitality: {
    id: 'elixir_vitality',
    name: 'Elixir of Vitality (Great Feast)',
    type: 'PASSIVE',
    icon: 'assets/images/item_health_potion.png',
    desc: 'Grand restorative brew. Restores 40% Max HP and initiates 5 seconds of rapid regeneration.',
    maxLevel: 99,
    cost: 0,
    isConsumable: true,
  },
  orb_obliteration: {
    id: 'orb_obliteration',
    name: 'Orb of Obliteration (Super Nova)',
    type: 'PASSIVE',
    icon: 'assets/images/proj_thunder_strike.png',
    desc: 'Detonates a screen-wide holy shockwave that incinerates non-boss enemies and deals 800 damage to bosses!',
    maxLevel: 99,
    cost: 0,
    isConsumable: true,
  },

  // Base Weapons
  magic_missile: {
    id: 'magic_missile',
    name: 'Magic Missile',
    type: 'WEAPON',
    icon: 'assets/images/icon_wand_weapon.png',
    desc: 'Auto-fires seeking arcane crystalline bolts at nearby foes.',
    maxLevel: 5,
    baseDamage: 22,
    cooldown: 0.75,
    evolutionPair: 'swift_boots',
    cost: 50,
  },
  flame_blast: {
    id: 'flame_blast',
    name: 'Flame Blast',
    type: 'WEAPON',
    icon: 'assets/images/icon_flame_staff.png',
    desc: 'Hurls explosive fiery plasma creating scorching splash damage pools.',
    maxLevel: 5,
    baseDamage: 38,
    cooldown: 1.4,
    evolutionPair: 'might_talisman',
    cost: 60,
  },
  spinning_dagger: {
    id: 'spinning_dagger',
    name: 'Orbiting Daggers',
    type: 'WEAPON',
    icon: 'assets/images/icon_daggers_weapon.png',
    desc: 'Razor-sharp steel blades orbit continuously around you.',
    maxLevel: 5,
    baseDamage: 18,
    cooldown: 0.1,
    evolutionPair: 'might_talisman',
    cost: 55,
  },
  thunder_strike: {
    id: 'thunder_strike',
    name: 'Thunder Strike',
    type: 'WEAPON',
    icon: 'assets/images/proj_thunder_strike.png',
    desc: 'Calls down vertical celestial lightning on dense enemy clusters.',
    maxLevel: 5,
    baseDamage: 55,
    cooldown: 2.0,
    evolutionPair: 'swift_boots',
    cost: 65,
  },
  radiant_aura: {
    id: 'radiant_aura',
    name: 'Radiant Aura',
    type: 'WEAPON',
    icon: 'assets/images/effect_radiant_aura.png',
    desc: 'A permanent holy aura ring pulsing damage to all nearby enemies.',
    maxLevel: 5,
    baseDamage: 14,
    cooldown: 0.35,
    evolutionPair: 'vitality_charm',
    cost: 70,
  },
  venom_spores: {
    id: 'venom_spores',
    name: 'Toxic Spores',
    type: 'WEAPON',
    icon: 'assets/images/item_xp_gem_purple.png',
    desc: 'Erupts toxic green spore clouds that infect foes with lingering Poison DoT.',
    maxLevel: 5,
    baseDamage: 16,
    cooldown: 1.2,
    evolutionPair: 'toxic_vial',
    cost: 60,
    inflictsPoison: true,
  },
  frost_shard: {
    id: 'frost_shard',
    name: 'Glacial Shards',
    type: 'WEAPON',
    icon: 'assets/images/item_xp_gem_blue.png',
    desc: 'Launches piercing ice spikes that Slow enemy movement by 50%.',
    maxLevel: 5,
    baseDamage: 26,
    cooldown: 1.1,
    evolutionPair: 'frost_amulet',
    cost: 60,
    inflictsSlow: true,
  },

  // Level 5 + Level 5 Weapon Fusions (Evolutions)
  arcane_phantom_vortex: {
    id: 'arcane_phantom_vortex',
    name: 'Arcane Phantom Vortex',
    type: 'WEAPON',
    icon: 'assets/images/icon_daggers_weapon.png',
    desc: 'FUSION (Magic Missile L5 + Daggers L5): 8 astral orbiting blades that constantly fire homing beam barrages.',
    maxLevel: 1,
    baseDamage: 48,
    cooldown: 0.08,
    isEvolution: true,
    isFusion: true,
    consumedWeapons: ['magic_missile', 'spinning_dagger'],
    cost: 200,
  },
  cataclysmic_nova: {
    id: 'cataclysmic_nova',
    name: 'Cataclysmic Supernova',
    type: 'WEAPON',
    icon: 'assets/images/icon_flame_staff.png',
    desc: 'FUSION (Flame Blast L5 + Thunder Strike L5): Screen-shattering infernos and celestial lightning storm novas.',
    maxLevel: 1,
    baseDamage: 110,
    cooldown: 0.9,
    isEvolution: true,
    isFusion: true,
    consumedWeapons: ['flame_blast', 'thunder_strike'],
    cost: 220,
  },
  toxic_sanctuary: {
    id: 'toxic_sanctuary',
    name: 'Plague Sanctuary',
    type: 'WEAPON',
    icon: 'assets/images/effect_radiant_aura.png',
    desc: 'FUSION (Radiant Aura L5 + Toxic Spores L5): Conjures a sanctified toxic aura that slows nearby enemies by 40% and deals 24 poison damage per second in a wide radius.',
    maxLevel: 1,
    baseDamage: 38,
    cooldown: 0.25,
    isEvolution: true,
    isFusion: true,
    consumedWeapons: ['radiant_aura', 'venom_spores'],
    cost: 210,
    inflictsPoison: true,
    inflictsSlow: true,
  },

  // Awakened Weapon + Passive Evolutions
  chrono_missiles: {
    id: 'chrono_missiles',
    name: 'Chrono Missiles',
    type: 'WEAPON',
    icon: 'assets/images/icon_wand_weapon.png',
    desc: 'Awakened: Continuous torrent of time-piercing arcane laser bolts!',
    maxLevel: 1,
    baseDamage: 45,
    cooldown: 0.35,
    isEvolution: true,
    cost: 150,
  },
  hellfire_nova: {
    id: 'hellfire_nova',
    name: 'Hellfire Nova',
    type: 'WEAPON',
    icon: 'assets/images/icon_flame_staff.png',
    desc: 'Awakened: Cascades infernal supernovae across the entire arena!',
    maxLevel: 1,
    baseDamage: 90,
    cooldown: 1.0,
    isEvolution: true,
    cost: 160,
  },
  phantom_storm: {
    id: 'phantom_storm',
    name: 'Phantom Storm',
    type: 'WEAPON',
    icon: 'assets/images/icon_daggers_weapon.png',
    desc: 'Awakened: Unstoppable vortex of 8 hyper-speed ethereal scythes.',
    maxLevel: 1,
    baseDamage: 36,
    cooldown: 0.05,
    isEvolution: true,
    cost: 155,
  },
  absolute_zero: {
    id: 'absolute_zero',
    name: 'Absolute Zero',
    type: 'WEAPON',
    icon: 'assets/images/item_xp_gem_blue.png',
    desc: 'Awakened: Cascading cryogenic storms that freeze & shatter enemy lines!',
    maxLevel: 1,
    baseDamage: 65,
    cooldown: 0.7,
    isEvolution: true,
    cost: 160,
    inflictsSlow: true,
  },

  // Passives
  might_talisman: {
    id: 'might_talisman',
    name: 'Might Talisman',
    type: 'PASSIVE',
    icon: 'assets/images/icon_might_talisman.png',
    desc: '+15% Global Attack Damage per level.',
    maxLevel: 5,
    cost: 40,
  },
  swift_boots: {
    id: 'swift_boots',
    name: 'Swift Boots',
    type: 'PASSIVE',
    icon: 'assets/images/icon_speed_boots.png',
    desc: '+12% Movement Speed & +15 Max Stamina per level.',
    maxLevel: 5,
    cost: 40,
  },
  magnet_rune: {
    id: 'magnet_rune',
    name: 'Attraction Rune',
    type: 'PASSIVE',
    icon: 'assets/images/item_magnet_rune.png',
    desc: '+35% XP & Gold Vacuum Attraction Radius.',
    maxLevel: 5,
    cost: 35,
  },
  vitality_charm: {
    id: 'vitality_charm',
    name: 'Vitality Charm',
    type: 'PASSIVE',
    icon: 'assets/images/item_health_potion.png',
    desc: '+25 Max HP & +0.5 HP/sec continuous regeneration.',
    maxLevel: 5,
    cost: 45,
  },
  toxic_vial: {
    id: 'toxic_vial',
    name: 'Venom Infusion',
    type: 'PASSIVE',
    icon: 'assets/images/item_xp_gem_purple.png',
    desc: '+35% chance for all weapons to inflict deadly Poison DoT.',
    maxLevel: 5,
    cost: 45,
  },
  frost_amulet: {
    id: 'frost_amulet',
    name: 'Permafrost Sigil',
    type: 'PASSIVE',
    icon: 'assets/images/item_xp_gem_blue.png',
    desc: 'Emits a frost aura that Slows all nearby enemies by 35%.',
    maxLevel: 5,
    cost: 45,
  },
  greed_coin: {
    id: 'greed_coin',
    name: 'Greed Coin',
    type: 'PASSIVE',
    icon: 'assets/images/item_gold_coin.png',
    desc: '+25% Gold Coin value drops from all sources.',
    maxLevel: 5,
    cost: 35,
  },
};

// --- Meta Upgrades ---
interface MetaUpgrade {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  costBase: number;
  costStep: number;
  bonusPerLevel: number;
  unit: string;
}

const MAX_WORLD_CHESTS = 4;

const META_UPGRADES: Record<string, MetaUpgrade> = {
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
};

// --- In-Game Simulation Structures ---
interface EquippedItem {
  id: string;
  level: number;
}

interface EnemyEntity {
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

interface ProjectileEntity {
  id: number;
  type: 'missile' | 'flame' | 'dagger' | 'thunder' | 'sorcerer_orb' | 'spore' | 'ice' | 'vortex';
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
}

interface DropEntity {
  id: number;
  type: 'xp_blue' | 'xp_purple' | 'gold' | 'potion' | 'magnet' | 'chest';
  x: number;
  y: number;
  value: number;
  attracted: boolean;
  openingTimer?: number;
  isOpening?: boolean;
}

interface ParticleEntity {
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

interface DamageNumber {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface ChestRewardData {
  title: string;
  type: 'ITEM' | 'STAT_BUFF' | 'MAGNET_SURGE' | 'HOLY_BOMB' | 'AEGIS_SHIELD';
  description: string;
  gold: number;
  statName?: string;
  item?: ItemDef;
  isEvo?: boolean;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>(undefined);
  const lastCancelRef = useRef(false);

  const {sdk} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');
  const isMobile = useIsMobile();

  // --- ASSETS MANIFEST ---
  const ASSETS_MANIFEST: Record<string, string> = useMemo(
    () => ({
      // Spritesheets
      hero_spellblade_idle: 'assets/images/hero_spellblade_idle.png',
      hero_spellblade_run: 'assets/images/hero_spellblade_run.png',
      hero_spellblade_attack: 'assets/images/hero_spellblade_attack.png',
      hero_spellblade_hurt: 'assets/images/hero_spellblade_hurt.png',
      hero_spellblade_death: 'assets/images/hero_spellblade_death.png',

      hero_pyromancer_idle: 'assets/images/hero_pyromancer_idle.png',
      hero_pyromancer_run: 'assets/images/hero_pyromancer_run.png',
      hero_pyromancer_attack: 'assets/images/hero_pyromancer_attack.png',
      hero_pyromancer_hurt: 'assets/images/hero_pyromancer_hurt.png',
      hero_pyromancer_death: 'assets/images/hero_pyromancer_death.png',

      hero_voidstalker_idle: 'assets/images/hero_voidstalker_idle.png',
      hero_voidstalker_run: 'assets/images/hero_voidstalker_run.png',
      hero_voidstalker_attack: 'assets/images/hero_voidstalker_attack.png',
      hero_voidstalker_hurt: 'assets/images/hero_voidstalker_hurt.png',
      hero_voidstalker_death: 'assets/images/hero_voidstalker_death.png',

      enemy_skeleton_idle: 'assets/images/enemy_skeleton_idle.png',
      enemy_skeleton_run: 'assets/images/enemy_skeleton_run.png',
      enemy_skeleton_attack: 'assets/images/enemy_skeleton_attack.png',
      enemy_skeleton_hurt: 'assets/images/enemy_skeleton_hurt.png',
      enemy_skeleton_death: 'assets/images/enemy_skeleton_death.png',

      enemy_shadow_hound_quad_idle: 'assets/images/enemy_shadow_hound_quad_idle.png',
      enemy_shadow_hound_quad_running: 'assets/images/enemy_shadow_hound_quad_running.png',
      enemy_shadow_hound_quad_jump: 'assets/images/enemy_shadow_hound_quad_jump.png',

      enemy_abyssal_bat_avian_idle: 'assets/images/enemy_abyssal_bat_avian_idle.png',
      enemy_abyssal_bat_bird_fly: 'assets/images/enemy_abyssal_bat_bird_fly.png',
      enemy_abyssal_bat_bird_dive: 'assets/images/enemy_abyssal_bat_bird_dive.png',

      boss_abyssal_titan_idle: 'assets/images/boss_abyssal_titan_idle.png',
      boss_abyssal_titan_run: 'assets/images/boss_abyssal_titan_run.png',
      boss_abyssal_titan_attack: 'assets/images/boss_abyssal_titan_attack.png',
      boss_abyssal_titan_death: 'assets/images/boss_abyssal_titan_death.png',

      // Static Items & Projectiles
      effect_radiant_aura: 'assets/images/effect_radiant_aura.png',
      icon_speed_boots: 'assets/images/icon_speed_boots.png',
      icon_might_talisman: 'assets/images/icon_might_talisman.png',
      icon_wand_weapon: 'assets/images/icon_wand_weapon.png',
      icon_flame_staff: 'assets/images/icon_flame_staff.png',
      icon_daggers_weapon: 'assets/images/icon_daggers_weapon.png',
      item_xp_gem_blue: 'assets/images/item_xp_gem_blue.png',
      item_xp_gem_purple: 'assets/images/item_xp_gem_purple.png',
      item_treasure_chest: 'assets/images/item_treasure_chest.png',
      item_health_potion: 'assets/images/item_health_potion.png',
      item_gold_coin: 'assets/images/item_gold_coin.png',
      item_magnet_rune: 'assets/images/item_magnet_rune.png',
      proj_magic_missile: 'assets/images/proj_magic_missile.png',
      proj_flame_blast: 'assets/images/proj_flame_blast.png',
      proj_spinning_dagger: 'assets/images/proj_spinning_dagger.png',
      proj_thunder_strike: 'assets/images/proj_thunder_strike.png',
    }),
    [],
  );

  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  const canvasWidth = getConfig('baseCanvasWidth') as number;
  const canvasHeight = getConfig('baseCanvasHeight') as number;

  if (!stepperRef.current) {
    const stepMs = getConfig('stepMs');
    const maxSubSteps = getConfig('maxSubSteps');
    stepperRef.current = createFixedStepper(stepMs, maxSubSteps);
  }

  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
    timer: 0,
  });

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Audio State
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);

  // Persistent Meta-Progression in LocalStorage
  const [persistentGold, setPersistentGold] = useState<number>(getStoredGold);
  const [metaLevels, setMetaLevels] = useState<Record<string, number>>(getStoredMeta);

  // Always keep persistent gold refreshed from localStorage
  const refreshPersistentGold = useCallback(() => {
    setPersistentGold(getStoredGold());
  }, []);

  const bankRunGold = useCallback((runGoldToAdd: number) => {
    if (runGoldToAdd <= 0) return;
    const currentSaved = getStoredGold();
    const newTotal = currentSaved + runGoldToAdd;
    try {
      localStorage.setItem(GOLD_STORAGE_KEY, newTotal.toString());
      localStorage.setItem(LEGACY_GOLD_STORAGE_KEY, newTotal.toString());
    } catch (e) {
      console.warn(e);
    }
    setPersistentGold(newTotal);
  }, []);

  const savePersistentData = useCallback((newGold: number, newMeta: Record<string, number>) => {
    setPersistentGold(newGold);
    setMetaLevels(newMeta);
    try {
      localStorage.setItem(GOLD_STORAGE_KEY, newGold.toString());
      localStorage.setItem(LEGACY_GOLD_STORAGE_KEY, newGold.toString());
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(newMeta));
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // Selected Hero & UI Overlays
  const [selectedHeroIndex, setSelectedHeroIndex] = useState(0);
  const [isSanctumOpen, setIsSanctumOpen] = useState(false);
  const [sanctumFocusIndex, setSanctumFocusIndex] = useState(0);
  const sanctumFocusIndexRef = useRef(0);
  const sanctumItemsRef = useRef<(HTMLDivElement | HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (isSanctumOpen) {
      sanctumItemsRef.current[sanctumFocusIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [sanctumFocusIndex, isSanctumOpen]);

  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [pauseTab, setPauseTab] = useState<'STATS' | 'GRIMOIRE' | 'MENU'>('STATS');
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [inventoryFocusIndex, setInventoryFocusIndex] = useState(0);
  const inventoryFocusIndexRef = useRef(0);
  const inventoryItemsRef = useRef<(HTMLDivElement | HTMLButtonElement | null)[]>([]);

  const [pauseMenuFocusIndex, setPauseMenuFocusIndex] = useState(0);
  const pauseMenuFocusIndexRef = useRef(0);
  const pauseMenuItemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (isInventoryOpen) {
      inventoryItemsRef.current[inventoryFocusIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [inventoryFocusIndex, isInventoryOpen]);

  useEffect(() => {
    if (isGameMenuOpen && pauseTab === 'MENU') {
      pauseMenuItemsRef.current[pauseMenuFocusIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [pauseMenuFocusIndex, isGameMenuOpen, pauseTab]);

  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);
  const [levelUpChoices, setLevelUpChoices] = useState<ItemDef[]>([]);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState(0);
  const [availableRerolls, setAvailableRerolls] = useState(0);
  const [chestReward, setChestReward] = useState<ChestRewardData | null>(null);
  const [endScreenFocusIndex, setEndScreenFocusIndex] = useState(0); // 0 = Primary Action (Restart/Survive), 1 = Sanctum/Menu

  // Active Run Stats
  const [runGold, setRunGold] = useState(0);
  const [killCount, setKillCount] = useState(0);
  const [equippedWeapons, setEquippedWeapons] = useState<EquippedItem[]>([]);
  const [equippedPassives, setEquippedPassives] = useState<EquippedItem[]>([]);
  const [currentHp, setCurrentHp] = useState(100);
  const [maxHpDisplay, setMaxHpDisplay] = useState(100);
  const [currentStamina, setCurrentStamina] = useState(100);
  const [maxStaminaDisplay, setMaxStaminaDisplay] = useState(100);
  const [xpDisplay, setXpDisplay] = useState(0);
  const [nextLevelXpDisplay, setNextLevelXpDisplay] = useState(10);

  // --- Sprite Renderers Cache with Verified Idle Dimensions ---
  const spriteRenderersRef = useRef<{
    hero_spellblade: SpriteRenderer;
    hero_pyromancer: SpriteRenderer;
    hero_voidstalker: SpriteRenderer;
    skeleton: SpriteRenderer;
    hound: SpriteRenderer;
    bat: SpriteRenderer;
    titan: SpriteRenderer;
  } | null>(null);

  if (!spriteRenderersRef.current) {
    const makeConfig = (
      img: string,
      frames = 16,
      fps = 12,
      w = 512,
      h = 512,
      loop = true,
    ): SpriteActionConfig => ({
      imageUrl: img,
      totalFrames: frames,
      frameWidth: w,
      frameHeight: h,
      fps,
      loop,
    });

    spriteRenderersRef.current = {
      hero_spellblade: new SpriteRenderer({
        IDLE: makeConfig('hero_spellblade_idle', 4, 6),
        RUN: makeConfig('hero_spellblade_run', 16, 16),
        ATTACK: makeConfig('hero_spellblade_attack', 16, 16),
        HURT: makeConfig('hero_spellblade_hurt', 16, 10, 512, 512, false),
        DEATH: makeConfig('hero_spellblade_death', 16, 10, 512, 512, false),
      }),
      hero_pyromancer: new SpriteRenderer({
        IDLE: makeConfig('hero_pyromancer_idle', 4, 6),
        RUN: makeConfig('hero_pyromancer_run', 16, 16),
        ATTACK: makeConfig('hero_pyromancer_attack', 16, 16),
        HURT: makeConfig('hero_pyromancer_hurt', 16, 10, 512, 512, false),
        DEATH: makeConfig('hero_pyromancer_death', 16, 10, 512, 512, false),
      }),
      hero_voidstalker: new SpriteRenderer({
        IDLE: makeConfig('hero_voidstalker_idle', 4, 6),
        RUN: makeConfig('hero_voidstalker_run', 16, 16),
        ATTACK: makeConfig('hero_voidstalker_attack', 16, 16),
        HURT: makeConfig('hero_voidstalker_hurt', 16, 10, 512, 512, false),
        DEATH: makeConfig('hero_voidstalker_death', 16, 10, 512, 512, false),
      }),
      skeleton: new SpriteRenderer({
        IDLE: makeConfig('enemy_skeleton_idle', 4, 6),
        RUN: makeConfig('enemy_skeleton_run', 16, 16),
        ATTACK: makeConfig('enemy_skeleton_attack', 16, 14),
        HURT: makeConfig('enemy_skeleton_hurt', 16, 10, 512, 512, false),
        DEATH: makeConfig('enemy_skeleton_death', 16, 10, 512, 512, false),
      }),
      hound: new SpriteRenderer({
        IDLE: makeConfig('enemy_shadow_hound_quad_idle', 16, 8),
        RUN: makeConfig('enemy_shadow_hound_quad_running', 16, 16),
        ATTACK: makeConfig('enemy_shadow_hound_quad_jump', 16, 16),
      }),
      bat: new SpriteRenderer({
        IDLE: makeConfig('enemy_abyssal_bat_avian_idle', 16, 8),
        RUN: makeConfig('enemy_abyssal_bat_bird_fly', 16, 14),
        ATTACK: makeConfig('enemy_abyssal_bat_bird_dive', 16, 16),
      }),
      titan: new SpriteRenderer({
        IDLE: makeConfig('boss_abyssal_titan_idle', 4, 6),
        RUN: makeConfig('boss_abyssal_titan_run', 16, 12),
        ATTACK: makeConfig('boss_abyssal_titan_attack', 16, 14),
        DEATH: makeConfig('boss_abyssal_titan_death', 16, 8, 512, 512, false),
      }),
    };
  }

  // --- High-Performance Simulation State in Refs ---
  const simRef = useRef({
    hero: HEROES[0],
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 220,
    facingLeft: false,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    isSprinting: false,
    invulnTimer: 0,
    heroAnim: {currentAction: 'IDLE', currentFrame: 0, timer: 0},
    xp: 0,
    nextXp: 10,
    level: 1,
    weapons: [] as EquippedItem[],
    passives: [] as EquippedItem[],
    weaponTimers: {} as Record<string, number>,
    weaponDamageDealt: {} as Record<string, number>,
    enemies: [] as EnemyEntity[],
    projectiles: [] as ProjectileEntity[],
    drops: [] as DropEntity[],
    particles: [] as ParticleEntity[],
    damageNumbers: [] as DamageNumber[],
    camera: {x: 0, y: 0},
    screenShake: 0,
    spawnTimer: 0,
    runTimer: 0,
    kills: 0,
    gold: 0,
    nextEnemyId: 1,
    nextProjId: 1,
    nextDropId: 1,
    nextDmgId: 1,
    bossSpawned: false,
    bossDefeated: false,
    auraVisualAngle: 0,
    sprintParticlesTimer: 0,
    rapidRegenTimer: 0,
    bonusMaxHp: 0,
    bonusMight: 0,
    bonusSpeed: 0,
    bonusCdr: 0,
    bonusArmor: 0,
    bonusStamina: 0,
    aegisShieldTimer: 0,
  });

  // Touch Virtual Joystick Controls
  const touchJoystickRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    dx: number;
    dy: number;
    sprintTouch: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dx: 0,
    dy: 0,
    sprintTouch: false,
  });

  // Track keyboard keys for sprint & direct hotkeys
  const keyboardSprintRef = useRef(false);
  const gamepadNavCooldownRef = useRef(0);
  const lastGamepadPauseBtnRef = useRef(false);

  const inputRef = useInput(canvasRef, true, {
    width: canvasWidth,
    height: canvasHeight,
  });

  // Keep back key handler
  useEffect(() => {
    (window as any).canHandleBackKey = gameState.status !== 'START';
  }, [gameState.status]);

  // --- Lifecycle & Audio Hooks ---
  usePlaygroundGameLifecycle(gameState, sdk);

  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    } else if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
    }
  }, [gameState.status]);

  // --- Calculate Derived Stats ---
  const getCalculatedStats = useCallback(() => {
    const sim = simRef.current;
    const hero = sim.hero || HEROES[0];
    const meta = metaLevels;

    // Max HP
    const metaHpMult = 1 + (meta.maxHp || 0) * (META_UPGRADES.maxHp.bonusPerLevel / 100);
    const vitalityLevel = sim.passives.find((p) => p.id === 'vitality_charm')?.level || 0;
    const maxHp = Math.round(hero.baseHp * metaHpMult + vitalityLevel * 25 + (sim.bonusMaxHp || 0));

    // Max Stamina
    const bootsLevel = sim.passives.find((p) => p.id === 'swift_boots')?.level || 0;
    const maxStamina = 100 + bootsLevel * 15 + (sim.bonusStamina || 0);

    // Might (Damage)
    const metaMightMult = 1 + (meta.might || 0) * (META_UPGRADES.might.bonusPerLevel / 100);
    const mightLevel = sim.passives.find((p) => p.id === 'might_talisman')?.level || 0;
    const mightMult = metaMightMult * (1 + mightLevel * 0.15 + (hero.mightBonus || 0) + (sim.bonusMight || 0));

    // Speed
    const metaSpeedMult = 1 + (meta.speed || 0) * (META_UPGRADES.speed.bonusPerLevel / 100);
    const baseSpeedVal = getConfig('playerBaseSpeed') as number;
    const speed = baseSpeedVal * hero.baseSpeed * metaSpeedMult * (1 + bootsLevel * 0.12 + (sim.bonusSpeed || 0));

    // CDR (Cooldown Reduction)
    const metaCdr = (meta.haste || 0) * (META_UPGRADES.haste.bonusPerLevel / 100);
    const cdr = Math.min(0.65, (hero.cdrBonus || 0) + metaCdr + (sim.bonusCdr || 0));

    // Magnet Radius
    const metaMagnet = (meta.magnet || 0) * (META_UPGRADES.magnet.bonusPerLevel / 100);
    const magnetLevel = sim.passives.find((p) => p.id === 'magnet_rune')?.level || 0;
    const magnetRadius = 110 * (1 + metaMagnet + magnetLevel * 0.35);

    // Greed (Gold Multiplier)
    const metaGreed = 1 + (meta.greed || 0) * (META_UPGRADES.greed.bonusPerLevel / 100);
    const greedLevel = sim.passives.find((p) => p.id === 'greed_coin')?.level || 0;
    const greedMult = metaGreed * (1 + greedLevel * 0.25);

    // Status Traits & Regen
    const toxicLevel = sim.passives.find((p) => p.id === 'toxic_vial')?.level || 0;
    const frostAmuletLevel = sim.passives.find((p) => p.id === 'frost_amulet')?.level || 0;
    const baseRegen = (hero.regenBonus || 0) + (vitalityLevel * 0.5);
    const armor = (hero.armorBonus || 0) + (sim.bonusArmor || 0);

    // Area Size
    const areaMult = hero.areaBonus || 1.0;

    return {
      maxHp,
      maxStamina,
      mightMult,
      speed,
      cdr,
      magnetRadius,
      greedMult,
      areaMult,
      vitalityLevel,
      toxicLevel,
      frostAmuletLevel,
      baseRegen,
      armor,
    };
  }, [metaLevels]);

  // Open Sanctum Shop helper
  const openSanctumShop = useCallback(() => {
    refreshPersistentGold();
    sanctumFocusIndexRef.current = 0;
    setSanctumFocusIndex(0);
    setIsSanctumOpen(true);
    gameAudio.playCrispClick();
  }, [refreshPersistentGold]);

  // Open Inventory / Arsenal Selling helper
  const openInventory = useCallback(() => {
    inventoryFocusIndexRef.current = 0;
    setInventoryFocusIndex(0);
    setIsInventoryOpen(true);
    gameAudio.playCrispClick();
  }, []);

  // --- Start / Reset Game ---
  const initGame = useCallback((heroIdx = selectedHeroIndex) => {
    const hero = HEROES[heroIdx] || HEROES[0];
    const initialWeapon = hero.startingWeapon;
    const initialPassives: EquippedItem[] = hero.startingPassive ? [{id: hero.startingPassive, level: 1}] : [];

    const stats = {
      maxHp: hero.baseHp,
      speed: (getConfig('playerBaseSpeed') as number) * hero.baseSpeed,
    };

    simRef.current = {
      hero,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      speed: stats.speed,
      facingLeft: false,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      stamina: 100,
      maxStamina: 100,
      isSprinting: false,
      invulnTimer: 0,
      heroAnim: {currentAction: 'IDLE', currentFrame: 0, timer: 0},
      xp: 0,
      nextXp: 10,
      level: 1,
      weapons: [{id: initialWeapon, level: 1}],
      passives: initialPassives,
      weaponTimers: {},
      weaponDamageDealt: {[initialWeapon]: 0},
      enemies: [],
      projectiles: [],
      drops: [],
      particles: [],
      damageNumbers: [],
      camera: {x: 0, y: 0},
      screenShake: 0,
      spawnTimer: 0,
      runTimer: 0,
      kills: 0,
      gold: 0,
      nextEnemyId: 1,
      nextProjId: 1,
      nextDropId: 1,
      nextDmgId: 1,
      bossSpawned: false,
      bossDefeated: false,
      auraVisualAngle: 0,
      sprintParticlesTimer: 0,
      rapidRegenTimer: 0,
      bonusMaxHp: 0,
      bonusMight: 0,
      bonusSpeed: 0,
      bonusCdr: 0,
      bonusArmor: 0,
      bonusStamina: 0,
      aegisShieldTimer: 0,
    };

    // Recalculate stats based on meta
    const calculated = getCalculatedStats();
    simRef.current.maxHp = calculated.maxHp;
    simRef.current.hp = calculated.maxHp;
    simRef.current.stamina = calculated.maxStamina;
    simRef.current.maxStamina = calculated.maxStamina;
    simRef.current.speed = calculated.speed;

    setEquippedWeapons([{id: initialWeapon, level: 1}]);
    setEquippedPassives(initialPassives);
    setCurrentHp(calculated.maxHp);
    setMaxHpDisplay(calculated.maxHp);
    setCurrentStamina(calculated.maxStamina);
    setMaxStaminaDisplay(calculated.maxStamina);
    setXpDisplay(0);
    setNextLevelXpDisplay(10);
    setRunGold(0);
    setKillCount(0);
    setEndScreenFocusIndex(0);
    // 3 base rerolls + meta upgrades
    setAvailableRerolls(3 + (metaLevels.rerolls || 0));

    setIsSanctumOpen(false);
    setIsHowToPlayOpen(false);
    setIsGameMenuOpen(false);
    setIsInventoryOpen(false);
    setIsLevelUpOpen(false);
    setChestReward(null);

    setGameState({
      status: 'PLAYING',
      score: 0,
      level: 1,
      timer: 0,
    });

    gameAudio.playConfirmSelect();
    if (sdk) sdk.startGame();
  }, [selectedHeroIndex, getCalculatedStats, metaLevels, sdk]);

  // Autoplay handler for automated testing
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame();
    }
  }, [initGame]);

  // --- Draft Choices Generator with Weapon Merges & Evolutions ---
  const generateDraftChoices = useCallback(() => {
    const sim = simRef.current;
    const pool: ItemDef[] = [];

    // Check Level 5 + Level 5 Weapon Fusions first
    if (sim.weapons.length >= 2) {
      const wepIds = sim.weapons.filter((w) => w.level >= 5).map((w) => w.id);

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

    // If no regular upgrades or evolutions are available (all slots full/maxed out), offer the 3 rewarding fallback choices
    if (pool.length === 0) {
      return [
        ITEM_DEFS.bag_of_gold,
        ITEM_DEFS.elixir_vitality,
        ITEM_DEFS.orb_obliteration,
      ];
    }

    const shuffled = shuffle(pool);
    // If pool has fewer than 3 items, fill remaining slots with distinct fallback consumables
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
  }, []);

  // Level Up Trigger
  const triggerLevelUp = useCallback(() => {
    gameAudio.playLevelUpStinger();
    const choices = generateDraftChoices();
    setLevelUpChoices(choices);
    setSelectedChoiceIndex(0);
    setIsLevelUpOpen(true);
  }, [generateDraftChoices]);

  // Apply Upgrade Selection
  const selectUpgrade = useCallback(
    (item: ItemDef) => {
      const sim = simRef.current;

      // Check Consumable Fallback Cards
      if (
        item.isConsumable ||
        item.id === 'bag_of_gold' ||
        item.id === 'elixir_vitality' ||
        item.id === 'orb_obliteration'
      ) {
        if (item.id === 'bag_of_gold') {
          sim.gold += 60;
          setRunGold(sim.gold);
          spawnParticles(sim.x, sim.y, 25, '#facc15', 180);
          spawnDamageNumber(sim.x, sim.y, '+60 GOLD!', '#facc15');
          gameAudio.playCoinPickup();
        } else if (item.id === 'elixir_vitality') {
          const heal = Math.round(sim.maxHp * 0.4);
          sim.hp = Math.min(sim.maxHp, sim.hp + heal);
          sim.rapidRegenTimer = 5.0; // 5 seconds of rapid regen
          setCurrentHp(Math.round(sim.hp));
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
        setIsLevelUpOpen(false);
        setChestReward(null);
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

      setEquippedWeapons([...sim.weapons]);
      setEquippedPassives([...sim.passives]);

      const updatedStats = getCalculatedStats();
      sim.maxHp = updatedStats.maxHp;
      sim.maxStamina = updatedStats.maxStamina;
      sim.speed = updatedStats.speed;
      setMaxHpDisplay(updatedStats.maxHp);
      setMaxStaminaDisplay(updatedStats.maxStamina);

      setIsLevelUpOpen(false);
      setChestReward(null);
    },
    [getCalculatedStats],
  );

  // Generate Chest Reward with expanded variety (upgrades, run-stat buffs, magnet surges, holy bombs, divine shields)
  const generateChestReward = useCallback((): ChestRewardData => {
    const goldBounty = 50 + Math.floor(Math.random() * 51); // Standardized 50-100 gold
    const draftChoices = generateDraftChoices();
    const realUpgradeChoices = draftChoices.filter((c) => !c.isConsumable);

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
  }, [generateDraftChoices]);

  // Claim Chest Reward callback
  const claimChestReward = useCallback(() => {
    if (!chestReward) return;
    const sim = simRef.current;

    // Apply chest gold
    sim.gold += chestReward.gold;
    setRunGold(sim.gold);

    if (chestReward.type === 'ITEM' && chestReward.item) {
      selectUpgrade(chestReward.item);
    } else if (chestReward.type === 'STAT_BUFF') {
      if (chestReward.statName === 'maxHp') {
        sim.bonusMaxHp += 25;
        const updated = getCalculatedStats();
        sim.maxHp = updated.maxHp;
        sim.hp = sim.maxHp;
        setMaxHpDisplay(updated.maxHp);
        setCurrentHp(Math.round(sim.hp));
        spawnDamageNumber(sim.x, sim.y, '+25 MAX HP & FULL HEAL!', '#22c55e');
      } else if (chestReward.statName === 'might') {
        sim.bonusMight += 0.1;
        spawnDamageNumber(sim.x, sim.y, '+10% TITAN DAMAGE!', '#f59e0b');
      } else if (chestReward.statName === 'speed') {
        sim.bonusSpeed += 0.08;
        sim.bonusStamina += 20;
        const updated = getCalculatedStats();
        sim.speed = updated.speed;
        sim.maxStamina = updated.maxStamina;
        setMaxStaminaDisplay(updated.maxStamina);
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
      setCurrentHp(Math.round(sim.hp));
      gameAudio.playPowerupChime();
      spawnParticles(sim.x, sim.y, 30, '#06b6d4', 200);
      spawnDamageNumber(sim.x, sim.y, 'DIVINE AEGIS SHIELD (12s)!', '#06b6d4');
    }

    setChestReward(null);
    gameAudio.playConfirmSelect();
  }, [chestReward, selectUpgrade, getCalculatedStats]);

  // Reroll Choices
  const handleReroll = useCallback(() => {
    if (availableRerolls <= 0) {
      gameAudio.playErrorBuzz();
      return;
    }
    gameAudio.playCrispClick();
    setAvailableRerolls((prev) => prev - 1);
    const newChoices = generateDraftChoices();
    setLevelUpChoices(newChoices);
    setSelectedChoiceIndex(0);
  }, [availableRerolls, generateDraftChoices]);

  // --- Dynamic Weapon / Passive Selling System ---
  const sellItem = useCallback(
    (itemId: string) => {
      const sim = simRef.current;
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
        setEquippedWeapons([...sim.weapons]);
      } else {
        sim.passives = sim.passives.filter((p) => p.id !== itemId);
        setEquippedPassives([...sim.passives]);
      }

      sim.gold += refundGold;
      setRunGold(sim.gold);
      gameAudio.playCoinPickup();

      const updated = getCalculatedStats();
      sim.maxHp = updated.maxHp;
      sim.maxStamina = updated.maxStamina;
      sim.speed = updated.speed;
      setMaxHpDisplay(updated.maxHp);
      setMaxStaminaDisplay(updated.maxStamina);

      if (isLevelUpOpen) {
        setLevelUpChoices(generateDraftChoices());
      }
    },
    [getCalculatedStats, isLevelUpOpen, generateDraftChoices],
  );

  // --- Sanctum Shop Upgrade Buy ---
  const buyMetaUpgrade = (upgradeId: string) => {
    const upgrade = META_UPGRADES[upgradeId];
    const currentLvl = metaLevels[upgradeId] || 0;
    if (currentLvl >= upgrade.maxLevel) return;

    const cost = upgrade.costBase + currentLvl * upgrade.costStep;
    const currentSavedGold = getStoredGold();
    if (currentSavedGold < cost) {
      gameAudio.playErrorBuzz();
      return;
    }

    const newGold = currentSavedGold - cost;
    const newMeta = {...metaLevels, [upgradeId]: currentLvl + 1};
    savePersistentData(newGold, newMeta);
    gameAudio.playConfirmSelect();
  };

  // --- Pause Menu Action Execution ---
  const triggerPauseMenuAction = useCallback(
    (actionIdx: number) => {
      switch (actionIdx) {
        case 0: // Resume Battle
          setIsGameMenuOpen(false);
          gameAudio.playCrispClick();
          break;
        case 1: // Manage & Sell Arsenal
          openInventory();
          break;
        case 2: // Music Toggle
          setMusicMuted((prev) => !prev);
          gameAudio.playCrispClick();
          break;
        case 3: // SFX Toggle
          setSfxMuted(gameAudio.toggleMute());
          break;
        case 4: // Controls & Combat Guide
          setIsHowToPlayOpen(true);
          gameAudio.playCrispClick();
          break;
        case 5: // Restart Run
          setIsGameMenuOpen(false);
          initGame();
          break;
        case 6: // Quit to Main Menu (Bank Gold)
          setIsGameMenuOpen(false);
          bankRunGold(simRef.current.gold);
          refreshPersistentGold();
          setGameState((prev) => ({...prev, status: 'START'}));
          gameAudio.playCrispClick();
          break;
      }
    },
    [openInventory, initGame, bankRunGold, refreshPersistentGold],
  );

  // --- Particles & VFX Spawn Helpers ---
  const spawnDamageNumber = (x: number, y: number, text: string, color = '#facc15') => {
    const sim = simRef.current;
    sim.damageNumbers.push({
      id: sim.nextDmgId++,
      x: x + (Math.random() * 20 - 10),
      y: y + (Math.random() * 10 - 5),
      text,
      color,
      life: 0.65,
      maxLife: 0.65,
    });
  };

  const spawnParticles = (x: number, y: number, count = 8, color = '#e11d48', speed = 120) => {
    const sim = simRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.8);
      sim.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
      });
    }
  };

  // Apply Status Effects Helper
  const applyEnemyPoison = (enemy: EnemyEntity, dps: number, duration = 3.5) => {
    enemy.poisonTimer = Math.max(enemy.poisonTimer, duration);
    enemy.poisonDps = Math.max(enemy.poisonDps, dps);
  };

  const applyEnemySlow = (enemy: EnemyEntity, factor = 0.5, duration = 3.0) => {
    enemy.slowTimer = Math.max(enemy.slowTimer, duration);
    enemy.slowFactor = Math.max(enemy.slowFactor, factor);
  };

  // --- Main Simulation Update Loop ---
  const update = (dt: number) => {
    // 0. Gamepad API Polling (Movement, Sprint, Menus, Pause)
    const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const gp = gamepads[0] || gamepads[1] || null;

    let gpX = 0;
    let gpY = 0;
    let gpSprint = false;
    let gpConfirm = false;
    let gpCancel = false;
    let gpReroll = false;
    let gpPause = false;
    let gpNavUp = false;
    let gpNavDown = false;
    let gpNavLeft = false;
    let gpNavRight = false;

    if (gp) {
      const deadzone = 0.25;
      const stickX = gp.axes[0] || 0;
      const stickY = gp.axes[1] || 0;
      if (Math.abs(stickX) > deadzone) gpX = stickX;
      if (Math.abs(stickY) > deadzone) gpY = stickY;

      // D-pad movement
      if (gp.buttons[14]?.pressed) gpX = -1; // D-pad Left
      if (gp.buttons[15]?.pressed) gpX = 1; // D-pad Right
      if (gp.buttons[12]?.pressed) gpY = -1; // D-pad Up
      if (gp.buttons[13]?.pressed) gpY = 1; // D-pad Down

      // Buttons
      gpConfirm = gp.buttons[0]?.pressed || false; // Button A / Cross
      gpCancel = gp.buttons[1]?.pressed || false; // Button B / Circle
      gpSprint =
        gp.buttons[1]?.pressed ||
        gp.buttons[2]?.pressed ||
        gp.buttons[6]?.pressed ||
        gp.buttons[7]?.pressed ||
        gp.buttons[5]?.pressed ||
        false; // B, X, LT, RT, RB
      gpReroll = gp.buttons[3]?.pressed || false; // Y / Triangle

      // Gamepad Pause trigger: ONLY Option / Start / Menu button (button 9)
      gpPause = Boolean(gp.buttons[9]?.pressed);

      if (gpY < -0.45 || gp.buttons[12]?.pressed) gpNavUp = true;
      if (gpY > 0.45 || gp.buttons[13]?.pressed) gpNavDown = true;
      if (gpX < -0.45 || gp.buttons[14]?.pressed || gp.buttons[4]?.pressed) gpNavLeft = true;
      if (gpX > 0.45 || gp.buttons[15]?.pressed || gp.buttons[5]?.pressed) gpNavRight = true;
    }

    if (gamepadNavCooldownRef.current > 0) {
      gamepadNavCooldownRef.current -= dt;
    }

    // Gamepad Pause button toggle with edge-detection
    if (gpPause && !lastGamepadPauseBtnRef.current && gamepadNavCooldownRef.current <= 0) {
      if (gameStateRef.current.status === 'PLAYING') {
        setIsGameMenuOpen((prev) => !prev);
        gameAudio.playCrispClick();
        gamepadNavCooldownRef.current = 0.35;
      }
    }
    lastGamepadPauseBtnRef.current = gpPause;

    // START MENU / CHARACTER SELECT GAMEPAD NAVIGATION
    if (gameStateRef.current.status === 'START') {
      if (isHowToPlayOpen) {
        if (gamepadNavCooldownRef.current <= 0 && (gpCancel || gpConfirm)) {
          setIsHowToPlayOpen(false);
          gamepadNavCooldownRef.current = 0.3;
          gameAudio.playCrispClick();
        }
        return;
      }

      if (isSanctumOpen) {
        const metaList = Object.values(META_UPGRADES);
        const totalItems = metaList.length + 1; // Upgrades + Close button
        if (gamepadNavCooldownRef.current <= 0) {
          if (gpNavUp) {
            const next = sanctumFocusIndexRef.current > 0 ? sanctumFocusIndexRef.current - 1 : totalItems - 1;
            sanctumFocusIndexRef.current = next;
            setSanctumFocusIndex(next);
            gamepadNavCooldownRef.current = 0.22;
            gameAudio.playCrispClick();
          } else if (gpNavDown) {
            const next = sanctumFocusIndexRef.current < totalItems - 1 ? sanctumFocusIndexRef.current + 1 : 0;
            sanctumFocusIndexRef.current = next;
            setSanctumFocusIndex(next);
            gamepadNavCooldownRef.current = 0.22;
            gameAudio.playCrispClick();
          } else if (gpConfirm) {
            const curIdx = sanctumFocusIndexRef.current;
            if (curIdx < metaList.length) {
              buyMetaUpgrade(metaList[curIdx].id);
            } else {
              setIsSanctumOpen(false);
              gameAudio.playCrispClick();
            }
            gamepadNavCooldownRef.current = 0.3;
          } else if (gpCancel || gp?.buttons[3]?.pressed) {
            setIsSanctumOpen(false);
            gamepadNavCooldownRef.current = 0.35;
            gameAudio.playCrispClick();
          }
        }
        return;
      }

      if (gamepadNavCooldownRef.current <= 0) {
        if (gpNavLeft) {
          setSelectedHeroIndex((prev) => (prev > 0 ? prev - 1 : HEROES.length - 1));
          gamepadNavCooldownRef.current = 0.22;
          gameAudio.playCrispClick();
        } else if (gpNavRight) {
          setSelectedHeroIndex((prev) => (prev < HEROES.length - 1 ? prev + 1 : 0));
          gamepadNavCooldownRef.current = 0.22;
          gameAudio.playCrispClick();
        } else if (gpConfirm) {
          initGame();
          gamepadNavCooldownRef.current = 0.4;
        } else if (gp?.buttons[2]?.pressed || gp?.buttons[3]?.pressed) {
          openSanctumShop();
          gamepadNavCooldownRef.current = 0.35;
        }
      }
      return;
    }

    // GAME OVER / VICTORY GAMEPAD NAVIGATION
    if (gameStateRef.current.status === 'GAME_OVER' || gameStateRef.current.status === 'VICTORY') {
      if (gamepadNavCooldownRef.current <= 0) {
        if (gpNavUp || gpNavLeft) {
          setEndScreenFocusIndex(0);
          gamepadNavCooldownRef.current = 0.22;
          gameAudio.playCrispClick();
        } else if (gpNavDown || gpNavRight) {
          setEndScreenFocusIndex(1);
          gamepadNavCooldownRef.current = 0.22;
          gameAudio.playCrispClick();
        } else if (gpConfirm) {
          if (endScreenFocusIndex === 0) {
            initGame();
          } else {
            refreshPersistentGold();
            setGameState((prev) => ({...prev, status: 'START'}));
            gameAudio.playCrispClick();
          }
          gamepadNavCooldownRef.current = 0.4;
        } else if (gpCancel || gp?.buttons[3]?.pressed) {
          refreshPersistentGold();
          setGameState((prev) => ({...prev, status: 'START'}));
          gamepadNavCooldownRef.current = 0.4;
          gameAudio.playCrispClick();
        }
      }
      return;
    }

    // INVENTORY / WEAPON SELLING GAMEPAD NAVIGATION
    if (isInventoryOpen) {
      const totalSellItems = equippedWeapons.length + equippedPassives.length + 1;
      if (gamepadNavCooldownRef.current <= 0) {
        if (gpNavUp) {
          const next = inventoryFocusIndexRef.current > 0 ? inventoryFocusIndexRef.current - 1 : totalSellItems - 1;
          inventoryFocusIndexRef.current = next;
          setInventoryFocusIndex(next);
          gamepadNavCooldownRef.current = 0.22;
          gameAudio.playCrispClick();
        } else if (gpNavDown) {
          const next = inventoryFocusIndexRef.current < totalSellItems - 1 ? inventoryFocusIndexRef.current + 1 : 0;
          inventoryFocusIndexRef.current = next;
          setInventoryFocusIndex(next);
          gamepadNavCooldownRef.current = 0.22;
          gameAudio.playCrispClick();
        } else if (gpConfirm) {
          const curIdx = inventoryFocusIndexRef.current;
          if (curIdx < equippedWeapons.length) {
            sellItem(equippedWeapons[curIdx].id);
            const remaining = Math.max(1, equippedWeapons.length + equippedPassives.length);
            const clamped = Math.max(0, Math.min(curIdx, remaining - 1));
            inventoryFocusIndexRef.current = clamped;
            setInventoryFocusIndex(clamped);
          } else if (curIdx < equippedWeapons.length + equippedPassives.length) {
            const pasIdx = curIdx - equippedWeapons.length;
            sellItem(equippedPassives[pasIdx].id);
            const remaining = Math.max(1, equippedWeapons.length + equippedPassives.length);
            const clamped = Math.max(0, Math.min(curIdx, remaining - 1));
            inventoryFocusIndexRef.current = clamped;
            setInventoryFocusIndex(clamped);
          } else {
            setIsInventoryOpen(false);
            gameAudio.playCrispClick();
          }
          gamepadNavCooldownRef.current = 0.3;
        } else if (gpCancel || gp?.buttons[3]?.pressed) {
          setIsInventoryOpen(false);
          gamepadNavCooldownRef.current = 0.35;
          gameAudio.playCrispClick();
        }
      }
      return;
    }

    // Pause Menu gamepad tab & menu button navigation
    if (isGameMenuOpen) {
      if (gamepadNavCooldownRef.current <= 0) {
        // Tab switching via Left / Right D-Pad or Bumpers (LB: button 4, RB: button 5)
        if (gpNavLeft || gp?.buttons[4]?.pressed) {
          setPauseTab((prev) => (prev === 'MENU' ? 'GRIMOIRE' : prev === 'GRIMOIRE' ? 'STATS' : 'MENU'));
          pauseMenuFocusIndexRef.current = 0;
          setPauseMenuFocusIndex(0);
          gamepadNavCooldownRef.current = 0.25;
          gameAudio.playCrispClick();
        } else if (gpNavRight || gp?.buttons[5]?.pressed) {
          setPauseTab((prev) => (prev === 'STATS' ? 'GRIMOIRE' : prev === 'GRIMOIRE' ? 'MENU' : 'STATS'));
          pauseMenuFocusIndexRef.current = 0;
          setPauseMenuFocusIndex(0);
          gamepadNavCooldownRef.current = 0.25;
          gameAudio.playCrispClick();
        } else if (gp?.buttons[3]?.pressed) {
          // Button Y opens sell screen directly from pause menu!
          openInventory();
          gamepadNavCooldownRef.current = 0.35;
        } else if (gpCancel) {
          setIsGameMenuOpen(false);
          gamepadNavCooldownRef.current = 0.35;
          gameAudio.playCrispClick();
        } else if (pauseTab === 'MENU') {
          const totalMenuButtons = 7;
          if (gpNavUp) {
            const next = pauseMenuFocusIndexRef.current > 0 ? pauseMenuFocusIndexRef.current - 1 : totalMenuButtons - 1;
            pauseMenuFocusIndexRef.current = next;
            setPauseMenuFocusIndex(next);
            gamepadNavCooldownRef.current = 0.22;
            gameAudio.playCrispClick();
          } else if (gpNavDown) {
            const next = pauseMenuFocusIndexRef.current < totalMenuButtons - 1 ? pauseMenuFocusIndexRef.current + 1 : 0;
            pauseMenuFocusIndexRef.current = next;
            setPauseMenuFocusIndex(next);
            gamepadNavCooldownRef.current = 0.22;
            gameAudio.playCrispClick();
          } else if (gpConfirm) {
            triggerPauseMenuAction(pauseMenuFocusIndexRef.current);
            gamepadNavCooldownRef.current = 0.35;
          }
        } else if (pauseTab === 'STATS' && gpConfirm) {
          // If in Stats tab and player presses Confirm, open Manage & Sell Arsenal!
          openInventory();
          gamepadNavCooldownRef.current = 0.35;
        }
      }
      return;
    }

    // Modal navigation handling via Gamepad & Keyboard
    if (isLevelUpOpen && levelUpChoices.length > 0) {
      if (gamepadNavCooldownRef.current <= 0) {
        if (gpNavUp) {
          setSelectedChoiceIndex((prev) => (prev > 0 ? prev - 1 : levelUpChoices.length - 1));
          gamepadNavCooldownRef.current = 0.25;
          gameAudio.playCrispClick();
        } else if (gpNavDown) {
          setSelectedChoiceIndex((prev) => (prev < levelUpChoices.length - 1 ? prev + 1 : 0));
          gamepadNavCooldownRef.current = 0.25;
          gameAudio.playCrispClick();
        } else if (gpConfirm) {
          selectUpgrade(levelUpChoices[selectedChoiceIndex]);
          gamepadNavCooldownRef.current = 0.35;
        } else if (gpReroll && availableRerolls > 0) {
          handleReroll();
          gamepadNavCooldownRef.current = 0.35;
        }
      }
      return;
    }

    if (chestReward) {
      if (gamepadNavCooldownRef.current <= 0 && (gpConfirm || gp?.buttons[0]?.pressed)) {
        claimChestReward();
        gamepadNavCooldownRef.current = 0.35;
      }
      return;
    }

    if (
      gameStateRef.current.status !== 'PLAYING' ||
      isInventoryOpen ||
      isGameMenuOpen ||
      isHowToPlayOpen
    ) {
      return;
    }

    // Button Y in Active Gameplay opens Inventory / Sell Screen
    if (gp?.buttons[3]?.pressed && gamepadNavCooldownRef.current <= 0) {
      openInventory();
      gamepadNavCooldownRef.current = 0.35;
      return;
    }

    const sim = simRef.current;
    const input = inputRef.current;
    const stats = getCalculatedStats();

    sim.runTimer += dt;
    sim.auraVisualAngle += dt * 3;

    // 1. Sprint & Stamina Mechanics
    const isSprintInput = keyboardSprintRef.current || gpSprint || touchJoystickRef.current.sprintTouch;
    const isMovingInput =
      input.actions.left ||
      input.actions.right ||
      input.actions.up ||
      input.actions.down ||
      touchJoystickRef.current.active ||
      Math.abs(gpX) > 0.1 ||
      Math.abs(gpY) > 0.1;

    let speedMultiplier = 1.0;
    if (isSprintInput && isMovingInput && sim.stamina > 5) {
      sim.isSprinting = true;
      speedMultiplier = 1.6; // 60% speed boost while sprinting
      sim.stamina = Math.max(0, sim.stamina - 35 * dt);

      // Spawn sprint ghost particles
      sim.sprintParticlesTimer += dt;
      if (sim.sprintParticlesTimer >= 0.06) {
        sim.sprintParticlesTimer = 0;
        sim.particles.push({
          x: sim.x + (Math.random() * 10 - 5),
          y: sim.y + (Math.random() * 10 - 5),
          vx: -sim.vx * 0.2,
          vy: -sim.vy * 0.2,
          life: 0.25,
          maxLife: 0.25,
          size: 6,
          color: sim.hero.color,
          alpha: 0.6,
        });
      }
    } else {
      sim.isSprinting = false;
      sim.stamina = Math.min(sim.maxStamina, sim.stamina + 25 * dt);
    }
    setCurrentStamina(Math.round(sim.stamina));

    // 2. Player Movement (Keyboard + Touch Virtual Joystick + Gamepad)
    let moveX = 0;
    let moveY = 0;

    if (input.actions.left) moveX -= 1;
    if (input.actions.right) moveX += 1;
    if (input.actions.up) moveY -= 1;
    if (input.actions.down) moveY += 1;

    if (touchJoystickRef.current.active) {
      moveX += touchJoystickRef.current.dx;
      moveY += touchJoystickRef.current.dy;
    }

    if (Math.abs(gpX) > 0.1 || Math.abs(gpY) > 0.1) {
      moveX += gpX;
      moveY += gpY;
    }

    const moveMag = Math.hypot(moveX, moveY);
    if (moveMag > 0.1) {
      const normX = moveX / Math.max(1, moveMag);
      const normY = moveY / Math.max(1, moveMag);
      const currentSpeed = stats.speed * speedMultiplier;
      sim.vx = normX * currentSpeed;
      sim.vy = normY * currentSpeed;
      sim.facingLeft = normX < 0;

      if (sim.heroAnim.currentAction !== 'RUN') {
        sim.heroAnim = {currentAction: 'RUN', currentFrame: 0, timer: 0};
      }
    } else {
      sim.vx = 0;
      sim.vy = 0;
      if (sim.heroAnim.currentAction !== 'IDLE' && sim.heroAnim.currentAction !== 'HURT') {
        sim.heroAnim = {currentAction: 'IDLE', currentFrame: 0, timer: 0};
      }
    }

    sim.x += sim.vx * dt;
    sim.y += sim.vy * dt;

    // Arena Soft Clamping (-2500 to 2500)
    sim.x = clamp(sim.x, -2500, 2500);
    sim.y = clamp(sim.y, -2500, 2500);

    // Camera Lerp
    sim.camera.x += (sim.x - sim.camera.x) * 8 * dt;
    sim.camera.y += (sim.y - sim.camera.y) * 8 * dt;

    // Invulnerability timer, Aegis Shield decay & Screen Shake decay
    if (sim.invulnTimer > 0) sim.invulnTimer -= dt;
    if (sim.aegisShieldTimer > 0) {
      sim.aegisShieldTimer -= dt;
      if (Math.random() < 0.3) {
        spawnParticles(sim.x, sim.y, 2, '#06b6d4', 90);
      }
    }
    if (sim.screenShake > 0) sim.screenShake = Math.max(0, sim.screenShake - dt * 30);

    // Passive Regen & Elixir of Vitality Rapid Regen
    let currentRegenRate = stats.baseRegen || 0;
    if (sim.rapidRegenTimer && sim.rapidRegenTimer > 0) {
      sim.rapidRegenTimer -= dt;
      currentRegenRate += 25; // Rapid 25 HP/s healing
      if (Math.random() < 0.2) {
        spawnParticles(sim.x, sim.y, 2, '#22c55e', 80);
      }
    }

    if (currentRegenRate > 0) {
      sim.hp = Math.min(sim.maxHp, sim.hp + currentRegenRate * dt);
      setCurrentHp(Math.round(sim.hp));
    }

    // Permafrost Sigil Passive Area Aura (Slows nearby enemies by 35%)
    if (stats.frostAmuletLevel > 0) {
      const frostRadius = 180 + stats.frostAmuletLevel * 25;
      sim.enemies.forEach((enemy) => {
        const dist = Math.hypot(enemy.x - sim.x, enemy.y - sim.y);
        if (dist <= frostRadius) {
          applyEnemySlow(enemy, 0.35 + stats.frostAmuletLevel * 0.05, 0.5);
        }
      });
    }

    // Advance Hero Sprite Animation
    const heroSpriteKey = sim.hero.spriteKey || 'hero_spellblade';
    const heroRenderer = spriteRenderersRef.current?.[heroSpriteKey];
    if (heroRenderer) {
      sim.heroAnim = heroRenderer.getNextState(sim.heroAnim, dt);
    }

    // 3. Weapon Auto-Casting Systems
    sim.weapons.forEach((wep) => {
      const def = ITEM_DEFS[wep.id];
      if (!def) return;

      const timerKey = wep.id;
      sim.weaponTimers[timerKey] = (sim.weaponTimers[timerKey] || 0) + dt;

      const baseCd = def.cooldown || 1.0;
      const actualCd = baseCd * (1 - stats.cdr);

      // --- Magic Missile & Chrono Missiles ---
      if (wep.id === 'magic_missile' || wep.id === 'chrono_missiles') {
        if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
          sim.weaponTimers[timerKey] = 0;
          gameAudio.playArcadeLaser();

          const count = wep.id === 'chrono_missiles' ? 5 : 1 + Math.floor(wep.level / 2);
          const dmg = (def.baseDamage || 20) * stats.mightMult * (1 + (wep.level - 1) * 0.2);

          const sorted = [...sim.enemies].sort(
            (a, b) => Math.hypot(a.x - sim.x, a.y - sim.y) - Math.hypot(b.x - sim.x, b.y - sim.y),
          );

          for (let i = 0; i < count; i++) {
            const target = sorted[i % sorted.length];
            if (!target) break;

            const angle = Math.atan2(target.y - sim.y, target.x - sim.x) + (Math.random() * 0.4 - 0.2);
            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'missile',
              sourceWeapon: wep.id,
              x: sim.x,
              y: sim.y,
              vx: Math.cos(angle) * 500,
              vy: Math.sin(angle) * 500,
              damage: dmg,
              radius: 12 * stats.areaMult,
              duration: 2.5,
              maxDuration: 2.5,
              pierce: wep.id === 'chrono_missiles' ? 4 : 1,
              hitList: [],
              color: '#38bdf8',
              inflictsPoison: stats.toxicLevel > 0 && Math.random() < 0.35,
            });
          }
        }
      }

      // --- Flame Blast & Hellfire Nova ---
      else if (wep.id === 'flame_blast' || wep.id === 'hellfire_nova') {
        if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
          sim.weaponTimers[timerKey] = 0;
          gameAudio.playArcadeLaser();

          const dmg = (def.baseDamage || 35) * stats.mightMult * (1 + (wep.level - 1) * 0.25);
          const splashRad = (wep.id === 'hellfire_nova' ? 160 : 70 + wep.level * 10) * stats.areaMult;

          const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
          const angle = Math.atan2(target.y - sim.y, target.x - sim.x);

          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'flame',
            sourceWeapon: wep.id,
            x: sim.x,
            y: sim.y,
            vx: Math.cos(angle) * 360,
            vy: Math.sin(angle) * 360,
            damage: dmg,
            radius: 16 * stats.areaMult,
            duration: 1.2,
            maxDuration: 1.2,
            pierce: 1,
            hitList: [],
            color: '#f97316',
            splashRadius: splashRad,
            inflictsPoison: stats.toxicLevel > 0 && Math.random() < 0.35,
          });
        }
      }

      // --- Thunder Strike ---
      else if (wep.id === 'thunder_strike') {
        if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
          sim.weaponTimers[timerKey] = 0;
          gameAudio.playArcadeLaser();

          const strikes = 1 + Math.floor(wep.level / 2);
          const dmg = (def.baseDamage || 50) * stats.mightMult * (1 + (wep.level - 1) * 0.3);

          for (let i = 0; i < strikes; i++) {
            const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
            if (!target) continue;

            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'thunder',
              sourceWeapon: wep.id,
              x: target.x,
              y: target.y,
              vx: 0,
              vy: 0,
              damage: dmg,
              radius: 40 * stats.areaMult,
              duration: 0.35,
              maxDuration: 0.35,
              pierce: 999,
              hitList: [],
              color: '#38bdf8',
            });
            spawnParticles(target.x, target.y, 10, '#38bdf8', 150);
          }
        }
      }

      // --- Toxic Spores (Poison DoT) ---
      else if (wep.id === 'venom_spores') {
        if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
          sim.weaponTimers[timerKey] = 0;
          gameAudio.playPotionGulp();

          const sporeCount = 2 + Math.floor(wep.level / 2);
          const dmg = (def.baseDamage || 16) * stats.mightMult * (1 + (wep.level - 1) * 0.2);

          for (let i = 0; i < sporeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 100 + Math.random() * 200;
            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'spore',
              sourceWeapon: wep.id,
              x: sim.x + Math.cos(angle) * dist,
              y: sim.y + Math.sin(angle) * dist,
              vx: 0,
              vy: 0,
              damage: dmg,
              radius: (45 + wep.level * 10) * stats.areaMult,
              duration: 3.0,
              maxDuration: 3.0,
              pierce: 999,
              hitList: [],
              color: '#22c55e',
              inflictsPoison: true,
            });
          }
        }
      }

      // --- Glacial Shards & Absolute Zero (Slow Mechanics) ---
      else if (wep.id === 'frost_shard' || wep.id === 'absolute_zero') {
        if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
          sim.weaponTimers[timerKey] = 0;
          gameAudio.playArcadeLaser();

          const count = wep.id === 'absolute_zero' ? 6 : 2 + Math.floor(wep.level / 2);
          const dmg = (def.baseDamage || 26) * stats.mightMult * (1 + (wep.level - 1) * 0.2);

          for (let i = 0; i < count; i++) {
            const angle = (i * (Math.PI * 2)) / count + (Math.random() * 0.2 - 0.1);
            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'ice',
              sourceWeapon: wep.id,
              x: sim.x,
              y: sim.y,
              vx: Math.cos(angle) * 440,
              vy: Math.sin(angle) * 440,
              damage: dmg,
              radius: (14 + wep.level * 2) * stats.areaMult,
              duration: 2.0,
              maxDuration: 2.0,
              pierce: wep.id === 'absolute_zero' ? 5 : 2,
              hitList: [],
              color: '#06b6d4',
              inflictsSlow: true,
            });
          }
        }
      }

      // --- Radiant Aura ---
      else if (wep.id === 'radiant_aura') {
        if (sim.weaponTimers[timerKey] >= actualCd) {
          sim.weaponTimers[timerKey] = 0;
          const auraRadius = (70 + wep.level * 15) * stats.areaMult;
          const dmg = (def.baseDamage || 14) * stats.mightMult * (1 + (wep.level - 1) * 0.2);

          sim.enemies.forEach((enemy) => {
            const dist = Math.hypot(enemy.x - sim.x, enemy.y - sim.y);
            if (dist <= auraRadius + enemy.size) {
              enemy.hp -= dmg;
              sim.weaponDamageDealt['radiant_aura'] = (sim.weaponDamageDealt['radiant_aura'] || 0) + dmg;
              spawnDamageNumber(enemy.x, enemy.y, Math.round(dmg).toString(), '#fde047');
              if (Math.random() < 0.2) spawnParticles(enemy.x, enemy.y, 3, '#fde047', 80);
              if (stats.toxicLevel > 0 && Math.random() < 0.3) {
                applyEnemyPoison(enemy, dmg * 0.6);
              }
            }
          });
        }
      }

      // --- Orbiting Daggers & Phantom Storm ---
      else if (wep.id === 'spinning_dagger' || wep.id === 'phantom_storm') {
        const bladeCount = wep.id === 'phantom_storm' ? 8 : 2 + wep.level;
        const existingBlades = sim.projectiles.filter((p) => p.type === 'dagger');
        if (existingBlades.length < bladeCount) {
          for (let i = existingBlades.length; i < bladeCount; i++) {
            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'dagger',
              sourceWeapon: wep.id,
              x: sim.x,
              y: sim.y,
              vx: 0,
              vy: 0,
              damage: (def.baseDamage || 18) * stats.mightMult * (1 + (wep.level - 1) * 0.2),
              radius: 14 * stats.areaMult,
              duration: 9999,
              maxDuration: 9999,
              orbitAngle: (i * (Math.PI * 2)) / bladeCount,
              orbitDist: 65 * stats.areaMult,
              pierce: 999,
              hitList: [],
              color: wep.id === 'phantom_storm' ? '#c084fc' : '#e2e8f0',
              inflictsPoison: stats.toxicLevel > 0 && Math.random() < 0.35,
            });
          }
        }
      }

      // --- FUSION 1: Arcane Phantom Vortex ---
      else if (wep.id === 'arcane_phantom_vortex') {
        const bladeCount = 8;
        const existingBlades = sim.projectiles.filter((p) => p.type === 'vortex');
        if (existingBlades.length < bladeCount) {
          for (let i = existingBlades.length; i < bladeCount; i++) {
            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'vortex',
              sourceWeapon: 'arcane_phantom_vortex',
              x: sim.x,
              y: sim.y,
              vx: 0,
              vy: 0,
              damage: (def.baseDamage || 48) * stats.mightMult,
              radius: 18 * stats.areaMult,
              duration: 9999,
              maxDuration: 9999,
              orbitAngle: (i * (Math.PI * 2)) / bladeCount,
              orbitDist: 85 * stats.areaMult,
              pierce: 999,
              hitList: [],
              color: '#38bdf8',
            });
          }
        }
        // Extra rapid homing lasers from vortex
        if (sim.weaponTimers[timerKey] >= actualCd * 3 && sim.enemies.length > 0) {
          sim.weaponTimers[timerKey] = 0;
          gameAudio.playArcadeLaser();
          const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
          const angle = Math.atan2(target.y - sim.y, target.x - sim.x);
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'missile',
            sourceWeapon: 'arcane_phantom_vortex',
            x: sim.x,
            y: sim.y,
            vx: Math.cos(angle) * 580,
            vy: Math.sin(angle) * 580,
            damage: 60 * stats.mightMult,
            radius: 14 * stats.areaMult,
            duration: 2.0,
            maxDuration: 2.0,
            pierce: 3,
            hitList: [],
            color: '#a855f7',
          });
        }
      }

      // --- FUSION 2: Cataclysmic Supernova ---
      else if (wep.id === 'cataclysmic_nova') {
        if (sim.weaponTimers[timerKey] >= actualCd && sim.enemies.length > 0) {
          sim.weaponTimers[timerKey] = 0;
          gameAudio.playChiptuneExplosion();
          sim.screenShake = 12;

          for (let k = 0; k < 3; k++) {
            const target = sim.enemies[Math.floor(Math.random() * sim.enemies.length)];
            if (!target) continue;

            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'flame',
              sourceWeapon: 'cataclysmic_nova',
              x: target.x + (Math.random() * 80 - 40),
              y: target.y + (Math.random() * 80 - 40),
              vx: 0,
              vy: 0,
              damage: 110 * stats.mightMult,
              radius: 40 * stats.areaMult,
              duration: 0.8,
              maxDuration: 0.8,
              pierce: 999,
              hitList: [],
              color: '#ef4444',
              splashRadius: 180 * stats.areaMult,
            });

            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'thunder',
              sourceWeapon: 'cataclysmic_nova',
              x: target.x,
              y: target.y,
              vx: 0,
              vy: 0,
              damage: 90 * stats.mightMult,
              radius: 50 * stats.areaMult,
              duration: 0.4,
              maxDuration: 0.4,
              pierce: 999,
              hitList: [],
              color: '#facc15',
            });
          }
        }
      }

      // --- FUSION 3: Plague Sanctuary ---
      else if (wep.id === 'toxic_sanctuary') {
        if (sim.weaponTimers[timerKey] >= actualCd) {
          sim.weaponTimers[timerKey] = 0;
          const sanctuaryRadius = 160 * stats.areaMult;
          const dmg = (def.baseDamage || 38) * stats.mightMult;

          sim.enemies.forEach((enemy) => {
            const dist = Math.hypot(enemy.x - sim.x, enemy.y - sim.y);
            if (dist <= sanctuaryRadius + enemy.size) {
              enemy.hp -= dmg;
              sim.weaponDamageDealt['toxic_sanctuary'] = (sim.weaponDamageDealt['toxic_sanctuary'] || 0) + dmg;
              applyEnemyPoison(enemy, dmg * 0.8, 4.0);
              applyEnemySlow(enemy, 0.5, 2.0);
              spawnDamageNumber(enemy.x, enemy.y, Math.round(dmg).toString(), '#4ade80');
              if (Math.random() < 0.25) spawnParticles(enemy.x, enemy.y, 4, '#22c55e', 90);
            }
          });
        }
      }
    });

    // 4. Update Projectiles
    for (let i = sim.projectiles.length - 1; i >= 0; i--) {
      const proj = sim.projectiles[i];
      proj.duration -= dt;

      if (
        (proj.type === 'dagger' || proj.type === 'vortex') &&
        proj.orbitAngle !== undefined &&
        proj.orbitDist !== undefined
      ) {
        const spinSpeed = proj.type === 'vortex' ? 5.0 : 3.5;
        proj.orbitAngle += spinSpeed * dt;
        proj.x = sim.x + Math.cos(proj.orbitAngle) * proj.orbitDist;
        proj.y = sim.y + Math.sin(proj.orbitAngle) * proj.orbitDist;

        // Collision with enemies
        sim.enemies.forEach((enemy) => {
          if (!proj.hitList.includes(enemy.id)) {
            const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
            if (dist < proj.radius + enemy.size) {
              enemy.hp -= proj.damage;
              proj.hitList.push(enemy.id);
              if (proj.sourceWeapon) {
                sim.weaponDamageDealt[proj.sourceWeapon] = (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
              }
              gameAudio.playSwordClash();
              spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage).toString(), proj.color);
              spawnParticles(proj.x, proj.y, 4, proj.color, 90);

              if (proj.inflictsPoison) applyEnemyPoison(enemy, proj.damage * 0.5);

              setTimeout(() => {
                proj.hitList = proj.hitList.filter((id) => id !== enemy.id);
              }, 350);
            }
          }
        });
      } else if (proj.type === 'spore') {
        // Lingering toxic cloud field
        sim.enemies.forEach((enemy) => {
          const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
          if (dist <= proj.radius + enemy.size) {
            applyEnemyPoison(enemy, proj.damage * 0.7, 3.5);
            if (Math.random() < 0.1) {
              enemy.hp -= proj.damage * dt;
              if (proj.sourceWeapon) {
                sim.weaponDamageDealt[proj.sourceWeapon] = (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage * dt;
              }
            }
          }
        });
      } else if (proj.type === 'thunder') {
        if (proj.duration >= proj.maxDuration - dt * 1.5) {
          sim.enemies.forEach((enemy) => {
            const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
            if (dist <= proj.radius + enemy.size) {
              enemy.hp -= proj.damage;
              if (proj.sourceWeapon) {
                sim.weaponDamageDealt[proj.sourceWeapon] = (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
              }
              spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage).toString(), '#38bdf8');
            }
          });
        }
      } else {
        // Linear / Homing Projectiles
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;

        if (proj.isEnemy) {
          const dist = Math.hypot(sim.x - proj.x, sim.y - proj.y);
          if (dist < proj.radius + 20 && sim.invulnTimer <= 0 && sim.aegisShieldTimer <= 0) {
            sim.hp -= proj.damage;
            sim.invulnTimer = 0.5;
            sim.screenShake = 12;
            gameAudio.playMeleePunch();
            spawnDamageNumber(sim.x, sim.y, `-${Math.round(proj.damage)}`, '#ef4444');
            setCurrentHp(Math.max(0, Math.round(sim.hp)));
            proj.duration = 0;
          }
        } else {
          for (let e = 0; e < sim.enemies.length; e++) {
            const enemy = sim.enemies[e];
            if (proj.hitList.includes(enemy.id)) continue;

            const dist = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
            if (dist < proj.radius + enemy.size) {
              proj.hitList.push(enemy.id);
              enemy.hp -= proj.damage;
              if (proj.sourceWeapon) {
                sim.weaponDamageDealt[proj.sourceWeapon] = (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage;
              }
              spawnDamageNumber(enemy.x, enemy.y, Math.round(proj.damage).toString(), proj.color);
              spawnParticles(proj.x, proj.y, 5, proj.color, 100);

              if (proj.inflictsPoison) applyEnemyPoison(enemy, proj.damage * 0.5);
              if (proj.inflictsSlow) applyEnemySlow(enemy, 0.5, 3.0);

              if (proj.type === 'flame' && proj.splashRadius) {
                gameAudio.playChiptuneExplosion();
                sim.screenShake = 6;
                sim.enemies.forEach((other) => {
                  if (other.id !== enemy.id) {
                    const splashDist = Math.hypot(other.x - proj.x, other.y - proj.y);
                    if (splashDist <= proj.splashRadius! + other.size) {
                      other.hp -= proj.damage * 0.7;
                      if (proj.sourceWeapon) {
                        sim.weaponDamageDealt[proj.sourceWeapon] = (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + proj.damage * 0.7;
                      }
                      spawnDamageNumber(other.x, other.y, Math.round(proj.damage * 0.7).toString(), '#ea580c');
                      if (proj.inflictsPoison) applyEnemyPoison(other, proj.damage * 0.4);
                    }
                  }
                });
                proj.duration = 0;
                break;
              }

              proj.pierce -= 1;
              if (proj.pierce <= 0) {
                proj.duration = 0;
                break;
              }
            }
          }
        }
      }

      if (proj.duration <= 0) {
        sim.projectiles.splice(i, 1);
      }
    }

    // 5. Enemy Spawning & Waves
    const baseSpawnRate = (getConfig('enemySpawnRate') as number) || 1.2;
    const maxEnemiesLimit = (getConfig('maxEnemies') as number) || 250;
    const bossSpawnTime = (getConfig('bossSpawnTimeSeconds') as number) || 300;

    sim.spawnTimer += dt * baseSpawnRate * (1 + sim.runTimer / 180);

    if (sim.runTimer >= bossSpawnTime && !sim.bossSpawned) {
      sim.bossSpawned = true;
      const angle = Math.random() * Math.PI * 2;
      sim.enemies.push({
        id: sim.nextEnemyId++,
        type: 'titan',
        x: sim.x + Math.cos(angle) * 600,
        y: sim.y + Math.sin(angle) * 600,
        vx: 0,
        vy: 0,
        hp: 3500,
        maxHp: 3500,
        speed: 90,
        damage: 30,
        size: 55,
        isElite: true,
        isBoss: true,
        color: '#dc2626',
        animState: {currentAction: 'RUN', currentFrame: 0, timer: 0},
        facingLeft: false,
        shootTimer: 0,
        specialTimer: 0,
        poisonTimer: 0,
        poisonDps: 0,
        poisonTickTimer: 0,
        slowTimer: 0,
        slowFactor: 0,
      });
      gameAudio.playPowerupChime();
    }

    if (sim.spawnTimer >= 1.0 && sim.enemies.length < maxEnemiesLimit) {
      sim.spawnTimer = 0;
      const spawnCount = 2 + Math.floor(sim.runTimer / 30);

      for (let s = 0; s < spawnCount; s++) {
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = 450 + Math.random() * 200;
        const ex = sim.x + Math.cos(angle) * spawnDist;
        const ey = sim.y + Math.sin(angle) * spawnDist;

        const roll = Math.random();
        let type: EnemyEntity['type'] = 'skeleton';
        let hp = 30 + (sim.runTimer / 10) * 8;
        let speed = 100 + Math.random() * 20;
        let damage = 10;
        let size = 22;
        let isElite = false;
        let color = '#94a3b8';

        if (roll < 0.15 && sim.runTimer > 40) {
          type = 'hound';
          hp *= 1.4;
          speed = 175;
          damage = 14;
          size = 24;
          color = '#8b5cf6';
        } else if (roll < 0.35 && sim.runTimer > 20) {
          type = 'bat';
          hp *= 0.8;
          speed = 150;
          damage = 8;
          size = 20;
          color = '#ec4899';
        } else if (roll < 0.45 && sim.runTimer > 60) {
          type = 'sorcerer';
          hp *= 1.8;
          speed = 70;
          damage = 18;
          size = 26;
          color = '#6366f1';
        }

        if (Math.random() < 0.05 && sim.runTimer > 30) {
          isElite = true;
          hp *= 3.5;
          damage *= 1.5;
          size *= 1.3;
          color = '#f59e0b';
        }

        sim.enemies.push({
          id: sim.nextEnemyId++,
          type,
          x: ex,
          y: ey,
          vx: 0,
          vy: 0,
          hp,
          maxHp: hp,
          speed,
          damage,
          size,
          isElite,
          isBoss: false,
          color,
          animState: {currentAction: 'RUN', currentFrame: 0, timer: 0},
          facingLeft: false,
          shootTimer: 0,
          specialTimer: 0,
          poisonTimer: 0,
          poisonDps: 0,
          poisonTickTimer: 0,
          slowTimer: 0,
          slowFactor: 0,
        });
      }
    }

    // 6. Update Enemies, AI & Status Effects (Poison DoT & Slow)
    for (let i = sim.enemies.length - 1; i >= 0; i--) {
      const enemy = sim.enemies[i];

      // Update Poison DoT
      if (enemy.poisonTimer > 0) {
        enemy.poisonTimer -= dt;
        enemy.poisonTickTimer += dt;
        if (enemy.poisonTickTimer >= 0.4) {
          enemy.poisonTickTimer = 0;
          const tickDmg = Math.max(1, Math.round(enemy.poisonDps * 0.4));
          enemy.hp -= tickDmg;
          spawnDamageNumber(enemy.x, enemy.y, tickDmg.toString(), '#22c55e');
          spawnParticles(enemy.x, enemy.y, 2, '#22c55e', 40);
        }
      }

      // Update Slow Effect
      let effectiveSpeed = enemy.speed;
      if (enemy.slowTimer > 0) {
        enemy.slowTimer -= dt;
        effectiveSpeed *= Math.max(0.2, 1 - enemy.slowFactor);
      }

      // Death Check
      if (enemy.hp <= 0) {
        sim.kills += 1;
        setKillCount(sim.kills);
        setGameState((prev) => ({...prev, score: prev.score + (enemy.isBoss ? 5000 : enemy.isElite ? 250 : 25)}));
        spawnParticles(enemy.x, enemy.y, enemy.isBoss ? 30 : enemy.isElite ? 15 : 6, enemy.color, 140);

        const currentWorldChests = sim.drops.filter((d) => d.type === 'chest').length;

        if (enemy.isBoss) {
          sim.bossDefeated = true;
          gameAudio.playVictoryFanfare();
          // Standardized completion bonus (+350 gold)
          const victoryBonus = 350;
          sim.gold += victoryBonus;
          setRunGold(sim.gold);
          spawnDamageNumber(sim.x, sim.y, `VICTORY BONUS +${victoryBonus}g!`, '#facc15');

          if (currentWorldChests < MAX_WORLD_CHESTS) {
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'chest',
              x: enemy.x,
              y: enemy.y,
              value: 100,
              attracted: false,
            });
          } else {
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'xp_purple',
              x: enemy.x,
              y: enemy.y,
              value: 150,
              attracted: false,
            });
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'potion',
              x: enemy.x + 20,
              y: enemy.y,
              value: Math.round(sim.maxHp * 0.5),
              attracted: false,
            });
          }
          bankRunGold(sim.gold);
          setEndScreenFocusIndex(0);
          setGameState((prev) => ({...prev, status: 'VICTORY'}));
        } else if (enemy.isElite) {
          gameAudio.playConfirmSelect();
          if (currentWorldChests < MAX_WORLD_CHESTS) {
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'chest',
              x: enemy.x,
              y: enemy.y,
              value: 80,
              attracted: false,
            });
          } else {
            // Chest capacity reached (max 4): spawn high-tier EXP Diamond, Health Crystal, and elite Gold cluster instead
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'xp_purple',
              x: enemy.x - 15,
              y: enemy.y,
              value: 60,
              attracted: false,
            });
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'gold',
              x: enemy.x,
              y: enemy.y,
              value: Math.round((20 + Math.floor(Math.random() * 10)) * stats.greedMult),
              attracted: false,
            });
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'potion',
              x: enemy.x + 15,
              y: enemy.y,
              value: Math.round(sim.maxHp * 0.35),
              attracted: false,
            });
          }
        } else {
          // Standard enemy drops: 1-3 gold
          const dropRoll = Math.random();
          if (dropRoll < 0.7) {
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'xp_blue',
              x: enemy.x,
              y: enemy.y,
              value: 10,
              attracted: false,
            });
          } else if (dropRoll < 0.85) {
            const coinVal = 1 + Math.floor(Math.random() * 3);
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'gold',
              x: enemy.x,
              y: enemy.y,
              value: Math.round(coinVal * stats.greedMult),
              attracted: false,
            });
          } else if (dropRoll < 0.9) {
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'potion',
              x: enemy.x,
              y: enemy.y,
              value: Math.round(sim.maxHp * 0.3),
              attracted: false,
            });
          } else if (dropRoll < 0.93) {
            sim.drops.push({
              id: sim.nextDropId++,
              type: 'magnet',
              x: enemy.x,
              y: enemy.y,
              value: 1,
              attracted: false,
            });
          }
        }

        sim.enemies.splice(i, 1);
        continue;
      }

      // Move toward player with effective speed
      const dx = sim.x - enemy.x;
      const dy = sim.y - enemy.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 1) {
        const nx = dx / dist;
        const ny = dy / dist;
        enemy.vx = nx * effectiveSpeed;
        enemy.vy = ny * effectiveSpeed;
        enemy.facingLeft = nx < 0;
      }

      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Enemy Ranged Attacks
      if (enemy.type === 'sorcerer') {
        enemy.shootTimer = (enemy.shootTimer || 0) + dt;
        if (enemy.shootTimer >= 3.0 && dist < 450) {
          enemy.shootTimer = 0;
          const orbAngle = Math.atan2(dy, dx);
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'sorcerer_orb',
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(orbAngle) * 180,
            vy: Math.sin(orbAngle) * 180,
            damage: 15,
            radius: 12,
            duration: 3.5,
            maxDuration: 3.5,
            isEnemy: true,
            pierce: 1,
            hitList: [],
            color: '#a855f7',
          });
        }
      } else if (enemy.type === 'titan') {
        enemy.shootTimer = (enemy.shootTimer || 0) + dt;
        if (enemy.shootTimer >= 4.0) {
          enemy.shootTimer = 0;
          gameAudio.playChiptuneExplosion();
          for (let b = 0; b < 8; b++) {
            const bAngle = (b * Math.PI * 2) / 8;
            sim.projectiles.push({
              id: sim.nextProjId++,
              type: 'sorcerer_orb',
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(bAngle) * 220,
              vy: Math.sin(bAngle) * 220,
              damage: 25,
              radius: 16,
              duration: 4.0,
              maxDuration: 4.0,
              isEnemy: true,
              pierce: 1,
              hitList: [],
              color: '#ef4444',
            });
          }
        }
      }

      // Player Collision (Damage with 0.5s I-frames, Aegis Shield, and armor reduction)
      if (dist < enemy.size + 18 && sim.invulnTimer <= 0 && sim.aegisShieldTimer <= 0) {
        const incomingDmg = Math.max(1, enemy.damage - stats.armor);
        sim.hp -= incomingDmg;
        sim.invulnTimer = 0.5;
        sim.screenShake = 10;
        gameAudio.playMeleePunch();
        spawnDamageNumber(sim.x, sim.y, `-${Math.round(incomingDmg)}`, '#ef4444');
        setCurrentHp(Math.max(0, Math.round(sim.hp)));

        if (sim.hp <= 0) {
          bankRunGold(sim.gold);
          setEndScreenFocusIndex(0);
          setGameState((prev) => ({...prev, status: 'GAME_OVER'}));
          return;
        }
      }

      // Enemy Sprite Animation update
      const rendererKey =
        enemy.type === 'hound'
          ? 'hound'
          : enemy.type === 'bat'
          ? 'bat'
          : enemy.type === 'titan'
          ? 'titan'
          : 'skeleton';
      const enemyRenderer = spriteRenderersRef.current?.[rendererKey];
      if (enemyRenderer) {
        enemy.animState = enemyRenderer.getNextState(enemy.animState, dt);
      }
    }

    // 7. Update Drops & Pickups
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

            const reward = generateChestReward();
            setChestReward(reward);

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
          setGameState((prev) => ({...prev, score: prev.score + drop.value * 2}));

          if (sim.xp >= sim.nextXp) {
            sim.xp -= sim.nextXp;
            sim.level += 1;
            sim.nextXp = Math.round(sim.nextXp * 1.35 + 5);
            setGameState((prev) => ({...prev, level: sim.level}));
            triggerLevelUp();
          }

          setXpDisplay(sim.xp);
          setNextLevelXpDisplay(sim.nextXp);
        } else if (drop.type === 'gold') {
          sim.gold += drop.value;
          setRunGold(sim.gold);
          gameAudio.playCoinPickup();
          spawnDamageNumber(sim.x, sim.y, `+${drop.value}g`, '#eab308');
        } else if (drop.type === 'potion') {
          sim.hp = Math.min(sim.maxHp, sim.hp + drop.value);
          setCurrentHp(Math.round(sim.hp));
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

    // 8. Update Particles & Floating Text
    for (let i = sim.particles.length - 1; i >= 0; i--) {
      const p = sim.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) sim.particles.splice(i, 1);
    }

    for (let i = sim.damageNumbers.length - 1; i >= 0; i--) {
      const dn = sim.damageNumbers[i];
      dn.life -= dt;
      dn.y -= 30 * dt;
      if (dn.life <= 0) sim.damageNumbers.splice(i, 1);
    }

    setGameState((prev) => ({...prev, timer: Math.floor(sim.runTimer)}));
  };

  // --- Render Loop (Canvas API) ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    prepareCanvas(ctx, canvasWidth, canvasHeight);

    const sim = simRef.current;
    const stats = getCalculatedStats();
    const shakeX = sim.screenShake > 0 ? (Math.random() * 2 - 1) * sim.screenShake : 0;
    const shakeY = sim.screenShake > 0 ? (Math.random() * 2 - 1) * sim.screenShake : 0;

    ctx.save();
    ctx.translate(canvasWidth / 2 - sim.camera.x + shakeX, canvasHeight / 2 - sim.camera.y + shakeY);

    // 1. Gothic Arena Grid Floor
    const bgTileSize = 120;
    const startX = Math.floor((sim.camera.x - canvasWidth / 2 - 200) / bgTileSize) * bgTileSize;
    const endX = Math.ceil((sim.camera.x + canvasWidth / 2 + 200) / bgTileSize) * bgTileSize;
    const startY = Math.floor((sim.camera.y - canvasHeight / 2 - 200) / bgTileSize) * bgTileSize;
    const endY = Math.ceil((sim.camera.y + canvasHeight / 2 + 200) / bgTileSize) * bgTileSize;

    ctx.fillStyle = '#0a0814';
    ctx.fillRect(startX, startY, endX - startX, endY - startY);

    ctx.strokeStyle = '#1a162b';
    ctx.lineWidth = 1.5;
    for (let gx = startX; gx <= endX; gx += bgTileSize) {
      ctx.beginPath();
      ctx.moveTo(gx, startY);
      ctx.lineTo(gx, endY);
      ctx.stroke();
    }
    for (let gy = startY; gy <= endY; gy += bgTileSize) {
      ctx.beginPath();
      ctx.moveTo(startX, gy);
      ctx.lineTo(endX, gy);
      ctx.stroke();
    }

    // Arena Perimeter Bounds (-2500, -2500 to 2500, 2500)
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 4;
    ctx.strokeRect(-2500, -2500, 5000, 5000);

    // 2. Render Frost Sigil Aura (if passive equipped)
    if (stats.frostAmuletLevel > 0) {
      const frostRadius = 180 + stats.frostAmuletLevel * 25;
      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sim.x, sim.y, frostRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3. Render Radiant Aura / Toxic Sanctuary Weapon
    const auraEquipped = sim.weapons.find((w) => w.id === 'radiant_aura' || w.id === 'toxic_sanctuary');
    if (auraEquipped && assets['effect_radiant_aura']) {
      const isSanctuary = auraEquipped.id === 'toxic_sanctuary';
      const auraRad = isSanctuary ? 160 * stats.areaMult : (70 + auraEquipped.level * 15) * stats.areaMult;
      const auraImg = assets['effect_radiant_aura'];
      ctx.save();
      ctx.translate(sim.x, sim.y);
      ctx.rotate(sim.auraVisualAngle * (isSanctuary ? 1.5 : 1));
      ctx.globalAlpha = isSanctuary ? 0.8 : 0.65;
      if (auraImg && auraImg.complete && auraImg.naturalWidth > 0) {
        ctx.drawImage(auraImg, -auraRad, -auraRad, auraRad * 2, auraRad * 2);
      }
      ctx.restore();
    }

    // 4. Render Drops & Pickups
    sim.drops.forEach((drop) => {
      let imgKey = 'item_xp_gem_blue';
      let size = 22;

      if (drop.type === 'xp_purple') {
        imgKey = 'item_xp_gem_purple';
        size = 28;
      } else if (drop.type === 'gold') {
        imgKey = 'item_gold_coin';
        size = 20;
      } else if (drop.type === 'potion') {
        imgKey = 'item_health_potion';
        size = 24;
      } else if (drop.type === 'magnet') {
        imgKey = 'item_magnet_rune';
        size = 26;
      } else if (drop.type === 'chest') {
        imgKey = 'item_treasure_chest';
        size = 38;

        // Chest opening progress visual
        if (drop.isOpening && drop.openingTimer) {
          const ratio = Math.min(1, drop.openingTimer / 0.45);
          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(drop.x, drop.y, 26, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
          ctx.beginPath();
          ctx.arc(drop.x, drop.y, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Subtle idle golden glow around chest
          ctx.save();
          ctx.fillStyle = 'rgba(234, 179, 8, 0.2)';
          ctx.beginPath();
          ctx.arc(drop.x, drop.y, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      drawAsset(ctx, assets[imgKey], drop.x - size / 2, drop.y - size / 2, size, size, (fCtx) => {
        fCtx.fillStyle = drop.type === 'gold' ? '#eab308' : '#38bdf8';
        fCtx.beginPath();
        fCtx.arc(drop.x, drop.y, Math.max(0, size / 2), 0, Math.PI * 2);
        fCtx.fill();
      });
    });

    // 5. Render Enemies & Status Effects (Poison & Slow visual indicators)
    sim.enemies.forEach((enemy) => {
      const rendererKey =
        enemy.type === 'hound'
          ? 'hound'
          : enemy.type === 'bat'
          ? 'bat'
          : enemy.type === 'titan'
          ? 'titan'
          : 'skeleton';
      const renderer = spriteRenderersRef.current?.[rendererKey];

      // Red / Amber pulsing aura for Elites & Bosses
      if (enemy.isElite || enemy.isBoss) {
        const pulse = 1 + Math.sin(sim.runTimer * 6) * 0.15;
        ctx.save();
        ctx.fillStyle = enemy.isBoss ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, Math.max(0, enemy.size * 1.6 * pulse), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Status Visuals: Slow (Cyan ring) & Poison (Green toxic bubbles & glowing aura)
      if (enemy.slowTimer > 0) {
        ctx.save();
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y + enemy.size * 0.4, enemy.size * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (enemy.poisonTimer > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Toxic bubbling particles
        for (let b = 0; b < 3; b++) {
          const bubbleAngle = sim.runTimer * 4 + b * 2.1;
          const bx = enemy.x + Math.cos(bubbleAngle) * enemy.size * 0.9;
          const by = enemy.y + Math.sin(bubbleAngle) * enemy.size * 0.9 - 4;
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const drawSize = enemy.isBoss ? 160 : enemy.isElite ? 80 : 54;
      if (renderer) {
        if (enemy.poisonTimer > 0) {
          ctx.save();
          try {
            ctx.filter = 'hue-rotate(85deg) saturate(280%) brightness(1.15)';
          } catch (e) {}
          renderer.draw(
            ctx,
            enemy.animState,
            enemy.x,
            enemy.y,
            drawSize,
            drawSize,
            assets,
            enemy.facingLeft,
          );
          ctx.restore();
        } else {
          renderer.draw(
            ctx,
            enemy.animState,
            enemy.x,
            enemy.y,
            drawSize,
            drawSize,
            assets,
            enemy.facingLeft,
          );
        }
      }

      // Enemy Health Bar
      if (enemy.isElite || enemy.isBoss || enemy.hp < enemy.maxHp) {
        const barW = enemy.isBoss ? 120 : 40;
        const barH = enemy.isBoss ? 8 : 4;
        const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);

        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(enemy.x - barW / 2, enemy.y - drawSize / 2 - 10, barW, barH);
        ctx.fillStyle = enemy.isBoss ? '#ef4444' : enemy.poisonTimer > 0 ? '#22c55e' : '#eab308';
        ctx.fillRect(enemy.x - barW / 2, enemy.y - drawSize / 2 - 10, barW * hpRatio, barH);
      }
    });

    // 6. Render Projectiles
    sim.projectiles.forEach((proj) => {
      if (proj.type === 'missile') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        drawAsset(
          ctx,
          assets['proj_magic_missile'],
          -proj.radius * 1.5,
          -proj.radius,
          proj.radius * 3,
          proj.radius * 2,
          (fCtx) => {
            fCtx.fillStyle = proj.color;
            fCtx.fillRect(-proj.radius, -proj.radius / 2, proj.radius * 2, proj.radius);
          },
        );
        ctx.restore();
      } else if (proj.type === 'flame') {
        drawAsset(
          ctx,
          assets['proj_flame_blast'],
          proj.x - proj.radius,
          proj.y - proj.radius,
          proj.radius * 2,
          proj.radius * 2,
          (fCtx) => {
            fCtx.fillStyle = '#f97316';
            fCtx.beginPath();
            fCtx.arc(0, 0, Math.max(0, proj.radius), 0, Math.PI * 2);
            fCtx.fill();
          },
        );
      } else if (proj.type === 'dagger' || proj.type === 'vortex') {
        const spin = (proj.orbitAngle || 0) + sim.runTimer * 10;
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(spin);
        drawAsset(
          ctx,
          assets['proj_spinning_dagger'],
          -proj.radius,
          -proj.radius,
          proj.radius * 2,
          proj.radius * 2,
          (fCtx) => {
            fCtx.fillStyle = proj.color;
            fCtx.fillRect(-proj.radius / 2, -proj.radius, proj.radius, proj.radius * 2);
          },
        );
        ctx.restore();
      } else if (proj.type === 'thunder') {
        drawAsset(
          ctx,
          assets['proj_thunder_strike'],
          proj.x - proj.radius,
          proj.y - proj.radius * 3,
          proj.radius * 2,
          proj.radius * 4,
          (fCtx) => {
            fCtx.fillStyle = proj.color;
            fCtx.fillRect(-proj.radius / 2, -proj.radius * 2, proj.radius, proj.radius * 4);
          },
        );
      } else if (proj.type === 'spore') {
        ctx.save();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (proj.type === 'ice') {
        ctx.save();
        ctx.fillStyle = '#06b6d4';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (proj.isEnemy) {
        ctx.fillStyle = proj.color;
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, Math.max(0, proj.radius), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // 7. Render Player Hero (Guaranteed full visibility in Idle and Run)
    const heroSpriteKey = sim.hero?.spriteKey || 'hero_spellblade';
    const heroRenderer = spriteRenderersRef.current?.[heroSpriteKey];

    const isBlinking = sim.invulnTimer > 0 && Math.floor(sim.invulnTimer * 20) % 2 === 0;

    // Divine Aegis Shield Aura
    if (sim.aegisShieldTimer > 0) {
      ctx.save();
      const pulse = 1 + Math.sin(sim.runTimer * 8) * 0.08;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sim.x, sim.y, 40 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (heroRenderer && !isBlinking) {
      heroRenderer.draw(
        ctx,
        sim.heroAnim,
        sim.x,
        sim.y,
        64,
        64,
        assets,
        sim.facingLeft,
      );
    }

    // 8. Render Particles & Floating Combat Text
    sim.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    sim.damageNumbers.forEach((dn) => {
      ctx.fillStyle = dn.color;
      ctx.fillText(dn.text, dn.x, dn.y);
    });

    ctx.restore();

    // 9. Screen-Edge Danger Chevrons for Off-Screen Elites & Boss
    sim.enemies.forEach((enemy) => {
      if (!enemy.isElite && !enemy.isBoss) return;

      const screenX = enemy.x - sim.camera.x + canvasWidth / 2;
      const screenY = enemy.y - sim.camera.y + canvasHeight / 2;

      if (screenX < 40 || screenX > canvasWidth - 40 || screenY < 40 || screenY > canvasHeight - 40) {
        const edgeX = clamp(screenX, 40, canvasWidth - 40);
        const edgeY = clamp(screenY, 40, canvasHeight - 40);
        const angle = Math.atan2(screenY - canvasHeight / 2, screenX - canvasWidth / 2);

        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.rotate(angle);
        ctx.fillStyle = enemy.isBoss ? '#dc2626' : '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });
  };

  // --- Game Loop Hooks ---
  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      // Pause toggle check
      if (inputRef.current) {
        const cancelPressed = inputRef.current.actions.cancel;
        if (cancelPressed && !lastCancelRef.current) {
          const currentStatus = gameStateRef.current.status;
          if (currentStatus === 'PLAYING') {
            setIsGameMenuOpen((prev) => !prev);
          } else if (currentStatus === 'START') {
            void exitChat({});
          }
        }
        lastCancelRef.current = cancelPressed;
      }

      stepperRef.current?.(time, (dt) => updateRef.current(dt));

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawRef.current(ctx);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keyboard Event Listeners for Sprint, Menu Selection [1,2,3,4], Tab / I for Inventory, S for Sanctum
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // End Screen (GAME OVER / VICTORY) Keyboard Navigation
      if (gameState.status === 'GAME_OVER' || gameState.status === 'VICTORY') {
        if (
          e.key === 'ArrowUp' ||
          e.key === 'ArrowLeft' ||
          e.key === 'w' ||
          e.key === 'W'
        ) {
          e.preventDefault();
          setEndScreenFocusIndex(0);
          gameAudio.playCrispClick();
          return;
        }
        if (
          e.key === 'ArrowDown' ||
          e.key === 'ArrowRight' ||
          e.key === 's' ||
          e.key === 'S' ||
          e.key === 'Tab'
        ) {
          e.preventDefault();
          setEndScreenFocusIndex(1);
          gameAudio.playCrispClick();
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (endScreenFocusIndex === 0) {
            initGame(selectedHeroIndex);
          } else {
            refreshPersistentGold();
            setGameState((prev) => ({...prev, status: 'START'}));
            gameAudio.playCrispClick();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          refreshPersistentGold();
          setGameState((prev) => ({...prev, status: 'START'}));
          gameAudio.playCrispClick();
          return;
        }
      }

      // Chest Reward Modal Keyboard Shortcut
      if (chestReward) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          claimChestReward();
          return;
        }
      }
      if (gameState.status === 'START') {
        if (isSanctumOpen) {
          const metaList = Object.values(META_UPGRADES);
          const totalItems = metaList.length + 1;

          if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            const next = sanctumFocusIndexRef.current > 0 ? sanctumFocusIndexRef.current - 1 : totalItems - 1;
            sanctumFocusIndexRef.current = next;
            setSanctumFocusIndex(next);
            gameAudio.playCrispClick();
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            e.preventDefault();
            const next = sanctumFocusIndexRef.current < totalItems - 1 ? sanctumFocusIndexRef.current + 1 : 0;
            sanctumFocusIndexRef.current = next;
            setSanctumFocusIndex(next);
            gameAudio.playCrispClick();
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const curIdx = sanctumFocusIndexRef.current;
            if (curIdx < metaList.length) {
              buyMetaUpgrade(metaList[curIdx].id);
            } else {
              setIsSanctumOpen(false);
              gameAudio.playCrispClick();
            }
            return;
          }
          if (e.key === 'Escape' || e.key === 'Backspace') {
            e.preventDefault();
            setIsSanctumOpen(false);
            gameAudio.playCrispClick();
            return;
          }
          return;
        }

        if (isHowToPlayOpen) {
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
            setIsHowToPlayOpen(false);
            gameAudio.playCrispClick();
            return;
          }
          return;
        }

        if (!isSanctumOpen && !isHowToPlayOpen) {
          if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            openSanctumShop();
            return;
          }
          if (e.key === 'h' || e.key === 'H' || e.key === '?') {
            e.preventDefault();
            setIsHowToPlayOpen(true);
            gameAudio.playCrispClick();
            return;
          }
          if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            setSelectedHeroIndex((prev) => (prev > 0 ? prev - 1 : HEROES.length - 1));
            gameAudio.playCrispClick();
            return;
          }
          if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            setSelectedHeroIndex((prev) => (prev < HEROES.length - 1 ? prev + 1 : 0));
            gameAudio.playCrispClick();
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            initGame(selectedHeroIndex);
            return;
          }
        }
      }

      // Sprint
      if (e.key === 'Shift' || e.key === 'Control') {
        keyboardSprintRef.current = true;
      }

      // Inventory / Sell Modal Keyboard Navigation
      if (isInventoryOpen) {
        const totalSellItems = equippedWeapons.length + equippedPassives.length + 1;
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          const next = inventoryFocusIndexRef.current > 0 ? inventoryFocusIndexRef.current - 1 : totalSellItems - 1;
          inventoryFocusIndexRef.current = next;
          setInventoryFocusIndex(next);
          gameAudio.playCrispClick();
          return;
        }
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          const next = inventoryFocusIndexRef.current < totalSellItems - 1 ? inventoryFocusIndexRef.current + 1 : 0;
          inventoryFocusIndexRef.current = next;
          setInventoryFocusIndex(next);
          gameAudio.playCrispClick();
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const curIdx = inventoryFocusIndexRef.current;
          if (curIdx < equippedWeapons.length) {
            sellItem(equippedWeapons[curIdx].id);
            const remaining = Math.max(1, equippedWeapons.length + equippedPassives.length);
            const clamped = Math.max(0, Math.min(curIdx, remaining - 1));
            inventoryFocusIndexRef.current = clamped;
            setInventoryFocusIndex(clamped);
          } else if (curIdx < equippedWeapons.length + equippedPassives.length) {
            const pasIdx = curIdx - equippedWeapons.length;
            sellItem(equippedPassives[pasIdx].id);
            const remaining = Math.max(1, equippedWeapons.length + equippedPassives.length);
            const clamped = Math.max(0, Math.min(curIdx, remaining - 1));
            inventoryFocusIndexRef.current = clamped;
            setInventoryFocusIndex(clamped);
          } else {
            setIsInventoryOpen(false);
            gameAudio.playCrispClick();
          }
          return;
        }
        if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Tab' || e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          setIsInventoryOpen(false);
          gameAudio.playCrispClick();
          return;
        }
        return;
      }

      // Pause toggle (Escape or P)
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameState.status === 'PLAYING') {
          e.preventDefault();
          setIsGameMenuOpen((prev) => !prev);
          gameAudio.playCrispClick();
          return;
        }
      }

      // Pause Screen navigation shortcuts & button selection
      if (isGameMenuOpen) {
        if (e.key === 'Tab' || e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          openInventory();
          return;
        }
        if (e.key === '1') {
          setPauseTab('STATS');
          pauseMenuFocusIndexRef.current = 0;
          setPauseMenuFocusIndex(0);
          gameAudio.playCrispClick();
          return;
        } else if (e.key === '2') {
          setPauseTab('GRIMOIRE');
          pauseMenuFocusIndexRef.current = 0;
          setPauseMenuFocusIndex(0);
          gameAudio.playCrispClick();
          return;
        } else if (e.key === '3') {
          setPauseTab('MENU');
          pauseMenuFocusIndexRef.current = 0;
          setPauseMenuFocusIndex(0);
          gameAudio.playCrispClick();
          return;
        } else if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') {
          setPauseTab((prev) => (prev === 'MENU' ? 'GRIMOIRE' : prev === 'GRIMOIRE' ? 'STATS' : 'MENU'));
          pauseMenuFocusIndexRef.current = 0;
          setPauseMenuFocusIndex(0);
          gameAudio.playCrispClick();
          return;
        } else if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') {
          setPauseTab((prev) => (prev === 'STATS' ? 'GRIMOIRE' : prev === 'GRIMOIRE' ? 'MENU' : 'STATS'));
          pauseMenuFocusIndexRef.current = 0;
          setPauseMenuFocusIndex(0);
          gameAudio.playCrispClick();
          return;
        }

        if (pauseTab === 'MENU') {
          const totalMenuButtons = 7;
          if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            const next = pauseMenuFocusIndexRef.current > 0 ? pauseMenuFocusIndexRef.current - 1 : totalMenuButtons - 1;
            pauseMenuFocusIndexRef.current = next;
            setPauseMenuFocusIndex(next);
            gameAudio.playCrispClick();
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            e.preventDefault();
            const next = pauseMenuFocusIndexRef.current < totalMenuButtons - 1 ? pauseMenuFocusIndexRef.current + 1 : 0;
            pauseMenuFocusIndexRef.current = next;
            setPauseMenuFocusIndex(next);
            gameAudio.playCrispClick();
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerPauseMenuAction(pauseMenuFocusIndexRef.current);
            return;
          }
        }

        if (pauseTab === 'STATS' && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          openInventory();
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          setIsGameMenuOpen(false);
          gameAudio.playCrispClick();
          return;
        }
        return;
      }

      // Level Up Draft Keys [1, 2, 3, 4], Arrows, Enter, Space, Reroll [R]
      if (isLevelUpOpen && levelUpChoices.length > 0) {
        if (e.key === '1' && levelUpChoices[0]) {
          selectUpgrade(levelUpChoices[0]);
        } else if (e.key === '2' && levelUpChoices[1]) {
          selectUpgrade(levelUpChoices[1]);
        } else if (e.key === '3' && levelUpChoices[2]) {
          selectUpgrade(levelUpChoices[2]);
        } else if (e.key === '4' && levelUpChoices[3]) {
          selectUpgrade(levelUpChoices[3]);
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          setSelectedChoiceIndex((prev) => (prev > 0 ? prev - 1 : levelUpChoices.length - 1));
          gameAudio.playCrispClick();
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          setSelectedChoiceIndex((prev) => (prev < levelUpChoices.length - 1 ? prev + 1 : 0));
          gameAudio.playCrispClick();
        } else if (e.key === 'Enter' || e.key === ' ') {
          selectUpgrade(levelUpChoices[selectedChoiceIndex]);
        } else if ((e.key === 'r' || e.key === 'R') && availableRerolls > 0) {
          handleReroll();
        }
      }

      // Inventory Shortcut (Tab / I)
      if (gameState.status === 'PLAYING' && (e.key === 'Tab' || e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        if (isInventoryOpen) {
          setIsInventoryOpen(false);
        } else {
          openInventory();
        }
        gameAudio.playCrispClick();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Control') {
        keyboardSprintRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    isLevelUpOpen,
    levelUpChoices,
    selectedChoiceIndex,
    selectUpgrade,
    handleReroll,
    availableRerolls,
    gameState.status,
    isSanctumOpen,
    isHowToPlayOpen,
    isGameMenuOpen,
    selectedHeroIndex,
    initGame,
    openSanctumShop,
  ]);

  const isMusicPlaying = !['START', 'GAME_OVER', 'VICTORY'].includes(gameState.status) && !musicMuted;

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-center bg-[#07050e] text-white font-sans select-none">
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
          <div className="text-xl font-bold tracking-wider text-rose-400 animate-pulse">
            Summoning Relics & Swarms...
          </div>
        </div>
      )}

      <BackgroundMusic url={BACKGROUND_MUSIC_URL} isPlaying={isMusicPlaying} isMuted={musicMuted} />

      {/* --- HUD HEADER BAR --- */}
      <div className="w-full bg-[#0c0a1a]/95 backdrop-blur-md border-b border-rose-950/60 px-4 py-1.5 flex items-center justify-between z-20 shrink-0 text-xs md:text-sm">
        {/* Left: Health, Stamina & Level */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            {/* HP Bar */}
            <div className="flex items-center gap-1 font-bold text-rose-400 text-xs">
              <Heart size={14} className="fill-rose-500 text-rose-500" />
              <span>
                {currentHp}/{maxHpDisplay}
              </span>
            </div>
            {/* Stamina Bar */}
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <Zap size={13} className="fill-emerald-400 text-emerald-400" />
              <div className="w-16 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-emerald-950">
                <div
                  className="bg-emerald-400 h-full transition-all duration-100"
                  style={{
                    width: `${Math.min(100, (currentStamina / Math.max(1, maxStaminaDisplay)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sky-300 font-semibold bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/40">
            <Sparkles size={14} />
            <span>Lv. {gameState.level}</span>
          </div>
        </div>

        {/* Center: Top-aligned XP Bar & Survival Timer */}
        <div className="flex-1 max-w-xs md:max-w-md mx-3 flex flex-col items-center gap-0.5">
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-sky-500 to-indigo-400 h-full transition-all duration-200"
              style={{
                width: `${Math.min(100, (xpDisplay / Math.max(1, nextLevelXpDisplay)) * 100)}%`,
              }}
            />
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span>Time: {formatTime(gameState.timer || 0)}</span>
            <span>•</span>
            <span className="text-rose-400">Kills: {killCount}</span>
          </div>
        </div>

        {/* Right: Gold, Inventory Button & Menu Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
            <Coins size={14} />
            <span>{runGold}</span>
          </div>

          <button
            onClick={() => {
              setIsInventoryOpen(true);
              gameAudio.playCrispClick();
            }}
            title="Open Weapon Selling Sheet (Tab / I)"
            className="min-w-[40px] min-h-[36px] bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 px-2.5 py-1 rounded-md border border-indigo-700/60 flex items-center gap-1 text-xs font-bold transition-colors">
            <Sword size={14} />
            <span className="hidden sm:inline">Sell</span>
          </button>

          <button
            onClick={() => {
              setIsGameMenuOpen(true);
              gameAudio.playCrispClick();
            }}
            className="min-w-[40px] min-h-[36px] bg-slate-800 hover:bg-slate-700 text-white p-1.5 rounded-md border border-slate-600 transition-colors flex items-center justify-center"
            title="Menu (Esc / Start)">
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* --- Active Weapon & Relic Dock --- */}
      <div className="w-full bg-[#0a0814]/80 px-4 py-1 flex items-center justify-between border-b border-slate-800/40 text-[11px] z-10 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Weapons:</span>
          {equippedWeapons.map((wep) => {
            const def = ITEM_DEFS[wep.id];
            return (
              <div
                key={wep.id}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                  def?.isFusion
                    ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                    : def?.isEvolution
                    ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                    : 'bg-slate-900/80 border-indigo-500/40 text-slate-200'
                }`}>
                <img src={def?.icon || ''} alt={def?.name || ''} className="w-3.5 h-3.5 object-contain" />
                <span className="font-medium truncate max-w-[90px]">{def?.name || wep.id}</span>
                <span className="text-amber-400 font-bold text-[10px]">
                  {def?.isEvolution ? 'EVO' : `L${wep.level}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Relics:</span>
          {equippedPassives.map((pas) => {
            const def = ITEM_DEFS[pas.id];
            return (
              <div
                key={pas.id}
                className="flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded border border-emerald-500/40">
                <img src={def?.icon || ''} alt={def?.name || ''} className="w-3.5 h-3.5 object-contain" />
                <span className="text-slate-200 font-medium truncate max-w-[80px]">{def?.name || pas.id}</span>
                <span className="text-emerald-400 font-bold text-[10px]">L{pas.level}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- GAME CANVAS --- */}
      {assetsReady && (
        <div className="flex-1 w-full min-h-0 flex items-center justify-center bg-black relative">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
              width: `min(100%, calc(100vh * ${canvasWidth} / ${canvasHeight}))`,
            }}
            className="h-auto max-w-full max-h-full"
          />

          {/* --- MOBILE VIRTUAL CONTROLS --- */}
          {isMobile && gameState.status === 'PLAYING' && (
            <div className="absolute inset-0 pointer-events-none z-30 flex justify-between items-end p-6">
              {/* Virtual Touch Joystick (Bottom Left) */}
              <div
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  touchJoystickRef.current = {
                    ...touchJoystickRef.current,
                    active: true,
                    startX: cx,
                    startY: cy,
                    currentX: e.clientX,
                    currentY: e.clientY,
                    dx: clamp((e.clientX - cx) / 40, -1, 1),
                    dy: clamp((e.clientY - cy) / 40, -1, 1),
                  };
                }}
                onPointerMove={(e) => {
                  if (!touchJoystickRef.current.active) return;
                  const {startX, startY} = touchJoystickRef.current;
                  const dx = e.clientX - startX;
                  const dy = e.clientY - startY;
                  const maxRad = 40;
                  const mag = Math.hypot(dx, dy);
                  const clampedMag = Math.min(maxRad, mag);
                  const angle = Math.atan2(dy, dx);
                  touchJoystickRef.current.dx = (Math.cos(angle) * clampedMag) / maxRad;
                  touchJoystickRef.current.dy = (Math.sin(angle) * clampedMag) / maxRad;
                }}
                onPointerUp={() => {
                  touchJoystickRef.current.active = false;
                  touchJoystickRef.current.dx = 0;
                  touchJoystickRef.current.dy = 0;
                }}
                onPointerCancel={() => {
                  touchJoystickRef.current.active = false;
                  touchJoystickRef.current.dx = 0;
                  touchJoystickRef.current.dy = 0;
                }}
                className="w-28 h-28 rounded-full bg-slate-900/60 border-2 border-rose-500/40 pointer-events-auto flex items-center justify-center touch-none select-none shadow-lg">
                <div className="w-12 h-12 rounded-full bg-rose-500/80 shadow-md transform" />
              </div>

              {/* Mobile Right Controls: Sprint & Sell Buttons */}
              <div className="flex flex-col gap-3 pointer-events-auto">
                <button
                  onPointerDown={() => {
                    touchJoystickRef.current.sprintTouch = true;
                  }}
                  onPointerUp={() => {
                    touchJoystickRef.current.sprintTouch = false;
                  }}
                  onPointerCancel={() => {
                    touchJoystickRef.current.sprintTouch = false;
                  }}
                  className="w-14 h-14 rounded-full bg-emerald-600/90 border-2 border-emerald-400 text-white flex flex-col items-center justify-center font-bold text-[10px] touch-none shadow-xl active:scale-95 transition-transform">
                  <Zap size={18} />
                  <span>SPRINT</span>
                </button>

                <button
                  onClick={() => {
                    setIsInventoryOpen(true);
                    gameAudio.playCrispClick();
                  }}
                  className="w-14 h-14 rounded-full bg-indigo-600/90 border-2 border-indigo-400 text-white flex flex-col items-center justify-center font-bold text-[10px] touch-none shadow-xl active:scale-95 transition-transform">
                  <Sword size={18} />
                  <span>SELL</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- START MENU & HERO SELECT OVERLAY --- */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral" zIndex={40}>
          <div className="w-full max-w-xl bg-[#0e0c1f] border-2 border-rose-900/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-5 my-auto">
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-rose-400 font-bold mb-1">
                Relentless Roguelite Survival
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-400 to-rose-400">
                RELIC SWARM
              </h1>
              <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-md">
                Master distinct hero archetypes, weapon fusions, and unleash divine supernovas upon the swarm.
              </p>
            </div>

            {/* Hero Selection Grid */}
            <div className="w-full flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Select Your Champion:</span>
                <span className="text-[10px] text-sky-400 font-normal">
                  [A / D or D-Pad] Change Hero
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {HEROES.map((hero, idx) => {
                  const isSelected = selectedHeroIndex === idx;
                  return (
                    <button
                      key={hero.id}
                      onClick={() => {
                        setSelectedHeroIndex(idx);
                        gameAudio.playCrispClick();
                      }}
                      className={`p-2.5 rounded-xl flex flex-col items-center gap-1.5 border-2 transition-all text-center ${
                        isSelected
                          ? 'bg-rose-950/70 border-rose-500 shadow-lg shadow-rose-950/50 scale-105 ring-2 ring-rose-500/40'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
                      }`}>
                      <div
                        className="w-14 h-14 rounded-lg bg-slate-950/90 flex items-center justify-center p-1 border overflow-hidden"
                        style={{borderColor: isSelected ? hero.color : '#334155'}}>
                        <AnimatedHeroPortrait
                          imgUrl={hero.idleSheet}
                          color={hero.color}
                          isSelected={isSelected}
                          size={48}
                          totalFrames={4}
                          fps={6}
                        />
                      </div>
                      <div className="min-w-0 w-full">
                        <div className="font-bold text-xs text-slate-100 truncate">{hero.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{hero.title}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Hero Details Card */}
              {(() => {
                const curHero = HEROES[selectedHeroIndex] || HEROES[0];
                const startWepDef = ITEM_DEFS[curHero.startingWeapon];
                const startPasDef = curHero.startingPassive ? ITEM_DEFS[curHero.startingPassive] : null;

                return (
                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-10 h-10 rounded-lg bg-slate-900 border flex items-center justify-center overflow-hidden"
                          style={{borderColor: curHero.color}}>
                          <AnimatedHeroPortrait
                            imgUrl={curHero.idleSheet}
                            color={curHero.color}
                            isSelected={true}
                            size={36}
                            totalFrames={4}
                            fps={6}
                          />
                        </div>
                        <div>
                          <span className="font-black text-sm" style={{color: curHero.color}}>
                            {curHero.name}
                          </span>
                          <span className="text-slate-400 text-xs ml-2">— {curHero.title}</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                        Base HP: {curHero.baseHp}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {curHero.desc}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                        <img src={startWepDef?.icon || ''} alt="" className="w-5 h-5 object-contain shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] text-slate-500 uppercase font-semibold">Starting Weapon</div>
                          <div className="font-bold text-sky-300 truncate">{startWepDef?.name}</div>
                        </div>
                      </div>

                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                        {startPasDef && <img src={startPasDef.icon} alt="" className="w-5 h-5 object-contain shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-[9px] text-slate-500 uppercase font-semibold">Class Trait & Relic</div>
                          <div className="font-bold text-emerald-400 truncate">{curHero.statBonus}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Persistent Sanctum Gold & Meta-Shop Shortcut */}
            <div className="w-full flex items-center justify-between bg-amber-950/40 border border-amber-800/40 px-3.5 py-2.5 rounded-xl text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Coins size={18} className="text-amber-400" />
                <span>Sanctum Vault: {persistentGold} Gold</span>
              </div>
              <button
                onClick={openSanctumShop}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-md ring-1 ring-amber-300">
                <Zap size={14} className="fill-slate-950" />
                <span>Sanctum Shop [S / X]</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2">
              <button
                onClick={() => initGame(selectedHeroIndex)}
                autoFocus
                className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-base md:text-lg py-3 rounded-xl shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2">
                <Play size={20} className="fill-white" />
                <span>START RUN (Enter / Space / A)</span>
              </button>

              <button
                onClick={() => {
                  setIsHowToPlayOpen(true);
                  gameAudio.playCrispClick();
                }}
                className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2 rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5">
                <HelpCircle size={14} />
                Gamepad, Keys & Combat Guide [H]
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- SANCTUM META SHOP MODAL --- */}
      {isSanctumOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-lg bg-[#0f0c22] border-2 border-amber-600/70 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-amber-800/50 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="text-amber-400" size={20} />
                <h2 className="text-xl font-black text-amber-300">Sanctum Meta-Shop</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 font-bold text-amber-400 text-sm bg-amber-950/60 px-2 py-1 rounded border border-amber-700/50">
                  <Coins size={14} />
                  <span>{persistentGold} Gold</span>
                </div>
                <button
                  onClick={() => setIsSanctumOpen(false)}
                  className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-300">
              Permanently enhance your stats across all future runs using gold collected from swarms and chests. All gold earned during runs is banked directly into your Sanctum Vault upon completion or tactical exit.
            </div>

            <div className="flex flex-col gap-2">
              {Object.values(META_UPGRADES).map((upg, idx) => {
                const currentLvl = metaLevels[upg.id] || 0;
                const cost = upg.costBase + currentLvl * upg.costStep;
                const isMax = currentLvl >= upg.maxLevel;
                const canAfford = persistentGold >= cost;
                const isFocused = sanctumFocusIndex === idx;

                return (
                  <div
                    key={upg.id}
                    ref={(el) => {
                      sanctumItemsRef.current[idx] = el;
                    }}
                    onPointerEnter={() => {
                      sanctumFocusIndexRef.current = idx;
                      setSanctumFocusIndex(idx);
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                      isFocused
                        ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-950/60 ring-2 ring-amber-400/90 scale-[1.01]'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}>
                    <div>
                      <div className="font-bold text-xs text-slate-100 flex items-center gap-2">
                        {isFocused && <span className="text-amber-400 font-bold">▶</span>}
                        <span>{upg.name}</span>
                        <span className="text-amber-400 text-[10px]">
                          Rank {currentLvl}/{upg.maxLevel}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">{upg.desc}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        Current: +{currentLvl * upg.bonusPerLevel}
                        {upg.unit}
                      </div>
                    </div>

                    <button
                      disabled={isMax || !canAfford}
                      onClick={() => buyMetaUpgrade(upg.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                        isMax
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                          : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                      } ${isFocused ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950' : ''}`}>
                      {isMax ? 'MAXED' : `${cost} Gold`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Close Shop Button */}
            {(() => {
              const closeIdx = Object.values(META_UPGRADES).length;
              const isCloseFocused = sanctumFocusIndex === closeIdx;
              return (
                <button
                  ref={(el) => {
                    sanctumItemsRef.current[closeIdx] = el;
                  }}
                  onPointerEnter={() => {
                    sanctumFocusIndexRef.current = closeIdx;
                    setSanctumFocusIndex(closeIdx);
                  }}
                  onClick={() => setIsSanctumOpen(false)}
                  className={`w-full font-bold py-2 rounded-xl text-xs transition-all mt-2 border ${
                    isCloseFocused
                      ? 'bg-slate-700 text-amber-300 border-amber-400 ring-2 ring-amber-400 shadow-md scale-[1.01]'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border-transparent'
                  }`}>
                  Close Shop [B / Esc]
                </button>
              );
            })()}

            <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-3 pt-1 border-t border-slate-800/60">
              <span>[W / S or D-Pad] Navigate</span>
              <span>[Enter / A] Buy</span>
              <span>[Esc / B] Back</span>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- HOW TO PLAY MODAL --- */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-md bg-[#0e0c1f] border-2 border-indigo-500/70 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-indigo-900/50 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="text-indigo-400" size={20} />
                <h2 className="text-xl font-black text-indigo-300">Controls & Mechanics</h2>
              </div>
              <button
                onClick={() => setIsHowToPlayOpen(false)}
                className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="text-xs text-slate-300 flex flex-col gap-3">
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="font-bold text-rose-400 mb-1 flex items-center gap-1.5">
                  <Zap size={14} />
                  <span>Movement & Sprint</span>
                </div>
                <div>• Keyboard: WASD / Arrow Keys to move, <span className="text-emerald-400 font-bold">Shift</span> to Sprint (+60% speed).</div>
                <div>• Gamepad: Left Stick / D-pad to move, <span className="text-emerald-400 font-bold">Button B / RT / LT / X</span> to Sprint.</div>
                <div>• Mobile: Drag virtual joystick + tap green Sprint button.</div>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Draft & Menu Navigation</span>
                </div>
                <div>• Direct Select: Press <span className="text-sky-300 font-bold">[1], [2], [3]</span> to immediately pick an upgrade.</div>
                <div>• Arrow Navigation: W/S or Up/Down + <span className="text-sky-300 font-bold">Enter / Space</span>.</div>
                <div>• Gamepad: D-pad / Left Stick Up/Down to navigate, <span className="text-sky-300 font-bold">Button A / Cross</span> to confirm. Press Y to Reroll!</div>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                  <Flame size={14} />
                  <span>Level 5 Weapon Merging / Evolution</span>
                </div>
                <div>• Max two compatible weapons to Level 5 (e.g. Magic Missile + Daggers, or Flame + Thunder) to unlock extraordinary <span className="text-amber-300 font-bold">Fusion Evolutions</span>!</div>
                <div>• Fusing combines both weapons into one supreme weapon, freeing an entire weapon slot for new builds!</div>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <Skull size={14} />
                  <span>Status Effects: Poison & Slow</span>
                </div>
                <div>• <span className="text-emerald-400 font-bold">Poison</span>: Deals continuous damage-over-time (green ticks) melting swarms.</div>
                <div>• <span className="text-cyan-400 font-bold">Slow</span>: Freezes and slows enemy charges by up to 50%.</div>
              </div>
            </div>

            <button
              onClick={() => setIsHowToPlayOpen(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs transition-colors">
              Close Guide
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* --- LEVEL UP DRAFT OVERLAY --- */}
      {isLevelUpOpen && (
        <MenuOverlay tone="neutral" zIndex={45}>
          <div className="w-full max-w-md bg-[#0f0d24] border-2 border-sky-500/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-sky-400 font-bold">Level Reached!</div>
              <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-300 to-amber-300">
                LEVEL {gameState.level} DRAFT
              </h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Keys [1]-[3], W/S, Arrows + Enter/Space, or Gamepad D-pad/A to Pick
              </div>
            </div>

            {/* 3 Choices */}
            <div className="w-full flex flex-col gap-2.5">
              {levelUpChoices.map((item, idx) => {
                const isFocused = selectedChoiceIndex === idx;
                const currentWep = equippedWeapons.find((w) => w.id === item.id);
                const currentPas = equippedPassives.find((p) => p.id === item.id);
                const currentLvl = currentWep?.level || currentPas?.level || 0;
                const isNew = currentLvl === 0;

                // Base styling by item tier
                let borderAndBg = 'bg-slate-900/80 border-slate-700';
                if (item.isFusion) {
                  borderAndBg =
                    'bg-gradient-to-r from-amber-950/90 via-rose-950/90 to-amber-950/90 border-amber-400 shadow-amber-950/80';
                } else if (item.isEvolution) {
                  borderAndBg = 'bg-gradient-to-r from-purple-950/90 to-indigo-950/90 border-purple-400';
                } else if (item.isConsumable) {
                  borderAndBg = 'bg-gradient-to-r from-amber-950/80 via-emerald-950/80 to-slate-900 border-amber-500';
                }

                // Focus styling: high-contrast golden/cyan/purple pulsing outline & scale
                const focusStyle = isFocused
                  ? item.isConsumable || item.isFusion
                    ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.03] shadow-2xl shadow-amber-500/50 border-amber-300'
                    : item.isEvolution
                    ? 'ring-4 ring-purple-300 ring-offset-2 ring-offset-slate-950 scale-[1.03] shadow-2xl shadow-purple-500/50 border-purple-300'
                    : 'ring-4 ring-sky-400 ring-offset-2 ring-offset-slate-950 scale-[1.03] shadow-2xl shadow-sky-500/50 border-sky-300 bg-slate-800'
                  : 'hover:bg-slate-800/80';

                return (
                  <button
                    key={item.id}
                    onClick={() => selectUpgrade(item)}
                    onPointerEnter={() => setSelectedChoiceIndex(idx)}
                    className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all relative ${borderAndBg} ${focusStyle}`}>
                    {/* Hotkey Number Badge */}
                    <div className="absolute -top-2 -left-2 w-5 h-5 bg-sky-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center border border-sky-300 shadow">
                      {idx + 1}
                    </div>

                    <div className="w-12 h-12 rounded-lg bg-slate-950/90 p-1 flex items-center justify-center border border-slate-700 shrink-0">
                      <img src={item.icon} alt={item.name} className="w-9 h-9 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-100 truncate">{item.name}</span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            item.isFusion
                              ? 'bg-amber-400 text-slate-950 animate-pulse'
                              : item.isEvolution
                              ? 'bg-purple-500 text-white animate-pulse'
                              : item.isConsumable
                              ? 'bg-amber-400 text-slate-950 font-bold'
                              : isNew
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}>
                          {item.isFusion
                            ? 'FUSION EVOLUTION'
                            : item.isEvolution
                            ? 'EVOLUTION'
                            : item.isConsumable
                            ? 'SUPREME BOON'
                            : isNew
                            ? 'NEW'
                            : `LV ${currentLvl + 1}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{item.desc}</div>
                      {isFocused && (
                        <div className="text-[10px] font-extrabold text-amber-300 mt-1 flex items-center gap-1 animate-pulse">
                          <span>▶ PRESS [ENTER / A] TO EQUIP</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer Reroll & Sell Shortcut */}
            <div className="w-full flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <button
                disabled={availableRerolls <= 0}
                onClick={handleReroll}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                  availableRerolls > 0
                    ? 'bg-indigo-700 hover:bg-indigo-600 text-white ring-1 ring-indigo-400'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}>
                <RotateCw size={14} />
                <span>Reroll [R / Y] ({availableRerolls})</span>
              </button>

              <button
                onClick={() => setIsInventoryOpen(true)}
                className="text-rose-400 hover:text-rose-300 font-semibold underline flex items-center gap-1">
                <DollarSign size={14} />
                <span>Sell Equipped Items</span>
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- INVENTORY & WEAPON SELLING MODAL --- */}
      {isInventoryOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-lg bg-[#0e0c1f] border-2 border-rose-600/70 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-rose-900/50 pb-3">
              <div className="flex items-center gap-2">
                <Sword className="text-rose-400" size={20} />
                <h2 className="text-xl font-black text-rose-300">Manage & Sell Arsenal</h2>
              </div>
              <button
                onClick={() => setIsInventoryOpen(false)}
                className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Selling refunds <span className="text-amber-400 font-bold">70% of invested gold</span>, instantly frees the weapon slot, and returns the item to future level-up drafts.
            </div>

            {/* Weapons Section */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Equipped Weapons ({equippedWeapons.length}/4):
              </div>
              {equippedWeapons.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No weapons equipped.</div>
              ) : (
                equippedWeapons.map((wep, idx) => {
                  const def = ITEM_DEFS[wep.id];
                  const refund = Math.round((def?.cost || 50) * wep.level * 0.7);
                  const isFocused = inventoryFocusIndex === idx;

                  return (
                    <div
                      key={wep.id}
                      ref={(el) => {
                        inventoryItemsRef.current[idx] = el;
                      }}
                      onPointerEnter={() => {
                        inventoryFocusIndexRef.current = idx;
                        setInventoryFocusIndex(idx);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        isFocused
                          ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/90 scale-[1.01]'
                          : 'bg-slate-950/80 border-slate-800'
                      }`}>
                      <div className="flex items-center gap-2.5">
                        <img src={def?.icon || ''} alt={def?.name || ''} className="w-8 h-8 object-contain" />
                        <div>
                          <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                            {isFocused && <span className="text-rose-400 font-bold">▶</span>}
                            <span>{def?.name || wep.id}</span>
                            <span className="text-indigo-400 text-[10px]">
                              {def?.isEvolution ? 'EVO' : `L${wep.level}`}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">{def?.desc}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => sellItem(wep.id)}
                        className={`bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                          isFocused ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 shadow-md scale-105' : ''
                        }`}>
                        <DollarSign size={14} />
                        <span>Sell (+{refund}g)</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Passives Section */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Equipped Relics ({equippedPassives.length}/4):
              </div>
              {equippedPassives.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No relics equipped.</div>
              ) : (
                equippedPassives.map((pas, pasIdx) => {
                  const def = ITEM_DEFS[pas.id];
                  const refund = Math.round((def?.cost || 40) * pas.level * 0.7);
                  const focusIdx = equippedWeapons.length + pasIdx;
                  const isFocused = inventoryFocusIndex === focusIdx;

                  return (
                    <div
                      key={pas.id}
                      ref={(el) => {
                        inventoryItemsRef.current[focusIdx] = el;
                      }}
                      onPointerEnter={() => {
                        inventoryFocusIndexRef.current = focusIdx;
                        setInventoryFocusIndex(focusIdx);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        isFocused
                          ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/90 scale-[1.01]'
                          : 'bg-slate-950/80 border-slate-800'
                      }`}>
                      <div className="flex items-center gap-2.5">
                        <img src={def?.icon || ''} alt={def?.name || ''} className="w-8 h-8 object-contain" />
                        <div>
                          <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                            {isFocused && <span className="text-rose-400 font-bold">▶</span>}
                            <span>{def?.name || pas.id}</span>
                            <span className="text-emerald-400 text-[10px]">L{pas.level}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{def?.desc}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => sellItem(pas.id)}
                        className={`bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                          isFocused ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 shadow-md scale-105' : ''
                        }`}>
                        <DollarSign size={14} />
                        <span>Sell (+{refund}g)</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Done Button */}
            {(() => {
              const doneIdx = equippedWeapons.length + equippedPassives.length;
              const isDoneFocused = inventoryFocusIndex === doneIdx;
              return (
                <button
                  ref={(el) => {
                    inventoryItemsRef.current[doneIdx] = el;
                  }}
                  onPointerEnter={() => {
                    inventoryFocusIndexRef.current = doneIdx;
                    setInventoryFocusIndex(doneIdx);
                  }}
                  onClick={() => setIsInventoryOpen(false)}
                  className={`w-full font-bold py-2 rounded-xl text-xs transition-all border ${
                    isDoneFocused
                      ? 'bg-slate-700 text-rose-300 border-rose-400 ring-2 ring-rose-400 shadow-md scale-[1.01]'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border-transparent'
                  }`}>
                  Done [Esc / B / Tab]
                </button>
              );
            })()}

            <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-3 pt-1 border-t border-slate-800/60">
              <span>[W / S or D-Pad] Navigate</span>
              <span>[Enter / A] Sell Item</span>
              <span>[Esc / B / Tab] Close</span>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- CHEST BOUNTY OVERLAY --- */}
      {chestReward && (
        <MenuOverlay tone="victory" zIndex={50}>
          <div className="w-full max-w-sm bg-[#0e0c1f] border-2 border-amber-500 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-950/80 p-2 flex items-center justify-center border border-amber-600 shadow-lg">
              <img
                src="assets/images/item_treasure_chest.png"
                alt="Chest"
                className="w-12 h-12 object-contain"
              />
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-0.5">
                Treasure Unlocked
              </div>
              <h2 className="text-xl md:text-2xl font-black text-amber-300">{chestReward.title}</h2>
              <div className="text-xs font-bold text-amber-400 mt-1">
                +{chestReward.gold} Sanctum Gold Acquired
              </div>
            </div>

            <div className="w-full bg-slate-950/90 p-3.5 rounded-xl border border-amber-600/50 flex flex-col gap-2 text-left">
              {chestReward.item ? (
                <div className="flex items-center gap-3">
                  <img
                    src={chestReward.item.icon}
                    alt={chestReward.item.name}
                    className="w-10 h-10 object-contain shrink-0"
                  />
                  <div>
                    <div className="font-bold text-xs text-slate-100">{chestReward.item.name}</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">{chestReward.item.desc}</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-200 leading-relaxed font-medium">
                  {chestReward.description}
                </div>
              )}
            </div>

            <button
              onClick={claimChestReward}
              autoFocus
              className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black py-3 rounded-xl text-sm transition-all shadow-lg ring-2 ring-amber-300 hover:scale-[1.02] flex items-center justify-center gap-2">
              <Sparkles size={16} className="fill-slate-950" />
              <span>CLAIM REWARD (Enter / Space / A)</span>
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* --- PAUSE & DETAILED INFO / GRIMOIRE SCREEN (Escape / P / Gamepad Start) --- */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-2xl bg-[#0d0a1d] border-2 border-slate-700/80 rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Header & Status */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
                  Tactical Pause & Battle Grimoire
                </div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-300">
                  RUN OVERVIEW
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  Time: {formatTime(gameState.timer || 0)}
                </div>
                <button
                  onClick={() => {
                    setIsGameMenuOpen(false);
                    gameAudio.playCrispClick();
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Tab Navigation (Keys 1, 2, 3 or Q/E or Gamepad D-pad/LB/RB) */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                onClick={() => {
                  setPauseTab('STATS');
                  gameAudio.playCrispClick();
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  pauseTab === 'STATS'
                    ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}>
                <Activity size={14} />
                <span>[1] Stats & Arsenal</span>
              </button>

              <button
                onClick={() => {
                  setPauseTab('GRIMOIRE');
                  gameAudio.playCrispClick();
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  pauseTab === 'GRIMOIRE'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}>
                <Sparkles size={14} />
                <span>[2] Evolutions Guide</span>
              </button>

              <button
                onClick={() => {
                  setPauseTab('MENU');
                  gameAudio.playCrispClick();
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  pauseTab === 'MENU'
                    ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}>
                <Settings size={14} />
                <span>[3] Game Menu</span>
              </button>
            </div>

            {/* --- TAB 1: STATS & ARSENAL --- */}
            {pauseTab === 'STATS' && (
              <div className="flex flex-col gap-4 text-xs">
                {/* Statistics Grid */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="font-bold text-rose-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Activity size={14} />
                    <span>Hero Attribute Statistics</span>
                  </div>

                  {(() => {
                    const stats = getCalculatedStats();
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                          <span className="text-slate-400">Health</span>
                          <span className="font-bold text-rose-400 text-xs">
                            {currentHp} / {maxHpDisplay} HP
                          </span>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                          <span className="text-slate-400">HP Regeneration</span>
                          <span className="font-bold text-emerald-400 text-xs">
                            +{(0.5 * stats.vitalityLevel).toFixed(1)} HP / sec
                          </span>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                          <span className="text-slate-400">Movement Speed</span>
                          <span className="font-bold text-sky-400 text-xs">
                            {Math.round(stats.speed)} px/s (+{Math.round((stats.speed / 220 - 1) * 100)}%)
                          </span>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                          <span className="text-slate-400">Damage Multiplier</span>
                          <span className="font-bold text-amber-400 text-xs">
                            +{Math.round((stats.mightMult - 1) * 100)}% Might
                          </span>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                          <span className="text-slate-400">Cooldown Reduction</span>
                          <span className="font-bold text-indigo-400 text-xs">
                            {Math.round(stats.cdr * 100)}% CDR
                          </span>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                          <span className="text-slate-400">Sprint Stamina</span>
                          <span className="font-bold text-emerald-400 text-xs">
                            {Math.round(currentStamina)} / {maxStaminaDisplay}
                          </span>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                          <span className="text-slate-400">Attraction Radius</span>
                          <span className="font-bold text-sky-300 text-xs">
                            {Math.round(stats.magnetRadius)} px
                          </span>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                          <span className="text-slate-400">Armor & I-Frames</span>
                          <span className="font-bold text-slate-200 text-xs">
                            0.5s Damage Immunity
                          </span>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                          <span className="text-slate-400">Gold & Swarm Kills</span>
                          <span className="font-bold text-amber-300 text-xs">
                            {runGold}g • {killCount} Kills
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Equipped Weapons & Damage Dealt */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sword size={14} />
                      <span>Equipped Weapons & Damage</span>
                      <span className="text-[10px] text-slate-500 font-normal">({equippedWeapons.length}/4 Slots)</span>
                    </div>
                    <button
                      onClick={openInventory}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95">
                      <DollarSign size={14} />
                      <span>Manage & Sell Arsenal [Tab / Y]</span>
                    </button>
                  </div>

                  {equippedWeapons.length === 0 ? (
                    <div className="text-slate-500 italic text-xs">No weapons equipped.</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {equippedWeapons.map((wep) => {
                        const def = ITEM_DEFS[wep.id];
                        const dmg = Math.round(simRef.current.weaponDamageDealt[wep.id] || 0);
                        return (
                          <div
                            key={wep.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                              def?.isFusion
                                ? 'bg-amber-950/40 border-amber-500/60'
                                : def?.isEvolution
                                ? 'bg-purple-950/40 border-purple-500/60'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-slate-950 p-1 flex items-center justify-center border border-slate-700 shrink-0">
                                <img src={def?.icon || ''} alt={def?.name || ''} className="w-7 h-7 object-contain" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-100 text-xs">{def?.name || wep.id}</span>
                                  <span
                                    className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                                      def?.isFusion
                                        ? 'bg-amber-500 text-slate-950'
                                        : def?.isEvolution
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-indigo-600 text-white'
                                    }`}>
                                    {def?.isFusion ? 'FUSION' : def?.isEvolution ? 'EVO' : `LV ${wep.level}`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">
                                  {def?.desc}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 bg-slate-950/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
                              <div className="text-[10px] text-slate-400">Total Damage</div>
                              <div className="font-black text-xs text-amber-400">
                                {dmg.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Equipped Relics */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 flex flex-col gap-2">
                  <div className="font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Shield size={14} />
                      <span>Equipped Passive Relics</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {equippedPassives.length}/4 Slots
                    </span>
                  </div>

                  {equippedPassives.length === 0 ? (
                    <div className="text-slate-500 italic text-xs">No relics equipped.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {equippedPassives.map((pas) => {
                        const def = ITEM_DEFS[pas.id];
                        return (
                          <div
                            key={pas.id}
                            className="bg-slate-900/80 p-2 rounded-xl border border-emerald-900/40 flex items-center gap-2">
                            <img src={def?.icon || ''} alt={def?.name || ''} className="w-7 h-7 object-contain shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-100 truncate">{def?.name || pas.id}</span>
                                <span className="text-[9px] font-bold bg-emerald-700 text-white px-1 rounded">
                                  LV {pas.level}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">{def?.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- TAB 2: EVOLUTIONS & MERGES GRIMOIRE --- */}
            {pauseTab === 'GRIMOIRE' && (
              <div className="flex flex-col gap-3 text-xs">
                <div className="text-[11px] text-slate-300 bg-indigo-950/50 p-2.5 rounded-xl border border-indigo-800/40">
                  <span className="text-amber-400 font-bold">Fusion Mastery:</span> Maximize two compatible weapons to <span className="text-sky-300 font-bold">Level 5</span> to merge them into a single supreme weapon in Level Up drafts, freeing up a weapon slot!
                </div>

                {/* Weapon-Weapon Fusions */}
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame size={14} />
                    <span>Weapon + Weapon Fusions</span>
                  </div>

                  {/* 1. Arcane Phantom Vortex */}
                  <div className="bg-slate-950/90 p-3 rounded-xl border border-amber-500/50 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-amber-300">Arcane Phantom Vortex</span>
                      <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                        FUSION
                      </span>
                    </div>
                    <div className="text-[11px] text-sky-300 font-mono">
                      Recipe: Magic Missile (Lv 5) + Orbiting Daggers (Lv 5)
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Unleashes 8 permanent astral blades orbiting at high velocity that constantly fire homing crystalline laser barrages at all nearby foes.
                    </div>
                  </div>

                  {/* 2. Cataclysmic Supernova */}
                  <div className="bg-slate-950/90 p-3 rounded-xl border border-rose-500/50 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-rose-300">Cataclysmic Supernova</span>
                      <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded">
                        FUSION
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-300 font-mono">
                      Recipe: Flame Blast (Lv 5) + Thunder Strike (Lv 5)
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Rains explosive fiery meteor craters and continuous vertical celestial lightning storm novas across the battlefield.
                    </div>
                  </div>

                  {/* 3. Plague Sanctuary */}
                  <div className="bg-slate-950/90 p-3 rounded-xl border border-emerald-500/50 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-emerald-300">Plague Sanctuary</span>
                      <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded">
                        FUSION
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-300 font-mono">
                      Recipe: Radiant Aura (Lv 5) + Toxic Spores (Lv 5)
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Conjures a sanctified toxic aura that slows nearby enemies by 40% and deals 24 poison damage per second in a wide radius.
                    </div>
                  </div>
                </div>

                {/* Weapon + Relic Awakened Evolutions */}
                <div className="flex flex-col gap-2 mt-1">
                  <div className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={14} />
                    <span>Weapon + Relic Awakened Evolutions</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-800/40">
                      <div className="font-bold text-purple-300">Chrono Missiles</div>
                      <div className="text-slate-400 text-[10px]">Magic Missile (Lv 5) + Swift Boots</div>
                      <div className="text-slate-300 text-[10px] mt-1">5-bolt piercing arcane laser stream.</div>
                    </div>

                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-800/40">
                      <div className="font-bold text-purple-300">Hellfire Nova</div>
                      <div className="text-slate-400 text-[10px]">Flame Blast (Lv 5) + Might Talisman</div>
                      <div className="text-slate-300 text-[10px] mt-1">Colossal 160px infernal supernova bursts.</div>
                    </div>

                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-800/40">
                      <div className="font-bold text-purple-300">Phantom Storm</div>
                      <div className="text-slate-400 text-[10px]">Orbiting Daggers (Lv 5) + Might Talisman</div>
                      <div className="text-slate-300 text-[10px] mt-1">8 hyper-speed ethereal scythes.</div>
                    </div>

                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-800/40">
                      <div className="font-bold text-purple-300">Absolute Zero</div>
                      <div className="text-slate-400 text-[10px]">Glacial Shards (Lv 5) + Permafrost Sigil</div>
                      <div className="text-slate-300 text-[10px] mt-1">6 cryogenic piercing frost spikes with freeze.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 3: GAME MENU & SETTINGS --- */}
            {pauseTab === 'MENU' && (
              <div className="flex flex-col gap-3">
                {/* 0: Resume Button */}
                <button
                  ref={(el) => {
                    pauseMenuItemsRef.current[0] = el;
                  }}
                  onPointerEnter={() => {
                    pauseMenuFocusIndexRef.current = 0;
                    setPauseMenuFocusIndex(0);
                  }}
                  onClick={() => triggerPauseMenuAction(0)}
                  autoFocus
                  className={`w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-base py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 ${
                    pauseMenuFocusIndex === 0 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
                  }`}>
                  <Play size={18} className="fill-white" />
                  RESUME BATTLE (Escape / P / A)
                </button>

                {/* 1: Manage / Sell Inventory */}
                <button
                  ref={(el) => {
                    pauseMenuItemsRef.current[1] = el;
                  }}
                  onPointerEnter={() => {
                    pauseMenuFocusIndexRef.current = 1;
                    setPauseMenuFocusIndex(1);
                  }}
                  onClick={() => triggerPauseMenuAction(1)}
                  className={`w-full bg-indigo-950 hover:bg-indigo-900 text-indigo-200 py-2.5 rounded-xl text-xs font-bold border border-indigo-700/60 transition-all flex items-center justify-center gap-2 ${
                    pauseMenuFocusIndex === 1 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
                  }`}>
                  <Sword size={16} />
                  Manage & Sell Arsenal [Tab / Y]
                </button>

                {/* 2 & 3: Music & SFX Audio Toggles */}
                <div className="w-full grid grid-cols-2 gap-2">
                  <button
                    ref={(el) => {
                      pauseMenuItemsRef.current[2] = el;
                    }}
                    onPointerEnter={() => {
                      pauseMenuFocusIndexRef.current = 2;
                      setPauseMenuFocusIndex(2);
                    }}
                    onClick={() => triggerPauseMenuAction(2)}
                    className={`bg-slate-900 hover:bg-slate-800 text-slate-200 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-700 ${
                      pauseMenuFocusIndex === 2 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
                    }`}>
                    {musicMuted ? <VolumeX size={16} className="text-rose-400" /> : <Volume2 size={16} className="text-emerald-400" />}
                    <span>Music: {musicMuted ? 'Off' : 'On'}</span>
                  </button>

                  <button
                    ref={(el) => {
                      pauseMenuItemsRef.current[3] = el;
                    }}
                    onPointerEnter={() => {
                      pauseMenuFocusIndexRef.current = 3;
                      setPauseMenuFocusIndex(3);
                    }}
                    onClick={() => triggerPauseMenuAction(3)}
                    className={`bg-slate-900 hover:bg-slate-800 text-slate-200 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-700 ${
                      pauseMenuFocusIndex === 3 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
                    }`}>
                    {sfxMuted ? <VolumeX size={16} className="text-rose-400" /> : <Volume2 size={16} className="text-emerald-400" />}
                    <span>SFX: {sfxMuted ? 'Off' : 'On'}</span>
                  </button>
                </div>

                {/* 4: How to Play Guide */}
                <button
                  ref={(el) => {
                    pauseMenuItemsRef.current[4] = el;
                  }}
                  onPointerEnter={() => {
                    pauseMenuFocusIndexRef.current = 4;
                    setPauseMenuFocusIndex(4);
                  }}
                  onClick={() => triggerPauseMenuAction(4)}
                  className={`w-full bg-slate-900 hover:bg-slate-800 text-slate-200 py-2.5 rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-2 ${
                    pauseMenuFocusIndex === 4 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
                  }`}>
                  <HelpCircle size={16} />
                  Controls & Combat Guide
                </button>

                {/* 5: Restart Level */}
                <button
                  ref={(el) => {
                    pauseMenuItemsRef.current[5] = el;
                  }}
                  onPointerEnter={() => {
                    pauseMenuFocusIndexRef.current = 5;
                    setPauseMenuFocusIndex(5);
                  }}
                  onClick={() => triggerPauseMenuAction(5)}
                  className={`w-full bg-slate-900 hover:bg-slate-800 text-slate-200 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 border border-slate-700 ${
                    pauseMenuFocusIndex === 5 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
                  }`}>
                  <RotateCcw size={16} />
                  Restart Run
                </button>

                {/* 6: Quit to Main Menu */}
                <button
                  ref={(el) => {
                    pauseMenuItemsRef.current[6] = el;
                  }}
                  onPointerEnter={() => {
                    pauseMenuFocusIndexRef.current = 6;
                    setPauseMenuFocusIndex(6);
                  }}
                  onClick={() => triggerPauseMenuAction(6)}
                  className={`w-full bg-rose-950 hover:bg-rose-900 text-rose-300 py-2.5 rounded-xl text-xs font-semibold transition-all border border-rose-800 ${
                    pauseMenuFocusIndex === 6 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
                  }`}>
                  Quit to Main Menu (Bank Gold)
                </button>
              </div>
            )}

            {/* Modal Footer Controls info */}
            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
              <span>[1-3 / Q,E / LB,RB] Tabs • [W,S / D-Pad] Navigate • [Enter / A] Select • [Tab / Y] Sell Screen</span>
              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  gameAudio.playCrispClick();
                }}
                className="text-amber-400 hover:text-amber-300 font-bold">
                Resume Battle &rarr;
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- GAME OVER OVERLAY --- */}
      {gameState.status === 'GAME_OVER' && (
        <MenuOverlay tone="danger" zIndex={50}>
          <div className="w-full max-w-md bg-[#130914] border-2 border-red-700/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-red-950/80 border border-red-600 flex items-center justify-center text-red-400">
              <Skull size={32} />
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-red-400 font-bold mb-1">
                Fallen in the Sanctum
              </div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-red-400">
                DEFEATED BY THE SWARM
              </h2>
            </div>

            {/* Gold Earned & Vault Display */}
            <div className="w-full bg-amber-950/40 border border-amber-800/40 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Coins size={15} />
                <span>Gold Earned: +{runGold}g</span>
              </div>
              <div className="font-bold text-amber-400">
                Vault: {persistentGold}g
              </div>
            </div>

            <div className="w-full bg-black/60 p-3 rounded-xl border border-red-950 text-xs text-slate-300 flex justify-around">
              <div>
                <div className="text-slate-400 text-[10px]">Survival Time</div>
                <div className="font-bold text-slate-100 text-sm">{formatTime(gameState.timer || 0)}</div>
              </div>
              <div className="border-r border-slate-800" />
              <div>
                <div className="text-slate-400 text-[10px]">Kills</div>
                <div className="font-bold text-rose-400 text-sm">{killCount}</div>
              </div>
              <div className="border-r border-slate-800" />
              <div>
                <div className="text-slate-400 text-[10px]">Final Level</div>
                <div className="font-bold text-sky-400 text-sm">Lv. {gameState.level}</div>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => initGame(selectedHeroIndex)}
                onPointerEnter={() => setEndScreenFocusIndex(0)}
                className={`w-full py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-sm md:text-base ${
                  endScreenFocusIndex === 0
                    ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02] shadow-xl shadow-red-950/60'
                    : 'bg-red-800/80 hover:bg-red-700 text-slate-200'
                }`}>
                <RotateCw size={18} />
                <span>QUICK RESTART [A / Enter]</span>
              </button>

              <button
                onClick={() => {
                  refreshPersistentGold();
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                onPointerEnter={() => setEndScreenFocusIndex(1)}
                className={`w-full py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 font-semibold text-xs border ${
                  endScreenFocusIndex === 1
                    ? 'bg-slate-700 text-white ring-4 ring-sky-300 ring-offset-2 ring-offset-slate-950 scale-[1.02] border-sky-400'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}>
                <span>SANCTUM & CHAMPIONS [B / Esc]</span>
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- VICTORY OVERLAY --- */}
      {gameState.status === 'VICTORY' && (
        <MenuOverlay tone="victory" zIndex={50}>
          <div className="w-full max-w-md bg-[#091512] border-2 border-emerald-600/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500 flex items-center justify-center text-emerald-400">
              <Trophy size={32} />
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">
                Triumphant Victory
              </div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
                ABYSSAL TITAN VANQUISHED!
              </h2>
            </div>

            {/* Gold Earned & Vault Display */}
            <div className="w-full bg-amber-950/40 border border-amber-800/40 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Coins size={15} />
                <span>Gold Earned: +{runGold}g</span>
              </div>
              <div className="font-bold text-amber-400">
                Vault: {persistentGold}g
              </div>
            </div>

            <div className="w-full bg-black/60 p-3 rounded-xl border border-emerald-950 text-xs text-slate-300 flex justify-around">
              <div>
                <div className="text-slate-400 text-[10px]">Final Score</div>
                <div className="font-bold text-emerald-400 text-sm">{gameState.score}</div>
              </div>
              <div className="border-r border-slate-800" />
              <div>
                <div className="text-slate-400 text-[10px]">Time</div>
                <div className="font-bold text-slate-100 text-sm">{formatTime(gameState.timer || 0)}</div>
              </div>
              <div className="border-r border-slate-800" />
              <div>
                <div className="text-slate-400 text-[10px]">Kills</div>
                <div className="font-bold text-rose-400 text-sm">{killCount}</div>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => initGame(selectedHeroIndex)}
                onPointerEnter={() => setEndScreenFocusIndex(0)}
                className={`w-full py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-sm md:text-base ${
                  endScreenFocusIndex === 0
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02] shadow-xl shadow-emerald-950/60'
                    : 'bg-emerald-800/80 hover:bg-emerald-700 text-slate-200'
                }`}>
                <RotateCw size={18} />
                <span>SURVIVE AGAIN [A / Enter]</span>
              </button>

              <button
                onClick={() => {
                  refreshPersistentGold();
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                onPointerEnter={() => setEndScreenFocusIndex(1)}
                className={`w-full py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 font-semibold text-xs border ${
                  endScreenFocusIndex === 1
                    ? 'bg-slate-700 text-white ring-4 ring-emerald-300 ring-offset-2 ring-offset-slate-950 scale-[1.02] border-emerald-400'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}>
                <span>SANCTUM & CHAMPIONS [B / Esc]</span>
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}
