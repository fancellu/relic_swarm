import {gameAudio} from '../../utils/helper';
import {spatialGrid} from '../core/spatial';
import {EnemyEntity, EquippedItem, MAX_PARTICLES, ProjectileEntity, SimulationState} from '../types/entities';
import {ItemDef} from '../types/items';
import {hitEnemy} from './Boosters';
import type {DerivedStats} from './Player';
import {damageEnemy, handleEnemyInvulnerableDeflect, isEnemyInvulnerable} from './Spawner';

// Hero Signature Weapons: one exclusive weapon family per hero (base -> evolution -> fusion).
//   Thorgar  Whirling Axe        -> Bloodreaver        / Thunder Cleaver
//   Roland   Spectral Greatsword -> Tempest Oath       / Dawnbreaker
//   Ignis    Meteor Storm        -> Armageddon         / Collapsing Star
//   Mortis   Corrosive Flask     -> Pandemic Cauldron  / Blight Seekers
//   Vael     Astral Orb          -> Astral Singularity / Storm Orb
// All discrete hits go through hitEnemy() so Boosters apply; continuous chip damage uses damageEnemy().

export const SIGNATURE_WEAPON_IDS = new Set<string>([
  'whirling_axe', 'bloodreaver', 'thunder_cleaver',
  'spectral_greatsword', 'tempest_oath', 'dawnbreaker',
  'meteor_storm', 'armageddon', 'collapsing_star',
  'corrosive_flask', 'pandemic_cauldron', 'blight_seekers',
  'astral_orb', 'astral_singularity', 'storm_orb',
]);

export const SIGNATURE_PROJECTILE_TYPES = new Set<string>(['axe', 'slash', 'meteor', 'flask', 'acid_pool', 'astral_orb']);

/** Signature projectiles that the projectile cap must never prune (slashes are disposable visuals). */
export function isProtectedSignatureType(type: string): boolean {
  return type !== 'slash' && SIGNATURE_PROJECTILE_TYPES.has(type);
}

type SpawnDamageNumber = (x: number, y: number, text: string, color: string) => void;
type SpawnParticles = (x: number, y: number, count: number, color: string, speed?: number) => void;

// --- tuning ---
const AXE_DECEL = 2.4; // outbound speed decay per second
const AXE_RETURN_START_SPEED = 140;
const AXE_RETURN_ACCEL = 1500;
const AXE_RETURN_MAX_SPEED = 950;
const AXE_HIT_COOLDOWN = 0.3; // seconds per enemy, so it hits once outbound and again on the way back
const BLOOD_HEAL_PER_HIT = 1.0;
const BLOOD_HEAL_INTERVAL = 0.15; // caps Bloodreaver lifesteal to ~6.7 HP/s
const CLEAVER_ZAP_CHANCE = 0.3;
const CLEAVER_ZAP_RANGE = 230;
const SLASH_DURATION = 0.28;
const METEOR_FALL_TIME = 0.8;
const METEOR_FALL_HEIGHT = 320;
const ACID_SHRED_PER_SEC = 10; // armour stripped per second while standing in acid
const ORB_CONTACT_COOLDOWN = 0.4;
const ORB_BOLT_RANGE = 300;
const ORB_MAX_BOLTS = 4;

function knockbackFor(enemy: EnemyEntity, normal: number): number {
  return enemy.isBoss ? normal * 0.12 : enemy.isElite || enemy.isBrute ? normal * 0.4 : normal;
}

function nearestEnemy(sim: SimulationState, maxDist: number): EnemyEntity | null {
  let best: EnemyEntity | null = null;
  let bestSq = maxDist * maxDist;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i];
    if (e.hp <= 0) continue;
    const dx = e.x - sim.x;
    const dy = e.y - sim.y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestSq) {
      bestSq = dSq;
      best = e;
    }
  }
  return best;
}

function randomEnemyWithin(sim: SimulationState, maxDist: number): EnemyEntity | null {
  const n = sim.enemies.length;
  for (let tries = 0; tries < 12 && n > 0; tries++) {
    const e = sim.enemies[Math.floor(Math.random() * n)];
    if (e.hp > 0 && Math.hypot(e.x - sim.x, e.y - sim.y) <= maxDist) return e;
  }
  return null;
}

function pushParticle(sim: SimulationState, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, alpha: number): void {
  if (sim.particles.length >= MAX_PARTICLES) return;
  sim.particles.push({x, y, vx, vy, life, maxLife: life, size, color, alpha});
}

function pushChainBolt(sim: SimulationState, fromX: number, fromY: number, toX: number, toY: number, color: string, source: string): void {
  sim.projectiles.push({
    id: sim.nextProjId++,
    type: 'chain_lightning',
    sourceWeapon: source,
    x: fromX,
    y: fromY,
    vx: 0,
    vy: 0,
    damage: 0,
    radius: 0,
    duration: 0.12,
    maxDuration: 0.12,
    pierce: 0,
    hitList: [],
    color,
    chainEndX: toX,
    chainEndY: toY,
  });
}

// ============================================================================================
// Casting (called every frame per equipped signature weapon from updateWeaponCasting)
// ============================================================================================

