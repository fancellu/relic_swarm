import {SpriteActionConfig, SpriteRenderer} from '../SpriteRenderer';

export interface GameSpriteRenderers {
  hero_spellblade: SpriteRenderer;
  hero_pyromancer: SpriteRenderer;
  hero_voidstalker: SpriteRenderer;
  skeleton: SpriteRenderer;
  hound: SpriteRenderer;
  bat: SpriteRenderer;
  titan: SpriteRenderer;
  [key: string]: SpriteRenderer;
}

export function initSpriteRenderers(): GameSpriteRenderers {
  const makeConfig = (
    img: string,
    frames = 16,
    fps = 12,
    w = 512,
    h = 512,
    loop = true,
  ): SpriteActionConfig => ({
    imageUrl: img,
    totalFrames: frames,
    frameWidth: w,
    frameHeight: h,
    fps,
    loop,
  });

  return {
    hero_spellblade: new SpriteRenderer({
      IDLE: makeConfig('hero_spellblade_idle', 4, 6),
      RUN: makeConfig('hero_spellblade_run', 16, 16),
      ATTACK: makeConfig('hero_spellblade_attack', 16, 16),
      HURT: makeConfig('hero_spellblade_hurt', 16, 10, 512, 512, false),
      DEATH: makeConfig('hero_spellblade_death', 16, 10, 512, 512, false),
    }),
    hero_pyromancer: new SpriteRenderer({
      IDLE: makeConfig('hero_pyromancer_idle', 4, 6),
      RUN: makeConfig('hero_pyromancer_run', 16, 16),
      ATTACK: makeConfig('hero_pyromancer_attack', 16, 16),
      HURT: makeConfig('hero_pyromancer_hurt', 16, 10, 512, 512, false),
      DEATH: makeConfig('hero_pyromancer_death', 16, 10, 512, 512, false),
    }),
    hero_voidstalker: new SpriteRenderer({
      IDLE: makeConfig('hero_voidstalker_idle', 4, 6),
      RUN: makeConfig('hero_voidstalker_run', 16, 16),
      ATTACK: makeConfig('hero_voidstalker_attack', 16, 16),
      HURT: makeConfig('hero_voidstalker_hurt', 16, 10, 512, 512, false),
      DEATH: makeConfig('hero_voidstalker_death', 16, 10, 512, 512, false),
    }),
    skeleton: new SpriteRenderer({
      IDLE: makeConfig('enemy_skeleton_idle', 4, 6),
      RUN: makeConfig('enemy_skeleton_run', 16, 16),
      ATTACK: makeConfig('enemy_skeleton_attack', 16, 14),
      HURT: makeConfig('enemy_skeleton_hurt', 16, 10, 512, 512, false),
      DEATH: makeConfig('enemy_skeleton_death', 16, 10, 512, 512, false),
    }),
    hound: new SpriteRenderer({
      IDLE: makeConfig('enemy_shadow_hound_quad_idle', 16, 8),
      RUN: makeConfig('enemy_shadow_hound_quad_running', 16, 16),
      ATTACK: makeConfig('enemy_shadow_hound_quad_jump', 16, 16),
    }),
    bat: new SpriteRenderer({
      IDLE: makeConfig('enemy_abyssal_bat_avian_idle', 16, 8),
      RUN: makeConfig('enemy_abyssal_bat_bird_fly', 16, 14),
      ATTACK: makeConfig('enemy_abyssal_bat_bird_dive', 16, 16),
    }),
    titan: new SpriteRenderer({
      IDLE: makeConfig('boss_abyssal_titan_idle', 4, 6),
      RUN: makeConfig('boss_abyssal_titan_run', 16, 12),
      ATTACK: makeConfig('boss_abyssal_titan_attack', 16, 14),
      DEATH: makeConfig('boss_abyssal_titan_death', 16, 8, 512, 512, false),
    }),
  };
}
