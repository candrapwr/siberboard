export const view = { panX: 0, panY: 0, zoom: 1 };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

let viewportEl = null;
let areaEl = null;

function clamp(v, min, max) {
  return Math.max(min, Math.min(v, max));
}

export function initViewport() {
  viewportEl = document.getElementById('viewport');
  areaEl = document.getElementById('canvasArea');
  areaEl.addEventListener('wheel', onWheel, { passive: false });
  applyTransform();
}

export function applyTransform() {
  viewportEl.style.transform =
    `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;

  // dotted grid follows pan & zoom
  const gap = 24 * view.zoom;
  areaEl.style.backgroundSize = `${gap}px ${gap}px`;
  areaEl.style.backgroundPosition = `${view.panX}px ${view.panY}px`;

  const label = document.getElementById('zoomLabel');
  if (label) label.textContent = Math.round(view.zoom * 100) + '%';
}

export function screenToWorld(clientX, clientY) {
  const r = areaEl.getBoundingClientRect();
  return {
    x: (clientX - r.left - view.panX) / view.zoom,
    y: (clientY - r.top - view.panY) / view.zoom,
  };
}

function zoomAround(px, py, nextZoom) {
  const wx = (px - view.panX) / view.zoom;
  const wy = (py - view.panY) / view.zoom;
  view.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  view.panX = px - wx * view.zoom;
  view.panY = py - wy * view.zoom;
  applyTransform();
}

function onWheel(e) {
  // let UI chrome (panels, etc.) scroll natively instead of zooming the canvas
  if (e.target.closest('.ui-chrome')) return;

  e.preventDefault();
  const r = areaEl.getBoundingClientRect();
  const factor = 1 + (-e.deltaY * 0.0015);
  zoomAround(e.clientX - r.left, e.clientY - r.top, view.zoom * factor);
}

export function zoomBy(factor) {
  const r = areaEl.getBoundingClientRect();
  zoomAround(r.width / 2, r.height / 2, view.zoom * factor);
}

export function resetView() {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
  applyTransform();
}
