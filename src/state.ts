import type { MapMetadata, SpawnPoint, Path, Point, Intersection, ExclusionZone, EndPoint, ToolType, ZoomPanState } from './types';

type Listener = () => void;

const MAX_HISTORY = 50;

/**
 * Central observable state store for the application.
 * All map data, UI state, and viewport state live here.
 * Components subscribe via subscribe() and are notified on mutation.
 */
export class Store {
  private _listeners = new Set<Listener>();
  private _dirty = false;
  private _history: string[] = [];
  private _historyIndex = -1;

  mapData: MapMetadata | null = null;
  imageElement: HTMLImageElement | null = null;
  imageFilename = '';
  selectedTool: ToolType = 'select';
  selectedItemId: string | null = null;
  snapEnabled = false;
  /** Waypoints for the path currently being drawn */
  pendingPathWaypoints: Point[] = [];
  /** Vertices for the polygon exclusion zone currently being drawn */
  pendingPolygonVertices: Point[] = [];
  /** True while the user is placing waypoints for a new path */
  isDrawingPath = false;
  /** True while the user is placing vertices for a new polygon exclusion zone */
  isDrawingPolygon = false;
  /** Cursor position preview while drawing a path, in normalized coords */
  pathPreview: Point | null = null;
  /** Cursor position preview while drawing a polygon, in normalized coords */
  polygonPreview: Point | null = null;
  /** Set to true by loadImage to signal the UI should call zoomToFit */
  shouldZoomToFit = false;
  zoomPan: ZoomPanState = { offsetX: 0, offsetY: 0, scale: 1 };

  get canUndo(): boolean {
    return this._historyIndex > 0;
  }

  get canRedo(): boolean {
    return this._historyIndex < this._history.length - 1;
  }

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Returns and resets the dirty flag. Used by the render loop
   * to determine whether a redraw is needed.
   */
  isDirty(): boolean {
    const d = this._dirty;
    this._dirty = false;
    return d;
  }

  notify(): void {
    this._dirty = true;
    for (const listener of this._listeners) {
      listener();
    }
  }

  /**
   * Save a snapshot of the current mapData onto the undo stack.
   * Call this before mutations that should be undoable.
   */
  saveUndoSnapshot(): void {
    if (!this.mapData) return;
    const snapshot = JSON.stringify(this.mapData);
    const index = this._historyIndex + 1;
    // Truncate redo stack
    this._history = this._history.slice(0, index);
    this._history.push(snapshot);
    if (this._history.length > MAX_HISTORY) {
      this._history.shift();
    }
    this._historyIndex = this._history.length - 1;
  }

  /**
   * Undo the last action. Restores the previous mapData snapshot.
   */
  undo(): void {
    if (!this.canUndo || !this.mapData) return;
    this._historyIndex--;
    this.mapData = JSON.parse(this._history[this._historyIndex]) as MapMetadata;
    this.selectedItemId = null;
    this.pendingPathWaypoints = [];
    this.pendingPolygonVertices = [];
    this.isDrawingPath = false;
    this.isDrawingPolygon = false;
    this.pathPreview = null;
    this.polygonPreview = null;
    this.notify();
  }

  /**
   * Redo a previously undone action.
   */
  redo(): void {
    if (!this.canRedo || !this.mapData) return;
    this._historyIndex++;
    this.mapData = JSON.parse(this._history[this._historyIndex]) as MapMetadata;
    this.selectedItemId = null;
    this.pendingPathWaypoints = [];
    this.pendingPolygonVertices = [];
    this.isDrawingPath = false;
    this.isDrawingPolygon = false;
    this.pathPreview = null;
    this.polygonPreview = null;
    this.notify();
  }

  /**
   * Set the map image and create fresh metadata for it.
   */
  loadImage(image: HTMLImageElement, filename: string): void {
    this.imageElement = image;
    this.imageFilename = filename;
    this.mapData = {
      formatVersion: '1.0',
      name: filename.replace(/\.[^.]+$/, ''),
      imageFilename: filename,
      spawnPoints: [],
      paths: [],
      intersections: [],
      exclusionZones: [],
      endPoints: [],
    };
    this._history = [JSON.stringify(this.mapData)];
    this._historyIndex = 0;
    this.selectedItemId = null;
    this.shouldZoomToFit = true;
    this.notify();
  }

  setTool(tool: ToolType): void {
    this.selectedTool = tool;
    this.selectedItemId = null;
    this.notify();
  }

  selectItem(id: string | null): void {
    this.selectedItemId = id;
    this.notify();
  }

  setSnap(enabled: boolean): void {
    this.snapEnabled = enabled;
    this.notify();
  }

  updateZoomPan(partial: Partial<ZoomPanState>): void {
    this.zoomPan = { ...this.zoomPan, ...partial };
    this.notify();
  }

