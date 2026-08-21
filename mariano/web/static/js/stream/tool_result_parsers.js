/**
 * tool_result_parsers.js — Specialized parsers for tool execution outputs & metadata.
 * Converts raw text and JSON returns from 38 skills into clean structured UI data objects.
 */

export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Parses directory listing outputs
 */
export function parseDirectoryEntries(data, metadata) {
  if (metadata && Array.isArray(metadata.items) && metadata.items.length > 0) {
    return metadata.items.map(it => ({
      name: it.name || it.path || '',
      isDir: !!it.is_dir,
      size: it.size ? formatBytes(it.size) : ''
    }));
  }

  if (typeof data !== 'string') return [];
  const lines = data.split('\n');
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('Directory:') || trimmed === '(empty)') continue;

    if (trimmed.startsWith('__DIR__')) {
      const name = trimmed.replace('__DIR__', '').trim();
      items.push({ name, isDir: true, size: '' });
    } else if (trimmed.startsWith('__FILE__')) {
      const match = trimmed.replace('__FILE__', '').trim().match(/^(.*?)(?:\s+\(([\d,]+B?)\))?$/);
      if (match) {
        items.push({ name: match[1].trim(), isDir: false, size: match[2] || '' });
      } else {
        items.push({ name: trimmed.replace('__FILE__', '').trim(), isDir: false, size: '' });
      }
    } else if (trimmed.startsWith('{"name"') || trimmed.startsWith('{"isDir"')) {
      try {
        const parsed = JSON.parse(trimmed);
        items.push({
          name: parsed.name || '',
          isDir: !!parsed.isDir,
          size: parsed.sizeBytes ? formatBytes(parseInt(parsed.sizeBytes, 10)) : ''
        });
      } catch (e) {}
    }
  }

  items.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return items;
}

/**
 * Detects RTF codes, hex dumps, and binary artifacts in text snippets.
 */
export function isGarbageSnippet(s) {
  if (!s || typeof s !== 'string') return true;
  const str = s.trim();
  if (str.length === 0) return true;
  if (str.startsWith('\\') || str.includes('\\level') || str.includes('\\rtf') || str.includes('\\rtlch') || str.includes('\'02')) return true;
  if (/[0-9a-fA-F]{24,}/.test(str)) return true;
  if (str.includes('\ufffd') || str.includes('')) return true;
  const words = str.match(/[a-zA-Z0-9_]/g) || [];
  if (str.length > 25 && (words.length / str.length) < 0.4) return true;
  return false;
}

/**
 * Parses search or find_by_name results
 */
export function parseSearchResults(data, metadata) {
  if (metadata && Array.isArray(metadata.items) && metadata.items.length > 0) {
    return metadata.items.map(it => {
      const full = it.path || it.name || '';
      const parts = full.split(/[/\\]/);
      const name = parts.pop() || full;
      const folder = parts.length > 0 ? parts.slice(-2).join('/') : '';
      return { name, folder, fullPath: full, isDir: !!it.is_dir };
    });
  }

  if (typeof data !== 'string') return [];
  const lines = data.split('\n');
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('Found ') || trimmed.startsWith('No files matching')) continue;
    const isDir = !trimmed.includes('.') || trimmed.endsWith('/') || trimmed.endsWith('\\');
    const parts = trimmed.split(/[/\\]/);
    const name = parts.pop() || trimmed;
    const folder = parts.length > 0 ? parts.slice(-2).join('/') : '';
    items.push({ name, folder, fullPath: trimmed, isDir });
  }

  return items;
}

/**
 * Parses grep search results, filtering binary/RTF noise and grouping matches by file.
 */
export function parseGrepResults(data) {
  if (typeof data !== 'string') return [];
  const lines = data.split('\n');
  const fileMap = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('No matches for') || trimmed.startsWith('Binary file')) continue;
    const match = trimmed.match(/^([^:]+):(\d+):\s*(.*)$/);
    if (match) {
      const fullPath = match[1];
      const lineNum = match[2];
      const rawSnippet = match[3];
      const snippet = isGarbageSnippet(rawSnippet) ? '' : rawSnippet.trim();
      
      const parts = fullPath.split(/[/\\]/);
      const fileName = parts.pop() || fullPath;
      const folder = parts.length > 0 ? parts.slice(-2).join('/') : '';

      if (!fileMap.has(fullPath)) {
        fileMap.set(fullPath, {
          file: fileName,
          folder,
          fullPath,
          lines: [lineNum],
          snippet
        });
      } else {
        const entry = fileMap.get(fullPath);
        if (!entry.lines.includes(lineNum)) {
          entry.lines.push(lineNum);
        }
        if (!entry.snippet && snippet) {
          entry.snippet = snippet;
        }
      }
    }
  }
  return Array.from(fileMap.values());
}

/**
 * Parses web search results
 */
