export const NODE_WIDTH = 210;
export const NODE_HEIGHT = 72;
export const MIN_NODE_WIDTH = 80;
export const MIN_NODE_HEIGHT = 56;

export const NODE_CATEGORIES = [
  { id: 'general', label: 'General', color: '#60a5fa' },
  { id: 'flowchart', label: 'Flowchart', color: '#14b8a6' },
  { id: 'bpmn', label: 'BPMN', color: '#f59e0b' },
  { id: 'uml', label: 'UML', color: '#8b5cf6' },
  { id: 'erd', label: 'ERD', color: '#22c55e' },
  { id: 'network', label: 'Network', color: '#f97316' },
  { id: 'ui', label: 'UI', color: '#ec4899' },
  { id: 'legacy', label: 'Legacy', color: '#64748b' },
];

export const ICON_CHOICES = [
  '', '⬜', '⚙️', '🔀', '🔁', '🔗', '🧠', '💬',
  '📄', '📦', '🗄️', '🌐', '📊', '🖥️', '⌨️', '🧩',
  '☁️', '📱', '🔔', '✉️', '✅', '❌', '⭐', '🚀',
  '🛠️', '🧪', '📌', '🎯', '🔒', '🔑', '📁', '🧾',
];

export const CATEGORY_COLOR = Object.fromEntries(
  NODE_CATEGORIES.map(c => [c.id, c.color])
);

function defineNode(label, sub, cat, extra = {}) {
  return {
    label,
    sub,
    icon: '',
    cat,
    ports: ['in', 'out'],
    ...extra,
  };
}

const GENERAL_NODES = {
  rect: defineNode('Rectangle', 'Generic process block', 'general', { icon: '⬜' }),
  roundedRect: defineNode('Rounded', 'Soft-corner block', 'general', { icon: '⬜', shape: 'roundedRect' }),
  ellipse: defineNode('Ellipse', 'Generic rounded node', 'general', { icon: '⭕', shape: 'ellipse', hideIcon: true }),
  triangle: defineNode('Triangle', 'Directional marker', 'general', { icon: '🔺', shape: 'triangle', hideIcon: true, width: 160, height: 120 }),
  hexagonShape: defineNode('Hexagon', 'General hexagon', 'general', { icon: '⬡', shape: 'hexagon', hideIcon: true }),
  cloud: defineNode('Cloud', 'Internet or external service', 'general', { icon: '☁️', shape: 'cloud', hideIcon: true, width: 220, height: 120 }),
  note: defineNode('Note', 'Annotation or comment', 'general', { icon: '📝', shape: 'note', width: 180, height: 110 }),
  package: defineNode('Package', 'Grouped module', 'general', { icon: '📦', shape: 'package', width: 220, height: 100 }),
};

const FLOWCHART_NODES = {
  fcStart: defineNode('Start', 'Terminator', 'flowchart', { ports: ['out'], shape: 'terminator', hideIcon: true }),
  fcEnd: defineNode('End', 'Terminator', 'flowchart', { ports: ['in'], shape: 'terminator', hideIcon: true }),
  fcProcess: defineNode('Process', 'Action step', 'flowchart', { hideIcon: true }),
  fcDecision: defineNode('Decision', 'Yes / no branch', 'flowchart', { shape: 'diamond', hideIcon: true, width: 190, height: 110 }),
  fcInputOutput: defineNode('Input / Output', 'Data I/O', 'flowchart', { shape: 'parallelogram', hideIcon: true }),
  fcDocument: defineNode('Document', 'Printed output', 'flowchart', { shape: 'document', hideIcon: true }),
  fcMultiDocument: defineNode('Multi-Document', 'Multiple documents', 'flowchart', { shape: 'multiDocument', hideIcon: true, width: 220, height: 92 }),
  fcSubroutine: defineNode('Subroutine', 'Predefined process', 'flowchart', { shape: 'subroutine', hideIcon: true }),
  fcManualInput: defineNode('Manual Input', 'Keyed entry', 'flowchart', { shape: 'manualInput', hideIcon: true }),
  fcManualOp: defineNode('Manual Operation', 'Manual step', 'flowchart', { shape: 'manualOp', hideIcon: true }),
  fcPreparation: defineNode('Preparation', 'Setup step', 'flowchart', { shape: 'hexagon', hideIcon: true }),
  fcDelay: defineNode('Delay', 'Wait / hold', 'flowchart', { shape: 'delay', hideIcon: true }),
  fcDisplay: defineNode('Display', 'Show to user', 'flowchart', { shape: 'display', hideIcon: true }),
  fcDatabase: defineNode('Database', 'Stored data', 'flowchart', { shape: 'cylinder', hideIcon: true }),
  fcConnector: defineNode('Connector', 'On-page link', 'flowchart', { shape: 'circle', hideIcon: true, width: 110, height: 110 }),
  fcOffPage: defineNode('Off-page', 'Off-page link', 'flowchart', { shape: 'offpage', hideIcon: true }),
  fcStoredData: defineNode('Stored Data', 'Direct access storage', 'flowchart', { shape: 'storedData', hideIcon: true }),
  fcInternalStorage: defineNode('Internal Storage', 'Memory / internal store', 'flowchart', { shape: 'internalStorage', hideIcon: true }),
  fcCard: defineNode('Card', 'Card or paper medium', 'flowchart', { shape: 'card', hideIcon: true }),
  fcTape: defineNode('Paper Tape', 'Sequential storage', 'flowchart', { shape: 'tape', hideIcon: true }),
};

