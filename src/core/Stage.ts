import {CameraState} from './engine';

export type ObstacleShape = 'circle' | 'box';
export type SceneryKind =
  | 'pillar'
  | 'wall'
  | 'building'
  | 'tree'
  | 'monument'
  | 'ruin';

export interface SceneryObstacle {
  id: number;
  kind: SceneryKind;
  shape: ObstacleShape;
  x: number;
  y: number;
  // Dimensions
  radius: number; // For circle colliders (and bounding radius for culling)
  width: number; // For box colliders
  height: number;
  // Styling
  color: string;
  accentColor: string;
  detailColor?: string;
  shadowRadius: number;
  variant: number;
  label?: string;
}

export interface FloorDecal {
  type: 'rune' | 'pavement' | 'blood_patch' | 'ice_crack' | 'moss_patch' | 'constellation';
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
}

export interface StageThemeConfig {
  id: string;
  name: string;
  subtitle: string;
  floorBg: string;
  floorGrid: string;
  borderColor: string;
  ambientType: 'dust' | 'blood' | 'snow' | 'spore' | 'void';
  ambientColor: string;
}

export const STAGE_CONFIGS: StageThemeConfig[] = [
  {
    id: 'gothic_sanctum',
    name: 'Gothic Sanctum',
    subtitle: 'Cathedral Courtyard & Holy Cloister',
    floorBg: '#0a0814',
    floorGrid: '#1a162b',
    borderColor: '#e11d48',
    ambientType: 'dust',
    ambientColor: '#facc15',
  },
  {
    id: 'blood_catacombs',
    name: 'Blood Catacombs',
    subtitle: 'Arterial Crypts & Bone Ossuary',
    floorBg: '#14080c',
    floorGrid: '#2b141d',
    borderColor: '#f97316',
    ambientType: 'blood',
    ambientColor: '#ef4444',
  },
  {
    id: 'glacial_abyss',
    name: 'Glacial Abyss',
    subtitle: 'Sub-Zero Chasm & Permafrost Spires',
    floorBg: '#071318',
    floorGrid: '#122932',
    borderColor: '#06b6d4',
    ambientType: 'snow',
    ambientColor: '#e0f2fe',
  },
  {
    id: 'blighted_necropolis',
    name: 'Blighted Necropolis',
    subtitle: 'Decaying Graveyard & Plague Ruins',
    floorBg: '#09140b',
    floorGrid: '#162b1a',
    borderColor: '#22c55e',
    ambientType: 'spore',
    ambientColor: '#84cc16',
  },
  {
    id: 'astral_void',
    name: 'Astral Void',
    subtitle: 'Edge of the Cosmos & Shattered Rifts',
    floorBg: '#12081c',
    floorGrid: '#261438',
    borderColor: '#a855f7',
    ambientType: 'void',
    ambientColor: '#c084fc',
  },
];

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

/**
 * Stage handles deterministic scenery generation, spatial collision indexing,
 * zero-allocation sliding physics, and stage-specific atmospheric rendering.
 */
export class Stage {
  public stageNumber = 1;
  public themeConfig: StageThemeConfig = STAGE_CONFIGS[0];
  public obstacles: SceneryObstacle[] = [];
  public decals: FloorDecal[] = [];

  // Static spatial grid for O(1) obstacle queries
  private cellSize = 250;
  private gridMin = -2500;
  private gridMax = 2500;
  private gridDim = 20; // 5000 / 250 = 20
  private spatialBuckets: SceneryObstacle[][] = [];

  // Ambient screen particles (fixed pool)
  private ambientParticles: AmbientParticle[] = [];
  private readonly MAX_AMBIENT_PARTICLES = 40;

  constructor() {
    // Pre-allocate spatial buckets
    const totalCells = this.gridDim * this.gridDim;
    for (let i = 0; i < totalCells; i++) {
      this.spatialBuckets.push([]);
    }
    // Pre-allocate ambient particles
    for (let i = 0; i < this.MAX_AMBIENT_PARTICLES; i++) {
      this.ambientParticles.push({
        x: Math.random() * 1280,
        y: Math.random() * 720,
        vx: 0,
        vy: 0,
        size: 2,
        alpha: 0.5,
        life: Math.random() * 4,
        maxLife: 4,
      });
    }
    this.generate(1);
  }

  private getCellIndex(cx: number, cy: number): number {
    if (cx < 0 || cx >= this.gridDim || cy < 0 || cy >= this.gridDim) return -1;
    return cy * this.gridDim + cx;
  }

