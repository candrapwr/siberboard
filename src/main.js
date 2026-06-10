import { addNode, addEdge, removeNode, removeEdge, updateNode, updateEdge, getNode, getEdge, getState, replaceState } from './state.js';
import { renderEdges, outputXY, inputXY, buildEdgePath, edgeLabelPoint, portXY } from './bezier.js';
import { initDrag } from './drag.js';
import { initViewport, applyTransform, screenToWorld, zoomBy, resetView, view } from './viewport.js';
import { NODE_TYPES, NODE_CATEGORIES, CATEGORY_COLOR, ICON_CHOICES, NODE_WIDTH, NODE_HEIGHT } from './constants.js';

const viewport = document.getElementById('viewport');
const canvasArea = document.getElementById('canvasArea');
let activeEdgeMenu = null;
let currentFileName = null;
let aiBusy = false;
let aiLoadingEl = null;
let aiAuthState = { authenticated: false, username: null, configured: true };
let aiImageContext = null;
const LOCAL_STORAGE_KEY = 'siberboard.localWorkflow.v1';

const AI_DEFAULT_MODELS = {
  deepseek: 'deepseek-chat',
  grok: 'grok-3-mini',
};

// Flowchart shape outlines drawn in a 0..100 box and stretched to the node size
// (preserveAspectRatio="none"); strokes stay even via vector-effect in CSS.
const SHAPE_SVG = {
  terminator:    '<rect x="3" y="6" width="94" height="88" rx="46" ry="46" class="node-shape-path"/>',
  diamond:       '<polygon points="50,4 96,50 50,96 4,50" class="node-shape-path"/>',
  parallelogram: '<polygon points="24,6 96,6 76,94 4,94" class="node-shape-path"/>',
  hexagon:       '<polygon points="22,6 78,6 96,50 78,94 22,94 4,50" class="node-shape-path"/>',
  manualOp:      '<polygon points="6,8 94,8 80,92 20,92" class="node-shape-path"/>',
  manualInput:   '<polygon points="4,30 96,8 96,92 4,92" class="node-shape-path"/>',
  offpage:       '<polygon points="4,6 96,6 96,62 50,96 4,62" class="node-shape-path"/>',
  circle:        '<ellipse cx="50" cy="50" rx="46" ry="46" class="node-shape-path"/>',
  document:      '<path d="M4,6 L96,6 L96,82 C78,98 66,70 50,82 C34,94 20,74 4,84 Z" class="node-shape-path"/>',
  delay:         '<path d="M4,8 L58,8 A42,42 0 0 1 58,92 L4,92 Z" class="node-shape-path"/>',
  display:       '<path d="M22,8 L82,8 C95,8 95,92 82,92 L22,92 C10,80 10,20 22,8 Z" class="node-shape-path"/>',
  cylinder:      '<path d="M4,16 C4,8 96,8 96,16 L96,84 C96,92 4,92 4,84 Z" class="node-shape-path"/><path d="M4,16 C4,24 96,24 96,16" class="node-shape-line"/>',
  subroutine:    '<rect x="3" y="6" width="94" height="88" rx="6" class="node-shape-path"/><line x1="14" y1="6" x2="14" y2="94" class="node-shape-line"/><line x1="86" y1="6" x2="86" y2="94" class="node-shape-line"/>',
};

// fallback glyph for the plain-rectangle flowchart node (Process) in the picker
const PICKER_RECT = '<rect x="5" y="22" width="90" height="56" rx="10" class="node-shape-path"/>';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createNodeElement(node) {
  const info = NODE_TYPES[node.type] || NODE_TYPES.set;
  const color = CATEGORY_COLOR[info.cat] || '#6b7280';
  const shape = info.shape && SHAPE_SVG[info.shape] ? info.shape : null;
  const noIcon = info.cat === 'flowchart';

  const div = document.createElement('div');
  div.className = shape
    ? 'node node-shaped group absolute z-20 flex items-stretch select-none cursor-grab transition-colors'
    : 'node group absolute z-20 flex items-stretch bg-[#2b2b2b] border border-[#3a3a3a] rounded-xl shadow-xl select-none cursor-grab hover:border-[#4a90d9] transition-colors';
  div.style.left = node.x + 'px';
  div.style.top = node.y + 'px';
  div.style.width = node.width + 'px';
  div.style.height = node.height + 'px';
  div.dataset.nodeId = node.id;
  if (shape) div.dataset.shape = shape;

  const label = node.label ?? info.label;
  const icon = node.icon ?? info.icon;
  const sub = node.sub ?? info.sub;

  const shapeLayer = shape
    ? `<svg class="node-shape" viewBox="0 0 100 100" preserveAspectRatio="none">${SHAPE_SVG[shape]}</svg>`
    : '';

  // Flowchart nodes carry their meaning through the shape, so they drop the emoji
  // icon and center the label; everything else keeps the icon + left-aligned text.
  let bodyClass, iconHtml, textClass, subClass;
  if (noIcon) {
    bodyClass = `${shape ? 'node-body ' : ''}flex items-center justify-center text-center w-full h-full px-4 py-3 pointer-events-none`;
    iconHtml = '';
    textClass = 'min-w-0';
    subClass = 'node-sub mt-0.5 text-[11px] leading-4 text-gray-400 line-clamp-2';
  } else if (shape) {
    bodyClass = 'node-body flex items-center gap-2.5 w-full h-full px-4 py-3 pointer-events-none';
    iconHtml = `<div class="icon-box node-icon" style="background:${color}22;">${icon}</div>`;
    textClass = 'min-w-0 flex-1';
    subClass = 'node-sub mt-0.5 text-[11px] leading-4 text-gray-400 line-clamp-2';
  } else {
    bodyClass = 'node-body flex items-start gap-3 w-full h-full px-3 py-3 pr-5 pointer-events-none';
    iconHtml = `<div class="icon-box node-icon mt-0.5" style="background:${color}22;">${icon}</div>`;
    textClass = 'min-w-0 flex-1 self-center';
    subClass = 'node-sub mt-1 text-[11px] leading-4 text-gray-400 line-clamp-2';
  }

  div.innerHTML = `
    <span class="node-port" data-side="left"></span>
    <span class="node-port" data-side="right"></span>
    <span class="node-port" data-side="top"></span>
    <span class="node-port" data-side="bottom"></span>
    ${shapeLayer}
    <div class="${bodyClass}">
      ${iconHtml}
      <div class="${textClass}">
        <div class="node-title text-sm font-medium text-gray-100 line-clamp-2">${label}</div>
        <div class="${subClass}">${sub}</div>
      </div>
    </div>
    <div class="node-toolbar">
      <button class="edit-node" title="Edit node">✎</button>
      <button class="del-node" title="Delete node">🗑</button>
    </div>
    <div class="node-resize-handle" title="Resize node"></div>
  `;
  return div;
}

