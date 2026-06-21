# TowerDefenseMapper — Agent Guide

## Project Overview

A Vite + TypeScript single-page application that lets users graphically annotate a tower defense map image with gameplay metadata: spawn points, paths, path intersections (with weighted branching), and exclusion zones. Data is exported/imported as JSON.

## Tech Stack

- **Build**: Vite 8, TypeScript 6
- **CSS**: Bootstrap 5 (dark mode via `data-bs-theme="dark"`)
- **Rendering**: HTML Canvas 2D
- **Framework**: None — vanilla TypeScript with DOM manipulation
- **File Access**: File System Access API (`showOpenFilePicker`/`showSaveFilePicker`) with `<input>` fallback

## Project Structure

```
src/
├── main.ts                     # App entry: bootstrap UI, wire modules, start render loop
├── types.ts                    # All shared interfaces and type definitions
├── state.ts                    # Central observable state store (singleton)
├── geometry.ts                 # Pure math utilities (distance, hit-testing, etc.)
├── fileAccess.ts               # Image/JSON file I/O via File System Access API + fallbacks
├── canvas/
│   ├── renderer.ts             # Canvas rendering loop — draws image + all overlays
│   ├── interaction.ts          # Mouse/touch event handling, tool dispatch
│   └── zoomPan.ts              # Zoom/pan transform management, zoom-to-fit
├── editors/
│   ├── spawnPointEditor.ts     # Spawn point placement/move logic
│   ├── pathEditor.ts           # Polyline path drawing/editing
│   ├── intersectionEditor.ts   # Intersection placement + branch management
│   └── exclusionZoneEditor.ts  # Polygon/circle exclusion zone drawing
└── sidebar/
    ├── toolbar.ts              # Tool selection buttons, snap toggle, zoom controls
    ├── propertyPanel.ts        # Dynamic property editor for selected item
    └── exportImport.ts         # Load image, export/import JSON buttons
```

## Architecture & Data Flow

1. **State** is centralized in a singleton `Store` (`state.ts`).
2. **UI components** read from the store and subscribe to changes via `store.subscribe()`.
3. **Canvas interaction** captures mouse events → determines active tool → calls store mutation methods.
4. **Store mutations** are immutable (spread/rest patterns) — they create new objects, never mutate in place.
5. **Render loop** checks a dirty flag on each animation frame and redraws the canvas when needed.
6. **Sidebar** re-renders its content whenever the store notifies (selection change, data change).

```
User input → interaction.ts → store.update*(...) → notify listeners → renderer.render() + sidebar.update()
```

## Coding Standards

### Maintainability

- **Self-documenting code**: Choose descriptive names over abbreviations (`spawnPointEditor` not `spEd`, `targetPathId` not `tgtP`). Common abbreviations (`id`, `x`, `y`, `ctx`) are acceptable.
- **JSDoc on every export**: Every exported function, interface, and type must have a JSDoc comment explaining *what* it does and *why* it exists, not just *how*.
- **Single responsibility**: Functions should do one thing. If a function exceeds ~40 lines, refactor into smaller helpers.
- **No dead code**: Never leave commented-out code, `console.log`, or unused imports. Delete them.
- **No magic values**: All thresholds, colors, sizes, and other literals must be named constants at the top of the file or in a constants section.
- **Immutable state**: State mutations use spread/rest (`{ ...obj, ...partial }`). Direct mutation is only allowed inside the `Store` class methods.
- **Explicit error handling**: No empty `catch` blocks. Every `try/catch` must log a meaningful message or handle the error visibly. Silent failures are forbidden.
- **Dependency discipline**: Minimize external dependencies. Bootstrap CSS is the only runtime dependency. No utility libraries (lodash, etc.) without justification.

### TypeScript Strictness