  private worldToGrid(coord: number): number {
    return Math.floor((coord - this.gridMin) / this.cellSize);
  }

  /**
   * Deterministic pseudo-random number generator for consistent scenery per stage seed
   */
  private createSeededRng(seed: number) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /**
   * Generates themed obstacles and ground decals across the 5000x5000 arena.
   * Guarantees that the player spawn at (0, 0) has a 420px open clearing.
   */
  public generate(stageNum: number): void {
    this.stageNumber = stageNum;
    const themeIdx = (stageNum - 1) % STAGE_CONFIGS.length;
    this.themeConfig = STAGE_CONFIGS[themeIdx];
    this.obstacles.length = 0;
    this.decals.length = 0;

    for (let i = 0; i < this.spatialBuckets.length; i++) {
      this.spatialBuckets[i].length = 0;
    }

    const rng = this.createSeededRng(stageNum * 777 + 101);
    let nextId = 1;

    // Helper: test if position overlaps player spawn clearing (420px)
    const isSpawnZone = (x: number, y: number, buffer = 420) => Math.hypot(x, y) < buffer;

    // Helper: test if position overlaps already placed obstacles
    const overlapsExisting = (x: number, y: number, rad: number) => {
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        const dist = Math.hypot(x - o.x, y - o.y);
        if (dist < rad + o.radius + 30) return true;
      }
      return false;
    };

    // 1. Generate Thematic Decals (Walkable ground art)
    const decalCount = 28 + Math.floor(rng() * 8);
    for (let d = 0; d < decalCount; d++) {
      const angle = rng() * Math.PI * 2;
      const dist = 300 + rng() * 1900;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;

      let type: FloorDecal['type'] = 'pavement';
      if (this.themeConfig.id === 'gothic_sanctum') type = d % 2 === 0 ? 'pavement' : 'rune';
      else if (this.themeConfig.id === 'blood_catacombs') type = d % 2 === 0 ? 'blood_patch' : 'rune';
      else if (this.themeConfig.id === 'glacial_abyss') type = 'ice_crack';
      else if (this.themeConfig.id === 'blighted_necropolis') type = d % 2 === 0 ? 'moss_patch' : 'rune';
      else type = 'constellation';

      this.decals.push({
        type,
        x: dx,
        y: dy,
        size: 50 + rng() * 60,
        color: this.themeConfig.borderColor,
        rotation: rng() * Math.PI * 2,
      });
    }

    // 2. Generate Structured Thematic Obstacle Clusters
    // Cluster centers spaced out in quadrants to create natural tactical arenas
    const clusterAngles = [
      0.35, 1.15, 1.95, 2.75, 3.55, 4.35, 5.15, 5.95,
      0.8, 2.3, 3.9, 5.4,
    ];

