import React, {useEffect, useRef, useState} from 'react';

/**
 * Properties for the BackgroundMusic component.
 */
export interface BackgroundMusicProps {
  /** The URL of the audio track to play. */
  readonly url: string;
  /** Whether playback is currently active. */
  readonly isPlaying: boolean;
  /** Whether the audio output is muted. Defaults to false. */
  readonly isMuted?: boolean;
  /** Master volume level between 0.0 (silent) and 1.0 (full). Defaults to 0.15. */
  readonly volume?: number;
}

/**
 * Detected start and end sample indices of audible sound within an audio track,
 * aligned to zero-crossings to eliminate DC offset transients.
 */
export interface AudioBoundaries {
  /** First non-silent audio sample index. */
  readonly startSample: number;
  /** Last non-silent audio sample index. */
  readonly endSample: number;
}

/**
 * Result of seamless loop synthesis containing the synthesized AudioBuffer and
 * the sample-accurate loop turnaround time boundaries in seconds.
 */
export interface SeamlessLoopResult {
  /** Synthesized audio buffer containing clean intro/body and seamless tail crossfade. */
  readonly buffer: AudioBuffer;
  /** Loop start offset in seconds where the loop returns after turnaround. */
  readonly loopStartSec: number;
  /** Loop end offset in seconds where playback turnaround occurs. */
  readonly loopEndSec: number;
}

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Audio configuration constants
const DEFAULT_VOLUME = 0.15;
const SILENCE_THRESHOLD_AMPLITUDE = 0.003; // ~ -50 dBFS
const SAFETY_MARGIN_SEC = 0.002; // 2ms pre-roll safety margin
const DECLICK_RAMP_SEC = 0.025; // 25ms de-click fade-in
const VOLUME_TIME_CONSTANT_SEC = 0.015; // 15ms exponential filter for de-zippering
const DEFAULT_CROSSFADE_SEC = 0.6; // 600ms equal-power crossfade for seamless loop seam
const MAX_END_SCAN_SEC = 8.0; // Scan up to 8s of trailing audio for dead air / decay
const MIN_SAMPLES = 128; // Minimum sample block size for Web Audio processing

/**
 * Scans all channels of an AudioBuffer to detect audio boundaries in integer sample counts,
 * trimming leading MP3 encoder priming silence and trailing padding / dead air.
 * Aligns boundaries to zero-crossings to eliminate DC offset click transients.
 */
export function scanAudioBoundaries(buffer: AudioBuffer): AudioBoundaries {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const totalSamples = buffer.length;
  if (totalSamples === 0) {
    return {startSample: 0, endSample: 0};
  }

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  // 1. Scan start: examine up to 1 second of audio for priming silence
  let startIndex = 0;
  const maxStartScan = Math.min(totalSamples, sampleRate);
  for (let i = 0; i < maxStartScan; i++) {
    let peak = 0;
    for (let c = 0; c < numChannels; c++) {
      const sampleAmplitude = Math.abs(channels[c][i]);
      if (sampleAmplitude > peak) peak = sampleAmplitude;
    }
    if (peak > SILENCE_THRESHOLD_AMPLITUDE) {
      const marginSamples = Math.floor(sampleRate * SAFETY_MARGIN_SEC);
      let targetIndex = Math.max(0, i - marginSamples);
      while (targetIndex > 0 && targetIndex > i - marginSamples - 256) {
        if (channels[0][targetIndex] >= 0 && channels[0][targetIndex - 1] < 0) {
          break;
        }
        targetIndex--;
      }
      startIndex = targetIndex;
      break;
    }
  }

  // 2. Scan end: examine trailing audio (up to MAX_END_SCAN_SEC or 50% of track) for dead air
  let endIndex = totalSamples;
  const maxEndScanSamples = Math.min(
    Math.floor(totalSamples * 0.5),
    Math.floor(sampleRate * MAX_END_SCAN_SEC),
  );
  const minEndScan = Math.max(0, totalSamples - maxEndScanSamples);
  for (let i = totalSamples - 1; i >= minEndScan; i--) {
    let peak = 0;
    for (let c = 0; c < numChannels; c++) {
      const sampleAmplitude = Math.abs(channels[c][i]);
      if (sampleAmplitude > peak) peak = sampleAmplitude;
    }
    if (peak > SILENCE_THRESHOLD_AMPLITUDE) {
      const marginSamples = Math.floor(sampleRate * SAFETY_MARGIN_SEC);
      let targetIndex = Math.min(totalSamples, i + 1 + marginSamples);
      while (
        targetIndex < totalSamples &&
        targetIndex < i + marginSamples + 256
      ) {
        if (channels[0][targetIndex] >= 0 && channels[0][targetIndex - 1] < 0) {
          break;
        }
        targetIndex++;
      }
      endIndex = targetIndex;
      break;
    }
  }

  return {
    startSample: startIndex,
    endSample: Math.max(startIndex + MIN_SAMPLES, endIndex),
  };
}

