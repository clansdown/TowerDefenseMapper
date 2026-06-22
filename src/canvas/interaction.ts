import { store } from '../state';
import { distance, distanceToSegment } from '../geometry';
import { normalizedToScreen, screenToNormalized } from './coords';
import { handleWheel, zoomToFit } from './zoomPan';
import type { Point } from '../types';

/* ---- Constants ---- */

const HIT_THRESHOLD_PX = 12;
const SNAP_THRESHOLD_PX = 15;
const MIN_WAYPOINTS_FOR_PATH = 2;

/* ---- Hit targets ---- */

type HitTarget =
  | { type: 'spawnPoint'; id: string }
  | { type: 'pathWaypoint'; id: string; index: number }
  | { type: 'pathSegment'; pathId: string }
  | { type: 'intersection'; id: string }
  | { type: 'polygonVertex'; id: string; index: number }
  | { type: 'polygonSegment'; id: string }
  | { type: 'circleCenter'; id: string }
  | { type: 'circleEdge'; id: string }
  | { type: 'endPoint'; id: string }
  | null;

type DragMode =
  | { kind: 'none' }
  | { kind: 'pan'; startMouse: Point; startPan: Point }
  | { kind: 'moveSpawn'; id: string }
  | { kind: 'moveWaypoint'; id: string; index: number }
  | { kind: 'moveIntersection'; id: string }
  | { kind: 'moveVertex'; id: string; index: number }
  | { kind: 'moveCircleCenter'; id: string }
  | { kind: 'resizeCircle'; id: string }
  | { kind: 'placeCircle'; id: string; center: Point }
  | { kind: 'moveEndPoint'; id: string };

/* ---- Module-level state ---- */

let drag: DragMode = { kind: 'none' };
let _redraw: (() => void) | null = null;

/* ---- Public API ---- */

/**
 * Set up mouse event handlers on the canvas element.
 * Must be called once after the canvas is created.
 * @param redraw Optional callback to force a canvas redraw (used for mousemove preview).
 */
export function setupCanvasInteraction(canvas: HTMLCanvasElement, redraw?: () => void): void {
  _redraw = redraw ?? null;
  canvas.addEventListener('mousedown', (e) => onMouseDown(e, canvas));
  canvas.addEventListener('mousemove', (e) => onMouseMove(e, canvas));
  canvas.addEventListener('mouseup', () => onMouseUp(canvas));
  canvas.addEventListener('wheel', (e) => handleWheel(e, canvas));
  canvas.addEventListener('dblclick', (e) => onDoubleClick(e, canvas));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      store.setSnap(true);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      store.undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      store.redo();
    }
    if (e.key === 'Enter' && store.isDrawingPath) {
      finishPath();
    }
    if (e.key === 'Escape') {
      cancelDrawing();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      store.setSnap(false);
    }
  });
}

/* ---- Hit testing ---- */

function hitTest(mx: number, my: number): HitTarget {
  if (!store.mapData || !store.imageElement) return null;

  for (const spawn of store.mapData.spawnPoints) {
    const sp = normalizedToScreen(spawn.x, spawn.y);
    if (distance({ x: mx, y: my }, sp) < HIT_THRESHOLD_PX) {
      return { type: 'spawnPoint', id: spawn.id };
    }
  }

  for (const intersection of store.mapData.intersections) {
    const ip = normalizedToScreen(intersection.x, intersection.y);
    if (distance({ x: mx, y: my }, ip) < HIT_THRESHOLD_PX) {
      return { type: 'intersection', id: intersection.id };
    }
  }

  for (const path of store.mapData.paths) {
    for (let i = 0; i < path.waypoints.length; i++) {
      const wp = normalizedToScreen(path.waypoints[i].x, path.waypoints[i].y);
      if (distance({ x: mx, y: my }, wp) < HIT_THRESHOLD_PX) {
        return { type: 'pathWaypoint', id: path.id, index: i };
      }
    }
    for (let i = 0; i < path.waypoints.length - 1; i++) {
      const a = normalizedToScreen(path.waypoints[i].x, path.waypoints[i].y);
      const b = normalizedToScreen(path.waypoints[i + 1].x, path.waypoints[i + 1].y);
      const d = distanceToSegment({ x: mx, y: my }, a, b);
      if (d < HIT_THRESHOLD_PX) {
        return { type: 'pathSegment', pathId: path.id };
      }
    }
  }

  for (const zone of store.mapData.exclusionZones) {
    if (zone.type === 'polygon' && zone.vertices) {
      for (let i = 0; i < zone.vertices.length; i++) {
        const vp = normalizedToScreen(zone.vertices[i].x, zone.vertices[i].y);
        if (distance({ x: mx, y: my }, vp) < HIT_THRESHOLD_PX) {
          return { type: 'polygonVertex', id: zone.id, index: i };
        }
      }
    }
    if (zone.type === 'circle' && zone.centerX !== undefined && zone.centerY !== undefined) {
      const cp = normalizedToScreen(zone.centerX, zone.centerY);
      if (distance({ x: mx, y: my }, cp) < HIT_THRESHOLD_PX) {
        return { type: 'circleCenter', id: zone.id };
      }
      if (zone.radius !== undefined) {
        const img = store.imageElement;
        const radiusPx = zone.radius * Math.max(img.naturalWidth, img.naturalHeight);
        const cpScr = normalizedToScreen(zone.centerX, zone.centerY);
        if (distance({ x: mx, y: my }, cpScr) < radiusPx * store.zoomPan.scale + HIT_THRESHOLD_PX &&
            Math.abs(distance({ x: mx, y: my }, cpScr) - radiusPx * store.zoomPan.scale) < HIT_THRESHOLD_PX) {
          return { type: 'circleEdge', id: zone.id };
        }
      }
    }
  }

  for (const ep of store.mapData.endPoints) {
    const epScreen = normalizedToScreen(ep.x, ep.y);
    if (distance({ x: mx, y: my }, epScreen) < HIT_THRESHOLD_PX) {
      return { type: 'endPoint', id: ep.id };
    }
  }

  return null;
}

