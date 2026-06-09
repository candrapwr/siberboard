import { addNode, addEdge, removeNode, removeEdge, updateNode, updateEdge, getNode, getEdge, getState, replaceState } from './state.js';
import { renderEdges, outputXY, inputXY, buildEdgePath, edgeLabelPoint } from './bezier.js';
import { initDrag } from './drag.js';
import { initViewport, applyTransform, screenToWorld, zoomBy, resetView, view } from './viewport.js';
import { NODE_TYPES, NODE_CATEGORIES, CATEGORY_COLOR, ICON_CHOICES, NODE_WIDTH, NODE_HEIGHT } from './constants.js';

const viewport = document.getElementById('viewport');
const canvasArea = document.getElementById('canvasArea');
let activeEdgeMenu = null;
let currentFileName = null;

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

function createNodeElement(node) {
  const info = NODE_TYPES[node.type] || NODE_TYPES.set;
  const color = CATEGORY_COLOR[info.cat] || '#6b7280';
  const hasIn = info.ports.includes('in');
  const hasOut = info.ports.includes('out');
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
    bodyClass = `${shape ? 'node-body ' : ''}flex items-center justify-center text-center w-full h-full px-4 pointer-events-none`;
    iconHtml = '';
    textClass = 'min-w-0';
    subClass = 'node-sub mt-0.5 text-[11px] leading-4 text-gray-400 line-clamp-2';
  } else if (shape) {
    bodyClass = 'node-body flex items-center gap-2.5 w-full h-full px-4 pointer-events-none';
    iconHtml = `<div class="icon-box node-icon" style="background:${color}22;">${icon}</div>`;
    textClass = 'min-w-0 flex-1';
    subClass = 'node-sub mt-0.5 text-[11px] leading-4 text-gray-400 line-clamp-2';
  } else {
    bodyClass = 'flex items-start gap-3 w-full h-full px-3 py-3 pr-5 pointer-events-none';
    iconHtml = `<div class="icon-box node-icon mt-0.5" style="background:${color}22;">${icon}</div>`;
    textClass = 'min-w-0 flex-1 self-center';
    subClass = 'node-sub mt-1 text-[11px] leading-4 text-gray-400 line-clamp-2';
  }

  div.innerHTML = `
    ${hasIn ? '<span class="input-port"></span>' : ''}
    ${shapeLayer}
    <div class="${bodyClass}">
      ${iconHtml}
      <div class="${textClass}">
        <div class="node-title text-sm font-medium text-gray-100 line-clamp-2">${label}</div>
        <div class="${subClass}">${sub}</div>
      </div>
    </div>
    ${hasOut ? '<span class="output-port"></span>' : ''}
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
  });

  subInput.addEventListener('input', () => {
    if (editingId === null) return;
    updateNode(editingId, { sub: subInput.value });
    refreshNode(editingId);
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
    hideEdgeMenu();
  });

  deleteBtn.addEventListener('click', () => {
    if (!activeEdgeMenu) return;
    removeEdge(activeEdgeMenu.from, activeEdgeMenu.to);
    renderEdges();
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
    const a = outputXY(fromNode);
    const b = inputXY(toNode);
    out += `<path d="${buildEdgePath(a.x, a.y, b.x, b.y)}" fill="none" stroke="#7a7a7a" stroke-width="2"/>`;
    const lbl = (edge.label || '').trim();
    if (lbl) {
      const p = edgeLabelPoint(a.x, a.y, b.x, b.y);
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

function seedSampleWorkflow() {
  // contoh flowchart sederhana (Bahasa Indonesia): cek nilai kelulusan
  const place = (type, x, y, label) => {
    const node = spawnNode(type, x, y);
    updateNode(node.id, { label, sub: '' });
    refreshNode(node.id);
    return node;
  };
  const link = (a, b, label) => {
    addEdge(a.id, b.id);
    if (label) updateEdge(a.id, b.id, { label });
  };

  const mulai   = place('fcStart',        140, 300, 'Mulai');
  const input   = place('fcInputOutput',  400, 300, 'Input Nilai');
  const cek     = place('fcDecision',     660, 300, 'Nilai ≥ 70?');
  const lulus   = place('fcProcess',      920, 170, 'Lulus');
  const gagal   = place('fcProcess',      920, 430, 'Tidak Lulus');
  const selesai = place('fcEnd',         1180, 300, 'Selesai');

  link(mulai, input);
  link(input, cek);
  link(cek, lulus, 'Ya');
  link(cek, gagal, 'Tidak');
  link(lulus, selesai);
  link(gagal, selesai);

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
  setSaveMessage('Cleared');
}

function initPersistence() {
  document.getElementById('saveUiBtn').addEventListener('click', saveWorkflow);
  document.getElementById('loadUiBtn').addEventListener('click', loadWorkflow);
  document.getElementById('clearBtn').addEventListener('click', clearWorkflow);
  initExportMenu();
  initLoadInput();
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

// both side panels start hidden
showPanel(null);
seedSampleWorkflow();
applyTransform();
