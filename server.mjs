import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODE_TYPES } from './src/constants.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

try {
  const envRaw = await readFile(join(__dirname, '.env'), 'utf8');
  for (const line of envRaw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env is optional in local development.
}

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8000);
const USE_DIST_ROOT = process.env.STATIC_DIR === 'dist';
const ROOT_DIR = USE_DIST_ROOT ? join(__dirname, 'dist') : __dirname;
const AI_LOGIN_USERNAME = process.env.AI_LOGIN_USERNAME || '';
const AI_LOGIN_PASSWORD = process.env.AI_LOGIN_PASSWORD || '';
const SESSION_COOKIE = 'siberboard_ai_session';
const sessions = new Map();

const PROVIDERS = {
  deepseek: {
    label: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    defaultModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  openai: {
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: process.env.OPENAI_MODEL || 'gpt-5.4-nano',
  },
  grok: {
    label: 'Grok',
    envKey: 'GROK_API_KEY',
    baseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
    defaultModel: process.env.GROK_MODEL || 'grok-3-mini',
  },
};

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const nodeTypeSummary = Object.entries(NODE_TYPES)
  .map(([key, info]) => `${key}: ${info.label} | ${info.sub} | ports=${info.ports.join(',')} | category=${info.cat}`)
  .join('\n');
const PORT_SIDES = new Set(['left', 'right', 'top', 'bottom']);
const LAYOUT_ORIENTATIONS = new Set(['horizontal', 'vertical']);
const CONNECTOR_TYPES = new Set(['orthogonal', 'curved']);
const EDGE_MARKERS = new Set(['none', 'arrow']);

function inferFallbackBlankNodeType(op) {
  const text = `${typeof op?.label === 'string' ? op.label : ''} ${typeof op?.sub === 'string' ? op.sub : ''}`
    .trim()
    .toLowerCase();

  if (/(^|\b)(start|input|source|entry|incoming|visitor|user request|request masuk)(\b|$)/.test(text)) {
    return 'blankInput';
  }
  if (/(^|\b)(end|output|result|finish|done|selesai|tujuan|response|html document)(\b|$)/.test(text)) {
    return 'blankEnd';
  }
  return 'blankMiddle';
}

function normalizeIcon(value, nodeType) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const compact = Array.from(trimmed).slice(0, 3).join('');
  const hasEmojiLike = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|[#*0-9]\uFE0F?\u20E3/u.test(compact);
  if (!hasEmojiLike) return NODE_TYPES[nodeType]?.icon;
  return compact;
}

const systemPrompt = `You are the AI assistant for SiberBoard, a browser workflow and flowchart builder.
You help users in two ways:
1. Explain how to create or edit a workflow using SiberBoard's node system.
2. Generate workflow operations that the UI can apply automatically.

You MUST reply with valid JSON only. Do not wrap JSON in markdown fences.

The response schema is:
{
  "reply": "short natural-language assistant reply in Indonesian or the user's language",
  "operations": [
    {
      "type": "create_node",
      "ref": "n1",
      "nodeType": "uiInput",
      "label": "Pesan Masuk",
      "sub": "Pelanggan kirim pesan",
      "icon": "",
      "x": 120,
      "y": 220,
      "width": 210,
      "height": 72
    },
    {
      "type": "create_edge",
      "fromRef": "n1",
      "toRef": "n2",
      "fromNodeId": 1,
      "toNodeId": 2,
      "fromMatchLabel": "Pesan Masuk",
      "toMatchLabel": "Analisa Maksud",
      "fromSide": "bottom",
      "toSide": "top",
      "connector": "orthogonal",
      "startMarker": "none",
      "endMarker": "arrow",
      "label": "Ya"
    },
    {
      "type": "update_node",
      "nodeId": 4,
      "matchLabel": "Analisa Maksud",
      "nodeType": "umlClass",
      "label": "Analisis Intent",
      "sub": "AI membaca isi chat",
      "icon": "",
      "x": 360,
      "y": 300,
      "width": 220,
      "height": 90
    },
    {
      "type": "delete_node",
      "nodeId": 7,
      "matchLabel": "Node Lama"
    },
    {
      "type": "update_edge",
      "fromNodeId": 1,
      "toNodeId": 2,
      "fromMatchLabel": "Pesan Masuk",
      "toMatchLabel": "Analisa Maksud",
      "fromSide": "right",
      "toSide": "left",
      "connector": "orthogonal",
      "startMarker": "none",
      "endMarker": "arrow",
      "label": "Masuk"
    },
    {
      "type": "delete_edge",
      "fromNodeId": 1,
      "toNodeId": 2,
      "fromMatchLabel": "Pesan Masuk",
      "toMatchLabel": "Analisa Maksud"
    },
    {
      "type": "auto_layout",
      "orientation": "vertical"
    }
  ]
}

Rules:
- Return only JSON.
- If the user only asks for explanation, keep "operations" as an empty array.
- Use only valid nodeType values from the list below.
- For flowcharts, prefer top-to-bottom layouts unless the user explicitly asks for horizontal.
- For general workflow graphs, horizontal or vertical is allowed, but keep the structure readable.
- Prefer orthogonal connectors by default unless the user explicitly asks for curved lines.
- If the user provides an image or asks to make a diagram similar to a reference image, prioritize matching the visual composition and relative placement from the image.
- For image-based reproduction, place nodes explicitly with x/y coordinates that preserve left/right/up/down relationships from the reference.
- For image-based reproduction, do NOT add auto_layout unless the user explicitly asks to tidy, align, or relayout the result.
- For flowchart nodes, icon can be empty.
- Never invent node types.
- If a desired node does not exist in the available list, use a blank fallback node instead: blankInput, blankMiddle, or blankEnd.
- When using a blank fallback node, choose the icon yourself so it matches the referenced concept as closely as possible.
- Icons must be emoji or very short emoji-like symbols, not words or long text.
- Prefer a single emoji. If a node should not display an icon, use an empty string.
- For existing nodes on the canvas, prefer using nodeId from the current canvas state.
- To replace a node with another node kind while keeping its connections, use update_node with nodeType instead of delete_node + create_node.
- You may also include matchLabel as a fallback when updating or deleting existing nodes.
- For existing edges on the canvas, prefer fromNodeId/toNodeId from the current canvas state.
- For connecting existing nodes, create_edge may use fromNodeId/toNodeId or fromMatchLabel/toMatchLabel.
- Valid port sides are: left, right, top, bottom.
- Valid connector types are: orthogonal, curved.
- Valid edge markers are: none, arrow.
- Use fromSide/toSide when you want cleaner routing, for example vertical flows can use bottom -> top.
- If you create or update an edge and the user did not specify the connector style, use connector: "orthogonal".
- For most directed flows, prefer endMarker: "arrow". Use startMarker only when it is semantically needed.
- If the user asks to tidy, align, reduce crossing lines, or switch orientation, you may add an auto_layout operation.
- Valid auto_layout orientations are: horizontal, vertical.
- Keep reply concise.

Available node types:
${nodeTypeSummary}`;

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendJsonWithHeaders(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function sanitizePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = normalize(clean).replace(/^(\.\.[/\\])+/, '');
  return normalized === '/' ? '/index.html' : normalized;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  return session;
}

function requireAuth(req, res) {
  const session = getAuthenticatedUser(req);
  if (!session) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  return session;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function stripJsonFences(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function normalizeSide(value, fallback) {
  return PORT_SIDES.has(value) ? value : fallback;
}

function normalizeOrientation(value, fallback = 'vertical') {
  return LAYOUT_ORIENTATIONS.has(value) ? value : fallback;
}

function normalizeConnector(value, fallback = 'orthogonal') {
  return CONNECTOR_TYPES.has(value) ? value : fallback;
}

function normalizeEdgeMarker(value, fallback = 'none') {
  return EDGE_MARKERS.has(value) ? value : fallback;
}

function extractJsonCandidate(text) {
  const cleaned = stripJsonFences(text).trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.slice(start, end + 1);
  }
  return cleaned;
}

function extractResponsesText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const item of data?.output || []) {
    if (typeof item?.content === 'string' && item.content.trim()) {
      chunks.push(item.content.trim());
      continue;
    }
    for (const part of item?.content || []) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        chunks.push(part.text.trim());
        continue;
      }
      if (typeof part?.content === 'string' && part.content.trim()) {
        chunks.push(part.content.trim());
      }
    }
  }

  return chunks.join('\n').trim();
}