/**
 * Synthesizes an equal-power seamless looped AudioBuffer by crossfading the
 * release/decay tail into the beginning of the track.
 *
 * Buffer layout:
 * - [0 .. trimmedLength - crossfadeSamples): Clean intro and body from original audio.
 *   Plays cleanly at t=0 on initial game start with full transients.
 * - [trimmedLength - crossfadeSamples .. trimmedLength): Equal-power crossfade where
 *   the release/decay tail fades out and the track head fades in.
 *
 * When playback reaches loopEnd (trimmedLength / sampleRate), Web Audio loops back to
 * loopStart (crossfadeSamples / sampleRate). Since the crossfade region already faded
 * into the track head [0 .. crossfadeSamples), the transition into crossfadeSamples
 * is perfectly continuous.
 */
export function createSeamlessLoopBuffer(
  ctx: BaseAudioContext,
  rawBuffer: AudioBuffer,
  boundaries: AudioBoundaries,
  crossfadeDurationSec = DEFAULT_CROSSFADE_SEC,
): SeamlessLoopResult {
  const sampleRate = rawBuffer.sampleRate;
  const numChannels = rawBuffer.numberOfChannels;
  const startSample = Math.max(0, boundaries.startSample);
  const endSample = Math.min(rawBuffer.length, boundaries.endSample);
  const trimmedLength = endSample - startSample;

  if (trimmedLength <= 0) {
    return {
      buffer: rawBuffer,
      loopStartSec: 0,
      loopEndSec: rawBuffer.duration,
    };
  }

  // Cap crossfade at 25% of audio length to prevent collapsing short tracks
  const maxCrossfade = Math.floor(trimmedLength * 0.25);
  const targetCrossfade = Math.floor(crossfadeDurationSec * sampleRate);
  const crossfadeSamples = Math.min(targetCrossfade, maxCrossfade);

  // If track is very short or crossfade is negligible, return trimmed slice
  if (crossfadeSamples < MIN_SAMPLES) {
    const sliced = ctx.createBuffer(numChannels, trimmedLength, sampleRate);
    for (let c = 0; c < numChannels; c++) {
      const src = rawBuffer.getChannelData(c);
      sliced.getChannelData(c).set(src.subarray(startSample, endSample));
    }
    return {
      buffer: sliced,
      loopStartSec: 0,
      loopEndSec: sliced.duration,
    };
  }

  const loopedBuffer = ctx.createBuffer(numChannels, trimmedLength, sampleRate);

  // Pre-calculate equal-power sin/cos curves: sin^2(x) + cos^2(x) = 1.0 (constant acoustic power)
  const halfPi = Math.PI / 2;
  const fadeInWeights = new Float32Array(crossfadeSamples);
  const fadeOutWeights = new Float32Array(crossfadeSamples);
  for (let i = 0; i < crossfadeSamples; i++) {
    const progress = i / crossfadeSamples;
    fadeInWeights[i] = Math.sin(progress * halfPi);
    fadeOutWeights[i] = Math.cos(progress * halfPi);
  }

  const bodyLength = trimmedLength - crossfadeSamples;
  const tailStart = endSample - crossfadeSamples;

  for (let c = 0; c < numChannels; c++) {
    const src = rawBuffer.getChannelData(c);
    const dst = loopedBuffer.getChannelData(c);

    // 1. Clean intro & body: original audio from startSample
    dst.set(src.subarray(startSample, startSample + bodyLength), 0);

    // 2. Crossfade region: tail fading out, head fading in with amplitude clamping
    for (let i = 0; i < crossfadeSamples; i++) {
      const headSample = src[startSample + i];
      const tailSample = src[tailStart + i];
      const mixed =
        headSample * fadeInWeights[i] + tailSample * fadeOutWeights[i];
      dst[bodyLength + i] = Math.max(-1, Math.min(1, mixed));
    }
  }

  return {
    buffer: loopedBuffer,
    loopStartSec: crossfadeSamples / sampleRate,
    loopEndSec: loopedBuffer.duration,
  };
}