function nodeEl(id) {
  return document.querySelector(`.node[data-node-id="${id}"]`);
}

function refreshNode(id) {
  const node = getNode(id);
  const info = NODE_TYPES[node.type] || NODE_TYPES.set;
  const el = nodeEl(id);
  if (!el) return;
  el.style.width = node.width + 'px';
  el.style.height = node.height + 'px';
  el.querySelector('.node-title').textContent = node.label ?? info.label;
  el.querySelector('.node-sub').textContent = node.sub ?? info.sub;
  const iconEl = el.querySelector('.node-icon');
  if (iconEl) iconEl.textContent = node.icon ?? info.icon;
}

function spawnNode(type, x, y) {
  const node = addNode(type, x, y);
  viewport.appendChild(createNodeElement(node));
  renderEdges();
  persistLocalWorkflow();
  return node;
}

function renderAllNodes() {
  viewport.querySelectorAll('.node').forEach(el => el.remove());
  for (const node of getState().nodes) {
    viewport.appendChild(createNodeElement(node));
  }
}

function addNodeAtCenter(type) {
  const r = canvasArea.getBoundingClientRect();
  const c = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
  spawnNode(type, c.x - NODE_WIDTH / 2, c.y - NODE_HEIGHT / 2);
}

/* ---- node picker panel (data-driven + search) ---- */
function renderPicker(filter = '') {
  const list = document.getElementById('pickerList');
  const q = filter.trim().toLowerCase();
  let html = '';

  for (const cat of NODE_CATEGORIES) {
    const items = Object.entries(NODE_TYPES).filter(([, v]) =>
      v.cat === cat.id &&
      (!q || v.label.toLowerCase().includes(q) || v.sub.toLowerCase().includes(q))
    );
    if (!items.length) continue;

    html += `<div class="text-[11px] uppercase tracking-wider text-gray-500 px-2 pt-3 pb-1">${cat.label}</div>`;
    for (const [key, v] of items) {
      const glyph = cat.id === 'flowchart'
        ? `<div class="picker-shape"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${SHAPE_SVG[v.shape] || PICKER_RECT}</svg></div>`
        : `<div class="icon-box" style="background:${cat.color}22;">${v.icon}</div>`;
      html += `
        <div class="picker-item flex items-center gap-3 p-2 rounded-lg hover:bg-[#2d2d2d] cursor-pointer border border-transparent hover:border-[#3a3a3a]" data-type="${key}">
          ${glyph}
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">${v.label}</div>
            <div class="text-[11px] text-gray-400 truncate">${v.sub}</div>
          </div>
        </div>`;
    }
  }
  list.innerHTML = html || '<div class="text-sm text-gray-500 px-2 py-6 text-center">No nodes found</div>';
}

function initNodePanel() {
  const openBtn = document.getElementById('addNodeBtn');
  const closeBtn = document.getElementById('closePanelBtn');
  const list = document.getElementById('pickerList');
  const search = document.getElementById('nodeSearch');

  const open = () => {
    editingId = null;
    showPanel('add');
    search.value = '';
    renderPicker();
    search.focus();
  };
  const close = () => showPanel(null);

  openBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    open();
  });
  closeBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  search.addEventListener('input', () => renderPicker(search.value));

  list.addEventListener('click', e => {
    const item = e.target.closest('.picker-item');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    editingId = null;
    addNodeAtCenter(item.dataset.type);
    close();
  });

  renderPicker();
}

/* ---- node toolbar: delete + edit ---- */
function initNodeActions() {
  viewport.addEventListener('click', e => {
    const delBtn = e.target.closest('.del-node');
    if (delBtn) {
      const el = delBtn.closest('.node[data-node-id]');
      const id = Number(el.dataset.nodeId);
      removeNode(id);
      el.remove();
      renderEdges();
      persistLocalWorkflow();
      if (editingId === id) closeEditor();
      return;
    }
    const editBtn = e.target.closest('.edit-node');
    if (editBtn) {
      openEditor(Number(editBtn.closest('.node[data-node-id]').dataset.nodeId));
    }
  });

  // double-click a node body to edit too
  viewport.addEventListener('dblclick', e => {
    const el = e.target.closest('.node[data-node-id]');
    if (el) openEditor(Number(el.dataset.nodeId));
  });
}

/* ---- panel visibility: exactly one of 'add' | 'edit' | null ---- */
function showPanel(which) {
  const add = document.getElementById('nodePanel');
  const edit = document.getElementById('nodeEditor');
  const panels = [
    [add, which === 'add'],
    [edit, which === 'edit'],
  ];

  for (const [panel, isOpen] of panels) {
    panel.classList.toggle('open', isOpen);
    panel.style.display = isOpen ? 'flex' : 'none';
    panel.style.transform = isOpen ? 'translateX(0)' : 'translateX(100%)';
    panel.style.visibility = isOpen ? 'visible' : 'hidden';
    panel.style.pointerEvents = isOpen ? 'auto' : 'none';
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }
}

/* ---- node editor panel (label + icon) ---- */
let editingId = null;

function openEditor(id) {
  editingId = id;
  const node = getNode(id);
  const info = NODE_TYPES[node.type] || NODE_TYPES.set;

  showPanel('edit');

  const labelInput = document.getElementById('editLabel');
  const subInput = document.getElementById('editSub');
  const iconInput = document.getElementById('editIconInput');
  const preview = document.getElementById('editIconPreview');

  // flowchart nodes have no icon, so hide the whole icon control for them
  const noIcon = info.cat === 'flowchart';
  document.getElementById('iconEditRow').style.display = noIcon ? 'none' : '';

  labelInput.value = node.label ?? info.label;
  subInput.value = node.sub ?? info.sub;
  iconInput.value = node.icon ?? info.icon ?? '';
  preview.textContent = node.icon ?? info.icon ?? '';
  labelInput.focus();
  labelInput.select();
}

function closeEditor() {
  editingId = null;
  showPanel(null);
}

function setIcon(icon) {
  if (editingId === null) return;
  updateNode(editingId, { icon });
  document.getElementById('editIconInput').value = icon;
  document.getElementById('editIconPreview').textContent = icon;
  refreshNode(editingId);
}

