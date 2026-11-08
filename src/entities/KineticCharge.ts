import {gameAudio} from '../../utils/helper';
import {EnemyEntity, SimulationState} from '../types/entities';
import {spatialGrid} from '../core/spatial';
import {damageEnemy, isEnemyInvulnerable, handleEnemyInvulnerableDeflect} from './Spawner';
import type {DerivedStats} from './Player';

// Kinetic Charge: sprinting builds Momentum; ending a sprint at full Momentum releases a shockwave.
export const MOMENTUM_MAX = 100;
const MOMENTUM_FILL_RATE = 80; // per second while sprinting and moving (~1.25 s to fill)
const MOMENTUM_DECAY_RATE = 20; // per second while not sprinting
const MOMENTUM_DASH_BONUS = 15; // flat kick from each Phase Dash
const SHOCKWAVE_RADIUS = 220;
const SHOCKWAVE_DAMAGE = 75;
const SHOCKWAVE_VISUAL_DURATION = 0.35;

type SpawnDamageNumber = (x: number, y: number, text: string, color: string) => void;
type SpawnParticles = (x: number, y: number, count: number, color: string, speed?: number) => void;

// Shockwave context reused across releases so the enemy callback below is allocated once.
const wave = {
  sim: null as SimulationState | null,
  radius: 0,
  damage: 0,
  spawnDamageNumber: null as SpawnDamageNumber | null,
  spawnParticles: null as SpawnParticles | null,
};

function hitEnemy(enemy: EnemyEntity): void {
  const sim = wave.sim!;
  const dx = enemy.x - sim.x;
  const dy = enemy.y - sim.y;
  const dist = Math.hypot(dx, dy);
  const reach = wave.radius + enemy.size;
  if (dist > reach) return;
  if (isEnemyInvulnerable(enemy, sim)) {
    handleEnemyInvulnerableDeflect(sim, enemy, wave.spawnDamageNumber!, wave.spawnParticles!);
    return;
  }
  const dealt = damageEnemy(enemy, wave.damage);
  sim.weaponDamageDealt['kinetic_charge'] = (sim.weaponDamageDealt['kinetic_charge'] || 0) + dealt;
  wave.spawnDamageNumber!(enemy.x, enemy.y, Math.round(dealt).toString(), '#fbbf24');

  // Strong radial knockback, stronger near the centre
  if (dist > 1) {
    const base = enemy.isBoss ? 12 : enemy.isElite ? 45 : 110;
    const knockback = base * (1 - (dist / reach) * 0.5);
    enemy.x += (dx / dist) * knockback;
    enemy.y += (dy / dist) * knockback;
  }
}

function releaseShockwave(
  sim: SimulationState,
  stats: DerivedStats,
  spawnDamageNumber: SpawnDamageNumber,
  spawnParticles: SpawnParticles,
): void {
  const radius = SHOCKWAVE_RADIUS * stats.areaMult;
  wave.sim = sim;
  wave.radius = radius;
  wave.damage = SHOCKWAVE_DAMAGE * stats.mightMult;
  wave.spawnDamageNumber = spawnDamageNumber;
  wave.spawnParticles = spawnParticles;
  spatialGrid.forEachNearby(sim.x, sim.y, radius + 40, hitEnemy);
  wave.sim = null;

  gameAudio.playChiptuneExplosion();
  sim.screenShake = Math.max(sim.screenShake, 14);
  spawnDamageNumber(sim.x, sim.y - 40, 'KINETIC BURST!', '#fbbf24');
  spawnParticles(sim.x, sim.y, 24, '#fbbf24', 260);

  // Visual-only expanding ring (damage is applied above)
  sim.projectiles.push({
    id: sim.nextProjId++,
    type: 'kinetic_wave',
    x: sim.x,
    y: sim.y,
    vx: 0,
    vy: 0,
    damage: 0,
    radius,
    duration: SHOCKWAVE_VISUAL_DURATION,
    maxDuration: SHOCKWAVE_VISUAL_DURATION,
    pierce: 0,
    hitList: [],
    color: '#fbbf24',
  });
}

/**
 * Call once per simulated step, right after `updatePlayerMovement`.
 * `wasSprinting` / `wasDashing` are the values of `sim.isSprinting` / `sim.dashTimer > 0` before movement ran.
 */
export function updateKineticCharge(
  sim: SimulationState,
  stats: DerivedStats,
  dt: number,
  wasSprinting: boolean,
  wasDashing: boolean,
  spawnDamageNumber: SpawnDamageNumber,
  spawnParticles: SpawnParticles,
): void {
  // Phase Dash synergy: each new dash adds a flat kick
  if (!wasDashing && sim.dashTimer > 0) {
    sim.momentum = Math.min(MOMENTUM_MAX, sim.momentum + MOMENTUM_DASH_BONUS);
  }

  // Release: sprint ended (button let go or stamina ran out) with a full meter
  if (wasSprinting && !sim.isSprinting && sim.momentum >= MOMENTUM_MAX) {
    sim.momentum = 0;
    releaseShockwave(sim, stats, spawnDamageNumber, spawnParticles);
    return;
  }

  const moving = Math.abs(sim.vx) + Math.abs(sim.vy) > 1;
  if (sim.isSprinting) {
    if (moving) sim.momentum = Math.min(MOMENTUM_MAX, sim.momentum + MOMENTUM_FILL_RATE * dt);
  } else if (sim.momentum > 0) {
    sim.momentum = Math.max(0, sim.momentum - MOMENTUM_DECAY_RATE * dt);
  }
}
