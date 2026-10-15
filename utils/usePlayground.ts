// tslint:disable
/* eslint-disable */
import {useCallback, useEffect, useRef, useState} from 'react';

/**
 * @fileoverview Hook for interacting with the Playground SDK.
 */

/**
 * Hook to interact with Playground SDK features.
 * Dynamically loads the script and initializes the SDK.
 */
export function usePlayground() {
  const [isReady, setIsReady] = useState(false);
  const sdkRef = useRef<any>(null);

  // Use refs for callbacks to ensure they always have access to the latest React state
  const onGameEventRef = useRef<((event: any) => void) | null>(null);
  const onPresenceEventRef = useRef<((presence: any) => void) | null>(null);
  const onLobbyStatusRef = useRef<((status: any) => void) | null>(null);

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (sdkRef.current) return;

    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).PlaygroundSDK) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src =
          'https://www.gstatic.com/play/games/playground/sdk/dev/v1/playground.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error('Failed to load Playground SDK script'));
        document.head.appendChild(script);
      });
    };

    const initSDK = async () => {
      try {
        const isSandboxPreview =
          window.location.hostname === 'test.com' ||
          (window as any).__PLAYGROUND_PREVIEW__ === true;

        if (isSandboxPreview) {
          console.log(
            '🔌 [usePlayground] Local or Preview environment. Loading Fake SDK...',
          );
          // @ts-ignore - Dynamic import
          const module = await import('./playground-fake');
          (window as any).PlaygroundSDK = module.FakePlaygroundSDK;
        } else {
          await loadScript();
        }

        if ((window as any).PlaygroundSDK) {
          sdkRef.current = new (window as any).PlaygroundSDK();

          // Wrap callbacks to fire whatever function is currently in the Ref
          await sdkRef.current.init(
            (event: any) => onGameEventRef.current?.(event),
            (presence: any) => onPresenceEventRef.current?.(presence),
            (status: any) => onLobbyStatusRef.current?.(status),
          );

          setIsReady(true);
        } else {
          console.error('Playground SDK class not found after script load.');
        }
      } catch (error) {
        console.error('Playground SDK initialization failed:', error);
      }
    };

    initSDK();
  }, []);

  return {
    sdk: sdkRef.current,
    isReady,
    onGameEventRef,
    onPresenceEventRef,
    onLobbyStatusRef,
  };
}

export interface BaseGameState {
  status: string;
  score: number;
  level?: number | string;
}

/**
 * Hook to automatically synchronize game scores and game lifecycle (start,
 * score updates, game over, level complete) with the Playground SDK.
 *
 * @param gameState Current game state containing status ('START' | 'PLAYING' |
 *     'GAME_OVER' | 'VICTORY' | 'LEVEL_COMPLETE' | etc.), score, and optional level.
 * @param sdk Optional existing PlaygroundSDK instance (e.g. from usePlayground()).
 *     If omitted, usePlayground() is invoked internally.
 */
export function usePlaygroundGameLifecycle(
  gameState: BaseGameState,
  sdk?: any,
) {
  const defaultHook = usePlayground();
  const activeSdk = sdk ?? defaultHook.sdk;
  const hasCalledGameOver = useRef(false);
  const hasCalledLevelComplete = useRef(false);
  const lastScoreRef = useRef(gameState.score);
  const lastLevelRef = useRef(gameState.level);
  const lastIsPausedRef = useRef(false);

  // Keep last score and level up to date for unmount flush fallback
  lastScoreRef.current = gameState.score;
  lastLevelRef.current = gameState.level;

  useEffect(() => {
    if (!activeSdk) return;

    const status = (gameState.status || '').toUpperCase();
    const isGameOver =
      status === 'GAME_OVER' || status === 'DEFEAT' || status === 'LOST';
    const isLevelComplete =
      status === 'VICTORY' || status === 'WIN' || status === 'LEVEL_COMPLETE';
    const currentLevel = gameState.level ?? 1;

    const isPaused = status === 'PAUSED' || status === 'PAUSE';
    if (lastIsPausedRef.current !== isPaused) {
      if (typeof activeSdk.pauseStateChanged === 'function') {
        activeSdk.pauseStateChanged(isPaused);
      }
      lastIsPausedRef.current = isPaused;
    }

    if (status === 'PLAYING') {
      activeSdk.scoreUpdated({
        value: gameState.score,
        level: String(currentLevel),
      });
      hasCalledGameOver.current = false;
      hasCalledLevelComplete.current = false;
    } else if (isGameOver) {
      if (!hasCalledGameOver.current) {
        activeSdk.scoreUpdated({
          value: gameState.score,
          level: String(currentLevel),
        });
        activeSdk.gameOver();
        hasCalledGameOver.current = true;
      }
    } else if (isLevelComplete) {
      if (!hasCalledLevelComplete.current) {
        activeSdk.scoreUpdated({
          value: gameState.score,
          level: String(currentLevel),
        });
        activeSdk.levelComplete(currentLevel);
        hasCalledLevelComplete.current = true;
      }
    }
  }, [gameState.score, gameState.status, gameState.level, activeSdk]);

  // Unmount fallback: record score if game unmounts without calling gameOver or levelComplete
  useEffect(() => {
    return () => {
      if (
        activeSdk &&
        !hasCalledGameOver.current &&
        !hasCalledLevelComplete.current &&
        lastScoreRef.current > 0
      ) {
        try {
          const levelToReport = lastLevelRef.current ?? 1;
          activeSdk.scoreUpdated({
            value: lastScoreRef.current,
            level: String(levelToReport),
          });
          activeSdk.gameOver();
        } catch (_) {}
      }
    };
  }, [activeSdk]);
}

