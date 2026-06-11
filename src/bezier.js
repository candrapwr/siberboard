import { getNode, getState } from './state.js';
import { NODE_TYPES } from './constants.js';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

const DEFAULT_PORT_RATIOS = {
  left: { x: 0, y: 0.5 },
  right: { x: 1, y: 0.5 },
  top: { x: 0.5, y: 0 },
  bottom: { x: 0.5, y: 1 },
};

const SHAPE_PORT_RATIOS = {
  ellipse: {
    left: { x: 0.04, y: 0.5 },
    right: { x: 0.96, y: 0.5 },
    top: { x: 0.5, y: 0.12 },
    bottom: { x: 0.5, y: 0.88 },
  },
  roundedRect: {
    left: { x: 0.02, y: 0.5 },
    right: { x: 0.98, y: 0.5 },
    top: { x: 0.5, y: 0.03 },
    bottom: { x: 0.5, y: 0.97 },
  },
  hexagon: {
    left: { x: 0.04, y: 0.5 },
    right: { x: 0.96, y: 0.5 },
    top: { x: 0.5, y: 0.06 },
    bottom: { x: 0.5, y: 0.94 },
  },
  parallelogram: {
    left: { x: 0.14, y: 0.5 },
    right: { x: 0.86, y: 0.5 },
    top: { x: 0.6, y: 0.06 },
    bottom: { x: 0.4, y: 0.94 },
  },
  manualOp: {
    left: { x: 0.13, y: 0.5 },
    right: { x: 0.87, y: 0.5 },
    top: { x: 0.5, y: 0.08 },
    bottom: { x: 0.5, y: 0.92 },
  },
  manualInput: {
    left: { x: 0.04, y: 0.62 },
    right: { x: 0.96, y: 0.5 },
    top: { x: 0.72, y: 0.08 },
    bottom: { x: 0.5, y: 0.92 },
  },
  document: {
    left: { x: 0.04, y: 0.48 },
    right: { x: 0.96, y: 0.48 },
    top: { x: 0.5, y: 0.06 },
    bottom: { x: 0.5, y: 0.82 },
  },
  multiDocument: {
    left: { x: 0.06, y: 0.48 },
    right: { x: 0.84, y: 0.48 },
    top: { x: 0.44, y: 0.06 },
    bottom: { x: 0.42, y: 0.8 },
  },
  delay: {
    left: { x: 0.04, y: 0.5 },
    right: { x: 0.58, y: 0.5 },
    top: { x: 0.31, y: 0.08 },
    bottom: { x: 0.31, y: 0.92 },
  },
  display: {
    left: { x: 0.16, y: 0.5 },
    right: { x: 0.82, y: 0.5 },
    top: { x: 0.52, y: 0.08 },
    bottom: { x: 0.52, y: 0.92 },
  },
  cylinder: {
    left: { x: 0.04, y: 0.5 },
    right: { x: 0.96, y: 0.5 },
    top: { x: 0.5, y: 0.12 },
    bottom: { x: 0.5, y: 0.88 },
  },
  subroutine: {
    left: { x: 0.03, y: 0.5 },
    right: { x: 0.97, y: 0.5 },
    top: { x: 0.5, y: 0.06 },
    bottom: { x: 0.5, y: 0.94 },
  },
  storedData: {
    left: { x: 0.1, y: 0.5 },
    right: { x: 0.9, y: 0.5 },
    top: { x: 0.56, y: 0.08 },
    bottom: { x: 0.44, y: 0.92 },
  },
  internalStorage: {
    left: { x: 0.03, y: 0.5 },
    right: { x: 0.97, y: 0.5 },
    top: { x: 0.5, y: 0.06 },
    bottom: { x: 0.5, y: 0.94 },
  },
  card: {
    left: { x: 0.04, y: 0.58 },
    right: { x: 0.96, y: 0.5 },
    top: { x: 0.42, y: 0.06 },
    bottom: { x: 0.5, y: 0.94 },
  },
  tape: {
    left: { x: 0.08, y: 0.5 },
    right: { x: 0.92, y: 0.5 },
    top: { x: 0.5, y: 0.14 },
    bottom: { x: 0.5, y: 0.86 },
  },
  cloud: {
    left: { x: 0.12, y: 0.52 },
    right: { x: 0.88, y: 0.52 },
    top: { x: 0.5, y: 0.18 },
    bottom: { x: 0.5, y: 0.78 },
  },
  note: {
    left: { x: 0.06, y: 0.5 },
    right: { x: 0.94, y: 0.5 },
    top: { x: 0.44, y: 0.06 },
    bottom: { x: 0.5, y: 0.94 },
  },
  package: {
    left: { x: 0.04, y: 0.58 },
    right: { x: 0.96, y: 0.58 },
    top: { x: 0.62, y: 0.06 },
    bottom: { x: 0.5, y: 0.94 },
  },
  subprocess: {
    left: { x: 0.03, y: 0.5 },
    right: { x: 0.97, y: 0.5 },
    top: { x: 0.5, y: 0.06 },
    bottom: { x: 0.5, y: 0.94 },
  },
  dataObject: {
    left: { x: 0.1, y: 0.5 },
    right: { x: 0.9, y: 0.5 },
    top: { x: 0.42, y: 0.06 },
    bottom: { x: 0.5, y: 0.94 },
  },
  actor: {
    left: { x: 0.28, y: 0.44 },
    right: { x: 0.72, y: 0.44 },
    top: { x: 0.5, y: 0.08 },
    bottom: { x: 0.5, y: 0.92 },
  },
  component: {
    left: { x: 0.08, y: 0.5 },
    right: { x: 0.86, y: 0.5 },
    top: { x: 0.52, y: 0.12 },
    bottom: { x: 0.52, y: 0.88 },
  },
  server: {
    left: { x: 0.16, y: 0.5 },
    right: { x: 0.84, y: 0.5 },
    top: { x: 0.5, y: 0.12 },
    bottom: { x: 0.5, y: 0.88 },
  },
  router: {
    left: { x: 0.16, y: 0.5 },
    right: { x: 0.84, y: 0.5 },
    top: { x: 0.5, y: 0.16 },
    bottom: { x: 0.5, y: 0.84 },
  },
  switch: {
    left: { x: 0.08, y: 0.5 },
    right: { x: 0.92, y: 0.5 },
    top: { x: 0.5, y: 0.22 },
    bottom: { x: 0.5, y: 0.78 },
  },
  shield: {
    left: { x: 0.18, y: 0.48 },
    right: { x: 0.82, y: 0.48 },
    top: { x: 0.5, y: 0.12 },
    bottom: { x: 0.5, y: 0.92 },
  },
  laptop: {
    left: { x: 0.16, y: 0.4 },
    right: { x: 0.84, y: 0.4 },
    top: { x: 0.5, y: 0.18 },
    bottom: { x: 0.5, y: 0.88 },
  },
  mobile: {
    left: { x: 0.28, y: 0.5 },
    right: { x: 0.72, y: 0.5 },
    top: { x: 0.5, y: 0.06 },
    bottom: { x: 0.5, y: 0.94 },
  },
  triangle: {
    left: { x: 0.26, y: 0.68 },
    right: { x: 0.74, y: 0.68 },
    top: { x: 0.5, y: 0.04 },
    bottom: { x: 0.5, y: 0.96 },
  },
};

