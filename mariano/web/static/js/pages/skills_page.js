/**
 * skills_page.js — ChatGPT/Plugins-Style Full-Page Skills & Capabilities Hub for Hekki.
 *
 * Fully integrated with Hekki's Legacy CSS Tokens (var(--bg), var(--card), etc.).
 * Views: 'catalog' (2-column grid categorized) | 'detail' (Parameters & Metadata Table)
 */

function getSkillRealLogoSvg(name, size = 18) {
  const norm = String(name || '').toLowerCase();
  
  if (norm.includes('deep_research') || norm.includes('deep_search') || norm.includes('reasoning') || norm.includes('cognitive')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M30,13A11,11,0,0,0,19,2H11a9,9,0,0,0-9,9v3a5,5,0,0,0,5,5H8.1A5,5,0,0,0,13,23h1.38l4,7,1.73-1-4-6.89A2,2,0,0,0,14.38,21H13a3,3,0,0,1,0-6h1V13H13a5,5,0,0,0-4.9,4H7a3,3,0,0,1-3-3V12H6A3,3,0,0,0,9,9V8H7V9a1,1,0,0,1-1,1H4.08A7,7,0,0,1,11,4h6V6a1,1,0,0,1-1,1H14V9h2a3,3,0,0,0,3-3V4a9,9,0,0,1,8.05,5H26a3,3,0,0,0-3,3v1h2V12a1,1,0,0,1,1-1h1.77A8.76,8.76,0,0,1,28,13v1a5,5,0,0,1-5,5H20v2h3a7,7,0,0,0,3-.68V21a3,3,0,0,1-3,3H22v2h1a5,5,0,0,0,5-5V18.89A7,7,0,0,0,30,14Z"/></svg>`;
  }
  if (norm.includes('recon') || norm.includes('recognition') || norm.includes('scanner')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M7,5.21a.77.77,0,0,1-.46-1.38A15.46,15.46,0,0,1,16,1c2.66,0,6.48.45,9.5,2.62a.77.77,0,0,1,.18,1.07.78.78,0,0,1-1.08.17A15,15,0,0,0,16,2.53,14,14,0,0,0,7.5,5.05.74.74,0,0,1,7,5.21Z"/><path d="M28.23,12.26a.78.78,0,0,1-.63-.33C25.87,9.49,22.78,6.24,16,6.24a14,14,0,0,0-11.63,5.7.77.77,0,0,1-1.07.17A.76.76,0,0,1,3.15,11,15.54,15.54,0,0,1,16,4.71c5.61,0,9.81,2.08,12.84,6.34a.77.77,0,0,1-.19,1.07A.79.79,0,0,1,28.23,12.26Z"/><path d="M12.28,31a.78.78,0,0,1-.72-.49.75.75,0,0,1,.44-1c4.37-1.68,7-5.12,7-9.21a2.8,2.8,0,0,0-3-3c-1.86,0-2.76,1-3,3.35a4.27,4.27,0,0,1-4.52,3.83,4.27,4.27,0,0,1-4.32-4.59A11.71,11.71,0,0,1,16,8.39a12,12,0,0,1,12,11.93,18.66,18.66,0,0,1-1.39,6.5.78.78,0,0,1-1,.41.76.76,0,0,1-.41-1,17.25,17.25,0,0,0,1.27-5.91A10.45,10.45,0,0,0,16,9.92a10.18,10.18,0,0,0-10.38,10,2.77,2.77,0,0,0,2.79,3.06,2.74,2.74,0,0,0,3-2.48c.36-3.11,1.89-4.69,4.56-4.69a4.31,4.31,0,0,1,4.52,4.56c0,4.74-3,8.72-8,10.63A.92.92,0,0,1,12.28,31Z"/><path d="M19.77,30.28a.81.81,0,0,1-.52-.2.76.76,0,0,1,0-1.08,12.63,12.63,0,0,0,3.54-8.68c0-1.56-.48-6.65-6.7-6.65a6.83,6.83,0,0,0-4.94,1.87A6.17,6.17,0,0,0,9.32,20a.77.77,0,0,1-.77.76h0A.76.76,0,0,1,7.78,20,7.73,7.73,0,0,1,10,14.46a8.34,8.34,0,0,1,6-2.32c6.08,0,8.24,4.4,8.24,8.18A14.09,14.09,0,0,1,20.34,30,.75.75,0,0,1,19.77,30.28Z"/><path d="M8.66,27.74a14.14,14.14,0,0,1-1.56-.09.76.76,0,1,1,.17-1.52c2.49.28,4.45-.16,5.84-1.32a6.37,6.37,0,0,0,2.12-4.53.75.75,0,0,1,.82-.71.78.78,0,0,1,.72.81A7.89,7.89,0,0,1,14.09,26,8.2,8.2,0,0,1,8.66,27.74Z"/></svg>`;
  }
  if (norm.includes('coder') || norm.includes('refactor')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="m11,28h-2c-3.8599,0-7-3.1401-7-7v-2h2v2c0,2.7568,2.2432,5,5,5h2v2Z"/><polygon points="28.17 26 25.59 28.58 27 30 31 26 27 22 25.58 23.41 28.17 26"/><polygon points="22 31 20.085 30.4229 23 21 24.9149 21.5771 22 31"/><polygon points="16.83 26 19.41 23.42 18 22 14 26 18 30 19.42 28.59 16.83 26"/><path d="m30,19h-2v-7c0-2.7614-2.2386-5-5-5h-4v-2h4c3.866,0,7,3.134,7,7v7Z"/><circle cx="3" cy="4" r="1"/><rect x="6" y="3" width="10" height="2"/><circle cx="3" cy="12" r="1"/><rect x="6" y="11" width="10" height="2"/><rect x="2" y="15" width="10" height="2"/><circle cx="15" cy="8" r="1"/><rect x="2" y="7" width="10" height="2"/><circle cx="15" cy="16" r="1"/></svg>`;
  }
  if (norm.includes('memory') || norm.includes('sqlite') || norm.includes('memory_ops')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="m12,28h-2c-3.8599,0-7-3.1401-7-7v-2h2v2c0,2.7568,2.2432,5,5,5h2v2Z"/><path d="m28,19h-9c-1.104.0014-1.9986.896-2,2v5c0,1.1046.8954,2,2,2h3v-2h-3v-5h9v5h-2.5352l-2.5937,3.8906,1.6641,1.1094,2-3h1.4648c1.1046,0,2-.8954,2-2v-5c-.0014-1.104-.896-1.9986-2-2Z"/><path d="m29,15v-4c0-3.8599-3.1401-7-7-7h-3v2h3c2.7568,0,5,2.2432,5,5v4h2Z"/><rect x="6" y="10" width="3" height="2"/><path d="m12.606,6.4355l-2.5251-3.6855c-.3821-.4766-.9512-.75-1.5615-.75h-4.5193c-1.1028,0-2,.8975-2,2v10c0,1.1025.8972,2,2,2h7c1.1028,0,2-.8975,2-2v-6.375c0-.4526-.1558-.8965-.394-1.1895Zm-8.606,7.5645V4h4v3c0,.5522.4478,1,1,1h2v6h-7Z"/></svg>`;
  }
  if (norm.includes('morning') || norm.includes('briefing') || norm.includes('sunrise')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><rect x="2" y="27" width="27.9985" height="2"/><path d="M16,20a4.0045,4.0045,0,0,1,4,4h2a6,6,0,0,0-12,0h2A4.0045,4.0045,0,0,1,16,20Z"/><rect x="25" y="22" width="5" height="2"/><rect x="21.6675" y="14.8536" width="4.958" height="1.9998" transform="translate(-4.1378 21.7175) rotate(-45)"/><polygon points="16 4 11 9 12.41 10.41 15 7.83 15 8 15 15 17 15 17 8 17 7.83 19.59 10.41 21 9 16 4"/><rect x="6.8536" y="13.3745" width="1.9998" height="4.958" transform="translate(-8.9099 10.1967) rotate(-45)"/><rect x="2" y="22" width="5" height="2"/></svg>`;
  }
  if (norm.includes('remind') || norm.includes('alarm')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M30,23.3818l-2-1V20a6.0046,6.0046,0,0,0-5-5.91V12H21v2.09A6.0046,6.0046,0,0,0,16,20v2.3818l-2,1V28h6v2h4V28h6ZM28,26H16V24.6182l2-1V20a4,4,0,0,1,8,0v3.6182l2,1Z"/><path d="M28,6a2,2,0,0,0-2-2H22V2H20V4H12V2H10V4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2h4V26H6V6h4V8h2V6h8V8h2V6h4v6h2Z"/></svg>`;
  }
  if (norm.includes('schedule') || norm.includes('event')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M21,30a8,8,0,1,1,8-8A8,8,0,0,1,21,30Zm0-14a6,6,0,1,0,6,6A6,6,0,0,0,21,16Z"/><polygon points="22.59 25 20 22.41 20 18 22 18 22 21.59 24 23.59 22.59 25"/><path d="M28,6a2,2,0,0,0-2-2H22V2H20V4H12V2H10V4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2h4V26H6V6h4V8h2V6h8V8h2V6h4v6h2Z"/></svg>`;
  }
  if (norm.includes('task') || norm.includes('manage_task')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="m30,30h-2v-2c0-.5513-.4482-1-1-1h-6c-.5518,0-1,.4487-1,1v2h-2v-2c0-1.6543,1.3457-3,3-3h6c1.6543,0,3,1.3457,3,3v2Z"/><path d="m24,24c-2.2061,0-4-1.7944-4-4s1.7939-4,4-4,4,1.7944,4,4-1.7939,4-4,4Zm0-6c-1.1025,0-2,.897-2,2s.8975,2,2,2,2-.897,2-2-.8975-2-2-2Z"/><rect x="8" y="20" width="2" height="2"/><rect x="12" y="20" width="6" height="2"/><rect x="8" y="16" width="2" height="2"/><rect x="12" y="16" width="6" height="2"/><rect x="8" y="12" width="2" height="2"/><rect x="12" y="12" width="6" height="2"/><path d="m21,5h-3v-1c0-1.103-.8975-2-2-2h-6c-1.1025,0-2,.897-2,2v1h-3c-1.1025,0-2,.897-2,2v19c0,1.103.8975,2,2,2h9v-2H5V7h3v2h10v-2h3v6.9999h2v-6.9999c0-1.103-.8975-2-2-2Zm-5,2h-6v-3h6v3Z"/></svg>`;
  }
  if (norm.includes('run_command') || norm.includes('command') || norm.includes('control') || norm.includes('terminal')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M24,13a4,4,0,0,0,4-4V8a4,4,0,0,0-4-4H23a4,4,0,0,0-4,4v3H13V8A4,4,0,0,0,9,4H8A4,4,0,0,0,4,8V9a4,4,0,0,0,4,4h3v6H8a4,4,0,0,0-4,4v1a4,4,0,0,0,4,4H9a4,4,0,0,0,4-4V21h6v3a4,4,0,0,0,4,4h1a4,4,0,0,0,4-4V23a4,4,0,0,0-4-4H21V13ZM21,8a2,2,0,0,1,2-2h1a2,2,0,0,1,2,2V9a2,2,0,0,1-2,2H21ZM8,11A2,2,0,0,1,6,9V8A2,2,0,0,1,8,6H9a2,2,0,0,1,2,2v3H8Zm3,13a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2V23a2,2,0,0,1,2-2h3Zm8-5H13V13h6Zm2,2h3a2,2,0,0,1,2,2v1a2,2,0,0,1-2,2H23a2,2,0,0,1-2-2Z"/></svg>`;
  }
  if (norm.includes('subagent') || norm.includes('sub_agent') || norm.includes('agent')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="m27,19c1.6543,0,3-1.3457,3-3s-1.3457-3-3-3c-1.302,0-2.4016.8385-2.8157,2h-5.7703l7.3005-7.3006c.3911.1871.8237.3006,1.2854.3006,1.6543,0,3-1.3457,3-3s-1.3457-3-3-3c-1.302,0-2.4016.8385-2.8157,2H7.8157c-.4141-1.1615-1.5137-2-2.8157-2-1.6543,0-3,1.3457-3,3s1.3457,3,3,3c.4617,0,.8943-.1135,1.2854-.3006l7.3005,7.3006h-5.7703c-.4141-1.1615-1.5137-2-2.8157-2-1.6543,0-3,1.3457-3,3s1.3457,3,3,3c1.302,0,2.4016-.8385,2.8157-2h5.7703l-7.3005,7.3006c-.3911-.1871-.8237-.3006-1.2854-.3006-1.6543,0-3,1.3457-3,3s1.3457,3,3,3c1.302,0,2.4016-.8385,2.8157-2h16.3687c.4141,1.1615,1.5137,2,2.8157,2,1.6543,0,3-1.3457,3-3s-1.3457-3-3-3c-.4617,0-.8943.1135-1.2854.3006l-7.3005-7.3006h5.7703c.4141,1.1615,1.5137,2,2.8157,2Zm0-4c.5518,0,1,.4487,1,1s-.4482,1-1,1-1-.4487-1-1,.4482-1,1-1ZM7.8157,6h16.3687c.0349.0976.072.1927.1162.2853l-8.3005,8.3006L7.6995,6.2853c.0442-.0927.0815-.1877.1162-.2853Zm19.1843-2c.5518,0,1,.4487,1,1s-.4482,1-1,1-1-.4487-1-1,.4482-1,1-1Zm-23,1c0-.5513.4482-1,1-1s1,.4487,1,1-.4482,1-1,1-1-.4487-1-1Zm1,12c-.5518,0-1-.4487-1-1s.4482-1,1-1,1,.4487,1,1-.4482,1-1,1Zm19.1843,9H7.8157c-.0347-.0976-.072-.1927-.1162-.2853l8.3005-8.3006,8.3005,8.3006c-.0442.0927-.0815.1877-.1162.2853Zm-19.1843,2c-.5518,0-1-.4487-1-1s.4482-1,1-1,1,.4487,1,1-.4482,1-1,1Zm23-1c0,.5513-.4482,1-1,1s-1-.4487-1-1,.4482-1,1-1,1,.4487,1,1Z"/></svg>`;
  }
  if (norm.includes('list_dir') || norm.includes('listdir') || norm.includes('tree')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M16,15h11c.5523,0,1-.4478,1-1v-7c0-.5523-.4477-1-1-1h-5l-.72-1.45c-.1711-.3395-.5199-.5527-.9-.55h-4.38c-.5523,0-1,.4477-1,1v4H6V2h-2v22c0,1.1025.897,2,2,2h9v3c0,.5522.4477,1,1,1h11c.5523,0,1-.4478,1-1v-7c0-.5523-.4477-1-1-1h-5l-.72-1.45c-.1711-.3395-.5199-.5527-.9-.55h-4.38c-.5523,0-1,.4477-1,1v4H6v-13h9v3c0,.5522.4477,1,1,1ZM17,6h2.76l.45.89.55,1.11h5.24v5h-9v-7ZM17,21h2.76l.45.89.55,1.11h5.24v5h-9v-7Z"/></svg>`;
  }
  if (norm.includes('grep') || norm.includes('find')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M29,27.5859l-7.5521-7.5521a11.0177,11.0177,0,1,0-1.4141,1.4141L27.5859,29ZM4,13a9,9,0,1,1,9,9A9.01,9.01,0,0,1,4,13Z"/></svg>`;
  }
  if (norm.includes('wiki') || norm.includes('web') || norm.includes('search') || norm.includes('scrape')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2ZM28,15H22A24.26,24.26,0,0,0,19.21,4.45,12,12,0,0,1,28,15ZM16,28a5,5,0,0,1-.67,0A21.85,21.85,0,0,1,12,17H20a21.85,21.85,0,0,1-3.3,11A5,5,0,0,1,16,28ZM12,15a21.85,21.85,0,0,1,3.3-11,6,6,0,0,1,1.34,0A21.85,21.85,0,0,1,20,15Zm.76-10.55A24.26,24.26,0,0,0,10,15h-6A12,12,0,0,1,12.79,4.45ZM4.05,17h6a24.26,24.26,0,0,0,2.75,10.55A12,12,0,0,1,4.05,17ZM19.21,27.55A24.26,24.26,0,0,0,22,17h6A12,12,0,0,1,19.21,27.55Z"/></svg>`;
  }
  if (norm.includes('translate') || norm.includes('lang')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M16,28h-3c-3.9,0-7-3.1-7-7v-4h2v4c0,2.8,2.2,5,5,5h3V28z"/><path d="M28,30h2.2l-4.6-11h-2.2l-4.6,11H21l0.8-2h5.3L28,30z M22.7,26l1.8-4.4l1.8,4.4H22.7z"/><path d="M28,15h-2v-4c0-2.8-2.2-5-5-5h-4V4h4c3.9,0,7,3.1,7,7V15z"/><path d="M14,5V3H9V1H7v2H2v2h8.2C10,5.9,9.4,7.5,8,9C7.4,8.3,6.9,7.6,6.6,7H4.3c0.4,1,1.1,2.2,2.1,3.3C5.6,11,4.4,11.6,3,12.1L3.7,14c1.8-0.7,3.2-1.5,4.3-2.3c1.1,0.9,2.5,1.7,4.3,2.3l0.7-1.9c-1.4-0.5-2.6-1.2-3.5-1.8c1.9-2,2.5-4.1,2.7-5.3H14z"/></svg>`;
  }
  if (norm.includes('security') || norm.includes('boundary')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M17,18h-2V7h2v11ZM14.5,22.5c0,.8284.6716,1.5,1.5,1.5s1.5-.6716,1.5-1.5-.6716-1.5-1.5-1.5-1.5.6716-1.5,1.5ZM16.479,29.8779l5.7856-3.1562c3.5381-1.9297,5.7354-5.6543,5.7354-9.7217V4c0-1.103-.8975-2-2-2H6c-1.103,0-2,.897-2,2v13c0,4.0674,2.1978,7.792,5.7349,9.7217l5.7861,3.1562c.1494.0811.314.1221.479.1221s.3296-.041.479-.1221ZM26,4v13c0,3.335-1.7979,6.3867-4.6924,7.9658l-5.3076,2.8955-5.3071-2.8955c-2.8945-1.5791-4.6929-4.6309-4.6929-7.9658V4h20Z"/></svg>`;
  }
  if (norm.includes('red_team') || norm.includes('redteam') || norm.includes('ops')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M10,18h8v2h-8v-2ZM28,12.82v3.62c0,6.11-5.45,9.3-9.44,11.63-.72.42-1.41.82-2.02,1.22l-.54.35-.54-.35c-.61-.39-1.3-.79-2.02-1.22-3.98-2.33-9.44-5.52-9.44-11.63V4c0-1.1.9-2,2-2h21v2H6v9h6v2h-6v1.44c0,4.96,4.68,7.7,8.45,9.9.54.32,1.07.62,1.55.92.49-.3,1.01-.61,1.55-.92,2.75-1.6,5.97-3.5,7.52-6.33h-5.08v-2h5.83c.11-.5.17-1.01.17-1.56v-3.62c-1.16-.41-2-1.51-2-2.82,0-1.65,1.35-3,3-3s3,1.35,3,3c0,1.3-.84,2.4-2,2.82l.01-.01ZM28,10c0-.55-.45-1-1-1s-1,.45-1,1,.45,1,1,1,1-.45,1-1ZM22,13h-8v2h8v-2ZM18,8h-8v2h8v-2Z"/></svg>`;
  }
  if (norm.includes('email') || norm.includes('mail') || norm.includes('gmail')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M28,6H4A2,2,0,0,0,2,8V24a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V8A2,2,0,0,0,28,6ZM25.8,8,16,14.78,6.2,8ZM4,24V8.91l11.43,7.91a1,1,0,0,0,1.14,0L28,8.91V24Z"/></svg>`;
  }
  if (norm.includes('image_analysis') || norm.includes('vision')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M24,14a5.99,5.99,0,0,0-4.885,9.4712L14,28.5859,15.4141,30l5.1147-5.1147A5.9971,5.9971,0,1,0,24,14Zm0,10a4,4,0,1,1,4-4A4.0045,4.0045,0,0,1,24,24Z"/><path d="M17,12a3,3,0,1,0-3-3A3.0033,3.0033,0,0,0,17,12Zm0-4a1,1,0,1,1-1,1A1.0009,1.0009,0,0,1,17,8Z"/><path d="M12,24H4V17.9966L9,13l5.5859,5.5859L16,17.168l-5.5859-5.5855a2,2,0,0,0-2.8282,0L4,15.168V4H24v6h2V4a2.0023,2.0023,0,0,0-2-2H4A2.002,2.002,0,0,0,2,4V24a2.0023,2.0023,0,0,0,2,2h8Z"/></svg>`;
  }
  if (norm.includes('generate_image') || norm.includes('image_gen') || norm.includes('image')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M19,14a3,3,0,1,0-3-3A3,3,0,0,0,19,14Zm0-4a1,1,0,1,1-1,1A1,1,0,0,1,19,10Z"/><path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4Zm0,22H6V20l5-5,5.59,5.59a2,2,0,0,0,2.82,0L21,19l5,5Zm0-4.83-3.59-3.59a2,2,0,0,0-2.82,0L18,19.17l-5.59-5.59a2,2,0,0,0-2.82,0L6,17.17V6H26Z"/></svg>`;
  }
  if (norm.includes('news') || norm.includes('announcement') || norm.includes('broadcast')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M26,6V8.17L5.64,11.87a2,2,0,0,0-1.64,2v4.34a2,2,0,0,0,1.64,2L8,20.56V24a2,2,0,0,0,2,2h8a2,2,0,0,0,2-2V22.74l6,1.09V26h2V6ZM18,24H10V20.93l8,1.45ZM6,18.17V13.83L26,10.2V21.8Z"/></svg>`;
  }
  if (norm.includes('weather') || norm.includes('forecast') || norm.includes('climate')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><circle cx="21.4995" cy="29.5" r="1.5"/><circle cx="24.4995" cy="25.5" r="1.5"/><circle cx="7.5" cy="25.5" r="1.5"/><circle cx="4.4995" cy="29.5" r="1.5"/><circle cx="10.4995" cy="29.5" r="1.5"/><polygon points="15.868 30.496 14.132 29.504 17.276 24 11.277 24 16.132 15.504 17.868 16.496 14.723 22 20.724 22 15.868 30.496"/><path d="M23.5,22H23V20h.5a4.4975,4.4975,0,0,0,.3564-8.981l-.8154-.0639-.0986-.812a6.9938,6.9938,0,0,0-13.8838,0l-.0991.812-.8155.0639A4.4975,4.4975,0,0,0,8.5,20H9v2H8.5A6.4973,6.4973,0,0,1,7.2,9.1362a8.9943,8.9943,0,0,1,17.6006,0A6.4974,6.4974,0,0,1,23.5,22Z"/></svg>`;
  }
  if (norm.includes('stock') || norm.includes('analysis') || norm.includes('data')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><rect x="8" y="10" width="8" height="2"/><rect x="8" y="6" width="12" height="2"/><rect x="8" y="2" width="12" height="2"/><path d="M4.7111,28l5.6312-9.9961,7.4341,6.49A2,2,0,0,0,20.86,23.96l6.9707-10.4034-1.6622-1.1132-7,10.4472-.07.1035-7.4345-6.4907a2.0032,2.0032,0,0,0-3.0806.5308L4,25.1826V2H2V28a2.0023,2.0023,0,0,0,2,2H30V28Z"/></svg>`;
  }
  if (norm.includes('debate') || norm.includes('argument')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><polygon points="11.41 26.59 7.83 23 28 23 28 21 7.83 21 11.41 17.41 10 16 4 22 10 28 11.41 26.59"/><polygon points="28 10 22 4 20.59 5.41 24.17 9 4 9 4 11 24.17 11 20.59 14.59 22 16 28 10"/></svg>`;
  }
  if (norm.includes('recycler') || norm.includes('recycle') || norm.includes('trash')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>`;
  }
  if (norm.includes('file') || norm.includes('write') || norm.includes('read_file')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M25.7,9.3l-7-7C18.5,2.1,18.3,2,18,2H8C6.9,2,6,2.9,6,4v24c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V10C26,9.7,25.9,9.5,25.7,9.3z M18,4.4l5.6,5.6H18V4.4z M24,28H8V4h8v6c0,1.1,0.9,2,2,2h6V28z"/><rect x="10" y="22" width="12" height="2"/><rect x="10" y="16" width="12" height="2"/></svg>`;
  }
  if (norm.includes('folder') || norm.includes('filesystem') || norm.includes('directory')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M12,28H6c-1.1,0-2-0.9-2-2V6c0-1.1,0.9-2,2-2h6l2,2h12c1.1,0,2,0.9,2,2v6h-2V8H13.2l-2-2H6v20h6V28z M26,18v-2h-8v2h8z M28,22v-2h-6v2H28z M24,26v-2h-4v2H24z"/></svg>`;
  }
  if (norm.includes('calc') || norm.includes('physics') || norm.includes('math')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><polygon points="26 18 24 18 22 21.897 20 18 18 18 20.905 23 18 28 20 28 22 24.201 24 28 26 28 23.098 23 26 18"/><path d="M19,6V4H13.9133a1.9906,1.9906,0,0,0-1.9919,1.8188L11.2686,13H7v2h4.0867l-1,11H5v2h5.0867a1.9906,1.9906,0,0,0,1.9919-1.8188L13.0952,15H18V13H13.2769l.6364-7Z"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M16 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
}

function formatSkillName(name) {
  return String(name || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getSkillCategory(name, tags) {
  const n = (name || '').toLowerCase();
  if (n.includes('research') || n.includes('memory') || n.includes('brief') || n.includes('translate') || n.includes('physics') || n.includes('analyzer')) {
    return 'Core Intelligence';
  }
  if (n.includes('file') || n.includes('run_command') || n.includes('terminal')) {
    return 'System & Files';
  }
  if (n.includes('web') || n.includes('search') || n.includes('scrape') || n.includes('news') || n.includes('stock') || n.includes('weather') || n.includes('wiki')) {
    return 'Web & Search';
  }
  return 'Media & Utilities';
}

function getSkillExamplePrompt(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('deep_research')) return '@DeepResearch research quantum computing advancements';
  if (n.includes('file_manager')) return '@FileManager list files in C:/Users/anshu/Downloads';
  if (n.includes('run_command')) return '@RunCommand execute python --version';
  if (n.includes('generate_image')) return '@GenerateImage create a futuristic cyberpunk neon city';
  if (n.includes('image_analysis')) return '@ImageAnalysis analyze chart image and summarize data';
  if (n.includes('memory_ops')) return '@MemoryOps search memory for user preferences';
  if (n.includes('morning_briefing')) return '@MorningBriefing generate daily briefing and weather';
  if (n.includes('news_fetch')) return '@NewsFetch fetch latest AI technology news';
  if (n.includes('reminder')) return '@Reminder remind me to check deployment in 30 mins';
  if (n.includes('stock_data')) return '@StockData get stock price and trends for AAPL';
  if (n.includes('translator')) return '@Translator translate "Hello world" to Hindi';
  if (n.includes('weather')) return '@Weather get weather forecast for Mumbai';
  if (n.includes('web_scraper')) return '@WebScraper extract text from https://example.com';
  if (n.includes('web_search')) return '@WebSearch search web for latest Python 3.12 features';
  if (n.includes('wikipedia_search')) return '@WikipediaSearch search Wikipedia for Quantum Mechanics';
  if (n.includes('physics_solver')) return '@PhysicsSolver solve velocity of falling object after 5s';
  if (n.includes('data_analyzer')) return '@DataAnalyzer analyze data inside sales_report.csv';
  return `@${formatSkillName(name).replace(/\s+/g, '')} execute operation`;
}

export class SkillsPage {
  constructor(showToast) {
    this._showToast = (title, msg, dur) => {
      if (typeof showToast === 'function') showToast(title, msg, dur);
    };
    this._view = 'catalog';
    this._selectedSkillName = null;
    this._searchQuery = '';
    this._root = null;
    this._mounted = false;
    this._activeCollapsibleOpen = false;
    this._skills = [];

    window.skillsPageInstance = this;
  }

  toggleActiveCollapsible() {
    this._activeCollapsibleOpen = !this._activeCollapsibleOpen;
    this._renderCatalogGrid();
  }

  mount(container) {
    this._root = container;
    if (this._root) {
      this._root.style.display = 'flex';
      this._root.style.flex = '1';
      this._root.style.width = '100%';
      this._root.style.height = '100%';
      this._root.style.minWidth = '0';
      this._root.style.overflow = 'hidden';
    }
    this._mounted = true;
    this._loadData();
  }

  refresh() {
    if (!this._mounted) return;
    this._loadData();
  }

  async _loadData() {
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        this._skills = await res.json();
      }
    } catch (e) {
      console.warn('SkillsPage load error:', e);
    }
    this.render();
  }

  render() {
    if (!this._root) return;
    if (this._view === 'detail') this._renderDetail();
    else this._renderCatalog();
  }

  showDetail(skillName) {
    this._selectedSkillName = skillName;
    this._view = 'detail';
    this.render();
  }

  showCatalog() {
    this._view = 'catalog';
    this.render();
  }

  _renderCatalogGrid() {
    const gridContainer = this._root ? this._root.querySelector('#skills-grid-container') : null;
    if (!gridContainer) return;

    const activeInput = document.activeElement;
    const isSearchInput = activeInput && activeInput.id === 'skills-search-input';
    const selStart = isSearchInput ? activeInput.selectionStart : null;
    const selEnd = isSearchInput ? activeInput.selectionEnd : null;

    const activeList = this._skills.filter(s => s.enabled !== false);
    const filtered = this._skills.filter(item => {
      if (!this._searchQuery) return true;
      const q = this._searchQuery.toLowerCase();
      const fn = formatSkillName(item.name).toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const category = getSkillCategory(item.name, item.tags).toLowerCase();
      return item.name.toLowerCase().includes(q) || fn.includes(q) || desc.includes(q) || category.includes(q);
    });

    const categories = ['Core Intelligence', 'System & Files', 'Web & Search', 'Media & Utilities'];

    gridContainer.innerHTML = `
      <!-- ACTIVE SKILLS PILLS (COLLAPSIBLE, DEFAULT COLLAPSED) -->
      <div style="margin-bottom:24px;">
        <div onclick="window.skillsPageInstance.toggleActiveCollapsible()" style="font-size:11.5px; font-weight:600; color:var(--text-3); margin-bottom:8px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; user-select:none; padding:4px 10px; border-radius:20px; transition:all 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='transparent';">
          <i data-lucide="${this._activeCollapsibleOpen ? 'chevron-down' : 'chevron-right'}" style="width:14px; height:14px;"></i>
          <span>Active Capabilities</span>
          <span style="font-size:10.5px; background:var(--input-bg); padding:1px 8px; border-radius:20px; color:var(--text-2);">${activeList.length}</span>
          <span style="font-size:10px; color:var(--text-3); font-weight:400; margin-left:2px;">(${this._activeCollapsibleOpen ? 'collapse' : 'expand'})</span>
        </div>
        <div style="display:${this._activeCollapsibleOpen ? 'flex' : 'none'}; gap:8px; flex-wrap:wrap; align-items:center; margin-top:6px;">
          ${activeList.length === 0 ? `
            <div style="font-size:11.5px; color:var(--text-3); background:var(--card); border:none !important; padding:8px 14px; border-radius:20px; width:100%; box-sizing:border-box;">
              No active capabilities. Click the <strong>＋ icon</strong> on any skill below to enable.
            </div>
          ` : activeList.map(s => `
            <div onclick="window.skillsPageInstance.showDetail('${s.name}')" style="display:flex; align-items:center; gap:8px; background:var(--card); border:none !important; padding:6px 14px; border-radius:20px; cursor:pointer; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--card)';">
              ${getSkillRealLogoSvg(s.name, 16)}
              <span style="font-size:12px; font-weight:600; color:var(--text);">${esc(formatSkillName(s.name))}</span>
              <span style="width:6px; height:6px; border-radius:50%; background:#16a34a; margin-left:2px;"></span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- CATEGORIZED 2-COLUMN GRID -->
      ${categories.map(cat => {
        const items = filtered.filter(i => getSkillCategory(i.name, i.tags) === cat);
        if (items.length === 0) return '';
        return `
          <div style="margin-bottom:28px;">
            <h3 style="font-size:13px; font-weight:600; color:var(--text); margin-bottom:10px;">${cat}</h3>
            <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
              ${items.map(item => this._renderSkillCard(item)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    `;

    if (window.lucide) lucide.createIcons({ parent: gridContainer });

    if (isSearchInput && document.body.contains(activeInput)) {
      activeInput.focus();
      if (selStart !== null && selEnd !== null) {
        try { activeInput.setSelectionRange(selStart, selEnd); } catch (e) {}
      }
    }
  }

  _buildShell() {
    this._root.innerHTML = `
      <div class="skills-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg); color:var(--text); font-family:var(--font); box-sizing:border-box;">
        <div style="max-width:780px; margin:0 auto; width:100%;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; margin-bottom:24px; width:100%;">
            <div>
              <h1 style="font-size:18px; font-weight:600; color:var(--text); margin:0;">Capabilities &amp; Skills</h1>
              <p style="font-size:12px; color:var(--text-3); margin-top:2px;">Manage autonomous tool capabilities powering Hekki.</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="position:relative; width:220px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:13px; height:13px; color:var(--text-3); pointer-events:none;"><path d="M29,27.5859l-7.5521-7.5521a11.0177,11.0177,0,1,0-1.4141,1.4141L27.5859,29ZM4,13a9,9,0,1,1,9,9A9.01,9.01,0,0,1,4,13Z"/></svg>
                <input type="text" id="skills-search-input" placeholder="Search skills..." style="width:100%; height:30px; padding:0 12px 0 32px; background:var(--input-bg); border:none !important; border-radius:20px; color:var(--text); font-size:11.5px; outline:none !important; box-shadow:none !important;" />
              </div>
              <button onclick="window.skillsPageInstance.cleanStats()" title="Reset call statistics" style="height:30px; padding:0 14px; background:var(--input-bg); border:none !important; border-radius:20px; color:var(--text-2); font-size:11.5px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--input-bg)';">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 32 32" fill="currentColor" style="width:12px;height:12px;display:block;"><path d="M26,16A10,10,0,1,1,16,6v4l5-5L16,0V4A12,12,0,1,0,28,16Z"/></svg>
                <span>Clean Stats</span>
              </button>
            </div>
          </div>
          <div id="skills-grid-container"></div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ parent: this._root });
    const input = this._root.querySelector('#skills-search-input');
    if (input) {
      input.addEventListener('input', (e) => {
        this._searchQuery = e.target.value;
        this._renderCatalogGrid();
      });
    }
  }

  _renderCatalog() {
    if (!this._root.querySelector('#skills-grid-container')) {
      this._buildShell();
    }
    this._renderCatalogGrid();
  }

  _renderSkillCard(item) {
    const isEnabled = item.enabled !== false;
    const friendlyName = formatSkillName(item.name);
    const examplePrompt = getSkillExamplePrompt(item.name);

    return `
      <div onclick="window.skillsPageInstance.showDetail('${item.name}')" style="background:var(--card); border:none !important; outline:none !important; border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--card)';">
        <div style="display:flex; gap:12px; align-items:center; flex:1; min-width:0;">
          <div style="width:36px; height:36px; border-radius:10px; background:var(--input-bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text);">
            ${getSkillRealLogoSvg(item.name, 20)}
          </div>
          <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
            <div style="font-size:13px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(friendlyName)}</div>
            <div style="font-size:11.5px; color:var(--text-3); line-height:1.25; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(examplePrompt)}</div>
          </div>
        </div>
        <button onclick="event.stopPropagation(); window.skillsPageInstance.toggleSkill('${item.name}')" title="${isEnabled ? 'Disable' : 'Enable'} ${esc(friendlyName)}" style="width:36px; height:36px; min-width:36px; min-height:36px; border-radius:10px; background:${isEnabled ? 'rgba(22,163,74,0.12)' : 'var(--input-bg)'}; border:none !important; outline:none !important; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease; color:${isEnabled ? '#16a34a' : 'var(--text)'};">
          ${isEnabled ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#16a34a" style="width:14px;height:14px;display:block;flex-shrink:0;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;display:block;flex-shrink:0;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'}
        </button>
      </div>
    `;
  }

  _renderDetail() {
    const item = this._skills.find(s => s.name === this._selectedSkillName) || {
      name: this._selectedSkillName, description: 'Autonomous capability module.', version: '1.0.0', enabled: true,
      parameters: { properties: {} }, stats: { call_count: 0, avg_latency_ms: 0, success_rate: 1.0 }
    };

    const isEnabled = item.enabled !== false;
    const friendlyName = formatSkillName(item.name);
    const category = getSkillCategory(item.name, item.tags);
    const examplePrompt = getSkillExamplePrompt(item.name);

    // Extract parameter definitions from JSON Schema
    const paramsObj = (item.parameters && item.parameters.properties) ? item.parameters.properties : {};
    const reqList = (item.parameters && item.parameters.required) ? item.parameters.required : [];
    const paramKeys = Object.keys(paramsObj);

    const stats = item.stats || { call_count: 0, avg_latency_ms: 0, success_rate: 1.0 };
    const successPct = Math.round((stats.success_rate || 1.0) * 100);

    this._root.innerHTML = `
      <div class="skills-detail-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg); color:var(--text); font-family:var(--font); box-sizing:border-box;">
        
        <!-- BACK BUTTON -->
        <div style="max-width:780px; margin:0 auto 20px; width:100%;">
          <button onclick="window.skillsPageInstance.showCatalog()" style="background:transparent; border:none; color:var(--text-2); font-size:13px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; padding:0;">
            <i data-lucide="chevron-left" style="width:16px; height:16px;"></i> Skills
          </button>
        </div>

        <div style="max-width:780px; margin:0 auto; width:100%;">
          
          <!-- DETAIL HEADER -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; gap:20px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width:52px; height:52px; border-radius:12px; background:var(--input-bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text);">
                ${getSkillRealLogoSvg(item.name, 28)}
              </div>
              <div>
                <h1 style="font-size:20px; font-weight:600; color:var(--text); margin:0;">${esc(friendlyName)}</h1>
                <p style="font-size:12.5px; color:var(--text-3); margin-top:2px;">v${esc(item.version || '1.0.0')} &bull; ${esc(category)}</p>
              </div>
            </div>
            <button onclick="window.skillsPageInstance.toggleSkill('${item.name}')" style="padding:6px 18px; border-radius:20px; border:none !important; font-size:12.5px; font-weight:600; cursor:pointer; transition:all 0.15s ease; ${isEnabled ? 'background:rgba(239,68,68,0.1); color:#ef4444;' : 'background:var(--text); color:var(--bg);'}">
              ${isEnabled ? 'Disable Capability' : '＋ Enable Capability'}
            </button>
          </div>

          <!-- DESCRIPTION -->
          <div style="font-size:13px; color:var(--text-2); line-height:1.6; margin-bottom:28px;">${esc(item.description || 'No detailed description provided for this capability module.')}</div>

          <!-- SKILL BADGE -->
          <div style="margin-bottom:28px;">
            <div style="font-size:13px; font-weight:600; color:var(--text); margin-bottom:8px;">Skill Badge</div>
            <div style="display:inline-flex; align-items:center; gap:8px; background:var(--input-bg); padding:6px 16px; border-radius:20px; font-size:12px; font-weight:600; color:var(--text);">
              ${getSkillRealLogoSvg(item.name, 16)}
              <span>${esc(friendlyName)}</span>
            </div>
          </div>

          <!-- PARAMETERS & METHODS TABLE -->
          <div style="margin-bottom:36px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;">Available Parameters &amp; Methods</div>
            <p style="font-size:12px; color:var(--text-3); margin-top:0; margin-bottom:16px;">Function parameters registered for Gemini and Ollama tool invocation.</p>
            
            <div style="width:100%;">
              <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:8px 0; border-bottom:1px solid var(--border); font-size:11.5px; font-weight:600; color:var(--text-3);">
                <div>Parameter / Argument</div>
                <div>Description &amp; Type</div>
                <div>How to Use (Prompt)</div>
              </div>
              
              ${paramKeys.length === 0 ? `
                <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:12px 0; border-bottom:1px solid var(--border); font-size:12px; align-items:center;">
                  <div style="font-family:var(--font-mono); font-weight:600; color:var(--text); font-size:12px;">execute()</div>
                  <div style="color:var(--text-2); line-height:1.4; font-weight:400;">No input arguments required.</div>
                  <div style="font-family:var(--font-mono); color:var(--text-2); font-size:11.5px; font-weight:400;">${esc(examplePrompt)}</div>
                </div>
              ` : paramKeys.map(pk => {
                const pinfo = paramsObj[pk] || {};
                const ptype = pinfo.type || 'string';
                const isReq = reqList.includes(pk);
                const pdesc = pinfo.description || pk;
                return `
                  <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:12px 0; border-bottom:1px solid var(--border); font-size:12px; align-items:center;">
                    <div style="font-family:var(--font-mono); font-weight:600; color:var(--text); font-size:12px;">
                      ${esc(pk)} ${isReq ? '<span style="color:#ef4444; font-size:10px;">*</span>' : ''}
                    </div>
                    <div style="color:var(--text-2); line-height:1.4; font-weight:400;">
                      ${esc(pdesc)} <span style="font-size:11px; color:var(--text-3); font-family:var(--font-mono);">(${esc(ptype)})</span>
                    </div>
                    <div style="font-family:var(--font-mono); color:var(--text-2); font-size:11.5px; font-weight:400;">${esc(examplePrompt)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- SYSTEM METADATA & TELEMETRY TABLE -->
          <div style="margin-bottom:28px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:12px;">System Metadata &amp; Telemetry</div>
            <div style="width:100%;">
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Category</span>
                <span style="color:var(--text); font-weight:400;">${esc(category)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Version</span>
                <span style="color:var(--text); font-weight:400;">v${esc(item.version || '1.0.0')}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Total Call Invocations</span>
                <span style="color:var(--text); font-family:var(--font-mono); font-size:11.5px; font-weight:400;">${stats.call_count || 0} calls</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Average Execution Latency</span>
                <span style="color:var(--text); font-family:var(--font-mono); font-size:11.5px; font-weight:400;">${stats.avg_latency_ms || 0} ms</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Success Rate</span>
                <span style="color:var(--text); font-family:var(--font-mono); font-size:11.5px; font-weight:400;">${successPct}%</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Execution Status</span>
                <span style="font-weight:500; color:${isEnabled ? '#16a34a' : 'var(--text-3)'}">${isEnabled ? 'Active' : 'Disabled'}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  async toggleSkill(skillName) {
    const item = this._skills.find(s => s.name === skillName);
    if (!item) return;
    const isCurrentlyEnabled = item.enabled !== false;
    const nextState = !isCurrentlyEnabled;
    const friendly = formatSkillName(skillName);

    try {
      const res = await fetch('/api/skills/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: skillName, enabled: nextState })
      });
      if (res.ok) {
        item.enabled = nextState;
        this._showToast('Skills Engine', `${nextState ? 'Enabled' : 'Disabled'} capability "${friendly}"`, 2500);
      } else {
        throw new Error('Toggle failed');
      }
    } catch (e) {
      this._showToast('Skills Engine', `Failed to toggle ${friendly}`, 3000);
    }
    await this._loadData();
  }

  async cleanStats() {
    try {
      const res = await fetch('/api/skills/clean', { method: 'POST' });
      if (res.ok) {
        this._showToast('Skills Telemetry', 'Successfully reset call counts and latencies across all skills', 2500);
      } else {
        throw new Error('Clean failed');
      }
    } catch (e) {
      this._showToast('Skills Telemetry', 'Failed to clean statistics', 3000);
    }
    await this._loadData();
  }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
