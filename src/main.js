import { addNode, addEdge, removeNode, removeEdge, updateNode, updateEdge, getNode, getEdge, getState, replaceState } from './state.js';
import { renderEdges, outputXY, inputXY, buildEdgePath, edgeLabelPoint, portXY, getNodePortCssVars, buildConnectorPath } from './bezier.js';
import { initDrag, applySelectionClass, clearSelection, removeFromSelection, setCanvasTool, getCanvasTool } from './drag.js';
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

let aiProviderDefaults = {
  deepseek: { defaultModel: 'deepseek-chat', supportsImage: false },
  openai: { defaultModel: 'gpt-5.4-mini', supportsImage: true },
  grok: { defaultModel: 'grok-3-mini', supportsImage: true },
};

// Flowchart shape outlines drawn in a 0..100 box and stretched to the node size
// (preserveAspectRatio="none"); strokes stay even via vector-effect in CSS.
const SHAPE_SVG = {
  roundedRect:   '<rect x="3" y="6" width="94" height="88" rx="16" ry="16" class="node-shape-path"/>',
  terminator:    '<rect x="3" y="6" width="94" height="88" rx="46" ry="46" class="node-shape-path"/>',
  ellipse:       '<ellipse cx="50" cy="50" rx="46" ry="38" class="node-shape-path"/>',
  diamond:       '<polygon points="50,4 96,50 50,96 4,50" class="node-shape-path"/>',
  parallelogram: '<polygon points="24,6 96,6 76,94 4,94" class="node-shape-path"/>',
  triangle:      '<polygon points="50,4 96,96 4,96" class="node-shape-path"/>',
  hexagon:       '<polygon points="22,6 78,6 96,50 78,94 22,94 4,50" class="node-shape-path"/>',
  manualOp:      '<polygon points="6,8 94,8 80,92 20,92" class="node-shape-path"/>',
  manualInput:   '<polygon points="4,30 96,8 96,92 4,92" class="node-shape-path"/>',
  offpage:       '<polygon points="4,6 96,6 96,62 50,96 4,62" class="node-shape-path"/>',
  circle:        '<ellipse cx="50" cy="50" rx="46" ry="46" class="node-shape-path"/>',
  doubleCircle:  '<ellipse cx="50" cy="50" rx="46" ry="46" class="node-shape-path"/><ellipse cx="50" cy="50" rx="38" ry="38" class="node-shape-line"/>',
  document:      '<path d="M4,6 L96,6 L96,82 C78,98 66,70 50,82 C34,94 20,74 4,84 Z" class="node-shape-path"/>',
  multiDocument: '<path d="M12,12 L92,12 L92,80 C75,94 63,69 48,80 C33,91 21,73 12,82 Z" class="node-shape-line"/><path d="M4,6 L84,6 L84,74 C67,88 55,63 40,74 C25,85 13,67 4,76 Z" class="node-shape-path"/>',
  delay:         '<path d="M4,8 L58,8 A42,42 0 0 1 58,92 L4,92 Z" class="node-shape-path"/>',
  display:       '<path d="M22,8 L82,8 C95,8 95,92 82,92 L22,92 C10,80 10,20 22,8 Z" class="node-shape-path"/>',
  cylinder:      '<path d="M4,16 C4,8 96,8 96,16 L96,84 C96,92 4,92 4,84 Z" class="node-shape-path"/><path d="M4,16 C4,24 96,24 96,16" class="node-shape-line"/>',
  subroutine:    '<rect x="3" y="6" width="94" height="88" rx="6" class="node-shape-path"/><line x1="14" y1="6" x2="14" y2="94" class="node-shape-line"/><line x1="86" y1="6" x2="86" y2="94" class="node-shape-line"/>',
  storedData:    '<path d="M16,8 L96,8 L84,92 L4,92 Z" class="node-shape-path"/><line x1="16" y1="8" x2="4" y2="92" class="node-shape-line"/>',
  internalStorage:'<rect x="3" y="6" width="94" height="88" rx="6" class="node-shape-path"/><line x1="24" y1="6" x2="24" y2="94" class="node-shape-line"/><line x1="3" y1="26" x2="97" y2="26" class="node-shape-line"/>',
  card:          '<polygon points="4,20 28,6 96,6 96,94 4,94" class="node-shape-path"/>',
  tape:          '<path d="M6,20 C20,5 80,5 94,20 L94,80 C80,95 20,95 6,80 Z" class="node-shape-path"/>',
  cloud:         '<path d="M28,78 H78 C90,78 98,70 98,58 C98,46 91,39 81,37 C78,22 66,12 50,12 C36,12 25,20 20,31 C10,32 2,40 2,52 C2,66 12,78 28,78 Z" class="node-shape-path"/>',
  note:          '<path d="M6,6 H74 L94,26 V94 H6 Z" class="node-shape-path"/><path d="M74,6 V26 H94" class="node-shape-line"/>',
  package:       '<path d="M4,18 H38 L46,6 H96 V94 H4 Z" class="node-shape-path"/><line x1="4" y1="18" x2="46" y2="18" class="node-shape-line"/>',
  subprocess:    '<rect x="3" y="6" width="94" height="88" rx="12" class="node-shape-path"/><line x1="12" y1="82" x2="88" y2="82" class="node-shape-line"/><line x1="12" y1="74" x2="88" y2="74" class="node-shape-line"/>',
  dataObject:    '<path d="M10,6 H72 L90,24 V94 H10 Z" class="node-shape-path"/><path d="M72,6 V24 H90" class="node-shape-line"/>',
  swimlane:      '<rect x="3" y="6" width="94" height="88" rx="6" class="node-shape-path"/><line x1="22" y1="6" x2="22" y2="94" class="node-shape-line"/>',
  lane:          '<rect x="3" y="6" width="94" height="88" rx="6" class="node-shape-path"/><line x1="18" y1="6" x2="18" y2="94" class="node-shape-line"/>',
  classBox:      '<rect x="3" y="6" width="94" height="88" rx="4" class="node-shape-path"/><line x1="3" y1="30" x2="97" y2="30" class="node-shape-line"/><line x1="3" y1="60" x2="97" y2="60" class="node-shape-line"/>',
  actor:         '<circle cx="50" cy="18" r="10" class="node-shape-path"/><line x1="50" y1="28" x2="50" y2="62" class="node-shape-line"/><line x1="28" y1="40" x2="72" y2="40" class="node-shape-line"/><line x1="50" y1="62" x2="30" y2="92" class="node-shape-line"/><line x1="50" y1="62" x2="70" y2="92" class="node-shape-line"/>',
  component:     '<rect x="18" y="12" width="68" height="76" rx="6" class="node-shape-path"/><rect x="8" y="28" width="16" height="14" rx="2" class="node-shape-line"/><rect x="8" y="52" width="16" height="14" rx="2" class="node-shape-line"/>',
  entity:        '<rect x="3" y="6" width="94" height="88" rx="2" class="node-shape-path"/>',
  doubleRect:    '<rect x="8" y="11" width="84" height="78" rx="2" class="node-shape-line"/><rect x="3" y="6" width="94" height="88" rx="2" class="node-shape-path"/>',
  doubleDiamond: '<polygon points="50,4 96,50 50,96 4,50" class="node-shape-path"/><polygon points="50,14 86,50 50,86 14,50" class="node-shape-line"/>',
  doubleEllipse: '<ellipse cx="50" cy="50" rx="46" ry="38" class="node-shape-path"/><ellipse cx="50" cy="50" rx="38" ry="30" class="node-shape-line"/>',
  server:        '<path d="M16,18 C16,10 84,10 84,18 V82 C84,90 16,90 16,82 Z" class="node-shape-path"/><path d="M16,18 C16,26 84,26 84,18" class="node-shape-line"/><path d="M16,50 C16,58 84,58 84,50" class="node-shape-line"/>',
  router:        '<circle cx="50" cy="50" r="34" class="node-shape-path"/><path d="M50,24 V76 M24,50 H76 M34,34 L66,66 M66,34 L34,66" class="node-shape-line"/>',
  switch:        '<rect x="8" y="22" width="84" height="56" rx="8" class="node-shape-path"/><path d="M24,40 H76 M24,60 H76 M36,32 L24,40 L36,48 M64,52 L76,60 L64,68" class="node-shape-line"/>',
  shield:        '<path d="M50,6 L86,18 V48 C86,70 72,86 50,94 C28,86 14,70 14,48 V18 Z" class="node-shape-path"/>',
  laptop:        '<rect x="16" y="18" width="68" height="44" rx="4" class="node-shape-path"/><path d="M8,74 H92 L82,88 H18 Z" class="node-shape-path"/>',
  mobile:        '<rect x="28" y="6" width="44" height="88" rx="10" class="node-shape-path"/><circle cx="50" cy="80" r="4" class="node-shape-line"/>',
  window:        '<rect x="4" y="8" width="92" height="84" rx="6" class="node-shape-path"/><line x1="4" y1="24" x2="96" y2="24" class="node-shape-line"/><circle cx="14" cy="16" r="2.5" class="node-shape-line"/><circle cx="22" cy="16" r="2.5" class="node-shape-line"/><circle cx="30" cy="16" r="2.5" class="node-shape-line"/>',
  browser:       '<rect x="4" y="8" width="92" height="84" rx="8" class="node-shape-path"/><line x1="4" y1="24" x2="96" y2="24" class="node-shape-line"/><line x1="24" y1="16" x2="88" y2="16" class="node-shape-line"/><circle cx="14" cy="16" r="2.5" class="node-shape-line"/>',
  button:        '<rect x="8" y="20" width="84" height="40" rx="18" class="node-shape-path"/>',
  inputField:    '<rect x="6" y="22" width="88" height="36" rx="8" class="node-shape-path"/><line x1="16" y1="40" x2="84" y2="40" class="node-shape-line"/>',
  textarea:      '<rect x="6" y="10" width="88" height="80" rx="8" class="node-shape-path"/><line x1="16" y1="30" x2="84" y2="30" class="node-shape-line"/><line x1="16" y1="46" x2="84" y2="46" class="node-shape-line"/><line x1="16" y1="62" x2="72" y2="62" class="node-shape-line"/>',
};

