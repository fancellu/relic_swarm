- **Bundler**: [Vite 8](https://vitejs.dev/)
- **Graphics & Engine**: HTML5 Canvas 2D with a 60 FPS fixed-timestep simulation stepper
- **Audio Engine**: Web Audio API synthesis + HTMLAudioElement BGM
- **Icons**: [`lucide-react`](https://lucide.dev/)

---

## 📂 Project Structure

```
relicswarm/
├── README.md                    # Human developer and player documentation
├── GEMINI.md                    # AI agent guidelines, architecture rules, and invariants
├── package.json                 # Scripts: dev, build, preview
├── tsconfig.json                # TypeScript compiler configuration (React 19 / Vite 8)
├── vite.config.ts               # Vite configuration with Tailwind CSS & asset bundling
├── vite-env.d.ts                # Vite client ambient types
├── index.css                    # Tailwind CSS v4 entry & full-viewport styles
├── index.html                   # HTML entry point mounting #root
├── index.tsx                    # React root entry, sets standalone preview flag
├── src/
│   ├── App.tsx                  # Central game component (state, simulation loop, canvas, overlays)
│   ├── constants.ts             # Canvas resolution, target FPS, color palette, defaults
│   ├── SpriteRenderer.ts        # Spritesheet animator (actions, clipping, horizontal flip)
│   ├── utils.ts                 # Utility barrel re-exporting math and helpers
│   ├── core/                    # Engine loop, camera lerp, screen shake, renderer pipeline
│   ├── entities/                # Player, weapons, projectiles, spawner, drops, draft, chests
│   ├── types/                   # Type definitions (entities, items, meta)
│   └── ui/                      # React UI overlays (HUD, Draft, Inventory, Sanctum, Pause, etc.)
├── utils/
│   ├── BackgroundMusic.tsx      # Seamless BGM playback and looping
│   ├── helper.tsx               # Stepper, audio synthesis, asset preloading, inputs
│   ├── usePlayground.ts         # Hook bridging Playground SDK / standalone preview
│   └── playground-fake.ts       # Local mock of Playground SDK
├── design/
│   ├── game_design_document.json# Canonical design specifications
│   └── asset_manifest.json      # Metadata on spritesheets, icons, and VFX
└── assets/
    ├── audio/                   # bgm_survivor_theme.mp3
    └── images/                  # Spritesheets, projectiles, pickups, weapon & UI icons
```

---

## 📜 License
