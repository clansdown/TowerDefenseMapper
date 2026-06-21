import { store } from '../state';
import type { ToolType } from '../types';

const TOOLS: { type: ToolType; label: string; icon: string }[] = [
  { type: 'select', label: 'Select', icon: '↖' },
  { type: 'spawnPoint', label: 'Spawn', icon: '⚑' },
  { type: 'path', label: 'Path', icon: '╱' },
  { type: 'intersection', label: 'Intersection', icon: '◈' },
  { type: 'endPoint', label: 'End', icon: '⊠' },
  { type: 'exclusionZone', label: 'Exclusion', icon: '▣' },
];

/**
 * Create and mount the toolbar into the sidebar.
 * Contains tool selection buttons, snap toggle, and zoom controls.
 */
export function createToolbar(container: HTMLElement): void {
  container.innerHTML = `
    <div class="p-3 border-bottom">
      <h6 class="text-uppercase text-muted mb-2" style="font-size: 0.75rem;">Tools</h6>
      <div class="toolbar-btn-group d-flex flex-wrap gap-1" id="tool-buttons"></div>
      <hr class="my-2">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <span class="small">Snap to Intersections</span>
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" id="snap-toggle" role="switch">
        </div>
      </div>
      <hr class="my-2">
      <div class="d-flex gap-1">
        <button class="btn btn-outline-secondary btn-sm flex-fill" id="btn-zoom-fit" title="Fit to viewport">Fit</button>
      </div>
      <div class="mt-2">
        <div class="btn-group btn-group-sm w-100" role="group">
          <button class="btn btn-outline-secondary" id="btn-exclusion-polygon">Polygon</button>
          <button class="btn btn-outline-secondary" id="btn-exclusion-circle">Circle</button>
        </div>
      </div>
      <hr class="my-2">
      <div class="d-flex gap-1">
        <button class="btn btn-outline-secondary btn-sm flex-fill" id="btn-undo" title="Undo (Ctrl+Z)" disabled>↩ Undo</button>
        <button class="btn btn-outline-secondary btn-sm flex-fill" id="btn-redo" title="Redo (Ctrl+Shift+Z)" disabled>↪ Redo</button>
      </div>
    </div>
  `;

  const toolButtonsContainer = container.querySelector<HTMLElement>('#tool-buttons')!;
  for (const tool of TOOLS) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-tool';
    btn.dataset.tool = tool.type;
    btn.title = tool.label;
    btn.innerHTML = `${tool.icon} <span class="small">${tool.label}</span>`;
    btn.addEventListener('click', () => store.setTool(tool.type));
    toolButtonsContainer.appendChild(btn);
  }

  const undoBtn = container.querySelector<HTMLButtonElement>('#btn-undo')!;
  const redoBtn = container.querySelector<HTMLButtonElement>('#btn-redo')!;
  undoBtn.addEventListener('click', () => store.undo());
  redoBtn.addEventListener('click', () => store.redo());

  const snapToggle = container.querySelector('#snap-toggle') as HTMLInputElement;
  snapToggle.addEventListener('change', () => store.setSnap(snapToggle.checked));

  container.querySelector('#btn-zoom-fit')!.addEventListener('click', () => {
    store.notify();
  });

  const polygonBtn = container.querySelector('#btn-exclusion-polygon')!;
  const circleBtn = container.querySelector('#btn-exclusion-circle')!;
  polygonBtn.addEventListener('click', () => { store.exclusionZoneMode = 'polygon'; updateExclusionMode(); });
  circleBtn.addEventListener('click', () => { store.exclusionZoneMode = 'circle'; updateExclusionMode(); });

  function updateExclusionMode(): void {
    polygonBtn.classList.toggle('active', store.exclusionZoneMode === 'polygon');
    circleBtn.classList.toggle('active', store.exclusionZoneMode === 'circle');
  }
  updateExclusionMode();

  // Re-apply active state when tool changes
  store.subscribe(() => {
    for (const btn of toolButtonsContainer.querySelectorAll('[data-tool]')) {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tool === store.selectedTool);
    }
    snapToggle.checked = store.snapEnabled;
    undoBtn.disabled = !store.canUndo;
    redoBtn.disabled = !store.canRedo;
  });
}
