import {SpriteRenderer} from '../SpriteRenderer';
import {clamp, drawAsset, prepareCanvas} from '../../utils/helper';
import {DerivedStats} from '../entities/Player';
import {SimulationState} from '../types/entities';
import {drawArenaFloor, drawDamageNumbers, drawParticles, getScreenShakeOffset} from './engine';

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

  // 1. Gothic Arena Grid Floor
  drawArenaFloor(ctx, sim.camera, canvasWidth, canvasHeight);

  // 1b. Render Corrupted Obelisk (Zone & Monolith)
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
      if (isEclipse) {
        try {
          ctx.filter = 'hue-rotate(-45deg) saturate(200%) brightness(1.2)';
        } catch (e) {}
      }
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
      ctx.fillStyle = enemy.isBoss ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, Math.max(0, enemy.size * 1.6 * pulse), 0, Math.PI * 2);
      ctx.fill();
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
      ctx.fillStyle = enemy.isBoss ? '#ef4444' : enemy.poisonTimer > 0 ? '#22c55e' : enemy.burnTimer > 0 ? '#f97316' : '#eab308';
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
      if (proj.type === 'chakram') {
        try {
          ctx.filter = 'hue-rotate(160deg) brightness(1.2)';
        } catch (e) {}
      }
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
    } else if (proj.type === 'beetle') {
      ctx.save();
      ctx.fillStyle = '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 6;
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
}
