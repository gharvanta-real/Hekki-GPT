/**
 * library_cards.js — Media Card Template Renderers for Universal Library (<500 lines)
 * Uses exact SVG vector icons from D:\Hekki-Assistant (Library-pdf, Library-voice, image, JSON, XLS, DOC)
 * Compact card layout with distinct circular select outlines and live playing states.
 */

export const SVG_ICONS = {
  pdf: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32" fill="currentColor"><polygon points="30 18 30 16 24 16 24 26 26 26 26 22 29 22 29 20 26 20 26 18 30 18"/><path d="M19,26H15V16h4a3.0033,3.0033,0,0,1,3,3v4A3.0033,3.0033,0,0,1,19,26Zm-2-2h2a1.0011,1.0011,0,0,0,1-1V19a1.0011,1.0011,0,0,0-1-1H17Z"/><path d="M11,16H6V26H8V23h3a2.0027,2.0027,0,0,0,2-2V18A2.0023,2.0023,0,0,0,11,16ZM8,21V18h3l.001,3Z"/><path d="M22,14V10a.9092.9092,0,0,0-.3-.7l-7-7A.9087.9087,0,0,0,14,2H4A2.0059,2.0059,0,0,0,2,4V28a2,2,0,0,0,2,2H20V28H4V4h8v6a2.0059,2.0059,0,0,0,2,2h6v2Zm-8-4V4.4L19.6,10Z"/></svg>`,
  
  voice: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32" fill="currentColor"><path d="M25,4H10A2.002,2.002,0,0,0,8,6V20.5563A3.9551,3.9551,0,0,0,6,20a4,4,0,1,0,4,4V12H25v8.5562A3.9545,3.9545,0,0,0,23,20a4,4,0,1,0,4,4V6A2.0023,2.0023,0,0,0,25,4ZM6,26a2,2,0,1,1,2-2A2.0023,2.0023,0,0,1,6,26Zm17,0a2,2,0,1,1,2-2A2.0027,2.0027,0,0,1,23,26ZM10,6H25v4H10Z"/></svg>`,
  
  image: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32" fill="currentColor"><path d="M19,14a3,3,0,1,0-3-3A3,3,0,0,0,19,14Zm0-4a1,1,0,1,1-1,1A1,1,0,0,1,19,10Z"/><path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4Zm0,22H6V20l5-5,5.59,5.59a2,2,0,0,0,2.82,0L21,19l5,5Zm0-4.83-3.59-3.59a2,2,0,0,0-2.82,0L18,19.17l-5.59-5.59a2,2,0,0,0-2.82,0L6,17.17V6H26Z"/></svg>`,
  
  json: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32" fill="currentColor"><polygon points="31 11 31 21 29 21 27 15 27 21 25 21 25 11 27 11 29 17 29 11 31 11"/><path d="M21.3335,21h-2.667A1.6684,1.6684,0,0,1,17,19.3335v-6.667A1.6684,1.6684,0,0,1,18.6665,11h2.667A1.6684,1.6684,0,0,1,23,12.6665v6.667A1.6684,1.6684,0,0,1,21.3335,21ZM19,19h2V13H19Z"/><path d="M13.3335,21H9V19h4V17H11a2.002,2.002,0,0,1-2-2V12.6665A1.6684,1.6684,0,0,1,10.6665,11H15v2H11v2h2a2.002,2.002,0,0,1,2,2v2.3335A1.6684,1.6684,0,0,1,13.3335,21Z"/><path d="M5.3335,21H2.6665A1.6684,1.6684,0,0,1,1,19.3335V17H3v2H5V11H7v8.3335A1.6684,1.6684,0,0,1,5.3335,21Z"/></svg>`,
  
  xls: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32" fill="currentColor"><path d="M28,23H22V21h6V17H24a2.002,2.002,0,0,1-2-2V11a2.002,2.002,0,0,1,2-2h6v2H24v4h4a2.002,2.002,0,0,1,2,2v4A2.0023,2.0023,0,0,1,28,23Z"/><polygon points="14 21 14 9 12 9 12 23 20 23 20 21 14 21"/><polygon points="10 9 8 9 6 15 4 9 2 9 4.752 16 2 23 4 23 6 17 8 23 10 23 7.245 16 10 9"/></svg>`,
  
  doc: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32" fill="currentColor"><path d="M30,23H24a2.0023,2.0023,0,0,1-2-2V11a2.002,2.002,0,0,1,2-2h6v2H24V21h6Z"/><path d="M18,23H14a2.0023,2.0023,0,0,1-2-2V11a2.002,2.002,0,0,1,2-2h4a2.002,2.002,0,0,1,2,2V21A2.0023,2.0023,0,0,1,18,23ZM14,11V21h4V11Z"/><path d="M6,23H2V9H6a4.0045,4.0045,0,0,1,4,4v6A4.0045,4.0045,0,0,1,6,23ZM4,21H6a2.002,2.002,0,0,0,2-2V13a2.002,2.002,0,0,0-2-2H4Z"/></svg>`,
  
  jpg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32" fill="currentColor"><path d="M30,23H24a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2h6v2H24V21h4V17H26V15h4Z"/><path d="M14,23H12V9h6a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H14Zm0-7h4V11H14Z"/><path d="M8,23H4a2,2,0,0,1-2-2V19H4v2H8V9h2V21A2,2,0,0,1,8,23Z"/></svg>`
};