function initNodeEditor() {
  const labelInput = document.getElementById('editLabel');
  const subInput = document.getElementById('editSub');
  const iconInput = document.getElementById('editIconInput');
  const grid = document.getElementById('iconGrid');

  document.getElementById('closeEditorBtn').addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    closeEditor();
  });

  labelInput.addEventListener('input', () => {
    if (editingId === null) return;
    updateNode(editingId, { label: labelInput.value });
    refreshNode(editingId);
    persistLocalWorkflow();
  });

  subInput.addEventListener('input', () => {
    if (editingId === null) return;
    updateNode(editingId, { sub: subInput.value });
    refreshNode(editingId);
    persistLocalWorkflow();
  });

  iconInput.addEventListener('input', () => setIcon(iconInput.value.trim()));

  grid.innerHTML = ICON_CHOICES
    .map(ic => `<button class="icon-pick" data-icon="${ic}">${ic}</button>`)
    .join('');
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.icon-pick');
    if (btn) setIcon(btn.dataset.icon);
  });
}

function hideEdgeMenu() {
  const menu = document.getElementById('edgeMenu');
  menu.classList.add('hidden');
  activeEdgeMenu = null;
}

function showEdgeMenu(from, to, clientX, clientY) {
  const menu = document.getElementById('edgeMenu');
  const areaRect = canvasArea.getBoundingClientRect();
  activeEdgeMenu = { from, to };
  menu.style.left = `${clientX - areaRect.left + 8}px`;
  menu.style.top = `${clientY - areaRect.top + 8}px`;
  menu.classList.remove('hidden');
}

/* ---- edge actions: label + delete ---- */
function initEdgeActions() {
  const svg = document.getElementById('edgeLayer');
  svg.addEventListener('click', e => {
    const group = e.target.closest('.edge-group');
    if (!group) return;
    e.preventDefault();
    e.stopPropagation();
    showEdgeMenu(Number(group.dataset.from), Number(group.dataset.to), e.clientX, e.clientY);
  });

  const menu = document.getElementById('edgeMenu');
  const editBtn = document.getElementById('editEdgeBtn');
  const deleteBtn = document.getElementById('deleteEdgeBtn');

  editBtn.addEventListener('click', () => {
    if (!activeEdgeMenu) return;
    const edge = getEdge(activeEdgeMenu.from, activeEdgeMenu.to);
    const current = edge?.label ?? '';
    const next = window.prompt('Masukkan label konektor:', current);
    if (next === null) return;
    updateEdge(activeEdgeMenu.from, activeEdgeMenu.to, { label: next.trim() });
    renderEdges();
    persistLocalWorkflow();
    hideEdgeMenu();
  });

  deleteBtn.addEventListener('click', () => {
    if (!activeEdgeMenu) return;
    removeEdge(activeEdgeMenu.from, activeEdgeMenu.to);
    renderEdges();
    persistLocalWorkflow();
    hideEdgeMenu();
  });

  menu.addEventListener('click', e => e.stopPropagation());
  canvasArea.addEventListener('click', e => {
    if (!e.target.closest('.edge-group')) hideEdgeMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideEdgeMenu();
  });
}

/* ---- zoom controls ---- */
function initZoomControls() {
  document.getElementById('zoomIn').addEventListener('click', () => zoomBy(1.2));
  document.getElementById('zoomOut').addEventListener('click', () => zoomBy(1 / 1.2));
  document.getElementById('zoomFit').addEventListener('click', () => resetView());
}

function snapshotWorkflow() {
  return {
    workflowName: document.getElementById('wfName').value,
    view: {
      panX: view.panX,
      panY: view.panY,
      zoom: view.zoom,
    },
    state: structuredClone(getState()),
  };
}

function fileSafeName(value) {
  return (value || 'workflow')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workflow';
}

function setSaveMessage(message) {
  const el = document.getElementById('saveStatus');
  el.textContent = message;
}

function setAiStatus(message) {
  const el = document.getElementById('aiStatus');
  if (el) el.textContent = message;
}

function setAiLoginStatus(message) {
  const el = document.getElementById('aiLoginStatus');
  if (el) el.textContent = message;
}

function persistLocalWorkflow() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshotWorkflow()));
  } catch (error) {
    console.error('Local save failed', error);
  }
}

function clearLocalWorkflow() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (error) {
    console.error('Local clear failed', error);
  }
}

function restoreLocalWorkflow() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload?.state?.nodes?.length && !payload?.state?.edges?.length) return false;
    applyWorkflow(payload, null);
    setSaveMessage('Restored local draft');
    return true;
  } catch (error) {
    console.error('Local restore failed', error);
    return false;
  }
}

function refreshAiImageUi(provider = null) {
  const resolvedProvider = provider || document.getElementById('aiProvider')?.value || 'deepseek';
  const row = document.getElementById('aiImageRow');
  const clearBtn = document.getElementById('aiImageClearBtn');
  const wrap = document.getElementById('aiImagePreviewWrap');
  const preview = document.getElementById('aiImagePreview');
  const nameEl = document.getElementById('aiImageName');
  if (!row) return;

  const isGrok = resolvedProvider === 'grok';
  row.classList.toggle('hidden', !isGrok);
  if (!isGrok) return;

  const hasImage = Boolean(aiImageContext);
  clearBtn.classList.toggle('hidden', !hasImage);
  wrap.classList.toggle('hidden', !hasImage);
  if (hasImage) {
    preview.src = aiImageContext.dataUrl;
    nameEl.textContent = aiImageContext.name;
  }
}

function scrollAiHistoryToBottom() {
  const list = document.getElementById('aiMessages');
  if (!list) return;
  list.scrollTop = list.scrollHeight;
}

function appendAiMessage(role, text) {
  const list = document.getElementById('aiMessages');
  const row = document.createElement('div');
  row.className = `assistant-msg-row ${role}`;

  const showAvatar = role !== 'user';
  if (showAvatar) {
    const avatar = document.createElement('div');
    avatar.className = `assistant-avatar ${role}`;
    avatar.textContent = role === 'assistant' ? 'AI' : 'SYS';
    row.appendChild(avatar);
  }

  const wrap = document.createElement('div');
  wrap.className = 'assistant-msg-wrap';

  const meta = document.createElement('div');
  meta.className = 'assistant-msg-meta';
  meta.textContent = role === 'user' ? 'Anda' : 'Assistant';

  const item = document.createElement('div');
  item.className = `assistant-msg ${role}`;
  item.innerHTML = escapeHtml(text);

  wrap.append(meta, item);
  row.appendChild(wrap);
  list.appendChild(row);
  scrollAiHistoryToBottom();
}

