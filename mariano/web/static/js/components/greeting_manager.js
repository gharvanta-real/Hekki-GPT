/**
 * greeting_manager.js — Dynamic time-based greetings and user profile avatar
 */

export function setup3DAvatar() {
  const userSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 32 32" fill="currentColor"><path d="M16 4a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm10 14h-2a8 8 0 0 0-16 0H6a10 10 0 0 1 20 0z"/></svg>';
  ['sidebar-user-avatar', 'debate-sidebar-user-avatar'].forEach(id => {
    const sbAvatar = document.getElementById(id);
    if (!sbAvatar) return;
    sbAvatar.innerHTML = userSvg;
  });
}

export function getRandomDynamicGreeting(name) {
  const hour = new Date().getHours();
  let greetings = [];

  if (hour >= 5 && hour < 12) {
    greetings = [
      "Good morning",
      "Rise and shine",
      "Morning! Ready to build?",
      "Good morning! What's on the agenda?",
      "Fresh start today",
      "Morning! Let's get things done"
    ];
  } else if (hour >= 12 && hour < 17) {
    greetings = [
      "Good afternoon",
      "Hey there! How's your day going?",
      "Afternoon! Ready to work?",
      "Good afternoon! What's next?",
      "Hey! Hope your day is going great"
    ];
  } else if (hour >= 17 && hour < 22) {
    greetings = [
      "Good evening",
      "Evening! Let me know what you need",
      "Good evening! Ready to build something cool?",
      "Hey! How was your day?",
      "Good evening! What can I help with?"
    ];
  } else {
    greetings = [
      "Night owl mode active",
      "Working late tonight?",
      "Late night coding?",
      "Quiet hours! What are we building?",
      "Good evening! Still grinding?"
    ];
  }

  const baseGreet = greetings[Math.floor(Math.random() * greetings.length)];
  if (!name) return baseGreet;

  if (baseGreet.includes("?")) {
    return baseGreet.replace("?", `, ${name}?`);
  } else {
    return `${baseGreet}, ${name}`;
  }
}

export function setGreeting(nameOverride) {
  const el = document.getElementById('greeting-text');
  const updateSidebar = (name) => {
    const sbName = document.getElementById('sidebar-user-name');
    const dbName = document.getElementById('debate-sidebar-user-name');
    if (sbName) sbName.textContent = name || 'User';
    if (dbName) dbName.textContent = name || 'User';
  };
  setup3DAvatar();

  if (nameOverride !== undefined) {
    if (el) el.textContent = getRandomDynamicGreeting(nameOverride);
    updateSidebar(nameOverride);
    return;
  }

  fetch('/api/settings')
    .then(r => r.json())
    .then(cfg => {
      const name = cfg.user_name || localStorage.getItem('hekki_user_name') || '';
      if (el) el.textContent = getRandomDynamicGreeting(name);
      updateSidebar(name);
    })
    .catch(() => {
      if (el) el.textContent = getRandomDynamicGreeting('');
      updateSidebar('');
    });
}