export function castSignatureWeapon(
  sim: SimulationState,
  wep: EquippedItem,
  def: ItemDef,
  stats: DerivedStats,
  actualCd: number,
  spawnDamageNumber: SpawnDamageNumber,
  spawnParticles: SpawnParticles,
): void {
  const id = wep.id;
  const lv = def.isEvolution ? 5 : wep.level; // evolutions and fusions cast at max-level strength
  const baseDmg = (def.baseDamage || 30) * stats.mightMult * (1 + (wep.level - 1) * 0.2);

  // Orbs are persistent: keep the right number alive instead of using the cooldown
  if (id === 'astral_orb' || id === 'astral_singularity' || id === 'storm_orb') {
    maintainOrbs(sim, wep, def, stats, lv, baseDmg);
    return;
  }

  const timerKey = id;
  if (sim.weaponTimers[timerKey] < actualCd || sim.enemies.length === 0) return;

  if (id === 'whirling_axe' || id === 'bloodreaver' || id === 'thunder_cleaver') {
    castAxes(sim, id, lv, baseDmg, stats, timerKey);
  } else if (id === 'spectral_greatsword' || id === 'tempest_oath' || id === 'dawnbreaker') {
    castBlade(sim, id, lv, baseDmg, stats, timerKey, spawnDamageNumber, spawnParticles);
  } else if (id === 'meteor_storm' || id === 'armageddon' || id === 'collapsing_star') {
    castMeteors(sim, id, lv, baseDmg, stats, timerKey);
  } else if (id === 'corrosive_flask' || id === 'pandemic_cauldron') {
    castFlasks(sim, id, lv, baseDmg, stats, timerKey);
  } else if (id === 'blight_seekers') {
    castSeekers(sim, baseDmg, stats, timerKey);
  }
}

function castAxes(sim: SimulationState, id: string, lv: number, dmg: number, stats: DerivedStats, timerKey: string): void {
  const isReaver = id === 'bloodreaver';
  const isCleaver = id === 'thunder_cleaver';
  const range = (isReaver ? 440 : isCleaver ? 420 : 300 + lv * 25) * stats.areaMult;
  const target = nearestEnemy(sim, range);
  if (!target) return;
  sim.weaponTimers[timerKey] = 0;
  gameAudio.playSwordClash();

  const count = isReaver ? 4 : isCleaver ? 3 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
  const baseAngle = Math.atan2(target.y - sim.y, target.x - sim.x);
  const launchSpeed = range * AXE_DECEL;
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (i - (count - 1) / 2) * 0.55;
    sim.projectiles.push({
      id: sim.nextProjId++,
      type: 'axe',
      sourceWeapon: id,
      x: sim.x,
      y: sim.y,
      vx: Math.cos(angle) * launchSpeed,
      vy: Math.sin(angle) * launchSpeed,
      damage: dmg,
      radius: (isReaver ? 26 : isCleaver ? 22 : 16 + lv * 1.5) * stats.areaMult,
      duration: 4,
      maxDuration: 4,
      pierce: 999,
      hitList: [],
      hitTimes: {},
      color: isReaver ? '#dc2626' : isCleaver ? '#7dd3fc' : '#cbd5e1',
      rotation: Math.random() * Math.PI * 2,
      spinSpeed: 20,
      returning: false,
    });
  }
}

// --- cone sweep (Greatsword family) ---
const cone = {
  sim: null as SimulationState | null,
  x: 0,
  y: 0,
  dirX: 1,
  dirY: 0,
  cosHalf: 0,
  full: false,
  range: 0,
  dmg: 0,
  id: '',
  color: '#e2e8f0',
  spawnDamageNumber: null as SpawnDamageNumber | null,
  spawnParticles: null as SpawnParticles | null,
};

function coneHit(enemy: EnemyEntity): void {
  const sim = cone.sim!;
  if (enemy.hp <= 0) return;
  const dx = enemy.x - cone.x;
  const dy = enemy.y - cone.y;
  const dist = Math.hypot(dx, dy);
  if (dist > cone.range + enemy.size) return;
  if (!cone.full && dist > 1 && (dx * cone.dirX + dy * cone.dirY) / dist < cone.cosHalf) return;
  if (isEnemyInvulnerable(enemy, sim)) {
    handleEnemyInvulnerableDeflect(sim, enemy, cone.spawnDamageNumber!, cone.spawnParticles!);
    return;
  }
  const dealt = hitEnemy(sim, enemy, cone.dmg, cone.id);
  sim.weaponDamageDealt[cone.id] = (sim.weaponDamageDealt[cone.id] || 0) + dealt;
  cone.spawnDamageNumber!(enemy.x, enemy.y, Math.round(dealt).toString(), cone.color);
  if (dist > 1) {
    const push = knockbackFor(enemy, 26);
    enemy.x += (dx / dist) * push;
    enemy.y += (dy / dist) * push;
  }
  if (Math.random() < 0.4) cone.spawnParticles!(enemy.x, enemy.y, 2, cone.color, 90);
}

