export function showToast(title, message, duration = 4000) {
  const $ = (id) => document.getElementById(id);
  let container = $('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    Object.assign(container.style, {
      position: 'fixed',
      top: '50px',
      right: '16px',
      zIndex: '99999',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  Object.assign(toast.style, {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '12px 16px',
    boxShadow: 'var(--shadow)',
    minWidth: '240px',
    maxWidth: '320px',
    transform: 'translateX(110%)',
    opacity: '0',
    transition: 'all 0.3s ease',
    fontFamily: 'var(--font)',
    fontSize: '13px',
    color: 'var(--text)'
  });
  toast.innerHTML = `
    <strong style="display:block;margin-bottom:4px">${title || 'Notice'}</strong>
    <span style="color:var(--text-2)">${message}</span>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  const dismiss = () => {
    toast.style.transform = 'translateX(110%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 350);
  };
  
  if (duration > 0) setTimeout(dismiss, duration);
}
