import { Modal } from 'bootstrap';
import { store } from '../state';

let modalEl: HTMLElement | null = null;

/**
 * Open the outliner modal, showing a tree of all map entities.
 * Clicking any item selects it and closes the modal.
 */
export function openOutliner(): void {
  if (!modalEl) {
    modalEl = createModal();
    document.body.appendChild(modalEl);
  }
  updateModalContent();
  Modal.getOrCreateInstance(modalEl).show();
}

function createModal(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'modal fade';
  div.tabIndex = -1;
  div.innerHTML = `
    <div class="modal-dialog modal-dialog-scrollable modal-sm">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Outliner</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="outliner-body"></div>
      </div>
    </div>
  `;
  return div;
}

function updateModalContent(): void {
  const body = modalEl!.querySelector<HTMLElement>('#outliner-body')!;
  if (!store.mapData) {
    body.innerHTML = '<p class="text-muted small mb-0">No map data loaded.</p>';
    return;
  }

  const sections: {
    label: string;
    icon: string;
    items: { id: string; label: string }[];
  }[] = [
    {
      label: 'Spawn Points',
      icon: '⚑',
      items: store.mapData.spawnPoints.map(s => ({ id: s.id, label: s.label })),
    },
    {
      label: 'Paths',
      icon: '╱',
      items: store.mapData.paths.map(p => ({ id: p.id, label: p.label })),
    },
    {
      label: 'Intersections',
      icon: '◈',
      items: store.mapData.intersections.map(i => ({ id: i.id, label: i.label })),
    },
    {
      label: 'Exclusion Zones',
      icon: '▣',
      items: store.mapData.exclusionZones.map(z => ({
        id: z.id,
        label: `${z.label} (${z.type === 'polygon' ? 'Polygon' : 'Circle'})`,
      })),
    },
    {
      label: 'End Points',
      icon: '⊠',
      items: store.mapData.endPoints.map(e => ({ id: e.id, label: e.label })),
    },
  ];

  body.innerHTML = sections.map(section => `
    <div class="outliner-section mb-1">
      <div class="outliner-section-header d-flex align-items-center gap-1 user-select-none" role="button">
        <span class="outliner-arrow">▼</span>
        <span class="fw-bold small">${section.label} (${section.items.length})</span>
      </div>
      <div class="outliner-items ps-3">
        ${section.items.length === 0
          ? '<div class="text-muted small">— None —</div>'
          : section.items.map(item =>
              `<div class="outliner-item small d-flex align-items-center gap-1 py-1 px-1" data-id="${item.id}" role="button">
                <span>${section.icon}</span>
                <span>${escapeHtml(item.label)}</span>
              </div>`
            ).join('')
        }
      </div>
    </div>
  `).join('');

  // Highlight selected item
  const selectedId = store.selectedItemId;
  body.querySelectorAll<HTMLElement>('.outliner-item').forEach(el => {
    if (el.dataset.id === selectedId) {
      el.classList.add('selected');
    }
  });

  // Click item → select and close
  body.querySelectorAll<HTMLElement>('.outliner-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id!;
      store.selectItem(id);
      Modal.getInstance(modalEl!)?.hide();
    });
  });

  // Toggle section collapse on header click
  body.querySelectorAll<HTMLElement>('.outliner-section-header').forEach(el => {
    el.addEventListener('click', () => {
      const items = el.parentElement!.querySelector<HTMLElement>('.outliner-items')!;
      const arrow = el.querySelector<HTMLElement>('.outliner-arrow')!;
      const collapsed = items.style.display === 'none';
      items.style.display = collapsed ? '' : 'none';
      arrow.textContent = collapsed ? '▼' : '▶';
    });
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