export function parseWebSearchResults(data, metadata) {
  if (metadata && Array.isArray(metadata.results) && metadata.results.length > 0) {
    return metadata.results.map(r => ({
      title: r.title || r.name || '',
      url: r.url || r.link || '',
      snippet: r.snippet || r.body || '',
      domain: r.domain || (r.url ? new URL(r.url).hostname.replace('www.', '') : '')
    }));
  }

  if (typeof data !== 'string') return [];
  const results = [];

  // 1. Try JSON array parse
  try {
    const parsed = JSON.parse(data);
    const arr = Array.isArray(parsed) ? parsed : (parsed.results || parsed.organic || parsed.items || []);
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map(r => {
        let domain = r.domain || '';
        if (!domain && r.url) {
          try { domain = new URL(r.url).hostname.replace('www.', ''); } catch (e) {}
        }
        return {
          title: r.title || r.name || '',
          url: r.url || r.link || '',
          snippet: r.snippet || r.body || '',
          domain
        };
      });
    }
  } catch (e) {}

  // 2. Parse Numbered/Bullet Items with "URL: https://" (e.g. 1. **Title** \n URL: https://...)
  const blockRegex = /(?:^|\n)(?:\d+\.|\*|-)\s*\*\*([^*]+)\*\*[\s\S]*?URL:\s*(https?:\/\/[^\s\n\)]+)/gi;
  let match;
  while ((match = blockRegex.exec(data)) !== null) {
    const rawTitle = match[1].trim();
    const rawUrl = match[2].trim();
    let domain = '';
    const sourceMatch = rawTitle.match(/[-–|]\s*([A-Za-z0-9.\s]+)$/);
    if (sourceMatch && sourceMatch[1]) {
      domain = sourceMatch[1].trim();
    } else {
      try {
        const u = new URL(rawUrl);
        domain = u.hostname.replace('www.', '');
      } catch (e) {}
    }
    results.push({
      title: rawTitle,
      url: rawUrl,
      domain
    });
  }
  if (results.length > 0) return results;

  // 3. Parse standard markdown links [Title](https://...)
  const linkMatches = data.matchAll(/\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/g);
  for (const m of linkMatches) {
    try {
      const urlObj = new URL(m[2]);
      results.push({
        title: m[1] || urlObj.hostname,
        url: m[2],
        domain: urlObj.hostname.replace('www.', '')
      });
    } catch (e) {}
  }
  return results;
}


/**
 * Parses live news headlines
 */
export function parseNewsResults(data, metadata) {
  if (metadata && Array.isArray(metadata.headlines) && metadata.headlines.length > 0) {
    return metadata.headlines.map(h => ({
      source: h.source || 'News',
      title: h.title || h.headline || '',
      url: h.url || ''
    }));
  }

  if (typeof data !== 'string') return [];
  const items = [];
  const lines = data.split('\n');
  for (const line of lines) {
    const match = line.match(/^[-*•]?\s*(?:\[(.*?)\])?\s*(.*?)(?:\s*\((https?:\/\/[^\)]+)\))?$/);
    if (match && match[2] && match[2].length > 10) {
      items.push({
        source: match[1] || 'News',
        title: match[2].trim(),
        url: match[3] || ''
      });
    }
  }
  return items;
}

/**
 * Parses weather tool outputs
 */
export function parseWeatherResults(data, metadata) {
  if (metadata && (metadata.temperature !== undefined || metadata.temp !== undefined)) {
    return {
      city: metadata.city || metadata.location || '',
      temp: metadata.temperature || metadata.temp || '',
      condition: metadata.condition || metadata.weather || '',
      humidity: metadata.humidity ? `${metadata.humidity}%` : '',
      wind: metadata.wind_speed || metadata.wind || ''
    };
  }

  if (typeof data !== 'string') return null;
  const tempMatch = data.match(/(-?\d+(?:\.\d+)?)\s*°?\s*([CF])/i);
  const cityMatch = data.match(/(?:in|for|at)\s+([A-Z][a-zA-Z\s,]+)/);
  if (tempMatch) {
    return {
      city: cityMatch ? cityMatch[1].trim() : '',
      temp: `${tempMatch[1]}°${tempMatch[2].toUpperCase()}`,
      condition: '',
      humidity: '',
      wind: ''
    };
  }
  return null;
}

/**
 * Parses stock data outputs
 */
export function parseStockResults(data, metadata) {
  if (metadata && metadata.symbol) {
    return {
      symbol: metadata.symbol,
      price: metadata.price || metadata.current_price || '',
      change: metadata.change_percent || metadata.change || '',
      currency: metadata.currency || 'USD'
    };
  }
  if (typeof data !== 'string') return null;
  const match = data.match(/([A-Z0-9\.\^]{1,10})\s*[:\-]?\s*([$₹€£]?\s*[\d,]+(?:\.\d+)?)\s*(?:\(([\+\-]?\d+(?:\.\d+)?%?)\))?/);
  if (match) {
    return {
      symbol: match[1],
      price: match[2],
      change: match[3] || '',
      currency: ''
    };
  }
  return null;
}

/**
 * Parses security scanner outputs
 */
export function parseSecurityResults(data, metadata) {
  if (metadata && (metadata.grade || metadata.score !== undefined || metadata.findings)) {
    return {
      target: metadata.target || metadata.host || '',
      grade: metadata.grade || (metadata.score !== undefined ? `${metadata.score}/100` : ''),
      passed: metadata.passed_count || 0,
      failed: metadata.failed_count || 0,
      risk: metadata.risk_level || ''
    };
  }
  return null;
}

/**
 * Parses physics and numerical simulations
 */
export function parseSimulationResults(data, metadata) {
  if (metadata && metadata.solver) {
    return {
      solver: metadata.solver,
      trl: metadata.trl || 'TRL 1-2 (Theoretical)',
      method: metadata.method || '',
      execution_time: metadata.time_ms ? `${metadata.time_ms}ms` : ''
    };
  }
  if (typeof data === 'string' && data.includes('Simulation Result')) {
    const solverMatch = data.match(/Result — ([A-Z0-9\s_]+)/i);
    return {
      solver: solverMatch ? solverMatch[1].trim() : 'Simulation',
      trl: 'TRL 1-2',
      method: '',
      execution_time: ''
    };
  }
  return null;
}
