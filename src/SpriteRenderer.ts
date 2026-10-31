export interface SpriteActionConfig {
  imageUrl: string;
  totalFrames: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop?: boolean;
}

export interface SpriteAnimationState {
  currentAction: string;
  currentFrame: number;
  timer: number;
}

export class SpriteRenderer {
  private configs: Record<string, SpriteActionConfig>;

  constructor(configs: Record<string, SpriteActionConfig>) {
    this.configs = configs;
  }

  /**
   * Advances the animation state in-place based on delta time with zero allocation.
   */
  advanceInPlace(
    state: SpriteAnimationState,
    deltaTime: number,
  ): void {
    const config = this.configs[state.currentAction];
    if (!config) return;

    state.timer += deltaTime;
    const frameDuration = 1 / Math.max(1, config.fps);

    if (state.timer >= frameDuration) {
      const framesToAdvance = Math.floor(state.timer / frameDuration);
      state.timer %= frameDuration;
      const nextFrame = state.currentFrame + framesToAdvance;

      if (config.loop === false) {
        state.currentFrame = Math.min(config.totalFrames - 1, nextFrame);
      } else {
        state.currentFrame = nextFrame % config.totalFrames;
      }
    }
  }

  /**
   * Advances the animation state based on delta time.
   */
  getNextState(
    currentState: SpriteAnimationState,
    deltaTime: number,
  ): SpriteAnimationState {
    const config = this.configs[currentState.currentAction];
    if (!config) return currentState;

    const nextState = {...currentState};
    nextState.timer += deltaTime;
    const frameDuration = 1 / Math.max(1, config.fps);

    if (nextState.timer >= frameDuration) {
      const framesToAdvance = Math.floor(nextState.timer / frameDuration);
      nextState.timer %= frameDuration;
      const nextFrame = nextState.currentFrame + framesToAdvance;

      if (config.loop === false) {
        nextState.currentFrame = Math.min(config.totalFrames - 1, nextFrame);
      } else {
        nextState.currentFrame = nextFrame % config.totalFrames;
      }
    }
    return nextState;
  }

  /**
   * Draws the sprite to the canvas using preloaded images.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    state: SpriteAnimationState,
    x: number,
    y: number,
    width: number,
    height: number,
    loadedImages: Record<string, HTMLImageElement | null>,
    flipX = false,
  ) {
    const config = this.configs[state.currentAction];
    if (!config) return;

    const img = loadedImages[config.imageUrl];

    if (!img || !img.complete || img.naturalWidth === 0) {
      // Fallback geometric drawing
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, width / 2), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const fw = Math.max(1, config.frameWidth);
    const fh = Math.max(1, config.frameHeight);
    const framesPerRow = Math.max(1, Math.floor(img.width / fw));
    const totalPossibleFrames = Math.max(
      1,
      framesPerRow * Math.max(1, Math.floor(img.height / fh)),
    );

    const frameIndex =
      Math.min(config.totalFrames - 1, totalPossibleFrames - 1, Math.max(0, state.currentFrame));

    const sourceX = (frameIndex % framesPerRow) * fw;
    const sourceY = Math.floor(frameIndex / framesPerRow) * fh;

    ctx.save();
    ctx.translate(x, y);
    if (flipX) {
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      fw,
      fh,
      -width / 2,
      -height / 2,
      width,
      height,
    );

    ctx.restore();
  }
}