    for (let c = 0; c < clusterAngles.length; c++) {
      const baseAngle = clusterAngles[c] + (rng() * 0.25 - 0.12);
      const clusterDist = (c < 8 ? 750 : 1450) + rng() * 250;
      const cx = Math.cos(baseAngle) * clusterDist;
      const cy = Math.sin(baseAngle) * clusterDist;

      if (isSpawnZone(cx, cy, 380)) continue;

      // Cluster layout based on theme
      if (this.themeConfig.id === 'gothic_sanctum') {
        // Courtyard: Central Crypt with surrounding pillars
        if (!overlapsExisting(cx, cy, 70)) {
          this.obstacles.push({
            id: nextId++,
            kind: 'building',
            shape: 'box',
            x: cx,
            y: cy,
            width: 140,
            height: 90,
            radius: 85,
            color: '#1e1b2e',
            accentColor: '#e11d48',
            detailColor: '#f59e0b',
            shadowRadius: 85,
            variant: 1,
            label: 'Cathedral Crypt',
          });
        }
        // Colonnade Pillars around the crypt
        const pillarOffsets = [
          [-110, -70], [110, -70],
          [-110, 70], [110, 70],
        ];
        for (const [ox, oy] of pillarOffsets) {
          const px = cx + ox;
          const py = cy + oy;
          if (!isSpawnZone(px, py) && !overlapsExisting(px, py, 26)) {
            this.obstacles.push({
              id: nextId++,
              kind: 'pillar',
              shape: 'circle',
              x: px,
              y: py,
              radius: 24,
              width: 48,
              height: 48,
              color: '#2a243d',
              accentColor: '#f43f5e',
              detailColor: '#cbd5e1',
              shadowRadius: 28,
              variant: 1,
            });
          }
        }
      } else if (this.themeConfig.id === 'blood_catacombs') {
        // Sarcophagus with bone walls
        if (!overlapsExisting(cx, cy, 65)) {
          this.obstacles.push({
            id: nextId++,
            kind: 'monument',
            shape: 'box',
            x: cx,
            y: cy,
            width: 130,
            height: 60,
            radius: 70,
            color: '#1a0d13',
            accentColor: '#ef4444',
            detailColor: '#f97316',
            shadowRadius: 70,
            variant: 2,
            label: 'Crimson Sarcophagus',
          });
        }
        // Bone Wall barriers
        const wallOffsets = [[-90, 60], [90, -60]];
        for (const [ox, oy] of wallOffsets) {
          const wx = cx + ox;
          const wy = cy + oy;
          if (!isSpawnZone(wx, wy) && !overlapsExisting(wx, wy, 45)) {
            this.obstacles.push({
              id: nextId++,
              kind: 'wall',
              shape: 'box',
              x: wx,
              y: wy,
              width: 100,
              height: 36,
              radius: 54,
              color: '#2a141d',
              accentColor: '#e2e8f0',
              detailColor: '#dc2626',
              shadowRadius: 52,
              variant: 2,
            });
          }
        }
      } else if (this.themeConfig.id === 'glacial_abyss') {
        // Ice Monolith Spire & Frozen Pine Copse
        if (!overlapsExisting(cx, cy, 45)) {
          this.obstacles.push({
            id: nextId++,
            kind: 'pillar',
            shape: 'circle',
            x: cx,
            y: cy,
            radius: 36,
            width: 72,
            height: 72,
            color: '#0e2b38',
            accentColor: '#06b6d4',
            detailColor: '#e0f2fe',
            shadowRadius: 40,
            variant: 3,
            label: 'Glacial Monolith',
          });
        }
        // Surrounding Pine Trees
        const treeOffsets = [[-75, -50], [80, 45], [-60, 65]];
        for (const [ox, oy] of treeOffsets) {
          const tx = cx + ox;
          const ty = cy + oy;
          if (!isSpawnZone(tx, ty) && !overlapsExisting(tx, ty, 32)) {
            this.obstacles.push({
              id: nextId++,
              kind: 'tree',
              shape: 'circle',
              x: tx,
              y: ty,
              radius: 26, // Solid trunk collider
              width: 52,
              height: 52,
              color: '#1b3a4b',
              accentColor: '#38bdf8',
              detailColor: '#f0f9ff',
              shadowRadius: 38,
              variant: 3,
            });
          }
        }
      } else if (this.themeConfig.id === 'blighted_necropolis') {
        // Ruined Town Wall Footing with Gnarled Dead Tree
        if (!overlapsExisting(cx, cy, 60)) {
          this.obstacles.push({
            id: nextId++,
            kind: 'ruin',
            shape: 'box',
            x: cx,
            y: cy,
            width: 140,
            height: 38,
            radius: 72,
            color: '#142419',
            accentColor: '#22c55e',
            detailColor: '#84cc16',
            shadowRadius: 70,
            variant: 4,
            label: 'Necropolis Ruins',
          });
        }
        // Gnarled Tree
        const gx = cx + (rng() > 0.5 ? 90 : -90);
        const gy = cy + (rng() > 0.5 ? 65 : -65);
        if (!isSpawnZone(gx, gy) && !overlapsExisting(gx, gy, 32)) {
          this.obstacles.push({
            id: nextId++,
            kind: 'tree',
            shape: 'circle',
            x: gx,
            y: gy,
            radius: 28,
            width: 56,
            height: 56,
            color: '#1a2e20',
            accentColor: '#4ade80',
            detailColor: '#15803d',
            shadowRadius: 40,
            variant: 4,
          });
        }
      } else {
        // Astral Void: Celestial Obelisk with Cosmic Crystal Node
        if (!overlapsExisting(cx, cy, 40)) {
          this.obstacles.push({
            id: nextId++,
            kind: 'monument',
            shape: 'circle',
            x: cx,
            y: cy,
            radius: 34,
            width: 68,
            height: 68,
            color: '#221238',
            accentColor: '#c084fc',
            detailColor: '#e879f9',
            shadowRadius: 38,
            variant: 5,
            label: 'Celestial Obelisk',
          });
        }
        // Floating Void Crystal Nodes
        const cryOffsets = [[-80, -60], [80, 50]];
        for (const [ox, oy] of cryOffsets) {
          const vx = cx + ox;
          const vy = cy + oy;
          if (!isSpawnZone(vx, vy) && !overlapsExisting(vx, vy, 26)) {
            this.obstacles.push({
              id: nextId++,
              kind: 'pillar',
              shape: 'circle',
              x: vx,
              y: vy,
              radius: 22,
              width: 44,
              height: 44,
              color: '#3b1d5e',
              accentColor: '#a855f7',
              detailColor: '#38bdf8',
              shadowRadius: 26,
              variant: 5,
            });
          }
        }
      }
    }