/**
 * Standalone background music player for HTML5 games in Google Playground.
 *
 * Uses native Web Audio API sample-accurate looping (AudioBufferSourceNode.loop)
 * to deliver seamless, gap-free playback without audio cutouts or JS timer drift.
 * Automatically scans and trims MP3 encoder priming/padding delays, smooths volume
 * transitions against zipper noise, handles mobile autoplay policies, and falls
 * back gracefully to HTML5 <audio> if Web Audio or CORS fetch is unavailable.
 */
export function BackgroundMusic({
  url,
  isPlaying,
  isMuted = false,
  volume = DEFAULT_VOLUME,
}: BackgroundMusicProps): React.ReactElement | null {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const trackGainRef = useRef<GainNode | null>(null);
  const loopResultRef = useRef<SeamlessLoopResult | null>(null);
  const unlockCleanupRef = useRef<(() => void) | null>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);

  const isPlayingRef = useRef(isPlaying);
  const [useFallback, setUseFallback] = useState(false);
  const useFallbackRef = useRef(false);
  const [platformMuted, setPlatformMuted] = useState(false);

  const effectiveMuted = isMuted || platformMuted;

  // Sync latest playing state ref
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Synchronize with Playground platform mute events
  useEffect(() => {
    const handlePlatformMute = (e: Event) => {
      const customEvent = e as CustomEvent<{muted: boolean}>;
      if (typeof customEvent.detail?.muted === 'boolean') {
        setPlatformMuted(customEvent.detail.muted);
      }
    };
    window.addEventListener('playground-mute', handlePlatformMute);
    return () => {
      window.removeEventListener('playground-mute', handlePlatformMute);
    };
  }, []);

  // Initialize AudioContext and Master Gain
  const getOrCreateContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      return audioCtxRef.current;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextClass) {
      setUseFallback(true);
      useFallbackRef.current = true;
      return null;
    }

    try {
      const ctx = new AudioContextClass();
      const masterGain = ctx.createGain();
      const targetGain = effectiveMuted ? 0 : Math.max(0, Math.min(1, volume));
      masterGain.gain.setValueAtTime(targetGain, ctx.currentTime);
      masterGain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = masterGain;

      // Autoplay unlock for mobile/desktop browsers with iOS WebKit silence kickstart
      const unlock = () => {
        if (ctx.state === 'suspended') {
          void ctx
            .resume()
            .then(() => {
              try {
                const buf = ctx.createBuffer(1, 1, 22050);
                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(ctx.destination);
                src.start(0);
              } catch (_) {
                // Ignore silent buffer kickstart errors
              }
            })
            .catch(() => {});
        }
        if (ctx.state === 'running') {
          cleanupUnlock();
        }
      };

      const cleanupUnlock = () => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('click', unlock);
      };

      unlockCleanupRef.current = cleanupUnlock;
      window.addEventListener('pointerdown', unlock, {passive: true});
      window.addEventListener('keydown', unlock, {passive: true});
      window.addEventListener('touchstart', unlock, {passive: true});
      window.addEventListener('click', unlock, {passive: true});

      return ctx;
    } catch {
      setUseFallback(true);
      useFallbackRef.current = true;
      return null;
    }
  };

  const stopWebAudioSource = (): void => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (_) {
        // Node may already be stopped
      }
      sourceNodeRef.current = null;
    }
    if (trackGainRef.current) {
      try {
        trackGainRef.current.disconnect();
      } catch (_) {
        // Gain node may already be disconnected
      }
      trackGainRef.current = null;
    }
  };

  const startWebAudioLoop = (): void => {
    if (useFallbackRef.current) return;

    const ctx = getOrCreateContext();
    const loopResult = loopResultRef.current;
    const masterGain = masterGainRef.current;
    if (!ctx || !loopResult || !masterGain) return;

    stopWebAudioSource();

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const source = ctx.createBufferSource();
    source.buffer = loopResult.buffer;
    source.loop = true;
    source.loopStart = loopResult.loopStartSec;
    source.loopEnd = loopResult.loopEndSec;

    // 25ms initial anti-click fade-in
    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0, ctx.currentTime);
    trackGain.gain.linearRampToValueAtTime(
      1,
      ctx.currentTime + DECLICK_RAMP_SEC,
    );

    source.connect(trackGain);
    trackGain.connect(masterGain);

    source.onended = () => {
      try {
        source.disconnect();
        trackGain.disconnect();
      } catch (_) {
        // Safe disconnection cleanup
      }
    };

    source.start(0);
    sourceNodeRef.current = source;
    trackGainRef.current = trackGain;
  };

  // Fetch and decode audio file when URL changes
  useEffect(() => {
    setUseFallback(false);
    useFallbackRef.current = false;
    stopWebAudioSource();
    loopResultRef.current = null;

    if (!url) {
      return;
    }

    let isCancelled = false;
    const abortController = new AbortController();

    fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.arrayBuffer();
      })
      .then((arrayBuffer) => {
        const ctx = getOrCreateContext();
        if (!ctx) throw new Error('AudioContext unavailable');
        return ctx.decodeAudioData(arrayBuffer);
      })
      .then((decodedBuffer) => {
        if (isCancelled || abortController.signal.aborted) return;
        const ctx = getOrCreateContext();
        if (!ctx) return;
        const boundaries = scanAudioBoundaries(decodedBuffer);
        loopResultRef.current = createSeamlessLoopBuffer(
          ctx,
          decodedBuffer,
          boundaries,
          DEFAULT_CROSSFADE_SEC,
        );
        if (isPlayingRef.current) {
          startWebAudioLoop();
        }
      })
      .catch((err: unknown) => {
        if (isCancelled || abortController.signal.aborted) return;
        console.warn(
          '[BackgroundMusic] Web Audio load failed, falling back to HTML5 audio:',
          err,
        );
        setUseFallback(true);
        useFallbackRef.current = true;
      });

    return () => {
      isCancelled = true;
      abortController.abort();
      stopWebAudioSource();
      loopResultRef.current = null;
    };
  }, [url]);

  // Handle Play/Pause with true pause & resume
  useEffect(() => {
    if (useFallback) {
      const audio = fallbackAudioRef.current;
      if (!audio) return;
      if (isPlaying) {
        void audio.play().catch(() => {});
      } else {
        audio.pause();
      }
      return;
    }

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (isPlaying) {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      if (!sourceNodeRef.current && loopResultRef.current) {
        startWebAudioLoop();
      }
    } else {
      if (ctx.state === 'running') {
        void ctx.suspend().catch(() => {});
      }
    }
  }, [isPlaying, useFallback]);

  // Handle tab visibility changes (suspend on hide, resume on visible)
  useEffect(() => {
    const handleVisibility = () => {
      const ctx = audioCtxRef.current;
      if (!ctx || useFallback) return;
      if (document.hidden) {
        if (ctx.state === 'running') {
          void ctx.suspend().catch(() => {});
        }
      } else if (isPlayingRef.current) {
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [useFallback]);

  // Handle Volume & Mute with de-zippering
  useEffect(() => {
    const targetGain = effectiveMuted ? 0 : Math.max(0, Math.min(1, volume));

    if (useFallback) {
      if (fallbackAudioRef.current) {
        fallbackAudioRef.current.muted = effectiveMuted;
        fallbackAudioRef.current.volume = targetGain;
      }
      return;
    }

    const ctx = audioCtxRef.current;
    const masterGain = masterGainRef.current;
    if (ctx && masterGain && ctx.state !== 'closed') {
      masterGain.gain.setTargetAtTime(
        targetGain,
        ctx.currentTime,
        VOLUME_TIME_CONSTANT_SEC,
      );
    }
  }, [effectiveMuted, volume, useFallback]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopWebAudioSource();
      if (unlockCleanupRef.current) {
        unlockCleanupRef.current();
        unlockCleanupRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        masterGainRef.current = null;
      }
      loopResultRef.current = null;
    };
  }, []);

  if (useFallback && url) {
    return (
      <audio
        ref={fallbackAudioRef}
        src={url}
        loop
        autoPlay={isPlaying}
        style={{display: 'none'}}
      />
    );
  }

  return null;
}

// tslint:disable-next-line:no-default-export
export default BackgroundMusic;
