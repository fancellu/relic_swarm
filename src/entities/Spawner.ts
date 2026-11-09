import {getConfig} from '../constants';
import {SpriteRenderer} from '../SpriteRenderer';
import {gameAudio} from '../../utils/helper';
import {addDrop, EnemyEntity, SimulationState} from '../types/entities';
import {MAX_WORLD_CHESTS, SWARM_FRENZY_SPEED_MULT} from '../types/meta';
import {randomBoosterId} from '../types/boosters';
import {DerivedStats} from './Player';
import {stageManager} from '../core/Stage';

export function isEnemyInvulnerable(enemy: EnemyEntity, sim: SimulationState): boolean {
  return enemy.isBoss && sim.bossShieldActive;
}

export function handleEnemyInvulnerableDeflect(
  sim: SimulationState,
  enemy: EnemyEntity,
  spawnDamageNumber?: (x: number, y: number, text: string, color: string) => void,
  spawnParticles?: (x: number, y: number, count: number, color: string, speed?: number) => void,
): void {
  if (spawnParticles) {
    spawnParticles(enemy.x, enemy.y, 4, '#38bdf8', 120);
  }
  if (!sim.bossImmuneSoundTimer || sim.runTimer - sim.bossImmuneSoundTimer > 0.28) {
    sim.bossImmuneSoundTimer = sim.runTimer;
    if (spawnDamageNumber) {
      spawnDamageNumber(enemy.x, enemy.y - 35, 'IMMUNE', '#38bdf8');
    }
    gameAudio.playShieldDeflect();
  }
}

/** Seconds without taking damage before a regenerating enemy starts healing again. */
export const REGEN_DELAY = 2.0;
const ARMOR_PERCENT_CUT = 0.3; // armoured enemies shrug off this share of every hit, before flat armour
const ARMOR_MIN_PASSTHROUGH = 0.15; // ...but at least this share of a hit always lands

// Tanky variants: traits roll independently on regular wave spawns (elites roll twice as often).
const BRUTE_UNLOCK_TIME = 45; // seconds into the run
const BRUTE_CHANCE = 0.07;
const ARMORED_UNLOCK_TIME = 70;
const ARMORED_CHANCE = 0.07;
const BRUTE_HP_MULT = 6;
const ARMORED_HP_MULT = 2.5;
const REGEN_HP_MULT = 2;
const ARMOR_BASE = 10; // flat armour at the start of a run...
const ARMOR_PER_MINUTE = 3; // ...plus this much per minute survived (scaled by realm)
const REGEN_UNLOCK_TIME = 90;
const REGEN_CHANCE = 0.06;
const REGEN_PERCENT_PER_SEC = 0.06; // of max HP, once REGEN_DELAY has passed without damage
// Booster drops: uncommon pickups assigned to a weapon. Mostly come from tough enemies.
const BOOSTER_BASE_CHANCE = 0.001;
const BOOSTER_ELITE_BONUS = 0.002;
const BOOSTER_PER_TRAIT_BONUS = 0.08;
const BOOSTER_BOSS_DROPS = 2;
const BOOSTER_MAX_ON_FIELD = 2; // never more than this many unclaimed boosters lying around: keeps them special
const TANK_XP_PER_TRAIT = 1.5; // each trait adds this fraction of a gem's base value

// Enrage: the first time a non-boss enemy is wounded below the threshold it gets one roll to fight back harder.
const ENRAGE_HP_THRESHOLD = 0.3; // fraction of max HP
const ENRAGE_CHANCE = 0.01;
const ENRAGE_SPEED_MULT = 1.5;
const ENRAGE_DAMAGE_MULT = 1.5;
const ENRAGE_LABEL_SECONDS = 6;

/**
 * The single choke point for damaging enemies. Never write `enemy.hp -= x` elsewhere (GEMINI.md).
 * Applies armour (a 30% cut plus flat reduction), pauses regeneration, and returns the damage actually dealt so callers can
 * credit weapon stats and show truthful numbers.
 *
 * `armorScale`: 1 = a discrete hit (default); a frame's `dt` = continuous damage of `dt` seconds
 * (armour is charged per second); 0 = ignores armour (poison/burn ticks, holy bombs).
 */
