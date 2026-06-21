import { openImageFile, exportJson, importJson, handleDrop } from '../fileAccess';
import { store } from '../state';

/**
 * Create and mount the export/import section into the sidebar.
 * Provides buttons for loading images, exporting JSON, and importing JSON.
 * Also sets up drag-and-drop on the canvas container.
 */
export function createExportImport(container: HTMLElement, canvasContainer: HTMLElement): void {
  container.innerHTML = `
    <div class="p-3 border-top">
      <button class="btn btn-outline-light btn-sm w-100 mb-2" id="btn-open-image">
        📂 Open Image
      </button>
      <button class="btn btn-outline-light btn-sm w-100 mb-2" id="btn-export-json">
        💾 Export JSON
      </button>
      <button class="btn btn-outline-light btn-sm w-100" id="btn-import-json">
        📄 Import JSON
      </button>
      <div class="mt-2">
        <p class="text-muted small mb-0" id="image-info">No image loaded</p>
      </div>
    </div>
  `;

  container.querySelector('#btn-open-image')!.addEventListener('click', openImageFile);
  container.querySelector('#btn-export-json')!.addEventListener('click', exportJson);
  container.querySelector('#btn-import-json')!.addEventListener('click', importJson);

  // Drag-and-drop on the canvas container
  canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
  canvasContainer.addEventListener('drop', handleDrop);

  store.subscribe(() => {
    const info = container.querySelector('#image-info')!;
    if (store.imageFilename) {
      info.textContent = `Image: ${store.imageFilename}`;
    } else {
      info.textContent = 'No image loaded';
    }
  });
}