declare interface RpcMessage {
  type: string;
  payload: unknown;
  messageId: string;
}

declare interface RpcResponse {
  messageId: string;
  success: boolean;
  payload?: unknown;
  error?: string;
}

// Simple unique ID generator
let nextMessageId = 0;
function generateMessageId() {
  return `rpc-message-${nextMessageId++}`;
}

/**
 * React hook for making RPC calls to the parent window via postMessage.
 * This is designed to interact with IframeMessagingService in the host app.
 */
export function useRpc<RequestType, ResponseType>(
  rpcName: string,
): [(payload: RequestType) => Promise<ResponseType>, boolean] {
  const [isLoading, setIsLoading] = useState(false);
  const resolvers = useRef<Map<string, (resp: any) => void>>(new Map()).current;
  const rejecters = useRef<Map<string, (err: Error) => void>>(
    new Map(),
  ).current;

  useEffect(() => {
    const handleResponse = (event: MessageEvent<RpcResponse>) => {
      const response = event.data;
      if (
        response &&
        response.messageId &&
        (resolvers.has(response.messageId) || rejecters.has(response.messageId))
      ) {
        if (response.success) {
          resolvers.get(response.messageId)?.(response.payload);
        } else {
          rejecters.get(response.messageId)?.(
            new Error(response.error ?? 'Unknown RPC error'),
          );
        }
        resolvers.delete(response.messageId);
        rejecters.delete(response.messageId);
      }
    };

    window.addEventListener('message', handleResponse);
    return () => {
      window.removeEventListener('message', handleResponse);
    };
  }, [resolvers, rejecters]);

  const callRpc = useCallback(
    (payload: RequestType): Promise<ResponseType> => {
      setIsLoading(true);
      const promise = new Promise<ResponseType>((resolve, reject) => {
        const messageId = generateMessageId();
        resolvers.set(messageId, resolve);
        rejecters.set(messageId, reject);

        const message: RpcMessage = {
          type: rpcName,
          payload,
          messageId,
        };
        window.parent.postMessage(message, '*'); // Consider restricting target origin
      });
      promise.finally(() => {
        setIsLoading(false);
      });
      return promise;
    },
    [rpcName, resolvers, rejecters],
  );

  return [callRpc, isLoading];
}

export type NumberConfigEntry = {
  value: number;
  type: 'number';
  label: string;
  group: string;
  min?: number;
  max?: number;
  step?: number;
};

export type BooleanConfigEntry = {
  value: boolean;
  type: 'boolean';
  label: string;
  group: string;
};

export type ColorConfigEntry = {
  value: string; // hex e.g. "#ff0000"
  type: 'color';
  label: string;
  group: string;
};

export type SelectConfigEntry = {
  value: string;
  type: 'select';
  label: string;
  group: string;
  options: string[];
};

export type Vector2ConfigEntry = {
  value: {x: number; y: number};
  type: 'vector2';
  label: string;
  group: string;
};

export type ConfigEntry =
  | NumberConfigEntry
  | BooleanConfigEntry
  | ColorConfigEntry
  | SelectConfigEntry
  | Vector2ConfigEntry;

export type GameConfig = Record<string, ConfigEntry>;

// Utility: extract a flat values object from a CONFIG
export type ConfigValues<T extends GameConfig> = {
  [K in keyof T]: T[K]['value'];
};