function castBlade(
  sim: SimulationState,
  id: string,
  lv: number,
  dmg: number,
  stats: DerivedStats,
  timerKey: string,
  spawnDamageNumber: SpawnDamageNumber,
  spawnParticles: SpawnParticles,
): void {
  const isTempest = id === 'tempest_oath';
  const isDawn = id === 'dawnbreaker';
  const range = (isTempest ? 210 : isDawn ? 230 : 130 + lv * 18) * stats.areaMult;
  const target = nearestEnemy(sim, range * 1.15);
  if (!target) return;
  sim.weaponTimers[timerKey] = 0;
  gameAudio.playSwordClash();

  const halfAngle = isTempest ? Math.PI : isDawn ? 1.05 : 0.5 + lv * 0.1;
  const angle = Math.atan2(target.y - sim.y, target.x - sim.x);
  const color = isTempest ? '#67e8f9' : isDawn ? '#fde68a' : '#e2e8f0';

  cone.sim = sim;
  cone.x = sim.x;
  cone.y = sim.y;
  cone.dirX = Math.cos(angle);
  cone.dirY = Math.sin(angle);
  cone.cosHalf = Math.cos(halfAngle);
  cone.full = halfAngle >= Math.PI;
  cone.range = range;
  cone.id = id;
  cone.color = color;
  cone.spawnDamageNumber = spawnDamageNumber;
  cone.spawnParticles = spawnParticles;

  const passes = isTempest ? 2 : 1;
  for (let p = 0; p < passes; p++) {
    cone.dmg = p === 0 ? dmg : dmg * 0.8;
    spatialGrid.forEachNearby(sim.x, sim.y, range + 40, coneHit);
    // Visual crescent(s): the whirlwind spins a full turn during its lifetime
    sim.projectiles.push({
      id: sim.nextProjId++,
      type: 'slash',
      sourceWeapon: id,
      x: sim.x,
      y: sim.y,
      vx: 0,
      vy: 0,
      damage: 0,
      radius: range,
      duration: SLASH_DURATION,
      maxDuration: SLASH_DURATION,
      pierce: 0,
      hitList: [],
      color,
      rotation: angle + p * Math.PI,
      arcAngle: isTempest ? 0.9 : halfAngle,
      spinSpeed: isTempest ? (Math.PI * 2) / SLASH_DURATION : 0,
    });
  }
  cone.sim = null;
  sim.screenShake = Math.max(sim.screenShake, isTempest ? 6 : 3);

  if (isDawn) {
    // A flying crescent of dawnlight that pierces everything it crosses
    sim.projectiles.push({
      id: sim.nextProjId++,
      type: 'slash',
      sourceWeapon: id,
      x: sim.x,
      y: sim.y,
      vx: Math.cos(angle) * 560,
      vy: Math.sin(angle) * 560,
      damage: dmg * 0.8,
      radius: 28 * stats.areaMult,
      duration: 1.1,
      maxDuration: 1.1,
      pierce: 8,
      hitList: [],
      color: '#fcd34d',
      rotation: angle,
      arcAngle: 0.9,
    });
  }
}

function castMeteors(sim: SimulationState, id: string, lv: number, dmg: number, stats: DerivedStats, timerKey: string): void {
  const isArma = id === 'armageddon';
  const isStar = id === 'collapsing_star';
  const count = isArma ? 5 : isStar ? 3 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
  const radius = (isArma ? 150 : isStar ? 120 : 80 + lv * 10) * stats.areaMult;
  let launched = 0;
  for (let i = 0; i < count; i++) {
    const target = randomEnemyWithin(sim, 560);
    if (!target) continue;
    const fall = METEOR_FALL_TIME + i * 0.18;
    sim.projectiles.push({
      id: sim.nextProjId++,
      type: 'meteor',
      sourceWeapon: id,
      x: target.x + (Math.random() * 40 - 20),
      y: target.y + (Math.random() * 40 - 20),
      vx: 0,
      vy: 0,
      damage: dmg,
      radius,
      splashRadius: radius,
      duration: fall,
      maxDuration: fall,
      pierce: 0,
      hitList: [],
      color: isStar ? '#c084fc' : isArma ? '#f43f5e' : '#fb923c',
    });
    launched++;
  }
  if (launched > 0) {
    sim.weaponTimers[timerKey] = 0;
    gameAudio.playArcadeLaser();
  }
}

function castFlasks(sim: SimulationState, id: string, lv: number, dmg: number, stats: DerivedStats, timerKey: string): void {
  const isCauldron = id === 'pandemic_cauldron';
  const count = isCauldron ? 3 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
  let launched = 0;
  for (let i = 0; i < count; i++) {
    const target = randomEnemyWithin(sim, 460);
    if (!target) continue;
    const spread = count > 1 ? (i - (count - 1) / 2) * 0.3 : 0;
    const baseAngle = Math.atan2(target.y - sim.y, target.x - sim.x) + spread;
    const dist = Math.max(80, Math.min(Math.hypot(target.x - sim.x, target.y - sim.y), 450));
    const tx = sim.x + Math.cos(baseAngle) * dist;
    const ty = sim.y + Math.sin(baseAngle) * dist;
    const flight = 0.6 + dist * 0.0006;
    sim.projectiles.push({
      id: sim.nextProjId++,
      type: 'flask',
      sourceWeapon: id,
      x: sim.x,
      y: sim.y,
      vx: (tx - sim.x) / flight,
      vy: (ty - sim.y) / flight,
      damage: dmg,
      radius: 12 * stats.areaMult,
      splashRadius: (isCauldron ? 110 : 55 + lv * 7) * stats.areaMult,
      duration: flight,
      maxDuration: flight,
      pierce: 999,
      hitList: [],
      color: '#84cc16',
      arcStartX: sim.x,
      arcStartY: sim.y,
      arcTargetX: tx,
      arcTargetY: ty,
      arcPeakHeight: Math.min(90, 45 + dist * 0.1),
      rotation: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() > 0.5 ? 1 : -1) * 12,
    });
    launched++;
  }
  if (launched > 0) {
    sim.weaponTimers[timerKey] = 0;
    gameAudio.playArcadeLaser();
  }
}