const BPMN_NODES = {
  bpmnStartEvent: defineNode('Start Event', 'BPMN start', 'bpmn', { shape: 'circle', hideIcon: true, width: 110, height: 110 }),
  bpmnEndEvent: defineNode('End Event', 'BPMN end', 'bpmn', { shape: 'doubleCircle', hideIcon: true, ports: ['in'], width: 110, height: 110 }),
  bpmnTask: defineNode('Task', 'Atomic activity', 'bpmn', { shape: 'roundedRect', hideIcon: true, width: 220, height: 88 }),
  bpmnSubProcess: defineNode('Sub Process', 'Expanded activity', 'bpmn', { shape: 'subprocess', hideIcon: true, width: 240, height: 94 }),
  bpmnGateway: defineNode('Gateway', 'Route control', 'bpmn', { shape: 'diamond', hideIcon: true, width: 190, height: 110 }),
  bpmnDataObject: defineNode('Data Object', 'Input or output artifact', 'bpmn', { shape: 'dataObject', hideIcon: true, width: 160, height: 100 }),
  bpmnPool: defineNode('Pool', 'Main participant lane', 'bpmn', { shape: 'swimlane', hideIcon: true, width: 340, height: 140 }),
  bpmnLane: defineNode('Lane', 'Role subdivision', 'bpmn', { shape: 'lane', hideIcon: true, width: 320, height: 110 }),
};

const UML_NODES = {
  umlClass: defineNode('Class', 'Name, attributes, methods', 'uml', { shape: 'classBox', hideIcon: true, width: 240, height: 140 }),
  umlInterface: defineNode('Interface', 'Contract definition', 'uml', { shape: 'classBox', hideIcon: true, width: 240, height: 140 }),
  umlAbstractClass: defineNode('Abstract Class', 'Base type', 'uml', { shape: 'classBox', hideIcon: true, width: 240, height: 140 }),
  umlObject: defineNode('Object', 'Instance snapshot', 'uml', { shape: 'classBox', hideIcon: true, width: 220, height: 120 }),
  umlActor: defineNode('Actor', 'External user or role', 'uml', { shape: 'actor', hideIcon: true, width: 120, height: 170 }),
  umlUseCase: defineNode('Use Case', 'Goal or interaction', 'uml', { shape: 'ellipse', hideIcon: true, width: 220, height: 110 }),
  umlComponent: defineNode('Component', 'Deployable unit', 'uml', { shape: 'component', hideIcon: true, width: 220, height: 110 }),
  umlPackage: defineNode('Package', 'Namespace grouping', 'uml', { shape: 'package', hideIcon: true, width: 220, height: 100 }),
};

const ERD_NODES = {
  erdEntity: defineNode('Entity', 'Core business object', 'erd', { shape: 'entity', hideIcon: true, width: 220, height: 92 }),
  erdWeakEntity: defineNode('Weak Entity', 'Dependent object', 'erd', { shape: 'doubleRect', hideIcon: true, width: 220, height: 92 }),
  erdRelationship: defineNode('Relationship', 'Association', 'erd', { shape: 'diamond', hideIcon: true, width: 200, height: 110 }),
  erdIdentifying: defineNode('Identifying', 'Strong relationship', 'erd', { shape: 'doubleDiamond', hideIcon: true, width: 210, height: 120 }),
  erdAttribute: defineNode('Attribute', 'Field or property', 'erd', { shape: 'ellipse', hideIcon: true, width: 190, height: 96 }),
  erdKeyAttribute: defineNode('Key Attribute', 'Primary identifier', 'erd', { shape: 'ellipse', hideIcon: true, width: 190, height: 96 }),
  erdMultiValued: defineNode('Multi-valued', 'Repeating attribute', 'erd', { shape: 'doubleEllipse', hideIcon: true, width: 200, height: 100 }),
};