function truncateLabel(value, maxChars) {
  if (value.length <= maxChars) return value;
  return value.slice(0, Math.max(0, maxChars - 1)) + '…';
}

function getNodeShape(node) {
  const info = NODE_TYPES[node.type] || {};
  return info.shape || null;
}

export function getPortRatio(node, side = 'right') {
  const shape = getNodeShape(node);
  const shapePreset = shape ? SHAPE_PORT_RATIOS[shape] : null;
  return shapePreset?.[side] || DEFAULT_PORT_RATIOS[side] || DEFAULT_PORT_RATIOS.right;
}

export function getNodePortCssVars(node) {
  const vars = {};
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const ratio = getPortRatio(node, side);
    vars[`--port-${side}-x`] = `${(ratio.x * 100).toFixed(2)}%`;
    vars[`--port-${side}-y`] = `${(ratio.y * 100).toFixed(2)}%`;
  }
  return vars;
}

// Port positions in world coordinates (no DOM measurement => zoom/pan proof).
export function portXY(node, side = 'right') {
  const ratio = getPortRatio(node, side);
  return {
    x: node.x + node.width * ratio.x,
    y: node.y + node.height * ratio.y,
  };
}

export function edgeEndpointHandleXY(node, side = 'right', gap = 12) {
  const anchor = portXY(node, side);
  switch (side) {
    case 'left':
      return { x: node.x - gap, y: anchor.y };
    case 'top':
      return { x: anchor.x, y: node.y - gap };
    case 'bottom':
      return { x: anchor.x, y: node.y + node.height + gap };
    case 'right':
    default:
      return { x: node.x + node.width + gap, y: anchor.y };
  }
}

