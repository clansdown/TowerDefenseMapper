import { store } from './state';
import type { MapMetadata } from './types';

/**
 * Open the system file picker to select a map image.
 * Uses the File System Access API if available, falling back to an
 * <input type="file"> element for broader browser compatibility.
 */
export function openImageFile(): void {
  if ('showOpenFilePicker' in window) {
    openImageWithPicker();
  } else {
    openImageWithInput();
  }
}

async function openImageWithPicker(): Promise<void> {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'Images',
          accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'] },
        },
      ],
      excludeAcceptAllOption: false,
    });
    const file = await handle.getFile();
    loadImageFile(file);
  } catch {
    // User cancelled the picker
  }
}

function openImageWithInput(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) loadImageFile(file);
  };
  input.click();
}

function loadImageFile(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      store.loadImage(img, file.name);
    };
    img.src = reader.result as string; // safe: readAsDataURL always produces a string
  };
  reader.readAsDataURL(file);
}

/**
 * Serialize the current map metadata to JSON and save to disk.
 */
export function exportJson(): void {
  if (!store.mapData) return;
  const json = JSON.stringify(store.mapData, null, 2);
  if ('showSaveFilePicker' in window) {
    saveWithPicker(json);
  } else {
    downloadFile(json, `${store.mapData.name}.json`, 'application/json');
  }
}

async function saveWithPicker(json: string): Promise<void> {
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: `${store.mapData?.name ?? 'map'}.json`,
      types: [
        {
          description: 'JSON',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
  } catch {
    // User cancelled
  }
}

/**
 * Open a file picker to load map metadata from a JSON file.
 */
export function importJson(): void {
  if ('showOpenFilePicker' in window) {
    importWithPicker();
  } else {
    importWithInput();
  }
}

async function importWithPicker(): Promise<void> {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'JSON',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
    const file = await handle.getFile();
    const text = await file.text();
    loadJsonData(text);
  } catch {
    // User cancelled
  }
}

function importWithInput(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string; // safe: readAsText always produces a string
        loadJsonData(text);
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function loadJsonData(json: string): void {
  try {
    const data = JSON.parse(json) as MapMetadata;
    if (!data.formatVersion) {
      alert('Invalid map metadata file: missing formatVersion.');
      return;
    }
    store.mapData = data;
    store.selectedItemId = null;
    store.notify();
  } catch (error) {
    console.error('Failed to parse JSON file:', error);
    alert('Failed to parse JSON file. See console for details.');
  }
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Handle a dropped image file on the canvas container.
 */
export function handleDrop(event: DragEvent): void {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (file && file.type.startsWith('image/')) {
    loadImageFile(file);
  }
}