export function damageEnemy(enemy: EnemyEntity, amount: number, armorScale = 1): number {
  const dealt =
    armorScale > 0 && enemy.armor > 0
      ? Math.max(amount * ARMOR_MIN_PASSTHROUGH, amount * (1 - ARMOR_PERCENT_CUT) - enemy.armor * armorScale)
      : amount;
  enemy.hp -= dealt;
  if (enemy.regenPerSec > 0) enemy.regenDelay = REGEN_DELAY;
  return dealt;
}

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
    armor: 0,
    regenPerSec: 0,
    regenDelay: 0,
    isBrute: false,
    boosterKnockCd: 0,
    enraged: false,
    enrageRolled: false,
    enrageLabelTimer: 0,
  };
}

export function updateEnemySpawner(sim: SimulationState, dt: number): void {
  const baseSpawnRate = (getConfig('enemySpawnRate') as number) || 1.2;
  const maxEnemiesLimit = (getConfig('maxEnemies') as number) || 180;
  const bossSpawnTime = (getConfig('bossSpawnTimeSeconds') as number) || 300;

  const stage = Math.max(1, sim.stage || 1);
  const enemyHpMult = Math.pow(1.10, stage - 1);
  const enemyDamageMult = Math.pow(1.10, stage - 1);

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
      let ox = sim.x + Math.cos(angle) * spawnDist;
      let oy = sim.y + Math.sin(angle) * spawnDist;
      if (!stageManager.isWalkable(ox, oy, 80)) {
        ox = (ox + sim.x) / 2;
        oy = (oy + sim.y) / 2;
      }
      sim.obelisk = {
        id: sim.nextEnemyId++,
        x: ox,
        y: oy,
        radius: 150,
        charge: 0,
        maxCharge: 100,
      };
      gameAudio.playPowerupChime();
    }
  }

  // Wandering Black Market Merchant Cart
  if (!sim.merchant && sim.runTimer >= (sim.nextMerchantSpawnTime || 120)) {
    // Hold next spawn far in future while cart is active; will be rescheduled on single purchase
    sim.nextMerchantSpawnTime = sim.runTimer + 999999;
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 320 + Math.random() * 120;
    let mx = sim.x + Math.cos(angle) * spawnDist;
    let my = sim.y + Math.sin(angle) * spawnDist;
    if (!stageManager.isWalkable(mx, my, 45)) {
      mx = (mx + sim.x) / 2;
      my = (my + sim.y) / 2;
    }
    sim.merchant = {
      id: sim.nextEnemyId++,
      x: mx,
      y: my,
      radius: 38,
      visited: false,
      hasOverdrive: true,
      hasForceUpgrade: true,
      hasCatalyst: true,
    };
    gameAudio.playPowerupChime();
    sim.screenShake = 6;
  }

  // Boss Titan Spawn Trigger
  if (sim.runTimer >= bossSpawnTime && !sim.bossSpawned) {
    sim.bossSpawned = true;
    const baseBossHp = (getConfig('bossBaseHp') as number) || 35000;
    const bossHpMult = Math.pow(1.25, stage - 1);
    const bossHp = Math.round(baseBossHp * bossHpMult);
    const angle = Math.random() * Math.PI * 2;
    const bx = sim.x + Math.cos(angle) * 550;
    const by = sim.y + Math.sin(angle) * 550;

    const bossEnemy = createEnemy(
      sim.nextEnemyId++,
      'titan',
      bx,
      by,
      bossHp,
      90,
      Math.round(30 * enemyDamageMult),
      55,
      '#dc2626',
      true,
      true,
    );
    stageManager.resolveCircleCollision(bossEnemy, bossEnemy.size);
    sim.enemies.push(bossEnemy);

    // Pact of the Swarm: Titan's Wrath summons a twin Titan on the opposite flank
    if (sim.pacts?.includes('titans_wrath')) {
      const twin = createEnemy(
        sim.nextEnemyId++,
        'titan',
        sim.x - Math.cos(angle) * 550,
        sim.y - Math.sin(angle) * 550,
        bossHp,
        90,
        Math.round(30 * enemyDamageMult),
        55,
        '#dc2626',
        true,
        true,
      );
      stageManager.resolveCircleCollision(twin, twin.size);
      sim.enemies.push(twin);
    }

    // Ensure escort minion swarm around the boss
    const minEscort = (getConfig('bossMinionEscortMin') as number) || 60;
    const existingMinions = sim.enemies.filter((e) => !e.isBoss);

    // Leash any stray minions that are too far away (> 1000 units) closer to the arena circle
    for (const m of existingMinions) {
      const mdist = Math.hypot(m.x - sim.x, m.y - sim.y);
      if (mdist > 1000) {
        const a = Math.random() * Math.PI * 2;
        const d = 480 + Math.random() * 180;
        m.x = sim.x + Math.cos(a) * d;
        m.y = sim.y + Math.sin(a) * d;
        stageManager.resolveCircleCollision(m, m.size);
      }
    }

    // Spawn additional escort minions to reach the tripled minion phalanx (min 60)
    const needed = Math.max(0, minEscort - existingMinions.length);
    const waveScaledHp = (30 + (sim.runTimer / 10) * 8) * enemyHpMult;

    for (let i = 0; i < needed; i++) {
      const eAngle = Math.random() * Math.PI * 2;
      const eDist = 80 + Math.random() * 260;
      const ex = bx + Math.cos(eAngle) * eDist;
      const ey = by + Math.sin(eAngle) * eDist;
      const roll = Math.random();
      const type = roll < 0.35 ? 'sorcerer' : roll < 0.65 ? 'hound' : 'skeleton';
      const isElite = Math.random() < 0.15;
      let hp = waveScaledHp * (type === 'sorcerer' ? 1.5 : type === 'hound' ? 1.2 : 1.0);
      if (isElite) hp *= 2.8;

      const escortEnemy = createEnemy(
        sim.nextEnemyId++,
        type,
        ex,
        ey,
        Math.round(hp),
        type === 'hound' ? 160 : type === 'sorcerer' ? 75 : 110,
        Math.round((isElite ? 18 : 12) * enemyDamageMult),
        type === 'sorcerer' ? 26 : type === 'hound' ? 24 : 22,
        isElite ? '#f59e0b' : type === 'sorcerer' ? '#6366f1' : type === 'hound' ? '#8b5cf6' : '#94a3b8',
        isElite,
        false,
      );
      stageManager.resolveCircleCollision(escortEnemy, escortEnemy.size);
      sim.enemies.push(escortEnemy);
    }

    const totalMinions = sim.enemies.filter((e) => !e.isBoss).length;
    sim.bossShieldActive = true;
    sim.bossMinionsInitial = totalMinions;
    sim.bossMinionsRemaining = totalMinions;
    sim.screenShake = 14;
    gameAudio.playPowerupChime();
  }

  // Halt all regular wave spawning while a boss is active on the battlefield
  if (sim.enemies.some((e) => e.isBoss)) {
    return;
  }

  // Wave Spawning
  if (sim.spawnTimer >= 1.0 && sim.enemies.length < maxEnemiesLimit) {
    sim.spawnTimer = 0;
    const spawnCount = (2 + Math.floor(sim.runTimer / 30)) * (sim.inObeliskZone ? 1.3 : 1);

    for (let s = 0; s < spawnCount; s++) {
      if (sim.enemies.length >= maxEnemiesLimit) break;
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = 450 + Math.random() * 200;
      const ex = sim.x + Math.cos(angle) * spawnDist;
      const ey = sim.y + Math.sin(angle) * spawnDist;

      const roll = Math.random();
      let type: EnemyEntity['type'] = 'skeleton';
      let hp = (30 + (sim.runTimer / 10) * 8) * enemyHpMult;
      let speed = 100 + Math.random() * 20;
      let damage = 10 * enemyDamageMult;
      let size = 22;
      let isElite = false;
      let color = '#94a3b8';

      if (roll < 0.15 && sim.runTimer > 40) {
        type = 'hound';
        hp *= 1.4;
        speed = 175;
        damage = 14 * enemyDamageMult;
        size = 24;
        color = '#8b5cf6';
      } else if (roll < 0.35 && sim.runTimer > 20) {
        type = 'bat';
        hp *= 0.8;
        speed = 150;
        damage = 8 * enemyDamageMult;
        size = 20;
        color = '#ec4899';
      } else if (roll < 0.45 && sim.runTimer > 60) {
        type = 'sorcerer';
        hp *= 1.8;
        speed = 70;
        damage = 18 * enemyDamageMult;
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

      // Tanky variants (never applied to bosses or boss escorts)
      const traitChanceMult = isElite ? 2 : 1;
      const isBrute = sim.runTimer > BRUTE_UNLOCK_TIME && Math.random() < BRUTE_CHANCE * traitChanceMult;
      const isArmored = sim.runTimer > ARMORED_UNLOCK_TIME && Math.random() < ARMORED_CHANCE * traitChanceMult;
      const isRegen = sim.runTimer > REGEN_UNLOCK_TIME && Math.random() < REGEN_CHANCE * traitChanceMult;
      if (isBrute) {
        hp *= BRUTE_HP_MULT;
        size *= 1.25;
        speed *= 0.75;
        damage *= 1.3;
      }
      if (isArmored) hp *= ARMORED_HP_MULT;
      if (isRegen) hp *= REGEN_HP_MULT;

      const newEnemy = createEnemy(
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
      );
      newEnemy.isBrute = isBrute;
      if (isArmored) newEnemy.armor = (ARMOR_BASE + ARMOR_PER_MINUTE * (sim.runTimer / 60)) * enemyHpMult;
      if (isRegen) newEnemy.regenPerSec = newEnemy.maxHp * REGEN_PERCENT_PER_SEC;
      stageManager.resolveCircleCollision(newEnemy, newEnemy.size);
      sim.enemies.push(newEnemy);
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
  // Pact of the Swarm: Swarm Frenzy speeds up every enemy
  const pactSpeedMult = sim.pacts?.includes('swarm_frenzy') ? SWARM_FRENZY_SPEED_MULT : 1;

  // Track active boss reference for escort formation leashing
  let activeBossEntity: EnemyEntity | null = null;
  if (sim.bossShieldActive) {
    for (let b = 0; b < sim.enemies.length; b++) {
      if (sim.enemies[b].isBoss) {
        activeBossEntity = sim.enemies[b];
        break;
      }
    }
  }

  for (let i = sim.enemies.length - 1; i >= 0; i--) {
    const enemy = sim.enemies[i];

    // Update Poison DoT
    if (enemy.poisonTimer > 0) {
      enemy.poisonTimer -= dt;
      enemy.poisonTickTimer += dt;
      if (enemy.poisonTickTimer >= 0.4) {
        enemy.poisonTickTimer = 0;
        if (!isEnemyInvulnerable(enemy, sim)) {
          const tickDmg = Math.max(1, Math.round(enemy.poisonDps * 0.4));
          damageEnemy(enemy, tickDmg, 0); // poison bypasses armour
          spawnDamageNumber(enemy.x, enemy.y, tickDmg.toString(), '#22c55e');
          spawnParticles(enemy.x, enemy.y, 2, '#22c55e', 40);
        } else {
          handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
        }
      }
    }

    // Update Burn DoT
    if (enemy.burnTimer > 0) {
      enemy.burnTimer -= dt;
      enemy.burnTickTimer += dt;
      if (enemy.burnTickTimer >= 0.35) {
        enemy.burnTickTimer = 0;
        if (!isEnemyInvulnerable(enemy, sim)) {
          const tickDmg = Math.max(1, Math.round(enemy.burnDps * 0.35));
          damageEnemy(enemy, tickDmg, 0); // burn bypasses armour
          spawnDamageNumber(enemy.x, enemy.y, tickDmg.toString(), '#f97316');
          spawnParticles(enemy.x, enemy.y, 2, '#f97316', 50);
        } else {
          handleEnemyInvulnerableDeflect(sim, enemy, spawnDamageNumber, spawnParticles);
        }
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
    effectiveSpeed *= pactSpeedMult;

    if (enemy.boosterKnockCd > 0) enemy.boosterKnockCd -= dt;

    // Regeneration: resumes once REGEN_DELAY has passed without taking damage (damageEnemy resets it)
    if (enemy.regenPerSec > 0 && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
      if (enemy.regenDelay > 0) enemy.regenDelay -= dt;
      else {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regenPerSec * dt);
        if (Math.random() < dt * 6) spawnParticles(enemy.x, enemy.y - enemy.size * 0.6, 1, '#4ade80', 35);
      }
    }

    // Enrage: one roll the first time a wounded enemy drops below the HP threshold (never bosses)
    if (enemy.enrageLabelTimer > 0) enemy.enrageLabelTimer -= dt;
    if (!enemy.isBoss && !enemy.enrageRolled && enemy.hp > 0 && enemy.hp < enemy.maxHp * ENRAGE_HP_THRESHOLD) {
      enemy.enrageRolled = true;
      if (Math.random() < ENRAGE_CHANCE) {
        enemy.enraged = true;
        enemy.enrageLabelTimer = ENRAGE_LABEL_SECONDS;
        enemy.speed *= ENRAGE_SPEED_MULT;
        enemy.damage *= ENRAGE_DAMAGE_MULT;
        spawnParticles(enemy.x, enemy.y, 14, '#ef4444', 180);
        gameAudio.playEnrageRoar();
      }
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

      let currentWorldChests = 0;
      for (let d = 0; d < sim.drops.length; d++) { if (sim.drops[d].type === 'chest') currentWorldChests++; }

      // Titan's Wrath: the stage is only won once every Titan has fallen
      let otherBossAlive = false;
      if (enemy.isBoss) {
        for (let b = 0; b < sim.enemies.length; b++) {
          const other = sim.enemies[b];
          if (other !== enemy && other.isBoss && other.hp > 0) {
            otherBossAlive = true;
            break;
          }
        }
      }

      if (enemy.isBoss && otherBossAlive) {
        // First twin down: still pays out its spoils, but the fight goes on
        gameAudio.playPowerupChime();
        sim.gold += 350;
        spawnDamageNumber(enemy.x, enemy.y - 40, 'ONE TITAN FALLS! +350g', '#facc15');
        if (currentWorldChests < MAX_WORLD_CHESTS) {
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'chest',
            x: enemy.x,
            y: enemy.y,
            value: 100,
            attracted: false,
          });
        }
      } else if (enemy.isBoss) {
        sim.bossDefeated = true;
        gameAudio.playPowerupChime();
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

        // 10% chance for Elites to drop a Cursed Blood Chalice if not currently in a Cursed Trial
        if (!sim.cursedArena && Math.random() < 0.10) {
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
        // Standard enemy drops: 1-3 gold. Tanky variants always drop a gem worth more per trait.
        const traitCount = (enemy.isBrute ? 1 : 0) + (enemy.armor > 0 ? 1 : 0) + (enemy.regenPerSec > 0 ? 1 : 0);
        const dropRoll = traitCount > 0 ? 0 : Math.random();
        if (dropRoll < 0.7) {
          addDrop(sim, {
            id: sim.nextDropId++,
            type: 'xp_blue',
            x: enemy.x,
            y: enemy.y,
            value: Math.round(10 * (1 + TANK_XP_PER_TRAIT * traitCount)),
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

      // Booster drops: bosses always drop some; elites and tanky variants often; ordinary kills rarely
      let boosterDrops = 0;
      if (enemy.isBoss) {
        boosterDrops = BOOSTER_BOSS_DROPS;
      } else {
        const tankTraits = (enemy.isBrute ? 1 : 0) + (enemy.armor > 0 ? 1 : 0) + (enemy.regenPerSec > 0 ? 1 : 0);
        const boosterChance =
          BOOSTER_BASE_CHANCE + (enemy.isElite ? BOOSTER_ELITE_BONUS : 0) + tankTraits * BOOSTER_PER_TRAIT_BONUS;
        if (Math.random() < boosterChance) boosterDrops = 1;
      }
      if (boosterDrops > 0) {
        // Field cap: only drop into the free slots (a booster must be claimed before more can appear)
        let onField = 0;
        for (let d = 0; d < sim.drops.length; d++) if (sim.drops[d].type === 'booster') onField++;
        boosterDrops = Math.min(boosterDrops, Math.max(0, BOOSTER_MAX_ON_FIELD - onField));
      }
      for (let b = 0; b < boosterDrops; b++) {
        addDrop(sim, {
          id: sim.nextDropId++,
          type: 'booster',
          boosterId: randomBoosterId(),
          x: enemy.x + (b - (boosterDrops - 1) / 2) * 30,
          y: enemy.y - 14,
          value: 1,
          attracted: false,
        });
      }

      const lastEnemy = sim.enemies.pop()!;
      if (i < sim.enemies.length) {
        sim.enemies[i] = lastEnemy;
      }
      continue;
    }

    // Move toward player with effective speed
    const dx = sim.x - enemy.x;
    const dy = sim.y - enemy.y;
    const dist = Math.hypot(dx, dy);

    // Escort swarm speed boost while shielding boss
    if (sim.bossShieldActive && !enemy.isBoss) {
      effectiveSpeed *= 1.2;
      // Leash any stray minion that slipped past 950px away from the boss
      const anchor = activeBossEntity || sim;
      const anchorDx = enemy.x - anchor.x;
      const anchorDy = enemy.y - anchor.y;
      const anchorDist = Math.hypot(anchorDx, anchorDy);
      if (anchorDist > 950) {
        const a = Math.random() * Math.PI * 2;
        const d = 480 + Math.random() * 160;
        enemy.x = anchor.x + Math.cos(a) * d;
        enemy.y = anchor.y + Math.sin(a) * d;
        stageManager.resolveCircleCollision(enemy, enemy.size);
      }
    }

    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;
      enemy.vx = nx * effectiveSpeed;
      enemy.vy = ny * effectiveSpeed;
      enemy.facingLeft = nx < 0;
    }

    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;

    // Solid Scenery Obstacle Collision & Tangential Slide Navigation
    stageManager.resolveCircleCollision(enemy, enemy.size);

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
        const orbCount = Math.min(16, 8 + (Math.max(1, sim.stage || 1) - 1) * 2);
        for (let b = 0; b < orbCount; b++) {
          const bAngle = (b * Math.PI * 2) / orbCount;
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

    // Player Collision (Damage with 0.5s I-frames, Aegis Shield, Phase Dash, and armor reduction)
    const canBeHit = dist < enemy.size + 18 && sim.invulnTimer <= 0 && sim.aegisShieldTimer <= 0;
    if (canBeHit && sim.dashTimer > 0) {
      if (!sim.dashPhased) {
        sim.dashPhased = true;
        spawnDamageNumber(sim.x, sim.y - 30, 'PHASED!', '#a5f3fc');
      }
    } else if (canBeHit) {
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
      enemyRenderer.advanceInPlace(enemy.animState, dt);
    }
  }

  // Track active boss shield and check for Aegis Shield Shatter
  let remainingMinions = 0;
  let activeBoss: EnemyEntity | null = null;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i];
    if (e.isBoss) {
      activeBoss = e;
    } else {
      remainingMinions++;
    }
  }
  sim.bossMinionsRemaining = remainingMinions;

  if (sim.bossShieldActive && remainingMinions === 0 && activeBoss) {
    sim.bossShieldActive = false;
    sim.screenShake = 18;
    spawnParticles(activeBoss.x, activeBoss.y, 45, '#38bdf8', 220);
    spawnParticles(activeBoss.x, activeBoss.y, 30, '#fbbf24', 160);
    spawnDamageNumber(activeBoss.x, activeBoss.y - 45, 'AEGIS SHIELD SHATTERED - ATTACK!', '#38bdf8');
    gameAudio.playShieldBreak();
  }

  return playerDied;
}