export function getAssetIcon(it) {
  const ext = (it.ext || '').toLowerCase().replace('.', '');
  if (it.type === 'pdf' || ext === 'pdf') return SVG_ICONS.pdf;
  if (it.type === 'voice' || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return SVG_ICONS.voice;
  if (ext === 'json') return SVG_ICONS.json;
  if (['csv', 'xls', 'xlsx'].includes(ext)) return SVG_ICONS.xls;
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return SVG_ICONS.doc;
  if (['jpg', 'jpeg'].includes(ext)) return SVG_ICONS.jpg;
  if (it.type === 'image' || ['png', 'webp', 'gif', 'svg'].includes(ext)) return SVG_ICONS.image;
  return SVG_ICONS.doc;
}

export function renderCardContent(it, isSelected, idx, escHtml, isPlaying = false) {
  const svgIcon = getAssetIcon(it);
  let iconContent = '';
  let metaDesc = '';

  if (it.type === 'image') {
    iconContent = `
      <img src="${it.render_url}" alt="${escHtml(it.name)}" style="width:100%; height:100%; object-fit:cover; border-radius:9px;" onerror="this.outerHTML='${escHtml(SVG_ICONS.image)}';" loading="lazy" />
    `;
    metaDesc = `Image • ${it.size_formatted || ''}`;
  } else if (it.type === 'voice') {
    iconContent = isPlaying ? `
      <div class="lib-equalizer">
        <span class="lib-eq-bar"></span>
        <span class="lib-eq-bar"></span>
        <span class="lib-eq-bar"></span>
        <span class="lib-eq-bar"></span>
      </div>
    ` : svgIcon;
    metaDesc = `Voice Audio • ${it.size_formatted || ''}`;
  } else if (it.type === 'pdf') {
    iconContent = svgIcon;
    metaDesc = `PDF Document • ${it.size_formatted || ''}`;
  } else {
    iconContent = svgIcon;
    metaDesc = `${(it.ext || 'DATA').toUpperCase()} • ${it.size_formatted || ''}`;
  }

  return `
    <div style="display:flex; gap:10px; align-items:center; flex:1; min-width:0;">
      <!-- Circular Select Checkbox with Clear Outline -->
      <div class="img-card-checkbox ${isSelected ? 'checked' : ''}" data-idx="${idx}" title="Select item">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="opacity:${isSelected ? '1' : '0'};"><polyline points="20 6 9 17 4 12"/></svg>
      </div>

      <!-- Compact Icon Box (36x36) -->
      <div class="lib-icon-box" style="width:36px; height:36px; min-width:36px; min-height:36px; border-radius:10px; background:${isPlaying ? 'var(--hover)' : 'var(--input-bg)'}; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text); overflow:hidden;">
        ${iconContent}
      </div>

      <!-- Text Details -->
      <div style="display:flex; flex-direction:column; gap:1px; min-width:0; flex:1;">
        <div style="font-size:13px; font-weight:400; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(it.name)}</div>
        <div style="font-size:11.5px; color:var(--text-3); line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:400;">${metaDesc}</div>
      </div>
    </div>

    <!-- Action Buttons (Download / Delete / Play) -->
    <div class="img-card-actions" style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
      ${it.type === 'voice' ? `
        <button class="img-card-btn img-play-btn ${isPlaying ? 'playing' : ''}" data-idx="${idx}" title="${isPlaying ? 'Pause Audio' : 'Play Audio'}" style="width:28px; height:28px; min-width:28px; border-radius:8px; background:${isPlaying ? 'var(--hover)' : 'var(--input-bg)'}; border:none !important; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text);">
          ${isPlaying ? `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ` : `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          `}
        </button>
      ` : ''}
      <button class="img-card-btn img-dl-btn" data-idx="${idx}" title="Download" style="width:28px; height:28px; min-width:28px; border-radius:8px; background:var(--input-bg); border:none !important; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text);">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor"><path d="M23.5,22H23V20h.5a4.5,4.5,0,0,0,.36-9L23,11l-.1-.82a7,7,0,0,0-13.88,0L9,11,8.14,11a4.5,4.5,0,0,0,.36,9H9v2H8.5A6.5,6.5,0,0,1,7.2,9.14a9,9,0,0,1,17.6,0A6.5,6.5,0,0,1,23.5,22Z"/><polygon points="17 26.17 17 14 15 14 15 26.17 12.41 23.59 11 25 16 30 21 25 19.59 23.59 17 26.17"/></svg>
      </button>
      <button class="img-card-btn img-del-btn" data-idx="${idx}" title="Delete" style="width:28px; height:28px; min-width:28px; border-radius:8px; background:var(--input-bg); border:none !important; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text);">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
      </button>
    </div>
  `;
}
