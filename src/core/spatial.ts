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

/**
 * High-performance, zero-allocation Spatial Grid for fast 2D neighborhood queries.
 */
export class SpatialGrid {
  private cellSize: number;
  private buckets: Map<number, EnemyEntity[]> = new Map();
  private activeKeys: number[] = [];

  constructor(cellSize = 160) {
    this.cellSize = cellSize;
  }

  public clear(): void {
    for (let i = 0; i < this.activeKeys.length; i++) {
      const bucket = this.buckets.get(this.activeKeys[i]);
      if (bucket) bucket.length = 0;
    }
    this.activeKeys.length = 0;
  }

  private getKey(cellX: number, cellY: number): number {
    return ((cellX + 32768) << 16) | ((cellY + 32768) & 0xffff);
  }

  public insert(enemy: EnemyEntity): void {
    const cx = Math.floor(enemy.x / this.cellSize);
    const cy = Math.floor(enemy.y / this.cellSize);
    const key = this.getKey(cx, cy);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    if (bucket.length === 0) {
      this.activeKeys.push(key);
    }
    bucket.push(enemy);
  }

  public build(enemies: EnemyEntity[]): void {
    this.clear();
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp > 0) {
        this.insert(e);
      }
    }
  }

  /**
   * Iterates through all enemies within the bounding square of (x, y, radius)
   * with zero array allocation.
   */
  public forEachNearby(
    x: number,
    y: number,
    radius: number,
    callback: (enemy: EnemyEntity) => void,
  ): void {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.getKey(cx, cy);
        const bucket = this.buckets.get(key);
        if (bucket && bucket.length > 0) {
          for (let i = 0; i < bucket.length; i++) {
            callback(bucket[i]);
          }
        }
      }
    }
  }
}

export const spatialGrid = new SpatialGrid(160);
