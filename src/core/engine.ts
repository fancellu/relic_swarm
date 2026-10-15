import {DamageNumber, ParticleEntity} from '../types/entities';

export interface CameraState {
  x: number;
  y: number;
}

export function updateCamera(
  camera: CameraState,
  targetX: number,
  targetY: number,
  dt: number,
  lerpRate = 8,
): void {
  const factor = 1 - Math.exp(-dt * lerpRate);
  camera.x += (targetX - camera.x) * factor;
  camera.y += (targetY - camera.y) * factor;
}

export function updateScreenShake(currentShake: number, dt: number, decayRate = 25): number {
  return Math.max(0, currentShake - dt * decayRate);
}

export function getScreenShakeOffset(shake: number): {shakeX: number; shakeY: number} {
  if (shake <= 0) return {shakeX: 0, shakeY: 0};
  return {
    shakeX: (Math.random() * 2 - 1) * shake,
    shakeY: (Math.random() * 2 - 1) * shake,
  };
}

export function drawArenaFloor(
  ctx: CanvasRenderingContext2D,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  arenaBounds = 2500,
): void {
  const bgTileSize = 120;
  const startX = Math.floor((camera.x - canvasWidth / 2 - 200) / bgTileSize) * bgTileSize;
  const endX = Math.ceil((camera.x + canvasWidth / 2 + 200) / bgTileSize) * bgTileSize;
  const startY = Math.floor((camera.y - canvasHeight / 2 - 200) / bgTileSize) * bgTileSize;
  const endY = Math.ceil((camera.y + canvasHeight / 2 + 200) / bgTileSize) * bgTileSize;

  ctx.fillStyle = '#0a0814';
  ctx.fillRect(startX, startY, endX - startX, endY - startY);

  ctx.strokeStyle = '#1a162b';
  ctx.lineWidth = 1.5;
  for (let gx = startX; gx <= endX; gx += bgTileSize) {
    ctx.beginPath();
    ctx.moveTo(gx, startY);
    ctx.lineTo(gx, endY);
    ctx.stroke();
  }
  for (let gy = startY; gy <= endY; gy += bgTileSize) {
    ctx.beginPath();
    ctx.moveTo(startX, gy);
    ctx.lineTo(endX, gy);
    ctx.stroke();
  }

  // Arena Perimeter Bounds
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 4;
  ctx.strokeRect(-arenaBounds, -arenaBounds, arenaBounds * 2, arenaBounds * 2);
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: ParticleEntity[]): void {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawDamageNumbers(ctx: CanvasRenderingContext2D, damageNumbers: DamageNumber[]): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px monospace';
  for (let i = 0; i < damageNumbers.length; i++) {
    const dmg = damageNumbers[i];
    const alpha = dmg.life / dmg.maxLife;
    ctx.fillStyle = dmg.color;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(dmg.text, dmg.x, dmg.y);
  }
  ctx.restore();
}
