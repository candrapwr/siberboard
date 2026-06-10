export const NODE_WIDTH = 210;
export const NODE_HEIGHT = 72;
export const MIN_NODE_WIDTH = 80;
export const MIN_NODE_HEIGHT = NODE_HEIGHT;

// Each category drives the accent color of its nodes.
export const NODE_CATEGORIES = [
  { id: 'flowchart',   label: 'Flowchart',    color: '#06b6d4' },
  { id: 'blank',       label: 'Blank',        color: '#64748b' },
  { id: 'trigger',     label: 'Triggers',     color: '#3b82f6' },
  { id: 'flow',        label: 'Flow',         color: '#a855f7' },
  { id: 'data',        label: 'Data & Code',  color: '#22c55e' },
  { id: 'integration', label: 'Integrations', color: '#f97316' },
  { id: 'ai',          label: 'AI',           color: '#ec4899' },
];

// curated icon set for the node editor
export const ICON_CHOICES = [
  '⬜', '▶️', '⏹️', '⚡', '⚙️', '🔀', '🔁', '🧹',
  '🔗', '⏳', '🛑', '✏️', '💻', '🌐', '🔧', '✉️',
  '💬', '🗄️', '📊', '🤖', '🧠', '📦', '🔔', '📁',
  '🏁', '✅', '❌', '⭐', '🔑', '📌', '🎯', '🚀',
];

export const CATEGORY_COLOR = Object.fromEntries(
  NODE_CATEGORIES.map(c => [c.id, c.color])
);