function showAiLoading() {
  hideAiLoading();
  const list = document.getElementById('aiMessages');
  const row = document.createElement('div');
  row.className = 'assistant-msg-row assistant';
  row.dataset.loading = 'true';

  const avatar = document.createElement('div');
  avatar.className = 'assistant-avatar assistant';
  avatar.textContent = 'AI';

  const wrap = document.createElement('div');
  wrap.className = 'assistant-msg-wrap';

  const meta = document.createElement('div');
  meta.className = 'assistant-msg-meta';
  meta.textContent = 'Assistant';

  const item = document.createElement('div');
  item.className = 'assistant-msg assistant';
  item.innerHTML = '<div class="assistant-loading" aria-label="Loading"><span></span><span></span><span></span></div>';

  wrap.append(meta, item);
  row.append(avatar, wrap);
  list.appendChild(row);
  aiLoadingEl = row;
  scrollAiHistoryToBottom();
}

function hideAiLoading() {
  if (aiLoadingEl) {
    aiLoadingEl.remove();
    aiLoadingEl = null;
  }
}

function setAiBusy(busy) {
  aiBusy = busy;
  const sendBtn = document.getElementById('sendAiPromptBtn');
  const prompt = document.getElementById('aiPrompt');
  if (sendBtn) {
    sendBtn.disabled = busy;
    sendBtn.textContent = busy ? 'Memproses...' : 'Kirim';
    sendBtn.classList.toggle('opacity-60', busy);
  }
  if (prompt) prompt.disabled = busy;
  if (busy) showAiLoading();
  else hideAiLoading();
}

function normalizeNodeLabel(node) {
  const info = NODE_TYPES[node.type] || NODE_TYPES.set;
  return String(node.label ?? info.label ?? '').trim().toLowerCase();
}

function findNodeIdForAiTarget(target) {
  if (Number.isFinite(target?.nodeId) && getNode(target.nodeId)) return target.nodeId;
  if (typeof target?.matchLabel === 'string' && target.matchLabel.trim()) {
    const wanted = target.matchLabel.trim().toLowerCase();
    const found = getState().nodes.find(node => normalizeNodeLabel(node) === wanted);
    if (found) return found.id;
  }
  return null;
}

function findEdgeTargetForAi(op) {
  let fromId = Number.isFinite(op?.fromNodeId) && getNode(op.fromNodeId) ? op.fromNodeId : null;
  let toId = Number.isFinite(op?.toNodeId) && getNode(op.toNodeId) ? op.toNodeId : null;

  if (!fromId && typeof op?.fromMatchLabel === 'string' && op.fromMatchLabel.trim()) {
    fromId = findNodeIdForAiTarget({ matchLabel: op.fromMatchLabel });
  }
  if (!toId && typeof op?.toMatchLabel === 'string' && op.toMatchLabel.trim()) {
    toId = findNodeIdForAiTarget({ matchLabel: op.toMatchLabel });
  }

  if (!fromId || !toId) return null;
  return { fromId, toId };
}

function normalizePortSide(side, fallback) {
  return ['left', 'right', 'top', 'bottom'].includes(side) ? side : fallback;
}

function sortNodesForLayout(ids) {
  return [...ids].sort((a, b) => {
    const nodeA = getNode(a);
    const nodeB = getNode(b);
    if (!nodeA || !nodeB) return 0;
    return (nodeA.y - nodeB.y) || (nodeA.x - nodeB.x) || (a - b);
  });
}

function detectPreferredLayoutOrientation() {
  const nodes = getState().nodes;
  if (!nodes.length) return 'vertical';
  const flowchartCount = nodes.filter(node => (NODE_TYPES[node.type] || NODE_TYPES.set).cat === 'flowchart').length;
  return flowchartCount >= Math.ceil(nodes.length / 2) ? 'vertical' : 'horizontal';
}

