export class TabManager {
  constructor(tabsId, contentId, log) {
    this.tabs    = document.getElementById(tabsId);
    this.content = document.getElementById(contentId);
    this.log     = log;
    this.active  = null;
    this.map     = new Map();
  }

  createTab(id, title, html, css, js, icon = 'extension') {
    const appPane = document.getElementById('app-pane');
    const resizer = document.getElementById('app-pane-resizer');
    if (appPane) appPane.classList.remove('hidden-pane');
    if (resizer) resizer.classList.remove('hidden-pane');

    const key = `tab-${id}`;
    if (this.map.has(key)) { this.switchTo(key); return; }

    // Button
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.innerHTML = `<i class="mi" data-lucide="${icon}"></i>${title}<span class="close-x">✕</span>`;
    this.tabs.appendChild(btn);
    if (window.lucide) lucide.createIcons();

    // View
    const view = document.createElement('div');
    view.className = 'tab-view';
    this.content.appendChild(view);

    // Shadow DOM
    const anchor = document.createElement('div');
    anchor.style.cssText = 'width:100%;height:100%';
    view.appendChild(anchor);
    const shadow = anchor.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>:host{display:block;font-family:Inter,sans-serif;height:100%;width:100%;overflow:auto;box-sizing:border-box}${css||''}</style>${html||''}`;

    if (js) { try { new Function('shadow', js)(shadow); } catch(e) { console.error(e); } }

    this.map.set(key, { btn, view });
    btn.addEventListener('click', e => { if (!e.target.classList.contains('close-x')) this.switchTo(key); });
    btn.querySelector('.close-x').addEventListener('click', e => { e.stopPropagation(); this.close(key); });

    this.switchTo(key);
    this.log(`Loaded: ${title}`, 'ok');
  }

  switchTo(key) {
    const appPane = document.getElementById('app-pane');
    const resizer = document.getElementById('app-pane-resizer');
    if (appPane) appPane.classList.remove('hidden-pane');
    if (resizer) resizer.classList.remove('hidden-pane');

    if (this.active) {
      const t = this.map.get(this.active);
      t?.btn.classList.remove('active');
      t?.view.classList.remove('active');
    }
    const t = this.map.get(key);
    if (!t) return;
    t.btn.classList.add('active');
    t.view.classList.add('active');
    this.active = key;
    window.dispatchEvent(new Event('resize'));
  }

  close(key) {
    const t = this.map.get(key);
    if (!t) return;
    t.btn.remove(); t.view.remove(); this.map.delete(key);
    if (this.active === key) {
      this.active = null;
      if (this.map.size > 0) {
        this.switchTo(this.map.keys().next().value);
      } else {
        document.getElementById('app-pane')?.classList.add('hidden-pane');
      }
    }
    this.log('App closed.', 'warn');
  }
}
