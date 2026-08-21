/**
 * stream_utils.js — Utilities for agent stream rendering (sanitization, planner metadata filtering, audio alerts).
 */

export function sanitizeHtml(html) {
  if (!html) return '';
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?\/>/gi, '');
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  clean = clean.replace(/href\s*=\s*["']?javascript:[^"'>\s]*/gi, 'href="#"');
  return clean;
}

export function playReminderChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
  } catch (err) {
    console.warn('Reminder chime playback blocked:', err);
  }
}

const PLANNER_PREFIX_RE = /^\s*-?\s*\*{0,2}(\s*)(Current State( Analysis)?|Plan Status|Next Logical Step|Next Step|Analysis( of Current State)?|Previous Steps?|Remaining steps|Previous steps were|implicitly handled|Step \d+\/\d+|Target Files?|Minimal Action Scope|Verification Plan|Tech Stack|Constraint Checklist|Intent Analysis|Architecture Check)\b/i;
const PLANNER_NARRATION_RE = /^\s*-\s+(The (user|repository|previous attempt|current repo|project)|Since the user|I will (not |now |provide|execute)|This means|The core system|The specific UI)/i;

export function stripPlannerMetadata(text) {
  if (!text) return text;
  
  let cleaned = text
    .replace(/<(think|thinking|thought|planning|analysis)>[\s\S]*?(?:<\/\1>|$)/gi, '')
    .replace(/```(?:xml)?\s*<(think|thinking|thought|planning|analysis)>[\s\S]*?(?:<\/\1>|$)\s*```/gi, '');

  if (/^(?:\d+\.\s*\*\*(?:Analyze|Safety|Policy|Persona|Constraint|Formulate|Target|Minimal|Verification).*?\*\*)/i.test(cleaned.trim())) {
    const paragraphs = cleaned.split(/\n\s*\n/);
    const contentPs = [];
    let inThought = true;

    for (let p of paragraphs) {
      const trimmedP = p.trim();
      if (inThought && (/^(?:\d+\.\s*\*|\*\*(?:Analyze|Safety|Policy|Persona|Constraint|Formulate|Target|Minimal|Verification).*?\*\*)/i.test(trimmedP) || trimmedP.startsWith('* **') || trimmedP.startsWith('- **'))) {
        continue;
      } else {
        inThought = false;
        contentPs.push(p);
      }
    }

    if (contentPs.length > 0) {
      cleaned = contentPs.join('\n\n');
    }
  }

  const lines = cleaned.split('\n');
  const filtered = lines.filter(line =>
    !PLANNER_PREFIX_RE.test(line) && !PLANNER_NARRATION_RE.test(line)
  );
  return filtered
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
