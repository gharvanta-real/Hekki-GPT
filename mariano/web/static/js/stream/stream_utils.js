/**
 * stream_utils.js — Utilities for agent stream rendering (planner metadata filtering, html escaping).
 */

const PLANNER_PREFIX_RE = /^\s*-?\s*\*{0,2}(\s*)(Current State( Analysis)?|Plan Status|Next Logical Step|Next Step|Analysis( of Current State)?|Previous Steps?|Remaining steps|Previous steps were|implicitly handled|Step \d+\/\d+)\b/i;
const PLANNER_NARRATION_RE = /^\s*-\s+(The (user|repository|previous attempt|current repo|project)|Since the user|I will (not |now |provide|execute)|This means|The core system|The specific UI)/i;

export function stripPlannerMetadata(text) {
  if (!text) return text;
  
  let cleaned = text.replace(/<(think|thinking)>[\s\S]*?(?:<\/\1>|$)/gi, '');

  if (/^(?:\d+\.\s*\*\*(?:Analyze|Safety|Policy|Persona|Constraint|Formulate).*?\*\*)/i.test(cleaned.trim())) {
    const paragraphs = cleaned.split(/\n\s*\n/);
    const contentPs = [];
    let inThought = true;

    for (let p of paragraphs) {
      const trimmedP = p.trim();
      if (inThought && (/^(?:\d+\.\s*\*|\*\*(?:Analyze|Safety|Policy|Persona|Constraint|Formulate).*?\*\*)/i.test(trimmedP) || trimmedP.startsWith('* **') || trimmedP.startsWith('- **'))) {
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