/* ---- Snap ---- */

function applySnap(nx: number, ny: number): Point {
  if (!store.snapEnabled || !store.mapData) return { x: nx, y: ny };
  const screenPt = normalizedToScreen(nx, ny);
  for (const intersection of store.mapData.intersections) {
    const ip = normalizedToScreen(intersection.x, intersection.y);
    if (distance(screenPt, ip) < SNAP_THRESHOLD_PX) {
      return { x: intersection.x, y: intersection.y };
    }
  }
  return { x: nx, y: ny };
}

/* ---- Mouse handlers ---- */

function onMouseDown(event: MouseEvent, _canvas: HTMLCanvasElement): void {
  if (event.button !== 0) return; // Left click only
  const mx = event.offsetX;
  const my = event.offsetY;
  const hit = hitTest(mx, my);

  if (hit) {
    // Path tool special behaviors
    if (store.selectedTool === 'path') {
      if (hit.type === 'spawnPoint' && !store.isDrawingPath) {
        startPathFromSpawn(hit.id);
        return;
      }
      if (hit.type === 'intersection' && !store.isDrawingPath) {
        startPathFromIntersection(hit.id);
        return;
      }
      if (hit.type === 'endPoint' && store.isDrawingPath) {
        finishPathAtEndPoint(hit.id);
        return;
      }
    }

    // Normal hit handling for all tools
    if (hit.type !== 'pathSegment') {
      store.selectItem('id' in hit ? (hit as any).id : (hit as any).pathId);
    }
    switch (hit.type) {
      case 'spawnPoint':
        drag = { kind: 'moveSpawn', id: hit.id };
        break;
      case 'endPoint':
        drag = { kind: 'moveEndPoint', id: hit.id };
        break;
      case 'pathWaypoint':
        if (store.selectedTool === 'path') {
          insertWaypointAfter(hit.id, hit.index, mx, my);
        } else {
          drag = { kind: 'moveWaypoint', id: hit.id, index: hit.index };
        }
        break;
      case 'intersection':
        drag = { kind: 'moveIntersection', id: hit.id };
        break;
      case 'polygonVertex':
        drag = { kind: 'moveVertex', id: hit.id, index: hit.index };
        break;
      case 'circleCenter':
        drag = { kind: 'moveCircleCenter', id: hit.id };
        break;
      case 'circleEdge':
        drag = { kind: 'resizeCircle', id: hit.id };
        break;
      case 'pathSegment':
        insertWaypointOnSegment(hit.pathId, mx, my);
        break;
    }
    return;
  }

  // Click on empty space → handle based on active tool
  switch (store.selectedTool) {
    case 'spawnPoint':
      placeSpawnPoint(mx, my);
      break;
    case 'path':
      addWaypoint(mx, my);
      break;
    case 'intersection':
      placeIntersection(mx, my);
      break;
    case 'endPoint':
      placeEndPoint(mx, my);
      break;
    case 'exclusionZone':
      if (store.exclusionZoneMode === 'polygon') {
        if (store.isDrawingPolygon && store.pendingPolygonVertices.length >= 3) {
          const first = normalizedToScreen(
            store.pendingPolygonVertices[0].x,
            store.pendingPolygonVertices[0].y
          );
          if (distance({ x: mx, y: my }, first) < HIT_THRESHOLD_PX) {
            finishPolygon();
            break;
          }
        }
        addPolygonVertex(mx, my);
      } else {
        placeCircle(mx, my);
      }
      break;
    default:
      store.selectItem(null);
      drag = { kind: 'pan', startMouse: { x: mx, y: my }, startPan: { x: store.zoomPan.offsetX, y: store.zoomPan.offsetY } };
      break;
  }
}

