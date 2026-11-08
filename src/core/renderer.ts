import {BOOSTERS} from '../types/boosters';
import {SpriteRenderer} from '../SpriteRenderer';
import {clamp, drawAsset, prepareCanvas} from '../../utils/helper';
import {DerivedStats} from '../entities/Player';
import {SimulationState} from '../types/entities';
import {drawArenaFloor, drawDamageNumbers, drawParticles, getScreenShakeOffset} from './engine';
import {levelManager} from './LevelManager';
import {stageManager} from './Stage';

export function renderGame(
  ctx: CanvasRenderingContext2D,
  sim: SimulationState,
  stats: DerivedStats,
  assets: Record<string, HTMLImageElement>,
  spriteRenderers: Record<string, SpriteRenderer> | null,
  canvasWidth: number,
  canvasHeight: number,
): void {
  prepareCanvas(ctx, canvasWidth, canvasHeight);

  const {shakeX, shakeY} = getScreenShakeOffset(sim.screenShake);

  ctx.save();
  ctx.translate(canvasWidth / 2 - sim.camera.x + shakeX, canvasHeight / 2 - sim.camera.y + shakeY);

  // 1. Dynamic Themed Arena Grid Floor
  const stageMods = levelManager.getModifiers(sim.stage);
  drawArenaFloor(
    ctx,
    sim.camera,
    canvasWidth,
    canvasHeight,
    2500,
    stageMods.floorBgColor,
    stageMods.floorGridColor,
    stageMods.borderAccentColor,
  );

  // 1a. Themed Ground Decals & Mosaic Inlays
  stageManager.renderFloorDecals(ctx, sim.camera, canvasWidth, canvasHeight);

  // 1b. Themed Scenery Obstacles (Pillars, Crypts, Trees, Walls)
  stageManager.renderObstacles(ctx, sim.camera, canvasWidth, canvasHeight);

  // 1c. Render Corrupted Obelisk (Zone & Monolith)
  if (sim.obelisk) {
    const ob = sim.obelisk;
    ctx.save();
    const inZone = sim.inObeliskZone;

    // Outer corruption zone radius (150px)
    ctx.strokeStyle = inZone ? '#ec4899' : '#a855f7';
    ctx.fillStyle = inZone ? 'rgba(236, 72, 153, 0.14)' : 'rgba(168, 85, 247, 0.06)';
    ctx.lineWidth = inZone ? 3 : 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(ob.x, ob.y, ob.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Concentric pulsing inner rune ring
    const pulseRad = ob.radius * (0.55 + Math.sin(sim.runTimer * 4) * 0.05);
    ctx.strokeStyle = inZone ? 'rgba(236, 72, 153, 0.45)' : 'rgba(168, 85, 247, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ob.x, ob.y, pulseRad, 0, Math.PI * 2);
    ctx.stroke();

    // Center Obelisk Monolith Spire
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = inZone ? '#f43f5e' : '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ob.x, ob.y - 36);
    ctx.lineTo(ob.x + 14, ob.y + 16);
    ctx.lineTo(ob.x - 14, ob.y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Floating pulsating crystal above spire
    const crystalY = ob.y - 42 + Math.sin(sim.runTimer * 3.5) * 5;
    ctx.fillStyle = inZone ? '#f43f5e' : '#c084fc';
    ctx.shadowColor = inZone ? '#f43f5e' : '#a855f7';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(ob.x, crystalY - 10);
    ctx.lineTo(ob.x + 7, crystalY);
    ctx.lineTo(ob.x, crystalY + 10);
    ctx.lineTo(ob.x - 7, crystalY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Charge Progress Ring around spire
    const progress = Math.min(1, ob.charge / ob.maxCharge);
    ctx.strokeStyle = inZone ? '#f43f5e' : '#a855f7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ob.x, ob.y, 26, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();

    // Percent text
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#fce7f3';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(ob.charge)}%`, ob.x, ob.y + 32);

    ctx.restore();
  }

  // 1c. Render Cursed Arena (Bone & Fire Walls)
  if (sim.cursedArena && sim.cursedArena.active) {
    const ca = sim.cursedArena;
    const half = ca.size / 2;
    ctx.save();

    // Demonic floor glow wash
    ctx.fillStyle = 'rgba(220, 38, 38, 0.08)';
    ctx.fillRect(ca.x - half, ca.y - half, ca.size, ca.size);

    // Flaming demonic perimeter walls
    ctx.strokeStyle = '#ef4444';
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4;
    ctx.strokeRect(ca.x - half, ca.y - half, ca.size, ca.size);

    // Bone pillars at 4 corners
    const corners = [
      {x: ca.x - half, y: ca.y - half},
      {x: ca.x + half, y: ca.y - half},
      {x: ca.x - half, y: ca.y + half},
      {x: ca.x + half, y: ca.y + half},
    ];
    corners.forEach((c) => {
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    // Floating Blood Trial Timer sign
    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'center';
    ctx.fillText(`BLOOD TRIAL: ${Math.ceil(ca.duration)}s`, ca.x, ca.y - half - 12);

    ctx.restore();
  }

  // 1d. Render Wandering Black Market Merchant Cart
  if (sim.merchant) {
    const mc = sim.merchant;
    ctx.save();

    // Golden ground activation aura
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(mc.x, mc.y, mc.radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Wagon Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(mc.x, mc.y + 16, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wooden cart body
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2;
    ctx.fillRect(mc.x - 22, mc.y - 12, 44, 24);
    ctx.strokeRect(mc.x - 22, mc.y - 12, 44, 24);

    // Cart wheels (left and right)
    ctx.fillStyle = '#451a03';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mc.x - 16, mc.y + 12, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mc.x + 16, mc.y + 12, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Striped canopy (Burgundy & Gold)
    const roofY = mc.y - 24;
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(mc.x - 24, roofY, 48, 14);
    // Gold stripes
    ctx.fillStyle = '#f59e0b';
    for (let s = -20; s <= 20; s += 10) {
      ctx.fillRect(mc.x + s - 3, roofY, 6, 14);
    }
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mc.x - 24, roofY, 48, 14);

    // Lantern on front post
    const lanternY = mc.y - 18 + Math.sin(sim.runTimer * 3) * 2;
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(mc.x - 26, lanternY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Golden Anvil / Cache on wagon
    ctx.fillStyle = '#facc15';
    ctx.fillRect(mc.x - 8, mc.y - 6, 16, 10);

    // Floating sign above cart
    const signY = roofY - 14 + Math.sin(sim.runTimer * 4) * 3;
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.fillText('🎪 BLACK MARKET [TOUCH]', mc.x, signY);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

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

  // 3. Render Radiant Aura / Toxic Sanctuary / Solar Eclipse Weapon
  const auraEquipped = sim.weapons.find((w) => w.id === 'radiant_aura' || w.id === 'toxic_sanctuary' || w.id === 'solar_eclipse');
  if (auraEquipped && assets['effect_radiant_aura']) {
    const isSanctuary = auraEquipped.id === 'toxic_sanctuary';
    const isEclipse = auraEquipped.id === 'solar_eclipse';
    const breathingPulse = isEclipse ? 1 + Math.sin(sim.runTimer * 5) * 0.15 : 1.0;
    const auraRad = isSanctuary
      ? 160 * stats.areaMult
      : isEclipse
      ? 130 * stats.areaMult * breathingPulse
      : (70 + auraEquipped.level * 15) * stats.areaMult;
    const auraImg = assets['effect_radiant_aura'];
    ctx.save();
    ctx.translate(sim.x, sim.y);
    ctx.rotate(sim.auraVisualAngle * (isSanctuary ? 1.5 : isEclipse ? 2.0 : 1));
    ctx.globalAlpha = isSanctuary ? 0.8 : isEclipse ? 0.85 : 0.65;
    if (auraImg && auraImg.complete && auraImg.naturalWidth > 0) {

      ctx.drawImage(auraImg, -auraRad, -auraRad, auraRad * 2, auraRad * 2);
    }
    ctx.restore();
  }

  // 3b. Render Mjolnir's Conduit Pylons and Laser Arcs
  if (sim.conduitPylons && sim.conduitPylons.length > 0) {
    const pylons = sim.conduitPylons;
    ctx.save();
    // Render laser beams between pylons
    for (let a = 0; a < pylons.length; a++) {
      for (let b = a + 1; b < pylons.length; b++) {
        const p1 = pylons[a];
        const p2 = pylons[b];
        const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (segDist < 600) {
          ctx.strokeStyle = '#38bdf8';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }
    // Render pylon nodes
    for (let i = 0; i < pylons.length; i++) {
      const p = pylons[i];
      ctx.fillStyle = '#67e8f9';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. Render Drops & Pickups
  sim.drops.forEach((drop) => {
    if (drop.type === 'blood_chalice') {
      const pulse = 1 + Math.sin(sim.runTimer * 6) * 0.15;
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, 16 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Goblet
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(drop.x - 7, drop.y - 2, 14, 10);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(drop.x, drop.y - 3, 7, 0, Math.PI);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (drop.type === 'booster' && drop.boosterId) {
      // Uncommon pickup: bobbing icon inside a pulsing ring in the booster's colour
      const color = BOOSTERS[drop.boosterId].color;
      const pulse = 0.5 + 0.5 * Math.sin(sim.runTimer * 5 + drop.id);
      const bob = Math.sin(sim.runTimer * 3.5 + drop.id) * 3;
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.12 * pulse;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, 22 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.55 + 0.35 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, 20 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawAsset(ctx, assets[BOOSTER_ASSET_KEYS[drop.boosterId]], drop.x - 15, drop.y - 15 + bob, 30, 30, (fCtx) => {
        fCtx.fillStyle = color;
        fCtx.beginPath();
        fCtx.arc(drop.x, drop.y + bob, 12, 0, Math.PI * 2);
        fCtx.fill();
      });
      return;
    }

    let imgKey = 'item_xp_gem_blue';
    let size = 22;

    if (drop.type === 'xp_purple') {
      imgKey = 'item_xp_gem_purple';
      size = 28;
    } else if (drop.type === 'gold') {
      imgKey = 'item_gold_coin';
      size = 22;
    } else if (drop.type === 'potion') {
      imgKey = 'item_health_potion';
      size = 24;
    } else if (drop.type === 'magnet') {
      imgKey = 'item_magnet_rune';
      size = 26;
    } else if (drop.type === 'chest') {
      imgKey = 'item_treasure_chest';
      size = 32;

      // Opening channel progress ring
      if (drop.isOpening && drop.openingTimer) {
        const progress = Math.min(1, drop.openingTimer / 0.45);
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, 24, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
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

  // 5. Render Enemies & Status Effects
  sim.enemies.forEach((enemy) => {
    const rendererKey =
      enemy.type === 'hound'
        ? 'hound'
        : enemy.type === 'bat'
        ? 'bat'
        : enemy.type === 'titan'
        ? 'titan'
        : 'skeleton';
    const renderer = spriteRenderers?.[rendererKey];

    // Red / Amber pulsing aura for Elites & Bosses
    if (enemy.isElite || enemy.isBoss) {
      const pulse = 1 + Math.sin(sim.runTimer * 6) * 0.15;
      ctx.save();
      ctx.fillStyle = enemy.isBoss
        ? (sim.bossShieldActive ? 'rgba(56, 189, 248, 0.28)' : 'rgba(239, 68, 68, 0.35)')
        : 'rgba(245, 158, 11, 0.35)';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, Math.max(0, enemy.size * 1.6 * pulse), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Tanky variants: make high health and armour readable before you engage
    if (enemy.isBrute || enemy.armor > 0 || enemy.enraged) {
      ctx.save();
      if (enemy.isBrute) {
        // Heavy dark-crimson footprint plus a thick ring
        ctx.fillStyle = 'rgba(127, 29, 29, 0.5)';
        ctx.beginPath();
        ctx.ellipse(enemy.x, enemy.y + enemy.size * 0.55, enemy.size * 1.25, enemy.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, Math.max(0, enemy.size * 1.2), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (enemy.enraged) {
        // Flickering double red ring (distinct from the Brute's steady thick ring)
        const jitter = Math.sin(sim.runTimer * 40 + enemy.id) * 1.5;
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(sim.runTimer * 30 + enemy.id * 2);
        // faint red glow disc so the whole enemy reads as "hot"
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, Math.max(0, enemy.size * 1.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, Math.max(0, enemy.size * 1.5 + jitter), 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, Math.max(0, enemy.size * 1.75 - jitter), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (enemy.armor > 0) {
        // Dashed steel plating ring
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash(ARMOR_RING_DASH);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, Math.max(0, enemy.size * (enemy.isBrute ? 1.4 : 1.25)), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Aegis Force Field & Minion Energy Tethers for Shielded Boss
    if (enemy.isBoss && sim.bossShieldActive) {
      // 1. Tethers to living minions
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1.5;
      let tetherCount = 0;
      for (let m = 0; m < sim.enemies.length && tetherCount < 8; m++) {
        const minion = sim.enemies[m];
        if (!minion.isBoss && minion.hp > 0) {
          const mdist = Math.hypot(minion.x - enemy.x, minion.y - enemy.y);
          if (mdist < 850) {
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y);
            const midX = (enemy.x + minion.x) / 2 + Math.sin(sim.runTimer * 8 + m) * 14;
            const midY = (enemy.y + minion.y) / 2 + Math.cos(sim.runTimer * 8 + m) * 14;
            ctx.quadraticCurveTo(midX, midY, minion.x, minion.y);
            ctx.stroke();
            tetherCount++;
          }
        }
      }
      ctx.restore();

      // 2. Animated Force Field Dome
      const shieldRadius = enemy.size * 2.2;
      const shieldPulse = 1 + Math.sin(sim.runTimer * 5) * 0.04;
      const curRadius = shieldRadius * shieldPulse;

      ctx.save();
      // Translucent dome fill
      ctx.fillStyle = 'rgba(14, 165, 233, 0.16)';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, curRadius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating hexagonal energy boundary
      const hexRot = sim.runTimer * 1.4;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const hAngle = hexRot + (h * Math.PI * 2) / 6;
        const hx = enemy.x + Math.cos(hAngle) * curRadius;
        const hy = enemy.y + Math.sin(hAngle) * curRadius;
        if (h === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();

      // Hexagonal energy nodes
      ctx.fillStyle = '#e0f2fe';
      for (let h = 0; h < 6; h++) {
        const hAngle = hexRot + (h * Math.PI * 2) / 6;
        const hx = enemy.x + Math.cos(hAngle) * curRadius;
        const hy = enemy.y + Math.sin(hAngle) * curRadius;
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Counter-rotating concentric inner ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -sim.runTimer * 20;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, curRadius * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Status Visuals: Slow (Cyan ring) & Poison (Green bubbles) & Burn (Orange fire)
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

    if (enemy.burnTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(249, 115, 22, 0.28)';
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.size * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Fiery embers flickering
      for (let f = 0; f < 2; f++) {
        const fx = enemy.x + Math.sin(sim.runTimer * 8 + f * 2) * enemy.size * 0.5;
        const fy = enemy.y - enemy.size * 0.5 - Math.sin(sim.runTimer * 6 + f) * 8;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const drawSize = (enemy.isBoss ? 160 : enemy.isElite ? 80 : 54) * (enemy.isBrute ? 1.25 : 1);
    if (renderer) {
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

    // Enemy Health Bar
    const isTanky = enemy.isBrute || enemy.armor > 0 || enemy.regenPerSec > 0;
    if (enemy.isElite || enemy.isBoss || isTanky || enemy.enraged || enemy.hp < enemy.maxHp) {
      const barW = enemy.isBoss ? 140 : enemy.isBrute ? 64 : isTanky ? 48 : 40;
      const barH = enemy.isBoss ? 9 : enemy.isBrute ? 6 : 4;
      const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);

      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(enemy.x - barW / 2, enemy.y - drawSize / 2 - 12, barW, barH);

      if (enemy.isBoss && sim.bossShieldActive) {
        // Cyan shielded bar with locked indicator
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(enemy.x - barW / 2, enemy.y - drawSize / 2 - 12, barW, barH);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(enemy.x - barW / 2, enemy.y - drawSize / 2 - 12, barW, barH);
        ctx.fillStyle = '#f0f9ff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AEGIS SHIELD LOCKED', enemy.x, enemy.y - drawSize / 2 - 16);
      } else {
        ctx.fillStyle = enemy.isBoss || enemy.enraged ? '#ef4444' : enemy.poisonTimer > 0 ? '#22c55e' : enemy.burnTimer > 0 ? '#f97316' : '#eab308';
        ctx.fillRect(enemy.x - barW / 2, enemy.y - drawSize / 2 - 12, barW * hpRatio, barH);
      }

      if (isTanky) {
        const barLeft = enemy.x - barW / 2;
        const barY = enemy.y - drawSize / 2 - 12;
        const barMidY = barY + barH / 2;
        if (enemy.isBrute) {
          // Quarter ticks make the huge HP pool readable at a glance
          ctx.fillStyle = '#0f0a1f';
          for (let q = 1; q < 4; q++) ctx.fillRect(barLeft + (barW * q) / 4 - 0.5, barY, 1, barH);
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(barLeft, barY, barW, barH);
        }
        if (enemy.armor > 0) {
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(barLeft - 0.5, barY - 0.5, barW + 1, barH + 1);
          drawShieldGlyph(ctx, barLeft - 8, barMidY);
        }
        if (enemy.regenPerSec > 0) {
          // Heart pulses while healing; dim while regeneration is suppressed by recent damage
          drawHeartGlyph(ctx, barLeft + barW + 8, barMidY, enemy.regenDelay <= 0 && enemy.hp < enemy.maxHp, sim.runTimer);
        }
      }

      if (enemy.enrageLabelTimer > 0) {
        // Big "ENRAGED!" that pops in, bobs, and fades out (crisp stroke + fill, no shadowBlur)
        const age = ENRAGE_LABEL_TOTAL - enemy.enrageLabelTimer;
        const fade = Math.min(1, enemy.enrageLabelTimer / 0.75);
        const pop = age < 0.25 ? 1.6 - (age / 0.25) * 0.6 : 1; // starts large and settles
        const bob = Math.sin(sim.runTimer * 8 + enemy.id) * 2;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(enemy.x, enemy.y - drawSize / 2 - (isTanky ? 26 : 24) + bob);
        ctx.scale(pop, pop);
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1c0505';
        ctx.fillStyle = Math.floor(sim.runTimer * 6) % 2 === 0 ? '#ef4444' : '#fca5a5';
        ctx.strokeText('ENRAGED!', 0, 0);
        ctx.fillText('ENRAGED!', 0, 0);
        ctx.restore();
      }
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
      const speed = Math.hypot(proj.vx, proj.vy);
      const angle = speed > 1 ? Math.atan2(proj.vy, proj.vx) - (3 * Math.PI) / 4 : (sim.runTimer * 6 + proj.id);
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(angle);
      const size = proj.radius * 2.2;
      drawAsset(
        ctx,
        assets['proj_flame_blast'],
        -size / 2,
        -size / 2,
        size,
        size,
        (fCtx) => {
          fCtx.fillStyle = '#f97316';
          fCtx.beginPath();
          fCtx.arc(0, 0, Math.max(0, proj.radius), 0, Math.PI * 2);
          fCtx.fill();
        },
      );
      ctx.restore();
    } else if (proj.type === 'flame_pool') {
      ctx.save();
      const flicker = 1 + Math.sin(sim.runTimer * 10 + proj.id) * 0.08;
      ctx.fillStyle = 'rgba(234, 88, 12, 0.35)';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius * flicker, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(249, 115, 22, 0.55)';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius * 0.6 * flicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (proj.type === 'dagger' || proj.type === 'vortex' || proj.type === 'chakram') {
      const spin = (proj.orbitAngle || 0) + sim.runTimer * (proj.type === 'chakram' ? 14 : 10);
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
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (proj.type === 'beetle') {
      ctx.save();
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (proj.type === 'gilded_disc') {
      const spin = sim.runTimer * 16 + proj.id;
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(spin);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0, proj.radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0, proj.radius * 0.65), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-proj.radius * 0.25, -proj.radius * 0.8, proj.radius * 0.5, proj.radius * 1.6);
      ctx.restore();
    } else if (proj.type === 'shotgun_pellet') {
      ctx.save();
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(0, proj.radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (proj.type === 'homing_missile') {
      const angle = Math.atan2(proj.vy, proj.vx);
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(angle);
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.moveTo(proj.radius * 1.5, 0);
      ctx.lineTo(-proj.radius, -proj.radius * 0.75);
      ctx.lineTo(-proj.radius * 0.45, 0);
      ctx.lineTo(-proj.radius, proj.radius * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (proj.type === 'chain_lightning' && proj.chainEndX !== undefined && proj.chainEndY !== undefined) {
      ctx.save();
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      const midX = (proj.x + proj.chainEndX) / 2 + Math.sin(proj.id * 17) * 10;
      const midY = (proj.y + proj.chainEndY) / 2 + Math.cos(proj.id * 13) * 10;
      ctx.lineTo(midX, midY);
      ctx.lineTo(proj.chainEndX, proj.chainEndY);
      ctx.stroke();
      ctx.restore();
    } else if (proj.type === 'kinetic_wave') {
      // Kinetic Charge release: expanding, fading shockwave ring
      const t = 1 - Math.max(0, proj.duration) / proj.maxDuration;
      const ringRadius = Math.max(0, proj.radius * (0.25 + 0.75 * t));
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, ringRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 6 * (1 - t) + 2;
      ctx.stroke();
      ctx.restore();
    } else if (proj.type === 'beam' && proj.beamEndX !== undefined && proj.beamEndY !== undefined) {
      // Thick glowing lance: layered strokes under additive blending (no shadowBlur / ctx.filter).
      const elapsed = proj.maxDuration - proj.duration;
      const fade = Math.max(0, Math.min(1, elapsed / 0.08, proj.duration / 0.15));
      const flicker = 1 + Math.sin(sim.runTimer * 45 + proj.id) * 0.12;
      const width = proj.radius * 2 * fade * flicker;
      if (width > 0.5) {
        const isPhoenix = proj.sourceWeapon === 'phoenix_ray';
        const isPrism = proj.sourceWeapon === 'frostfire_prism';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(proj.x, proj.y);
        ctx.lineTo(proj.beamEndX, proj.beamEndY);

        // Outer glow: crimson (lance), rose (phoenix) or a cyan frost sheath (prism)
        ctx.globalAlpha = isPrism ? 0.4 : 0.22;
        ctx.strokeStyle = isPhoenix ? '#be185d' : isPrism ? '#0891b2' : '#dc2626';
        ctx.lineWidth = width * 2.1;
        ctx.stroke();

        if (isPrism) {
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = width * 1.35;
          ctx.stroke();
        }

        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = width;
        ctx.stroke();

        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = isPhoenix ? '#fffbeb' : isPrism ? '#ecfeff' : '#fef3c7';
        ctx.lineWidth = width * 0.38;
        ctx.stroke();

        // Impact flare and muzzle glow
        ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = isPhoenix ? '#fde68a' : isPrism ? '#a5f3fc' : '#fdba74';
        ctx.beginPath();
        ctx.arc(proj.beamEndX, proj.beamEndY, width * 0.95, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, width * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (proj.type === 'gravity_well') {
      ctx.save();
      const collapseProgress = proj.duration < 0.25 ? Math.max(0.1, proj.duration / 0.25) : 1;
      const effRadius = proj.radius * (0.35 + 0.65 * collapseProgress);
      const coreRadius = Math.max(8, effRadius * 0.26);

      // 1. Semi-transparent gravitational accretion haze
      ctx.fillStyle =
        proj.sourceWeapon === 'cryo_singularity'
          ? 'rgba(6, 182, 212, 0.16)'
          : proj.sourceWeapon === 'event_horizon'
          ? 'rgba(192, 132, 252, 0.22)'
          : 'rgba(139, 92, 246, 0.18)';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, effRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Event Horizon Boundary Ring
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, effRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Rotating Relativistic Inward Accretion Spiral Arms
      const spin = sim.runTimer * 5.0 + proj.id;
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2.5;
      for (let s = 0; s < 3; s++) {
        const spiralAngle = spin + (s * Math.PI * 2) / 3;
        const startX = proj.x + Math.cos(spiralAngle) * effRadius * 0.88;
        const startY = proj.y + Math.sin(spiralAngle) * effRadius * 0.88;
        const cpX = proj.x + Math.cos(spiralAngle + 0.8) * effRadius * 0.45;
        const cpY = proj.y + Math.sin(spiralAngle + 0.8) * effRadius * 0.45;
        const endX = proj.x + Math.cos(spiralAngle + 1.6) * coreRadius;
        const endY = proj.y + Math.sin(spiralAngle + 1.6) * coreRadius;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();
      }

      // 4. Solid Black Void Singularity Core
      ctx.fillStyle = '#05050d';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      // 5. Bright Core Rim & Center Spark
      ctx.strokeStyle =
        proj.sourceWeapon === 'cryo_singularity'
          ? '#67e8f9'
          : proj.sourceWeapon === 'event_horizon'
          ? '#f3e8ff'
          : '#e9d5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, coreRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = proj.sourceWeapon === 'cryo_singularity' ? '#a5f3fc' : '#ffffff';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(2, coreRadius * 0.25), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else if (proj.type === 'axe') {
      // Spinning axe: its own icon rotated around its centre
      const axeSize = Math.max(40, proj.radius * 3);
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(proj.rotation || 0);
      drawAsset(
        ctx,
        assets[SIG_ASSET_KEYS[proj.sourceWeapon || 'whirling_axe']],
        -axeSize / 2,
        -axeSize / 2,
        axeSize,
        axeSize,
        (fCtx) => {
          fCtx.fillStyle = proj.color;
          fCtx.beginPath();
          fCtx.arc(0, 0, Math.max(0, proj.radius), 0, Math.PI * 2);
          fCtx.fill();
        },
      );
      ctx.restore();
    } else if (proj.type === 'slash') {
      const slashT = 1 - Math.max(0, proj.duration) / proj.maxDuration;
      const slashRot = proj.rotation || 0;
      const slashHalf = proj.arcAngle || 0.8;
      ctx.save();
      ctx.lineCap = 'round';
      if (proj.vx !== 0 || proj.vy !== 0) {
        // Flying crescent (Dawnbreaker): convex edge leads
        ctx.globalAlpha = Math.min(1, proj.duration / 0.2);
        const behind = proj.radius * 0.8;
        const cxs = proj.x - Math.cos(slashRot) * behind;
        const cys = proj.y - Math.sin(slashRot) * behind;
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(cxs, cys, proj.radius * 1.3, slashRot - slashHalf, slashRot + slashHalf);
        ctx.stroke();
        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cxs, cys, proj.radius * 1.3, slashRot - slashHalf, slashRot + slashHalf);
        ctx.stroke();
      } else {
        // Sweep around the hero: a bright crescent that expands and fades
        ctx.globalAlpha = 1 - slashT;
        const sweepR = proj.radius * (0.6 + 0.4 * slashT);
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 16 * (1 - slashT) + 4;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, sweepR, slashRot - slashHalf, slashRot + slashHalf);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5 * (1 - slashT) + 1.5;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, sweepR, slashRot - slashHalf, slashRot + slashHalf);
        ctx.stroke();
      }
      ctx.restore();
    } else if (proj.type === 'meteor') {
      const meteorT = Math.min(1, Math.max(0, 1 - proj.duration / proj.maxDuration));
      // Ground warning: a growing shadow inside the blast outline
      ctx.save();
      ctx.globalAlpha = 0.22 + 0.35 * meteorT;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(0, proj.radius * (0.25 + 0.75 * meteorT)), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.55 + 0.4 * meteorT;
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(0, proj.radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // The rock itself, falling from above
      const meteorSize = 44 + proj.radius * 0.45;
      const meteorY = proj.y - (1 - meteorT) * 320;
      drawAsset(
        ctx,
        assets[SIG_ASSET_KEYS[proj.sourceWeapon || 'meteor_storm']],
        proj.x - meteorSize / 2,
        meteorY - meteorSize / 2,
        meteorSize,
        meteorSize,
        (fCtx) => {
          fCtx.fillStyle = proj.color;
          fCtx.beginPath();
          fCtx.arc(proj.x, meteorY, 14, 0, Math.PI * 2);
          fCtx.fill();
        },
      );
    } else if (proj.type === 'flask') {
      const flaskT = Math.min(1, Math.max(0, 1 - proj.duration / proj.maxDuration));
      const flaskPeak = proj.arcPeakHeight || 60;
      const flaskAlt = 4 * flaskPeak * flaskT * (1 - flaskT);
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(proj.x, proj.y, proj.radius * 0.9, proj.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(proj.x, proj.y - flaskAlt);
      ctx.rotate(proj.rotation || 0);
      const flaskSize = proj.radius * 3.4;
      drawAsset(
        ctx,
        assets[SIG_ASSET_KEYS[proj.sourceWeapon || 'corrosive_flask']],
        -flaskSize / 2,
        -flaskSize / 2,
        flaskSize,
        flaskSize,
        (fCtx) => {
          fCtx.fillStyle = proj.color;
          fCtx.beginPath();
          fCtx.arc(0, 0, Math.max(0, proj.radius), 0, Math.PI * 2);
          fCtx.fill();
        },
      );
      ctx.restore();
    } else if (proj.type === 'acid_pool') {
      const poolFade = Math.min(1, proj.duration / 0.6);
      ctx.save();
      ctx.globalAlpha = 0.42 * poolFade;
      ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(0, proj.radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.75 * poolFade;
      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(0, proj.radius), 0, Math.PI * 2);
      ctx.stroke();
      // Bubbling surface
      ctx.fillStyle = '#d9f99d';
      for (let b = 0; b < 5; b++) {
        const ang = proj.id * 1.7 + b * 1.26;
        const dist = proj.radius * 0.6 * (0.55 + 0.45 * Math.sin(sim.runTimer * 2 + b));
        ctx.beginPath();
        ctx.arc(proj.x + Math.cos(ang) * dist, proj.y + Math.sin(ang) * dist, 2.5 + 1.5 * Math.sin(sim.runTimer * 5 + b * 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (proj.type === 'astral_orb') {
      const orbBob = Math.sin(sim.runTimer * 3 + proj.id) * 2;
      const orbSize = proj.radius * 3.4;
      ctx.save();
      ctx.globalAlpha = 0.22 + 0.1 * Math.sin(sim.runTimer * 4 + proj.id);
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y + orbBob, Math.max(0, proj.radius * 1.9), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawAsset(
        ctx,
        assets[SIG_ASSET_KEYS[proj.sourceWeapon || 'astral_orb']],
        proj.x - orbSize / 2,
        proj.y + orbBob - orbSize / 2,
        orbSize,
        orbSize,
        (fCtx) => {
          fCtx.fillStyle = proj.color;
          fCtx.beginPath();
          fCtx.arc(proj.x, proj.y + orbBob, Math.max(0, proj.radius), 0, Math.PI * 2);
          fCtx.fill();
        },
      );
    } else if (proj.type === 'grenade') {
      const progress = Math.min(1, Math.max(0, 1 - proj.duration / proj.maxDuration));
      const peakHeight = proj.arcPeakHeight || 60;
      const altitude = 4 * peakHeight * progress * (1 - progress);

      // 1. Ground Shadow (telegraphs impact landing position on terrain)
      ctx.save();
      const shadowScale = Math.max(0.4, 1 - (altitude / peakHeight) * 0.45);
      const rx = (proj.radius * 0.85) * shadowScale;
      const ry = (proj.radius * 0.45) * shadowScale;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(proj.x, proj.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Elevated Grenade Sprite (drawn at y - altitude, rotated)
      const renderY = proj.y - altitude;
      const grenadeSize = proj.isCluster ? proj.radius * 2.2 : proj.radius * 2.8;

      ctx.save();
      ctx.translate(proj.x, renderY);
      ctx.rotate(proj.rotation || 0);

      drawAsset(
        ctx,
        assets['proj_grenade'],
        -grenadeSize / 2,
        -grenadeSize / 2,
        grenadeSize,
        grenadeSize,
        (fCtx) => {
          // Fallback geometric pixel grenade if asset is still loading
          fCtx.fillStyle = proj.color;
          fCtx.beginPath();
          fCtx.arc(0, 0, Math.max(0, proj.radius), 0, Math.PI * 2);
          fCtx.fill();
          fCtx.fillStyle = '#ca8a04';
          fCtx.fillRect(-proj.radius * 0.3, -proj.radius * 1.1, proj.radius * 0.6, proj.radius * 0.4);
          fCtx.fillStyle = '#f97316';
          fCtx.beginPath();
          fCtx.arc(0, -proj.radius * 1.2, 3, 0, Math.PI * 2);
          fCtx.fill();
        },
      );
      ctx.restore();
    } else if (proj.isEnemy) {
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(0, proj.radius), 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 7. Render Player Hero (Guaranteed full visibility in Idle and Run)
  const heroSpriteKey = sim.hero?.spriteKey || 'hero_spellblade';
  const heroRenderer = spriteRenderers?.[heroSpriteKey];

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

  // Kinetic Charge: pulsing amber ring while Momentum is full (release sprint to unleash)
  if (sim.momentum >= 100) {
    const pulse = 1 + Math.sin(sim.runTimer * 12) * 0.1;
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sim.x, sim.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (heroRenderer && !isBlinking) {
    // Phase Dash: hero turns translucent while phasing through enemies
    const isDashing = sim.dashTimer > 0;
    if (isDashing) ctx.globalAlpha = 0.5;
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
    if (isDashing) ctx.globalAlpha = 1;
  }

  // 8. Render Particles & Floating Combat Text
  drawParticles(ctx, sim.particles);
  drawDamageNumbers(ctx, sim.damageNumbers);

  ctx.restore();

  // 9. Off-screen Danger Chevrons for Bosses & Elites
  sim.enemies.forEach((enemy) => {
    if (!enemy.isElite && !enemy.isBoss) return;

    const screenX = canvasWidth / 2 + (enemy.x - sim.camera.x);
    const screenY = canvasHeight / 2 + (enemy.y - sim.camera.y);

    const margin = 28;
    const isOffScreen =
      screenX < margin ||
      screenX > canvasWidth - margin ||
      screenY < margin ||
      screenY > canvasHeight - margin;

    if (isOffScreen) {
      const clampX = clamp(screenX, margin, canvasWidth - margin);
      const clampY = clamp(screenY, margin, canvasHeight - margin);
      const angle = Math.atan2(screenY - canvasHeight / 2, screenX - canvasWidth / 2);

      ctx.save();
      ctx.translate(clampX, clampY);
      ctx.rotate(angle);
      ctx.fillStyle = enemy.isBoss ? '#ef4444' : '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  // 10. Off-screen Beacon / Directional Arrow for Corrupted Obelisk
  if (sim.obelisk) {
    const screenX = canvasWidth / 2 + (sim.obelisk.x - sim.camera.x);
    const screenY = canvasHeight / 2 + (sim.obelisk.y - sim.camera.y);
    const margin = 32;
    const isOffScreen =
      screenX < margin ||
      screenX > canvasWidth - margin ||
      screenY < margin ||
      screenY > canvasHeight - margin;

    if (isOffScreen) {
      const clampX = clamp(screenX, margin, canvasWidth - margin);
      const clampY = clamp(screenY, margin, canvasHeight - margin);
      const angle = Math.atan2(screenY - canvasHeight / 2, screenX - canvasWidth / 2);
      const distMeters = Math.round(Math.hypot(sim.obelisk.x - sim.x, sim.obelisk.y - sim.y));

      ctx.save();
      ctx.translate(clampX, clampY);
      ctx.rotate(angle);
      ctx.fillStyle = '#c084fc';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Distance / Label tag beside the pointer
      ctx.save();
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#e9d5ff';
      ctx.textAlign = 'center';
      const labelOffset = 22;
      ctx.fillText(
        `${distMeters}m [${Math.round(sim.obelisk.charge)}%]`,
        clampX,
        clampY + (screenY > canvasHeight - margin ? -12 : labelOffset),
      );
      ctx.restore();
    }
  }

  // 11. Off-screen Beacon / Directional Arrow for Black Market Merchant Cart
  if (sim.merchant) {
    const screenX = canvasWidth / 2 + (sim.merchant.x - sim.camera.x);
    const screenY = canvasHeight / 2 + (sim.merchant.y - sim.camera.y);
    const margin = 32;
    const isOffScreen =
      screenX < margin ||
      screenX > canvasWidth - margin ||
      screenY < margin ||
      screenY > canvasHeight - margin;

    if (isOffScreen) {
      const clampX = clamp(screenX, margin, canvasWidth - margin);
      const clampY = clamp(screenY, margin, canvasHeight - margin);
      const angle = Math.atan2(screenY - canvasHeight / 2, screenX - canvasWidth / 2);
      const distMeters = Math.round(Math.hypot(sim.merchant.x - sim.x, sim.merchant.y - sim.y));

      ctx.save();
      ctx.translate(clampX, clampY);
      ctx.rotate(angle);
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#d97706';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.save();
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      const labelOffset = 22;
      ctx.fillText(
        `🎪 ${distMeters}m`,
        clampX,
        clampY + (screenY > canvasHeight - margin ? -12 : labelOffset),
      );
      ctx.restore();
    }
  }

  // 12. Ambient Weather & Atmospheric Particles (Snow, Embers, Spores, Dust)
  stageManager.updateAndRenderAmbience(ctx, canvasWidth, canvasHeight, 1 / 60);
}

// How long the ENRAGED! label lives in total (must match ENRAGE_LABEL_SECONDS in Spawner.ts); drives its pop-in
const ENRAGE_LABEL_TOTAL = 6;

// Asset keys for hero Signature Weapon icons, keyed by weapon id (module constant: no per-frame string building)
const SIG_ASSET_KEYS: Record<string, string> = {
  whirling_axe: 'sig_whirling_axe',
  bloodreaver: 'sig_bloodreaver',
  thunder_cleaver: 'sig_thunder_cleaver',
  spectral_greatsword: 'sig_spectral_greatsword',
  tempest_oath: 'sig_tempest_oath',
  dawnbreaker: 'sig_dawnbreaker',
  meteor_storm: 'sig_meteor_storm',
  armageddon: 'sig_armageddon',
  collapsing_star: 'sig_collapsing_star',
  corrosive_flask: 'sig_corrosive_flask',
  pandemic_cauldron: 'sig_pandemic_cauldron',
  blight_seekers: 'sig_blight_seekers',
  astral_orb: 'sig_astral_orb',
  astral_singularity: 'sig_astral_singularity',
  storm_orb: 'sig_storm_orb',
};

// Asset keys for Booster pickup icons (module constant: no per-frame string building)
const BOOSTER_ASSET_KEYS: Record<string, string> = {
  burn: 'booster_burn',
  poison: 'booster_poison',
  frost: 'booster_frost',
  knockback: 'booster_knockback',
};

// Shared line-dash pattern for the Armoured plating ring (avoids a per-frame array allocation)
const ARMOR_RING_DASH: number[] = [6, 4];

/** Small steel shield glyph, centred on (x, y), used to flag Armoured enemies. */
function drawShieldGlyph(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 4.5, y - 4);
  ctx.lineTo(x + 4.5, y - 4);
  ctx.lineTo(x + 4.5, y + 1);
  ctx.quadraticCurveTo(x + 4.5, y + 5, x, y + 7);
  ctx.quadraticCurveTo(x - 4.5, y + 5, x - 4.5, y + 1);
  ctx.closePath();
  ctx.fillStyle = '#94a3b8';
  ctx.fill();
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Small heart glyph, centred on (x, y), used to flag Regenerating enemies. Pulses while actively healing. */
function drawHeartGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, healing: boolean, time: number): void {
  const scale = healing ? 1 + Math.sin(time * 10) * 0.2 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(-7, -1, -4, -6, 0, -2.5);
  ctx.bezierCurveTo(4, -6, 7, -1, 0, 4);
  ctx.closePath();
  ctx.fillStyle = healing ? '#f43f5e' : 'rgba(159, 18, 57, 0.6)';
  ctx.fill();
  ctx.strokeStyle = '#fff1f2';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}
