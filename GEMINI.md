# Relic Swarm — Project Architecture & AI Developer Guide

## 1. Project Overview & Design Metadata

**Relic Swarm** is a 2D roguelite horde survival game inspired by *Vampire Survivors*. Players battle expanding monster swarms across an omnidirectional arena, automatically fire and evolve arcane weaponry, collect XP gems and gold, dynamically sell equipped weapons or passives to pivot builds mid-run, and spend earned gold on permanent upgrades in the Sanctum Meta-Shop.

- **Genre**: 2D Horde Survival Roguelite (Top-down Arena / Shooter)
- **Art Style**: Pixelated retro aesthetics with high-contrast entity silhouettes
- **Hook**: Survive relentless swarms, collect arcane relics, and sell gear dynamically to pivot builds mid-run.
- **Winning Condition**: Survive 15 minutes (900s) and vanquish the final Abyssal Titan boss.
- **Losing Condition**: Player character health reaches zero.
- **Player Mode**: Single-player
- **Supported Orientations**: Landscape, Wide
- **Platform Targets**: Desktop (Web/Vite), Mobile (Touch), TV/Gamepad
- **Score Mode**: Points / Survival Time (Higher is better)
- **Origin**: Initially prototyped on Google Playgrounds; adapted for standalone development in Antigravity.

---

## 2. Core Design Pillars & Loop

### 2.1 Design Pillars
1. **Fluid Horde Combat**: Smooth 60 FPS swarm rendering with distinct hit feedback and satisfying crowd-clearing attacks.
2. **Dynamic Build Flexibility**: Players can sell underperforming weapons or passives on the fly to reclaim equipment slots and refund 70% of invested gold/XP for mid-run pivot builds.
3. **Deep Meta-Progression**: Persistent Sanctum Meta-Shop stat tree, unlockable heroes, and selectable starting loadouts that reward repeated runs.
4. **Universal Accessibility**: Intuitive auto-firing with full support for Keyboard, Gamepad, and responsive Virtual Touch controls.

### 2.2 Core Gameplay Loop
1. **Choose Starter Loadout**: Select an unlocked hero archetype and baseline Level 1 weapon.
2. **Battle & Auto-Cast**: Navigate an expansive arena, automatically firing weapons at approaching swarms.
3. **Gather & Level Up**: Collect XP gems from defeated foes to trigger 3-choice level-up drafts featuring weapons and passive relics.
4. **Manage & Sell Arsenal**: Open inventory at will or during draft screens to sell equipped weapons/passives, refunding gold to free slots for higher-synergy combinations.
5. **Defeat Elites & Bosses**: Crack open treasure chests dropped by elite enemies for multi-item surges and awakened evolutions.
6. **Meta-Progression**: Spend extracted gold in the permanent Sanctum Shop on stat nodes (Max HP, Area %, CDR, Magnet, Greed) and unlock new champions.

---

## 3. Tech Stack & Runtime

