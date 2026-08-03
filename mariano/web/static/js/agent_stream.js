import { scrollChat, enhanceCodeBlocks, enhanceTables, enhanceImagePreviews, enhanceMarkdownContent, escapeHtml, ChatSessionManager } from './chat.js';
const appendHudLog = (msg) => { console.log("[HUD LOG]", msg); };

let _streamThoughtCard  = null;
let _streamThoughtBody  = null;
let _streamThoughtText  = "";
let _streamThoughtStartTime = 0;
let _streamResponseEl   = null;
let _streamResponseText = "";
let _lastToolBlock = null;
let _currentMessageActive = false;

// ── Codex-style 3-layer execution feed state ─────────────────────────────
// Layer 1 ACTION: pre-tool narration (small label before tool badge)
// Layer 2 TOOL:   badge (unchanged)
// Layer 3 FINDING: post-tool micro-summary (compact, max 2 sentences)
let _reasoningCard      = null;  // kept for compat, unused in new flow
let _reasoningBody      = null;
let _reasoningText      = "";
let _findingEl          = null;  // FINDING label element
let _findingText        = '';    // accumulated finding text

let _aiderConsoleCard   = null;
let _aiderConsoleLogArea = null;
let _aiderActive        = false;
let _aiderConsoleRawText = "";

// Grouped tool execution states (monochromatic, collapsible tool groups)
let _streamToolContainer = null;
let _streamToolBody      = null;
let _streamToolCount     = 0;
let _currentMessageToolRuns = [];

// ─── Planner metadata line filter ─────────────────────────────────────────────
// Strip lines that are ONLY pure agent-internal planner step headers.
// NOTE: "Conclusion" and "Status Summary" are intentionally EXCLUDED from this
// filter — they are valid user-facing summary sections that must be preserved.
const PLANNER_PREFIX_RE = /^\s*-?\s*\*{0,2}(\s*)(Current State( Analysis)?|Plan Status|Next Logical Step|Next Step|Analysis( of Current State)?|Previous Steps?|Remaining steps|Previous steps were|implicitly handled|Step \d+\/\d+)\b/i;

// Also strip narrative lines that are clearly agent self-narration injected between steps
const PLANNER_NARRATION_RE = /^\s*-\s+(The (user|repository|previous attempt|current repo|project)|Since the user|I will (not |now |provide|execute)|This means|The core system|The specific UI)/i;

function _stripPlannerMetadata(text) {
  if (!text) return text;
  const lines = text.split('\n');
  const filtered = lines.filter(line =>
    !PLANNER_PREFIX_RE.test(line) && !PLANNER_NARRATION_RE.test(line)
  );
  return filtered
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')   // collapse triple+ blank lines
    .trim();
}



