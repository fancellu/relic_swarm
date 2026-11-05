import {RefObject, useEffect} from 'react';

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Saves the game canvas as a PNG download.
 * Captures the Canvas 2D frame only (world, entities, effects); React DOM overlays are not included.
 */
export function saveCanvasScreenshot(canvas: HTMLCanvasElement): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relic-swarm-${timestamp()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

/**
 * Secret hotkey: the backtick key (`) saves a screenshot of the game canvas.
 * Uses `event.code` so it works regardless of keyboard layout, and ignores key repeat.
 */
export function useScreenshotHotkey(canvasRef: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Backquote' || event.repeat) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      event.preventDefault();
      saveCanvasScreenshot(canvas);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasRef]);
}