function parseAssistantPayloadFromText(text) {
  const candidate = extractJsonCandidate(text);
  try {
    return validateAiResponse(JSON.parse(candidate));
  } catch {
    return validateAiResponse({
      reply: text.trim(),
      operations: [],
    });
  }
}

function validateAiResponse(payload) {
  const reply = typeof payload?.reply === 'string' ? payload.reply : '';
  const operations = Array.isArray(payload?.operations) ? payload.operations : [];
  const validOps = [];

  for (const op of operations) {
    if (!op || typeof op !== 'object' || typeof op.type !== 'string') continue;

    if (op.type === 'create_node') {
      const nodeType = NODE_TYPES[op.nodeType]
        ? op.nodeType
        : inferFallbackBlankNodeType(op);
      validOps.push({
        type: 'create_node',
        ref: typeof op.ref === 'string' && op.ref.trim() ? op.ref.trim() : `node_${validOps.length + 1}`,
        nodeType,
        label: typeof op.label === 'string' ? op.label : undefined,
        sub: typeof op.sub === 'string' ? op.sub : undefined,
        icon: normalizeIcon(op.icon, nodeType),
        x: Number.isFinite(op.x) ? op.x : 0,
        y: Number.isFinite(op.y) ? op.y : 0,
        width: Number.isFinite(op.width) ? op.width : undefined,
        height: Number.isFinite(op.height) ? op.height : undefined,
      });
      continue;
    }

    if (op.type === 'create_edge') {
      const hasRefs = typeof op.fromRef === 'string' && typeof op.toRef === 'string';
      const hasIds = Number.isFinite(op.fromNodeId) && Number.isFinite(op.toNodeId);
      const hasLabels = typeof op.fromMatchLabel === 'string' && op.fromMatchLabel.trim()
        && typeof op.toMatchLabel === 'string' && op.toMatchLabel.trim();
      if (!hasRefs && !hasIds && !hasLabels) continue;
      validOps.push({
        type: 'create_edge',
        fromRef: typeof op.fromRef === 'string' ? op.fromRef : undefined,
        toRef: typeof op.toRef === 'string' ? op.toRef : undefined,
        fromNodeId: Number.isFinite(op.fromNodeId) ? op.fromNodeId : undefined,
        toNodeId: Number.isFinite(op.toNodeId) ? op.toNodeId : undefined,
        fromMatchLabel: typeof op.fromMatchLabel === 'string' ? op.fromMatchLabel.trim() : undefined,
        toMatchLabel: typeof op.toMatchLabel === 'string' ? op.toMatchLabel.trim() : undefined,
        fromSide: normalizeSide(op.fromSide, 'right'),
        toSide: normalizeSide(op.toSide, 'left'),
        connector: normalizeConnector(op.connector, 'orthogonal'),
        startMarker: normalizeEdgeMarker(op.startMarker, 'none'),
        endMarker: normalizeEdgeMarker(op.endMarker, 'none'),
        label: typeof op.label === 'string' ? op.label : '',
      });
      continue;
    }

    if (op.type === 'update_node') {
      if (!Number.isFinite(op.nodeId) && !(typeof op.matchLabel === 'string' && op.matchLabel.trim())) continue;
      const nodeType = typeof op.nodeType === 'string'
        ? (NODE_TYPES[op.nodeType] ? op.nodeType : inferFallbackBlankNodeType(op))
        : undefined;
      validOps.push({
        type: 'update_node',
        nodeId: Number.isFinite(op.nodeId) ? op.nodeId : undefined,
        matchLabel: typeof op.matchLabel === 'string' ? op.matchLabel.trim() : undefined,
        nodeType,
        label: typeof op.label === 'string' ? op.label : undefined,
        sub: typeof op.sub === 'string' ? op.sub : undefined,
        icon: normalizeIcon(op.icon, nodeType || (Number.isFinite(op.nodeId) ? undefined : 'blankMiddle')),
        x: Number.isFinite(op.x) ? op.x : undefined,
        y: Number.isFinite(op.y) ? op.y : undefined,
        width: Number.isFinite(op.width) ? op.width : undefined,
        height: Number.isFinite(op.height) ? op.height : undefined,
      });
      continue;
    }

    if (op.type === 'delete_node') {
      if (!Number.isFinite(op.nodeId) && !(typeof op.matchLabel === 'string' && op.matchLabel.trim())) continue;
      validOps.push({
        type: 'delete_node',
        nodeId: Number.isFinite(op.nodeId) ? op.nodeId : undefined,
        matchLabel: typeof op.matchLabel === 'string' ? op.matchLabel.trim() : undefined,
      });
      continue;
    }

    if (op.type === 'update_edge' || op.type === 'delete_edge') {
      const hasIds = Number.isFinite(op.fromNodeId) && Number.isFinite(op.toNodeId);
      const hasLabels = typeof op.fromMatchLabel === 'string' && op.fromMatchLabel.trim()
        && typeof op.toMatchLabel === 'string' && op.toMatchLabel.trim();
      if (!hasIds && !hasLabels) continue;
      validOps.push({
        type: op.type,
        fromNodeId: Number.isFinite(op.fromNodeId) ? op.fromNodeId : undefined,
        toNodeId: Number.isFinite(op.toNodeId) ? op.toNodeId : undefined,
        fromMatchLabel: typeof op.fromMatchLabel === 'string' ? op.fromMatchLabel.trim() : undefined,
        toMatchLabel: typeof op.toMatchLabel === 'string' ? op.toMatchLabel.trim() : undefined,
        fromSide: normalizeSide(op.fromSide, 'right'),
        toSide: normalizeSide(op.toSide, 'left'),
        connector: normalizeConnector(op.connector, 'orthogonal'),
        startMarker: normalizeEdgeMarker(op.startMarker, 'none'),
        endMarker: normalizeEdgeMarker(op.endMarker, 'none'),
        label: typeof op.label === 'string' ? op.label : undefined,
      });
      continue;
    }

    if (op.type === 'auto_layout') {
      validOps.push({
        type: 'auto_layout',
        orientation: normalizeOrientation(op.orientation, 'vertical'),
      });
    }
  }

  return { reply, operations: validOps };
}