export function outputXY(node) {
  return portXY(node, 'right');
}

export function inputXY(node) {
  return portXY(node, 'left');
}

function sideVector(side) {
  switch (side) {
    case 'left': return { x: -1, y: 0 };
    case 'top': return { x: 0, y: -1 };
    case 'bottom': return { x: 0, y: 1 };
    case 'right':
    default: return { x: 1, y: 0 };
  }
}

export function cubicBezierPoints(x1, y1, x2, y2, fromSide = 'right', toSide = 'left') {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const cpOffset = Math.max(Math.min(distance * 0.45, 180), 56);
  const fromVec = sideVector(fromSide);
  const toVec = sideVector(toSide);
  return {
    x1, y1,
    cx1: x1 + fromVec.x * cpOffset,
    cy1: y1 + fromVec.y * cpOffset,
    cx2: x2 + toVec.x * cpOffset,
    cy2: y2 + toVec.y * cpOffset,
    x2, y2,
  };
}

export function buildEdgePath(x1, y1, x2, y2, fromSide = 'right', toSide = 'left') {
  const { cx1, cy1, cx2, cy2 } = cubicBezierPoints(x1, y1, x2, y2, fromSide, toSide);
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

export function edgeLabelPoint(x1, y1, x2, y2, fromSide = 'right', toSide = 'left') {
  const { cx1, cy1, cx2, cy2 } = cubicBezierPoints(x1, y1, x2, y2, fromSide, toSide);
  const t = 0.5;
  return {
    x: cubicBezierPoint(x1, cx1, cx2, x2, t),
    y: cubicBezierPoint(y1, cy1, cy2, y2, t),
  };
}

export function renderEdges() {
  const svg = document.getElementById('edgeLayer');
  const { edges } = getState();

  let html = '';
  for (const edge of edges) {
    const fromNode = getNode(edge.from);
    const toNode = getNode(edge.to);
    if (!fromNode || !toNode) continue;

    const fromSide = edge.fromSide ?? 'right';
    const toSide = edge.toSide ?? 'left';
    const a = portXY(fromNode, fromSide);
    const b = portXY(toNode, toSide);
    const aHandle = edgeEndpointHandleXY(fromNode, fromSide);
    const bHandle = edgeEndpointHandleXY(toNode, toSide);
    const d = buildEdgePath(a.x, a.y, b.x, b.y, fromSide, toSide);
    const rawLabel = edge.label?.trim() || '';

    html += `<g class="edge-group" data-from="${edge.from}" data-to="${edge.to}">`;
    html += `<path d="${d}" class="edge-hit" fill="none" stroke="transparent" stroke-width="16" />`;
    html += `<path d="${d}" class="edge-line" fill="none" stroke="#7a7a7a" stroke-width="2" />`;
    html += `<circle class="edge-endpoint" data-endpoint="from" data-side="${fromSide}" cx="${aHandle.x}" cy="${aHandle.y}" r="5" fill="#1a1a1a" stroke="#7a8699" stroke-width="2" />`;
    html += `<circle class="edge-endpoint" data-endpoint="to" data-side="${toSide}" cx="${bHandle.x}" cy="${bHandle.y}" r="5" fill="#1a1a1a" stroke="#7a8699" stroke-width="2" />`;
    if (rawLabel) {
      const labelPoint = edgeLabelPoint(a.x, a.y, b.x, b.y, fromSide, toSide);
      const displayLabel = truncateLabel(rawLabel, 22);
      const label = escapeXml(displayLabel);
      const labelWidth = clamp(displayLabel.length * 7 + 18, 44, 160);
      const labelX = -(labelWidth / 2);
      html += `
        <g class="edge-label" transform="translate(${labelPoint.x}, ${labelPoint.y})">
          <rect x="${labelX}" y="-10" width="${labelWidth}" height="20" rx="10" fill="#202020" stroke="#3a3a3a" />
          <text text-anchor="middle" dominant-baseline="central" fill="#d1d5db" font-size="10">${label}</text>
        </g>
      `;
    }
    html += `</g>`;
  }
  svg.innerHTML = html;
}