function autoLayoutGraph(orientation = detectPreferredLayoutOrientation()) {
  const { nodes, edges } = getState();
  if (nodes.length < 2) return false;

  const nodeIds = nodes.map(node => node.id);
  const incoming = new Map(nodeIds.map(id => [id, []]));
  const outgoing = new Map(nodeIds.map(id => [id, []]));

  for (const edge of edges) {
    if (!incoming.has(edge.to) || !outgoing.has(edge.from)) continue;
    incoming.get(edge.to).push(edge);
    outgoing.get(edge.from).push(edge);
  }

  const indegree = new Map(nodeIds.map(id => [id, incoming.get(id).length]));
  const queue = sortNodesForLayout(nodeIds.filter(id => indegree.get(id) === 0));
  const topo = [];

  while (queue.length) {
    const id = queue.shift();
    topo.push(id);
    for (const edge of outgoing.get(id)) {
      const next = edge.to;
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
    queue.sort((a, b) => {
      const nodeA = getNode(a);
      const nodeB = getNode(b);
      return (nodeA?.y ?? 0) - (nodeB?.y ?? 0) || (nodeA?.x ?? 0) - (nodeB?.x ?? 0);
    });
  }

  for (const id of nodeIds) {
    if (!topo.includes(id)) topo.push(id);
  }

  const layer = new Map(nodeIds.map(id => [id, 0]));
  for (const id of topo) {
    for (const edge of outgoing.get(id)) {
      layer.set(edge.to, Math.max(layer.get(edge.to), layer.get(id) + 1));
    }
  }

  const layers = [];
  for (const id of topo) {
    const idx = layer.get(id);
    if (!layers[idx]) layers[idx] = [];
    layers[idx].push(id);
  }

  const layerOrder = new Map();
  const yRank = new Map();

  for (let index = 0; index < layers.length; index += 1) {
    const ids = layers[index] || [];
    ids.sort((a, b) => {
      const parentsA = incoming.get(a).map(edge => edge.from);
      const parentsB = incoming.get(b).map(edge => edge.from);

      const scoreOf = (parents) => {
        if (!parents.length) {
          const node = getNode(parents === parentsA ? a : b);
          return node ? node.y : 0;
        }
        return parents.reduce((sum, parentId) => sum + (layerOrder.get(parentId) ?? 0), 0) / parents.length;
      };

      const scoreA = scoreOf(parentsA);
      const scoreB = scoreOf(parentsB);
      if (scoreA !== scoreB) return scoreA - scoreB;

      // Slightly prefer "Tidak/No" above "Ya/Yes" branches when labels exist.
      const edgeToA = incoming.get(a)[0];
      const edgeToB = incoming.get(b)[0];
      const labelA = String(edgeToA?.label || '').trim().toLowerCase();
      const labelB = String(edgeToB?.label || '').trim().toLowerCase();
      const branchWeight = (label) => {
        if (label === 'tidak' || label === 'no') return -1;
        if (label === 'ya' || label === 'yes') return 1;
        return 0;
      };
      const branchA = branchWeight(labelA);
      const branchB = branchWeight(labelB);
      if (branchA !== branchB) return branchA - branchB;

      const nodeA = getNode(a);
      const nodeB = getNode(b);
      return (nodeA?.y ?? 0) - (nodeB?.y ?? 0) || (nodeA?.x ?? 0) - (nodeB?.x ?? 0) || (a - b);
    });

    ids.forEach((id, order) => {
      layerOrder.set(id, order);
      yRank.set(id, order);
    });
  }

  const maxWidth = Math.max(...nodes.map(node => node.width));
  const maxHeight = Math.max(...nodes.map(node => node.height));
  const primaryGap = orientation === 'vertical' ? maxHeight + 130 : maxWidth + 170;
  const rowGap = 150;
  const startX = 120;
  const startY = 100;
  const nextPositions = new Map();

  for (const ids of layers) {
    if (!ids?.length) continue;
    const totalSpan = ids.reduce((sum, id, idx) => {
      const node = getNode(id);
      const size = orientation === 'vertical' ? node.width : node.height;
      return sum + size + (idx > 0 ? rowGap : 0);
    }, 0);
    let cursor = (orientation === 'vertical' ? startX : startY) - totalSpan / 2 + 280;

    for (const id of ids) {
      const node = getNode(id);
      if (orientation === 'vertical') {
        const y = startY + layer.get(id) * primaryGap;
        const x = cursor;
        nextPositions.set(id, { x, y });
        cursor += node.width + rowGap;
      } else {
        const x = startX + layer.get(id) * primaryGap;
        nextPositions.set(id, { x, y: cursor });
        cursor += node.height + rowGap;
      }
    }
  }

  for (const node of nodes) {
    const next = nextPositions.get(node.id);
    if (!next) continue;
    updateNode(node.id, { x: next.x, y: next.y });
    const el = nodeEl(node.id);
    if (el) {
      el.style.left = next.x + 'px';
      el.style.top = next.y + 'px';
    }
  }

  renderEdges();
  return true;
}

function applyAiOperations(operations) {
  const refMap = new Map();
  let createdNodes = 0;
  let createdEdges = 0;
  let updatedNodes = 0;
  let deletedNodes = 0;
  let updatedEdges = 0;
  let deletedEdges = 0;
  let autoLayoutRequested = false;
  let requestedLayoutOrientation = null;

  for (const op of operations) {
    if (op.type !== 'create_node' || !NODE_TYPES[op.nodeType]) continue;
    const node = spawnNode(op.nodeType, op.x, op.y);
    const patch = {};
    if (typeof op.label === 'string') patch.label = op.label;
    if (typeof op.sub === 'string') patch.sub = op.sub;
    if (typeof op.icon === 'string') patch.icon = op.icon;
    if (Number.isFinite(op.width)) patch.width = op.width;
    if (Number.isFinite(op.height)) patch.height = op.height;
    updateNode(node.id, patch);
    refreshNode(node.id);
    refMap.set(op.ref, node.id);
    createdNodes += 1;
  }

  for (const op of operations) {
    if (op.type !== 'create_edge') continue;
    let fromId = typeof op.fromRef === 'string' ? refMap.get(op.fromRef) : null;
    let toId = typeof op.toRef === 'string' ? refMap.get(op.toRef) : null;

    if (!fromId || !toId) {
      const existingTarget = findEdgeTargetForAi(op);
      if (existingTarget) {
        fromId = fromId || existingTarget.fromId;
        toId = toId || existingTarget.toId;
      }
    }

    if (!fromId || !toId) continue;
    const edge = addEdge(
      fromId,
      toId,
      normalizePortSide(op.fromSide, 'right'),
      normalizePortSide(op.toSide, 'left')
    );
    if (!edge) continue;
    if (typeof op.label === 'string' && op.label.trim()) {
      updateEdge(fromId, toId, { label: op.label.trim() });
    }
    createdEdges += 1;
  }

  for (const op of operations) {
    if (op.type === 'update_node') {
      const nodeId = findNodeIdForAiTarget(op);
      if (!nodeId) continue;
      const patch = {};
      if (typeof op.label === 'string') patch.label = op.label;
      if (typeof op.sub === 'string') patch.sub = op.sub;
      if (typeof op.icon === 'string') patch.icon = op.icon;
      if (Number.isFinite(op.x)) patch.x = op.x;
      if (Number.isFinite(op.y)) patch.y = op.y;
      if (Number.isFinite(op.width)) patch.width = op.width;
      if (Number.isFinite(op.height)) patch.height = op.height;
      updateNode(nodeId, patch);
      const el = nodeEl(nodeId);
      const node = getNode(nodeId);
      if (el && node) {
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
      }
      refreshNode(nodeId);
      updatedNodes += 1;
      continue;
    }

    if (op.type === 'delete_node') {
      const nodeId = findNodeIdForAiTarget(op);
      if (!nodeId) continue;
      removeNode(nodeId);
      nodeEl(nodeId)?.remove();
      if (editingId === nodeId) closeEditor();
      deletedNodes += 1;
      continue;
    }

    if (op.type === 'update_edge') {
      const target = findEdgeTargetForAi(op);
      if (!target) continue;
      const edge = getEdge(target.fromId, target.toId);
      if (!edge) continue;
      updateEdge(target.fromId, target.toId, {
        fromSide: normalizePortSide(op.fromSide, edge.fromSide ?? 'right'),
        toSide: normalizePortSide(op.toSide, edge.toSide ?? 'left'),
        label: typeof op.label === 'string' ? op.label.trim() : edge.label,
      });
      updatedEdges += 1;
      continue;
    }

    if (op.type === 'delete_edge') {
      const target = findEdgeTargetForAi(op);
      if (!target) continue;
      if (!getEdge(target.fromId, target.toId)) continue;
      removeEdge(target.fromId, target.toId);
      deletedEdges += 1;
      continue;
    }

    if (op.type === 'auto_layout') {
      autoLayoutRequested = true;
      requestedLayoutOrientation = op.orientation || requestedLayoutOrientation;
    }
  }

  const hasStructuralChanges = createdNodes || createdEdges || deletedNodes || deletedEdges;
  const layoutApplied = (autoLayoutRequested || hasStructuralChanges)
    ? autoLayoutGraph(requestedLayoutOrientation || detectPreferredLayoutOrientation())
    : false;
  renderEdges();
  persistLocalWorkflow();
  return {
    createdNodes,
    createdEdges,
    updatedNodes,
    deletedNodes,
    updatedEdges,
    deletedEdges,
    layoutApplied,
    layoutOrientation: requestedLayoutOrientation || detectPreferredLayoutOrientation(),
  };
}

function applyWorkflow(payload, sourceName = null) {
  replaceState(payload.state || {});
  renderAllNodes();
  renderEdges();

  document.getElementById('wfName').value = payload.workflowName || 'Untitled board';

  view.panX = payload.view?.panX ?? 0;
  view.panY = payload.view?.panY ?? 0;
  view.zoom = payload.view?.zoom ?? 1;
  applyTransform();

  closeEditor();
  hideEdgeMenu();
  currentFileName = sourceName;
  persistLocalWorkflow();
}

async function saveWorkflow() {
  const payload = snapshotWorkflow();
  const json = JSON.stringify(payload, null, 2);
  const suggestedName = currentFileName || `${fileSafeName(payload.workflowName)}.json`;

  try {
    if ('showSaveFilePicker' in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'Workflow UI JSON',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      currentFileName = handle.name;
      persistLocalWorkflow();
      setSaveMessage(`Saved ${handle.name}`);
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    currentFileName = suggestedName;
    persistLocalWorkflow();
    setSaveMessage(`Downloaded ${suggestedName}`);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    console.error(error);
    setSaveMessage('Save failed');
  }
}

async function readWorkflowFile(file) {
  const raw = await file.text();
  const payload = JSON.parse(raw);
  applyWorkflow(payload, file.name);
  setSaveMessage(`Loaded ${file.name}`);
}

function openLoadInput() {
  const input = document.getElementById('loadUiInput');
  input.value = '';
  input.click();
}

function initLoadInput() {
  const input = document.getElementById('loadUiInput');
  input.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await readWorkflowFile(file);
    } catch (error) {
      console.error(error);
      setSaveMessage('Load failed');
    }
  });
}

