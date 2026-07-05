/**
 * Incremental JSON parser for streaming AI responses.
 *
 * SiberBoard asks the model to return a single JSON object:
 *   { "reply": "...", "operations": [ {...}, {...} ] }
 *
 * During streaming we don't want to wait for the whole document before
 * applying changes to the canvas. This parser consumes text deltas and emits:
 *   - replyDelta: partial text of the "reply" string value (already decoded)
 *   - operations: each complete, validated operation object as soon as its
 *     closing brace arrives.
 *
 * It is string-aware (handles escapes, braces inside strings) so it never
 * depends on the whole document being valid JSON.
 */

/**
 * Create a new parser.
 * @param {(op: object) => object|null} validateOp
 *        Callback that takes a freshly parsed operation object and returns the
 *        validated/normalized operation (or null/undefined to drop it).
 */
export function createIncrementalOperationParser(validateOp) {
  return new IncrementalOperationParser(validateOp);
}

class IncrementalOperationParser {
  constructor(validateOp) {
    this.validateOp = typeof validateOp === 'function' ? validateOp : (op) => op;
    this.buffer = '';
    this.consumed = 0; // index up to which buffer has been processed for key search
    this.replyEmitted = 0; // chars of the reply string value already emitted
    this.replyStart = -1; // index where reply value string starts (after opening quote)
    this.replyEnd = -1; // index where reply string ended (closing quote)
    this.replyDone = false;
    this.opsStart = -1; // index of '[' for operations array
    this.opsEnd = -1; // index of ']' for operations array
    this.nextOpScan = -1; // index to start scanning for next op object
    this.done = false;
  }

  /** Feed a text delta. Returns { replyDelta: string, operations: object[] } */
  feed(chunk) {
    this.buffer += chunk;
    const replyDelta = this.extractReplyDelta();
    const operations = this.extractOperations();
    return { replyDelta, operations };
  }

  extractReplyDelta() {
    if (this.replyDone) {
      return this.replyEmitted < this.replyEnd
        ? this.decodeReplySlice(this.replyEmitted, this.replyEnd)
        : '';
    }
    if (this.replyStart === -1) {
      const idx = findJsonKey(this.buffer, 'reply', this.consumed);
      if (idx === -1) {
        return '';
      }
      let i = idx + '"reply"'.length;
      i = skipWhitespace(this.buffer, i);
      if (i >= this.buffer.length) return '';
      if (this.buffer[i] !== ':') {
        this.consumed = Math.max(this.consumed, idx + 1);
        return '';
      }
      i = skipWhitespace(this.buffer, i + 1);
      if (i >= this.buffer.length) return '';
      if (this.buffer[i] !== '"') {
        this.consumed = Math.max(this.consumed, i);
        return '';
      }
      this.replyStart = i + 1;
      this.consumed = i + 1;
      // replyEmitted tracks how far we've emitted *into the reply value*,
      // so initialize it to replyStart (nothing emitted yet).
      this.replyEmitted = this.replyStart;
    }
    const closeIdx = findStringEnd(this.buffer, this.replyStart);
    if (closeIdx === -1) {
      // not closed yet; emit up to a safe point (don't cut inside an escape)
      const safeEnd = safeEmitEnd(this.buffer, this.replyStart);
      const newlyEmitted = safeEnd - this.replyEmitted;
      const slice = newlyEmitted > 0 ? this.decodeReplySlice(this.replyEmitted, safeEnd) : '';
      this.replyEmitted = Math.max(this.replyEmitted, safeEnd);
      return slice;
    }
    this.replyEnd = closeIdx;
    this.replyDone = true;
    const end = Math.max(this.replyEmitted, this.replyEnd);
    const slice = end > this.replyEmitted ? this.decodeReplySlice(this.replyEmitted, end) : '';
    this.replyEmitted = end;
    // Advance consumed past the reply value so subsequent key searches
    // (e.g. for "operations") don't start scanning inside the reply string.
    this.consumed = Math.max(this.consumed, closeIdx + 1);
    return slice;
  }

  decodeReplySlice(start, end) {
    const raw = this.buffer.slice(start, end);
    return decodeJsonStringPartial(raw);
  }

  extractOperations() {
    if (this.done) return [];
    if (this.opsStart === -1) {
      const idx = findJsonKey(this.buffer, 'operations', this.consumed);
      if (idx === -1) return [];
      let i = idx + '"operations"'.length;
      i = skipWhitespace(this.buffer, i);
      if (i >= this.buffer.length) return [];
      if (this.buffer[i] !== ':') {
        this.consumed = Math.max(this.consumed, idx + 1);
        return [];
      }
      i = skipWhitespace(this.buffer, i + 1);
      if (i >= this.buffer.length) return [];
      if (this.buffer[i] !== '[') {
        this.consumed = Math.max(this.consumed, i);
        return [];
      }
      this.opsStart = i;
      this.nextOpScan = i + 1;
    }

    const ops = [];
    let i = this.nextOpScan;
    while (i < this.buffer.length) {
      while (i < this.buffer.length) {
        const c = this.buffer[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',') {
          i++;
        } else {
          break;
        }
      }
      if (i >= this.buffer.length) break;
      if (this.buffer[i] === ']') {
        this.opsEnd = i;
        this.done = true;
        this.nextOpScan = i + 1;
        break;
      }
      if (this.buffer[i] !== '{') {
        i++;
        continue;
      }
      const objEnd = findObjectEnd(this.buffer, i);
      if (objEnd === -1) {
        break; // incomplete; wait for more
      }
      const objText = this.buffer.slice(i, objEnd + 1);
      try {
        const parsed = JSON.parse(objText);
        const validated = this.validateOp(parsed);
        if (validated) ops.push(validated);
      } catch {
        // skip malformed object
      }
      i = objEnd + 1;
    }
    this.nextOpScan = i;
    return ops;
  }
}

function skipWhitespace(s, i) {
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
    else break;
  }
  return i;
}

/** Find the index of `"key"` in s starting from `from`. String-aware. */
function findJsonKey(s, key, from) {
  const needle = `"${key}"`;
  let inString = false;
  let escaped = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      if (s.startsWith(needle, i)) return i;
      inString = true;
    }
  }
  return -1;
}

/** Find closing quote index for a JSON string starting at `start` (start = first char after opening quote). Returns -1 if not closed. */
function findStringEnd(s, start) {
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') return i;
  }
  return -1;
}

/** Find safe end index to emit for a still-growing string (don't cut inside an escape). */
function safeEmitEnd(s, start) {
  let end = s.length;
  if (end > start) {
    let bs = 0;
    let j = end - 1;
    while (j >= start && s[j] === '\\') { bs++; j--; }
    if (bs % 2 === 1) end -= 1;
  }
  return end;
}

/** Decode JSON string content (without surrounding quotes) handling escapes. Strips a trailing partial escape safely. */
export function decodeJsonStringPartial(raw) {
  let s = raw;
  if (s.endsWith('\\') && !s.endsWith('\\\\')) {
    s = s.slice(0, -1);
  }
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    let cut = s.length;
    while (cut > 0) {
      cut--;
      try {
        return JSON.parse(`"${s.slice(0, cut)}"`) + s.slice(cut);
      } catch { /* keep trying */ }
    }
    return s;
  }
}

/** Find the matching closing brace for an object starting at `start` (s[start] === '{'). String-aware. */
export function findObjectEnd(s, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