function castSeekers(sim: SimulationState, dmg: number, stats: DerivedStats, timerKey: string): void {
  let launched = 0;
  for (let i = 0; i < 4; i++) {
    const target = randomEnemyWithin(sim, 520);
    if (!target) continue;
    const targetAngle = Math.atan2(target.y - sim.y, target.x - sim.x);
    const side = i % 2 === 0 ? 1 : -1;
    const angle = targetAngle + side * Math.PI / 2 + (i - 1.5) * 0.1;
    sim.projectiles.push({
      id: sim.nextProjId++,
      type: 'homing_missile',
      sourceWeapon: 'blight_seekers',
      x: sim.x,
      y: sim.y,
      vx: Math.cos(angle) * 320,
      vy: Math.sin(angle) * 320,
      damage: dmg,
      radius: 11 * stats.areaMult,
      duration: 3.5,
      maxDuration: 3.5,
      pierce: 1,
      hitList: [],
      color: '#84cc16',
      targetId: target.id,
    });
    launched++;
  }
  if (launched > 0) {
    sim.weaponTimers[timerKey] = 0;
    gameAudio.playArcadeLaser();
  }
}

function maintainOrbs(sim: SimulationState, wep: EquippedItem, def: ItemDef, stats: DerivedStats, lv: number, dmg: number): void {
  const id = wep.id;
  const isSing = id === 'astral_singularity';
  const isStorm = id === 'storm_orb';
  const wanted = isSing || isStorm ? 3 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
  let existing = 0;
  for (let p = 0; p < sim.projectiles.length; p++) {
    const proj = sim.projectiles[p];
    if (proj.type === 'astral_orb' && proj.sourceWeapon === id) existing++;
  }
  for (let i = existing; i < wanted; i++) {
    sim.projectiles.push({
      id: sim.nextProjId++,
      type: 'astral_orb',
      sourceWeapon: id,
      x: sim.x,
      y: sim.y,
      vx: 0,
      vy: 0,
      damage: dmg,
      radius: 18 * stats.areaMult,
      duration: 9999,
      maxDuration: 9999,
      orbitAngle: (i * Math.PI * 2) / wanted,
      orbitDist: (isSing ? 170 : 140 + lv * 6) * stats.areaMult,
      pierce: 999,
      hitList: [],
      hitTimes: {},
      color: isSing ? '#a855f7' : isStorm ? '#7dd3fc' : '#c4b5fd',
      pulseTimer: 0.25 + Math.random() * 0.3,
      boltCount: isSing ? 3 : isStorm ? 2 : 1 + Math.floor((lv - 1) / 2),
    });
  }
}

// ============================================================================================
// Projectile behaviour (called per frame from updateProjectiles)
// ============================================================================================

export function updateSignatureProjectile(
  sim: SimulationState,
  proj: ProjectileEntity,
  dt: number,
  spawnDamageNumber: SpawnDamageNumber,
  spawnParticles: SpawnParticles,
): void {
  switch (proj.type) {
    case 'axe':
      updateAxe(sim, proj, dt, spawnDamageNumber, spawnParticles);
      break;
    case 'slash':
      updateSlash(sim, proj, dt, spawnDamageNumber, spawnParticles);
      break;
    case 'meteor':
      updateMeteor(sim, proj);
      break;
    case 'flask':
      updateFlask(proj, dt, spawnParticles);
      break;
    case 'acid_pool':
      updateAcidPool(sim, proj, dt);
      break;
    case 'astral_orb':
      updateOrb(sim, proj, dt, spawnDamageNumber, spawnParticles);
      break;
  }
}

// --- Whirling Axe family ---
const axeCtx = {
  sim: null as SimulationState | null,
  proj: null as ProjectileEntity | null,
  spawnDamageNumber: null as SpawnDamageNumber | null,
  spawnParticles: null as SpawnParticles | null,
};
let lastBloodHeal = -1;

