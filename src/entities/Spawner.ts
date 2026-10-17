import {getConfig} from '../constants';
import {SpriteRenderer} from '../SpriteRenderer';
import {gameAudio} from '../../utils/helper';
import {addDrop, EnemyEntity, SimulationState} from '../types/entities';
import {MAX_WORLD_CHESTS} from '../types/meta';
import {DerivedStats} from './Player';

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
    burnTimer: 0,
    burnDps: 0,
    burnTickTimer: 0,
  };
}

export function updateEnemySpawner(sim: SimulationState, dt: number): void {
  const baseSpawnRate = (getConfig('enemySpawnRate') as number) || 1.2;
  const maxEnemiesLimit = (getConfig('maxEnemies') as number) || 250;
  const bossSpawnTime = (getConfig('bossSpawnTimeSeconds') as number) || 300;

  // Standing inside Corrupted Obelisk zone increases spawn rate by 30%
  const obeliskSpawnMult = sim.inObeliskZone ? 1.3 : 1.0;
  sim.spawnTimer += dt * baseSpawnRate * (1 + sim.runTimer / 180) * obeliskSpawnMult;

  // Corrupted Obelisk periodic spawning (starts around 35s, recurs every 80s)
  if (!sim.obelisk && sim.runTimer >= 35) {
    sim.obeliskSpawnTimer += dt;
    if (sim.obeliskSpawnTimer >= 80 || sim.runTimer < 36) {
      sim.obeliskSpawnTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = 520 + Math.random() * 120;
      sim.obelisk = {
        id: sim.nextEnemyId++,
        x: sim.x + Math.cos(angle) * spawnDist,
        y: sim.y + Math.sin(angle) * spawnDist,
        radius: 150,
        charge: 0,
        maxCharge: 100,
      };
      gameAudio.playPowerupChime();
    }
  }

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
    const spawnCount = (2 + Math.floor(sim.runTimer / 30)) * (sim.inObeliskZone ? 1.3 : 1);

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

export function updateEnemies(
  sim: SimulationState,
  stats: DerivedStats,
  dt: number,
  spriteRenderers: Record<string, SpriteRenderer> | null,
  spawnDamageNumber: (x: number, y: number, text: string, color: string) => void,
  spawnParticles: (x: number, y: number, count: number, color: string, speed?: number) => void,
  onKillsChange: (kills: number) => void,
  onScoreAdd: (score: number) => void,
  onBossVictory: () => void,
  onPlayerHit: (damage: number) => void,
): boolean {
  let playerDied = false;

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

    // Update Burn DoT
    if (enemy.burnTimer > 0) {
      enemy.burnTimer -= dt;
      enemy.burnTickTimer += dt;
      if (enemy.burnTickTimer >= 0.35) {
        enemy.burnTickTimer = 0;
        const tickDmg = Math.max(1, Math.round(enemy.burnDps * 0.35));
        enemy.hp -= tickDmg;
        spawnDamageNumber(enemy.x, enemy.y, tickDmg.toString(), '#f97316');
        spawnParticles(enemy.x, enemy.y, 2, '#f97316', 50);
      }
    }

    // Update Slow Effect & Obelisk Speed Increase
    let effectiveSpeed = enemy.speed;
    if (enemy.slowTimer > 0) {
      enemy.slowTimer -= dt;
      effectiveSpeed *= Math.max(0.2, 1 - enemy.slowFactor);
    }
    // Standing inside Corrupted Obelisk zone increases enemy speeds by 30%
    if (sim.inObeliskZone) {
      effectiveSpeed *= 1.3;
    }

    // Death Check
    if (enemy.hp <= 0) {
      sim.kills += 1;
      onKillsChange(sim.kills);
      onScoreAdd(enemy.isBoss ? 5000 : enemy.isElite ? 250 : 25);
      spawnParticles(enemy.x, enemy.y, enemy.isBoss ? 30 : enemy.isElite ? 15 : 6, enemy.color, 140);

      // Necrotic Blight death trigger:
      // Afflicted enemies that die explode into homing plague beetles seeking out nearest enemies
      if (enemy.poisonTimer > 0 && sim.weapons.some((w) => w.id === 'necrotic_blight')) {
        const beetleCount = 2 + Math.floor(Math.random() * 2);
        for (let b = 0; b < beetleCount; b++) {
          const bAngle = Math.random() * Math.PI * 2;
          sim.projectiles.push({
            id: sim.nextProjId++,
            type: 'beetle',
            sourceWeapon: 'necrotic_blight',
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(bAngle) * 260,
            vy: Math.sin(bAngle) * 260,
            damage: 38 * stats.mightMult,
            radius: 8 * stats.areaMult,
            duration: 3.5,
            maxDuration: 3.5,
            pierce: 1,
            hitList: [],
            color: '#10b981',
            inflictsPoison: true,
          });
        }
        spawnParticles(enemy.x, enemy.y, 6, '#10b981', 80);
      }

      const currentWorldChests = sim.drops.filter((d) => d.type === 'chest').length;

      if (enemy.isBoss) {
        sim.bossDefeated = true;
        gameAudio.playVictoryFanfare();
        const victoryBonus = 350;
        sim.gold += victoryBonus;
        spawnDamageNumber(sim.x, sim.y, `VICTORY BONUS +${victoryBonus}g!`, '#facc15');

        if (currentWorldChests < MAX_WORLD_CHESTS) {
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'chest',
            x: enemy.x,
            y: enemy.y,
            value: 100,
            attracted: false,
          });
        } else {
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'xp_purple',
            x: enemy.x,
            y: enemy.y,
            value: 150,
            attracted: false,
          });
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'potion',
            x: enemy.x + 20,
            y: enemy.y,
            value: Math.round(sim.maxHp * 0.5),
            attracted: false,
          });
        }

        onBossVictory();
      } else if (enemy.isElite) {
        gameAudio.playConfirmSelect();

        // 35% chance for Elites to drop a Cursed Blood Chalice if not currently in a Cursed Trial
        if (!sim.cursedArena && Math.random() < 0.35) {
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'blood_chalice',
            x: enemy.x,
            y: enemy.y,
            value: 1,
            attracted: false,
          });
        }

        if (currentWorldChests < MAX_WORLD_CHESTS) {
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'chest',
            x: enemy.x,
            y: enemy.y,
            value: 80,
            attracted: false,
          });
        } else {
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'xp_purple',
            x: enemy.x - 15,
            y: enemy.y,
            value: 60,
            attracted: false,
          });
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'gold',
            x: enemy.x,
            y: enemy.y,
            value: Math.round((20 + Math.floor(Math.random() * 10)) * stats.greedMult),
            attracted: false,
          });
          addDrop(sim, {
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
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'xp_blue',
            x: enemy.x,
            y: enemy.y,
            value: 10,
            attracted: false,
          });
        } else if (dropRoll < 0.85) {
          const coinVal = 1 + Math.floor(Math.random() * 3);
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'gold',
            x: enemy.x,
            y: enemy.y,
            value: Math.round(coinVal * stats.greedMult),
            attracted: false,
          });
        } else if (dropRoll < 0.9) {
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'potion',
            x: enemy.x,
            y: enemy.y,
            value: Math.round(sim.maxHp * 0.3),
            attracted: false,
          });
        } else if (dropRoll < 0.93) {
          addDrop(sim, {
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
      onPlayerHit(incomingDmg);

      if (sim.hp <= 0) {
        playerDied = true;
        return playerDied;
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
    const enemyRenderer = spriteRenderers?.[rendererKey];
    if (enemyRenderer) {
      enemy.animState = enemyRenderer.getNextState(enemy.animState, dt);
    }
  }

  return playerDied;
}
