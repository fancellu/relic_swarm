import {EnemyEntity} from '../types/entities';

export function distanceSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(distanceSq(x1, y1, x2, y2));
}

export function checkCircleCollision(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
): boolean {
  const rSum = r1 + r2;
  return distanceSq(x1, y1, x2, y2) <= rSum * rSum;
}

export function findNearestEnemy(
  x: number,
  y: number,
  enemies: EnemyEntity[],
  maxRange = Infinity,
): {enemy: EnemyEntity | null; distSq: number} {
  let nearest: EnemyEntity | null = null;
  let minDistanceSq = maxRange * maxRange;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.hp <= 0) continue;
    const dSq = distanceSq(x, y, e.x, e.y);
    if (dSq < minDistanceSq) {
      minDistanceSq = dSq;
      nearest = e;
    }
  }

  return {enemy: nearest, distSq: minDistanceSq};
}

export function findEnemiesInRange(
  x: number,
  y: number,
  enemies: EnemyEntity[],
  range: number,
): EnemyEntity[] {
  const rangeSq = range * range;
  const result: EnemyEntity[] = [];

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.hp <= 0) continue;
    if (distanceSq(x, y, e.x, e.y) <= rangeSq) {
      result.push(e);
    }
  }

  return result;
}
