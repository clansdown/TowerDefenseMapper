import type { Point } from '../types';
import { store } from '../state';

/**
 * Convert normalized (0–1) coordinates to image pixel coordinates.
 */
export function normalizedToImage(nx: number, ny: number): Point {
  const img = store.imageElement;
  if (!img) return { x: 0, y: 0 };
  return { x: nx * img.naturalWidth, y: ny * img.naturalHeight };
}

/**
 * Convert image pixel coordinates to screen (CSS) pixel coordinates
 * using the current zoom/pan transform (which is stored in CSS-pixel space).
 */
export function imageToScreen(ix: number, iy: number): Point {
  const { offsetX, offsetY, scale } = store.zoomPan;
  return { x: ix * scale + offsetX, y: iy * scale + offsetY };
}

/**
 * Convert screen (CSS) pixel coordinates (e.g. from event.offsetX/Y)
 * to image pixel coordinates using the inverse zoom/pan transform.
 */
export function screenToImage(sx: number, sy: number): Point {
  const { offsetX, offsetY, scale } = store.zoomPan;
  return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale };
}

/**
 * Convert screen (CSS) pixel coordinates to normalized (0–1) coordinates.
 */
export function screenToNormalized(sx: number, sy: number): Point {
  const img = store.imageElement;
  if (!img) return { x: 0, y: 0 };
  const imgPt = screenToImage(sx, sy);
  return { x: imgPt.x / img.naturalWidth, y: imgPt.y / img.naturalHeight };
}

/**
 * Convert normalized (0–1) coordinates directly to screen (CSS) pixel coordinates.
 */
export function normalizedToScreen(nx: number, ny: number): Point {
  const imgPt = normalizedToImage(nx, ny);
  return imageToScreen(imgPt.x, imgPt.y);
}