const SHAPE_CONTENT_BOX = {
  diamond: { left: 0.2, right: 0.2, top: 0.18, bottom: 0.18 },
  circle: { left: 0.2, right: 0.2, top: 0.18, bottom: 0.18 },
  ellipse: { left: 0.16, right: 0.16, top: 0.18, bottom: 0.18 },
  triangle: { left: 0.24, right: 0.24, top: 0.1, bottom: 0.12 },
  parallelogram: { left: 0.16, right: 0.12, top: 0.12, bottom: 0.12 },
  hexagon: { left: 0.14, right: 0.14, top: 0.12, bottom: 0.12 },
  offpage: { left: 0.1, right: 0.1, top: 0.12, bottom: 0.2 },
  delay: { left: 0.08, right: 0.3, top: 0.14, bottom: 0.14 },
  display: { left: 0.18, right: 0.16, top: 0.14, bottom: 0.14 },
  manualInput: { left: 0.12, right: 0.1, top: 0.18, bottom: 0.12 },
  manualOp: { left: 0.12, right: 0.12, top: 0.14, bottom: 0.14 },
  document: { left: 0.1, right: 0.1, top: 0.12, bottom: 0.22 },
  multiDocument: { left: 0.1, right: 0.16, top: 0.14, bottom: 0.24 },
  cylinder: { left: 0.1, right: 0.1, top: 0.18, bottom: 0.16 },
  cloud: { left: 0.18, right: 0.18, top: 0.22, bottom: 0.24 },
  note: { left: 0.1, right: 0.16, top: 0.12, bottom: 0.12 },
  package: { left: 0.1, right: 0.1, top: 0.24, bottom: 0.12 },
  dataObject: { left: 0.14, right: 0.12, top: 0.16, bottom: 0.12 },
  actor: { left: 0.22, right: 0.22, top: 0.26, bottom: 0.14 },
  component: { left: 0.18, right: 0.14, top: 0.16, bottom: 0.16 },
  server: { left: 0.16, right: 0.16, top: 0.18, bottom: 0.16 },
  router: { left: 0.22, right: 0.22, top: 0.22, bottom: 0.22 },
  switch: { left: 0.12, right: 0.12, top: 0.26, bottom: 0.24 },
  shield: { left: 0.18, right: 0.18, top: 0.18, bottom: 0.2 },
  laptop: { left: 0.16, right: 0.16, top: 0.2, bottom: 0.34 },
  mobile: { left: 0.24, right: 0.24, top: 0.14, bottom: 0.16 },
  window: { left: 0.08, right: 0.08, top: 0.22, bottom: 0.08 },
  browser: { left: 0.08, right: 0.08, top: 0.22, bottom: 0.08 },
  inputField: { left: 0.14, right: 0.14, top: 0.3, bottom: 0.3 },
  textarea: { left: 0.12, right: 0.12, top: 0.18, bottom: 0.16 },
  button: { left: 0.16, right: 0.16, top: 0.22, bottom: 0.22 },
};

