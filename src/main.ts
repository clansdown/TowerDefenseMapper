import './style.css';
import { store } from './state';
import { Renderer } from './canvas/renderer';
import { setupCanvasInteraction } from './canvas/interaction';
import { zoomToFit } from './canvas/zoomPan';
import { createToolbar } from './sidebar/toolbar';
import { createPropertyPanel } from './sidebar/propertyPanel';
import { createExportImport } from './sidebar/exportImport';

function main(): void {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('#app element not found');

  app.innerHTML = `
    <div id="sidebar">
      <div id="sidebar-section-toolbar"></div>
      <div id="sidebar-section-properties"></div>
      <div id="sidebar-section-export"></div>
    </div>
    <div id="canvas-container">
      <canvas id="map-canvas"></canvas>
    </div>
  `;

  const toolbarContainer = app.querySelector<HTMLElement>('#sidebar-section-toolbar')!;
  const propertiesContainer = app.querySelector<HTMLElement>('#sidebar-section-properties')!;
  const exportContainer = app.querySelector<HTMLElement>('#sidebar-section-export')!;
  const canvasContainer = app.querySelector<HTMLElement>('#canvas-container')!;
  const canvas = app.querySelector<HTMLCanvasElement>('#map-canvas')!;

  createToolbar(toolbarContainer);
  createPropertyPanel(propertiesContainer);
  createExportImport(exportContainer, canvasContainer);

  const renderer = new Renderer(canvas);
  const redraw = () => renderer.render();
  setupCanvasInteraction(canvas, redraw);

  function resizeCanvas(): void {
    const rect = canvasContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    redraw();
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  store.subscribe(() => {
    if (store.shouldZoomToFit) {
      store.shouldZoomToFit = false;
      requestAnimationFrame(() => zoomToFit(canvas));
    }
    redraw();
  });
}

main();