function axeHit(enemy: EnemyEntity): void {
  const sim = axeCtx.sim!;
  const proj = axeCtx.proj!;
  if (enemy.hp <= 0) return;
  const last = proj.hitTimes![enemy.id] || -1;
  if (sim.runTimer - last < AXE_HIT_COOLDOWN) return;
  if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) >= proj.radius + enemy.size) return;
  proj.hitTimes![enemy.id] = sim.runTimer;
  if (isEnemyInvulnerable(enemy, sim)) {
    handleEnemyInvulnerableDeflect(sim, enemy, axeCtx.spawnDamageNumber!, axeCtx.spawnParticles!);
    return;
  }
  const dealt = hitEnemy(sim, enemy, proj.damage, proj.sourceWeapon);
  sim.weaponDamageDealt[proj.sourceWeapon!] = (sim.weaponDamageDealt[proj.sourceWeapon!] || 0) + dealt;
  axeCtx.spawnDamageNumber!(enemy.x, enemy.y, Math.round(dealt).toString(), proj.color);
  axeCtx.spawnParticles!(enemy.x, enemy.y, 3, proj.color, 100);

  if (proj.sourceWeapon === 'bloodreaver' && sim.hp > 0 && sim.hp < sim.maxHp && sim.runTimer - lastBloodHeal >= BLOOD_HEAL_INTERVAL) {
    lastBloodHeal = sim.runTimer;
    sim.hp = Math.min(sim.maxHp, sim.hp + BLOOD_HEAL_PER_HIT);
  }
  if (proj.sourceWeapon === 'thunder_cleaver' && Math.random() < CLEAVER_ZAP_CHANCE) {
    let other: EnemyEntity | null = null;
    let bestSq = CLEAVER_ZAP_RANGE * CLEAVER_ZAP_RANGE;
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i];
      if (e === enemy || e.hp <= 0) continue;
      const dx = e.x - enemy.x;
      const dy = e.y - enemy.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestSq) {
        bestSq = dSq;
        other = e;
      }
    }
    if (other && !isEnemyInvulnerable(other, sim)) {
      const zap = hitEnemy(sim, other, proj.damage * 0.6, proj.sourceWeapon);
      sim.weaponDamageDealt[proj.sourceWeapon] = (sim.weaponDamageDealt[proj.sourceWeapon] || 0) + zap;
      axeCtx.spawnDamageNumber!(other.x, other.y, Math.round(zap).toString(), '#7dd3fc');
      pushChainBolt(sim, enemy.x, enemy.y, other.x, other.y, '#7dd3fc', 'thunder_cleaver');
    }
  }
}

function updateAxe(sim: SimulationState, proj: ProjectileEntity, dt: number, spawnDamageNumber: SpawnDamageNumber, spawnParticles: SpawnParticles): void {
  proj.rotation = (proj.rotation || 0) + (proj.spinSpeed || 20) * dt;
  if (!proj.returning) {
    const keep = Math.max(0, 1 - AXE_DECEL * dt);
    proj.vx *= keep;
    proj.vy *= keep;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    if (Math.hypot(proj.vx, proj.vy) < 90) {
      proj.returning = true;
      proj.pulseTimer = AXE_RETURN_START_SPEED; // reused as the current return speed
    }
  } else {
    const speed = Math.min(AXE_RETURN_MAX_SPEED, (proj.pulseTimer || AXE_RETURN_START_SPEED) + AXE_RETURN_ACCEL * dt);
    proj.pulseTimer = speed;
    const dx = sim.x - proj.x;
    const dy = sim.y - proj.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30) {
      proj.duration = 0;
      return;
    }
    const step = Math.min(dist, speed * dt);
    proj.x += (dx / dist) * step;
    proj.y += (dy / dist) * step;
  }
  if (Math.random() < 0.25) pushParticle(sim, proj.x, proj.y, 0, 0, 0.25, 3, proj.color, 0.6);

  axeCtx.sim = sim;
  axeCtx.proj = proj;
  axeCtx.spawnDamageNumber = spawnDamageNumber;
  axeCtx.spawnParticles = spawnParticles;
  spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 50, axeHit);
}

// --- Greatsword flying crescent (Dawnbreaker); anchored slashes are visual only ---
const slashCtx = {
  sim: null as SimulationState | null,
  proj: null as ProjectileEntity | null,
  spawnDamageNumber: null as SpawnDamageNumber | null,
  spawnParticles: null as SpawnParticles | null,
};

function slashHit(enemy: EnemyEntity): void {
  const sim = slashCtx.sim!;
  const proj = slashCtx.proj!;
  if (proj.duration <= 0 || enemy.hp <= 0 || proj.hitList.includes(enemy.id)) return;
  if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) >= proj.radius + enemy.size) return;
  proj.hitList.push(enemy.id);
  if (isEnemyInvulnerable(enemy, sim)) {
    handleEnemyInvulnerableDeflect(sim, enemy, slashCtx.spawnDamageNumber!, slashCtx.spawnParticles!);
  } else {
    const dealt = hitEnemy(sim, enemy, proj.damage, proj.sourceWeapon);
    sim.weaponDamageDealt[proj.sourceWeapon!] = (sim.weaponDamageDealt[proj.sourceWeapon!] || 0) + dealt;
    slashCtx.spawnDamageNumber!(enemy.x, enemy.y, Math.round(dealt).toString(), proj.color);
    slashCtx.spawnParticles!(enemy.x, enemy.y, 3, proj.color, 100);
  }
  proj.pierce -= 1;
  if (proj.pierce <= 0) proj.duration = 0;
}