function onMouseMove(event: MouseEvent, canvas: HTMLCanvasElement): void {
  const mx = event.offsetX;
  const my = event.offsetY;

  if (drag.kind === 'pan') {
    const dx = mx - drag.startMouse.x;
    const dy = my - drag.startMouse.y;
    store.updateZoomPan({
      offsetX: drag.startPan.x + dx,
      offsetY: drag.startPan.y + dy,
    });
    return;
  }

  { const d = drag; if (d.kind === 'moveSpawn') {
    const n = applySnap(...screenToNormalizedCoords(mx, my));
    store.updateSpawnPoint(d.id, { x: n.x, y: n.y });
    return;
  } }

  { const d = drag; if (d.kind === 'moveWaypoint') {
    const n = applySnap(...screenToNormalizedCoords(mx, my));
    const path = store.mapData?.paths.find(p => p.id === d.id);
    if (!path) return;
    const waypoints = [...path.waypoints];
    waypoints[d.index] = n;
    store.updatePath(d.id, { waypoints });
    return;
  } }

  { const d = drag; if (d.kind === 'moveIntersection') {
    const n = screenToNormalized(mx, my);
    store.updateIntersection(d.id, { x: n.x, y: n.y });
    return;
  } }

  { const d = drag; if (d.kind === 'moveVertex') {
    const n = screenToNormalized(mx, my);
    const zone = store.mapData?.exclusionZones.find(z => z.id === d.id);
    if (!zone || !zone.vertices) return;
    const vertices = [...zone.vertices];
    vertices[d.index] = n;
    store.updateExclusionZone(d.id, { vertices });
    return;
  } }

  { const d = drag; if (d.kind === 'moveCircleCenter') {
    const n = screenToNormalized(mx, my);
    store.updateExclusionZone(d.id, { centerX: n.x, centerY: n.y });
    return;
  } }

  { const d = drag; if (d.kind === 'resizeCircle') {
    const zone = store.mapData?.exclusionZones.find(z => z.id === d.id);
    if (!zone || zone.centerX === undefined || zone.centerY === undefined) return;
    const center = normalizedToScreen(zone.centerX, zone.centerY);
    const dist = distance({ x: mx, y: my }, center) / store.zoomPan.scale;
    const img = store.imageElement!;
    const radius = dist / Math.max(img.naturalWidth, img.naturalHeight);
    store.updateExclusionZone(d.id, { radius: Math.max(0.001, radius) });
    return;
  } }

  { const d = drag; if (d.kind === 'moveEndPoint') {
    const n = screenToNormalized(mx, my);
    store.updateEndPoint(d.id, { x: n.x, y: n.y });
    return;
  } }

  { const d = drag; if (d.kind === 'placeCircle') {
    const dist = distance({ x: mx, y: my }, normalizedToScreen(d.center.x, d.center.y)) / store.zoomPan.scale;
    const img = store.imageElement!;
    const radius = dist / Math.max(img.naturalWidth, img.naturalHeight);
    store.updateExclusionZone(d.id, { radius: Math.max(0.001, radius) });
    return;
  } }

  // Update drawing previews
  if (store.isDrawingPath && store.pendingPathWaypoints.length > 0) {
    const n = screenToNormalized(mx, my);
    store.pathPreview = applySnap(n.x, n.y);
    _redraw?.();
  } else if (store.pathPreview !== null) {
    store.pathPreview = null;
    _redraw?.();
  }
  if (store.isDrawingPolygon && store.pendingPolygonVertices.length > 0) {
    const n = screenToNormalized(mx, my);
    store.polygonPreview = n;
    _redraw?.();
  } else if (store.polygonPreview !== null) {
    store.polygonPreview = null;
    _redraw?.();
  }

  // Show cursor feedback for hover
  canvas.style.cursor = hitTest(mx, my) ? 'pointer' : 'default';
}

