/**
 * Configuration for Relic Swarm.
 */
export const CONFIG = {
  // GAME
  title: {
    value: 'Relic Swarm',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1280,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 720,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // SYSTEM
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // THEME
  backgroundColor: {
    value: '#0c0a1a',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#e11d48',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'system-ui, -apple-system, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // AUDIO
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.6,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // RULES & GAMEPLAY TUNING (For playground_config.json)
  playerBaseHp: {
    value: 100,
    type: 'number',
    label: 'Player Base HP',
    group: 'Rules',
  },
  playerBaseSpeed: {
    value: 220,
    type: 'number',
    label: 'Player Base Speed',
    group: 'Rules',
  },
  enemySpawnRate: {
    value: 1.2,
    type: 'number',
    label: 'Enemy Spawn Rate Mult',
    group: 'Rules',
  },
  maxEnemies: {
    value: 250,
    type: 'number',
    label: 'Max Active Enemies',
    group: 'Rules',
  },
  itemDropChance: {
    value: 0.95,
    type: 'number',
    label: 'XP Gem Drop Chance',
    group: 'Rules',
  },
  bossSpawnTimeSeconds: {
    value: 300, // 5 min for standard arcade game session (can survive up to 15 min / 900s for victory)
    type: 'number',
    label: 'Boss Spawn Time (s)',
    group: 'Rules',
  },
  screenShakeEnabled: {
    value: true,
    type: 'boolean',
    label: 'Screen Shake Enabled',
    group: 'Rules',
  },

  // ASSET DIMENSIONS & RATIOS (derived from read_assets_metadata)
  assetRadiantAuraAspectRatio: {
    value: 947 / 762,
    type: 'number',
    label: 'Radiant Aura Aspect Ratio',
    group: 'ASSETS',
  },
  assetMagicMissileAspectRatio: {
    value: 761 / 558,
    type: 'number',
    label: 'Magic Missile Aspect Ratio',
    group: 'ASSETS',
  },
  assetFlameBlastAspectRatio: {
    value: 660 / 508,
    type: 'number',
    label: 'Flame Blast Aspect Ratio',
    group: 'ASSETS',
  },
  assetSpinningDaggerAspectRatio: {
    value: 792 / 534,
    type: 'number',
    label: 'Spinning Dagger Aspect Ratio',
    group: 'ASSETS',
  },
  assetThunderStrikeAspectRatio: {
    value: 363 / 858,
    type: 'number',
    label: 'Thunder Strike Aspect Ratio',
    group: 'ASSETS',
  },
  assetXpGemBlueAspectRatio: {
    value: 782 / 824,
    type: 'number',
    label: 'Sapphire XP Gem Aspect Ratio',
    group: 'ASSETS',
  },
  assetXpGemPurpleAspectRatio: {
    value: 784 / 700,
    type: 'number',
    label: 'Amethyst XP Gem Aspect Ratio',
    group: 'ASSETS',
  },
  assetTreasureChestAspectRatio: {
    value: 812 / 698,
    type: 'number',
    label: 'Treasure Chest Aspect Ratio',
    group: 'ASSETS',
  },
  assetGoldCoinAspectRatio: {
    value: 742 / 658,
    type: 'number',
    label: 'Gold Coin Aspect Ratio',
    group: 'ASSETS',
  },
  assetHealthPotionAspectRatio: {
    value: 669 / 823,
    type: 'number',
    label: 'Health Potion Aspect Ratio',
    group: 'ASSETS',
  },
  assetMagnetRuneAspectRatio: {
    value: 835 / 712,
    type: 'number',
    label: 'Magnet Rune Aspect Ratio',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/**
 * Type helper for reading values in game code
 */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}
