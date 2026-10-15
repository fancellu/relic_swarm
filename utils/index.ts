/**
 * @fileoverview Canonical barrel export for shared Playground utilities.
 *
 * Re-exports all shared helpers, components, and types from `./BackgroundMusic`,
 * `./helper`, and `./usePlayground` so generated games importing from `./utils`
 * or `../utils` resolve cleanly when `utils/` is a directory.
 */

export {
  BackgroundMusic,
  createSeamlessLoopBuffer,
  scanAudioBoundaries,
  type AudioBoundaries,
  type BackgroundMusicProps,
  type SeamlessLoopResult,
} from './BackgroundMusic';
export {
  MenuOverlay,
  Overlay,
  clamp,
  createFixedStepper,
  drawAsset,
  drawBackground,
  formatTime,
  gameAudio,
  prepareCanvas,
  shuffle,
  useAssets,
  useAutoFocus,
  useInput,
  useIsMobile,
  type Entity,
  type GamePhase,
  type GameState,
  type InputAction,
  type InputSnapshot,
  type MenuOverlayProps,
  type MusicTrack,
  type PointerState,
  type Position,
  type SpriteConfig,
} from './helper';
export {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
  type BaseGameState,
  type BooleanConfigEntry,
  type ColorConfigEntry,
  type ConfigEntry,
  type ConfigValues,
  type GameConfig,
  type NumberConfigEntry,
  type SelectConfigEntry,
  type Vector2ConfigEntry,
} from './usePlayground';