const NETWORK_NODES = {
  netServer: defineNode('Server', 'Application or VM host', 'network', { shape: 'server', hideIcon: true, width: 180, height: 120 }),
  netDatabase: defineNode('Database', 'Persistent storage', 'network', { shape: 'cylinder', hideIcon: true, width: 180, height: 110 }),
  netRouter: defineNode('Router', 'Traffic forwarding', 'network', { shape: 'router', hideIcon: true, width: 130, height: 130 }),
  netSwitch: defineNode('Switch', 'LAN distribution', 'network', { shape: 'switch', hideIcon: true, width: 140, height: 110 }),
  netFirewall: defineNode('Firewall', 'Security boundary', 'network', { shape: 'shield', hideIcon: true, width: 150, height: 130 }),
  netCloud: defineNode('Cloud', 'Public network', 'network', { shape: 'cloud', hideIcon: true, width: 220, height: 120 }),
  netLaptop: defineNode('Laptop', 'Client device', 'network', { shape: 'laptop', hideIcon: true, width: 170, height: 120 }),
  netPhone: defineNode('Mobile', 'Phone or handheld', 'network', { shape: 'mobile', hideIcon: true, width: 120, height: 170 }),
};

const UI_NODES = {
  uiWindow: defineNode('Window', 'Desktop frame', 'ui', { shape: 'window', hideIcon: true, width: 260, height: 170 }),
  uiBrowser: defineNode('Browser', 'Web page canvas', 'ui', { shape: 'browser', hideIcon: true, width: 260, height: 170 }),
  uiCard: defineNode('Card', 'Grouped content block', 'ui', { shape: 'roundedRect', hideIcon: true, width: 220, height: 120 }),
  uiButton: defineNode('Button', 'Primary action', 'ui', { shape: 'button', hideIcon: true, width: 170, height: 72 }),
  uiInput: defineNode('Input Field', 'Text entry control', 'ui', { shape: 'inputField', hideIcon: true, width: 220, height: 72 }),
  uiTextarea: defineNode('Textarea', 'Multi-line input', 'ui', { shape: 'textarea', hideIcon: true, width: 240, height: 120 }),
  uiMobileScreen: defineNode('Mobile Screen', 'Phone layout frame', 'ui', { shape: 'mobile', hideIcon: true, width: 150, height: 250 }),
};

// Legacy aliases keep existing saved boards and AI prompts working.
const LEGACY_NODES = {
  blankInput: defineNode('Input', 'Start point', 'legacy', { icon: '⬜', ports: ['out'] }),
  blankMiddle: defineNode('Node', 'Middle', 'legacy', { icon: '⬜' }),
  blankEnd: defineNode('Output', 'End point', 'legacy', { icon: '⬜', ports: ['in'] }),
  manual: defineNode('Manual Trigger', 'Run manually', 'legacy', { icon: '🖱️', ports: ['out'] }),
  webhook: defineNode('Webhook', 'On HTTP request', 'legacy', { icon: '🪝', ports: ['out'] }),
  schedule: defineNode('Schedule', 'On a schedule', 'legacy', { icon: '⏰', ports: ['out'] }),
  form: defineNode('Form', 'On form submit', 'legacy', { icon: '📝', ports: ['out'] }),
  chat: defineNode('Chat', 'On chat message', 'legacy', { icon: '💬', ports: ['out'] }),
  if: defineNode('IF', 'Conditional branch', 'legacy', { icon: '🔀' }),
  switch: defineNode('Switch', 'Route by value', 'legacy', { icon: '🔢' }),
  filter: defineNode('Filter', 'Remove items', 'legacy', { icon: '🧹' }),
  merge: defineNode('Merge', 'Combine branches', 'legacy', { icon: '🔗' }),
  loop: defineNode('Loop', 'Iterate items', 'legacy', { icon: '🔁' }),
  wait: defineNode('Wait', 'Pause execution', 'legacy', { icon: '⏳' }),
  stop: defineNode('Stop', 'End workflow', 'legacy', { icon: '🛑', ports: ['in'] }),
  set: defineNode('Edit Fields', 'Set values', 'legacy', { icon: '✏️' }),
  code: defineNode('Code', 'Run JavaScript', 'legacy', { icon: '💻' }),
  http: defineNode('HTTP Request', 'Call an API', 'legacy', { icon: '🌐' }),
  transform: defineNode('Transform', 'Map data', 'legacy', { icon: '🔧' }),
  email: defineNode('Send Email', 'SMTP / email', 'legacy', { icon: '✉️' }),
  slack: defineNode('Slack', 'Send message', 'legacy', { icon: '#️⃣' }),
  database: defineNode('Database', 'Query SQL', 'legacy', { icon: '🗄️' }),
  sheets: defineNode('Google Sheets', 'Read / write rows', 'legacy', { icon: '📊' }),
  discord: defineNode('Discord', 'Send message', 'legacy', { icon: '🎮' }),
  agent: defineNode('AI Agent', 'LLM agent', 'legacy', { icon: '🤖' }),
  llm: defineNode('LLM Model', 'Chat completion', 'legacy', { icon: '🧠' }),
};

export const NODE_TYPES = {
  ...GENERAL_NODES,
  ...FLOWCHART_NODES,
  ...BPMN_NODES,
  ...UML_NODES,
  ...ERD_NODES,
  ...NETWORK_NODES,
  ...UI_NODES,
  ...LEGACY_NODES,
};
