import { store } from '../state';

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
const ZOOM_SENSITIVITY = 0.001;

/**
 * Calculate and apply a zoom-to-fit transform so the map image
 * is centered and fully visible within the canvas.
 * All zoom/pan values are stored in CSS-pixel space.
 */
export function zoomToFit(canvas: HTMLCanvasElement): void {
  const img = store.imageElement;
  if (!img) return;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
  const offsetX = (cw - img.naturalWidth * scale) / 2;
  const offsetY = (ch - img.naturalHeight * scale) / 2;
  store.updateZoomPan({ offsetX, offsetY, scale });
}

/**
 * Handle mouse wheel zoom. Zooms toward the cursor position so the
 * point under the cursor stays fixed on screen.
 */
export function handleWheel(event: WheelEvent, _canvas: HTMLCanvasElement): void {
  event.preventDefault();
  const { offsetX, offsetY, scale } = store.zoomPan;
  const delta = -event.deltaY * ZOOM_SENSITIVITY;
  const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale * (1 + delta)));
  const mx = event.offsetX;
  const my = event.offsetY;
  const newOffsetX = mx - (mx - offsetX) * (newScale / scale);
  const newOffsetY = my - (my - offsetY) * (newScale / scale);
  store.updateZoomPan({ offsetX: newOffsetX, offsetY: newOffsetY, scale: newScale });
}
