/**
 * stream_buffer.js — Per-chat background stream state buffer.
 *
 * Decouples streaming text accumulation from DOM rendering.
 * Allows streams to continue in the background even when the user
 * navigates to another page or chat.
 *
 * Each entry: { text, toolRuns, writtenFiles, active, domEl }
 */

/** @type {Map<string, {text:string, toolRuns:Array, writtenFiles:Array, active:boolean, domEl:HTMLElement|null}>} */
const _buffers = new Map();

export function initBuffer(chatId) {
  _buffers.set(chatId, { text: '', thought: '', toolRuns: [], writtenFiles: [], active: true, domEl: null, startTime: Date.now() });
}

export function getBuffer(chatId) { return _buffers.get(chatId) || null; }

export function isStreamActive(chatId) {
  const b = _buffers.get(chatId);
  return !!(b && b.active);
}

export function anyStreamActive() {
  for (const [, b] of _buffers) { if (b.active) return true; }
  return false;
}

export function getActiveStreamChatIds() {
  const ids = [];
  for (const [id, b] of _buffers) { if (b.active) ids.push(id); }
  return ids;
}

export function appendText(chatId, chunk) {
  const b = _buffers.get(chatId);
  if (b) b.text += chunk;
}

export function appendThought(chatId, chunk) {
  const b = _buffers.get(chatId);
  if (b) b.thought = (b.thought || '') + chunk;
}

export function setText(chatId, text) {
  const b = _buffers.get(chatId);
  if (b) b.text = text;
}

export function pushToolRun(chatId, toolRun) {
  const b = _buffers.get(chatId);
  if (b) b.toolRuns.push(toolRun);
}

export function pushToolLog(chatId, logLine) {
  const b = _buffers.get(chatId);
  if (b && b.toolRuns && b.toolRuns.length > 0) {
    const lastRun = b.toolRuns[b.toolRuns.length - 1];
    if (!lastRun.logs) lastRun.logs = [];
    lastRun.logs.push(logLine);
  }
}

export function pushWrittenFile(chatId, filePath) {
  const b = _buffers.get(chatId);
  if (b) b.writtenFiles.push(filePath);
}

export function attachDomEl(chatId, el) {
  const b = _buffers.get(chatId);
  if (b) b.domEl = el;
}

export function detachDomEl(chatId) {
  const b = _buffers.get(chatId);
  if (b) b.domEl = null;
}

export function markDone(chatId) {
  const b = _buffers.get(chatId);
  if (b) b.active = false;
}

export function clearBuffer(chatId) { _buffers.delete(chatId); }

export function getDomEl(chatId) { return _buffers.get(chatId)?.domEl || null; }