const SAMPLE_WORKFLOW = {
  workflowName: 'Untitled board',
  view: {
    panX: 44.33333333333337,
    panY: -12.833333333333314,
    zoom: 1,
  },
  state: {
    nodes: [
      { id: 1, type: 'fcStart', x: 12, y: 280, width: 112, height: 63, label: 'Mulai', sub: 'File masuk', icon: null },
      { id: 2, type: 'fcInputOutput', x: 161.16666666666669, y: 276.16666666666674, width: 178, height: 71, label: 'Terima Dokumen', sub: 'Cek berkas', icon: null },
      { id: 3, type: 'fcProcess', x: 396, y: 279.8333333333333, width: 126, height: 62, label: 'Validasi', sub: 'Periksa isi', icon: null },
      { id: 4, type: 'fcDecision', x: 597.8333333333334, y: 255.50000000000006, width: 190, height: 110, label: 'Lengkap?', sub: 'Sesuai syarat', icon: null },
      { id: 5, type: 'fcDocument', x: 589, y: 430, width: 210, height: 72, label: 'Minta Revisi', sub: 'Kirim catatan', icon: null },
      { id: 6, type: 'fcDatabase', x: 877.6666666666666, y: 277.3333333333333, width: 210, height: 72, label: 'Arsipkan', sub: 'Simpan data', icon: null },
      { id: 7, type: 'fcEnd', x: 1136.5, y: 277.1666666666667, width: 210, height: 72, label: 'Selesai', sub: 'Proses selesai', icon: null },
    ],
    edges: [
      { from: 1, to: 2, label: '', fromSide: 'right', toSide: 'left', connector: 'orthogonal', startMarker: 'none', endMarker: 'arrow' },
      { from: 2, to: 3, label: '', fromSide: 'right', toSide: 'left', connector: 'orthogonal', startMarker: 'none', endMarker: 'arrow' },
      { from: 3, to: 4, label: '', fromSide: 'right', toSide: 'left', connector: 'orthogonal', startMarker: 'none', endMarker: 'arrow' },
      { from: 4, to: 5, label: 'Tidak', fromSide: 'bottom', toSide: 'top', connector: 'orthogonal', startMarker: 'none', endMarker: 'arrow' },
      { from: 4, to: 6, label: 'Ya', fromSide: 'right', toSide: 'left', connector: 'orthogonal', startMarker: 'none', endMarker: 'arrow' },
      { from: 5, to: 2, label: '', fromSide: 'left', toSide: 'bottom', connector: 'orthogonal', startMarker: 'none', endMarker: 'arrow' },
      { from: 6, to: 7, label: '', fromSide: 'right', toSide: 'left', connector: 'orthogonal', startMarker: 'none', endMarker: 'arrow' },
    ],
    nextId: 8,
  },
};