async function callProvider({ providerName, model, messages, imageDataUrl }) {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unsupported provider: ${providerName}`);
  }

  const apiKey = process.env[provider.envKey];
  if (!apiKey) {
    throw new Error(`Missing ${provider.envKey} in server environment`);
  }

  if (providerName === 'grok' && imageDataUrl) {
    const requestedModel = model || provider.defaultModel;
    const imageCapableModel = requestedModel.startsWith('grok-3-mini') ? 'grok-4.3' : requestedModel;
    const systemMessage = messages.find(message => message.role === 'system')?.content || '';
    const userMessage = messages.findLast(message => message.role === 'user')?.content || '';

    const response = await fetch(`${provider.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: imageCapableModel,
        store: false,
        input: [
          { role: 'system', content: systemMessage },
          {
            role: 'user',
            content: [
              {
                type: 'input_image',
                image_url: imageDataUrl,
                detail: 'high',
              },
              {
                type: 'input_text',
                text: userMessage,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${provider.label} API error ${response.status}: ${detail}`);
    }

    const data = await response.json();
    const content = extractResponsesText(data);
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Model returned empty content');
    }

    return {
      usage: data?.usage ?? null,
      resolvedModel: imageCapableModel,
      parsed: parseAssistantPayloadFromText(content),
    };
  }

  if (providerName === 'openai') {
    const requestedModel = model || provider.defaultModel;
    const systemMessage = messages.find(message => message.role === 'system')?.content || '';
    const userMessage = messages.findLast(message => message.role === 'user')?.content || '';
    const userContent = [
      { type: 'input_text', text: userMessage },
    ];

    if (imageDataUrl) {
      userContent.unshift({
        type: 'input_image',
        image_url: imageDataUrl,
        detail: 'high',
      });
    }

    const response = await fetch(`${provider.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: requestedModel,
        store: false,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: systemMessage,
              },
            ],
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${provider.label} API error ${response.status}: ${detail}`);
    }

    const data = await response.json();
    const content = extractResponsesText(data);
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Model returned empty content');
    }

    return {
      usage: data?.usage ?? null,
      resolvedModel: requestedModel,
      parsed: parseAssistantPayloadFromText(content),
    };
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || provider.defaultModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${provider.label} API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Model returned empty content');
  }

  return {
    usage: data?.usage ?? null,
    resolvedModel: model || provider.defaultModel,
    parsed: parseAssistantPayloadFromText(content),
  };
}

function buildUserPrompt({ prompt, workflowName, state, imageDataUrl }) {
  const sections = [
    `Workflow name: ${workflowName || 'Untitled board'}`,
    `Current canvas state JSON: ${JSON.stringify(state || { nodes: [], edges: [] })}`,
  ];

  if (imageDataUrl) {
    sections.push(
      'Reference image is attached. Recreate the diagram structure and relative layout from the image as closely as possible using explicit x/y positions. Do not collapse everything into a single vertical stack. Do not add auto_layout unless the user explicitly asks for it.'
    );
  }

  sections.push(`User request: ${prompt}`);

  return sections.join('\n\n');
}

async function handleAiProviders(req, res) {
  sendJson(res, 200, {
    providers: Object.fromEntries(
      Object.entries(PROVIDERS).map(([key, provider]) => [
        key,
        {
          label: provider.label,
          defaultModel: provider.defaultModel,
          supportsImage: key === 'grok' || key === 'openai',
        },
      ])
    ),
  });
}

async function handleAiChat(req, res) {
  try {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
      sendJson(res, 400, { error: 'Prompt is required.' });
      return;
    }

    const providerName = body.provider === 'grok'
      ? 'grok'
      : body.provider === 'openai'
        ? 'openai'
        : 'deepseek';
    const result = await callProvider({
      providerName,
      model: typeof body.model === 'string' ? body.model.trim() : '',
      imageDataUrl: (providerName === 'grok' || providerName === 'openai') && typeof body.imageDataUrl === 'string'
        ? body.imageDataUrl
        : '',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildUserPrompt(body) },
      ],
    });

    sendJson(res, 200, {
      provider: providerName,
      model: result.resolvedModel || body.model || PROVIDERS[providerName].defaultModel,
      reply: result.parsed.reply,
      operations: result.parsed.operations,
      usage: result.usage,
    });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unknown AI server error',
    });
  }
}

async function handleAuthStatus(req, res) {
  const session = getAuthenticatedUser(req);
  sendJson(res, 200, {
    authenticated: !!session,
    username: session?.username ?? null,
    configured: Boolean(AI_LOGIN_USERNAME && AI_LOGIN_PASSWORD),
  });
}

async function handleAuthLogin(req, res) {
  try {
    if (!AI_LOGIN_USERNAME || !AI_LOGIN_PASSWORD) {
      sendJson(res, 500, { error: 'AI login credentials are not configured on the server.' });
      return;
    }
    const body = await readBody(req);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (username !== AI_LOGIN_USERNAME || password !== AI_LOGIN_PASSWORD) {
      sendJson(res, 401, { error: 'Username atau password salah.' });
      return;
    }

    const token = randomUUID();
    sessions.set(token, {
      username,
      createdAt: Date.now(),
    });

    sendJsonWithHeaders(
      res,
      200,
      { authenticated: true, username },
      {
        'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`,
      },
    );
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Login failed',
    });
  }
}

