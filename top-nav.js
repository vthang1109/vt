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

  // Xác định thư mục gốc chứa top-nav.js (và logo.png) dựa trên URL của chính
  // script này, để logo hiển thị đúng dù trang HTML nằm sâu bao nhiêu cấp thư mục.
  const _scriptEl = document.currentScript;
  const _basePath = _scriptEl && _scriptEl.src
    ? _scriptEl.src.substring(0, _scriptEl.src.lastIndexOf('/') + 1)
    : '';
  const LOGO_SRC = _basePath + 'logo.png';

  async function listenBalance() {
    try {
      // Dùng _basePath (thư mục chứa top-nav.js) để import đúng từ mọi thư mục con
      const baseUrl = new URL('points.js', _basePath).href;
      const { auth, subscribeBalance, onAuthStateChanged } = await import(baseUrl);
      onAuthStateChanged(auth, (user) => {
        if (_unsubBalance) { _unsubBalance(); _unsubBalance = null; }
        
        const loginBtn = document.getElementById('vtDdLogin');
        const logoutBtn = document.getElementById('vtDdLogout');
        const profileBtn = document.getElementById('vtDdProfile');
        const ptsEl = document.getElementById('vtNavPts');
        
        if (user) {
          // Đã đăng nhập: ẩn login, hiện logout + profile
          if (loginBtn) loginBtn.classList.add('hidden');
          if (logoutBtn) logoutBtn.classList.add('visible');
          if (profileBtn) profileBtn.classList.add('visible');
          
          _unsubBalance = subscribeBalance(pts => {
            _currentBalance = pts || 0;
            setPoints(_currentBalance);
          });
        } else {
          // Chưa đăng nhập: hiện login, ẩn logout + profile, ẩn điểm
          if (loginBtn) loginBtn.classList.remove('hidden');
          if (logoutBtn) logoutBtn.classList.remove('visible');
          if (profileBtn) profileBtn.classList.remove('visible');
          if (ptsEl) ptsEl.classList.remove('visible');
        }
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
    .vt-dd-action.login-btn { color: #34d399; display: flex; }
    .vt-dd-action.logout-btn { color: #f87171; display: none; }
    .vt-dd-action.profile-btn { color: #38bdf8; display: none; }
    .vt-dd-action.logout-btn.visible,
    .vt-dd-action.profile-btn.visible { display: flex; }
    .vt-dd-action.login-btn.hidden { display: none; }
  `;

  function injectStyles() {
    if (document.getElementById('vt-top-nav-styles')) return;
    const s = document.createElement('style');
    s.id = 'vt-top-nav-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function buildHTML() {
    const isMpGame = new URLSearchParams(location.search).has('room');
    return `
      <div class="vt-top-nav" id="vtTopNav">
        <a class="vt-nav-logo" href="/index.html">
          <span class="vt-logo-content" id="vtLogoContent" style="${isMpGame ? 'display:none' : ''}"><img src="${LOGO_SRC}" alt="logo"><span class="logo-vt">VT</span><span class="logo-world">World</span></span>
          <span class="vt-room-id${isMpGame ? ' visible' : ''}" id="vtRoomId">${isMpGame ? '🎮 Đang chơi' : ''}</span>
        </a>
        <div class="vt-nav-right">
          <span class="vt-nav-pts" id="vtNavPts">0 <span class="vt-coin">〄</span></span>
          <button class="vt-hamburger" id="vtHamburger" aria-label="Menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </button>
        </div>
      </div>
      <div class="vt-nav-dropdown" id="vtNavDropdown">
        <button class="vt-dd-action back-btn" onclick="history.back()">
          <span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor"><path d="M256 64c-56.8 0-107.9 24.7-143.1 64l47.1 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 192c-17.7 0-32-14.3-32-32L0 32C0 14.3 14.3 0 32 0S64 14.3 64 32l0 54.7C110.9 33.6 179.5 0 256 0 397.4 0 512 114.6 512 256S397.4 512 256 512c-87 0-163.9-43.4-210.1-109.7-10.1-14.5-6.6-34.4 7.9-44.6s34.4-6.6 44.6 7.9c34.8 49.8 92.4 82.3 157.6 82.3 106 0 192-86 192-192S362 64 256 64z"/></svg></span> Quay lại
        </button>
        <button class="vt-dd-action settings-btn" onclick="window.location.href='/app/settings.html'">
          <span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor"><path d="M195.1 9.5C198.1-5.3 211.2-16 226.4-16l59.8 0c15.2 0 28.3 10.7 31.3 25.5L332 79.5c14.1 6 27.3 13.7 39.3 22.8l67.8-22.5c14.4-4.8 30.2 1.2 37.8 14.4l29.9 51.8c7.6 13.2 4.9 29.8-6.5 39.9L447 233.3c.9 7.4 1.3 15 1.3 22.7s-.5 15.3-1.3 22.7l53.4 47.5c11.4 10.1 14 26.8 6.5 39.9l-29.9 51.8c-7.6 13.1-23.4 19.2-37.8 14.4l-67.8-22.5c-12.1 9.1-25.3 16.7-39.3 22.8l-14.4 69.9c-3.1 14.9-16.2 25.5-31.3 25.5l-59.8 0c-15.2 0-28.3-10.7-31.3-25.5l-14.4-69.9c-14.1-6-27.2-13.7-39.3-22.8L73.5 432.3c-14.4 4.8-30.2-1.2-37.8-14.4L5.8 366.1c-7.6-13.2-4.9-29.8 6.5-39.9l53.4-47.5c-.9-7.4-1.3-15-1.3-22.7s.5-15.3 1.3-22.7L12.3 185.8c-11.4-10.1-14-26.8-6.5-39.9L35.7 94.1c7.6-13.2 23.4-19.2 37.8-14.4l67.8 22.5c12.1-9.1 25.3-16.7 39.3-22.8L195.1 9.5zM256.3 336a80 80 0 1 0 -.6-160 80 80 0 1 0 .6 160z"/></svg></span> Cài đặt
        </button>
        <button class="vt-dd-action leave-btn" id="vtDdLeave">
          <span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="16" height="16" fill="currentColor"><path d="M192-32a56 56 0 1 1 0 112 56 56 0 1 1 0-112zM128 173.6c0-34 27.6-61.6 61.6-61.6 20.3 0 39.7 8.1 54 22.4l48.2 48.2c6 6 14.1 9.4 22.6 9.4l37.5 0c5.8 0 11.3 1.6 16 4.3l0-76.3c0-13.3 10.7-24 24-24s24 10.7 24 24l0 400c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-268.3c-4.7 2.7-10.2 4.3-16 4.3l-37.5 0c-25.5 0-49.9-10.1-67.9-28.1l-6.6-6.6 0 109.2 34.5 29.6c17.7 15.2 29.3 36.2 32.6 59.3l12.6 88.1c2.5 17.5-9.7 33.7-27.2 36.2s-33.7-9.7-36.2-27.2l-12.6-88.1c-1.1-7.7-5-14.7-10.9-19.8l-71.4-61.2c-21.3-18.2-33.5-44.9-33.5-72.9l0-101zm-4.8 203.7c2.3 2.3 4.7 4.4 7.1 6.5l44.9 38.5c-3.6 8.4-8.5 16.3-14.4 23.4L88.6 532.5c-11.3 13.6-31.5 15.4-45.1 4.1s-15.4-31.5-4.1-45.1l72.3-86.7c2.6-3.1 4.5-6.6 5.8-10.4l5.7-17.1zM0 160c0-35.3 28.7-64 64-64 17.7 0 32 14.3 32 32l0 128c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-96z"/></svg></span> Rời phòng
        </button>
        <div class="dd-divider"></div>
        <button class="vt-dd-action login-btn" id="vtDdLogin">
          <span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"/></svg></span> Đăng nhập
        </button>
        <button class="vt-dd-action profile-btn" id="vtDdProfile">
          <span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span> Hồ sơ
        </button>
        <button class="vt-dd-action logout-btn" id="vtDdLogout">
          <span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg></span> Đăng xuất
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

    // Auth buttons
    const loginBtn = document.getElementById('vtDdLogin');
    const logoutBtn = document.getElementById('vtDdLogout');
    const profileBtn = document.getElementById('vtDdProfile');
    
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        dd.classList.remove('open');
        btn.classList.remove('open');
        // Nếu đang ở index.html, dùng showPage. Ngược lại, chuyển hướng về index.
        if (typeof window.showPage === 'function') {
          window.showPage('login');
        } else {
          window.location.href = '/index.html';
        }
      });
    }
    
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        dd.classList.remove('open');
        btn.classList.remove('open');
        window.location.href = '/app/profile.html';
      });
    }
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        dd.classList.remove('open');
        btn.classList.remove('open');
        try {
          const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
          const baseUrl = new URL('points.js', _basePath).href;
          const { auth } = await import(baseUrl);
          // Cập nhật trạng thái offline
          try {
            const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
            const { db } = await import(baseUrl);
            if (auth.currentUser) {
              await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                status: 'offline',
                lastSeen: serverTimestamp()
              });
            }
          } catch(e) {}
          await signOut(auth);
          window.location.href = '/index.html';
        } catch(e) {
          console.error('Logout failed:', e);
          alert('Đăng xuất thất bại!');
        }
      });
    }

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
    if (document.getElementById('vtTopNav')) return; // chặn init trùng (double-call sẽ chèn thêm 1 bộ nav)
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
      // Trên trang MP game (?room=), luôn giấu logo dù có code hay không
      const isMpGame = new URLSearchParams(location.search).has('room');
      if (logoContent && !isMpGame) logoContent.style.display = '';
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
