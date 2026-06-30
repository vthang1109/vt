/**
 * top-nav.js — VTWorld Top Navigation Component
 * Theme: dark #0a0f1e · accent #0288D1
 *
 * Cách dùng:
 *   <script src="top-nav.js"></script>
 *   <div id="top-nav-root"></div>  ← tự động inject
 *   hoặc: TopNav.init()
 *
 * API:
 *   TopNav.setPoints(1250)  ← hiện điểm khi đã login
 */

window.TopNav = (() => {
  const NAV_H = 56;

  const STYLES = `
    body.has-top-nav { padding-top: ${NAV_H}px; }
    .vt-top-nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      height: ${NAV_H}px;
      background: rgba(8, 13, 28, 0.97);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(2, 136, 209, 0.18);
      box-shadow: 0 2px 20px rgba(0,0,0,0.4);
    }
    .vt-top-nav .vt-nav-logo {
      font-family: 'Orbitron', 'Segoe UI', sans-serif;
      font-weight: 900;
      font-size: 20px;
      cursor: pointer;
      user-select: none;
      letter-spacing: 1px;
      text-decoration: none;
    }
    .vt-top-nav .vt-nav-logo .logo-vt   { color: #0288D1; }
    .vt-top-nav .vt-nav-logo .logo-world { color: #ffffff; }
    .vt-top-nav .vt-nav-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .vt-top-nav .vt-nav-pts {
      font-family: 'Orbitron', monospace;
      font-size: 12px;
      color: #38bdf8;
      font-weight: 700;
      display: none;
    }
    .vt-top-nav .vt-nav-pts.visible { display: block; }
    .vt-top-nav .vt-hamburger {
      background: none;
      border: 1px solid rgba(2, 136, 209, 0.25);
      border-radius: 8px;
      color: #e0f2fe;
      font-size: 18px;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }
    .vt-top-nav .vt-hamburger:hover,
    .vt-top-nav .vt-hamburger.open {
      background: rgba(2, 136, 209, 0.12);
      border-color: rgba(2, 136, 209, 0.5);
    }
    /* Dropdown */
    .vt-nav-dropdown {
      position: fixed;
      top: ${NAV_H + 6}px;
      right: 12px;
      z-index: 1000;
      background: rgba(8, 13, 28, 0.98);
      border: 1px solid rgba(2, 136, 209, 0.2);
      border-radius: 14px;
      min-width: 190px;
      padding: 6px 0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(2,136,209,0.05);
      transform: translateY(-6px) scale(0.97);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.18s ease, opacity 0.18s ease;
    }
    .vt-nav-dropdown.open {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }
    .vt-nav-dropdown a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      color: #94a3b8;
      text-decoration: none;
      font-family: 'Nunito', sans-serif;
      font-size: 14px;
      font-weight: 700;
      transition: background 0.15s, color 0.15s;
    }
    .vt-nav-dropdown a:hover { background: rgba(2,136,209,0.08); color: #38bdf8; }
    .vt-nav-dropdown .dd-divider {
      height: 1px;
      background: rgba(2,136,209,0.12);
      margin: 5px 12px;
    }
    .vt-dd-action {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      color: #94a3b8;
      font-family: 'Nunito', sans-serif;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      text-decoration: none;
    }
    .vt-dd-action:hover { background: rgba(2,136,209,0.08); color: #38bdf8; }
    .vt-dd-action.back-btn { color: #7dd3fc; }
    .vt-dd-action.settings-btn { color: #94a3b8; }
    .vt-dd-action.leave-btn { color: #f87171; display: none; }
    .vt-dd-action.leave-btn.visible { display: flex; }

  `;

  const MENU = [
    { icon: '📱', label: 'App',  href: 'applications.html' },
    { icon: '🎮', label: 'Game', href: 'games.html' },
    { icon: '🛒', label: 'Shop', href: 'shop.html' },
    { icon: '🎒', label: 'Bag',  href: 'bag.html' },
  ];

  function injectStyles() {
    if (document.getElementById('vt-top-nav-styles')) return;
    const s = document.createElement('style');
    s.id = 'vt-top-nav-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function buildHTML() {
    const menuHTML   = MENU.map(i   => `<a href="${i.href}"><span>${i.icon}</span>${i.label}</a>`).join('');
    return `
      <div class="vt-top-nav" id="vtTopNav">
        <a class="vt-nav-logo" href="index.html">
          <span class="logo-vt">VT</span><span class="logo-world">World</span>
        </a>
        <div class="vt-nav-right">
          <span class="vt-nav-pts" id="vtNavPts">⭐ 0</span>
          <button class="vt-hamburger" id="vtHamburger" aria-label="Menu">☰</button>
        </div>
      </div>
      <div class="vt-nav-dropdown" id="vtNavDropdown">
        <button class="vt-dd-action back-btn" onclick="history.back()">
          <span>←</span> Quay lại
        </button>
        <button class="vt-dd-action settings-btn" onclick="window.location.href='settings.html'">
          <span>⚙️</span> Cài đặt
        </button>
        <button class="vt-dd-action leave-btn" id="vtDdLeave">
          <span>🚪</span> Rời phòng
        </button>
        <div class="dd-divider"></div>
        ${menuHTML}
      </div>`;
  }

  function bindEvents() {
    const btn = document.getElementById('vtHamburger');
    const dd  = document.getElementById('vtNavDropdown');
    if (!btn || !dd) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = dd.classList.toggle('open');
      btn.classList.toggle('open', open);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#vtNavDropdown') && !e.target.closest('#vtHamburger')) {
        dd.classList.remove('open');
        btn.classList.remove('open');
      }
    });
  }

  function init() {
    injectStyles();
    document.body.classList.add('has-top-nav');
    const root = document.getElementById('top-nav-root');
    if (root) {
      root.outerHTML = buildHTML();
    } else {
      document.body.insertAdjacentHTML('afterbegin', buildHTML());
    }
    bindEvents();
  }

  function setPoints(pts) {
    const el = document.getElementById('vtNavPts');
    if (!el) return;
    el.textContent = '⭐ ' + Number(pts).toLocaleString();
    el.classList.add('visible');
  }

  function setLeaveAction(callback) {
    const btn = document.getElementById('vtDdLeave');
    if (!btn) return;
    btn.classList.add('visible');
    btn.onclick = () => {
      document.getElementById('vtNavDropdown')?.classList.remove('open');
      document.getElementById('vtHamburger')?.classList.remove('open');
      callback();
    };
  }

  return { init, setPoints, setLeaveAction };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('top-nav-root')) TopNav.init();
});