async function handleAuthLogout(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  sendJsonWithHeaders(
    res,
    200,
    { authenticated: false },
    {
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    },
  );
}

async function serveStatic(req, res) {
  const filePath = sanitizePath(req.url || '/');
  const resolved = join(ROOT_DIR, filePath);

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    const type = MIME_TYPES[extname(resolved)] || 'application/octet-stream';
    const extension = extname(resolved);
    const isHtml = extension === '.html';
    const isDevAsset = !USE_DIST_ROOT && ['.js', '.mjs', '.css', '.json', '.html'].includes(extension);
    const cacheControl = isHtml
      ? 'no-cache, no-store, must-revalidate'
      : isDevAsset
        ? 'no-cache, no-store, must-revalidate'
        : USE_DIST_ROOT && ['.js', '.css', '.png', '.svg', '.ico'].includes(extension)
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=300';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': cacheControl,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(resolved).pipe(res);
  } catch {
    if (filePath !== '/index.html') {
      serveFallbackIndex(res);
      return;
    }
    sendJson(res, 404, { error: 'Not found' });
  }
}

async function serveFallbackIndex(res) {
  const indexPath = join(ROOT_DIR, 'index.html');
  try {
    const html = await readFile(indexPath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(html);
  } catch {
    sendJson(res, 404, { error: 'index.html not found' });
  }
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: 'Invalid request' });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/ai/chat') {
    await handleAiChat(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/ai/providers') {
    await handleAiProviders(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/auth/status') {
    await handleAuthStatus(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth/login') {
    await handleAuthLogin(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth/logout') {
    await handleAuthLogout(req, res);
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    await serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(`SiberBoard server running at http://${HOST}:${PORT}`);
  console.log(`Static root: ${ROOT_DIR}`);
});
