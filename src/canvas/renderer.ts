import { store } from '../state';
import { normalizedToImage, normalizedToScreen } from './coords';

/* ---- Constants ---- */

const SPAWN_COLOR = '#00ff88';
const SPAWN_STROKE = '#005533';
const PATH_COLOR = '#4488ff';
const INTERSECTION_COLOR = '#ffcc00';
const INTERSECTION_STROKE = '#886600';
const EXCLUSION_FILL = 'rgba(255, 68, 68, 0.2)';
const EXCLUSION_STROKE = '#ff4444';
const ENDPOINT_COLOR = '#ff4444';
const ENDPOINT_STROKE = '#882222';
const SELECTED_COLOR = '#ffffff';
const HANDLE_RADIUS = 5;
const SPAWN_RADIUS = 10;
const INTERSECTION_RADIUS = 8;
const ENDPOINT_SIZE = 8;

/* ---- Renderer ---- */

/**
 * Main canvas renderer. Reads the current state and draws the image
 * with all overlays onto the canvas. The render method is pure in the
 * sense that it only reads state and draws — no side effects.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D rendering context');
    this.ctx = ctx;
  }

  /**
   * Perform a complete redraw. Call this when the dirty flag is set.
   */
  render(): void {
    const ctx = this.ctx;
    const { offsetX, offsetY, scale } = store.zoomPan;
    const dpr = window.devicePixelRatio || 1;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cw, ch);

    if (!store.imageElement || !store.mapData) return;

    // Apply zoom/pan transform (scale by devicePixelRatio for HiDPI)
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
    ctx.drawImage(store.imageElement, 0, 0);

    this.drawExclusionZones();
    this.drawEndPoints();
    this.drawIntersections();
    this.drawPaths();
    this.drawSpawnPoints();
    this.drawPendingPath();
    this.drawPendingPolygon();
  }

  private isSelected(id: string): boolean {
    return store.selectedItemId === id;
  }

  private drawSpawnPoints(): void {
    const ctx = this.ctx;
    for (const spawn of store.mapData!.spawnPoints) {
      const pt = normalizedToImage(spawn.x, spawn.y);
      const sel = this.isSelected(spawn.id);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, SPAWN_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = SPAWN_COLOR;
      ctx.fill();
      ctx.strokeStyle = sel ? SELECTED_COLOR : SPAWN_STROKE;
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pt.x - 6, pt.y);
      ctx.lineTo(pt.x + 6, pt.y);
      ctx.moveTo(pt.x, pt.y - 6);
      ctx.lineTo(pt.x, pt.y + 6);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(spawn.label, pt.x + SPAWN_RADIUS + 4, pt.y - SPAWN_RADIUS);
    }
  }

  private drawPaths(): void {
    const ctx = this.ctx;
    for (const path of store.mapData!.paths) {
      if (path.waypoints.length < 2) continue;
      const sel = this.isSelected(path.id);

      ctx.strokeStyle = sel ? SELECTED_COLOR : PATH_COLOR;
      ctx.lineWidth = sel ? 4 : 2.5;
      ctx.beginPath();
      const first = normalizedToImage(path.waypoints[0].x, path.waypoints[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < path.waypoints.length; i++) {
        const pt = normalizedToImage(path.waypoints[i].x, path.waypoints[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      for (const wp of path.waypoints) {
        const pt = normalizedToImage(wp.x, wp.y);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = sel ? SELECTED_COLOR : PATH_COLOR;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (path.waypoints.length > 0) {
        const mid = path.waypoints[Math.floor(path.waypoints.length / 2)];
        const pt = normalizedToImage(mid.x, mid.y);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(path.label, pt.x + 6, pt.y - 6);
      }
    }
  }

  private drawIntersections(): void {
    const ctx = this.ctx;
    for (const intersection of store.mapData!.intersections) {
      const pt = normalizedToImage(intersection.x, intersection.y);
      const sel = this.isSelected(intersection.id);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, INTERSECTION_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = INTERSECTION_COLOR;
      ctx.fill();
      ctx.strokeStyle = sel ? SELECTED_COLOR : INTERSECTION_STROKE;
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◈', pt.x, pt.y + 1);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(intersection.label, pt.x + INTERSECTION_RADIUS + 4, pt.y - INTERSECTION_RADIUS);
    }
  }

  private drawPendingPath(): void {
    const waypoints = store.pendingPathWaypoints;
    if (waypoints.length < 1) return;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dashed line between waypoints (screen space)
    if (waypoints.length >= 2) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = PATH_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const first = normalizedToScreen(waypoints[0].x, waypoints[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < waypoints.length; i++) {
        const pt = normalizedToScreen(waypoints[i].x, waypoints[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    // Waypoint circles (screen space)
    ctx.setLineDash([]);
    for (const wp of waypoints) {
      const pt = normalizedToScreen(wp.x, wp.y);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = PATH_COLOR;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Preview line to cursor (screen space)
    if (store.pathPreview) {
      const last = normalizedToScreen(waypoints[waypoints.length - 1].x, waypoints[waypoints.length - 1].y);
      const cursor = normalizedToScreen(store.pathPreview.x, store.pathPreview.y);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = SELECTED_COLOR;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(cursor.x, cursor.y);
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawPendingPolygon(): void {
    const vertices = store.pendingPolygonVertices;
    if (vertices.length < 1) return;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dashed lines between vertices (screen space)
    if (vertices.length >= 2) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = EXCLUSION_STROKE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const first = normalizedToScreen(vertices[0].x, vertices[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < vertices.length; i++) {
        const pt = normalizedToScreen(vertices[i].x, vertices[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    // Vertex circles (screen space)
    ctx.setLineDash([]);
    for (const v of vertices) {
      const pt = normalizedToScreen(v.x, v.y);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = EXCLUSION_STROKE;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Preview line to cursor (screen space)
    if (store.polygonPreview && vertices.length >= 1) {
      const last = normalizedToScreen(vertices[vertices.length - 1].x, vertices[vertices.length - 1].y);
      const cursor = normalizedToScreen(store.polygonPreview.x, store.polygonPreview.y);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = SELECTED_COLOR;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(cursor.x, cursor.y);
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawEndPoints(): void {
    const ctx = this.ctx;
    for (const ep of store.mapData!.endPoints) {
      const pt = normalizedToImage(ep.x, ep.y);
      const sel = this.isSelected(ep.id);
      const half = ENDPOINT_SIZE;

      // Filled square
      ctx.fillStyle = ENDPOINT_COLOR;
      ctx.fillRect(pt.x - half, pt.y - half, half * 2, half * 2);
      ctx.strokeStyle = sel ? SELECTED_COLOR : ENDPOINT_STROKE;
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.strokeRect(pt.x - half, pt.y - half, half * 2, half * 2);

      // X inside
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pt.x - half + 3, pt.y - half + 3);
      ctx.lineTo(pt.x + half - 3, pt.y + half - 3);
      ctx.moveTo(pt.x + half - 3, pt.y - half + 3);
      ctx.lineTo(pt.x - half + 3, pt.y + half - 3);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(ep.label, pt.x + half + 4, pt.y - half);
    }
  }

  private drawExclusionZones(): void {
    const ctx = this.ctx;
    for (const zone of store.mapData!.exclusionZones) {
      const sel = this.isSelected(zone.id);
      ctx.fillStyle = EXCLUSION_FILL;
      ctx.strokeStyle = sel ? SELECTED_COLOR : EXCLUSION_STROKE;
      ctx.lineWidth = sel ? 3 : 2;

      if (zone.type === 'polygon' && zone.vertices && zone.vertices.length >= 3) {
        ctx.beginPath();
        const first = normalizedToImage(zone.vertices[0].x, zone.vertices[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < zone.vertices.length; i++) {
          const v = normalizedToImage(zone.vertices[i].x, zone.vertices[i].y);
          ctx.lineTo(v.x, v.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (
        zone.type === 'circle' &&
        zone.centerX !== undefined &&
        zone.centerY !== undefined &&
        zone.radius !== undefined
      ) {
        const center = normalizedToImage(zone.centerX, zone.centerY);
        const img = store.imageElement!;
        const radiusPx = zone.radius * Math.max(img.naturalWidth, img.naturalHeight);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