function updateSlash(sim: SimulationState, proj: ProjectileEntity, dt: number, spawnDamageNumber: SpawnDamageNumber, spawnParticles: SpawnParticles): void {
  proj.rotation = (proj.rotation || 0) + (proj.spinSpeed || 0) * dt;
  if (proj.vx === 0 && proj.vy === 0) {
    // Anchored sweep: follows the hero for its short life
    proj.x = sim.x;
    proj.y = sim.y;
    return;
  }
  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;
  slashCtx.sim = sim;
  slashCtx.proj = proj;
  slashCtx.spawnDamageNumber = spawnDamageNumber;
  slashCtx.spawnParticles = spawnParticles;
  spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 50, slashHit);
}

// --- Meteor Storm family ---
function updateMeteor(sim: SimulationState, proj: ProjectileEntity): void {
  // Embers trail the falling rock
  if (Math.random() < 0.5) {
    const remaining = Math.max(0, proj.duration / METEOR_FALL_TIME);
    pushParticle(sim, proj.x + (Math.random() * 16 - 8), proj.y - METEOR_FALL_HEIGHT * remaining, 0, 40, 0.3, 4, proj.color, 0.7);
  }
}

const blast = {
  sim: null as SimulationState | null,
  x: 0,
  y: 0,
  radius: 0,
  core: 0,
  dmg: 0,
  id: '',
  color: '#fb923c',
  burn: false,
  knock: 60,
  spawnDamageNumber: null as SpawnDamageNumber | null,
  spawnParticles: null as SpawnParticles | null,
};

function blastHit(enemy: EnemyEntity): void {
  const sim = blast.sim!;
  if (enemy.hp <= 0) return;
  const dx = enemy.x - blast.x;
  const dy = enemy.y - blast.y;
  const dist = Math.hypot(dx, dy);
  if (dist > blast.radius + enemy.size) return;
  if (isEnemyInvulnerable(enemy, sim)) {
    handleEnemyInvulnerableDeflect(sim, enemy, blast.spawnDamageNumber!, blast.spawnParticles!);
    return;
  }
  const falloff = dist > blast.core ? Math.max(0.4, 1 - ((dist - blast.core) / Math.max(1, blast.radius - blast.core)) * 0.6) : 1;
  const dealt = hitEnemy(sim, enemy, blast.dmg * falloff, blast.id);
  sim.weaponDamageDealt[blast.id] = (sim.weaponDamageDealt[blast.id] || 0) + dealt;
  blast.spawnDamageNumber!(enemy.x, enemy.y, Math.round(dealt).toString(), blast.color);
  if (blast.burn) {
    enemy.burnTimer = Math.max(enemy.burnTimer, 3.5);
    enemy.burnDps = Math.max(enemy.burnDps, blast.dmg * falloff * 0.35); // pre-armour: burn bypasses armour
  }
  if (dist > 1) {
    const push = knockbackFor(enemy, blast.knock) * falloff;
    enemy.x += (dx / dist) * push;
    enemy.y += (dy / dist) * push;
  }
}

function explodeMeteor(sim: SimulationState, proj: ProjectileEntity, spawnDamageNumber: SpawnDamageNumber, spawnParticles: SpawnParticles): void {
  const id = proj.sourceWeapon || 'meteor_storm';
  blast.sim = sim;
  blast.x = proj.x;
  blast.y = proj.y;
  blast.radius = proj.radius;
  blast.core = proj.radius * 0.35;
  blast.dmg = proj.damage;
  blast.id = id;
  blast.color = proj.color;
  blast.burn = true;
  blast.knock = 60;
  blast.spawnDamageNumber = spawnDamageNumber;
  blast.spawnParticles = spawnParticles;
  spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 50, blastHit);
  blast.sim = null;

  gameAudio.playChiptuneExplosion();
  sim.screenShake = Math.max(sim.screenShake, id === 'armageddon' ? 12 : 8);
  spawnParticles(proj.x, proj.y, 22, proj.color, 200);
  spawnParticles(proj.x, proj.y, 10, '#facc15', 130);

  if (id === 'armageddon') {
    sim.projectiles.push({
      id: sim.nextProjId++,
      type: 'flame_pool',
      sourceWeapon: id,
      x: proj.x,
      y: proj.y,
      vx: 0,
      vy: 0,
      damage: proj.damage * 0.35,
      radius: proj.radius * 0.7,
      duration: 3,
      maxDuration: 3,
      pierce: 999,
      hitList: [],
      color: '#ea580c',
    });
  } else if (id === 'collapsing_star') {
    sim.projectiles.push({
      id: sim.nextProjId++,
      type: 'gravity_well',
      sourceWeapon: id,
      x: proj.x,
      y: proj.y,
      vx: 0,
      vy: 0,
      damage: proj.damage * 0.35,
      radius: proj.radius * 1.1,
      splashRadius: proj.radius * 1.25,
      duration: 1.6,
      maxDuration: 1.6,
      pierce: 999,
      hitList: [],
      hitTimes: {},
      color: '#a855f7',
    });
  }
}

