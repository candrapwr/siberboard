import { moveNode, addEdge, getNode, resizeNode, getEdge, removeEdge, updateEdge } from './state.js';
import { MIN_NODE_WIDTH, MIN_NODE_HEIGHT } from './constants.js';
import { renderEdges, buildEdgePath, portXY } from './bezier.js';
import { view, applyTransform, screenToWorld } from './viewport.js';

let mode = null;            // 'node' | 'resize' | 'connect' | 'reconnect' | 'pan' | 'select'
let dragId = null;
let selectedFrom = null;
let reconnectEdge = null;
let dragNodeIds = [];
let startNodePositions = new Map();
let selectionStartWorld = null;
let selectionRectDirty = false;
const selectedNodeIds = new Set();
let canvasTool = 'pan';

let startClientX = 0;
let startClientY = 0;
let startNodeX = 0;
let startNodeY = 0;
let startNodeWidth = 0;
let startNodeHeight = 0;
let startPanX = 0;
let startPanY = 0;

function notifyWorkflowChanged() {
  document.dispatchEvent(new CustomEvent('workflow:changed'));
}

function notifySelectionChanged() {
  document.dispatchEvent(new CustomEvent('selection:changed', {
    detail: { ids: [...selectedNodeIds] },
  }));
}

function notifyToolChanged() {
  document.dispatchEvent(new CustomEvent('canvas:tool-changed', {
    detail: { tool: canvasTool },
  }));
}

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

function ensureSelectionMarquee() {
  let el = document.getElementById('selectionMarquee');
  if (!el) {
    el = document.createElement('div');
    el.id = 'selectionMarquee';
    el.className = 'selection-marquee hidden';
    document.getElementById('canvasArea')?.appendChild(el);
  }
  return el;
}

function updateSelectionUi() {
  document.querySelectorAll('.node[data-node-id]').forEach(el => {
    const id = Number(el.dataset.nodeId);
    el.classList.toggle('selected', selectedNodeIds.has(id));
  });
}

function setSelection(ids) {
  const nextIds = new Set(ids);
  const unchanged = nextIds.size === selectedNodeIds.size
    && [...nextIds].every(id => selectedNodeIds.has(id));
  if (unchanged) return;
  selectedNodeIds.clear();
  for (const id of nextIds) selectedNodeIds.add(id);
  updateSelectionUi();
  notifySelectionChanged();
}

export function clearSelection() {
  if (!selectedNodeIds.size) return;
  selectedNodeIds.clear();
  updateSelectionUi();
  notifySelectionChanged();
}

export function removeFromSelection(id) {
  if (!selectedNodeIds.has(id)) return;
  selectedNodeIds.delete(id);
  updateSelectionUi();
  notifySelectionChanged();
}

export function applySelectionClass(el, id) {
  if (!el) return;
  el.classList.toggle('selected', selectedNodeIds.has(id));
}

export function setCanvasTool(nextTool) {
  canvasTool = nextTool === 'select' ? 'select' : 'pan';
  hideSelectionMarquee();
  notifyToolChanged();
}

export function getCanvasTool() {
  return canvasTool;
}

function updateSelectionMarquee(clientX, clientY) {
  const marquee = ensureSelectionMarquee();
  const areaRect = document.getElementById('canvasArea')?.getBoundingClientRect();
  if (!selectionStartWorld || !areaRect) return;
  const left = Math.min(startClientX, clientX) - areaRect.left;
  const top = Math.min(startClientY, clientY) - areaRect.top;
  const width = Math.abs(clientX - startClientX);
  const height = Math.abs(clientY - startClientY);
  marquee.style.left = `${left}px`;
  marquee.style.top = `${top}px`;
  marquee.style.width = `${width}px`;
  marquee.style.height = `${height}px`;
  marquee.classList.remove('hidden');
  selectionRectDirty = selectionRectDirty || width > 3 || height > 3;
}

function hideSelectionMarquee() {
  const marquee = document.getElementById('selectionMarquee');
  if (marquee) marquee.classList.add('hidden');
}

function selectNodesInRect(worldA, worldB, additive = false) {
  const minX = Math.min(worldA.x, worldB.x);
  const minY = Math.min(worldA.y, worldB.y);
  const maxX = Math.max(worldA.x, worldB.x);
  const maxY = Math.max(worldA.y, worldB.y);
  const ids = [];
  document.querySelectorAll('.node[data-node-id]').forEach(el => {
    const id = Number(el.dataset.nodeId);
    const node = getNode(id);
    if (!node) return;
    const overlaps = node.x < maxX && node.x + node.width > minX
      && node.y < maxY && node.y + node.height > minY;
    if (overlaps) ids.push(id);
  });
  if (additive) setSelection([...selectedNodeIds, ...ids]);
  else setSelection(ids);
}

