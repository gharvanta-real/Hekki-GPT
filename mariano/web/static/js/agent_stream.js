/**
 * agent_stream.js — Main Stream Event Dispatcher & Message Lifecycle Orchestrator.
 * Uses per-chat stream buffers so responses continue in background on page/chat switch.
 */

import { scrollChat, escapeHtml, ChatSessionManager } from './chat.js';
import { createVoiceSummaryGenCard } from './chat/voice_summary_card.js';
import { sanitizeHtml, playReminderChime, stripPlannerMetadata } from './stream/stream_utils.js';
import { renderParsedMessage, appendThoughtChunk, finalizeStreamThought } from './stream/stream_thought.js';
import {
  ensureToolContainer, renderToolCallCard, handleToolLog, handleToolResult,
  finalizeToolContainer, getFriendlyToolActionText, updateDynamicHeaderTitle
} from './stream/stream_tools.js';
import { attachAiActions } from './stream/stream_actions.js';
import { isAiderActive, setAiderActive, handleAiderChunk, finalizeAiderConsole } from './stream/stream_aider.js';
import { showQuestionCard, hideQuestionCard, initQuestionCard } from './chat/question_card.js';
import {
  initBuffer, getBuffer, isStreamActive, anyStreamActive, getActiveStreamChatIds,
  appendText, appendThought, setText, pushToolRun, pushToolLog, pushWrittenFile, attachDomEl,
  detachDomEl, markDone, clearBuffer, getDomEl
} from './stream/stream_buffer.js';

const appendHudLog = window.__HEKKI_DEBUG__ ? (msg) => console.log('[HUD LOG]', msg) : () => {};

// Track the chatId that is currently streaming
let _streamingChatId = null;

// ─── Per-chat generating state (Set of chatIds currently generating) ──────────
if (!window._generatingChats) window._generatingChats = new Set();

export function setGeneratingState(isGen, chatId) {
  const cid = chatId || _streamingChatId || ChatSessionManager?.getActiveChatId?.() || null;
  if (!cid) {
    // Fallback: legacy global flag
    window.isGenerating = !!isGen;
    if (window._syncGeneratingState) window._syncGeneratingState(!!isGen);
    return;
  }
  if (isGen) {
    window._generatingChats.add(cid);
  } else {
    window._generatingChats.delete(cid);
  }
  // Keep legacy flag in sync with active chat
  const activeCid = ChatSessionManager?.getActiveChatId?.();
  window.isGenerating = activeCid ? window._generatingChats.has(activeCid) : window._generatingChats.size > 0;
  if (window._syncGeneratingState) window._syncGeneratingState(window.isGenerating);
}

