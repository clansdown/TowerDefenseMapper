/** A point coordinate in normalized 0-1 space.
 *  (0,0) = top-left of the map image, (1,1) = bottom-right. */
export interface Point {
  x: number;
  y: number;
}

/** A spawn point where enemies enter the map. */
export interface SpawnPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  intervalMs: number;
  initialDelayMs: number;
  targetPathId: string;
}

/** A path defined by an ordered polyline of waypoints. */
export interface Path {
  id: string;
  label: string;
  waypoints: Point[];
  endAtIntersectionId?: string;
  endAtEndPointId?: string;
}

/** One outgoing branch at an intersection with a relative weight. */
export interface IntersectionBranch {
  pathId: string;
  weight: number;
}

/** A path intersection where mobs choose which outgoing path to follow. */
export interface Intersection {
  id: string;
  label: string;
  x: number;
  y: number;
  branches: IntersectionBranch[];
}

/** An exclusion zone where player towers cannot be placed. */
export interface ExclusionZone {
  id: string;
  label: string;
  type: 'polygon' | 'circle';
  vertices?: Point[];
  centerX?: number;
  centerY?: number;
  radius?: number;
}

/** A map exit point where mobs leave the map. */
export interface EndPoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

/** Complete map metadata for a tower defense map. */
export interface MapMetadata {
  formatVersion: string;
  name: string;
  imageFilename: string;
  spawnPoints: SpawnPoint[];
  paths: Path[];
  intersections: Intersection[];
  exclusionZones: ExclusionZone[];
  endPoints: EndPoint[];
}

/** Available editing tools. */
export type ToolType = 'select' | 'spawnPoint' | 'path' | 'intersection' | 'exclusionPolygon' | 'exclusionCircle' | 'endPoint';

/** Zoom and pan state for the canvas viewport. */
export interface ZoomPanState {
  offsetX: number;
  offsetY: number;
  scale: number;
}
