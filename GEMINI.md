# Relic Swarm — Project Architecture & AI Developer Guide

## 1. Project Overview

**Relic Swarm** is a 2D roguelite horde survival game inspired by *Vampire Survivors*. Players battle expanding monster swarms across an omnidirectional arena, automatically fire and evolve arcane weaponry, collect XP gems and gold, dynamically sell equipped weapons or passives to pivot builds mid-run, and spend earned gold on permanent upgrades in the Sanctum Meta-Shop.

- **Genre**: 2D Horde Survival Roguelite (Top-down Arena)
- **Winning Condition**: Survive 15 minutes and vanquish the final Abyssal Titan boss.
- **Losing Condition**: Player health reaches zero.
- **Origin**: Initially developed on Google Playgrounds; adapted for standalone development in Antigravity.

---

## 2. Tech Stack & Runtime

- **Framework**: [React 19](https://react.dev/) (`react`, `react-dom`)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (strict module resolution, ES2022)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Icons**: [`lucide-react`](https://lucide.dev/)
- **Rendering**: HTML5 Canvas 2D with fixed timestep simulation stepper (60 FPS sub-steps)
- **Audio**: Web Audio API synth effects + HTMLAudioElement BGM (`assets/audio/bgm_survivor_theme.mp3`)
- **Persistence**: Browser `localStorage` for Sanctum Gold (`relic_swarm_sanctum_gold`) and meta-upgrades (`relic_swarm_meta`).

---

## 3. Directory Layout

```
relicswarm/
├── GEMINI.md                    # This document (AI instructions & project reference)
├── package.json                 # Scripts: dev, build, preview
├── tsconfig.json                # TypeScript compiler configuration (React 19 / Vite)
├── .gitignore                   # Ignores node_modules, dist, .gemini, etc.
├── index.html                   # HTML entry point mounting #root
├── index.tsx                    # React root entry, sets __PLAYGROUND_PREVIEW__ flag
├── App.tsx                      # Main game component (~5,000 lines: game loop, canvas, UI)
├── constants.ts                 # Canvas resolution, target FPS, color palette, audio defaults
├── SpriteRenderer.ts            # Spritesheet animator (frame calculations, clipping, flipX)
├── utils.ts                     # Utility barrel re-exporting helpers, math, seeded RNG
├── utils/
│   ├── BackgroundMusic.tsx      # BGM player with audio boundaries & loop smoothing
│   ├── helper.tsx               # Fixed stepper, asset preloading, inputs, canvas helpers
│   ├── usePlayground.ts         # Hook bridging Playground SDK / standalone preview
│   └── playground-fake.ts       # Local mock of Playground SDK
├── design/
│   ├── game_design_document.json# Canonical GDD with design pillars and mechanics
│   └── asset_manifest.json      # Metadata on sprites, icons, and visual effects
└── assets/
    ├── audio/                   # bgm_survivor_theme.mp3
    └── images/                  # Spritesheets (heroes, enemies, boss), weapon & UI icons
```

---

## 4. Key Systems & Game Mechanics

### 4.1 Player Characters & Archetypes
Defined in `App.tsx` (`HEROES`):
- **Arcanist Vael** (`hero_spellblade`): Starts with *Magic Missile* + *Might Talisman*. Bonus: +15% Spell Area, +10% Cooldown Reduction.
- **Knight Commander Roland** (`hero_voidstalker`): Starts with *Orbiting Daggers* + *Vitality Charm*. Bonus: +50 Max HP, +2 Damage Resistance.
- **Pyromancer Ignis** (`hero_pyromancer`): Starts with *Flame Blast* + *Might Talisman*. Bonus: +25% Damage, +20% Blast Area.
- **Plague Alchemist Mortis** (`hero_voidstalker`): Starts with *Toxic Spores* + *Toxic Vial*. Bonus: +20% Speed, +1 HP/s Regen, Toxic Mastery.

### 4.2 Arsenal, Evolutions & Fusions
Players have **4 Weapon slots** and **4 Passive Relic slots**.

- **Base Weapons (Max Level 5)**:
  - `magic_missile`: Homing arcane projectiles
  - `flame_blast`: High-damage explosive plasma with splash radius
  - `spinning_dagger`: Continuously rotating razor blades
  - `thunder_strike`: Vertical celestial lightning on enemy clusters
  - `radiant_aura`: Continuous holy ring damage around the hero
  - `venom_spores`: Spores applying stacking Poison DoT
  - `frost_shard`: Piercing glacial spikes applying 50% Slow

- **Weapon Fusions (L5 + L5 Weapons)**:
  - `arcane_phantom_vortex`: *Magic Missile L5* + *Daggers L5* (8 orbiting blades firing homing beams)
  - `cataclysmic_nova`: *Flame Blast L5* + *Thunder Strike L5* (Screen infernos + lightning storms)
  - `toxic_sanctuary`: *Radiant Aura L5* + *Toxic Spores L5* (Slow aura + poison cloud)

- **Awakened Evolutions (Max Weapon + Matched Passive in Boss Chest)**:
  - `chrono_missiles`: *Magic Missile* + *Swift Boots*
  - `hellfire_nova`: *Flame Blast* + *Might Talisman*
  - `phantom_storm`: *Spinning Dagger* + *Might Talisman*
  - `absolute_zero`: *Glacial Shards* + *Frost Amulet*

- **Passives (Max Level 5)**:
  - `might_talisman` (+Damage), `swift_boots` (+Speed/Stamina), `magnet_rune` (+Attraction Radius), `vitality_charm` (+Max HP/Regen), `toxic_vial` (+Poison chance), `frost_amulet` (Enemy slow aura), `greed_coin` (+Gold drop value).

### 4.3 Unique Selling / Pivoting Mechanic
Players can open their inventory at any time (`Tab`, `I`, Gamepad `Y`, or mobile UI button) or during draft screens to **sell equipped weapons and passives**:
- Refunds **70%** of invested gold/XP value.
- Instantly frees the equipment slot.
- Adds the sold item back into the draft pool for future level-ups.

### 4.4 Sanctum Meta-Progression
Gold earned during runs is banked in `localStorage`:
- **Stamina Infusion**: Max Health (+10% / rank)
- **Might of the Sanctum**: Global Damage (+6% / rank)
- **Haste Footwork**: Move Speed & Sprint Recovery (+5% / rank)
- **Arcane Flow**: Cooldown Reduction (+4% / rank)
- **Aetheric Magnetism**: Magnet Radius (+15% / rank)
- **Golden Fortune**: Gold Drop Gain (+12% / rank)
- **Fate Rerolls**: Rerolls per Run (+1 / rank)

### 4.5 Enemies & Bosses
- `skeleton`: Swarming melee mobs.
- `bat`: Erratic flyer diving in zig-zags.
- `hound`: Fast pack hunter flanking the player.
- `sorcerer`: Ranged mob firing slow homing dark orbs.
- `titan` (Abyssal Titan): Spawns at 5 minutes (300s); sweeps lasers, performs ground slams, and summons minions.

---

## 5. Development Workflow & Commands

### Running Locally
```bash
# Start local development server with HMR
npm run dev

# Run TypeScript type check and build production bundle
npm run build

# Preview production build locally
npm run preview
```

### Google Playground SDK vs. Standalone Environment
- The app checks `(window as any).__PLAYGROUND_PREVIEW__`. In `index.tsx`, this flag is enabled before mounting, triggering the dynamic load of `utils/playground-fake.ts`.
- This ensures full standalone operation in standard web browsers, Vite dev servers, and Antigravity preview panes without requiring external Google Play services.

---

## 6. Development Guidelines for AI Agents

1. **Keep TypeScript Error-Free**: Always verify changes by running `npm run build` or `npx tsc --noEmit`. Ensure React 19 typing rules are observed (e.g., `useRef<T>(undefined)`).
2. **Preserve State Machine Integrity**: Game states in `App.tsx` include `'TITLE'`, `'CHARACTER_SELECT'`, `'SANCTUM_SHOP'`, `'PLAYING'`, `'PAUSED'`, `'DRAFT'`, `'CHEST_REWARD'`, `'GAME_OVER'`, and `'VICTORY'`. Ensure state transitions preserve simulation cleanup and timer handling.
3. **Canvas Performance**:
   - The game loop renders hundreds of entities at 60 FPS. Avoid creating new closures, arrays, or object allocations inside the per-frame tick or drawing routines.
   - Reuse vector objects, pool particles and damage numbers where practical.
4. **Planned Architecture Refactoring**:
   - `App.tsx` is currently a monolithic file (~5,000 lines). When adding significant features, consider refactoring modules into dedicated files:
     - `src/types/game.ts`: Game interfaces and entity definitions
     - `src/systems/`: Combat, spawning, drops, and collision
     - `src/components/ui/`: Overlays (HUD, DraftModal, InventorySheet, SanctumShop)
   - Preserve backward compatibility with localStorage keys (`relic_swarm_sanctum_gold`, `relic_swarm_meta`).