/** True if the CURRENT active chat is generating */
export function isCurrentChatGenerating() {
  const activeCid = ChatSessionManager?.getActiveChatId?.();
  if (!activeCid) return window.isGenerating || false;
  return window._generatingChats.has(activeCid);
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────
function _getCol() {
  return document.getElementById('chat-col') || document.getElementById('chat-log');
}

function _ensureResponseMsg(chatId, enterConversationCallback) {
  let domEl = getDomEl(chatId);
  if (domEl && domEl.isConnected) return domEl;
  // Create new DOM element for this stream
  enterConversationCallback();
  const col = _getCol();
  if (!col) return null;
  domEl = document.createElement('div');
  domEl.className = 'msg ai';
  domEl.dataset.streamChatId = chatId;
  col.appendChild(domEl);
  attachDomEl(chatId, domEl);
  return domEl;
}

// ─── Finalization ─────────────────────────────────────────────────────────────
function _finalizeStreamResponse(chatId) {
  const buf = getBuffer(chatId);
  if (!buf) return;

  const domEl = getDomEl(chatId);
  if (domEl && domEl.isConnected) {
    attachAiActions(domEl, buf.text, buf.toolRuns);
  }
  const durationSec = Math.max(1, Math.round(((Date.now() - (buf.startTime || Date.now())) / 1000)) || ((buf.toolRuns?.length || 1) * 2));
  const metadata = {
    tool_runs: buf.toolRuns || [],
    written_files: buf.writtenFiles || [],
    thought: buf.thought || '',
    duration_sec: durationSec
  };
  ChatSessionManager.appendMessage('assistant', buf.text, metadata);

  // Mark "new response" if user is NOT on this chat right now
  const activeCid = ChatSessionManager?.getActiveChatId?.();
  if (activeCid !== chatId) {
    const chats = ChatSessionManager.getChats();
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      chat.hasNewResponse = true;
      ChatSessionManager.saveChats(chats);
      ChatSessionManager.renderChatsList();
    }
  }

  // Inject Canvas Preview Pills for Written Files
  if (buf.writtenFiles.length > 0) {
    const col = _getCol();
    if (col) {
      const previewRow = document.createElement('div');
      previewRow.className = 'doc-preview-pills-row';
      previewRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 4px 0;padding:0;align-items:center;';
      buf.writtenFiles.forEach(filePath => {
        const fileName = filePath.replace(/\\/g, '/').split('/').pop();
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const pill = document.createElement('button');
        pill.className = 'doc-canvas-pill';
        pill.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--radius-pill,9999px);background:var(--hover);border:none!important;color:var(--text-secondary);font-size:12px;font-family:var(--font);font-weight:500;cursor:pointer;transition:all 0.12s;';
        pill.title = `Open in Live Canvas: ${filePath}`;
        pill.innerHTML = `<i data-lucide="file-code" style="width:13px;height:13px;flex-shrink:0;"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${escapeHtml(fileName)}</span>`;
        pill.addEventListener('click', async () => {
          if (window.liveCanvas) {
            try {
              const res = await fetch(`/api/workspace/render?path=${encodeURIComponent(filePath.replace(/\\/g, '/'))}`);
              const content = res.ok ? await res.text() : '';
              window.liveCanvas.openArtifact({ code: content, language: ext, title: fileName, filepath: filePath });
            } catch {
              window.liveCanvas.openArtifact({ code: '', language: ext, title: fileName, filepath: filePath });
            }
          }
        });
        previewRow.appendChild(pill);
      });
      col.appendChild(previewRow);
      if (window.lucide) lucide.createIcons({ parent: previewRow });
    }
  }

  clearBuffer(chatId);
  if (_streamingChatId === chatId) _streamingChatId = null;
}

// ─── Freeze / Thaw (called by router on page switch) ─────────────────────────
/**
 * Freeze: user navigated away from chat. Detach DOM reference but keep buffer alive.
 * @param {string} chatId
 */
export function freezeActiveStream(chatId) {
  if (chatId && isStreamActive(chatId)) {
    detachDomEl(chatId);
  }
}

/**
 * Thaw: user navigated back to chat. Reconstruct DOM element from buffer.
 * @param {string} chatId
 * @param {Function} enterConversationCallback
 */
export function thawActiveStream(chatId, enterConversationCallback) {
  if (!chatId || !isStreamActive(chatId)) return false;
  const buf = getBuffer(chatId);
  if (!buf) return false;

  const col = _getCol();
  if (!col) return false;

  // Re-create DOM element and re-render buffered text
  let domEl = col.querySelector(`[data-stream-chat-id="${chatId}"]`);
  if (!domEl) {
    domEl = document.createElement('div');
    domEl.className = 'msg ai';
    domEl.dataset.streamChatId = chatId;
    col.appendChild(domEl);
  }
  attachDomEl(chatId, domEl);
  if (buf.text) {
    renderParsedMessage(domEl, buf.text);
  }
  if (enterConversationCallback) enterConversationCallback();
  scrollChat();
  return true;
}