// --- Corrosive Flask family ---
function updateFlask(proj: ProjectileEntity, dt: number, spawnParticles: SpawnParticles): void {
  const progress = Math.min(1, Math.max(0, 1 - proj.duration / proj.maxDuration));
  if (proj.arcStartX !== undefined && proj.arcTargetX !== undefined) {
    proj.x = proj.arcStartX + (proj.arcTargetX - proj.arcStartX) * progress;
    proj.y = proj.arcStartY! + (proj.arcTargetY! - proj.arcStartY!) * progress;
  }
  proj.rotation = (proj.rotation || 0) + (proj.spinSpeed || 12) * dt;
  if (Math.random() < 0.3) spawnParticles(proj.x, proj.y, 1, '#84cc16', 25);
}

export function spawnAcidPool(sim: SimulationState, x: number, y: number, dps: number, radius: number, duration: number, sourceWeapon: string): void {
  sim.projectiles.push({
    id: sim.nextProjId++,
    type: 'acid_pool',
    sourceWeapon,
    x,
    y,
    vx: 0,
    vy: 0,
    damage: dps,
    radius,
    duration,
    maxDuration: duration,
    pierce: 999,
    hitList: [],
    color: '#84cc16',
  });
}

function shatterFlask(sim: SimulationState, proj: ProjectileEntity, spawnDamageNumber: SpawnDamageNumber, spawnParticles: SpawnParticles): void {
  const id = proj.sourceWeapon || 'corrosive_flask';
  const isCauldron = id === 'pandemic_cauldron';
  const poolRadius = proj.splashRadius || 70;

  // Glass-shatter splash, then the acid pool takes over
  blast.sim = sim;
  blast.x = proj.x;
  blast.y = proj.y;
  blast.radius = Math.min(poolRadius, 70);
  blast.core = blast.radius * 0.5;
  blast.dmg = proj.damage * 0.8;
  blast.id = id;
  blast.color = proj.color;
  blast.burn = false;
  blast.knock = 20;
  blast.spawnDamageNumber = spawnDamageNumber;
  blast.spawnParticles = spawnParticles;
  spatialGrid.forEachNearby(proj.x, proj.y, blast.radius + 50, blastHit);
  blast.sim = null;

  spawnAcidPool(sim, proj.x, proj.y, proj.damage * (isCauldron ? 1.6 : 1.2), poolRadius, isCauldron ? 6 : 4, id);
  gameAudio.playPotionGulp();
  sim.screenShake = Math.max(sim.screenShake, 4);
  spawnParticles(proj.x, proj.y, 16, '#84cc16', 150);
}

const acidCtx = {
  sim: null as SimulationState | null,
  proj: null as ProjectileEntity | null,
  dt: 0,
};

function acidHit(enemy: EnemyEntity): void {
  const sim = acidCtx.sim!;
  const proj = acidCtx.proj!;
  if (enemy.hp <= 0) return;
  if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) > proj.radius + enemy.size) return;
  if (isEnemyInvulnerable(enemy, sim)) return;
  // Acid is damage over time: it bypasses armour, poisons, and strips armour away for good
  const dealt = damageEnemy(enemy, proj.damage * acidCtx.dt, 0);
  sim.weaponDamageDealt[proj.sourceWeapon!] = (sim.weaponDamageDealt[proj.sourceWeapon!] || 0) + dealt;
  enemy.poisonTimer = Math.max(enemy.poisonTimer, 2.5);
  enemy.poisonDps = Math.max(enemy.poisonDps, proj.damage * 0.4);
  if (enemy.armor > 0) enemy.armor = Math.max(0, enemy.armor - ACID_SHRED_PER_SEC * acidCtx.dt);
}

function updateAcidPool(sim: SimulationState, proj: ProjectileEntity, dt: number): void {
  acidCtx.sim = sim;
  acidCtx.proj = proj;
  acidCtx.dt = dt;
  spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 40, acidHit);
  if (Math.random() < dt * 10) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * proj.radius * 0.8;
    pushParticle(sim, proj.x + Math.cos(a) * r, proj.y + Math.sin(a) * r, 0, -25, 0.5, 3, '#a3e635', 0.7);
  }
}

// --- Astral Orb family ---
const orbCtx = {
  sim: null as SimulationState | null,
  proj: null as ProjectileEntity | null,
  spawnDamageNumber: null as SpawnDamageNumber | null,
  spawnParticles: null as SpawnParticles | null,
  dt: 0,
};
const orbTargets: (EnemyEntity | null)[] = [null, null, null, null];
const orbTargetDist = new Float64Array(ORB_MAX_BOLTS);

function orbContactHit(enemy: EnemyEntity): void {
  const sim = orbCtx.sim!;
  const proj = orbCtx.proj!;
  if (enemy.hp <= 0) return;
  if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) >= proj.radius + enemy.size) return;
  const last = proj.hitTimes![enemy.id] || -1;
  if (sim.runTimer - last < ORB_CONTACT_COOLDOWN) return;
  proj.hitTimes![enemy.id] = sim.runTimer;
  if (isEnemyInvulnerable(enemy, sim)) {
    handleEnemyInvulnerableDeflect(sim, enemy, orbCtx.spawnDamageNumber!, orbCtx.spawnParticles!);
    return;
  }
  const dealt = hitEnemy(sim, enemy, proj.damage * 0.5, proj.sourceWeapon);
  sim.weaponDamageDealt[proj.sourceWeapon!] = (sim.weaponDamageDealt[proj.sourceWeapon!] || 0) + dealt;
  orbCtx.spawnDamageNumber!(enemy.x, enemy.y, Math.round(dealt).toString(), proj.color);
}

