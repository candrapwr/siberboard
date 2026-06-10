import { NODE_WIDTH, NODE_HEIGHT } from './constants.js';

const state = {
  nodes: [],
  edges: [],
  nextId: 1,
};

function cloneNode(node) {
  return {
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    label: node.label,
    sub: node.sub,
    icon: node.icon,
  };
}

function cloneEdge(edge) {
  return {
    from: edge.from,
    to: edge.to,
    label: edge.label ?? '',
    fromSide: edge.fromSide ?? 'right',
    toSide: edge.toSide ?? 'left',
  };
}

export function addNode(type, x, y) {
  const id = state.nextId++;
  const node = {
    id,
    type,
    x,
    y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    label: null,
    sub: null,
    icon: null,
  };
  state.nodes.push(node);
  return node;
}

export function updateNode(id, patch) {
  const node = state.nodes.find(n => n.id === id);
  if (node) Object.assign(node, patch);
  return node;
}

export function removeNode(id) {
  state.nodes = state.nodes.filter(n => n.id !== id);
  state.edges = state.edges.filter(e => e.from !== id && e.to !== id);
}

export function moveNode(id, x, y) {
  const node = state.nodes.find(n => n.id === id);
  if (node) { node.x = x; node.y = y; }
}

export function resizeNode(id, width, height) {
  const node = state.nodes.find(n => n.id === id);
  if (node) {
    node.width = width;
    node.height = height;
  }
}

export function addEdge(from, to, fromSide = 'right', toSide = 'left') {
  if (from === to) return null;
  const exists = state.edges.some(e => e.from === from && e.to === to);
  if (exists) return null;
  const edge = { from, to, label: '', fromSide, toSide };
  state.edges.push(edge);
  return edge;
}

export function removeEdge(from, to) {
  state.edges = state.edges.filter(e => e.from !== from || e.to !== to);
}

export function updateEdge(from, to, patch) {
  const edge = state.edges.find(e => e.from === from && e.to === to);
  if (edge) Object.assign(edge, patch);
  return edge;
}

export function getEdge(from, to) {
  return state.edges.find(e => e.from === from && e.to === to);
}

export function getNode(id) {
  return state.nodes.find(n => n.id === id);
}

export function getState() {
  return state;
}

export function replaceState(nextState) {
  state.nodes = (nextState.nodes || []).map(cloneNode);
  state.edges = (nextState.edges || []).map(cloneEdge);
  state.nextId = nextState.nextId || (
    state.nodes.reduce((maxId, node) => Math.max(maxId, node.id), 0) + 1
  );
}
