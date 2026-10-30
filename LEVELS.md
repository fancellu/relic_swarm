# Level Manager & Endless Mode Design (`LevelManager`)

## 1. Core Vision
Currently, a run consists of a single level that ends in a hard stop upon defeating the Abyssal Titan (or dying). That hard cap cuts runs short right when a player's build comes online.

Instead, **Relic Swarm** will transition into an **Endless Stage Progression** managed by a dedicated `LevelManager`:
- **Endless Descent**: Defeating the stage boss completes the current level and opens a **Stage Clear Intermission** rather than ending the run.
- **Per-Level Scaling**: Every new level increases **Enemy Health by $+10\%$**, **Enemy Damage by $+10\%$**, and **Player Move Speed by $+10\%$**.
- **Gold Carry-Over**: Unbanked run gold (`sim.gold`) carries over into the next level.
- **Single Weapon Carry-Over**: During the intermission between levels, the player chooses **1 equipped weapon** from their current loadout to carry over into the next level.
- **HUD Visibility**: The UI clearly displays the current Stage/Realm level alongside the character's XP level and timer.

---

## 2. Terminology Guardrail: `stage` vs. `level`
In the current codebase (`src/types/entities.ts` and `src/ui/HUD.tsx`), `sim.level` and `gameState.level` track the **Player's XP Character Level** (`Lv. 1`, `Lv. 2`, etc.).
- To prevent state collisions, `LevelManager` should track the arena progression as **`stage`** (or `currentLevel` inside `LevelManager`, exposed as `sim.stage` on `SimulationState`).
- **HUD Display**: Show `Stage 1` (or `Lv. 1-1` / `Realm 1`) in the top HUD bar next to the survival timer, keeping `Lv. X` next to the XP bar for character draft levels.

---

## 3. Scaling Math & Balance Curve

Let $S$ be the current level number ($S = 1, 2, 3, \dots$):

### Enemy Health & Damage (Compound Scaling)
Using compound scaling for enemies ensures that late-game stages keep pace with carried-over Fusions and permanent Sanctum upgrades:
$$\text{EnemyHP}(S) = \text{BaseHP} \times (1.10)^{S - 1}$$
$$\text{EnemyDamage}(S) = \text{BaseDamage} \times (1.10)^{S - 1}$$

### Player Movement Speed (Additive Scaling with Soft Cap)
Additive scaling for player speed keeps movement responsive without making the hero uncontrollable at Stage $10+$ (optional soft cap at $+150\%$):
$$\text{PlayerSpeedMult}(S) = 1 + 0.10 \times (S - 1)$$

### Boss Scaling (Abyssal Titan)
- **HP & Damage**: Scales by the same $(1.10)^{S - 1}$ multiplier (Stage 1: $3500\text{ HP}$, Stage 2: $3850\text{ HP}$, Stage 5: $5124\text{ HP}$).
- **Bullet-Hell Escalation**: In `Spawner.ts`, the Titan fires radial orb bursts every $4.0\text{s}$. We can scale the orb count slightly per stage: $\min(16, 8 + (S - 1) \times 2)$ so higher-stage bosses feel mechanically deadlier.

---

## 4. Carry-Over Rules & Deep Synergies with Existing Systems

Transitioning from Level $S$ to Level $S + 1$ resets the arena while preserving specific rewards. This creates awesome synergies with the systems already in `Relic Swarm`:

### What Carries Over vs. What Resets