function onMouseUp(_canvas: HTMLCanvasElement): void {
  const hadDrag = drag.kind !== 'none';
  if (drag.kind === 'placeCircle') {
    const { id } = drag;
    const zone = store.mapData?.exclusionZones.find(z => z.id === id);
    if (!zone || zone.radius === undefined || zone.radius <= 0.001) {
      store.removeExclusionZone(id);
    }
  }
  if (hadDrag) {
    // Only snapshot if the drag modified something (not a click-to-place that's already snapshot)
    if (drag.kind !== 'placeCircle') {
      store.saveUndoSnapshot();
    }
  }
  drag = { kind: 'none' };
}

function onDoubleClick(_event: MouseEvent, canvas: HTMLCanvasElement): void {
  if (store.isDrawingPath) {
    finishPath();
    return;
  }
  if (store.isDrawingPolygon) {
    finishPolygon();
    return;
  }
  zoomToFit(canvas);
}

/* ---- Tool actions ---- */

function screenToNormalizedCoords(mx: number, my: number): [number, number] {
  const n = screenToNormalized(mx, my);
  return [n.x, n.y];
}

function placeSpawnPoint(mx: number, my: number): void {
  if (!store.mapData) return;
  const n = screenToNormalized(mx, my);
  store.addSpawnPoint({
    id: store.generateId(),
    label: `Spawn ${store.mapData.spawnPoints.length + 1}`,
    x: n.x,
    y: n.y,
    intervalMs: 1000,
    initialDelayMs: 0,
    targetPathId: '',
  });
}

function addWaypoint(mx: number, my: number): void {
  if (!store.imageElement) return;
  const n = applySnap(...screenToNormalizedCoords(mx, my));
  store.pendingPathWaypoints.push(n);
  store.isDrawingPath = true;
  store.notify();
}

function finishPath(): void {
  if (!store.mapData || store.pendingPathWaypoints.length < MIN_WAYPOINTS_FOR_PATH) return;
  store.addPath({
    id: store.generateId(),
    label: `Path ${store.mapData.paths.length + 1}`,
    waypoints: [...store.pendingPathWaypoints],
  });
  store.pendingPathWaypoints = [];
  store.isDrawingPath = false;
  store.pathPreview = null;
  store.notify();
}

function insertWaypointAfter(pathId: string, index: number, mx: number, my: number): void {
  const path = store.mapData?.paths.find(p => p.id === pathId);
  if (!path) return;
  store.saveUndoSnapshot();
  const n = applySnap(...screenToNormalizedCoords(mx, my));
  const waypoints = [...path.waypoints];
  waypoints.splice(index + 1, 0, n);
  store.updatePath(pathId, { waypoints });
}

function insertWaypointOnSegment(pathId: string, mx: number, my: number): void {
  const path = store.mapData?.paths.find(p => p.id === pathId);
  if (!path || path.waypoints.length < 2) return;
  store.saveUndoSnapshot();
  let minDist = Infinity;
  let insertIndex = -1;
  for (let i = 0; i < path.waypoints.length - 1; i++) {
    const a = normalizedToScreen(path.waypoints[i].x, path.waypoints[i].y);
    const b = normalizedToScreen(path.waypoints[i + 1].x, path.waypoints[i + 1].y);
    const d = distanceToSegment({ x: mx, y: my }, a, b);
    if (d < minDist) {
      minDist = d;
      insertIndex = i + 1;
    }
  }
  if (insertIndex === -1) return;
  const n = applySnap(...screenToNormalizedCoords(mx, my));
  const waypoints = [...path.waypoints];
  waypoints.splice(insertIndex, 0, n);
  store.updatePath(pathId, { waypoints });
}

function placeIntersection(mx: number, my: number): void {
  if (!store.mapData) return;
  const n = screenToNormalized(mx, my);
  let snapped = { x: n.x, y: n.y };

  if (store.snapEnabled) {
    let minDist = SNAP_THRESHOLD_PX;
    for (const path of store.mapData.paths) {
      for (const wp of path.waypoints) {
        const sp = normalizedToScreen(wp.x, wp.y);
        const d = distance({ x: mx, y: my }, sp);
        if (d < minDist) {
          minDist = d;
          snapped = { x: wp.x, y: wp.y };
        }
      }
      for (let i = 0; i < path.waypoints.length - 1; i++) {
        const a = normalizedToScreen(path.waypoints[i].x, path.waypoints[i].y);
        const b = normalizedToScreen(path.waypoints[i + 1].x, path.waypoints[i + 1].y);
        const d = distanceToSegment({ x: mx, y: my }, a, b);
        if (d < minDist) {
          const na = path.waypoints[i];
          const nb = path.waypoints[i + 1];
          const abx = b.x - a.x;
          const aby = b.y - a.y;
          const len2 = abx * abx + aby * aby;
          if (len2 > 0) {
            let t = ((mx - a.x) * abx + (my - a.y) * aby) / len2;
            t = Math.max(0, Math.min(1, t));
            snapped = {
              x: na.x + (nb.x - na.x) * t,
              y: na.y + (nb.y - na.y) * t,
            };
          }
        }
      }
    }
  }

  store.addIntersection({
    id: store.generateId(),
    label: `Intersection ${store.mapData.intersections.length + 1}`,
    x: snapped.x,
    y: snapped.y,
    branches: [],
  });
}