  addSpawnPoint(spawn: SpawnPoint): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      spawnPoints: [...this.mapData.spawnPoints, spawn],
    };
    this.notify();
  }

  updateSpawnPoint(id: string, partial: Partial<SpawnPoint>): void {
    if (!this.mapData) return;
    this.mapData = {
      ...this.mapData,
      spawnPoints: this.mapData.spawnPoints.map(s =>
        s.id === id ? { ...s, ...partial } : s
      ),
    };
    this.notify();
  }

  removeSpawnPoint(id: string): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      spawnPoints: this.mapData.spawnPoints.filter(s => s.id !== id),
    };
    if (this.selectedItemId === id) this.selectedItemId = null;
    this.notify();
  }

  addPath(path: Path): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      paths: [...this.mapData.paths, path],
    };
    this.notify();
  }

  updatePath(id: string, partial: Partial<Path>): void {
    if (!this.mapData) return;
    this.mapData = {
      ...this.mapData,
      paths: this.mapData.paths.map(p =>
        p.id === id ? { ...p, ...partial } : p
      ),
    };
    this.notify();
  }

  removePath(id: string): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      paths: this.mapData.paths.filter(p => p.id !== id),
      intersections: this.mapData.intersections.map(i => ({
        ...i,
        branches: i.branches.filter(b => b.pathId !== id),
      })),
      spawnPoints: this.mapData.spawnPoints.map(s =>
        s.targetPathId === id ? { ...s, targetPathId: '' } : s
      ),
    };
    if (this.selectedItemId === id) this.selectedItemId = null;
    this.notify();
  }

  addIntersection(intersection: Intersection): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      intersections: [...this.mapData.intersections, intersection],
    };
    this.notify();
  }

  updateIntersection(id: string, partial: Partial<Intersection>): void {
    if (!this.mapData) return;
    this.mapData = {
      ...this.mapData,
      intersections: this.mapData.intersections.map(i =>
        i.id === id ? { ...i, ...partial } : i
      ),
    };
    this.notify();
  }

  removeIntersection(id: string): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      intersections: this.mapData.intersections.filter(i => i.id !== id),
      paths: this.mapData.paths.map(p =>
        p.endAtIntersectionId === id ? { ...p, endAtIntersectionId: undefined } : p
      ),
    };
    if (this.selectedItemId === id) this.selectedItemId = null;
    this.notify();
  }

  addExclusionZone(zone: ExclusionZone): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      exclusionZones: [...this.mapData.exclusionZones, zone],
    };
    this.notify();
  }

  updateExclusionZone(id: string, partial: Partial<ExclusionZone>): void {
    if (!this.mapData) return;
    this.mapData = {
      ...this.mapData,
      exclusionZones: this.mapData.exclusionZones.map(z =>
        z.id === id ? { ...z, ...partial } : z
      ),
    };
    this.notify();
  }

  removeExclusionZone(id: string): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      exclusionZones: this.mapData.exclusionZones.filter(z => z.id !== id),
    };
    if (this.selectedItemId === id) this.selectedItemId = null;
    this.notify();
  }

  addEndPoint(endPoint: EndPoint): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      endPoints: [...this.mapData.endPoints, endPoint],
    };
    this.notify();
  }

  updateEndPoint(id: string, partial: Partial<EndPoint>): void {
    if (!this.mapData) return;
    this.mapData = {
      ...this.mapData,
      endPoints: this.mapData.endPoints.map(e =>
        e.id === id ? { ...e, ...partial } : e
      ),
    };
    this.notify();
  }

  removeEndPoint(id: string): void {
    if (!this.mapData) return;
    this.saveUndoSnapshot();
    this.mapData = {
      ...this.mapData,
      endPoints: this.mapData.endPoints.filter(e => e.id !== id),
      paths: this.mapData.paths.map(p =>
        p.endAtEndPointId === id ? { ...p, endAtEndPointId: undefined } : p
      ),
    };
    if (this.selectedItemId === id) this.selectedItemId = null;
    this.notify();
  }

  /**
   * Retrieve the currently selected item across all entity types.
   */
  getSelectedItem(): SpawnPoint | Path | Intersection | ExclusionZone | EndPoint | null {
    if (!this.selectedItemId || !this.mapData) return null;
    const id = this.selectedItemId;
    for (const spawn of this.mapData.spawnPoints) {
      if (spawn.id === id) return spawn;
    }
    for (const path of this.mapData.paths) {
      if (path.id === id) return path;
    }
    for (const intersection of this.mapData.intersections) {
      if (intersection.id === id) return intersection;
    }
    for (const zone of this.mapData.exclusionZones) {
      if (zone.id === id) return zone;
    }
    for (const endPoint of this.mapData.endPoints) {
      if (endPoint.id === id) return endPoint;
    }
    return null;
  }

  /**
   * Generate a unique identifier string.
   */
  generateId(): string {
    return crypto.randomUUID();
  }
}

export const store = new Store();
