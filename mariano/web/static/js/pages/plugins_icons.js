/**
 * plugins_icons.js — Vector Brand and Service Logos for MCP Plugins & Connectors
 */
export function getCompanyLogoSvg(id, size = 16) {
  const norm = String(id||'').toLowerCase();
  if (norm.includes('gmail') || norm.includes('email') || norm === 'mail') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M28,6H4A2,2,0,0,0,2,8V24a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V8A2,2,0,0,0,28,6ZM25.8,8,16,14.78,6.2,8ZM4,24V8.91l11.43,7.91a1,1,0,0,0,1.14,0L28,8.91V24Z"/></svg>`;
  }
  if (norm.includes('brave')) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="width:${size}px;height:${size}px;display:block;"><path fill="#FF1B2D" d="M12 0L2 6l3.5 13.5L12 24l6.5-4.5L22 6z"/><path fill="#FF6500" d="M12 3.2L4.5 7.6l2.6 10.3L12 21l4.9-3.1 2.6-10.3z"/><path fill="#FFF" d="M12 6.5l3.5 2.1-1.3 5.3-2.2 1.4-2.2-1.4-1.3-5.3z"/></svg>`;
  }
  if (norm.includes('calendar') || norm.includes('gcalendar')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M26,4h-4V2h-2v2h-8V2h-2v2H6C4.9,4,4,4.9,4,6v20c0,1.1,0.9,2,2,2h20c1.1,0,2-0.9,2-2V6C28,4.9,27.1,4,26,4z M26,26H6V12h20V26z M26,10H6V6h4v2h2V6h8v2h2V6h4V10z"/></svg>`;
  }
  if (norm.includes('gdrive') || norm.includes('drive')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M28,20H26v2h2v6H4V22H14V20H4a2,2,0,0,0-2,2v6a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V22A2,2,0,0,0,28,20Z"/><circle cx="7" cy="25" r="1"/><path d="M21,14a2.98,2.98,0,0,0-2,.81l-4-2.4A2.96,2.96,0,0,0,15,12a2.96,2.96,0,0,0,0-.41L18.96,9.19A3,3,0 1,0,18,7a2.93,2.93,0,0,0,0,.41L14,9.81a3,3,0 1,0,0,4.38l4,2.4A2.93,2.93,0,0,0,18,17a3,3,0,1,0,3-3Zm0-8a1,1,0,1,1-1,1A1,1,0,0,1,21,6Zm-9,7a1,1,0,1,1,1-1A1,1,0,0,1,12,13Zm9,5a1,1,0,1,1,1-1A1,1,0,0,1,21,18Z"/></svg>`;
  }
  if (norm.includes('linear')) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="width:${size}px;height:${size}px;display:block;"><path fill="#5E6AD2" d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z"/><path fill="#FFFFFF" d="M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0z"/></svg>`;
  }
  if (norm.includes('figma')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M23.6,11.6c1-.6,1.7-1.5,2.1-2.6.4-1.1.4-2.2.1-3.3-.3-1.1-1-2-1.9-2.7-.9-.7-2.1-1-3.2-1h-9.2c-1.2,0-2.3.4-3.2,1C7.2,3.7,6.6,4.7,6.2,5.7,5.9,6.8,5.9,8,6.3,9c.4,1.1,1.1,2,2.1,2.6-.7.5-1.4,1.1-1.8,1.9-.4.8-.6,1.6-.6,2.5,0,.9.2,1.7.6,2.5.4.8,1,1.4,1.8,1.9-1,.6-1.7,1.5-2.1,2.6-.4,1.1-.4,2.2-.1,3.3.3,1.1,1,2,2,2.7.9.7,2.1,1,3.2,1,1.4,0,2.8-.6,3.9-1.5,1-1,1.6-2.3,1.6-3.7v-4.8c1,.9,2.3,1.4,3.6,1.4h.1c1.2,0,2.3-.4,3.2-1,.9-.7,1.6-1.6,1.9-2.7.3-1.1.3-2.2-.1-3.3C25.3,13.1,24.5,12.2,23.6,11.6ZM16.9,3.7h3.7c.5,0,1,0,1.4.2.5.2.9.4,1.2.8.4.3.6.7.8,1.2.2.5.3.9.3,1.4,0,.5-.1,1-.3,1.4-.2.4-.5.8-.8,1.2-.4.3-.8.6-1.2.8-.5.2-1,.2-1.4.2h-3.7V3.7ZM11.4,3.7h3.7v7h-3.7c-.9,0-1.8-.4-2.4-1.1-.6-.7-.9-1.6-.9-2.5s.4-1.8,1-2.4c.6-.7,1.5-1.1,2.4-1.2ZM7.8,16c0-.9.4-1.8,1.1-2.5.7-.7,1.6-1,2.6-1h3.7v7h-3.7c-1,0-1.9-.4-2.6-1C8.2,17.8,7.8,16.9,7.8,16ZM15.1,24.7c0,1-.4,1.9-1.1,2.5-.7.7-1.6,1-2.6,1-.5,0-1,0-1.4-.2-.5-.2-.9-.4-1.2-.7-.4-.3-.6-.7-.8-1.2-.2-.4-.3-.9-.3-1.4,0-.5.1-1,.3-1.4.2-.4.5-.8.8-1.2.4-.3.8-.6,1.2-.8.5-.2,1-.2,1.4-.2h3.7ZM20.6,19.5h-.1c-.9,0-1.8-.4-2.4-1.1-.6-.7-1-1.5-1-2.4,0-.9.4-1.8,1-2.4.6-.7,1.5-1,2.4-1.1h.1c.5,0,1,0,1.4.2.5.2.9.4,1.2.8.4.3.6.7.8,1.2.2.4.3.9.3,1.4,0,.5-.1,1-.3,1.4-.2.4-.5.8-.8,1.2-.4.3-.8.6-1.2.8C21.6,19.5,21.1,19.5,20.6,19.5Z"/></svg>`;
  }
  if (norm.includes('postgres')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M22.98,28.88c-4.05,0-5.59-1.06-5.59-2.83a2.21,2.21,0,0,1,2.14-2.3v-.25a1.97,1.97,0,0,1-1.54-2c0-1.24,1.06-1.86,2.21-2.12v-.09a3.62,3.62,0,0,1-2.18-3.5c0-2.44,1.72-4.07,4.97-4.07a6.68,6.68,0,0,1,2.09.3v-.39a1.53,1.53,0,0,1,1.7-1.75h1.86v2.25H26.08v.32a3.59,3.59,0,0,1,1.86,3.33c0,2.41-1.7,4.02-4.97,4.02a7.37,7.37,0,0,1-1.84-.21,1.23,1.23,0,0,0-.85,1.08c0,.6.51.9,1.56.9h3.22c2.94,0,4.21,1.26,4.21,3.43C29.28,27.52,27.58,28.88,22.98,28.88Zm1.49-4.74H20.38A1.47,1.47,0,0,0,19.76,25.38c0,.92.69,1.47,2.53,1.47h1.47c1.91,0,2.76-.48,2.76-1.49C26.52,24.6,25.97,24.14,24.47,24.14Zm.67-8.16v-.39c0-1.22-.76-1.84-2.16-1.84s-2.16.62-2.16,1.84v.39c0,1.2.76,1.84,2.16,1.84S25.14,17.17,25.14,15.97Z"/><path d="M4.6,24V7.95h7.22c2.97,0,4.76,2,4.76,4.97,0,2.99-1.79,4.97-4.76,4.97H7.64V24Zm3.04-8.74h3.91a1.69,1.69,0,0,0,1.88-1.82V12.39a1.67,1.67,0,0,0-1.88-1.79H7.64Z"/></svg>`;
  }
  if (norm.includes('word')) return `<img src="/static/icons/ms-word.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  if (norm.includes('excel')) return `<img src="/static/icons/excel.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  if (norm.includes('gcloud') || norm.includes('cloud')) return `<img src="/static/icons/google-cloud.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  if (norm.includes('filesystem') || norm.includes('file')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M25.7,9.3l-7-7C18.5,2.1,18.3,2,18,2H8C6.9,2,6,2.9,6,4v24c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V10C26,9.7,25.9,9.5,25.7,9.3z M18,4.4l5.6,5.6H18V4.4z M24,28H8V4h8v6c0,1.1,0.9,2,2,2h6V28z"/><rect x="10" y="22" width="12" height="2"/><rect x="10" y="16" width="12" height="2"/></svg>`;
  }
  if (norm.includes('github')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path fill-rule="evenodd" d="M16,2a14,14,0,0,0-4.43,27.28c.7.13,1-.3,1-.67s0-1.21,0-2.38c-3.89.84-4.71-1.88-4.71-1.88A3.71,3.71,0,0,0,6.24,22.3c-1.27-.86.1-.85.1-.85A2.94,2.94,0,0,1,8.48,22.9a3,3,0,0,0,4.08,1.16,2.93,2.93,0,0,1,.88-1.87c-3.1-.36-6.37-1.56-6.37-6.92a5.4,5.4,0,0,1,1.44-3.76,5,5,0,0,1,.14-3.7s1.17-.38,3.85,1.43a13.3,13.3,0,0,1,7,0c2.67-1.81,3.84-1.43,3.84-1.43a5,5,0,0,1,.14,3.7,5.4,5.4,0,0,1,1.44,3.76c0,5.38-3.27,6.56-6.39,6.91a3.33,3.33,0,0,1,.95,2.59c0,1.87,0,3.38,0,3.84s.25.81,1,.67A14,14,0,0,0,16,2Z"/></svg>`;
  }
  if (norm.includes('slack')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M9.04,19.17A2.52,2.52,0,1,1,6.52,16.65H9.04Z"/><path d="M10.31,19.17a2.52,2.52,0,0,1,5.04,0v6.31a2.52,2.52,0,1,1-5.04,0Z"/><path d="M12.83,9.04A2.52,2.52,0,1,1,15.36,6.52V9.04Z"/><path d="M12.83,10.31a2.52,2.52,0,0,1,0,5.04H6.52a2.52,2.52,0,1,1,0-5.04Z"/><path d="M22.96,12.83a2.52,2.52,0,1,1,2.52,2.52H22.96Z"/><path d="M21.69,12.83a2.52,2.52,0,0,1-5.04,0V6.52a2.52,2.52,0,1,1,5.04,0Z"/><path d="M19.17,22.96a2.52,2.52,0,1,1-2.52,2.52V22.96Z"/><path d="M19.17,21.69a2.52,2.52,0,0,1,0-5.04h6.31a2.52,2.52,0,1,1,0,5.04Z"/></svg>`;
  }
  if (norm.includes('notion')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M24,25h-3v-3h3v3ZM29,22h-3v3h3v-3ZM24,27h-3v3h3v-3ZM29,27h-3v3h3v-3ZM20,8h-8v2h8v-2ZM17,28H6v-4h2v-2h-2v-5h2v-2h-2v-5h2v-2h-2v-4h18v15h2V4c0-1.1-.9-2-2-2H6c-1.1,0-2,.9-2,2v4h-2v2h2v5h-2v2h2v5h-2v2h2v4c0,1.1.9,2,2,2h11v-2ZM20,15h-8v2h8v-2Z"/></svg>`;
  }
  if (norm.includes('sqlite') || norm.includes('sql')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><polygon points="24 21 24 9 22 9 22 23 30 23 30 21 24 21"/><path d="M18,9H14a2,2,0,0,0-2,2V21a2,2,0,0,0,2,2h1v2a2,2,0,0,0,2,2h2V25H17V23h1a2,2,0,0,0,2-2V11A2,2,0,0,0,18,9ZM14,21V11h4V21Z"/><path d="M8,23H2V21H8V17H4a2,2,0,0,1-2-2V11A2,2,0,0,1,4,9h6v2H4v4H8a2,2,0,0,1,2,2v4A2,2,0,0,1,8,23Z"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-plugins" style="width:${size}px; height:${size}px; display:inline-block; vertical-align:middle;"><path d="M9 2v6M15 2v6M12 17v5M5 8h14a1 1 0 0 1 1 1v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9a1 1 0 0 1 1-1z"></path></svg>`;
}
