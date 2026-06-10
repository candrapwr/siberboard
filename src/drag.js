import { moveNode, addEdge, getNode, resizeNode } from './state.js';
import { MIN_NODE_WIDTH, MIN_NODE_HEIGHT } from './constants.js';
import { renderEdges, buildEdgePath, portXY } from './bezier.js';
import { view, applyTransform, screenToWorld } from './viewport.js';

let mode = null;            // 'node' | 'resize' | 'connect' | 'pan'
let dragId = null;
let selectedFrom = null;

let startClientX = 0;
let startClientY = 0;
let startNodeX = 0;
let startNodeY = 0;
let startNodeWidth = 0;
let startNodeHeight = 0;
let startPanX = 0;
let startPanY = 0;

export function initDrag(area) {
  area.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  area.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });
}

function getNodeEl(id) {
  return document.querySelector(`.node[data-node-id="${id}"]`);
}

function onMouseDown(e) {
  // let toolbar buttons (e.g. delete) handle their own clicks
  if (e.target.closest('.node-toolbar')) return;
  // ignore UI chrome (side panels, controls) so they don't trigger pan
  if (e.target.closest('.ui-chrome')) return;
  // let edges handle their own click-to-delete (don't start panning)
  if (e.target.closest('.edge-group')) return;

  const resizeHandle = e.target.closest('.node-resize-handle');
  if (resizeHandle) {
    const nodeEl = resizeHandle.closest('.node[data-node-id]');
    const id = Number(nodeEl.dataset.nodeId);
    const node = getNode(id);
    mode = 'resize';
    dragId = id;
    startClientX = e.clientX;
    startClientY = e.clientY;
    startNodeWidth = node.width;
    startNodeHeight = node.height;
    document.body.style.cursor = 'nwse-resize';
    return;
  }

  const port = e.target.closest('.node-port');
  if (port) {
    const id = Number(port.closest('[data-node-id]').dataset.nodeId);
    const side = port.dataset.side || 'right';
    if (selectedFrom === null) {
      selectedFrom = { id, side };
      mode = 'connect';
      return;
    }
    if (selectedFrom !== null) {
      addEdge(selectedFrom.id, id, selectedFrom.side, side);
      renderEdges();
      selectedFrom = null;
      mode = null;
      return;
    }
    return;
  }

  const nodeEl = e.target.closest('.node[data-node-id]');
  if (nodeEl) {
    const id = Number(nodeEl.dataset.nodeId);
    const node = getNode(id);
    mode = 'node';
    dragId = id;
    startClientX = e.clientX;
    startClientY = e.clientY;
    startNodeX = node.x;
    startNodeY = node.y;
    nodeEl.style.cursor = 'grabbing';
    return;
  }

  // empty canvas => pan
  mode = 'pan';
  startClientX = e.clientX;
  startClientY = e.clientY;
  startPanX = view.panX;
  startPanY = view.panY;
  document.body.style.cursor = 'grabbing';
}

function onMouseMove(e) {
  if (mode === 'connect') {
    const fromNode = getNode(selectedFrom.id);
    if (!fromNode) return;
    const start = portXY(fromNode, selectedFrom.side);
    const end = screenToWorld(e.clientX, e.clientY);
    const d = buildEdgePath(start.x, start.y, end.x, end.y, selectedFrom.side, selectedFrom.side);

    const svg = document.getElementById('edgeLayer');
    let temp = svg.querySelector('.temp-edge');
    if (temp) {
      temp.setAttribute('d', d);
    } else {
      temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      temp.setAttribute('d', d);
      temp.setAttribute('fill', 'none');
      temp.setAttribute('stroke', '#fbbf24');
      temp.setAttribute('stroke-width', '2');
      temp.setAttribute('stroke-dasharray', '6,4');
      temp.classList.add('temp-edge');
      svg.appendChild(temp);
    }
    return;
  }

  if (mode === 'node') {
    const nx = startNodeX + (e.clientX - startClientX) / view.zoom;
    const ny = startNodeY + (e.clientY - startClientY) / view.zoom;
    moveNode(dragId, nx, ny);
    const el = getNodeEl(dragId);
    if (el) { el.style.left = nx + 'px'; el.style.top = ny + 'px'; }
    renderEdges();
    return;
  }

  if (mode === 'resize') {
    const width = Math.max(MIN_NODE_WIDTH, startNodeWidth + (e.clientX - startClientX) / view.zoom);
    const height = Math.max(MIN_NODE_HEIGHT, startNodeHeight + (e.clientY - startClientY) / view.zoom);
    resizeNode(dragId, width, height);
    const el = getNodeEl(dragId);
    if (el) {
      el.style.width = width + 'px';
      el.style.height = height + 'px';
    }
    renderEdges();
    return;
  }

  if (mode === 'pan') {
    view.panX = startPanX + (e.clientX - startClientX);
    view.panY = startPanY + (e.clientY - startClientY);
    applyTransform();
  }
}

function onMouseUp(e) {
  if (mode === 'connect') {
    const port = e.target.closest('.node-port');
    if (port && selectedFrom !== null) {
      const toId = Number(port.closest('[data-node-id]').dataset.nodeId);
      const toSide = port.dataset.side || 'left';
      addEdge(selectedFrom.id, toId, selectedFrom.side, toSide);
    }
    const temp = document.querySelector('.temp-edge');
    if (temp) temp.remove();
    renderEdges();
    selectedFrom = null;
  }

  if (mode === 'node') {
    const el = getNodeEl(dragId);
    if (el) el.style.cursor = 'grab';
  }

  document.body.style.cursor = '';
  mode = null;
  dragId = null;
}

function toMouse(type, touch) {
  return new MouseEvent(type, { clientX: touch.clientX, clientY: touch.clientY, bubbles: true });
}

function onTouchStart(e) {
  const t = e.touches[0];
  const target = document.elementFromPoint(t.clientX, t.clientY) || e.target;
  target.dispatchEvent(toMouse('mousedown', t));
}

function onTouchMove(e) {
  e.preventDefault();
  onMouseMove(toMouse('mousemove', e.touches[0]));
}

function onTouchEnd(e) {
  const t = e.changedTouches[0];
  const target = document.elementFromPoint(t.clientX, t.clientY) || e.target;
  target.dispatchEvent(toMouse('mouseup', t));
}