async function loadWorkflow() {
  try {
    if ('showOpenFilePicker' in window) {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{
          description: 'Workflow UI JSON',
          accept: { 'application/json': ['.json'] },
        }],
      });
      if (!handle) return false;
      const file = await handle.getFile();
      await readWorkflowFile(file);
      return true;
    }

    openLoadInput();
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    console.error(error);
    setSaveMessage('Load failed');
    return false;
  }
}

/* ---- export workflow as PNG (rebuilt from state, no external libs) ---- */
function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// greedy word-wrap into at most maxLines, with ellipsis when content is cut
function wrapLines(text, maxChars, maxLines) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const all = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length <= maxChars || !cur) cur = candidate;
    else { all.push(cur); cur = w; }
  }
  if (cur) all.push(cur);
  const lines = all.slice(0, maxLines).map(ln =>
    ln.length > maxChars ? ln.slice(0, Math.max(1, maxChars - 1)) + '…' : ln);
  if (all.length > maxLines && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = (last.endsWith('…') ? last : last.slice(0, Math.max(1, maxChars - 1)) + '…');
  }
  return lines;
}

function nodeSvg(node) {
  const info = NODE_TYPES[node.type] || NODE_TYPES.set;
  const color = CATEGORY_COLOR[info.cat] || '#6b7280';
  const shape = info.shape && SHAPE_SVG[info.shape] ? info.shape : null;
  const noIcon = info.cat === 'flowchart';
  const { x, y, width: w, height: h } = node;
  const label = node.label ?? info.label;
  const sub = node.sub ?? info.sub;
  const icon = node.icon ?? info.icon;

  let out = shape
    ? `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">${SHAPE_SVG[shape]}</svg>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#2b2b2b" stroke="#3a3a3a" stroke-width="1.5"/>`;

  const drawText = (lines, tx, anchor, startY) => {
    let ty = startY;
    for (const ln of lines) {
      out += `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="13" font-weight="500" fill="#f3f4f6">${escapeXml(ln)}</text>`;
      ty += 16;
    }
    return ty;
  };

  if (noIcon) {
    const cx = x + w / 2;
    const maxChars = Math.max(6, Math.floor((w - 28) / 7));
    const titleLines = wrapLines(label, maxChars, 2);
    const subLines = wrapLines(sub, Math.floor(maxChars * 1.1), 2);
    const total = titleLines.length * 16 + (subLines.length ? subLines.length * 14 + 4 : 0);
    let ty = drawText(titleLines, cx, 'middle', y + h / 2 - total / 2 + 12);
    ty += subLines.length ? 4 : 0;
    for (const ln of subLines) {
      out += `<text x="${cx}" y="${ty}" text-anchor="middle" font-size="11" fill="#9ca3af">${escapeXml(ln)}</text>`;
      ty += 14;
    }
  } else {
    const iconSize = 36;
    const ix = x + 12, iy = y + h / 2 - iconSize / 2;
    out += `<rect x="${ix}" y="${iy}" width="${iconSize}" height="${iconSize}" rx="9" fill="${color}" fill-opacity="0.13"/>`;
    out += `<text x="${ix + iconSize / 2}" y="${iy + iconSize / 2}" text-anchor="middle" dominant-baseline="central" font-size="18">${escapeXml(icon)}</text>`;
    const tx = ix + iconSize + 12;
    const maxChars = Math.max(6, Math.floor((x + w - 12 - tx) / 7));
    const titleLines = wrapLines(label, maxChars, 2);
    const subLines = wrapLines(sub, maxChars, 2);
    const total = titleLines.length * 16 + (subLines.length ? subLines.length * 14 + 4 : 0);
    let ty = drawText(titleLines, tx, 'start', y + h / 2 - total / 2 + 12);
    ty += subLines.length ? 4 : 0;
    for (const ln of subLines) {
      out += `<text x="${tx}" y="${ty}" font-size="11" fill="#9ca3af">${escapeXml(ln)}</text>`;
      ty += 14;
    }
  }
  return out;
}

function edgesSvg() {
  let out = '';
  for (const edge of getState().edges) {
    const fromNode = getNode(edge.from);
    const toNode = getNode(edge.to);
    if (!fromNode || !toNode) continue;
    const fromSide = edge.fromSide ?? 'right';
    const toSide = edge.toSide ?? 'left';
    const a = portXY(fromNode, fromSide);
    const b = portXY(toNode, toSide);
    out += `<path d="${buildEdgePath(a.x, a.y, b.x, b.y, fromSide, toSide)}" fill="none" stroke="#7a7a7a" stroke-width="2"/>`;
    const lbl = (edge.label || '').trim();
    if (lbl) {
      const p = edgeLabelPoint(a.x, a.y, b.x, b.y, fromSide, toSide);
      const disp = lbl.length > 22 ? lbl.slice(0, 21) + '…' : lbl;
      const lw = Math.min(160, Math.max(44, disp.length * 7 + 18));
      out += `<g transform="translate(${p.x}, ${p.y})">`
        + `<rect x="${-lw / 2}" y="-10" width="${lw}" height="20" rx="10" fill="#202020" stroke="#3a3a3a"/>`
        + `<text text-anchor="middle" dominant-baseline="central" fill="#d1d5db" font-size="10">${escapeXml(disp)}</text>`
        + `</g>`;
    }
  }
  return out;
}