- **No `any`**: Use `unknown` with type guards instead of `any`. Casts (`as`) are forbidden unless unavoidable (e.g., `as CanvasRenderingContext2D` after `getContext`). Every `as` must have a comment explaining why it's safe.
- **No `null`**: Use `undefined` for absent or optional values. `null` is only used for DOM APIs that require it.
- **Strict mode**: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`. These are enforced by `tsconfig.json`.
- **Type exports**: All interfaces and types are in `types.ts`. Module-specific types can stay in their module if not shared.
- **Type guards**: Use custom type guards (`isFoo(x): x is Foo`) for narrowing union types.

### Naming Conventions

- **Files**: `camelCase.ts` — lowercase start, no hyphens (e.g., `fileAccess.ts`, `zoomPan.ts`)
- **Classes**: `PascalCase` (e.g., `class Store`, `class Renderer`)
- **Functions**: `camelCase` (e.g., `openImageFile()`, `zoomToFit()`)
- **Interfaces**: `PascalCase` (e.g., `interface SpawnPoint`)
- **Types**: `PascalCase` with `Type` suffix for disambiguation (e.g., `type ToolType`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `SPAWN_COLOR = '#00ff88'`, `SNAP_THRESHOLD_PX = 15`)
- **Private members**: Prefix with `_` (e.g., `private _listeners`, `private _dirty`)

### Canvas Rendering Conventions

- **Render function is pure**: It reads from `store`, draws to canvas, returns nothing.
- **Coordinate pipeline**: All metadata stored as normalized 0–1 floats. The renderer converts to image pixels via `normalizedToImage()`, then to screen pixels via `imageToScreen()` using the zoom/pan transform.
- **Hit testing**: Always done in screen-pixel space (after applying zoom/pan) for consistent click targets regardless of zoom level.

### Git Conventions

- Commits are explicit (user-initiated). Never commit without being asked.
- Commit messages are concise and match repo style (present tense imperative).
- No force-push, no empty commits.

## Coordinate System

All spatial data in the metadata uses **normalized 0–1 coordinates** where:

- `(0, 0)` = top-left of the map image
- `(1, 1)` = bottom-right of the map image
- `(0.5, 0.5)` = center of the map image

This makes metadata resolution-independent. Games consuming the data multiply by their own image dimensions.

## Tools

The application has six editing modes:

| Tool | Icon | Behavior |
|------|------|----------|
| **Select** | `↖` | Click to select items, drag to move them, click empty space to deselect |
| **Spawn** | `⚑` | Click to place a spawn point, drag existing one to move |
| **Path** | `╱` | Click to add waypoints (polyline). Click on a spawn point or intersection to auto-start with first waypoint linked. Click on an endpoint while drawing to finish and link there. Double-click or press Enter to finish. |
| **Intersection** | `◈` | Click to place an intersection node, then configure branches in properties panel |
| **End** | `⊠` | Click to place a map exit point (endpoint), drag existing one to move |
| **Exclusion** | `▣` | Toggle polygon/circle mode; click vertices for polygon or click-drag for circle radius |

Snap: Press `Shift` or toggle the snap button to snap new waypoints to nearby intersection centers.

## State Store API Reference

```typescript
// Subscriptions
store.subscribe(listener: () => void): () => void  // returns unsubscribe function
store.isDirty(): boolean  // returns and resets dirty flag (for render loop)

// Mutations
store.loadImage(image: HTMLImageElement, filename: string): void
store.setTool(tool: ToolType): void
store.selectItem(id: string | null): void
store.setSnap(enabled: boolean): void
store.updateZoomPan(partial: Partial<ZoomPanState>): void

store.addSpawnPoint(spawn: SpawnPoint): void
store.updateSpawnPoint(id: string, partial: Partial<SpawnPoint>): void
store.removeSpawnPoint(id: string): void

store.addPath(path: Path): void
store.updatePath(id: string, partial: Partial<Path>): void
store.removePath(id: string): void

store.addIntersection(intersection: Intersection): void
store.updateIntersection(id: string, partial: Partial<Intersection>): void
store.removeIntersection(id: string): void

store.addExclusionZone(zone: ExclusionZone): void
store.updateExclusionZone(id: string, partial: Partial<ExclusionZone>): void
store.removeExclusionZone(id: string): void

store.addEndPoint(endPoint: EndPoint): void
store.updateEndPoint(id: string, partial: Partial<EndPoint>): void
store.removeEndPoint(id: string): void

// Queries
store.getSelectedItem(): SpawnPoint | Path | Intersection | ExclusionZone | EndPoint | null
store.generateId(): string
```
