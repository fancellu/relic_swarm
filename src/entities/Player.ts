import {getConfig} from '../constants';
import {EnemyEntity, HeroData, SimulationState} from '../types/entities';
import {HEROES} from '../types/items';
import {META_UPGRADES} from '../types/meta';

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

export function calculateDerivedStats(
  sim: SimulationState,
  meta: Record<string, number>,
): DerivedStats {
  const hero = sim.hero || HEROES[0];

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
  const baseSpeedVal = (getConfig('playerBaseSpeed') as number) || 220;
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
  const baseRegen = (hero.regenBonus || 0) + vitalityLevel * 0.5;
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
}

export function applyEnemySlow(enemy: EnemyEntity, factor: number, duration: number): void {
  enemy.slowFactor = Math.max(enemy.slowFactor, factor);
  enemy.slowTimer = Math.max(enemy.slowTimer, duration);
}

export function updatePlayerMovement(
  sim: SimulationState,
  actions: {left: boolean; right: boolean; up: boolean; down: boolean},
  touchJoy: {active: boolean; dx: number; dy: number; sprintTouch: boolean},
  keyboardSprint: boolean,
  gpX: number,
  gpY: number,
  gpSprint: boolean,
  stats: DerivedStats,
  dt: number,
  onStaminaChange: (stamina: number) => void,
  onHpChange: (hp: number) => void,
): void {
  const wantsSprint = keyboardSprint || touchJoy.sprintTouch || gpSprint;
  let speedMultiplier = 1.0;

  if (wantsSprint && sim.stamina > 5) {
    sim.isSprinting = true;
    speedMultiplier = 1.6;
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
  onStaminaChange(Math.round(sim.stamina));

  let moveX = 0;
  let moveY = 0;

  if (actions.left) moveX -= 1;
  if (actions.right) moveX += 1;
  if (actions.up) moveY -= 1;
  if (actions.down) moveY += 1;

  if (touchJoy.active) {
    moveX += touchJoy.dx;
    moveY += touchJoy.dy;
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

  // Cursed Arena Trap Clamping (600x600 barrier walls)
  if (sim.cursedArena && sim.cursedArena.active) {
    const half = sim.cursedArena.size / 2 - 20;
    const minX = sim.cursedArena.x - half;
    const maxX = sim.cursedArena.x + half;
    const minY = sim.cursedArena.y - half;
    const maxY = sim.cursedArena.y + half;

    if (sim.x < minX) {
      sim.x = minX;
      sim.vx = 0;
    } else if (sim.x > maxX) {
      sim.x = maxX;
      sim.vx = 0;
    }
    if (sim.y < minY) {
      sim.y = minY;
      sim.vy = 0;
    } else if (sim.y > maxY) {
      sim.y = maxY;
      sim.vy = 0;
    }
  }

  // Arena Soft Clamping (-2500 to 2500)
  sim.x = Math.max(-2500, Math.min(2500, sim.x));
  sim.y = Math.max(-2500, Math.min(2500, sim.y));

  // Camera Lerp
  sim.camera.x += (sim.x - sim.camera.x) * 8 * dt;
  sim.camera.y += (sim.y - sim.camera.y) * 8 * dt;

  // Invulnerability timer, Aegis Shield decay
  if (sim.invulnTimer > 0) sim.invulnTimer -= dt;
  if (sim.aegisShieldTimer > 0) {
    sim.aegisShieldTimer -= dt;
    if (Math.random() < 0.3) {
      sim.particles.push({
        x: sim.x + (Math.random() * 20 - 10),
        y: sim.y + (Math.random() * 20 - 10),
        vx: (Math.random() * 2 - 1) * 20,
        vy: (Math.random() * 2 - 1) * 20,
        life: 0.3,
        maxLife: 0.3,
        size: 4,
        color: '#06b6d4',
        alpha: 0.8,
      });
    }
  }

  // Passive Regen & Elixir of Vitality Rapid Regen
  let currentRegenRate = stats.baseRegen || 0;
  if (sim.rapidRegenTimer && sim.rapidRegenTimer > 0) {
    sim.rapidRegenTimer -= dt;
    currentRegenRate += 25; // Rapid 25 HP/s healing
    if (Math.random() < 0.2) {
      sim.particles.push({
        x: sim.x + (Math.random() * 20 - 10),
        y: sim.y + (Math.random() * 20 - 10),
        vx: 0,
        vy: -30,
        life: 0.4,
        maxLife: 0.4,
        size: 4,
        color: '#22c55e',
        alpha: 0.8,
      });
    }
  }

  if (currentRegenRate > 0) {
    sim.hp = Math.min(sim.maxHp, sim.hp + currentRegenRate * dt);
    onHpChange(Math.round(sim.hp));
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
}