// ─── Main Event Handler ───────────────────────────────────────────────────────
export function handleChatAgentEvent(e, enterConversationCallback) {
  try {
    const col = _getCol();
    if (!col) return;

    // Determine chatId for this stream event
    const activeCid = ChatSessionManager?.getActiveChatId?.() || null;

    // On first non-done event: initialize buffer for this chat
    if (e.kind !== 'done' && e.kind !== 'error') {
      if (!_streamingChatId) {
        _streamingChatId = activeCid;
        if (_streamingChatId) {
          initBuffer(_streamingChatId);
          window._firstResponseChunkProcessed = false;
          setGeneratingState(true, _streamingChatId);
        }
      }
    }

    const cid = _streamingChatId;
    // Is the user currently viewing this chat?
    const isVisible = (activeCid === cid);

    switch (e.kind) {
    case 'reminder_trigger': {
      const text = e.data || 'Reminder Notification';
      playReminderChime();
      if (window.showToast) window.showToast('⏰ Reminder Alert', text, 8000);
      if (isVisible) {
        const alertEl = document.createElement('div');
        alertEl.className = 'chat-msg-row ai-msg';
        alertEl.innerHTML = `
          <div class="msg-bubble ai-bubble" style="border: none !important; background: var(--input-bg) !important; padding: 10px 14px; border-radius: 10px; margin-top: 10px;">
            <div style="display:flex;align-items:center;gap:8px;font-weight:600;color:var(--text-primary);margin-bottom:4px;"><span>⏰ REMINDER ALERT</span></div>
            <div style="font-size:13px;color:var(--text);">${escapeHtml(text)}</div>
          </div>
        `;
        col.appendChild(alertEl);
        scrollChat();
      }
      break;
    }

    case 'thinking': {
      if (isVisible) {
        enterConversationCallback();
        if (e.data && e.data.includes('Aider')) setAiderActive(true);
        appendHudLog(`[INFO] ${e.data}`);
        col.querySelectorAll('.chat-ai-stream-header').forEach(el => el.remove());
        const headerEl = document.createElement('div');
        headerEl.className = 'cad-ai-stream-header chat-ai-stream-header';
        headerEl.style.marginTop = '16px';
        headerEl.style.marginBottom = '6px';
        headerEl.innerHTML = `
          <div class="cad-ai-dot-grid" aria-hidden="true">
            <span style="--d:0"></span><span style="--d:1"></span><span style="--d:2"></span><span style="--d:3"></span>
            <span style="--d:1"></span><span style="--d:2"></span><span style="--d:3"></span><span style="--d:4"></span>
            <span style="--d:2"></span><span style="--d:3"></span><span style="--d:4"></span><span style="--d:5"></span>
            <span style="--d:3"></span><span style="--d:4"></span><span style="--d:5"></span><span style="--d:6"></span>
          </div>
          <span class="cad-ai-header-title">Thinking...</span>
        `;
        col.appendChild(headerEl);
        scrollChat();
      }
      break;
    }

    case 'thought': {
      if (cid) appendThought(cid, e.data || '');
      if (isVisible) {
        appendThoughtChunk(e.data || '', col, enterConversationCallback);
        scrollChat();
      }
      break;
    }

    case 'response_chunk':
    case 'text': {
      if (cid) appendText(cid, e.data || '');
      if (isVisible) {
        if (!window._firstResponseChunkProcessed) {
          col.querySelectorAll('.think-label-temp').forEach(el => el.remove());
          col.querySelector('.chat-ai-stream-header #chat-stream-typing-dots')?.remove();
          window._firstResponseChunkProcessed = true;
        }
        if (isAiderActive()) {
          handleAiderChunk(e.data || '', col, enterConversationCallback);
        } else {
          const domEl = _ensureResponseMsg(cid, enterConversationCallback);
          updateDynamicHeaderTitle(col, 'Writing response...');
          if (domEl) renderParsedMessage(domEl, getBuffer(cid)?.text || '');
        }
        scrollChat();
      }
      break;
    }

    case 'tool_call': {
      if (isVisible) {
        enterConversationCallback();
        const toolName = e.data || e.metadata?.tool || 'action';
        const actionText = getFriendlyToolActionText(toolName);
        updateDynamicHeaderTitle(col, actionText);
        appendHudLog(`[EXEC] ${toolName} args: ${JSON.stringify(e.metadata?.args || {})}`);
      }
      const args = e.metadata?.args || {};
      const targetPath = args.TargetFile || args.target_file || args.file_path || args.filePath || args.path || args.file || '';
      if (targetPath && cid && (e.data === 'write_to_file' || (e.data || '').includes('write'))) {
        pushWrittenFile(cid, targetPath);
      }
      if (isVisible) {
        renderToolCallCard(e, col, enterConversationCallback, getBuffer(cid)?.toolRuns || []);
        const toolName = e.data || e.metadata?.tool || '';
        if (toolName === 'audio_summary' || toolName === 'voice_summary') {
          document.getElementById('active-voice-summary-gen-card')?.remove();
          const vsCard = createVoiceSummaryGenCard('Scanning & extracting context...');
          vsCard.id = 'active-voice-summary-gen-card';
          col.appendChild(vsCard);
          scrollChat();
        }
      }
      break;
    }

    case 'tool_log': {
      if (cid) pushToolLog(cid, e.data || '');
      if (isVisible) handleToolLog(e.data || '', getBuffer(cid)?.toolRuns);
      break;
    }

    case 'tool_result': {
      const toolRuns = getBuffer(cid)?.toolRuns;
      if (toolRuns) handleToolResult(e, toolRuns);
      break;
    }

    case 'done': {
      if (isAiderActive()) {
        if (isVisible) finalizeAiderConsole(true);
      } else {
        if (cid) {
          const buf = getBuffer(cid);
          if (buf) {
            if (e.data && e.data.trim()) setText(cid, e.data);
            const domEl = getDomEl(cid);
            if (isVisible && domEl) {
              renderParsedMessage(domEl, buf.text);
            } else if (isVisible && buf.text) {
              // No domEl yet but we have text — create it
              const summaryEl = document.createElement('div');
              summaryEl.className = 'msg ai';
              renderParsedMessage(summaryEl, buf.text);
              col.appendChild(summaryEl);
              attachDomEl(cid, summaryEl);
              scrollChat();
            }
          }
          markDone(cid);
          _finalizeStreamResponse(cid);
        }
      }

      if (isVisible) {
        finalizeStreamThought();
        finalizeToolContainer(true);
        col.querySelectorAll('.chat-ai-stream-header, .cad-ai-stream-header').forEach(el => el.remove());
        if (window.sounds) window.sounds.playDone();
      }

      setGeneratingState(false, cid);
      _streamingChatId = null;
      break;
    }

    case 'error': {
      if (isVisible) {
        if (window.sounds) window.sounds.playError();
        col.querySelectorAll('.chat-ai-stream-header, .cad-ai-stream-header').forEach(el => el.remove());
        finalizeToolContainer(false);
        finalizeStreamThought();
      }

      if (isAiderActive()) {
        if (isVisible) finalizeAiderConsole(false);
        ChatSessionManager.appendMessage('assistant', `failed **Aider Task Failed**: ${e.data}`, getBuffer(cid)?.toolRuns || []);
      } else {
        const buf = getBuffer(cid);
        if (buf) {
          buf.text += `\n\nfailed **Error**: ${e.data}`;
          const domEl = getDomEl(cid);
          if (isVisible && domEl) renderParsedMessage(domEl, buf.text);
          markDone(cid);
          _finalizeStreamResponse(cid);
        } else {
          ChatSessionManager.appendMessage('assistant', `failed **Error**: ${e.data}`, []);
        }
      }

      setGeneratingState(false, cid);
      _streamingChatId = null;
      break;
    }

    case 'ask_question': {
      if (isVisible) {
        try {
          const payload = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          showQuestionCard(payload);
        } catch (err) {
          console.warn('ask_question parse failed:', err);
        }
      }
      break;
    }
    }
  } catch (err) {
    console.error('Error in agent stream handler:', err);
  }
}

export { initQuestionCard, anyStreamActive, getActiveStreamChatIds, isStreamActive };
