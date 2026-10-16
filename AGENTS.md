# Repository Guidelines

## Project Structure & Module Organization

Relic Swarm is a React 19 and TypeScript Vite game. Root files provide the application shell: `index.tsx` mounts React, `App.tsx` coordinates the game, `constants.ts` holds shared tuning, and `SpriteRenderer.ts` handles sprite animation. New domain code belongs under `src/`: `src/core/` for engine and rendering infrastructure, `src/entities/` for game systems, `src/types/` for contracts, and `src/ui/` for React overlays. Shared hooks and helpers live in `utils/`. Keep playable media in `assets/images/` or `assets/audio/`; update `design/asset_manifest.json` when asset metadata changes.

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

Recent history uses short, imperative prefixes such as `feat:`, `fix:`, and `docs:`; use the same convention (for example, `fix: prevent duplicate chest rewards`). Keep commits focused. Pull requests should summarize gameplay and technical changes, link relevant issues when available, state validation performed (`npm run build` at minimum), and include screenshots or a short recording for visible UI or gameplay changes.

## Configuration & Persistence

Do not rename existing `localStorage` keys without a migration: `relic_swarm_sanctum_gold`, legacy `relic_swarm_gold`, and `relic_swarm_meta`. Asset paths must remain relative to `assets/` so Vite's copy plugin includes them in production builds.