function getShapeContentBox(shape) {
  return SHAPE_CONTENT_BOX[shape] || { left: 0.08, right: 0.08, top: 0.12, bottom: 0.12 };
}

function getNodeBodyCssVars(shape) {
  if (!shape) return {};
  const box = getShapeContentBox(shape);
  return {
    '--node-body-pad-left': `${(box.left * 100).toFixed(2)}%`,
    '--node-body-pad-right': `${(box.right * 100).toFixed(2)}%`,
    '--node-body-pad-top': `${(box.top * 100).toFixed(2)}%`,
    '--node-body-pad-bottom': `${(box.bottom * 100).toFixed(2)}%`,
  };
}

function getNodeContentRect(node, shape) {
  const box = getShapeContentBox(shape);
  return {
    x: node.x + node.width * box.left,
    y: node.y + node.height * box.top,
    width: node.width * (1 - box.left - box.right),
    height: node.height * (1 - box.top - box.bottom),
  };
}

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
  const noIcon = info.cat === 'flowchart' || info.hideIcon;

  const div = document.createElement('div');
  div.className = shape
    ? 'node node-shaped group absolute z-20 flex items-stretch select-none cursor-grab transition-colors'
    : 'node group absolute z-20 flex items-stretch bg-[#2b2b2b] border border-[#3a3a3a] rounded-xl shadow-xl select-none cursor-grab hover:border-[#4a90d9] transition-colors';
  div.style.left = node.x + 'px';
  div.style.top = node.y + 'px';
  div.style.width = node.width + 'px';
  div.style.height = node.height + 'px';
  for (const [key, value] of Object.entries(getNodePortCssVars(node))) {
    div.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(getNodeBodyCssVars(shape))) {
    div.style.setProperty(key, value);
  }
  div.dataset.nodeId = node.id;
  if (shape) div.dataset.shape = shape;
  applySelectionClass(div, node.id);

  const label = node.label ?? info.label;
  const icon = node.icon ?? info.icon;
  const sub = node.sub ?? info.sub;

  const shapeLayer = shape
    ? `<svg class="node-shape" viewBox="0 0 100 100" preserveAspectRatio="none">${SHAPE_SVG[shape]}</svg>`
    : '';

  // Flowchart nodes carry their meaning through the shape, so they drop the emoji
  // icon and center the label; everything else keeps the icon + left-aligned text.
  let bodyClass, iconHtml, textWrapClass, textClass, titleClass, subClass;
  if (noIcon) {
    bodyClass = `${shape ? 'node-body ' : ''}flex items-center justify-center text-center w-full h-full pointer-events-none${shape ? '' : ' px-4 py-3'}`;
    iconHtml = '';
    textWrapClass = 'node-text-block';
    textClass = 'min-w-0';
    titleClass = 'node-title text-[12px] font-medium leading-[1.3] text-gray-100 line-clamp-2';
    subClass = 'node-sub mt-0.5 text-[10px] leading-[1.35] text-gray-400 line-clamp-2';
  } else if (shape) {
    bodyClass = 'node-body flex items-center gap-2.5 w-full h-full pointer-events-none';
    iconHtml = `<div class="icon-box node-icon" style="background:${color}22;">${icon}</div>`;
    textWrapClass = 'node-text-block flex-1';
    textClass = 'min-w-0';
    titleClass = 'node-title text-[13px] font-medium leading-[1.3] text-gray-100 line-clamp-2';
    subClass = 'node-sub mt-0.5 text-[10px] leading-[1.35] text-gray-400 line-clamp-2';
  } else {
    bodyClass = 'node-body flex items-start gap-3 w-full h-full px-3 py-3 pr-5 pointer-events-none';
    iconHtml = `<div class="icon-box node-icon mt-0.5" style="background:${color}22;">${icon}</div>`;
    textWrapClass = 'node-text-block flex-1 self-center';
    textClass = 'min-w-0';
    titleClass = 'node-title text-[13px] font-medium leading-[1.3] text-gray-100 line-clamp-2';
    subClass = 'node-sub mt-1 text-[10px] leading-[1.35] text-gray-400 line-clamp-2';
  }

  div.innerHTML = `
    <span class="node-port" data-side="left"></span>
    <span class="node-port" data-side="right"></span>
    <span class="node-port" data-side="top"></span>
    <span class="node-port" data-side="bottom"></span>
    ${shapeLayer}
    <div class="${bodyClass}">
      ${iconHtml}
      <div class="${textWrapClass}">
        <div class="${textClass}">
          <div class="${titleClass}">${label}</div>
          <div class="${subClass}">${sub}</div>
        </div>
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
  if (!node) return;
  const info = NODE_TYPES[node.type] || NODE_TYPES.set;
  const el = nodeEl(id);
  if (!el) return;
  applySelectionClass(el, id);
  el.style.width = node.width + 'px';
  el.style.height = node.height + 'px';
  for (const [key, value] of Object.entries(getNodePortCssVars(node))) {
    el.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(getNodeBodyCssVars(info.shape && SHAPE_SVG[info.shape] ? info.shape : null))) {
    el.style.setProperty(key, value);
  }
  el.querySelector('.node-title').textContent = node.label ?? info.label;
  el.querySelector('.node-sub').textContent = node.sub ?? info.sub;
  const iconEl = el.querySelector('.node-icon');
  if (iconEl) iconEl.textContent = node.icon ?? info.icon;
}

function rerenderNode(id) {
  const node = getNode(id);
  const el = nodeEl(id);
  if (!node || !el) return;
  const nextEl = createNodeElement(node);
  el.replaceWith(nextEl);
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
  const info = NODE_TYPES[type] || {};
  const width = info.width || NODE_WIDTH;
  const height = info.height || NODE_HEIGHT;
  spawnNode(type, c.x - width / 2, c.y - height / 2);
}

/* ---- node picker panel (data-driven + search) ---- */
function renderPicker(filter = '') {
  const list = document.getElementById('pickerList');
  const q = filter.trim().toLowerCase();
  let html = '';

  for (const cat of NODE_CATEGORIES) {
    if (cat.id === 'legacy') continue;
    const items = Object.entries(NODE_TYPES).filter(([, v]) =>
      v.cat === cat.id &&
      (!q || v.label.toLowerCase().includes(q) || v.sub.toLowerCase().includes(q))
    );
    if (!items.length) continue;

    html += `<div class="text-[11px] uppercase tracking-wider text-gray-500 px-2 pt-3 pb-1">${cat.label}</div>`;
    for (const [key, v] of items) {
      const glyph = v.shape && SHAPE_SVG[v.shape]
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
      removeFromSelection(id);
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
  const noIcon = info.cat === 'flowchart' || info.hideIcon;
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

function normalizeConnectorType(value) {
  return value === 'curved' ? 'curved' : 'orthogonal';
}

function normalizeEdgeMarker(value) {
  return value === 'arrow' ? 'arrow' : 'none';
}

function showEdgeMenu(from, to, clientX, clientY) {
  const menu = document.getElementById('edgeMenu');
  const areaRect = canvasArea.getBoundingClientRect();
  activeEdgeMenu = { from, to };
  const edge = getEdge(from, to);
  const connectorInput = document.getElementById('edgeConnectorType');
  const startMarkerInput = document.getElementById('edgeStartMarker');
  const endMarkerInput = document.getElementById('edgeEndMarker');
  if (connectorInput) connectorInput.value = normalizeConnectorType(edge?.connector);
  if (startMarkerInput) startMarkerInput.value = normalizeEdgeMarker(edge?.startMarker);
  if (endMarkerInput) endMarkerInput.value = normalizeEdgeMarker(edge?.endMarker);
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
  const connectorInput = document.getElementById('edgeConnectorType');
  const startMarkerInput = document.getElementById('edgeStartMarker');
  const endMarkerInput = document.getElementById('edgeEndMarker');

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

  const applyEdgeStyle = () => {
    if (!activeEdgeMenu) return;
    const edge = getEdge(activeEdgeMenu.from, activeEdgeMenu.to);
    if (!edge) return;
    updateEdge(activeEdgeMenu.from, activeEdgeMenu.to, {
      connector: normalizeConnectorType(connectorInput.value),
      startMarker: normalizeEdgeMarker(startMarkerInput.value),
      endMarker: normalizeEdgeMarker(endMarkerInput.value),
    });
    renderEdges();
    persistLocalWorkflow();
  };

  connectorInput.addEventListener('change', applyEdgeStyle);
  startMarkerInput.addEventListener('change', applyEdgeStyle);
  endMarkerInput.addEventListener('change', applyEdgeStyle);

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

function updateCanvasToolUi(tool = getCanvasTool()) {
  document.querySelectorAll('[data-canvas-tool]').forEach(button => {
    const active = button.dataset.canvasTool === tool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  canvasArea.classList.toggle('selection-tool-active', tool === 'select');
}

function initCanvasTools() {
  document.querySelectorAll('[data-canvas-tool]').forEach(button => {
    button.addEventListener('click', () => {
      setCanvasTool(button.dataset.canvasTool);
      updateCanvasToolUi();
    });
  });
  document.addEventListener('canvas:tool-changed', event => {
    updateCanvasToolUi(event.detail?.tool);
  });
  setCanvasTool('pan');
  updateCanvasToolUi('pan');
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

async function fetchAiProviders() {
  const response = await fetch('/api/ai/providers');
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Gagal memuat konfigurasi AI providers');
  }
  if (payload?.providers && typeof payload.providers === 'object') {
    aiProviderDefaults = payload.providers;
  }
  return aiProviderDefaults;
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

  const supportsImage = Boolean(aiProviderDefaults?.[resolvedProvider]?.supportsImage);
  row.classList.toggle('hidden', !supportsImage);
  if (!supportsImage) return;

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
    sendBtn.innerHTML = busy
      ? '<span aria-hidden="true">⋯</span>'
      : '<span aria-hidden="true">➤</span>';
    sendBtn.setAttribute('aria-label', busy ? 'Memproses prompt' : 'Kirim prompt');
    sendBtn.classList.toggle('opacity-60', busy);
  }
  if (prompt) prompt.disabled = busy;
  if (busy) showAiLoading();
  else hideAiLoading();
}

function normalizeNodeLabel(node) {
  const info = NODE_TYPES[node.type] || NODE_TYPES.set;
  return String(node.label ?? info.label ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function findNodeIdForAiTarget(target) {
  if (Number.isFinite(target?.nodeId) && getNode(target.nodeId)) return target.nodeId;
  if (typeof target?.matchLabel === 'string' && target.matchLabel.trim()) {
    const wanted = target.matchLabel
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    const nodes = getState().nodes;

    const exact = nodes.find(node => normalizeNodeLabel(node) === wanted);
    if (exact) return exact.id;

    const compactWanted = wanted.replace(/\s+/g, '');
    const compactMatches = nodes.filter(node => normalizeNodeLabel(node).replace(/\s+/g, '') === compactWanted);
    if (compactMatches.length === 1) return compactMatches[0].id;

    const partialMatches = nodes.filter(node => {
      const label = normalizeNodeLabel(node);
      return label.includes(wanted) || wanted.includes(label);
    });
    if (partialMatches.length === 1) return partialMatches[0].id;
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
  const primaryGap = orientation === 'vertical'
    ? maxHeight + 52
    : maxWidth + 74;
  const rowGap = orientation === 'vertical' ? 48 : 42;
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
    let cursor = (orientation === 'vertical' ? startX : startY) - totalSpan / 2 + 220;

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

function applyAiOperations(operations, options = {}) {
  const preserveModelLayout = Boolean(options.preserveModelLayout);
  const refMap = new Map();
  let createdNodes = 0;
  let createdEdges = 0;
  let updatedNodes = 0;
  let deletedNodes = 0;
  let updatedEdges = 0;
  let deletedEdges = 0;
  let missedNodeTargets = 0;
  let missedEdgeTargets = 0;
  let autoLayoutRequested = false;
  let requestedLayoutOrientation = null;
  let hasExplicitPositions = false;

  for (const op of operations) {
    if (op.type !== 'create_node' || !NODE_TYPES[op.nodeType]) continue;
    if (Number.isFinite(op.x) || Number.isFinite(op.y)) hasExplicitPositions = true;
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
      normalizePortSide(op.toSide, 'left'),
      normalizeConnectorType(op.connector)
    );
    if (!edge) continue;
    updateEdge(fromId, toId, {
      label: typeof op.label === 'string' ? op.label.trim() : edge.label,
      connector: normalizeConnectorType(op.connector),
      startMarker: normalizeEdgeMarker(op.startMarker),
      endMarker: normalizeEdgeMarker(op.endMarker),
    });
    createdEdges += 1;
  }

  for (const op of operations) {
    if (op.type === 'update_node') {
      const nodeId = findNodeIdForAiTarget(op);
      if (!nodeId) {
        missedNodeTargets += 1;
        continue;
      }
      if (Number.isFinite(op.x) || Number.isFinite(op.y)) hasExplicitPositions = true;
      const patch = {};
      if (typeof op.nodeType === 'string' && NODE_TYPES[op.nodeType]) patch.type = op.nodeType;
      if (typeof op.label === 'string') patch.label = op.label;
      if (typeof op.sub === 'string') patch.sub = op.sub;
      if (typeof op.icon === 'string') patch.icon = op.icon;
      if (Number.isFinite(op.x)) patch.x = op.x;
      if (Number.isFinite(op.y)) patch.y = op.y;
      if (Number.isFinite(op.width)) patch.width = op.width;
      if (Number.isFinite(op.height)) patch.height = op.height;
      updateNode(nodeId, patch);
      const node = getNode(nodeId);
      const el = nodeEl(nodeId);
      if (el && node && !patch.type) {
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
      }
      if (patch.type) rerenderNode(nodeId);
      else refreshNode(nodeId);
      if (node) renderEdges();
      updatedNodes += 1;
      continue;
    }

    if (op.type === 'delete_node') {
      const nodeId = findNodeIdForAiTarget(op);
      if (!nodeId) {
        missedNodeTargets += 1;
        continue;
      }
      removeNode(nodeId);
      removeFromSelection(nodeId);
      nodeEl(nodeId)?.remove();
      if (editingId === nodeId) closeEditor();
      deletedNodes += 1;
      continue;
    }

    if (op.type === 'update_edge') {
      const target = findEdgeTargetForAi(op);
      if (!target) {
        missedEdgeTargets += 1;
        continue;
      }
      const edge = getEdge(target.fromId, target.toId);
      if (!edge) {
        missedEdgeTargets += 1;
        continue;
      }
      updateEdge(target.fromId, target.toId, {
        fromSide: normalizePortSide(op.fromSide, edge.fromSide ?? 'right'),
        toSide: normalizePortSide(op.toSide, edge.toSide ?? 'left'),
        label: typeof op.label === 'string' ? op.label.trim() : edge.label,
        connector: normalizeConnectorType(op.connector ?? edge.connector),
        startMarker: normalizeEdgeMarker(op.startMarker ?? edge.startMarker),
        endMarker: normalizeEdgeMarker(op.endMarker ?? edge.endMarker),
      });
      updatedEdges += 1;
      continue;
    }

    if (op.type === 'delete_edge') {
      const target = findEdgeTargetForAi(op);
      if (!target) {
        missedEdgeTargets += 1;
        continue;
      }
      if (!getEdge(target.fromId, target.toId)) {
        missedEdgeTargets += 1;
        continue;
      }
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
  const shouldAutoLayout = autoLayoutRequested || (
    hasStructuralChanges &&
    !(preserveModelLayout && hasExplicitPositions)
  );
  const layoutApplied = shouldAutoLayout
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
    missedNodeTargets,
    missedEdgeTargets,
    layoutApplied,
    layoutOrientation: requestedLayoutOrientation || detectPreferredLayoutOrientation(),
  };
}

function applyWorkflow(payload, sourceName = null) {
  clearSelection();
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

function exportTheme(transparent = false) {
  if (transparent) {
    return {
      nodeFill: 'none',
      nodeStroke: '#334155',
      nodeStrokeWidth: '1.7',
      titleFill: '#475569',
      subFill: '#475569',
      edgeStroke: '#334155',
      edgeLabelFill: 'rgba(255,255,255,0.92)',
      edgeLabelStroke: '#94a3b8',
      edgeLabelText: '#0f172a',
      iconBadgeOpacity: '0.18',
      shapePathFill: 'none',
      shapePathStroke: '#334155',
      shapeLineStroke: '#334155',
    };
  }

  return {
    nodeFill: '#2b2b2b',
    nodeStroke: '#3a3a3a',
    nodeStrokeWidth: '1.5',
    titleFill: '#f3f4f6',
    subFill: '#9ca3af',
    edgeStroke: '#7a7a7a',
    edgeLabelFill: '#202020',
    edgeLabelStroke: '#3a3a3a',
    edgeLabelText: '#d1d5db',
    iconBadgeOpacity: '0.13',
    shapePathFill: '#2b2b2b',
    shapePathStroke: '#3a3a3a',
    shapeLineStroke: '#3a3a3a',
  };
}

function nodeSvg(node, theme) {
  const info = NODE_TYPES[node.type] || NODE_TYPES.set;
  const color = CATEGORY_COLOR[info.cat] || '#6b7280';
  const shape = info.shape && SHAPE_SVG[info.shape] ? info.shape : null;
  const noIcon = info.cat === 'flowchart' || info.hideIcon;
  const { x, y, width: w, height: h } = node;
  const label = node.label ?? info.label;
  const sub = node.sub ?? info.sub;
  const icon = node.icon ?? info.icon;
  const content = shape ? getNodeContentRect(node, shape) : { x, y, width: w, height: h };

  let out = shape
    ? `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">${SHAPE_SVG[shape]}</svg>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${theme.nodeFill}" stroke="${theme.nodeStroke}" stroke-width="${theme.nodeStrokeWidth}"/>`;

  const drawText = (lines, tx, anchor, startY) => {
    let ty = startY;
    for (const ln of lines) {
      out += `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="13" font-weight="500" fill="${theme.titleFill}">${escapeXml(ln)}</text>`;
      ty += 16;
    }
    return ty;
  };

  const totalTextHeight = (titleLines, subLines) => (
    titleLines.length * 16 + (subLines.length ? subLines.length * 14 + 4 : 0)
  );

  if (noIcon) {
    const cx = content.x + content.width / 2;
    const maxChars = Math.max(6, Math.floor(content.width / 7));
    const titleLines = wrapLines(label, maxChars, 2);
    const subLines = wrapLines(sub, Math.floor(maxChars * 1.1), 2);
    const total = totalTextHeight(titleLines, subLines);
    let ty = drawText(titleLines, cx, 'middle', content.y + content.height / 2 - total / 2 + 12);
    ty += subLines.length ? 4 : 0;
    for (const ln of subLines) {
      out += `<text x="${cx}" y="${ty}" text-anchor="middle" font-size="11" fill="${theme.subFill}">${escapeXml(ln)}</text>`;
      ty += 14;
    }
  } else {
    const iconSize = 36;
    const ix = content.x;
    const tx = ix + iconSize + 12;
    const maxChars = Math.max(6, Math.floor((content.x + content.width - tx) / 7));
    const titleLines = wrapLines(label, maxChars, 2);
    const subLines = wrapLines(sub, maxChars, 2);
    const textHeight = totalTextHeight(titleLines, subLines);
    const rowHeight = Math.max(iconSize, textHeight);
    const rowTop = content.y + content.height / 2 - rowHeight / 2;
    const iy = rowTop + rowHeight / 2 - iconSize / 2;
    out += `<rect x="${ix}" y="${iy}" width="${iconSize}" height="${iconSize}" rx="9" fill="${color}" fill-opacity="${theme.iconBadgeOpacity}"/>`;
    out += `<text x="${ix + iconSize / 2}" y="${iy + iconSize / 2}" text-anchor="middle" dominant-baseline="central" font-size="18">${escapeXml(icon)}</text>`;
    let ty = drawText(titleLines, tx, 'start', rowTop + rowHeight / 2 - textHeight / 2 + 12);
    ty += subLines.length ? 4 : 0;
    for (const ln of subLines) {
      out += `<text x="${tx}" y="${ty}" font-size="11" fill="${theme.subFill}">${escapeXml(ln)}</text>`;
      ty += 14;
    }
  }
  return out;
}

function edgesSvg(theme) {
  let out = '';
  for (const edge of getState().edges) {
    const fromNode = getNode(edge.from);
    const toNode = getNode(edge.to);
    if (!fromNode || !toNode) continue;
    const fromSide = edge.fromSide ?? 'right';
    const toSide = edge.toSide ?? 'left';
    const a = portXY(fromNode, fromSide);
    const b = portXY(toNode, toSide);
    const connector = edge.connector ?? 'orthogonal';
    const markerStart = edge.startMarker === 'arrow' ? 'url(#export-edge-arrow-start)' : '';
    const markerEnd = edge.endMarker === 'arrow' ? 'url(#export-edge-arrow-end)' : '';
    out += `<path d="${buildConnectorPath(a.x, a.y, b.x, b.y, fromSide, toSide, connector)}" fill="none" stroke="${theme.edgeStroke}" stroke-width="2.2"${markerStart ? ` marker-start="${markerStart}"` : ''}${markerEnd ? ` marker-end="${markerEnd}"` : ''}/>`;
    const lbl = (edge.label || '').trim();
    if (lbl) {
      const p = edgeLabelPoint(a.x, a.y, b.x, b.y, fromSide, toSide, connector);
      const disp = lbl.length > 22 ? lbl.slice(0, 21) + '…' : lbl;
      const lw = Math.min(160, Math.max(44, disp.length * 7 + 18));
      out += `<g transform="translate(${p.x}, ${p.y})">`
        + `<rect x="${-lw / 2}" y="-10" width="${lw}" height="20" rx="10" fill="${theme.edgeLabelFill}" stroke="${theme.edgeLabelStroke}"/>`
        + `<text text-anchor="middle" dominant-baseline="central" fill="${theme.edgeLabelText}" font-size="10">${escapeXml(disp)}</text>`
        + `</g>`;
    }
  }
  return out;
}

function buildWorkflowSvg(transparent = false) {
  const { nodes } = getState();
  if (!nodes.length) return null;
  const theme = exportTheme(transparent);

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

  const nodesSvg = nodes.map(node => nodeSvg(node, theme)).join('');
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${minX} ${minY} ${W} ${H}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">
  <style>
    .node-shape-path { fill:${theme.shapePathFill}; stroke:${theme.shapePathStroke}; stroke-width:${theme.nodeStrokeWidth}; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
    .node-shape-line { fill:none; stroke:${theme.shapeLineStroke}; stroke-width:${theme.nodeStrokeWidth}; vector-effect:non-scaling-stroke; }
  </style>
  <defs>
    <marker id="export-edge-arrow-end" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 7 3.5 L 0 7 z" fill="${theme.edgeStroke}"/>
    </marker>
    <marker id="export-edge-arrow-start" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse" markerUnits="strokeWidth">
      <path d="M 0 0 L 7 3.5 L 0 7 z" fill="${theme.edgeStroke}"/>
    </marker>
  </defs>
  ${background}
  ${edgesSvg(theme)}
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
  applyWorkflow(structuredClone(SAMPLE_WORKFLOW), null);
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

  clearSelection();
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
    modelInput.value = aiProviderDefaults[providerSelect.value]?.defaultModel || '';
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
          imageDataUrl: ['grok', 'openai'].includes(providerSelect.value) ? aiImageContext?.dataUrl || '' : '',
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
        const result = applyAiOperations(operations, {
          preserveModelLayout: ['grok', 'openai'].includes(providerSelect.value) && Boolean(aiImageContext?.dataUrl),
        });
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
        if (result.missedNodeTargets || result.missedEdgeTargets) {
          const misses = [
            result.missedNodeTargets ? `target node tidak ketemu: ${result.missedNodeTargets}` : '',
            result.missedEdgeTargets ? `target edge tidak ketemu: ${result.missedEdgeTargets}` : '',
          ].filter(Boolean).join(' · ');
          appendAiMessage('system', `Sebagian operasi AI tidak diterapkan: ${misses}. Coba gunakan label node yang lebih spesifik atau minta AI menyebut node yang ada persis di canvas.`);
        }
      } else {
        setAiStatus('Respons AI diterima');
        setSaveMessage('AI response received');
      }

      if (!operations.length) {
        const usageText = payload.model
          ? `Provider ${payload.provider} · model ${payload.model}`
          : 'Respons AI diterima';
        setAiStatus(usageText);
      }
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
  fetchAiProviders()
    .then(defaults => {
      modelInput.value = defaults[providerSelect.value]?.defaultModel || modelInput.value;
      refreshAiImageUi(providerSelect.value);
    })
    .catch(error => {
      setAiStatus(error instanceof Error ? error.message : 'Gagal memuat konfigurasi AI providers');
      refreshAiImageUi(providerSelect.value);
    });
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
  initCanvasTools();
initPersistence();
initAiAssistant();

// both side panels start hidden
showPanel(null);
if (!restoreLocalWorkflow()) {
  seedSampleWorkflow();
  persistLocalWorkflow();
}
applyTransform();