function onMouseDown(e) {
  if (e.button !== 0 && e.button !== 1) return;
  // let toolbar buttons (e.g. delete) handle their own clicks
  if (e.target.closest('.node-toolbar')) return;
  // ignore UI chrome (side panels, controls) so they don't trigger pan
  if (e.target.closest('.ui-chrome')) return;

  const edgeEndpoint = e.target.closest('.edge-endpoint');
  if (edgeEndpoint) {
    const group = edgeEndpoint.closest('.edge-group');
    const from = Number(group.dataset.from);
    const to = Number(group.dataset.to);
    const edge = getEdge(from, to);
    if (!edge) return;
    mode = 'reconnect';
    reconnectEdge = {
      from,
      to,
      label: edge.label,
      fromSide: edge.fromSide ?? 'right',
      toSide: edge.toSide ?? 'left',
      endpoint: edgeEndpoint.dataset.endpoint,
    };
    return;
  }

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
      notifyWorkflowChanged();
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
    if (!selectedNodeIds.has(id)) setSelection([id]);
    mode = 'node';
    dragId = id;
    dragNodeIds = selectedNodeIds.has(id) ? [...selectedNodeIds] : [id];
    if (!dragNodeIds.length) dragNodeIds = [id];
    startNodePositions = new Map(
      dragNodeIds.map(nodeId => {
        const target = getNode(nodeId);
        return [nodeId, { x: target?.x ?? 0, y: target?.y ?? 0 }];
      })
    );
    startClientX = e.clientX;
    startClientY = e.clientY;
    startNodeX = node.x;
    startNodeY = node.y;
    dragNodeIds.forEach(nodeId => {
      getNodeEl(nodeId)?.style.setProperty('cursor', 'grabbing');
    });
    return;
  }

  // empty canvas => pan by default, marquee selection only in select tool
  if (canvasTool !== 'select' || e.button === 1) {
    mode = 'pan';
    startClientX = e.clientX;
    startClientY = e.clientY;
    startPanX = view.panX;
    startPanY = view.panY;
    document.body.style.cursor = 'grabbing';
    return;
  }

  mode = 'select';
  startClientX = e.clientX;
  startClientY = e.clientY;
  selectionStartWorld = screenToWorld(e.clientX, e.clientY);
  selectionRectDirty = false;
  clearSelection();
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

  if (mode === 'reconnect') {
    const fromNode = getNode(reconnectEdge.from);
    const toNode = getNode(reconnectEdge.to);
    if (!fromNode || !toNode) return;

    const movingFrom = reconnectEdge.endpoint === 'from';
    const fixedNode = movingFrom ? toNode : fromNode;
    const fixedSide = movingFrom ? reconnectEdge.toSide : reconnectEdge.fromSide;
    const fixedPoint = portXY(fixedNode, fixedSide);
    const movingPoint = screenToWorld(e.clientX, e.clientY);
    const movingSide = movingFrom ? reconnectEdge.fromSide : reconnectEdge.toSide;

    const d = movingFrom
      ? buildEdgePath(movingPoint.x, movingPoint.y, fixedPoint.x, fixedPoint.y, movingSide, fixedSide)
      : buildEdgePath(fixedPoint.x, fixedPoint.y, movingPoint.x, movingPoint.y, fixedSide, movingSide);

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
    const dx = (e.clientX - startClientX) / view.zoom;
    const dy = (e.clientY - startClientY) / view.zoom;
    dragNodeIds.forEach(nodeId => {
      const start = startNodePositions.get(nodeId);
      if (!start) return;
      const nx = start.x + dx;
      const ny = start.y + dy;
      moveNode(nodeId, nx, ny);
      const el = getNodeEl(nodeId);
      if (el) { el.style.left = nx + 'px'; el.style.top = ny + 'px'; }
    });
    renderEdges();
    notifyWorkflowChanged();
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
    notifyWorkflowChanged();
    return;
  }

  if (mode === 'pan') {
    view.panX = startPanX + (e.clientX - startClientX);
    view.panY = startPanY + (e.clientY - startClientY);
    applyTransform();
    return;
  }

  if (mode === 'select') {
    updateSelectionMarquee(e.clientX, e.clientY);
  }
}

function onMouseUp(e) {
  if (mode === 'connect') {
    const port = e.target.closest('.node-port');
    if (port && selectedFrom !== null) {
      const toId = Number(port.closest('[data-node-id]').dataset.nodeId);
      const toSide = port.dataset.side || 'left';
      addEdge(selectedFrom.id, toId, selectedFrom.side, toSide);
      notifyWorkflowChanged();
    }
    const temp = document.querySelector('.temp-edge');
    if (temp) temp.remove();
    renderEdges();
    selectedFrom = null;
  }

  if (mode === 'reconnect') {
    const port = e.target.closest('.node-port');
    if (port && reconnectEdge) {
      const targetId = Number(port.closest('[data-node-id]').dataset.nodeId);
      const targetSide = port.dataset.side || 'left';
      const movingFrom = reconnectEdge.endpoint === 'from';

      const nextFrom = movingFrom ? targetId : reconnectEdge.from;
      const nextTo = movingFrom ? reconnectEdge.to : targetId;
      const nextFromSide = movingFrom ? targetSide : reconnectEdge.fromSide;
      const nextToSide = movingFrom ? reconnectEdge.toSide : targetSide;

      removeEdge(reconnectEdge.from, reconnectEdge.to);
      const nextEdge = addEdge(nextFrom, nextTo, nextFromSide, nextToSide);
      if (nextEdge) {
        updateEdge(nextFrom, nextTo, { label: reconnectEdge.label });
      } else {
        const restored = addEdge(reconnectEdge.from, reconnectEdge.to, reconnectEdge.fromSide, reconnectEdge.toSide);
        if (restored) updateEdge(reconnectEdge.from, reconnectEdge.to, { label: reconnectEdge.label });
      }
      notifyWorkflowChanged();
    }
    const temp = document.querySelector('.temp-edge');
    if (temp) temp.remove();
    renderEdges();
    reconnectEdge = null;
  }

  if (mode === 'node') {
    dragNodeIds.forEach(nodeId => {
      const el = getNodeEl(nodeId);
      if (el) el.style.cursor = 'grab';
    });
  }

  if (mode === 'select') {
    const endWorld = screenToWorld(e.clientX, e.clientY);
    if (selectionStartWorld && selectionRectDirty) {
      selectNodesInRect(selectionStartWorld, endWorld, false);
    }
    hideSelectionMarquee();
    selectionStartWorld = null;
    selectionRectDirty = false;
  }

  document.body.style.cursor = '';
  mode = null;
  dragId = null;
  dragNodeIds = [];
  startNodePositions = new Map();
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