function orbPullHit(enemy: EnemyEntity): void {
  const proj = orbCtx.proj!;
  if (enemy.hp <= 0) return;
  const dx = proj.x - enemy.x;
  const dy = proj.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 14 || dist > 210) return;
  const mass = enemy.isBoss ? 0.25 : enemy.isElite || enemy.isBrute ? 0.6 : 1;
  const pull = (1 - dist / 210) * 150 * mass * orbCtx.dt;
  enemy.x += (dx / dist) * pull;
  enemy.y += (dy / dist) * pull;
}

function updateOrb(sim: SimulationState, proj: ProjectileEntity, dt: number, spawnDamageNumber: SpawnDamageNumber, spawnParticles: SpawnParticles): void {
  const id = proj.sourceWeapon;
  // Orbs belong to their weapon: when it is sold, evolved or fused away, its orbs disappear with it
  let owned = false;
  for (let w = 0; w < sim.weapons.length; w++) {
    if (sim.weapons[w].id === id) {
      owned = true;
      break;
    }
  }
  if (!owned) {
    proj.duration = 0;
    return;
  }
  const isSing = id === 'astral_singularity';
  const isStorm = id === 'storm_orb';
  proj.orbitAngle = (proj.orbitAngle || 0) + (isSing ? 0.7 : 0.9) * dt;
  proj.x = sim.x + Math.cos(proj.orbitAngle) * (proj.orbitDist || 140);
  proj.y = sim.y + Math.sin(proj.orbitAngle) * (proj.orbitDist || 140);

  orbCtx.sim = sim;
  orbCtx.proj = proj;
  orbCtx.spawnDamageNumber = spawnDamageNumber;
  orbCtx.spawnParticles = spawnParticles;
  orbCtx.dt = dt;
  spatialGrid.forEachNearby(proj.x, proj.y, proj.radius + 50, orbContactHit);
  if (isSing) spatialGrid.forEachNearby(proj.x, proj.y, 230, orbPullHit);

  // Bolt volley at the nearest enemies in range of the orb
  proj.pulseTimer = (proj.pulseTimer || 0) - dt;
  if (proj.pulseTimer > 0) return;
  proj.pulseTimer = isSing ? 0.28 : isStorm ? 0.55 : 0.45;

  const bolts = Math.min(ORB_MAX_BOLTS, proj.boltCount || 1);
  let found = 0;
  const rangeSq = ORB_BOLT_RANGE * ORB_BOLT_RANGE;
  for (let e = 0; e < sim.enemies.length; e++) {
    const enemy = sim.enemies[e];
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - proj.x;
    const dy = enemy.y - proj.y;
    const dSq = dx * dx + dy * dy;
    if (dSq > rangeSq || (found === bolts && dSq >= orbTargetDist[found - 1])) continue;
    let slot = found < bolts ? found++ : found - 1;
    while (slot > 0 && orbTargetDist[slot - 1] > dSq) {
      orbTargetDist[slot] = orbTargetDist[slot - 1];
      orbTargets[slot] = orbTargets[slot - 1];
      slot--;
    }
    orbTargetDist[slot] = dSq;
    orbTargets[slot] = enemy;
  }
  for (let t = 0; t < found; t++) {
    const enemy = orbTargets[t]!;
    orbTargets[t] = null;
    if (isStorm) {
      sim.projectiles.push({
        id: sim.nextProjId++,
        type: 'thunder',
        sourceWeapon: id,
        x: enemy.x,
        y: enemy.y,
        vx: 0,
        vy: 0,
        damage: proj.damage * 1.6,
        radius: 42,
        duration: 0.35,
        maxDuration: 0.35,
        pierce: 999,
        hitList: [],
        color: '#7dd3fc',
      });
      pushChainBolt(sim, proj.x, proj.y, enemy.x, enemy.y, '#7dd3fc', id!);
    } else {
      if (isEnemyInvulnerable(enemy, sim)) {
        handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
        continue;
      }
      const dealt = hitEnemy(sim, enemy, proj.damage, id);
      sim.weaponDamageDealt[id!] = (sim.weaponDamageDealt[id!] || 0) + dealt;
      spawnDamageNumber(enemy.x, enemy.y, Math.round(dealt).toString(), '#c4b5fd');
      spawnParticles(enemy.x, enemy.y, 3, proj.color, 100);
      pushChainBolt(sim, proj.x, proj.y, enemy.x, enemy.y, proj.color, id!);
    }
  }
}

// ============================================================================================
// Expiry (called when a signature projectile's duration runs out)
// ============================================================================================

export function onSignatureProjectileExpire(
  sim: SimulationState,
  proj: ProjectileEntity,
  spawnDamageNumber: SpawnDamageNumber,
  spawnParticles: SpawnParticles,
): void {
  if (proj.type === 'meteor') explodeMeteor(sim, proj, spawnDamageNumber, spawnParticles);
  else if (proj.type === 'flask') shatterFlask(sim, proj, spawnDamageNumber, spawnParticles);
}