function buildWorkflowSvg(transparent = false) {
  const { nodes } = getState();
  if (!nodes.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  const pad = 64;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const W = Math.round(maxX - minX);
  const H = Math.round(maxY - minY);

  // dark canvas + dotted grid; skipped entirely for a transparent export
  const background = transparent ? '' :
    `<defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="#333"/>
    </pattern>
  </defs>
  <rect x="${minX}" y="${minY}" width="${W}" height="${H}" fill="#1a1a1a"/>
  <rect x="${minX}" y="${minY}" width="${W}" height="${H}" fill="url(#grid)"/>`;

  const nodesSvg = nodes.map(nodeSvg).join('');
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${minX} ${minY} ${W} ${H}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">
  <style>
    .node-shape-path { fill:#2b2b2b; stroke:#3a3a3a; stroke-width:1.5; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
    .node-shape-line { fill:none; stroke:#3a3a3a; stroke-width:1.5; vector-effect:non-scaling-stroke; }
  </style>
  ${background}
  ${edgesSvg()}
  ${nodesSvg}
</svg>`;
  return { svg, width: W, height: H };
}

function svgToPngBlob(svg, width, height, scale = 2) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render failed')); };
    img.src = url;
  });
}

async function exportImage(transparent = false) {
  const result = buildWorkflowSvg(transparent);
  if (!result) { setSaveMessage('Nothing to export'); return; }

  const base = fileSafeName(document.getElementById('wfName').value);
  const name = `${base}${transparent ? '-transparent' : ''}.png`;
  try {
    const blob = await svgToPngBlob(result.svg, result.width, result.height, 2);

    if ('showSaveFilePicker' in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      setSaveMessage(`Exported ${handle.name}`);
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSaveMessage(`Exported ${name}`);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    console.error(error);
    setSaveMessage('Export failed');
  }
}

async function fetchAiAuthStatus() {
  const response = await fetch('/api/auth/status');
  const payload = await response.json();
  aiAuthState = {
    authenticated: Boolean(payload.authenticated),
    username: payload.username ?? null,
    configured: payload.configured !== false,
  };
  return aiAuthState;
}

function seedSampleWorkflow() {
  // contoh gabungan (Bahasa Indonesia): otomasi balas chat customer service.
  // Mencampur node biasa (trigger, AI, integrasi) dengan node flowchart.
  const place = (type, x, y, label, sub) => {
    const node = spawnNode(type, x, y);
    updateNode(node.id, { label, sub });
    refreshNode(node.id);
    return node;
  };
  const link = (a, b, label) => {
    addEdge(a.id, b.id);
    if (label) updateEdge(a.id, b.id, { label });
  };

  // spine
  const chat    = place('chat',        100, 300, 'Pesan Masuk',     'Pelanggan kirim chat');
  const ai      = place('agent',       360, 300, 'Analisa Maksud',  'AI deteksi intent');
  const cek     = place('fcDecision',  620, 300, 'Butuh CS?',       'Kondisi rumit?');

  // jalur manusia (Ya)
  const cs      = place('slack',       880, 140, 'Teruskan ke CS',  'Notifikasi tim');
  const endCS   = place('fcEnd',      1140, 140, 'Selesai',         'Ditangani manusia');

  // jalur balas otomatis AI (Tidak) — detail
  const ambil   = place('http',        880, 440, 'Ambil Konteks',    'Cari data / RAG');
  const llm     = place('llm',        1140, 440, 'Generate Jawaban', 'LLM susun draf');
  const yakin   = place('fcDecision', 1400, 440, 'Yakin?',           'Skor keyakinan');
  const kirim   = place('fcProcess',  1660, 320, 'Kirim Balasan',    'Balas ke pelanggan');
  const eskal   = place('fcProcess',  1660, 560, 'Eskalasi ke CS',   'Lempar ke agen');
  const log     = place('database',   1920, 440, 'Simpan Log',       'Catat percakapan');
  const selesai = place('fcEnd',      2180, 440, 'Selesai',          'Alur berakhir');

  link(chat, ai);
  link(ai, cek);
  link(cek, cs, 'Ya');
  link(cek, ambil, 'Tidak');
  link(cs, endCS);
  link(ambil, llm);
  link(llm, yakin);
  link(yakin, kirim, 'Ya');
  link(yakin, eskal, 'Tidak');
  link(kirim, log);
  link(eskal, log);
  link(log, selesai);

  renderEdges();
}

function initExportMenu() {
  const btn = document.getElementById('exportImgBtn');
  const menu = document.getElementById('exportMenu');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  menu.addEventListener('click', e => {
    const item = e.target.closest('button[data-transparent]');
    if (!item) return;
    e.stopPropagation();
    menu.classList.add('hidden');
    exportImage(item.dataset.transparent === '1');
  });
  document.addEventListener('click', () => menu.classList.add('hidden'));
}

function clearWorkflow() {
  const { nodes, edges } = getState();
  if (!nodes.length && !edges.length) {
    setSaveMessage('Already empty');
    return;
  }
  if (!window.confirm('Hapus semua node dan koneksi di canvas?')) return;

  replaceState({ nodes: [], edges: [], nextId: 1 });
  renderAllNodes();
  renderEdges();
  closeEditor();
  hideEdgeMenu();
  currentFileName = null;
  clearLocalWorkflow();
  setSaveMessage('Cleared');
}

function initPersistence() {
  document.getElementById('wfName').addEventListener('input', persistLocalWorkflow);
  document.addEventListener('workflow:changed', persistLocalWorkflow);
  window.addEventListener('pagehide', persistLocalWorkflow);
  window.addEventListener('beforeunload', persistLocalWorkflow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistLocalWorkflow();
  });
  document.getElementById('saveUiBtn').addEventListener('click', saveWorkflow);
  document.getElementById('loadUiBtn').addEventListener('click', loadWorkflow);
  document.getElementById('clearBtn').addEventListener('click', clearWorkflow);
  initExportMenu();
  initLoadInput();
}

function initAiAssistant() {
  const openBtn = document.getElementById('aiAssistantBtn');
  const closeBtn = document.getElementById('closeAiAssistantBtn');
  const panel = document.getElementById('aiAssistantPanel');
  const loginPanel = document.getElementById('aiLoginPanel');
  const closeLoginBtn = document.getElementById('closeAiLoginBtn');
  const loginUser = document.getElementById('aiLoginUsername');
  const loginPassword = document.getElementById('aiLoginPassword');
  const loginSubmitBtn = document.getElementById('aiLoginSubmitBtn');
  const logoutBtn = document.getElementById('aiLogoutBtn');
  const providerSelect = document.getElementById('aiProvider');
  const modelInput = document.getElementById('aiModel');
  const imageInput = document.getElementById('aiImageInput');
  const imageSelectBtn = document.getElementById('aiImageSelectBtn');
  const imageClearBtn = document.getElementById('aiImageClearBtn');
  const promptInput = document.getElementById('aiPrompt');
  const sendBtn = document.getElementById('sendAiPromptBtn');

  const openLogin = () => {
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
    loginPanel.classList.remove('hidden');
    loginPanel.setAttribute('aria-hidden', 'false');
    loginUser.focus();
  };
  const open = () => {
    if (!aiAuthState.authenticated) {
      openLogin();
      return;
    }
    loginPanel.classList.add('hidden');
    loginPanel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    scrollAiHistoryToBottom();
    promptInput.focus();
  };
  const close = () => {
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
    loginPanel.classList.add('hidden');
    loginPanel.setAttribute('aria-hidden', 'true');
  };

  openBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    open();
  });
  closeBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  closeLoginBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  providerSelect.addEventListener('change', () => {
    modelInput.value = AI_DEFAULT_MODELS[providerSelect.value] || '';
    refreshAiImageUi(providerSelect.value);
  });

  imageSelectBtn.addEventListener('click', () => {
    imageInput.click();
  });

  imageClearBtn.addEventListener('click', () => {
    aiImageContext = null;
    imageInput.value = '';
    refreshAiImageUi(providerSelect.value);
    setAiStatus('Gambar context dihapus.');
  });

  imageInput.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setAiStatus('Format gambar harus PNG atau JPEG.');
      imageInput.value = '';
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setAiStatus('Ukuran gambar maksimal 20MiB.');
      imageInput.value = '';
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Gagal membaca gambar'));
      reader.readAsDataURL(file);
    });
    aiImageContext = {
      name: file.name,
      dataUrl,
    };
    refreshAiImageUi(providerSelect.value);
    setAiStatus(`Gambar aktif: ${file.name}`);
  });

  async function refreshAuthUi() {
    const state = await fetchAiAuthStatus();
    openBtn.title = state.authenticated
      ? `AI Assistant (${state.username || 'authenticated'})`
      : 'Login untuk membuka AI Assistant';
    if (!state.configured) {
      setAiLoginStatus('AI login belum dikonfigurasi di server.');
      loginSubmitBtn.disabled = true;
      return;
    }
    loginSubmitBtn.disabled = false;
    setAiLoginStatus(
      state.authenticated
        ? `Login sebagai ${state.username}.`
        : 'Masuk untuk memakai AI assistant.'
    );
  }

  async function submitLogin() {
    if (loginSubmitBtn.disabled) return;
    const username = loginUser.value.trim();
    const password = loginPassword.value;
    if (!username || !password) {
      setAiLoginStatus('Username dan password wajib diisi.');
      return;
    }
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Memproses...';
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Login gagal');
      aiAuthState = {
        authenticated: true,
        username: payload.username ?? username,
        configured: true,
      };
      loginPassword.value = '';
      setAiLoginStatus(`Login sebagai ${aiAuthState.username}.`);
      await refreshAuthUi();
      open();
    } catch (error) {
      setAiLoginStatus(error instanceof Error ? error.message : 'Login gagal');
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Login';
    }
  }

  loginSubmitBtn.addEventListener('click', submitLogin);
  loginUser.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitLogin();
    }
  });
  loginPassword.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitLogin();
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    aiAuthState = { authenticated: false, username: null, configured: aiAuthState.configured };
    close();
    await refreshAuthUi();
  });

  promptInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  sendBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt || aiBusy) return;
    if (!aiAuthState.authenticated) {
      setAiStatus('Login diperlukan.');
      openLogin();
      return;
    }

    appendAiMessage('user', prompt);
    setAiBusy(true);
    setAiStatus('Menghubungi model...');

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          provider: providerSelect.value,
          model: modelInput.value.trim(),
          imageDataUrl: providerSelect.value === 'grok' ? aiImageContext?.dataUrl || '' : '',
          workflowName: document.getElementById('wfName').value.trim(),
          state: structuredClone(getState()),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          aiAuthState.authenticated = false;
          await refreshAuthUi();
          openLogin();
        }
        throw new Error(payload.error || 'AI request failed');
      }

      appendAiMessage('assistant', payload.reply || 'AI merespons tanpa teks.');

      const operations = Array.isArray(payload.operations) ? payload.operations : [];
      if (operations.length) {
        const result = applyAiOperations(operations);
        const summary = [
          `buat node ${result.createdNodes}`,
          `buat edge ${result.createdEdges}`,
          `edit node ${result.updatedNodes}`,
          `hapus node ${result.deletedNodes}`,
          `edit edge ${result.updatedEdges}`,
          `hapus edge ${result.deletedEdges}`,
          `layout ${result.layoutApplied ? result.layoutOrientation : 'tidak'}`,
        ].join(' · ');
        setAiStatus(summary);
        setSaveMessage(summary);
      } else {
        setAiStatus('Respons AI diterima');
        setSaveMessage('AI response received');
      }

      const usageText = payload.model
        ? `Provider ${payload.provider} · model ${payload.model}`
        : 'Respons AI diterima';
      setAiStatus(usageText);
      promptInput.value = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed';
      setAiStatus(message);
      setSaveMessage('AI request failed');
    } finally {
      setAiBusy(false);
    }
  });

  appendAiMessage(
    'assistant',
    'Jelaskan workflow yang Anda inginkan, atau minta saya membuat node dan edge otomatis di canvas ini.'
  );
  refreshAiImageUi();
  refreshAuthUi().catch(error => {
    setAiLoginStatus(error instanceof Error ? error.message : 'Gagal memeriksa status login');
  });
}

/* ---- boot ---- */
initViewport();
initDrag(canvasArea);
initNodePanel();
initNodeActions();
initNodeEditor();
initEdgeActions();
initZoomControls();
initPersistence();
initAiAssistant();

// both side panels start hidden
showPanel(null);
if (!restoreLocalWorkflow()) {
  seedSampleWorkflow();
  persistLocalWorkflow();
}
applyTransform();