- **Framework**: [React 19](https://react.dev/) (`react`, `react-dom`)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`, `index.css`)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (strict module resolution, ES2022)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/) (`vite.config.ts`)
- **Icons**: [`lucide-react`](https://lucide.dev/)
- **Rendering**: HTML5 Canvas 2D with fixed timestep simulation stepper (60 FPS sub-steps)
- **Audio**: Web Audio API synth effects + HTMLAudioElement BGM (`assets/audio/bgm_survivor_theme.mp3`)
- **Persistence**: Browser `localStorage` for Sanctum Gold (`relic_swarm_sanctum_gold`) and meta-upgrades (`relic_swarm_meta`).

---

## 4. Controls & Input Mapping

| Action | Keyboard | Gamepad | Mobile / Touch |
| :--- | :--- | :--- | :--- |
| **Move** | W / A / S / D or Arrow Keys | Left Analog Stick / D-Pad | Virtual Analog Joystick (Bottom-Left) |
| **Sprint** | Shift / Ctrl | Left Trigger / Left Bumper | Virtual Sprint Button (Bottom-Right) |
| **Confirm / Select** | Enter / Space | Button A (Button 0) | Tap Button / UI Card |
| **Cancel / Back** | Escape / Backspace | Button B (Button 1) | Tap Close / Back Button |
| **Toggle Inventory / Sell** | Tab / I | Button Y (Button 3) | Floating Sell Button (Bottom-Right) |
| **Pause Game** | Escape / P | **Button 9 ONLY** (Start / Options) | Top-Right Pause Button |
| **Sanctum Shop (Menu)** | S / X | Button X (Button 2) / Button Y | Tap Sanctum Vault Card |
| **Draft Reroll** | R | Button Y (Button 3) | Tap Reroll Button |

> [!IMPORTANT]
> Gamepad Pause is strictly bound to **Button 9 (Options / Start)**. Left/Right stick clicks (L3/R3, buttons 10/11) must never trigger pause.

---

## 5. Movement, Camera & Visual Hierarchy

### 5.1 Movement & Scrolling Alignment
- **Arena Type**: Omnidirectional free-roaming 2D arena.
- **Sprite Orientation Baseline**: All character and mob sprites face right (3 o'clock) by default. The engine flips horizontal orientation (`ctx.scale(-1, 1)`) when moving leftward.
- **Velocity & Dampening**: 8-way directional velocity with acceleration and deceleration dampening.
- **Camera Tracking**: Smooth camera interpolation (lerp) tracking the player character with soft boundary clamping.

### 5.2 Visual Hierarchy & Layering
- **Floor Layer**: Dark gothic desaturated tiles (`#07050e`, `#0c0a1a`) with subtle grid markers for movement parallax.
- **Entity Layer**: High-contrast, vibrant player, mob, and projectile sprites with luminous outlines for legibility in dense 200+ entity swarms.
- **Hazard Telegraphs**: Pulsing crimson warning auras for elite spawns, charging hazards, and boss ground slams.
- **HUD Layer**: Top-docked XP bar, bottom-left HP/stats display, top-right survival timer and kill counter, cleanly docked weapon slot indicators.

### 5.3 Fairness & Assist Systems
- **XP Magnet Pulse**: Leveling up or collecting rare Attraction Runes vacuums all on-screen XP gems directly to the player.
- **Off-Screen Hazard Chevrons**: Red directional chevron pointers at screen boundaries indicate off-screen elite enemies and boss spawns.
- **Invulnerability Frames**: 0.5s damage cooldown upon taking a hit with flashing white sprite feedback.
- **Draft Rerolls & Consumables**: Fallback choices (Gold bags, Elixirs, Obliteration Bombs) guarantee rewards even when slots are maxed out.

### 5.4 Game Feel & Juice
- **Anticipation**: Charging spells render gathering energy glyphs around the champion.
- **State Change**: Floating gold/XP numbers, chromatic aberration flashes on level-up, radiant pickup trails.
- **Impact Feedback**: Damage-calibrated screen shake, micro hit-stop freeze frames on boss critical hits, and multi-kill shatter particles.

---

## 6. Key Game Systems & Entities

### 6.1 Playable Heroes (`HEROES` in `App.tsx`)
- **Arcanist Vael** (`hero_spellblade`): Balanced caster. Starts with *Magic Missile* + *Might Talisman*. Bonus: +15% Spell Area, +10% Cooldown Reduction.
- **Knight Commander Roland** (`hero_voidstalker`): Tank vanguard. Starts with *Orbiting Daggers* + *Vitality Charm*. Bonus: +50 Max HP, +2 Damage Resistance.
- **Pyromancer Ignis** (`hero_pyromancer`): Burst DPS. Starts with *Flame Blast* + *Might Talisman*. Bonus: +25% Damage, +20% Blast Area.
- **Plague Alchemist Mortis** (`hero_voidstalker`): Agile harvesters. Starts with *Toxic Spores* + *Toxic Vial*. Bonus: +20% Speed, +1 HP/s Regen, Toxic Mastery.

### 6.2 Weapons, Fusions & Evolutions (4 Weapon Slots)
- **Base Weapons (Max Level 5)**:
  - `magic_missile`: Homing arcane bolts
  - `flame_blast`: Explosive fiery plasma with splash pools
  - `spinning_dagger`: Continuous orbiting steel blades
  - `thunder_strike`: Vertical celestial lightning strikes
  - `radiant_aura`: Permanent holy aura ring pulsing AOE damage
  - `venom_spores`: Toxic spore clouds applying stacking Poison DoT
  - `frost_shard`: Piercing ice spikes applying 50% Slow

- **Weapon Fusions (L5 + L5 Weapons)**:
  - `arcane_phantom_vortex`: *Magic Missile L5* + *Daggers L5* (8 astral blades firing homing beams)
  - `cataclysmic_nova`: *Flame Blast L5* + *Thunder Strike L5* (Screen infernos + lightning storms)
  - `toxic_sanctuary`: *Radiant Aura L5* + *Toxic Spores L5* (Slow aura + poison cloud)

- **Awakened Evolutions (Max Weapon + Matched Passive in Boss Chest)**:
  - `chrono_missiles`: *Magic Missile* + *Swift Boots*
  - `hellfire_nova`: *Flame Blast* + *Might Talisman*
  - `phantom_storm`: *Spinning Dagger* + *Might Talisman*
  - `absolute_zero`: *Glacial Shards* + *Frost Amulet*

### 6.3 Passives (4 Passive Slots, Max Level 5)
- `might_talisman` (+15% Damage/lvl)
- `swift_boots` (+12% Move Speed, +15 Stamina/lvl)
- `magnet_rune` (+35% Attraction Radius/lvl)
- `vitality_charm` (+25 Max HP, +0.5 HP/s Regen/lvl)
- `toxic_vial` (+35% Poison Chance/lvl)
- `frost_amulet` (35% Enemy Slow Aura/lvl)
- `greed_coin` (+25% Gold Drop Value/lvl)

### 6.4 Dynamic Item Selling & Pivoting
- Accessible at any time via inventory key (`Tab`, `I`, Gamepad `Y`, Touch button) or directly in draft screens.
- **Refund Value**: 70% of invested gold/XP value.
- Frees the slot instantly and places sold items back into the draft pool for future rolls.

### 6.5 Sanctum Meta-Shop Progression
Stored permanently in `localStorage` (`relic_swarm_sanctum_gold` and `relic_swarm_meta`):
- **Stamina Infusion**: Max Health (+10% / rank, max 5)
- **Might of the Sanctum**: Global Damage (+6% / rank, max 5)
- **Haste Footwork**: Move Speed & Sprint Recovery (+5% / rank, max 5)
- **Arcane Flow**: Cooldown Reduction (+4% / rank, max 5)
- **Aetheric Magnetism**: Magnet Radius (+15% / rank, max 5)
- **Golden Fortune**: Gold Drop Value (+12% / rank, max 5)
- **Fate Rerolls**: Rerolls per Run (+1 / rank, max 3)

### 6.6 Enemies & Bosses
- `skeleton`: Swarming melee infantry
- `bat`: Fast erratic flyers diving in zig-zags
- `hound`: High-speed pack flankers
- `sorcerer`: Ranged casters firing slow homing dark orbs
- `titan` (Abyssal Titan): Spawns at 5 minutes (300s); sweeps lasers, ground slams, summons minions

---

## 7. Directory Structure

```
relicswarm/
├── GEMINI.md                    # Canonical AI & developer reference
├── package.json                 # Scripts: dev, build, preview
├── tsconfig.json                # TypeScript compiler options (React 19 / Vite 8)
├── vite.config.ts               # Vite configuration with Tailwind CSS & asset bundling
├── vite-env.d.ts                # Vite client ambient types
├── index.css                    # Tailwind CSS v4 entry & full-viewport styles
├── .gitignore                   # Excludes node_modules, dist, .gemini, etc.
├── index.html                   # HTML entry point mounting #root
├── index.tsx                    # React root entry, sets __PLAYGROUND_PREVIEW__ flag
├── App.tsx                      # Main game component (~5,000 lines: loop, canvas, UI)
├── constants.ts                 # Canvas resolution, target FPS, color palette, defaults
├── SpriteRenderer.ts            # Spritesheet animator (frame calculations, clipping, flipX)
├── utils.ts                     # Utility barrel re-exporting helpers, math, seeded RNG
├── utils/
│   ├── BackgroundMusic.tsx      # BGM player with audio boundaries & loop smoothing
│   ├── helper.tsx               # Stepper, asset preloader, input hooks, canvas helpers
│   ├── usePlayground.ts         # Hook bridging Playground SDK / standalone preview
│   └── playground-fake.ts       # Local mock of Playground SDK
├── design/
│   ├── game_design_document.json# Canonical GDD with design pillars and mechanics
│   └── asset_manifest.json      # Metadata on sprites, icons, and visual effects
└── assets/
    ├── audio/                   # bgm_survivor_theme.mp3
    └── images/                  # Spritesheets, projectiles, pickups, weapon & UI icons
```

---

## 8. Development Workflow & Commands

```bash
# Start local development server with HMR
npm run dev

# Run TypeScript type check and build production bundle
npm run build

# Preview production build locally
npm run preview
```

### Standalone Runtime Environment
- The app checks `(window as any).__PLAYGROUND_PREVIEW__`. In `index.tsx`, this flag is enabled before mounting, triggering the dynamic load of `utils/playground-fake.ts`.
- This ensures full standalone operation in standard web browsers, Vite dev servers, and Antigravity preview panes without requiring external Google Play services.

---

## 9. Development Guidelines for AI Agents

1. **Keep TypeScript Error-Free**: Always verify changes by running `npm run build` or `npx tsc --noEmit`. Ensure React 19 typing rules are observed (e.g., `useRef<T>(undefined)`).
2. **Preserve State Machine Integrity**: Game states in `App.tsx` include `'TITLE'`, `'CHARACTER_SELECT'`, `'SANCTUM_SHOP'`, `'PLAYING'`, `'PAUSED'`, `'DRAFT'`, `'CHEST_REWARD'`, `'GAME_OVER'`, and `'VICTORY'`. Ensure state transitions preserve simulation cleanup and timer handling.
3. **Canvas Performance**:
   - The game loop renders hundreds of entities at 60 FPS. Avoid creating new closures, arrays, or object allocations inside the per-frame tick or drawing routines.
   - Reuse vector objects, pool particles and damage numbers where practical.
4. **Input & Accessibility**:
   - Ensure all modal overlays support full navigation via Keyboard (Arrow keys / WASD, Enter / Space, Escape) and Gamepad (D-pad / Left Stick, Button A, Button B).
   - Keep Gamepad pause strictly on Button 9.
5. **Planned Architecture Refactoring**:
   - `App.tsx` is currently a monolithic file (~5,000 lines). When adding significant features, consider refactoring modules into dedicated files:
     - `src/types/game.ts`: Game interfaces and entity definitions
     - `src/systems/`: Combat, spawning, drops, and collision
     - `src/components/ui/`: Overlays (HUD, DraftModal, InventorySheet, SanctumShop)
   - Preserve backward compatibility with localStorage keys (`relic_swarm_sanctum_gold`, `relic_swarm_meta`).