| State / System | Behavior on Next Level | Design Rationale |
| :--- | :--- | :--- |
| **Chosen Weapon (1 of up to 4)** | **Carries Over** (keeps current Level $1\text{–}5$, Awakened Evolution, or Fusion state) | Carrying a Fused or Evolved weapon into Stage 2 feels amazing and rewards completing evolutions before killing the boss. |
| **Other 3 Weapon Slots** | **Reset** (cleared) | Frees slots so the player can draft a fresh build around their carried-over anchor weapon. |
| **Equipped Passives (4 Slots)** | **Reset** (cleared, except Hero's innate `startingPassive`) | Re-opens the draft pool so leveling up in Stage $2+$ remains meaningful. |
| **Character XP Level (`sim.level`)** | **Resets to `Lv. 1`** (`xp = 0`, `nextXp = 10`) | Crucial! If XP thresholds didn't reset, the player wouldn't level up fast enough in Stage 2 to fill their 3 empty weapon slots. |
| **Unbanked Run Gold (`sim.gold`)** | **Carries Over ($100\%$)** | Fuels the Black Market Merchant and boosts wealth-scaling weapons (*Gilded Chakram* / *Midas' Wrath*). |
| **Forged Relic Essences (`sim.extractedEssences`)** | **Carries Over (Recommended!)** | Gives **Extract Essence** a massive strategic role: right before killing the Stage Boss, a player can sacrifice their other maxed Level 5 weapons/passives into permanent 20% essence buffs for Stage $2+$! |
| **Chest Stat Buffs (`bonusMaxHp`, `bonusMight`, etc.)** | **Carries Over** | Makes choosing permanent stat buffs from chests valuable across multi-stage runs. |
| **Player Health & Stamina** | **Restored to $100\%$** (`sim.hp = sim.maxHp`) | Fresh start for the new stage. |
| **Stage Timer (`sim.runTimer`)** | **Resets to `0:00`** (while `sim.totalRunTimer` tracks cumulative time) | Resets the $0\text{–}300\text{s}$ wave curve and Boss spawn clock for the new stage. |

### Tactical Pre-Boss Pivot (The "End-of-Stage Liquefy" Play)
Because the player only carries over **1 weapon**, smart players who are about to kill the Abyssal Titan have a high-skill tactical play:
1. Open the Inventory (`Tab` / `Y`) when the Boss is at $5\%$ HP.
2. **Extract Essence** from any other Level 5 weapons/relics (locking in permanent $+20\%$ stat buffs) and **Sell** any Level $1\text{–}4$ gear for a $70\%$ gold refund.
3. Deal the killing blow to the Boss and carry over **1 supreme weapon + a massive gold pouch + permanent Essences** into the next stage.

---

## 5. Stage Clear / Intermission Modal (`StageClearModal.tsx`)

When the Abyssal Titan is defeated in `Spawner.ts`:
1. Instead of setting `gameState.status = 'VICTORY'` and banking gold immediately, open a new **`StageClearModal`** (`isStageClearOpen = true`).
2. **Modal Layout & Options**:
   - **Header**: `STAGE {S} CLEARED! — THE SWARM GROWS STRONGER`
   - **Next Stage Modifiers Preview**:
     - `Stage {S + 1} Modifiers: Enemy HP +10% | Enemy DMG +10% | Hero Speed +10%`
     - `Gold Carried Over: {sim.gold}g`
   - **Weapon Carry-Over Selector**:
     - Display cards for each currently equipped weapon in `sim.weapons` (1 to 4 cards).
     - Player selects **1 weapon** to keep for Stage $S + 1$.
     -*(Optional Auto-Liquidate Bonus)*: Any unchosen weapons in slots 2–4 can automatically auto-sell for their $70\%$ gold value (or auto-extract essence if Level 5) when advancing, so players are never punished if they forgot to open their inventory before the boss died!
   - **Two Action Buttons**:
     - **Primary (`[Enter / A]`)**: **Descend to Stage {S + 1}** (starts next stage with chosen weapon & carried gold).
     - **Secondary (`[B / Esc]`)**: **Claim Victory & Bank Gold to Sanctum** (triggers the classic `VICTORY` screen, banks `sim.gold` into `localStorage`, and ends the run safely).
3. **3-Way Input Parity (Invariant 2.2)**:
   - Support `1–4` hotkeys, `W/A/S/D` or Arrow keys, Gamepad D-Pad/Stick + `Button A` (confirm) / `Button B` (cash out), and pointer hover/click.

---

## 6. `LevelManager` Technical Specification (`src/core/LevelManager.ts`)

```typescript
import {EquippedItem, SimulationState} from '../types/entities';
import {ITEM_DEFS} from '../types/items';

export interface LevelModifiers {
  stage: number;
  enemyHpMult: number;
  enemyDamageMult: number;
  playerSpeedMult: number;
  floorBgColor: string;
  floorGridColor: string;
  borderAccentColor: string;
}

const STAGE_THEMES = [
  {bg: '#0a0814', grid: '#1a162b', border: '#e11d48'}, // Stage 1: Gothic Sanctum
  {bg: '#14080c', grid: '#2b141d', border: '#f97316'}, // Stage 2: Blood Catacombs
  {bg: '#071318', grid: '#122932', border: '#06b6d4'}, // Stage 3: Glacial Abyss
  {bg: '#09140b', grid: '#162b1a', border: '#22c55e'}, // Stage 4: Blighted Necropolis
  {bg: '#12081c', grid: '#261438', border: '#a855f7'}, // Stage 5: Astral Void
];

export class LevelManager {
  private stage = 1;

  public reset(): void {
    this.stage = 1;
  }

  public getStage(): number {
    return this.stage;
  }

  public getModifiers(): LevelModifiers {
    const s = this.stage;
    const theme = STAGE_THEMES[(s - 1) % STAGE_THEMES.length];
    return {
      stage: s,
      enemyHpMult: Math.pow(1.1, s - 1),
      enemyDamageMult: Math.pow(1.1, s - 1),
      playerSpeedMult: 1 + 0.1 * (s - 1),
      floorBgColor: theme.bg,
      floorGridColor: theme.grid,
      borderAccentColor: theme.border,
    };
  }

  /**
   * Advances the simulation state to the next endless stage,
   * carrying over gold, 1 chosen weapon, and auto-refunding unchosen gear.
   */
  public advanceToNextStage(sim: SimulationState, chosenWeaponId: string): void {
    this.stage += 1;

    // 1. Find the weapon to carry over (fallback to first equipped or hero starter)
    const carriedWeapon: EquippedItem =
      sim.weapons.find((w) => w.id === chosenWeaponId) ||
      sim.weapons[0] || {id: sim.hero.startingWeapon, level: 1};

    // 2. Auto-refund 70% gold for any unchosen weapons & passives so value isn't lost
    for (let i = 0; i < sim.weapons.length; i++) {
      const w = sim.weapons[i];
      if (w.id !== carriedWeapon.id) {
        const def = ITEM_DEFS[w.id];
        sim.gold += Math.round((def?.cost || 50) * w.level * 0.7);
      }
    }
    for (let i = 0; i < sim.passives.length; i++) {
      const p = sim.passives[i];
      const def = ITEM_DEFS[p.id];
      sim.gold += Math.round((def?.cost || 40) * p.level * 0.7);
    }

    // 3. Reset player position, arena entities, and stage timers
    sim.x = 0;
    sim.y = 0;
    sim.vx = 0;
    sim.vy = 0;
    sim.camera.x = 0;
    sim.camera.y = 0;
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.drops.length = 0;
    sim.particles.length = 0;
    sim.damageNumbers.length = 0;
    if (sim.conduitPylons) sim.conduitPylons.length = 0;

    sim.obelisk = null;
    sim.obeliskSpawnTimer = 0;
    sim.inObeliskZone = false;
    sim.cursedArena = null;
    sim.merchant = null;
    sim.nextMerchantSpawnTime = 180;

    // 4. Reset stage clock & boss flags while preserving total run progress
    sim.runTimer = 0;
    sim.spawnTimer = 0;
    sim.bossSpawned = false;
    sim.bossDefeated = false;

    // 5. Reset XP curve so the player can draft new items quickly in the new stage
    sim.level = 1;
    sim.xp = 0;
    sim.nextXp = 10;

    // 6. Set carried weapon & restore Hero's innate starting passive
    sim.weapons = [{id: carriedWeapon.id, level: carriedWeapon.level}];
    sim.passives = sim.hero.startingPassive
      ? [{id: sim.hero.startingPassive, level: 1}]
      : [];
    sim.weaponTimers = {};
  }
}
```

---

## 7. Zero-Asset Visual Variety Across Stages

To make each level feel like a new floor of the dungeon without adding any image assets to `assets/images/`:
- **Arena Floor Theme Cycling (`src/core/engine.ts`)**: Pass `LevelModifiers` into `drawArenaFloor()` so each stage shifts the background fill, grid line color, and perimeter border color (Gothic Sanctum $\rightarrow$ Blood Catacombs $\rightarrow$ Glacial Abyss $\rightarrow$ Blighted Necropolis $\rightarrow$ Astral Void).
- **Stage Announcement Banner**: When a new stage begins, spawn a large floating combat text or brief HUD banner (`STAGE 2 — BLOOD CATACOMBS`).

---

## 8. Implementation Checklist

1. **`src/core/LevelManager.ts`**: Create `LevelManager` class with `getStage()`, `getModifiers()`, `reset()`, and `advanceToNextStage()`.
2. **`src/types/entities.ts`**: Add `stage: number` and `totalRunTimer: number` to `SimulationState`.
3. **`src/entities/Player.ts`**: In `calculateDerivedStats()`, multiply `speed` by `levelManager.getModifiers().playerSpeedMult` (or `1 + (sim.stage - 1) * 0.10`).
4. **`src/entities/Spawner.ts`**:
   - In `updateEnemySpawner()`, multiply newly spawned enemy `hp` and `damage` (including the Abyssal Titan boss and Blood Trial mini-boss) by `enemyHpMult` and `enemyDamageMult`.
5. **`src/ui/StageClearModal.tsx`**: Create the intermission modal allowing the player to pick 1 equipped weapon to carry over (or bank gold & finish run), with full Keyboard/Gamepad/Pointer navigation parity.
6. **`src/ui/HUD.tsx` & `src/ui/EndGameModal.tsx`**:
   - Display `Stage {stage}` badge in the top HUD bar next to `Lv. {level}` and the timer.
   - Show `Stages Cleared` and cumulative survival time on the Victory / Game Over summary screens.
7. **`src/App.tsx`**: Wire `onBossVictory` to open `StageClearModal` instead of immediately ending the run.