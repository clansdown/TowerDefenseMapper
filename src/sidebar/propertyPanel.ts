import { store } from '../state';
import type { SpawnPoint, Path, Intersection, ExclusionZone, EndPoint, IntersectionBranch } from '../types';

/**
 * Create and mount the property panel into the sidebar.
 * Shows editable form fields for the currently selected item.
 */
export function createPropertyPanel(container: HTMLElement): void {
  container.innerHTML = `
    <div class="p-3">
      <h6 class="text-uppercase text-muted mb-2" style="font-size: 0.75rem;">Properties</h6>
      <div id="property-content">
        <p class="text-muted small mb-0">Select an item on the map to edit its properties.</p>
      </div>
    </div>
  `;

  store.subscribe(() => updatePanel(container));
}

function updatePanel(container: HTMLElement): void {
  const content = container.querySelector<HTMLElement>('#property-content')!;
  const item = store.getSelectedItem();
  if (!item) {
    content.innerHTML = '<p class="text-muted small mb-0">Select an item on the map to edit its properties.</p>';
    return;
  }
  if ('intervalMs' in item && 'targetPathId' in item) {
    renderSpawnPointForm(content, item as SpawnPoint);
  } else if ('waypoints' in item) {
    renderPathForm(content, item as Path);
  } else if ('branches' in item) {
    renderIntersectionForm(content, item as Intersection);
  } else if ('type' in item) {
    renderExclusionZoneForm(content, item as ExclusionZone);
  } else {
    renderEndPointForm(content, item as EndPoint);
  }
}

function renderSpawnPointForm(container: HTMLElement, spawn: SpawnPoint): void {
  container.innerHTML = `
    <div class="mb-2">
      <label class="form-label small">Label</label>
      <input class="form-control form-control-sm" id="prop-label" value="${escapeHtml(spawn.label)}">
    </div>
    <div class="mb-2">
      <label class="form-label small">Position</label>
      <div class="text-muted small">(${spawn.x.toFixed(4)}, ${spawn.y.toFixed(4)})</div>
    </div>
    <div class="row g-1 mb-2">
      <div class="col-6">
        <label class="form-label small">Interval (ms)</label>
        <input class="form-control form-control-sm" id="prop-interval" type="number" value="${spawn.intervalMs}" min="0">
      </div>
      <div class="col-6">
        <label class="form-label small">Initial Delay (ms)</label>
        <input class="form-control form-control-sm" id="prop-delay" type="number" value="${spawn.initialDelayMs}" min="0">
      </div>
    </div>
    <div class="mb-2">
      <label class="form-label small">Target Path</label>
      <select class="form-select form-select-sm" id="prop-target-path">
        <option value="">— None —</option>
        ${store.mapData?.paths.map(p =>
          `<option value="${p.id}" ${p.id === spawn.targetPathId ? 'selected' : ''}>${escapeHtml(p.label)}</option>`
        ).join('')}
      </select>
    </div>
    <button class="btn btn-outline-danger btn-sm w-100 mt-2" id="btn-delete">Delete</button>
  `;

  container.querySelector('#prop-label')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    store.updateSpawnPoint(spawn.id, { label: (e.target as HTMLInputElement).value });
  });
  container.querySelector('#prop-interval')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    store.updateSpawnPoint(spawn.id, { intervalMs: Number((e.target as HTMLInputElement).value) });
  });
  container.querySelector('#prop-delay')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    store.updateSpawnPoint(spawn.id, { initialDelayMs: Number((e.target as HTMLInputElement).value) });
  });
  container.querySelector('#prop-target-path')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    store.updateSpawnPoint(spawn.id, { targetPathId: (e.target as HTMLSelectElement).value });
  });
  container.querySelector('#btn-delete')!.addEventListener('click', () => {
    store.removeSpawnPoint(spawn.id);
  });
}

function renderPathForm(container: HTMLElement, path: Path): void {
  container.innerHTML = `
    <div class="mb-2">
      <label class="form-label small">Label</label>
      <input class="form-control form-control-sm" id="prop-label" value="${escapeHtml(path.label)}">
    </div>
    <div class="mb-2">
      <label class="form-label small">Waypoints</label>
      <div class="text-muted small">${path.waypoints.length} points</div>
    </div>
    <div class="mb-2">
      <label class="form-label small">Ends at Intersection</label>
      <select class="form-select form-select-sm" id="prop-end-intersection">
        <option value="">— None —</option>
        ${store.mapData?.intersections.map(i =>
          `<option value="${i.id}" ${i.id === path.endAtIntersectionId ? 'selected' : ''}>${escapeHtml(i.label)}</option>`
        ).join('')}
      </select>
    </div>
    <div class="mb-2">
      <label class="form-label small">Ends at Endpoint</label>
      <select class="form-select form-select-sm" id="prop-end-endpoint">
        <option value="">— None —</option>
        ${store.mapData?.endPoints.map(e =>
          `<option value="${e.id}" ${e.id === path.endAtEndPointId ? 'selected' : ''}>${escapeHtml(e.label)}</option>`
        ).join('')}
      </select>
    </div>
    <button class="btn btn-outline-danger btn-sm w-100 mt-2" id="btn-delete">Delete</button>
  `;

  container.querySelector('#prop-label')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    store.updatePath(path.id, { label: (e.target as HTMLInputElement).value });
  });
  container.querySelector('#prop-end-intersection')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    const value = (e.target as HTMLSelectElement).value;
    store.updatePath(path.id, { endAtIntersectionId: value || undefined, endAtEndPointId: undefined });
  });
  container.querySelector('#prop-end-endpoint')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    const value = (e.target as HTMLSelectElement).value;
    store.updatePath(path.id, { endAtEndPointId: value || undefined, endAtIntersectionId: undefined });
  });
  container.querySelector('#btn-delete')!.addEventListener('click', () => {
    store.removePath(path.id);
  });
}

