/* === chat.js — Barrel Entry Point ===
 * Re-exports every public symbol from the modular chat/ sub-package.
 * All other files (main.js, agent_stream.js, nav.js) import from here unchanged.
 */
import { ChatSessionManager } from './chat/session.js';
import {
  escapeHtml, scrollChat, clearInputs, clearChatLogs,
  formatTime, setGlobalSendCallback,
  bindInputs as _bindInputs
} from './chat/input.js';
import { createMessageElement } from './chat/messages.js';
import { enhanceMarkdownContent } from './chat/markdown.js';
import { enhanceImagePreviews } from './chat/media.js';
import { showCustomConfirm, showCustomPrompt, openImageLightbox } from './chat/dialogs.js';

// Expose ChatSessionManager globally for legacy inline references
window.ChatSessionManager = ChatSessionManager;
window.openImageLightbox = openImageLightbox;

// Re-export passthrough symbols
export {
  ChatSessionManager,
  escapeHtml, scrollChat, clearInputs, clearChatLogs, formatTime,
  showCustomConfirm, showCustomPrompt, openImageLightbox
};

// Re-export markdown enhancements
export {
  enhanceCodeBlocks, enhanceTables,
  enhanceLinks, autoLinkTextNodes,
  enhanceCallouts, enhanceTaskLists,
  enhanceMarkdownContent
} from './chat/markdown.js';

// Re-export media enhancements
export {
  enhanceImagePreviews,
  groupPreviewCardsIntoGrid,
  moveTipsToBottom
} from './chat/media.js';

/** bindInputs — wires send callback to both session manager and input handlers */
export function bindInputs(sendCallback) {
  ChatSessionManager.setSendCallback(sendCallback);
  _bindInputs(sendCallback, ChatSessionManager);
}

/** appendMsg — append a message bubble to the chat UI */
export function appendMsg(type, text, enterConvoCallback, scrollCallback) {
  if (type === 'ai' || type === 'assistant') {
    if (text) {
      const lines = text.split('\n');
      const filteredLines = lines.filter(line => !line.trim().startsWith('[Tool:'));
      text = filteredLines.join('\n').trim();
    }
    if (!text) return;
  }

  enterConvoCallback();
  ChatSessionManager.appendMessage(type === 'user' ? 'user' : 'assistant', text);

  const chats = ChatSessionManager.getChats();
  const activeCid = ChatSessionManager.getActiveChatId();
  const chat = chats.find(c => c.id === activeCid);
  const index = chat ? chat.messages.length - 1 : 0;

  const el = createMessageElement(
    type === 'user' ? 'user' : 'ai',
    text, new Date().toISOString(), index,
    ChatSessionManager, () => ChatSessionManager.getSendCallback()
  );

  const col = document.getElementById('chat-col') || document.getElementById('chat-log');
  if (col && el) col.appendChild(el);
  scrollCallback();
}

/** resetActiveChat — reset session to no active chat */
export function resetActiveChat() {
  ChatSessionManager.setActiveChatId(null);
  ChatSessionManager.renderChatsList();
  if (window.inConversationState) {
    window.inConversationState.val = false;
  }
}
