# Repository Guidelines

## Project Structure & Module Organization

Relic Swarm is a React 19 and TypeScript Vite game. Root files provide the application entry: `index.tsx` mounts React and `index.html` serves the host page. Core application code is organized under `src/`:
- `src/App.tsx` coordinates high-level state, game loops, canvas mounting, and UI overlays.
- `src/constants.ts` holds canvas resolution, framerate, and balance tuning.
- `src/SpriteRenderer.ts` handles spritesheet action slicing, frame timing, and rendering.
- `src/utils.ts` re-exports shared mathematical and game utilities.
- `src/core/` houses engine loop, camera lerp, screen shake, and Canvas 2D rendering pipeline.
- `src/entities/` contains combat, player movement, weapon casting, enemy spawning, and drops.
- `src/types/` contains TypeScript contracts and data structures.
- `src/ui/` contains modular React overlays (HUD, DraftModal, SanctumShop, InventorySheet, PauseMenu, etc.).

Shared hooks and helpers live in `utils/`. Playable media lives in `assets/images/` or `assets/audio/`; update `design/asset_manifest.json` when asset metadata changes.

Read `GEMINI.md` before changing input behavior, persistence, the fixed-step game loop, or asset loading. It records required compatibility and performance invariants.

## Build, Test, and Development Commands

- `npm install` installs dependencies (Node 18+ recommended).
- `npm run dev` starts the Vite server with hot module replacement.
- `npm run build` runs TypeScript checking and creates the production bundle in `dist/`; run this before submitting changes.
- `npm run preview` serves the built bundle for a production smoke test.

There is no configured automated test suite or linter. Exercise changed game flows manually in development, then run the production build.

## Coding Style & Naming Conventions

Use TypeScript and match nearby code: two-space indentation, semicolons, single quotes, and descriptive camelCase identifiers. Use PascalCase for React components and their files (for example, `PauseMenu.tsx`); use camelCase for utilities and domain modules (for example, `spatial.ts`). Keep exported types in `src/types/` where practical. Tailwind CSS v4 is used for UI styling; prefer existing utility patterns over introducing a second styling system.

Do not allocate unnecessary arrays, closures, or objects in per-frame `update()` or `draw()` paths. Preserve the 1280×720 logical canvas, Button 9-only gamepad pause behavior, and keyboard/gamepad/pointer parity for every modal.

## Commit & Pull Request Guidelines

Follow conventional commit formats where applicable (`feat:`, `fix:`, `refactor:`, `docs:`, etc.).
