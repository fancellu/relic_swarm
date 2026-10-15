import {getConfig} from '../../constants';
import {gameAudio} from '../../utils/helper';
import {EnemyEntity, SimulationState} from '../types/entities';

export function createEnemy(
  id: number,
  type: EnemyEntity['type'],
  x: number,
  y: number,
  hp: number,
  speed: number,
  damage: number,
  size: number,
  color: string,
  isElite = false,
  isBoss = false,
): EnemyEntity {
  return {
    id,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    speed,
    damage,
    size,
    isElite,
    isBoss,
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
  };
}

export function updateEnemySpawner(sim: SimulationState, dt: number): void {
  const baseSpawnRate = (getConfig('enemySpawnRate') as number) || 1.2;
  const maxEnemiesLimit = (getConfig('maxEnemies') as number) || 250;
  const bossSpawnTime = (getConfig('bossSpawnTimeSeconds') as number) || 300;

  sim.spawnTimer += dt * baseSpawnRate * (1 + sim.runTimer / 180);

  // Boss Titan Spawn Trigger
  if (sim.runTimer >= bossSpawnTime && !sim.bossSpawned) {
    sim.bossSpawned = true;
    const angle = Math.random() * Math.PI * 2;
    sim.enemies.push(
      createEnemy(
        sim.nextEnemyId++,
        'titan',
        sim.x + Math.cos(angle) * 600,
        sim.y + Math.sin(angle) * 600,
        3500,
        90,
        30,
        55,
        '#dc2626',
        true,
        true,
      ),
    );
    gameAudio.playPowerupChime();
  }

  // Wave Spawning
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

      sim.enemies.push(
        createEnemy(
          sim.nextEnemyId++,
          type,
          ex,
          ey,
          hp,
          speed,
          damage,
          size,
          color,
          isElite,
          false,
        ),
      );
    }
  }
}