// ports: which connection points a node exposes ('in' = left, 'out' = right)
export const NODE_TYPES = {
  // --- Blank (custom label + icon) ---
  blankInput:  { label: 'Input',  sub: 'Start point',  icon: '⬜', cat: 'blank', ports: ['out'] },
  blankMiddle: { label: 'Node',   sub: 'Middle',       icon: '⬜', cat: 'blank', ports: ['in', 'out'] },
  blankEnd:    { label: 'Output', sub: 'End point',     icon: '⬜', cat: 'blank', ports: ['in'] },

  // --- Triggers (output only) ---
  manual:    { label: 'Manual Trigger', sub: 'Run manually',      icon: '🖱️', cat: 'trigger', ports: ['out'] },
  webhook:   { label: 'Webhook',        sub: 'On HTTP request',    icon: '🪝', cat: 'trigger', ports: ['out'] },
  schedule:  { label: 'Schedule',       sub: 'On a schedule',      icon: '⏰', cat: 'trigger', ports: ['out'] },
  form:      { label: 'Form',           sub: 'On form submit',     icon: '📝', cat: 'trigger', ports: ['out'] },
  chat:      { label: 'Chat',           sub: 'On chat message',    icon: '💬', cat: 'trigger', ports: ['out'] },

  // --- Flow / Logic ---
  if:        { label: 'IF',             sub: 'Conditional branch', icon: '🔀', cat: 'flow', ports: ['in', 'out'] },
  switch:    { label: 'Switch',         sub: 'Route by value',     icon: '🔢', cat: 'flow', ports: ['in', 'out'] },
  filter:    { label: 'Filter',         sub: 'Remove items',       icon: '🧹', cat: 'flow', ports: ['in', 'out'] },
  merge:     { label: 'Merge',          sub: 'Combine branches',   icon: '🔗', cat: 'flow', ports: ['in', 'out'] },
  loop:      { label: 'Loop',           sub: 'Iterate items',      icon: '🔁', cat: 'flow', ports: ['in', 'out'] },
  wait:      { label: 'Wait',           sub: 'Pause execution',    icon: '⏳', cat: 'flow', ports: ['in', 'out'] },
  stop:      { label: 'Stop',           sub: 'End workflow',       icon: '🛑', cat: 'flow', ports: ['in'] },

  // --- Flowchart (classic flowchart shapes) ---
  fcStart:       { label: 'Start',          sub: 'Terminator',         icon: '🟢', cat: 'flowchart', ports: ['out'],        shape: 'terminator' },
  fcEnd:         { label: 'End',            sub: 'Terminator',         icon: '🔴', cat: 'flowchart', ports: ['in'],         shape: 'terminator' },
  fcProcess:     { label: 'Process',        sub: 'Action step',        icon: '🟦', cat: 'flowchart', ports: ['in', 'out'] },
  fcDecision:    { label: 'Decision',       sub: 'Yes / No branch',    icon: '🔷', cat: 'flowchart', ports: ['in', 'out'], shape: 'diamond' },
  fcInputOutput: { label: 'Input / Output', sub: 'Data I/O',           icon: '📨', cat: 'flowchart', ports: ['in', 'out'], shape: 'parallelogram' },
  fcDocument:    { label: 'Document',       sub: 'Printed output',     icon: '📄', cat: 'flowchart', ports: ['in', 'out'], shape: 'document' },
  fcSubroutine:  { label: 'Subroutine',     sub: 'Predefined process', icon: '🧩', cat: 'flowchart', ports: ['in', 'out'], shape: 'subroutine' },
  fcManualInput: { label: 'Manual Input',   sub: 'Keyed entry',        icon: '⌨️', cat: 'flowchart', ports: ['in', 'out'], shape: 'manualInput' },
  fcManualOp:    { label: 'Manual Op',      sub: 'Manual operation',   icon: '✋', cat: 'flowchart', ports: ['in', 'out'], shape: 'manualOp' },
  fcPreparation: { label: 'Preparation',    sub: 'Setup step',         icon: '🔰', cat: 'flowchart', ports: ['in', 'out'], shape: 'hexagon' },
  fcDelay:       { label: 'Delay',          sub: 'Wait / hold',        icon: '🕒', cat: 'flowchart', ports: ['in', 'out'], shape: 'delay' },
  fcDisplay:     { label: 'Display',        sub: 'Show to user',       icon: '🖥️', cat: 'flowchart', ports: ['in', 'out'], shape: 'display' },
  fcDatabase:    { label: 'Stored Data',    sub: 'Database',           icon: '🛢️', cat: 'flowchart', ports: ['in', 'out'], shape: 'cylinder' },
  fcConnector:   { label: 'Connector',      sub: 'On-page link',       icon: '⭕', cat: 'flowchart', ports: ['in', 'out'], shape: 'circle' },
  fcOffPage:     { label: 'Off-page',       sub: 'Off-page link',      icon: '🔖', cat: 'flowchart', ports: ['in', 'out'], shape: 'offpage' },

  // --- Data & Code ---
  set:       { label: 'Edit Fields',    sub: 'Set values',         icon: '✏️', cat: 'data', ports: ['in', 'out'] },
  code:      { label: 'Code',           sub: 'Run JavaScript',     icon: '💻', cat: 'data', ports: ['in', 'out'] },
  http:      { label: 'HTTP Request',   sub: 'Call an API',        icon: '🌐', cat: 'data', ports: ['in', 'out'] },
  transform: { label: 'Transform',      sub: 'Map data',           icon: '🔧', cat: 'data', ports: ['in', 'out'] },

  // --- Integrations ---
  email:     { label: 'Send Email',     sub: 'SMTP / email',       icon: '✉️', cat: 'integration', ports: ['in', 'out'] },
  slack:     { label: 'Slack',          sub: 'Send message',       icon: '#️⃣', cat: 'integration', ports: ['in', 'out'] },
  database:  { label: 'Database',       sub: 'Query SQL',          icon: '🗄️', cat: 'integration', ports: ['in', 'out'] },
  sheets:    { label: 'Google Sheets',  sub: 'Read / write rows',  icon: '📊', cat: 'integration', ports: ['in', 'out'] },
  discord:   { label: 'Discord',        sub: 'Send message',       icon: '🎮', cat: 'integration', ports: ['in', 'out'] },

  // --- AI ---
  agent:     { label: 'AI Agent',       sub: 'LLM agent',          icon: '🤖', cat: 'ai', ports: ['in', 'out'] },
  llm:       { label: 'LLM Model',      sub: 'Chat completion',    icon: '🧠', cat: 'ai', ports: ['in', 'out'] },
};
