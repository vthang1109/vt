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
  let _currentBalance = 0;
  let _unsubBalance = null;

  async function listenBalance() {
    try {
      const { auth, subscribeBalance, onAuthStateChanged } = await import('./points.js');
      onAuthStateChanged(auth, (user) => {
        if (_unsubBalance) { _unsubBalance(); _unsubBalance = null; }
        if (!user) return;
        _unsubBalance = subscribeBalance(pts => {
          _currentBalance = pts || 0;
          setPoints(_currentBalance);
        });
      });
    } catch (e) { console.error('TopNav balance listen failed', e); }
  }

  function getBalance() { return _currentBalance; }

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
      font-family: "Science Gothic", sans-serif;
      font-weight: 500;
      font-size: 20px;
      cursor: pointer;
      user-select: none;
      letter-spacing: 1px;
      text-decoration: none;
    }
    .vt-top-nav .vt-nav-logo .logo-vt   { color: #0288D1; }
    .vt-top-nav .vt-nav-logo .logo-world { color: #ffffff; }
    .vt-top-nav .vt-nav-logo { display: flex; align-items: center; }
    .vt-top-nav .vt-logo-content { display: flex; align-items: center; }
    .vt-top-nav .vt-nav-logo img { height: 28px; width: auto; margin-right: 6px; }
    .vt-top-nav .vt-nav-logo .logo-vt { margin-right: 6px; }
    .vt-top-nav .vt-room-id { margin-left: 6px; }
    .vt-top-nav .vt-room-id {
      display: none;
      font-family: "Science Gothic", sans-serif;
      color: #fbbf24;
      font-weight: 500;
      font-size: 13px;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(251,191,36,.1);
      border: 1px solid rgba(251,191,36,.4);
      letter-spacing: 0.5px;
    }
    .vt-top-nav .vt-room-id.visible { display: inline-block; }
    .vt-top-nav .vt-room-id .room-icon { margin-right: 4px; font-size: 14px; }
    .vt-top-nav .vt-nav-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .vt-top-nav .vt-nav-pts {
      font-family: "Science Gothic", sans-serif;
      font-size: 12px;
      color: #facc15;
      font-weight: 400;
      display: none;
    }
    .vt-top-nav .vt-nav-pts.visible { display: block; }
    .vt-top-nav .vt-coin {
      background: linear-gradient(90deg, #ffee00, #ffffff, #ffee00);
      background-size: 200% auto;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: vt-coin-shine 3s linear infinite;
    }
    @keyframes vt-coin-shine {
      to { background-position: 200% center; }
    }
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
      font-family: "Science Gothic", sans-serif;
      font-size: 14px;
      font-weight: 400;
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
      font-family: "Science Gothic", sans-serif;
      font-size: 14px;
      font-weight: 400;
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

  function injectStyles() {
    if (document.getElementById('vt-top-nav-styles')) return;
    const s = document.createElement('style');
    s.id = 'vt-top-nav-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function buildHTML() {
    return `
      <div class="vt-top-nav" id="vtTopNav">
        <a class="vt-nav-logo" href="index.html">
          <span class="vt-logo-content" id="vtLogoContent"><img src="logo.png" alt="logo"><span class="logo-vt">VT</span><span class="logo-world">World</span></span>
          <span class="vt-room-id" id="vtRoomId"></span>
        </a>
        <div class="vt-nav-right">
          <span class="vt-nav-pts" id="vtNavPts">0 <span class="vt-coin">〄</span></span>
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
        <div class="dd-divider" id="vtDdDividerCustom" style="display:none"></div>
        <div id="vtNavCustom"></div>
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

    // Tự động hiện nút "Rời phòng" cho mọi trang có ?room= trên URL,
    // kể cả khi game không gọi setLeaveAction riêng.
    const params = new URLSearchParams(location.search);
    if (params.get('room')) {
      const leaveBtn = document.getElementById('vtDdLeave');
      if (leaveBtn && !leaveBtn.classList.contains('visible')) {
        leaveBtn.classList.add('visible');
        leaveBtn.onclick = () => {
          dd.classList.remove('open');
          btn.classList.remove('open');
          if (confirm('Rời phòng và thoát game?')) {
            window.location.href = 'games.html';
          }
        };
      }
    }
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
    renderMenuActions();
    if (document.body.dataset.hidePoints !== 'true') {
      listenBalance();
    }
  }
  
function setPoints(pts) {
    _currentBalance = Number(pts) || 0;
    const el = document.getElementById('vtNavPts');
    if (!el) return;
    el.innerHTML = _currentBalance.toLocaleString() + ' <span class="vt-coin">〄</span>';
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

  let _pendingMenuActions = null;

  function renderMenuActions() {
    const container = document.getElementById('vtNavCustom');
    const divider = document.getElementById('vtDdDividerCustom');
    if (!container) return;
    const actions = _pendingMenuActions;
    if (!actions || !actions.length) {
      container.innerHTML = '';
      if (divider) divider.style.display = 'none';
      return;
    }
    container.innerHTML = actions.map((a, i) =>
      `<button class="vt-dd-action" id="vtCustomAction${i}"><span>${a.icon || ''}</span>${a.label}</button>`
    ).join('');
    actions.forEach((a, i) => {
      const btn = document.getElementById(`vtCustomAction${i}`);
      if (btn) btn.onclick = () => {
        document.getElementById('vtNavDropdown')?.classList.remove('open');
        document.getElementById('vtHamburger')?.classList.remove('open');
        a.onClick();
      };
    });
    if (divider) divider.style.display = 'block';
  }

  function setMenuActions(actions) {
    _pendingMenuActions = actions;
    renderMenuActions(); // no-op nếu DOM dropdown chưa dựng xong, init() sẽ tự áp dụng lại
  }

  function setRoomId(code, icon) {
    const el = document.getElementById('vtRoomId');
    const logoContent = document.getElementById('vtLogoContent');
    if (!el) return;
    if (!code) {
      el.classList.remove('visible');
      el.innerHTML = '';
      if (logoContent) logoContent.style.display = '';
      return;
    }
    el.innerHTML = (icon ? `<span class="room-icon">${icon}</span>` : '') + '#' + code;
    el.classList.add('visible');
    if (logoContent) logoContent.style.display = 'none';
  }

  return { init, setPoints, setLeaveAction, setRoomId, setMenuActions, getBalance };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('top-nav-root')) TopNav.init();
});
