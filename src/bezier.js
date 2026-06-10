import { getNode, getState } from './state.js';

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

function truncateLabel(value, maxChars) {
  if (value.length <= maxChars) return value;
  return value.slice(0, Math.max(0, maxChars - 1)) + '…';
}

// Port positions in world coordinates (no DOM measurement => zoom/pan proof).
export function portXY(node, side = 'right') {
  switch (side) {
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 };
    case 'top':
      return { x: node.x + node.width / 2, y: node.y };
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'right':
    default:
      return { x: node.x + node.width, y: node.y + node.height / 2 };
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
    const d = buildEdgePath(a.x, a.y, b.x, b.y, fromSide, toSide);
    const rawLabel = edge.label?.trim() || '';

    html += `<g class="edge-group" data-from="${edge.from}" data-to="${edge.to}">`;
    html += `<path d="${d}" class="edge-hit" fill="none" stroke="transparent" stroke-width="16" />`;
    html += `<path d="${d}" class="edge-line" fill="none" stroke="#7a7a7a" stroke-width="2" />`;
    html += `<circle class="edge-endpoint" data-endpoint="from" data-side="${fromSide}" cx="${a.x}" cy="${a.y}" r="5" fill="#1a1a1a" stroke="#7a8699" stroke-width="2" />`;
    html += `<circle class="edge-endpoint" data-endpoint="to" data-side="${toSide}" cx="${b.x}" cy="${b.y}" r="5" fill="#1a1a1a" stroke="#7a8699" stroke-width="2" />`;
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