    // 3. Populate Spatial Index Buckets
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      const minX = obs.shape === 'box' ? obs.x - obs.width / 2 : obs.x - obs.radius;
      const maxX = obs.shape === 'box' ? obs.x + obs.width / 2 : obs.x + obs.radius;
      const minY = obs.shape === 'box' ? obs.y - obs.height / 2 : obs.y - obs.radius;
      const maxY = obs.shape === 'box' ? obs.y + obs.height / 2 : obs.y + obs.radius;

      const minGx = Math.max(0, this.worldToGrid(minX));
      const maxGx = Math.min(this.gridDim - 1, this.worldToGrid(maxX));
      const minGy = Math.max(0, this.worldToGrid(minY));
      const maxGy = Math.min(this.gridDim - 1, this.worldToGrid(maxY));

      for (let gx = minGx; gx <= maxGx; gx++) {
        for (let gy = minGy; gy <= maxGy; gy++) {
          const bucketIdx = this.getCellIndex(gx, gy);
          if (bucketIdx >= 0) {
            this.spatialBuckets[bucketIdx].push(obs);
          }
        }
      }
    }
  }

  /**
   * Continuous circle-obstacle collision resolution with zero object allocations.
   * Modifies entity.x and entity.y in place to resolve penetration.
   * If vx/vy are present, slides velocity tangentially along the obstacle surface.
   */
  public resolveCircleCollision(
    entity: {x: number; y: number; vx?: number; vy?: number},
    radius: number,
  ): boolean {
    const minGx = Math.max(0, this.worldToGrid(entity.x - radius));
    const maxGx = Math.min(this.gridDim - 1, this.worldToGrid(entity.x + radius));
    const minGy = Math.max(0, this.worldToGrid(entity.y - radius));
    const maxGy = Math.min(this.gridDim - 1, this.worldToGrid(entity.y + radius));

    let hasCollided = false;

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        const bucketIdx = this.getCellIndex(gx, gy);
        if (bucketIdx < 0) continue;
        const bucket = this.spatialBuckets[bucketIdx];

        for (let i = 0; i < bucket.length; i++) {
          const obs = bucket[i];

          if (obs.shape === 'circle') {
            const dx = entity.x - obs.x;
            const dy = entity.y - obs.y;
            const minDist = radius + obs.radius;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDist * minDist) {
              hasCollided = true;
              const dist = Math.sqrt(distSq) || 0.001;
              const overlap = minDist - dist;
              const nx = dx / dist;
              const ny = dy / dist;

              // Resolve penetration
              entity.x += nx * overlap;
              entity.y += ny * overlap;

              // Slide velocity along tangent
              if (entity.vx !== undefined && entity.vy !== undefined) {
                const dot = entity.vx * nx + entity.vy * ny;
                if (dot < 0) {
                  entity.vx -= dot * nx;
                  entity.vy -= dot * ny;
                }
              }
            }
          } else {
            // Box obstacle
            const halfW = obs.width / 2;
            const halfH = obs.height / 2;
            const minX = obs.x - halfW;
            const maxX = obs.x + halfW;
            const minY = obs.y - halfH;
            const maxY = obs.y + halfH;

            // Clamped closest point on box
            const cx = Math.max(minX, Math.min(entity.x, maxX));
            const cy = Math.max(minY, Math.min(entity.y, maxY));

            const dx = entity.x - cx;
            const dy = entity.y - cy;
            const distSq = dx * dx + dy * dy;

            if (distSq === 0) {
              // Deep penetration inside box: find closest edge
              hasCollided = true;
              const distL = entity.x - minX;
              const distR = maxX - entity.x;
              const distT = entity.y - minY;
              const distB = maxY - entity.y;
              const minEdge = Math.min(distL, distR, distT, distB);

              let nx = 0;
              let ny = 0;
              if (minEdge === distL) {
                entity.x = minX - radius;
                nx = -1;
              } else if (minEdge === distR) {
                entity.x = maxX + radius;
                nx = 1;
              } else if (minEdge === distT) {
                entity.y = minY - radius;
                ny = -1;
              } else {
                entity.y = maxY + radius;
                ny = 1;
              }

              if (entity.vx !== undefined && entity.vy !== undefined) {
                const dot = entity.vx * nx + entity.vy * ny;
                if (dot < 0) {
                  entity.vx -= dot * nx;
                  entity.vy -= dot * ny;
                }
              }
            } else if (distSq < radius * radius) {
              hasCollided = true;
              const dist = Math.sqrt(distSq);
              const overlap = radius - dist;
              const nx = dx / dist;
              const ny = dy / dist;

              entity.x += nx * overlap;
              entity.y += ny * overlap;

              if (entity.vx !== undefined && entity.vy !== undefined) {
                const dot = entity.vx * nx + entity.vy * ny;
                if (dot < 0) {
                  entity.vx -= dot * nx;
                  entity.vy -= dot * ny;
                }
              }
            }
          }
        }
      }
    }

    return hasCollided;
  }

  /**
   * Fast line-of-sight raycast against solid obstacles (used for projectile cover).
   */
  public checkRaycast(x1: number, y1: number, x2: number, y2: number): boolean {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const minGx = Math.max(0, this.worldToGrid(minX));
    const maxGx = Math.min(this.gridDim - 1, this.worldToGrid(maxX));
    const minGy = Math.max(0, this.worldToGrid(minY));
    const maxGy = Math.min(this.gridDim - 1, this.worldToGrid(maxY));

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        const bucketIdx = this.getCellIndex(gx, gy);
        if (bucketIdx < 0) continue;
        const bucket = this.spatialBuckets[bucketIdx];

        for (let i = 0; i < bucket.length; i++) {
          const obs = bucket[i];
          const distToLine = this.pointToSegmentDistance(obs.x, obs.y, x1, y1, x2, y2);
          if (distToLine < obs.radius) {
            return true; // Blocked by obstacle
          }
        }
      }
    }
    return false;
  }

  private pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  /**
   * Validates whether a spawn location is free of obstacles (for chests, merchants, obelisks).
   */
  public isWalkable(x: number, y: number, radius = 40): boolean {
    const minGx = Math.max(0, this.worldToGrid(x - radius));
    const maxGx = Math.min(this.gridDim - 1, this.worldToGrid(x + radius));
    const minGy = Math.max(0, this.worldToGrid(y - radius));
    const maxGy = Math.min(this.gridDim - 1, this.worldToGrid(y + radius));

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        const bucketIdx = this.getCellIndex(gx, gy);
        if (bucketIdx < 0) continue;
        const bucket = this.spatialBuckets[bucketIdx];
        for (let i = 0; i < bucket.length; i++) {
          const obs = bucket[i];
          if (obs.shape === 'circle') {
            if (Math.hypot(x - obs.x, y - obs.y) < radius + obs.radius) return false;
          } else {
            const halfW = obs.width / 2;
            const halfH = obs.height / 2;
            const cx = Math.max(obs.x - halfW, Math.min(x, obs.x + halfW));
            const cy = Math.max(obs.y - halfH, Math.min(y, obs.y + halfH));
            if (Math.hypot(x - cx, y - cy) < radius) return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Renders ground decals (inlays, blood patches, ice fractures, runes) under entities.
   */
  public renderFloorDecals(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const halfW = canvasWidth / 2 + 100;
    const halfH = canvasHeight / 2 + 100;

    for (let i = 0; i < this.decals.length; i++) {
      const d = this.decals[i];
      // Screen culling
      if (
        d.x < camera.x - halfW ||
        d.x > camera.x + halfW ||
        d.y < camera.y - halfH ||
        d.y > camera.y + halfH
      ) {
        continue;
      }

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);

      if (d.type === 'pavement' || d.type === 'rune') {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(0, 0, d.size, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(-d.size * 0.65, -d.size * 0.65, d.size * 1.3, d.size * 1.3);
        ctx.stroke();
      } else if (d.type === 'blood_patch') {
        ctx.fillStyle = '#7f1d1d';
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.ellipse(0, 0, d.size, d.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'ice_crack') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(-d.size * 0.8, 0);
        ctx.lineTo(-d.size * 0.2, d.size * 0.3);
        ctx.lineTo(d.size * 0.4, -d.size * 0.2);
        ctx.lineTo(d.size * 0.8, d.size * 0.4);
        ctx.stroke();
      } else if (d.type === 'moss_patch') {
        ctx.fillStyle = '#14532d';
        ctx.globalAlpha = 0.24;
        ctx.beginPath();
        ctx.ellipse(0, 0, d.size * 0.9, d.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Constellation
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(-d.size * 0.6, -d.size * 0.4);
        ctx.lineTo(0, d.size * 0.5);
        ctx.lineTo(d.size * 0.6, -d.size * 0.3);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /**
   * Renders solid scenery obstacles (pillars, crypts, trees, monoliths) with depth and shadows.
   */
  public renderObstacles(
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const halfW = canvasWidth / 2 + 150;
    const halfH = canvasHeight / 2 + 150;

    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (
        obs.x < camera.x - halfW ||
        obs.x > camera.x + halfW ||
        obs.y < camera.y - halfH ||
        obs.y > camera.y + halfH
      ) {
        continue;
      }

      // 1. Ground Drop Shadow (Soft dark ellipse)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      if (obs.shape === 'circle') {
        ctx.ellipse(obs.x + 4, obs.y + 6, obs.radius * 1.15, obs.radius * 0.75, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(obs.x + 6, obs.y + 8, obs.width * 0.55, obs.height * 0.45, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 2. Obstacle Base / Structure
      if (obs.kind === 'pillar') {
        // Round fluted column
        ctx.fillStyle = obs.color;
        ctx.strokeStyle = obs.accentColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner plinth detail ring
        ctx.fillStyle = obs.detailColor || obs.accentColor;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.kind === 'tree') {
        // Solid tree trunk
        ctx.fillStyle = '#26170d';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Layered foliage canopy
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y - 12, obs.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = obs.accentColor;
        ctx.beginPath();
        ctx.arc(obs.x + 4, obs.y - 16, obs.radius * 1.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.kind === 'building' || obs.kind === 'monument' || obs.kind === 'ruin') {
        // Rectangular stone structure
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;

        ctx.fillStyle = obs.color;
        ctx.strokeStyle = obs.accentColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(obs.x - halfW, obs.y - halfH, obs.width, obs.height, 8);
        ctx.fill();
        ctx.stroke();

        // Roof / Masonry relief
        ctx.fillStyle = obs.accentColor;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(obs.x - halfW + 6, obs.y - halfH + 6, obs.width - 12, obs.height - 12);
        ctx.globalAlpha = 1.0;

        // Inset emblem / archway
        if (obs.detailColor) {
          ctx.strokeStyle = obs.detailColor;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(obs.x - halfW + 12, obs.y - halfH + 12, obs.width - 24, obs.height - 24);
        }
      } else {
        // Wall barrier
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        ctx.fillStyle = obs.color;
        ctx.strokeStyle = obs.accentColor;
        ctx.lineWidth = 2;
        ctx.fillRect(obs.x - halfW, obs.y - halfH, obs.width, obs.height);
        ctx.strokeRect(obs.x - halfW, obs.y - halfH, obs.width, obs.height);
      }
    }
  }

  /**
   * Renders lightweight ambient screen-space weather particles (snow, embers, spores, dust).
   */
  public updateAndRenderAmbience(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    dt: number,
  ): void {
    const type = this.themeConfig.ambientType;
    const color = this.themeConfig.ambientColor;

    ctx.save();
    ctx.fillStyle = color;

    for (let i = 0; i < this.ambientParticles.length; i++) {
      const p = this.ambientParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.life = 0;
        p.x = Math.random() * canvasWidth;
        p.y = Math.random() * canvasHeight;
        p.size = 1.5 + Math.random() * 2.5;
        p.alpha = 0.25 + Math.random() * 0.45;

        if (type === 'snow') {
          p.vx = -80 - Math.random() * 60; // Blizzard sweep left
          p.vy = 40 + Math.random() * 40;
        } else if (type === 'blood' || type === 'spore' || type === 'dust') {
          p.vx = Math.random() * 30 - 15;
          p.vy = -20 - Math.random() * 35; // Gentle float upwards
        } else {
          // Void cosmic swirl
          p.vx = Math.sin(p.life * 2 + i) * 35;
          p.vy = Math.cos(p.life * 2 + i) * 35;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wrap around canvas edges
      if (p.x < 0) p.x = canvasWidth;
      if (p.x > canvasWidth) p.x = 0;
      if (p.y < 0) p.y = canvasHeight;
      if (p.y > canvasHeight) p.y = 0;

      ctx.globalAlpha = p.alpha * Math.sin((p.life / p.maxLife) * Math.PI);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export const stageManager = new Stage();