function renderIntersectionForm(container: HTMLElement, intersection: Intersection): void {
  const availablePaths = (store.mapData?.paths ?? []).filter(
    p => !intersection.branches.some(b => b.pathId === p.id)
  );

  container.innerHTML = `
    <div class="mb-2">
      <label class="form-label small">Label</label>
      <input class="form-control form-control-sm" id="prop-label" value="${escapeHtml(intersection.label)}">
    </div>
    <div class="mb-2">
      <label class="form-label small">Position</label>
      <div class="text-muted small">(${intersection.x.toFixed(4)}, ${intersection.y.toFixed(4)})</div>
    </div>
    <div class="mb-2" id="branches-section">
      <label class="form-label small">Branches</label>
      <div id="branches-list">
        ${intersection.branches.length === 0
          ? '<div class="text-muted small">No branches configured.</div>'
          : intersection.branches.map((b, i) => renderBranch(b, i)).join('')
        }
      </div>
    </div>
    ${availablePaths.length > 0 ? `
      <div class="d-flex gap-1 mb-2">
        <select class="form-select form-select-sm flex-fill" id="branch-new-path">
          <option value="">Select path...</option>
          ${availablePaths.map(p => `<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('')}
        </select>
        <button class="btn btn-outline-primary btn-sm" id="btn-add-branch">+</button>
      </div>
    ` : ''}
    <button class="btn btn-outline-danger btn-sm w-100 mt-2" id="btn-delete">Delete</button>
  `;

  container.querySelector('#prop-label')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    store.updateIntersection(intersection.id, { label: (e.target as HTMLInputElement).value });
  });

  // Event delegation for branches
  const branchesList = container.querySelector<HTMLElement>('#branches-list')!;
  branchesList.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('branch-weight')) {
      const index = parseInt(target.dataset.index!, 10);
      const weight = parseInt((target as HTMLInputElement).value, 10) || 0;
      const branches = [...intersection.branches];
      branches[index] = { ...branches[index], weight };
      store.saveUndoSnapshot();
      store.updateIntersection(intersection.id, { branches });
    }
  });
  branchesList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('branch-remove')) {
      const index = parseInt(target.dataset.index!, 10);
      const branches = intersection.branches.filter((_, i) => i !== index);
      store.saveUndoSnapshot();
      store.updateIntersection(intersection.id, { branches });
    }
  });

  const addBtn = container.querySelector('#btn-add-branch');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const select = container.querySelector('#branch-new-path') as HTMLSelectElement;
      if (!select.value) return;
      store.saveUndoSnapshot();
      const branches = [...intersection.branches, { pathId: select.value, weight: 1 }];
      store.updateIntersection(intersection.id, { branches });
    });
  }

  container.querySelector('#btn-delete')!.addEventListener('click', () => {
    store.removeIntersection(intersection.id);
  });
}

function renderBranch(branch: IntersectionBranch, index: number): string {
  const path = store.mapData?.paths.find(p => p.id === branch.pathId);
  return `
    <div class="d-flex align-items-center gap-1 mb-1 branch-row">
      <span class="small flex-fill text-truncate">${escapeHtml(path?.label ?? branch.pathId)}</span>
      <input class="form-control form-control-sm branch-weight" type="number" value="${branch.weight}" min="0" style="width: 60px;" data-index="${index}">
      <button class="btn btn-outline-danger btn-sm branch-remove" data-index="${index}" title="Remove branch">&times;</button>
    </div>
  `;
}

function renderEndPointForm(container: HTMLElement, ep: EndPoint): void {
  container.innerHTML = `
    <div class="mb-2">
      <label class="form-label small">Label</label>
      <input class="form-control form-control-sm" id="prop-label" value="${escapeHtml(ep.label)}">
    </div>
    <div class="mb-2">
      <label class="form-label small">Position</label>
      <div class="text-muted small">(${ep.x.toFixed(4)}, ${ep.y.toFixed(4)})</div>
    </div>
    <button class="btn btn-outline-danger btn-sm w-100 mt-2" id="btn-delete">Delete</button>
  `;

  container.querySelector('#prop-label')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    store.updateEndPoint(ep.id, { label: (e.target as HTMLInputElement).value });
  });
  container.querySelector('#btn-delete')!.addEventListener('click', () => {
    store.removeEndPoint(ep.id);
  });
}

function renderExclusionZoneForm(container: HTMLElement, zone: ExclusionZone): void {
  let extraFields = '';
  if (zone.type === 'polygon') {
    extraFields = `
      <div class="mb-2">
        <label class="form-label small">Vertices</label>
        <div class="text-muted small">${zone.vertices?.length ?? 0} points</div>
      </div>
    `;
  } else {
    extraFields = `
      <div class="mb-2">
        <label class="form-label small">Radius</label>
        <div class="text-muted small">${zone.radius?.toFixed(4) ?? '—'}</div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="mb-2">
      <label class="form-label small">Label</label>
      <input class="form-control form-control-sm" id="prop-label" value="${escapeHtml(zone.label)}">
    </div>
    ${extraFields}
    <button class="btn btn-outline-danger btn-sm w-100 mt-2" id="btn-delete">Delete</button>
  `;

  container.querySelector('#prop-label')!.addEventListener('change', (e) => {
    store.saveUndoSnapshot();
    store.updateExclusionZone(zone.id, { label: (e.target as HTMLInputElement).value });
  });
  container.querySelector('#btn-delete')!.addEventListener('click', () => {
    store.removeExclusionZone(zone.id);
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