function startPathFromSpawn(spawnId: string): void {
  if (!store.mapData) return;
  const spawn = store.mapData.spawnPoints.find(s => s.id === spawnId);
  if (!spawn) return;
  const pathId = store.generateId();
  store.saveUndoSnapshot();
  store.addPath({
    id: pathId,
    label: `Path ${store.mapData.paths.length + 1}`,
    waypoints: [{ x: spawn.x, y: spawn.y }],
  });
  store.updateSpawnPoint(spawnId, { targetPathId: pathId });
  store.pendingPathWaypoints = [{ x: spawn.x, y: spawn.y }];
  store.isDrawingPath = true;
}

function startPathFromIntersection(intersectionId: string): void {
  if (!store.mapData) return;
  const intersection = store.mapData.intersections.find(i => i.id === intersectionId);
  if (!intersection) return;
  const pathId = store.generateId();
  store.saveUndoSnapshot();
  store.addPath({
    id: pathId,
    label: `Path ${store.mapData.paths.length + 1}`,
    waypoints: [{ x: intersection.x, y: intersection.y }],
  });
  store.updateIntersection(intersectionId, {
    branches: [...intersection.branches, { pathId, weight: 1 }],
  });
  store.pendingPathWaypoints = [{ x: intersection.x, y: intersection.y }];
  store.isDrawingPath = true;
}

function finishPathAtEndPoint(endPointId: string): void {
  if (!store.mapData || store.pendingPathWaypoints.length < MIN_WAYPOINTS_FOR_PATH) return;
  const ep = store.mapData.endPoints.find(e => e.id === endPointId);
  if (!ep) return;
  store.pendingPathWaypoints.push({ x: ep.x, y: ep.y });
  const pathId = store.generateId();
  store.addPath({
    id: pathId,
    label: `Path ${store.mapData.paths.length + 1}`,
    waypoints: [...store.pendingPathWaypoints],
    endAtEndPointId: endPointId,
  });
  store.pendingPathWaypoints = [];
  store.isDrawingPath = false;
}

function placeEndPoint(mx: number, my: number): void {
  if (!store.mapData) return;
  const n = screenToNormalized(mx, my);
  store.addEndPoint({
    id: store.generateId(),
    label: `End ${store.mapData.endPoints.length + 1}`,
    x: n.x,
    y: n.y,
  });
}

function addPolygonVertex(mx: number, my: number): void {
  const n = screenToNormalized(mx, my);
  store.pendingPolygonVertices.push(n);
  store.isDrawingPolygon = true;
  store.notify();
}

function finishPolygon(): void {
  if (!store.mapData || store.pendingPolygonVertices.length < 3) return;
  store.polygonPreview = null;
  store.addExclusionZone({
    id: store.generateId(),
    label: `Zone ${store.mapData.exclusionZones.length + 1}`,
    type: 'polygon',
    vertices: [...store.pendingPolygonVertices],
  });
  store.pendingPolygonVertices = [];
  store.isDrawingPolygon = false;
}

function placeCircle(mx: number, my: number): void {
  if (!store.mapData) return;
  const n = screenToNormalized(mx, my);
  const id = store.generateId();
  store.addExclusionZone({
    id,
    label: `Zone ${store.mapData.exclusionZones.length + 1}`,
    type: 'circle',
    centerX: n.x,
    centerY: n.y,
    radius: 0.01,
  });
  drag = { kind: 'placeCircle', id, center: n };
}

function cancelDrawing(): void {
  const hadDrawing = store.isDrawingPath || store.isDrawingPolygon;
  if (store.isDrawingPath) {
    store.pendingPathWaypoints = [];
    store.isDrawingPath = false;
  }
  if (store.isDrawingPolygon) {
    store.pendingPolygonVertices = [];
    store.isDrawingPolygon = false;
  }
  store.pathPreview = null;
  store.polygonPreview = null;
  if (hadDrawing) store.notify();
}