export function handleChatAgentEvent(e, enterConversationCallback) {
  const col = document.getElementById('chat-col') || document.getElementById('chat-log');
  if (!col) return;

  if (!_currentMessageActive && e.kind !== 'done' && e.kind !== 'error') {
    _currentMessageActive = true;
    _currentMessageToolRuns = [];
  }

  switch (e.kind) {
    case 'thinking': {
      enterConversationCallback();
      if (e.data && e.data.includes('Aider')) {
        _aiderActive = true;
      }
      appendHudLog(`[INFO] ${e.data}`);

      // ── Inject Gemini 3.1 Reasoning Engine orb header (same as HekkiCAD) ──
      col.querySelectorAll('.chat-ai-stream-header').forEach(el => el.remove());

      const headerEl = document.createElement('div');
      headerEl.className = 'cad-ai-stream-header chat-ai-stream-header';
      headerEl.style.marginTop = '20px';
      headerEl.style.marginBottom = '8px';
      headerEl.innerHTML = `
        <canvas class="cad-ai-orb-avatar" id="chat-active-orb-canvas" width="28" height="28"></canvas>
        <span class="cad-ai-header-title">Hekki Reasoning</span>
      `;
      col.appendChild(headerEl);

      setTimeout(() => {
        const canvas = headerEl.querySelector('#chat-active-orb-canvas');
        if (canvas && window.RibbonGradientOrb) {
          new window.RibbonGradientOrb(canvas).start();
        }
      }, 50);

      scrollChat();
      break;
    }

    // ── LAYER 1: ACTION label — pre-tool narration (contained inside tool block) ──────
    case 'reasoning': {
      enterConversationCallback();
      col.querySelectorAll('.action-label-temp').forEach(el => el.remove());
      _findingEl   = null;
      _findingText = '';
      break;
    }

    // ── LAYER 3: FINDING label — post-tool micro-summary (nested inside tool block) ───
    case 'reasoning_chunk': {
      col.querySelectorAll('.action-label-temp').forEach(el => el.classList.remove('action-label-temp'));
      if (!_findingEl) {
        _findingEl = document.createElement('div');
        _findingEl.className = 'finding-label';
        _findingEl.style.cssText = 'width: 100%; margin-top: 3px; padding-left: 21px; font-size: 11.5px; color: var(--text-3); font-family: var(--font); opacity: 0.9; box-sizing: border-box;';
        if (_lastToolBlock) {
          _lastToolBlock.style.flexWrap = 'wrap';
          _lastToolBlock.appendChild(_findingEl);
        } else if (_streamToolBody) {
          _streamToolBody.appendChild(_findingEl);
        }
      }
      _findingText += e.data;
      const sentenceBreak = _findingText.search(/(?<=[.!?])\s+[A-Z]/);
      const display = sentenceBreak > 0
        ? _findingText.slice(0, sentenceBreak + 1).trim()
        : _findingText.slice(0, 180).trim();
      if (_findingEl) _findingEl.textContent = display;
      if (_currentMessageToolRuns.length > 0) {
        _currentMessageToolRuns[_currentMessageToolRuns.length - 1].reasoning += e.data;
      }
      scrollChat();
      break;
    }

    case 'reasoning_done': {
      if (_findingEl) {
        _findingEl.classList.remove('finding-label--streaming');
      }
      _reasoningCard = null;
      _reasoningBody = null;
      _reasoningText = '';
      break;
    }

    case 'think_chunk': {
      // Internal model inference token — not for user display.
      // Codex/Claude Code pattern: internal chain-of-thought is never shown.
      // Only ACTION (pre-tool) and FINDING (post-tool) labels are surfaced.
      break;
    }

    case 'response_chunk': {
      col.querySelectorAll('.think-label-temp').forEach(el => el.remove());
      // Remove typing dots once AI starts writing (orb stays, dots go)
      const activeOrb = document.querySelector('.chat-ai-stream-header #chat-stream-typing-dots');
      if (activeOrb) activeOrb.remove();
      _finalizeToolContainer(true);
      
      if (_aiderActive) {
        appendHudLog(e.data);
        _ensureAiderConsoleCard(enterConversationCallback);
        if (_aiderConsoleLogArea) {
          _aiderConsoleRawText += e.data;
          _aiderConsoleLogArea.innerHTML = window.marked 
            ? marked.parse(_aiderConsoleRawText) 
            : escapeHtml(_aiderConsoleRawText);
          enhanceMarkdownContent(_aiderConsoleLogArea);
          _aiderConsoleLogArea.scrollTop = _aiderConsoleLogArea.scrollHeight;
          
          const addActivityStep = (text, isDone = false) => {
            const feedEl = _aiderConsoleCard.querySelector('#aider-activity-steps');
            if (feedEl) {
              const lastChild = feedEl.lastElementChild;
              if (lastChild && lastChild.innerText.includes(text)) return;
              
              while (feedEl.children.length >= 4) {
                feedEl.removeChild(feedEl.firstChild);
              }
              
              const step = document.createElement('div');
              step.style.display = 'flex';
              step.style.alignItems = 'center';
              step.style.gap = '8px';
              step.style.color = isDone ? 'var(--text-3)' : 'var(--text-2)';
              step.style.fontWeight = 'normal';
              step.style.fontSize = '13.5px';
              step.innerHTML = `
                <span style="color:var(--text-3)">Â·</span>
                <span>${text}</span>
              `;
              feedEl.appendChild(step);
            }
          };

          // Parse stats from incoming output stream
          const lines = e.data.split('\n');
          lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            
            // Live activity feed matches
            if (trimmed.includes('Git repo:')) {
              addActivityStep('Scanning Git repository and workspace files...');
            } else if (trimmed.includes('Model:')) {
              const modelName = trimmed.split('Model:')[1]?.trim() || 'Gemini';
              addActivityStep(`Connecting to Aider backend model (${modelName})...`);
            } else if (trimmed.match(/Added (.*) to the chat/i)) {
              const file = trimmed.match(/Added (.*) to the chat/i)[1];
              addActivityStep(`Loading file into AI context: ${file}`);
            } else if (trimmed.includes('Thinking...')) {
              addActivityStep('Analyzing codebase & planning implementation...');
            } else if (trimmed.match(/Editing (.*)/i) || trimmed.match(/Updating (.*)/i)) {
              const file = trimmed.match(/(?:Editing|Updating) (.*)/i)[1];
              addActivityStep(`Generating and compiling edits for ${file}...`);
            } else if (trimmed.match(/Applied edits to (.*)/i)) {
              const file = trimmed.match(/Applied edits to (.*)/i)[1];
              addActivityStep(`Successfully applied edits to ${file}`, true);
            } else if (trimmed.match(/Commit ([a-f0-9]+)/i)) {
              addActivityStep('Staging changeset and creating git commit...', true);
            }

            // 1. Detect file count
            const fileMatch = trimmed.match(/Git repo:.*with (\d+) files/i);
            if (fileMatch) {
              const countEl = _aiderConsoleCard.querySelector('#aider-files-count');
              if (countEl) countEl.textContent = `${fileMatch[1]} files`;
              const badge = _aiderConsoleCard.querySelector('#aider-status-badge');
              if (badge) {
                badge.textContent = '[scanning]';
              }
            }
            
            // 2. Detect added files / reading / scanning
            const readMatch = trimmed.match(/Added (.*) to the chat/i) || trimmed.match(/Referencing (.*)/i) || trimmed.match(/Loading (.*)/i);
            if (readMatch) {
              const opEl = _aiderConsoleCard.querySelector('#aider-active-op');
              if (opEl) opEl.textContent = `${readMatch[1]}`;
              const badge = _aiderConsoleCard.querySelector('#aider-status-badge');
              if (badge) {
                badge.textContent = '[reading]';
              }
            }
            
            // 3. Detect active edit file
            const editMatch = trimmed.match(/Applied edits to (.*)/i) || trimmed.match(/Editing (.*)/i) || trimmed.match(/Updating (.*)/i) || trimmed.match(/Modify (.*)/i);
            if (editMatch) {
              const opEl = _aiderConsoleCard.querySelector('#aider-active-op');
              const fileName = editMatch[1];
              if (opEl) opEl.textContent = `${fileName}`;
              const badge = _aiderConsoleCard.querySelector('#aider-status-badge');
              if (badge) {
                badge.textContent = '[editing]';
              }
              if (window.showWebPreviewIcon) window.showWebPreviewIcon();
              
              // Live animated additions counter to show work
              if (!_aiderConsoleCard._diffInterval) {
                _aiderConsoleCard._diffInterval = setInterval(() => {
                  const addEl = _aiderConsoleCard?.querySelector('#aider-additions-count');
                  if (addEl) {
                    const currentVal = parseInt(addEl.textContent.replace('+', '')) || 0;
                    addEl.textContent = `+${currentVal + Math.floor(Math.random() * 2 + 1)}`;
                  }
                }, 700);
              }
            }
            
            // 4. Detect diff stats
            const diffMatch = trimmed.match(/(\d+) insertions?\(\+\),? (\d+) deletions?\(\-\)/i) || trimmed.match(/(\d+) additions?,? (\d+) deletions?/i);
            if (diffMatch) {
              if (_aiderConsoleCard._diffInterval) {
                clearInterval(_aiderConsoleCard._diffInterval);
                _aiderConsoleCard._diffInterval = null;
              }
              const addEl = _aiderConsoleCard.querySelector('#aider-additions-count');
              const delEl = _aiderConsoleCard.querySelector('#aider-deletions-count');
              if (addEl) addEl.textContent = `+${diffMatch[1]}`;
              if (delEl) delEl.textContent = `-${diffMatch[2]}`;
            }
            
            // 5. Detect commits count
            const commitMatch = trimmed.match(/Commit ([a-f0-9]+)/i) || trimmed.match(/Created commit/i);
            if (commitMatch) {
              const commitEl = _aiderConsoleCard.querySelector('#aider-commits-count');
              if (commitEl) {
                const current = parseInt(commitEl.textContent) || 0;
                commitEl.textContent = `${current + 1} commits`;
              }
              const badge = _aiderConsoleCard.querySelector('#aider-status-badge');
              if (badge) {
                badge.textContent = '[committing]';
              }
            }
          });
        }
      } else {
        _ensureResponseMsg(enterConversationCallback);
        _streamResponseText += e.data;
        // Strip internal planner metadata lines so only real AI reply shows in chat
        const displayText = _stripPlannerMetadata(_streamResponseText);
        if (_streamResponseEl) {
          _streamResponseEl.innerHTML = window.marked 
            ? marked.parse(displayText) 
            : escapeHtml(displayText);
          enhanceMarkdownContent(_streamResponseEl);
        }
        if (_streamResponseText.includes('```')) {
          if (window.showWebPreviewIcon) window.showWebPreviewIcon();
        }
      }
      scrollChat();
      break;
    }

    case 'permission_request': {
      col.querySelectorAll('.think-label-temp, .tool-block-temp').forEach(el => el.remove());
      // Stop generating spinner — user must decide before we continue
      if (window.setGeneratingState) window.setGeneratingState(false);
      _currentMessageActive = false;
      // Remove reasoning orb header completely
      col.querySelectorAll('.chat-ai-stream-header, .cad-ai-stream-header').forEach(el => el.remove());

      const targetPath = (e.metadata && e.metadata.path) || e.target_path || e.path || "D:/";
      const targetFolder = targetPath.split(/[/\\]/).filter(Boolean).pop() || targetPath;

      const card = document.createElement('div');
      card.className = 'permission-request-card';
      card.style.border = 'none';
      card.style.borderRadius = '12px';
      card.style.background = 'var(--card)';
      card.style.margin = '14px 0';
      card.style.padding = '16px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '12px';
      card.style.fontFamily = 'var(--font)';
      
      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:600; color:var(--text-primary);">
          <i data-lucide="shield-alert" style="width:16px; height:16px; color:#f59e0b;"></i>
          <span>Workspace Access Permission Request</span>
        </div>
        <p style="font-size:12px; color:var(--text-secondary); margin:0; line-height:1.5;">
          Hekki is trying to access <strong>${escapeHtml(targetPath)}</strong> which is outside the current workspace sandbox. Grant access to continue.
        </p>
        <div style="display:flex; align-items:center; gap:10px; margin-top:4px; flex-wrap:wrap;">
          <button class="allow-everything-btn" style="border:none; background:var(--text-primary); color:var(--card); padding:8px 14px; border-radius:8px; font-size:12px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:6px; transition:opacity 0.1s;">
            <i data-lucide="unlock" style="width:13px; height:13px;"></i>
            <span>Allow Everything</span>
          </button>
          <button class="allow-target-btn" style="border:none; background:var(--hover); color:var(--text-primary); padding:8px 14px; border-radius:8px; font-size:12px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:6px; transition:all 0.1s;">
            <i data-lucide="folder-check" style="width:13px; height:13px;"></i>
            <span>Allow Only: ${escapeHtml(targetPath)}</span>
          </button>
          <button class="deny-btn" style="border:none; background:transparent; color:var(--text-3); padding:8px 10px; border-radius:8px; font-size:11.5px; cursor:pointer; font-weight:500;">
            Deny
          </button>
        </div>
      `;
      
      col.appendChild(card);
      if (window.lucide) lucide.createIcons();
      
      const activeChatId = localStorage.getItem('mariano_active_chat_id')
                        || localStorage.getItem('hekki_active_chat_id');

      const _retryQuery = (permissionMode, pathScope) => {
        card.remove();
        localStorage.setItem('mariano_permission_policy', permissionMode);
        
        if (window.showToast) {
          const msg = permissionMode === 'everything' 
            ? 'Full system access granted for this session.' 
            : `Access allowed for: ${pathScope || targetFolder}`;
          window.showToast('Access Granted', msg, 2500);
        }

        const chatLog = ChatSessionManager.getChats();
        const activeChat = chatLog.find(c => c.id === activeChatId);
        if (activeChat && activeChat.messages.length > 0) {
          const userMsgs = activeChat.messages.filter(m => m.role === 'user');
          if (userMsgs.length > 0) {
            const lastQuery = userMsgs[userMsgs.length - 1].text;
            
            const retryEl = document.createElement('div');
            retryEl.style.fontFamily = 'var(--font-mono)';
            retryEl.style.fontSize = '11px';
            retryEl.style.color = 'var(--text-3)';
            retryEl.style.margin = '4px 0 12px 12px';
            retryEl.innerHTML = `▸ retrying with permission: ${permissionMode}...`;
            col.appendChild(retryEl);
            
            const activeProj = localStorage.getItem('mariano_active_project')
                            || localStorage.getItem('hekki_active_project');
            const activeProjPath = localStorage.getItem('mariano_active_project_path');
            
            window.socket.send(JSON.stringify({ 
              type: 'query', 
              text: lastQuery,
              project: activeProj || null,
              project_path: pathScope || activeProjPath || null,
              permission_policy: permissionMode,
              chat_id: activeChatId
            }));
            if (window.setGeneratingState) window.setGeneratingState(true);
          }
        }
      };

      card.querySelector('.allow-everything-btn').addEventListener('click', () => {
        _retryQuery('everything', null);
      });

      card.querySelector('.allow-target-btn').addEventListener('click', () => {
        _retryQuery('scoped', targetPath);
      });

      card.querySelector('.deny-btn').addEventListener('click', () => {
        card.remove();
        ChatSessionManager.appendMessage('assistant', '✖ **Permission Denied** — Action blocked by user.');
        if (window.setGeneratingState) window.setGeneratingState(false);
      });
      
      scrollChat();
      break;
    }


    case 'tool_call': {
      enterConversationCallback();
      _finalizeStreamResponse();

      const toolName = e.data || e.metadata?.tool || 'action';
      const args = e.metadata?.args || {};
      const argsStr = JSON.stringify(args);
      appendHudLog(`[EXEC] ${toolName} args: ${argsStr}`);

      if (toolName === 'generate_image') {
        const imgCard = document.createElement('div');
        imgCard.className = 'image-generation-card';
        imgCard.id = 'active-image-gen-card';
        
        imgCard.innerHTML = `
          <div class="image-generation-header">
            <i data-lucide="image" style="width:12px;height:12px;margin-right:4px;"></i>
            <span>Generating Image</span>
          </div>
          <div class="image-generation-body">
            <div class="image-generation-shimmer"></div>
            <div class="image-generation-spinner"></div>
            <div class="image-generation-text">Designing details...</div>
          </div>
        `;
        col.appendChild(imgCard);
        scrollChat();
        if (window.lucide) lucide.createIcons({ parent: imgCard });
        
        const phrases = [
          "Conceptualizing prompt...",
          "Mapping latent spaces...",
          "Refining shapes...",
          "Rendering colors...",
          "Polishing details..."
        ];
        let phraseIdx = 0;
        imgCard._textInterval = setInterval(() => {
          const txtEl = imgCard.querySelector('.image-generation-text');
          if (txtEl) {
            phraseIdx = (phraseIdx + 1) % phrases.length;
            txtEl.textContent = phrases[phraseIdx];
          }
        }, 2500);
      }

      // ── Determine display details ──────────────────────────────────────────
      const action = args.action || '';
      const rawPath = args.TargetFile || args.target_file || args.file_path || args.filePath || args.path || args.file || args.filename || args.query || '';
      const fileName = rawPath ? rawPath.split(/[\/\\]/).pop() : toolName;
      const startLine = args.start_line || '';
      const endLine   = args.end_line   || '';
      const lineRange = (startLine && endLine) ? `L${startLine}–${endLine}` : (startLine ? `L${startLine}+` : '');

      // Icon and label mapping — expanded to cover all tool names
      const _toolMeta = {
        'generate_image':       { icon: '<i data-lucide="image" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'generate_image', detail: escapeHtml(String(args.Prompt || args.prompt || Object.values(args)[0] || '').slice(0, 55)) },
        'image_analysis':       { icon: '<i data-lucide="scan-eye" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'image_analysis', detail: escapeHtml(String(args.prompt || Object.values(args)[0] || '').slice(0, 55)) },
        'file_manager:read':    { icon: '<i data-lucide="file-text" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Reading',        detail: lineRange ? `${fileName}  <span style="opacity:0.45;font-size:10.5px;">${lineRange}</span>` : fileName },
        'file_manager:write':   { icon: '<i data-lucide="file-edit" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Writing',        detail: fileName },
        'file_manager:list':    { icon: '<i data-lucide="folder" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Listing',        detail: fileName || 'directory' },
        'file_manager:grep':    { icon: '<i data-lucide="search" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Grepping',       detail: escapeHtml(args.pattern||'') },
        'file_manager:search':  { icon: '<i data-lucide="search" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Searching',      detail: escapeHtml(args.pattern||'') },
        'file_manager:delete':  { icon: '<i data-lucide="trash-2" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Deleting',       detail: fileName },
        'file_manager:create_dir': { icon: '<i data-lucide="folder-plus" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Creating dir', detail: fileName },
        'web_search':           { icon: '<i data-lucide="globe" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Web search',     detail: escapeHtml(String(args.query||'').slice(0,55)) },
        'web_scraper':          { icon: '<i data-lucide="globe" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Scraping',       detail: escapeHtml(String(args.url||'').slice(0,55)) },
        'deep_research':        { icon: '<i data-lucide="book-open" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Deep research', detail: escapeHtml(String(args.query||'').slice(0,55)) },
        'physics_solver':       { icon: '<i data-lucide="cpu" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Physics solver', detail: escapeHtml(String(args.solver||args.query||'').slice(0,55)) },
        'stock_data':           { icon: '<i data-lucide="trending-up" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Stock data', detail: escapeHtml(String(args.symbol||'').slice(0,55)) },
        'weather':              { icon: '<i data-lucide="cloud" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Weather', detail: escapeHtml(String(args.location||'').slice(0,55)) },
        'translator':           { icon: '<i data-lucide="languages" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Translator', detail: escapeHtml(String(args.text||'').slice(0,55)) },
        'reminder':             { icon: '<i data-lucide="bell" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Reminder', detail: escapeHtml(String(args.message||'').slice(0,55)) },
        'memory_ops':           { icon: '<i data-lucide="database" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Memory', detail: escapeHtml(String(args.action||'').slice(0,55)) },
        'code_search':          { icon: '<i data-lucide="code" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Code search',    detail: escapeHtml(String(args.query||'').slice(0,55)) },
        'shell':                { icon: '<i data-lucide="terminal" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Shell',          detail: escapeHtml(String(args.command||'').slice(0,55)) },
        'git':                  { icon: '<i data-lucide="git-branch" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Git',            detail: escapeHtml(String(args.command||args.action||'').slice(0,40)) },
        'run_tests':            { icon: '<i data-lucide="check-circle-2" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Tests',          detail: '' },
        'aider':                { icon: '<i data-lucide="sparkles" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>', label: 'Aider',          detail: escapeHtml(String(args.user_input||args.message||'').slice(0,55)) },
        'system_control':       {
          icon: '<i data-lucide="cog" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>',
          label: action === 'run_command' ? 'Command' : action === 'copy_files' ? 'Copying' : action === 'open_app' ? 'Opening' : 'System',
          detail: escapeHtml(String(args.command || args.source || args.app_name || '').slice(0,55))
        },
      };
      const metaKey = (toolName === 'file_manager' && action) ? `file_manager:${action}` : toolName;
      const meta = _toolMeta[metaKey] || {
        icon: '<i data-lucide="wrench" style="width:13px;height:13px;vertical-align:middle;display:inline-block;"></i>',
        label: toolName,
        detail: escapeHtml(String(Object.values(args)[0] || '').slice(0, 55))
      };

      const card = document.createElement('div');
      card.className = 'tool-block-temp tool-log-card';
      card.dataset.tool = metaKey;
      card.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'margin:3px 0 4px 0',
        'padding:4px 0',
        'background:transparent',
        'font-size:12px',
        'font-family:var(--font)',
        'color:var(--text-3)',
        'gap:10px',
      ].join(';');

      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;overflow:hidden;">
          <span style="flex-shrink:0;opacity:0.75;display:inline-flex;align-items:center;">${meta.icon}</span>
          <span style="font-weight:500;color:var(--text-secondary);white-space:nowrap;">${meta.label}</span>
          <span class="tool-detail" style="color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${meta.detail}</span>
        </div>
        <span class="tool-status" style="flex-shrink:0;font-size:11px;color:var(--text-3);white-space:nowrap;opacity:0.6;">running<span class="dots">.</span></span>
      `;

      // Live brief execution hint line for transparent execution feedback
      const briefCmd = args.command || args.cmd || args.query || args.pattern || args.path || args.url || '';
      if (briefCmd) {
        card.style.flexWrap = 'wrap';
        const hintEl = document.createElement('div');
        hintEl.className = 'tool-brief-hint';
        hintEl.style.cssText = 'width: 100%; margin-top: 2px; padding-left: 21px; font-size: 11px; color: var(--text-3); font-family: var(--font-mono); opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;';
        hintEl.innerHTML = `▸ Executing: ${escapeHtml(String(briefCmd).slice(0, 90))}`;
        card.appendChild(hintEl);
      }

      _ensureToolContainer(col, enterConversationCallback);
      _streamToolCount++;
      
      const titleEl = _streamToolContainer.querySelector('.tool-group-title');
      if (titleEl) {
        titleEl.textContent = 'Actions';
      }
      
      const bodyEl = _streamToolContainer.querySelector('.tool-group-body');
      const chevronEl = _streamToolContainer.querySelector('.chevron-icon');
      if (bodyEl) {
        bodyEl.style.display = 'flex'; // Keep it expanded while tools are running
        if (chevronEl) {
          chevronEl.style.transform = 'rotate(90deg)';
        }
      }
      
      _streamToolBody.appendChild(card);
      if (window.lucide) lucide.createIcons({ parent: card });
      _lastToolBlock = card;

      _currentMessageToolRuns.push({
        icon: meta.icon,
        label: meta.label,
        detail: meta.detail,
        status: 'running',
        reasoning: ''
      });


      // Animated dots on the status
      const dotsEl = card.querySelector('.dots');
      if (dotsEl) {
        card._dotsInterval = setInterval(() => {
          const d = dotsEl.textContent;
          dotsEl.textContent = d.length >= 3 ? '.' : d + '.';
        }, 400);
      }

      scrollChat();
      break;
    }

    case 'tool_result': {
      if (_lastToolBlock) {
        const isSuccess = e.metadata?.success !== false;
        appendHudLog(`[RESULT] ${isSuccess ? '✓ Success' : '✖ Failed'}`);

        // Stop animated dots
        if (_lastToolBlock._dotsInterval) {
          clearInterval(_lastToolBlock._dotsInterval);
          _lastToolBlock._dotsInterval = null;
        }

        const statusEl = _lastToolBlock.querySelector('.tool-status');
        if (statusEl) {
          if (isSuccess) {
            statusEl.innerHTML = '<span style="color:var(--text-3);">✓ done</span>';
          } else {
            statusEl.innerHTML = '<span style="color:#ef4444;">✖ failed</span>';
          }
        }

        if (_currentMessageToolRuns.length > 0) {
          const lastRun = _currentMessageToolRuns[_currentMessageToolRuns.length - 1];
          lastRun.status = isSuccess ? 'done' : 'failed';
          if (e.data && typeof e.data === 'string') {
            lastRun.output = e.data;
          }
        }

        const toolName = e.metadata?.tool || '';

        if (toolName === 'generate_image') {
          const imgCard = document.getElementById('active-image-gen-card');
          if (imgCard) {
            if (imgCard._textInterval) {
              clearInterval(imgCard._textInterval);
            }
            
            const isSuccess = e.metadata?.success !== false;
            if (isSuccess && e.data) {
              let imagePath = '';
              try {
                const parsed = JSON.parse(e.data);
                if (parsed.image_path) {
                  imagePath = parsed.image_path;
                } else if (parsed.path) {
                  imagePath = parsed.path;
                } else if (parsed.artifact_path) {
                  imagePath = parsed.artifact_path;
                }
              } catch (err) {
                const match = e.data.match(/([a-zA-Z]:[\\\/][^:\*\?"<>\|]+\.(?:png|jpg|jpeg|webp|gif))/i)
                           || e.data.match(/(\/[^:\*\?"<>\|]+\.(?:png|jpg|jpeg|webp|gif))/i);
                if (match) {
                  imagePath = match[0];
                }
              }
              
              if (imagePath) {
                imgCard.className = 'chat-image-preview-card';
                imgCard.id = '';
                
                const relativeOrAbsolute = imagePath.replace(/\\/g, '/');
                const renderUrl = `/api/workspace/render?path=${encodeURIComponent(relativeOrAbsolute)}`;
                
                imgCard.innerHTML = `
                  <div class="chat-image-preview-body">
                    <img src="${renderUrl}" alt="Generated Image" class="image-fade-in" />
                  </div>
                  <div class="chat-image-preview-header">
                    <i data-lucide="image" style="width:12px;height:12px;flex-shrink:0;"></i>
                    <span>Generated Image</span>
                    <a href="${renderUrl}" target="_blank" class="chat-image-preview-open" title="Open original image">
                      <i data-lucide="external-link" style="width:12px;height:12px;"></i>
                    </a>
                  </div>
                `;
                
                const imgEl = imgCard.querySelector('img');
                if (imgEl) {
                  imgEl.onload = () => {
                    if (imgEl.clientWidth > 0) {
                      imgCard.style.width = imgEl.clientWidth + 'px';
                    }
                  };
                  if (imgEl.complete && imgEl.clientWidth > 0) {
                    imgCard.style.width = imgEl.clientWidth + 'px';
                  }
                }

                if (_currentMessageToolRuns.length > 0) {
                  _currentMessageToolRuns[_currentMessageToolRuns.length - 1].image_path = relativeOrAbsolute;
                }

                if (window.lucide) lucide.createIcons({ parent: imgCard });
              } else {
                imgCard.remove();
              }
            } else {
              imgCard.remove();
            }
          }
        }

        // ── Render Output Details / Terminal UI Block for commands and file ops ──
        if (e.data && typeof e.data === 'string' && e.data.trim().length > 0) {
          const hint = _lastToolBlock.querySelector('.tool-brief-hint');
          if (hint) hint.remove();
          _lastToolBlock.style.flexWrap = 'wrap';
          
          const toolTag = _lastToolBlock.dataset.tool || toolName || 'action';
          const isTerminalCmd = toolTag.includes('shell') || toolTag.includes('run_command') || toolTag.includes('system_control');
          const isSearchGrep = toolTag.includes('grep') || toolTag.includes('search');
          const iconName = isTerminalCmd ? 'terminal' : (isSearchGrep ? 'search' : 'file-text');
          const summaryLabel = isTerminalCmd ? '▸ Terminal Output' : '▸ View output details';
          const maxLen = isTerminalCmd ? 6000 : 3000;
          const previewText = e.data.length > maxLen ? e.data.slice(0, maxLen) + '\n... (truncated)' : e.data;
          
          const outputDetail = document.createElement('div');
          outputDetail.style.cssText = 'width: 100%; margin-top: 4px; padding-left: 21px; box-sizing: border-box;';
          outputDetail.innerHTML = `
            <details style="margin: 0; opacity: 0.95; width: 100%;" ${isTerminalCmd ? 'open' : ''}>
              <summary style="cursor:pointer; color:var(--text-3); font-size:11px; font-weight:500; outline:none; user-select:none; display:inline-flex; align-items:center; gap:4px; padding: 2px 0;">
                <i data-lucide="${iconName}" style="width:12px;height:12px;color:var(--text-3);display:inline-block;vertical-align:middle;"></i>
                <span>${summaryLabel}</span>
              </summary>
              <pre style="margin:6px 0 2px 0; padding:10px 12px; background:var(--card); color:var(--text-primary); border-radius:8px; font-size:11px; font-family:var(--font-mono); line-height:1.55; overflow-x:auto; border:none !important; box-shadow:none !important; max-height:220px; width:100%; box-sizing:border-box; white-space:pre-wrap; word-break:break-all;">${escapeHtml(previewText)}</pre>
            </details>
          `;
          _lastToolBlock.appendChild(outputDetail);
          if (window.lucide) lucide.createIcons({ parent: outputDetail });
        }
        
        _lastToolBlock.classList.remove('tool-block-temp');
        _lastToolBlock = null;
      }
      scrollChat();
      break;
    }

    case 'response': {
      col.querySelectorAll('.think-label-temp, .tool-block-temp, .thought-container').forEach(el => el.remove());
      _finalizeToolContainer(true);
      
      if (_aiderActive && _aiderConsoleCard) {
        if (_aiderConsoleCard._diffInterval) {
          clearInterval(_aiderConsoleCard._diffInterval);
          _aiderConsoleCard._diffInterval = null;
        }
        
        const spinner = _aiderConsoleCard.querySelector('.console-spinner');
        const title = _aiderConsoleCard.querySelector('.console-title');
        const badge = _aiderConsoleCard.querySelector('#aider-status-badge');
        
        if (spinner) {
          spinner.outerHTML = '<span style="color:var(--text-secondary); font-weight:bold; font-size:12px; margin-right:6px;">✓</span>';
        }
        if (title) {
          title.textContent = 'Aider Task Completed';
        }
        if (badge) {
          badge.textContent = '[success]';
        }
        
        // Auto-collapse log area after completion to keep UI clean
        const body = _aiderConsoleCard.querySelector('.console-body');
        if (body) {
          body.style.display = 'none';
          const chevron = _aiderConsoleCard.querySelector('.chevron-icon');
          if (chevron) chevron.style.transform = 'rotate(-90deg)';
        }

        // Render high fidelity Monochromic Review Changes card
        const files = e.metadata?.files_changed || [];
        const addCount = e.metadata?.total_additions || 0;
        const delCount = e.metadata?.total_deletions || 0;
        const fileWord = files.length === 1 ? 'file' : 'files';
        
        if (files.length > 0) {
          const card = document.createElement('div');
          card.className = 'aider-changes-card';
          card.style.border = '1px solid var(--border)';
          card.style.borderRadius = '8px';
          card.style.background = 'var(--card)';
          card.style.margin = '14px 0';
          card.style.padding = '12px 16px';
          card.style.display = 'flex';
          card.style.flexDirection = 'column';
          card.style.gap = '10px';
          
          card.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:12.5px; font-weight:500;">
              <div style="display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none;" class="changes-toggle-header">
                <span style="font-weight:600; color:var(--text-primary);">${files.length} ${fileWord} changed</span>
                <span style="color:#22c55e; font-weight:600;">+${addCount}</span>
                <span style="color:#ef4444; font-weight:600;">-${delCount}</span>
                <i class="chevron-icon" data-lucide="chevron-down" style="width:14px; height:14px; color:var(--text-secondary); transition:transform 0.15s; margin-left:2px;"></i>
              </div>
              <button class="review-btn" style="display:flex; align-items:center; gap:6px; border:1px solid var(--border); background:var(--hover); padding:4px 10px; border-radius:6px; font-size:11.5px; color:var(--text-primary); cursor:pointer; font-weight:500; transition:all 0.1s;">
                <i data-lucide="file-check" style="width:13px; height:13px; color:var(--text-secondary);"></i>
                <span>Review</span>
              </button>
            </div>
            
            <div class="changes-files-list" style="display:flex; flex-direction:column; gap:6px; padding-top:8px; border-top:1px solid var(--border);">
              ${files.map(f => {
                const ext = f.filename.split('.').pop() || '';
                let icon = 'file-code';
                if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) icon = 'image';
                const workspacePath = e.metadata?.workspace || '';
                const fullPath = `${workspacePath}/${f.dir ? f.dir + '/' : ''}${f.filename}`.replace(/\\/g, '/').replace(/\/+/g, '/');
                return `
                  <div class="changed-file-row" data-filepath="${fullPath}" data-filename="${f.filename}" title="${fullPath}" style="display:flex; align-items:center; justify-content:space-between; font-size:12px; color:var(--text-secondary); cursor:pointer; padding:6px 8px; border-radius:6px; transition:background 0.1s;">
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                      <i data-lucide="${icon}" style="width:14px; height:14px; color:var(--text-3); flex-shrink:0;"></i>
                      <div style="display:flex; align-items:baseline; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="font-weight:600; color:var(--text-primary);">${f.filename}</span>
                        <span style="font-size:10px; color:var(--text-3); font-family:var(--font-mono);">${f.dir ? '/' + f.dir : ''}</span>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:10.5px;">
                      ${f.additions > 0 ? `<span style="color:#22c55e;">+${f.additions}</span>` : ''}
                      ${f.deletions > 0 ? `<span style="color:#ef4444;">-${f.deletions}</span>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
          
          col.appendChild(card);
          
          const toggleHeader = card.querySelector('.changes-toggle-header');
          const filesList = card.querySelector('.changes-files-list');
          if (toggleHeader && filesList) {
            toggleHeader.addEventListener('click', () => {
              const isHidden = filesList.style.display === 'none';
              filesList.style.display = isHidden ? 'flex' : 'none';
              card.querySelector('.chevron-icon').style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
          }

          // Format git diff into pretty colored div list helper
          function formatGitDiff(rawDiff) {
            const lines = rawDiff.split('\n');
            return lines.map(line => {
              let color = 'var(--text-secondary)';
              let bg = 'transparent';
              if (line.startsWith('+') && !line.startsWith('+++')) {
                color = '#22c55e';
                bg = 'rgba(34, 197, 94, 0.08)';
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                color = '#ef4444';
                bg = 'rgba(239, 68, 68, 0.08)';
              } else if (line.startsWith('@@')) {
                color = '#a855f7';
                bg = 'rgba(168, 85, 247, 0.05)';
              } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
                color = 'var(--text-3)';
              }
              return `<div style="color:${color}; background:${bg}; padding:2px 6px; font-family:var(--font-mono); font-size:11px; border-radius:2px; white-space:pre-wrap; word-break:break-all;">${escapeHtml(line)}</div>`;
            }).join('');
          }

          // Handle click on file row to show diff in right panel
          card.querySelectorAll('.changed-file-row').forEach(row => {
            row.addEventListener('click', async () => {
              const filepath = row.getAttribute('data-filepath');
              const filename = row.getAttribute('data-filename');
              const workspacePath = e.metadata?.workspace || '';
              
              try {
                const res = await fetch(`/api/workspace/file-diff?filepath=${encodeURIComponent(filepath)}&workspace=${encodeURIComponent(workspacePath)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                
                const formattedDiff = formatGitDiff(data.diff || '');
                const html = `
                  <div style="background:transparent; color:var(--text-primary); font-family:var(--font-mono); font-size:11.5px; padding:16px; height:100%; box-sizing:border-box; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
                    <div style="font-weight:600; font-size:13px; color:var(--text-primary); border-bottom:1px solid var(--border); padding-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <i data-lucide="git-commit" style="width:14px; height:14px; color:var(--text-3);"></i>
                        <span>Diff: ${filename}</span>
                      </div>
                      <span style="font-size:10px; font-weight:normal; color:var(--text-3); font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:280px;" title="${filepath}">${filepath}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:2px; line-height:1.6;">
                      ${formattedDiff}
                    </div>
                  </div>
                `;
                
                const appPane = document.getElementById('app-pane');
                if (appPane) appPane.classList.remove('hidden-pane');
                
                if (window.tabs) {
                  window.tabs.createTab(
                    `diff-${filename}`, 
                    `diff: ${filename}`, 
                    html, 
                    '', 
                    'if (window.lucide) lucide.createIcons({ parent: shadow });', 
                    'git-commit'
                  );
                }
              } catch (err) {
                if (window.showToast) {
                  window.showToast('Error', `Could not load diff: ${err.message}`, 3000);
                }
              }
            });
          });
          
          const reviewBtn = card.querySelector('.review-btn');
          if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
              const firstRow = card.querySelector('.changed-file-row');
              if (firstRow) {
                firstRow.click();
              } else if (window.showToast) {
                window.showToast('Workspace Review', `No files changed inside ${e.metadata?.workspace}`, 2500);
              }
            });
          }
          
          if (window.lucide) lucide.createIcons({ parent: card });
        }

        // Save structured commit details to history
        let historyMsg = `✓ **Aider Task Completed** — Workspace updated successfully.`;
        if (files.length > 0) {
          historyMsg += `\n\n* ${files.length} ${fileWord} changed:`;
          files.forEach(f => {
            historyMsg += `\n  - \`${f.filename}\` (+${f.additions} -${f.deletions})`;
          });


        }
        // Render Aider completion log bubble to Chat DOM
        const summaryEl = document.createElement('div');
        summaryEl.className = 'msg ai';
        summaryEl.innerHTML = window.marked ? marked.parse(historyMsg) : escapeHtml(historyMsg);
        enhanceMarkdownContent(summaryEl);
        col.appendChild(summaryEl);
        scrollChat();

        ChatSessionManager.appendMessage('assistant', historyMsg, _consumeToolRuns());

        _aiderConsoleCard = null;
        _aiderConsoleLogArea = null;
        _aiderConsoleRawText = "";
        _aiderActive = false;
      } else {
        // Non-Aider path: finalise the streaming bubble or create a new one.
        // IMPORTANT: never create a NEW summaryEl when _streamResponseEl already
        // exists — that causes the same content to appear twice in the chat.
        if (_streamResponseEl) {
          // Streaming bubble already exists — just update with final complete text.
          if (e.data && e.data.trim()) {
            _streamResponseText = e.data;   // overwrite with definitive final text
          }
          const displayText = _stripPlannerMetadata(_streamResponseText);
          if (displayText) {
            _streamResponseEl.innerHTML = window.marked
              ? marked.parse(displayText)
              : escapeHtml(displayText);
            enhanceMarkdownContent(_streamResponseEl);
          }
          _finalizeStreamResponse();
        } else if (e.data && e.data.trim()) {
          // No streaming bubble (pure non-streaming response) — create one.
          const summaryEl = document.createElement('div');
          summaryEl.className = 'msg ai';
          const displayText = _stripPlannerMetadata(e.data);
          summaryEl.innerHTML = window.marked
            ? marked.parse(displayText || e.data)
            : escapeHtml(displayText || e.data);
          enhanceMarkdownContent(summaryEl);
          col.appendChild(summaryEl);
          scrollChat();
          ChatSessionManager.appendMessage('assistant', e.data, _consumeToolRuns());
        } else {
          _finalizeStreamResponse();
        }
      }
      _finalizeStreamThought();
      _finalizeReasoning();
      _finalizeToolContainer(true);
      // Remove reasoning orb header completely on response completion for clean output
      col.querySelectorAll('.chat-ai-stream-header, .cad-ai-stream-header').forEach(el => el.remove());
      _currentMessageActive = false;
      if (window.setGeneratingState) window.setGeneratingState(false);
      // Auto-refresh drawer tabs (plan / tasks / walkthrough) silently
      setTimeout(() => { if (window.refreshPlanDrawer) window.refreshPlanDrawer(); }, 600);
      break;
    }

    case 'error': {
      col.querySelectorAll('.think-label-temp, .tool-block-temp, .thought-container, .reasoning-inline-temp, .ai-reasoning-card').forEach(el => el.remove());
      // Remove reasoning orb header completely on error
      col.querySelectorAll('.chat-ai-stream-header, .cad-ai-stream-header').forEach(el => el.remove());
      _finalizeReasoning();
      _finalizeToolContainer(false);
      
      if (_aiderActive && _aiderConsoleCard) {
        if (_aiderConsoleCard._diffInterval) {
          clearInterval(_aiderConsoleCard._diffInterval);
          _aiderConsoleCard._diffInterval = null;
        }
        
        const spinner = _aiderConsoleCard.querySelector('.console-spinner');
        const title = _aiderConsoleCard.querySelector('.console-title');
        const badge = _aiderConsoleCard.querySelector('#aider-status-badge');
        
        if (spinner) {
          spinner.outerHTML = '<span style="color:var(--text-secondary); font-weight:bold; font-size:12px; margin-right:6px;">✖</span>';
        }
        if (title) {
          title.textContent = 'Aider Task Failed';
        }
        if (badge) {
          badge.textContent = '[failed]';
        }
        ChatSessionManager.appendMessage('assistant', `✖ **Aider Coding Task Failed**: ${e.data}`, _consumeToolRuns());
        _aiderConsoleCard = null;
        _aiderConsoleLogArea = null;
        _aiderActive = false;
      } else {
        _ensureResponseMsg(enterConversationCallback);
        _streamResponseText += `\n\n✖ **Error**: ${e.data}`;
        if (_streamResponseEl) {
          _streamResponseEl.innerHTML = window.marked 
            ? marked.parse(_streamResponseText) 
            : escapeHtml(_streamResponseText);
          enhanceMarkdownContent(_streamResponseEl);
        }
        _finalizeStreamResponse();
      }
      _finalizeStreamThought();
      _currentMessageActive = false;
      if (window.setGeneratingState) window.setGeneratingState(false);
      break;
    }
  }
}

function _ensureThoughtCard(enterConversationCallback) {
  if (_streamThoughtCard) return;
  enterConversationCallback();

  const col = document.getElementById('chat-col') || document.getElementById('chat-log');
  if (!col) return;

  _streamThoughtStartTime = Date.now(); // Record start time of reasoning

  _streamThoughtCard = document.createElement('div');
  _streamThoughtCard.className = 'thought-container';
  _streamThoughtCard.innerHTML = `
    <div class="thought-header open thinking-active">
      <span class="thought-spinner"></span>
      <span class="thought-title">Thinking Process</span>
      <i class="mi-chevron thought-chevron" data-lucide="chevron-down" style="width:12px;height:12px;display:inline-block;vertical-align:middle;transition:transform 0.2s"></i>
    </div>
    <div class="thought-body">
      <p class="thought-step"></p>
    </div>
  `;

  col.appendChild(_streamThoughtCard);
  _streamThoughtBody = _streamThoughtCard.querySelector('.thought-step');

  const header = _streamThoughtCard.querySelector('.thought-header');
  const body = _streamThoughtCard.querySelector('.thought-body');
  if (header && body) {
    header.addEventListener('click', () => {
      const collapsed = body.classList.toggle('collapsed');
      header.classList.toggle('open', !collapsed);
      body.style.display = collapsed ? 'none' : 'flex';
    });
  }
  if (window.lucide) lucide.createIcons({ parent: _streamThoughtCard });
}

function _finalizeStreamThought() {
  if (_streamThoughtCard) {
    const header = _streamThoughtCard.querySelector('.thought-header');
    const body = _streamThoughtCard.querySelector('.thought-body');
    const titleSpan = _streamThoughtCard.querySelector('.thought-title');

    let elapsedStr = "";
    if (_streamThoughtStartTime > 0) {
      const elapsed = Math.max(1, Math.round((Date.now() - _streamThoughtStartTime) / 1000));
      elapsedStr = ` for ${elapsed}s`;
    }

    if (header) {
      header.classList.remove('thinking-active');
      header.classList.remove('open');
      const spinner = header.querySelector('.thought-spinner');
      if (spinner) spinner.remove();

      if (titleSpan) {
        titleSpan.textContent = `Thought${elapsedStr}`;
      }
    }
    if (body) {
      body.classList.add('collapsed');
      body.style.display = 'none';
    }
  }
  _streamThoughtCard = null;
  _streamThoughtBody = null;
  _streamThoughtText = "";
  _streamThoughtStartTime = 0;
}

function _finalizeReasoning() {
  _reasoningCard = null;
  _reasoningBody = null;
  _reasoningText = "";
}

function _consumeToolRuns() {
  const runs = _currentMessageToolRuns;
  _currentMessageToolRuns = [];
  return runs.length > 0 ? { tool_runs: runs } : null;
}


function _ensureToolContainer(col, enterConversationCallback) {
  if (_streamToolContainer) return;
  enterConversationCallback();

  _streamToolContainer = document.createElement('div');
  _streamToolContainer.className = 'tool-group-card';
  _streamToolContainer.style.cssText = [
    'margin: 6px 0',
    'display: flex',
    'flex-direction: column',
    'font-family: var(--font)',
    'font-size: 12px',
    'color: var(--text-3)',
  ].join(';');

  _streamToolContainer.innerHTML = `
    <div class="tool-group-header" style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; cursor: pointer; user-select: none;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <i data-lucide="chevron-right" class="chevron-icon" style="width:13px; height:13px; opacity:0.6; transition: transform 0.15s; display:inline-block; vertical-align:middle;"></i>
        <span class="tool-group-title" style="font-weight: 500; color: var(--text-secondary);">Actions</span>
      </div>
      <span class="tool-group-status" style="font-size: 11px; opacity: 0.6;">running<span class="dots">.</span></span>
    </div>
    <div class="tool-group-body" style="display: none; flex-direction: column; padding-left: 14px; border-left: 1px dashed var(--border); margin-left: 4px; margin-top: 2px; gap: 3px;">
    </div>
  `;

  col.appendChild(_streamToolContainer);
  _streamToolBody = _streamToolContainer.querySelector('.tool-group-body');
  if (window.lucide) lucide.createIcons({ parent: _streamToolContainer });

  const header = _streamToolContainer.querySelector('.tool-group-header');
  const body = _streamToolContainer.querySelector('.tool-group-body');
  const chevron = _streamToolContainer.querySelector('.chevron-icon');
  
  if (header && body) {
    header.addEventListener('click', () => {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'flex' : 'none';
      if (chevron) {
        chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
      }
    });
  }

  const dotsEl = _streamToolContainer.querySelector('.dots');
  if (dotsEl) {
    _streamToolContainer._dotsInterval = setInterval(() => {
      const dots = dotsEl.textContent;
      dotsEl.textContent = dots.length >= 3 ? '.' : dots + '.';
    }, 400);
  }
}

function _finalizeToolContainer(isSuccess = true) {
  if (_lastToolBlock && _lastToolBlock._dotsInterval) {
    clearInterval(_lastToolBlock._dotsInterval);
    _lastToolBlock._dotsInterval = null;
  }
  _lastToolBlock = null;

  if (!_streamToolContainer) return;
  
  // Stop status dots animation
  if (_streamToolContainer._dotsInterval) {
    clearInterval(_streamToolContainer._dotsInterval);
    _streamToolContainer._dotsInterval = null;
  }

  const statusEl = _streamToolContainer.querySelector('.tool-group-status');
  if (statusEl) {
    statusEl.innerHTML = isSuccess 
      ? '<span style="color: var(--text-3);">✓ completed</span>' 
      : '<span style="color: #ef4444;">✖ failed</span>';
  }

  const titleEl = _streamToolContainer.querySelector('.tool-group-title');
  if (titleEl) {
    titleEl.textContent = 'Actions';
  }

  // Smoothly collapse the body after 2 seconds unless terminal output / open details are present
  const body = _streamToolBody;
  const chevron = _streamToolContainer.querySelector('.chevron-icon');
  const hasOpenDetails = body && body.querySelector('details[open]');
  if (body && body.style.display !== 'none' && !hasOpenDetails) {
    setTimeout(() => {
      if (body) {
        body.style.display = 'none';
        if (chevron) {
          chevron.style.transform = 'rotate(0deg)';
        }
      }
    }, 2000);
  }

  _streamToolContainer = null;
  _streamToolBody      = null;
  _streamToolCount     = 0;
}


function _ensureResponseMsg(enterConversationCallback) {
  if (_streamResponseEl) return;
  enterConversationCallback();

  const col = document.getElementById('chat-col') || document.getElementById('chat-log');
  if (!col) return;

  _streamResponseEl = document.createElement('div');
  _streamResponseEl.className = 'msg ai';
  col.appendChild(_streamResponseEl);
}

function _finalizeStreamResponse() {
  if (_streamResponseEl) {

    ChatSessionManager.appendMessage('assistant', _streamResponseText, _consumeToolRuns());
  }
  _streamResponseEl = null;
  _streamResponseText = "";
}

function _ensureAiderConsoleCard(enterConversationCallback) {
  if (_aiderConsoleCard) return;
  enterConversationCallback();

  const col = document.getElementById('chat-col') || document.getElementById('chat-log');
  if (!col) return;

  _aiderConsoleCard = document.createElement('div');
  _aiderConsoleCard.className = 'aider-console-card';
  _aiderConsoleCard.style.background = 'transparent';
  _aiderConsoleCard.style.margin = '14px 0';
  _aiderConsoleCard.style.overflow = 'hidden';

  _aiderConsoleCard.innerHTML = `
    <div class="console-header" style="padding:10px 0; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border); cursor:pointer; user-select:none;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="console-spinner" style="display:inline-block; width:12px; height:12px; border:1.5px solid var(--text-3); border-top-color:var(--text-primary); border-radius:50%; animation:spin 1s linear infinite;"></span>
        <span class="console-title" style="font-weight:600; font-size:14px; color:var(--text-primary); font-family:var(--font);">Aider Agent</span>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span id="aider-status-badge" style="font-size:11px; font-family:var(--font); font-weight:600; color:var(--text-secondary); text-transform:lowercase; letter-spacing:0.02em;">[scanning]</span>
        <i class="chevron-icon" data-lucide="chevron-down" style="width:14px; height:14px; color:var(--text-secondary); transition:transform 0.15s;"></i>
      </div>
    </div>
    
    <!-- MONOCHROMIC TRANSPARENT HUD PANEL -->
    <div class="aider-ux-panel" style="padding:12px 0; display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13.5px; font-family:var(--font); border-bottom:1px dashed var(--border);">
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; align-items:center; gap:6px; color:var(--text-secondary);">
          <i data-lucide="database" style="width:14px; height:14px; color:var(--text-3);"></i>
          <span>Workspace files:</span>
          <strong id="aider-files-count" style="color:var(--text-primary); font-weight:500;">detecting...</strong>
        </div>
        <div style="display:flex; align-items:center; gap:6px; color:var(--text-secondary);">
          <i data-lucide="file-code" style="width:14px; height:14px; color:var(--text-3);"></i>
          <span>Active file:</span>
          <strong id="aider-active-op" style="color:var(--text-primary); font-family:var(--font); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px; font-weight:500;">none</strong>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px; padding-left:14px; border-left:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:6px; color:var(--text-secondary);">
          <i data-lucide="git-commit" style="width:14px; height:14px; color:var(--text-3);"></i>
          <span>Staged updates:</span>
          <strong id="aider-commits-count" style="color:var(--text-primary); font-weight:500;">0 commits</strong>
        </div>
        <div style="display:flex; align-items:center; gap:6px; color:var(--text-secondary);">
          <i data-lucide="diff" style="width:14px; height:14px; color:var(--text-3);"></i>
          <span>Changeset:</span>
          <span style="font-weight:500; color:var(--text-primary);" id="aider-additions-count">+0</span>
          <span style="font-weight:500; color:var(--text-secondary);" id="aider-deletions-count">-0</span>
        </div>
      </div>
    </div>

    <!-- LIVE EXECUTIONS ACTIVITY FEED -->
    <div id="aider-activity-feed" style="margin: 12px 0 10px 0; font-size: 13.5px; font-family: var(--font); color: var(--text-2); display: flex; flex-direction: column; gap: 6px;">
      <div id="aider-activity-steps" style="display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--text-3);">Â·</span>
          <span>Initializing Aider session...</span>
        </div>
      </div>
    </div>

    <!-- TRANSPARENT MONOSPACE LOG FEED -->
    <div class="console-body" style="padding:10px 0; background:transparent; color:var(--text-2); font-family:var(--font); font-size:14px; max-height:350px; overflow-y:auto; line-height:1.7; white-space:pre-wrap; word-break:break-all;">
    </div>
  `;

  col.appendChild(_aiderConsoleCard);
  _aiderConsoleLogArea = _aiderConsoleCard.querySelector('.console-body');

  const header = _aiderConsoleCard.querySelector('.console-header');
  const body = _aiderConsoleCard.querySelector('.console-body');
  if (header && body) {
    header.addEventListener('click', () => {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      header.querySelector('.chevron-icon').style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  }

  if (!document.getElementById('console-spinner-keyframes')) {
    const style = document.createElement('style');
    style.id = 'console-spinner-keyframes';
    style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  if (window.lucide) lucide.createIcons({ parent: _aiderConsoleCard });
}
