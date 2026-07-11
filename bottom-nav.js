/**
 * bottom-nav.js — VTWorld Bottom Navigation Component
 */

window.BottomNav = (() => {
  const NAV_H = 58;

  const STYLES = `
    .vt-bottom-nav {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      z-index: 99999 !important;
      display: flex !important;
      align-items: stretch;
      height: ${NAV_H}px !important;
      background: #0a1020 !important;
      border-top: 2px solid #0288D1 !important;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.8) !important;
      opacity: 1 !important;
      visibility: visible !important;
      overflow: visible !important;
      transform: none !important;
      pointer-events: all !important;
    }
    .vt-bn-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      cursor: pointer;
      border: none;
      background: none;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s;
      text-decoration: none;
      position: relative;
    }
    .vt-bn-tab:active { background: rgba(2,136,209,0.08); }
    .vt-bn-icon {
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    .vt-bn-icon svg {
      width: 26px; height: 26px;
      stroke-width: 1.8; fill: none;
      stroke: rgba(148,163,184,0.7);
      transition: stroke 0.15s, fill 0.15s;
    }
    .vt-bn-tab.active .vt-bn-icon svg { stroke: #0288D1; }
    .vt-bn-tab.active .vt-bn-icon svg.fill-active { fill: #0288D1; stroke: #0288D1; }
    .vt-bn-label { display: none; }
    .vt-bn-badge {
      position: absolute; top: -4px; right: -6px;
      min-width: 15px; height: 15px;
      background: #ef4444; border-radius: 8px;
      font-size: 9px; font-weight: 500; color: #fff;
      display: none; align-items: center; justify-content: center;
      padding: 0 3px; font-family: "Science Gothic", sans-serif;
      border: 1.5px solid rgba(8,13,28,0.97);
    }
    .vt-bn-badge.visible { display: flex; }
    body.has-bottom-nav {
      padding-bottom: calc(${NAV_H}px + env(safe-area-inset-bottom, 0px));
    }

    /* Profile Panel */
    .vt-profile-panel {
      position: fixed;
      bottom: ${NAV_H}px; left: 0; right: 0;
      z-index: 99998;
      background: linear-gradient(180deg,rgba(6,14,30,0.98) 0%,rgba(4,10,24,0.99) 100%);
      border-top: 1px solid rgba(2,136,209,0.25);
      box-shadow: 0 -8px 40px rgba(0,0,0,0.7);
      backdrop-filter: blur(20px);
      transform: translateY(calc(100% + ${NAV_H}px));
      transition: transform 0.32s cubic-bezier(0.4,0,0.2,1);
      max-height: 82dvh; overflow-y: auto; scrollbar-width: none;
    }
    .vt-profile-panel::-webkit-scrollbar { display: none; }
    .vt-profile-panel.open { transform: translateY(0); }

    /* Slide-up panels (Apps & Shop) */
    .vt-slide-panel {
      position: fixed;
      left: 0; right: 0; bottom: ${NAV_H}px;
      z-index: 99998;
      background: rgba(8,13,28,0.98);
      border-top: 1px solid rgba(2,136,209,0.2);
      border-radius: 20px 20px 0 0;
      box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
      transform: translateY(100%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .vt-slide-panel.open { transform: translateY(0); }

    /* Backdrop */
    .vt-panel-backdrop {
      position: fixed; inset: 0; z-index: 99997;
      background: rgba(0,0,0,0.45);
      opacity: 0; pointer-events: none;
      transition: opacity 0.28s;
    }
    .vt-panel-backdrop.open { opacity: 1; pointer-events: all; }

    /* Profile panel internals */
    .vt-pp-quests-head { display:flex;align-items:center;justify-content:space-between;padding:10px 18px 10px; }
    .vt-pp-quests-title { font-family:'Science Gothic', sans-serif;font-size:13px;font-weight:500;color:#fbbf24;letter-spacing:0.4px; }
    .vt-pp-quest-count { font-size:11px;font-weight:500;color:#94a3b8;font-family:'Science Gothic', sans-serif; }
    .vt-pp-streak { margin:0 14px 10px;background:linear-gradient(135deg,rgba(251,146,60,0.12),rgba(239,68,68,0.06));border:1px solid rgba(251,146,60,0.28);border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px; }
    .vt-pp-streak-num { font-family:'Science Gothic', sans-serif;font-size:18px;font-weight:500;color:#fb923c;line-height:1; }
    .vt-pp-streak-label { font-size:11px;color:#fdba74;font-weight:400;margin-top:2px; }
    .vt-pp-streak-btn { padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-weight:500;font-size:12px;cursor:pointer;font-family:'Science Gothic', sans-serif;transition:all 0.2s;flex-shrink:0; }
    .vt-pp-streak-btn:hover:not(:disabled) { transform:translateY(-1px); }
    .vt-pp-streak-btn:disabled { opacity:0.5;cursor:not-allowed;background:#374151; }
    .vt-pp-quest-list { padding:0 14px 16px;display:flex;flex-direction:column;gap:7px; }
    .vt-pp-quest-row { display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(56,189,248,0.04);border:1px solid rgba(56,189,248,0.1); }
    .vt-pp-quest-row.q-done { background:rgba(52,211,153,0.07);border-color:rgba(52,211,153,0.28); }
    .vt-pp-quest-row.q-claimed { opacity:0.5; }
    .vt-pp-quest-icon { width:34px;height:34px;border-radius:10px;background:rgba(56,189,248,0.08);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0; }
    .vt-pp-quest-row.q-done .vt-pp-quest-icon { background:rgba(52,211,153,0.15); }
    .vt-pp-quest-info { flex:1;min-width:0; }
    .vt-pp-quest-name { font-size:12.5px;font-weight:800;color:#e0f2fe;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .vt-pp-quest-bar-wrap { display:flex;align-items:center;gap:6px;margin-top:5px; }
    .vt-pp-quest-bar { flex:1;height:4px;border-radius:999px;background:rgba(255,255,255,0.06);overflow:hidden; }
    .vt-pp-quest-bar-fill { height:100%;border-radius:999px;background:linear-gradient(90deg,#38bdf8,#0ea5e9);transition:width 0.4s; }
    .vt-pp-quest-row.q-done .vt-pp-quest-bar-fill { background:linear-gradient(90deg,#34d399,#059669); }
    .vt-pp-quest-prog { font-size:10px;color:#94a3b8;font-weight:400;white-space:nowrap; }
    .vt-pp-quest-claim { padding:6px 11px;border-radius:8px;border:none;background:linear-gradient(135deg,#34d399,#059669);color:#fff;font-weight:500;font-size:11px;cursor:pointer;font-family:'Science Gothic', sans-serif;flex-shrink:0;transition:all 0.2s; }
    .vt-pp-quest-claim:hover:not(:disabled) { transform:translateY(-1px); }
    .vt-pp-quest-claim:disabled { background:rgba(255,255,255,0.06);color:#64748b;cursor:not-allowed; }
    .vt-pp-quest-row.q-claimed .vt-pp-quest-claim { background:rgba(52,211,153,0.1);color:#34d399;border:1px solid rgba(52,211,153,0.2); }

    /* Page top tabs (Shop / Bag) */
    .page-top-tabs {
      display: flex;
      border-bottom: 1px solid rgba(56,189,248,0.15);
      margin-bottom: 16px;
    }
    .page-top-tab {
      flex: 1; text-align: center;
      padding: 12px 0;
      color: #7dd3fc;
      font-family: "Science Gothic", sans-serif;
      font-weight: 400; font-size: 14px;
      text-decoration: none;
      position: relative;
      transition: color 0.2s;
    }
    .page-top-tab.active { color: #38bdf8; }
    .page-top-tab.active::after {
      content: '';
      position: absolute;
      bottom: 0; left: 10%; right: 10%;
      height: 2px;
      background: #38bdf8;
      border-radius: 2px;
    }
  `;

  // BASE = thư mục chứa chính file bottom-nav.js (vd: vt-main/ hoặc vt-main/js/).
  // Dùng document.currentScript (không phải import.meta.url) để KHÔNG bắt buộc
  // các trang phải khai báo <script type="module">. import.meta.url chỉ hợp lệ
  // trong module script -> nếu có 1 trang quên type="module" thì cả file lỗi cú
  // pháp ngay lúc parse, không chạy được dòng nào (nav biến mất hoàn toàn).
  // document.currentScript hoạt động bình thường với <script src="..."> thường.
  const BASE = (() => {
    const script = document.currentScript ||
      document.querySelector('script[src*="bottom-nav.js"]');
    return script ? new URL('.', script.src).href : new URL('.', document.baseURI).href;
  })();
  function resolveHref(path) {
    return path == null ? null : new URL(path, BASE).href;
  }

  const TABS = [
    {
      key: 'home', label: 'Trang chủ', href: 'index.html',
      svg: `<svg viewBox="0 0 24 24"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-9.5z"/><path d="M9 21V13h6v8"/></svg>`,
    },
    {
      key: 'apps', label: 'Ứng dụng', href: null,
      svg: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    },
    {
      key: 'chat', label: 'Chat', href: 'chat.html',
      svg: `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
    },
    {
      key: 'shop', label: 'Shop', href: null,
      svg: `<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`,
    },
    {
      key: 'profile', label: 'Hồ sơ', href: null,
      svg: `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    },
  ];

  // Trạng thái panel — độc lập với activeKey trang
  let _profileOpen = false;
  let _appsOpen    = false;
  let _shopOpen    = false;

  function injectStyles() {
    if (document.getElementById('vt-bottom-nav-styles')) return;
    const s = document.createElement('style');
    s.id = 'vt-bottom-nav-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function buildHTML(activeKey) {
    const tabsHTML = TABS.map(tab => {
      // activeKey chỉ dùng để highlight icon trang hiện tại
      // Với shop: trang shop.html VÀ bag.html đều highlight icon shop
      const isPageActive = tab.key === activeKey;
      const cls = `vt-bn-tab${isPageActive ? ' active' : ''}`;

      if (tab.key === 'profile') {
        return `<button class="${cls}" id="vt-profile-tab" data-key="profile" aria-label="Hồ sơ">
          <span class="vt-bn-icon">${tab.svg}<span class="vt-bn-badge" id="vt-badge-profile"></span></span>
          <span class="vt-bn-label">${tab.label}</span>
        </button>`;
      }
      if (tab.key === 'apps') {
        return `<button class="${cls}" id="vt-apps-tab" data-key="apps" aria-label="Ứng dụng">
          <span class="vt-bn-icon">${tab.svg}<span class="vt-bn-badge" id="vt-badge-apps"></span></span>
          <span class="vt-bn-label">${tab.label}</span>
        </button>`;
      }
      if (tab.key === 'shop') {
        return `<button class="${cls}" id="vt-shop-tab" data-key="shop" aria-label="Shop">
          <span class="vt-bn-icon">${tab.svg}<span class="vt-bn-badge" id="vt-badge-shop"></span></span>
          <span class="vt-bn-label">${tab.label}</span>
        </button>`;
      }
      return `<a class="${cls}" href="${resolveHref(tab.href)}" data-key="${tab.key}">
        <span class="vt-bn-icon">${tab.svg}<span class="vt-bn-badge" id="vt-badge-${tab.key}"></span></span>
        <span class="vt-bn-label">${tab.label}</span>
      </a>`;
    }).join('');

    return `
      <div class="vt-panel-backdrop" id="vtPanelBackdrop"></div>

      <!-- SHOP PANEL -->
      <div class="vt-slide-panel" id="vtShopPanel">
        <div style="width:36px;height:4px;border-radius:999px;background:rgba(255,255,255,0.12);margin:10px auto 4px"></div>
        <div style="font-family:'Science Gothic', sans-serif;font-size:12px;font-weight:500;color:#7dd3fc;letter-spacing:.5px;padding:8px 18px 14px;display:block">🛒 Shop & Túi đồ</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 14px 18px">
          <a href="${resolveHref('shop.html')}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(2,136,209,0.18);background:rgba(2,136,209,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,rgba(2,136,209,0.3),rgba(14,165,233,0.2))">🛒</div>
            <span style="font-family:'Science Gothic', sans-serif;font-size:13px;font-weight:500;color:#e0f2fe">Shop</span>
            <span style="font-family:'Science Gothic', sans-serif;font-size:11px;color:#4a7a9b;text-align:center">Gacha · Mua vật phẩm</span>
          </a>
          <a href="${resolveHref('bag.html')}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(124,58,237,0.18);background:rgba(124,58,237,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(167,139,250,0.2))">🎒</div>
            <span style="font-family:'Science Gothic', sans-serif;font-size:13px;font-weight:500;color:#e0f2fe">Túi đồ</span>
            <span style="font-family:'Science Gothic', sans-serif;font-size:11px;color:#4a7a9b;text-align:center">Thú cưng · Vật phẩm</span>
          </a>
        </div>
      </div>

      <!-- APPS PANEL -->
      <div class="vt-slide-panel" id="vtAppsPanel">
        <div style="width:36px;height:4px;border-radius:999px;background:rgba(255,255,255,0.12);margin:10px auto 4px"></div>
        <div style="font-family:'Science Gothic', sans-serif;font-size:12px;font-weight:500;color:#7dd3fc;letter-spacing:.5px;padding:8px 18px 14px;display:block">📱 Ứng dụng & Trò chơi</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 14px 18px">
          <a href="${resolveHref('applications.html')}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(2,136,209,0.18);background:rgba(2,136,209,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,rgba(2,136,209,0.3),rgba(14,165,233,0.2))">📱</div>
            <span style="font-family:'Science Gothic', sans-serif;font-size:13px;font-weight:500;color:#e0f2fe">Ứng dụng</span>
            <span style="font-family:'Science Gothic', sans-serif;font-size:11px;color:#4a7a9b;text-align:center">Offline · Không cần login</span>
          </a>
          <a href="${resolveHref('games.html')}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(124,58,237,0.18);background:rgba(124,58,237,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(167,139,250,0.2))">🎮</div>
            <span style="font-family:'Science Gothic', sans-serif;font-size:13px;font-weight:500;color:#e0f2fe">Game</span>
            <span style="font-family:'Science Gothic', sans-serif;font-size:11px;color:#4a7a9b;text-align:center">Mini games · Xếp hạng</span>
          </a>
        </div>
      </div>

      <!-- PROFILE PANEL -->
      <div class="vt-profile-panel" id="vtProfilePanel">
        <div style="padding:0 0 env(safe-area-inset-bottom,0px)">
          <div style="width:36px;height:4px;border-radius:999px;background:rgba(255,255,255,0.12);margin:10px auto 0"></div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px">
            <span style="font-family:'Science Gothic', sans-serif;font-size:13px;font-weight:500;letter-spacing:.5px;color:#7dd3fc">👤 Hồ sơ</span>
            <a href="${resolveHref('profile.html')}" style="font-size:12px;font-weight:400;color:#0288D1;text-decoration:none;font-family:'Science Gothic', sans-serif">Xem đầy đủ →</a>
          </div>
          <a href="${resolveHref('profile.html')}" id="vtPpProfileCard" style="display:flex;align-items:center;gap:14px;margin:0 14px 14px;padding:14px 16px;background:rgba(2,136,209,0.07);border:1px solid rgba(2,136,209,0.18);border-radius:16px;text-decoration:none;cursor:pointer">
            <div id="vtPpAvatar" style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#0288d1,#38bdf8);display:flex;align-items:center;justify-content:center;font-weight:500;font-size:22px;color:#fff;flex-shrink:0;border:2px solid rgba(2,136,209,0.4)">?</div>
            <div style="flex:1;min-width:0">
              <div id="vtPpUsername" style="font-weight:500;font-size:16px;color:#e0f2fe;font-family:'Science Gothic', sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Đang tải...</div>
              <div id="vtPpPoints" style="font-family:'Science Gothic', sans-serif;font-size:13px;font-weight:400;color:#fbbf24;margin-top:3px">⭐ —</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.5)" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </a>
          <div style="height:1px;background:rgba(255,255,255,0.05);margin:2px 0 6px"></div>
          <div class="vt-pp-quests-head">
            <span class="vt-pp-quests-title">📅 Nhiệm vụ hôm nay</span>
            <span class="vt-pp-quest-count" id="vtPpQuestCount"></span>
          </div>
          <div id="vtPpStreak" class="vt-pp-streak">
            <div style="font-size:22px;flex-shrink:0">🔥</div>
            <div style="flex:1">
              <div id="vtPpStreakNum" class="vt-pp-streak-num">0</div>
              <div id="vtPpStreakLabel" class="vt-pp-streak-label">ngày liên tiếp</div>
            </div>
            <button id="vtPpStreakBtn" class="vt-pp-streak-btn">Nhận</button>
          </div>
          <div id="vtPpQuestList" class="vt-pp-quest-list">
            <div style="padding:10px 0;text-align:center;color:#4a7a9b;font-size:12px;font-weight:400;font-family:'Science Gothic', sans-serif">Đang tải...</div>
          </div>
        </div>
      </div>

      <div class="vt-bottom-nav" id="vtBottomNav" data-active-key="${activeKey}">${tabsHTML}</div>`;
  }

  // ── helpers ──────────────────────────────────────────────
  function _backdrop(show) {
    document.getElementById('vtPanelBackdrop').classList.toggle('open', show);
  }
  function _anyOpen() { return _profileOpen || _appsOpen || _shopOpen; }
  // Gỡ 'active' khỏi cả 3 tab toggle (apps/shop/profile) trước khi bật 1 tab —
  // tránh trường hợp tab của trang hiện tại (vd 'shop' trên shop.html) và tab
  // vừa bấm cùng sáng 1 lúc.
  function _clearToggleActive() {
    ['apps', 'shop', 'profile'].forEach(k => document.getElementById(`vt-${k}-tab`)?.classList.remove('active'));
  }

  // ── profile ──────────────────────────────────────────────
  function openPanel() {
    _closeAll();
    _profileOpen = true;
    _clearToggleActive();
    document.getElementById('vtProfilePanel').classList.add('open');
    document.getElementById('vt-profile-tab').classList.add('active');
    _backdrop(true);
    if (window.VTPanelQuests?.refresh) window.VTPanelQuests.refresh();
    else setTimeout(() => window.VTPanelQuests?.refresh?.(), 500);
  }
  function closePanel() {
    _profileOpen = false;
    document.getElementById('vtProfilePanel').classList.remove('open');
    _restoreTab('profile');
    if (!_anyOpen()) _backdrop(false);
  }
  function togglePanel() { _profileOpen ? closePanel() : openPanel(); }

  // ── shop ─────────────────────────────────────────────────
  function openShopPanel() {
    _closeAll();
    _shopOpen = true;
    _clearToggleActive();
    document.getElementById('vtShopPanel').classList.add('open');
    document.getElementById('vt-shop-tab').classList.add('active');
    _backdrop(true);
  }
  function closeShopPanel() {
    _shopOpen = false;
    document.getElementById('vtShopPanel').classList.remove('open');
    _restoreTab('shop');
    if (!_anyOpen()) _backdrop(false);
  }
  function toggleShopPanel() { _shopOpen ? closeShopPanel() : openShopPanel(); }

  // ── apps ─────────────────────────────────────────────────
  function openAppsPanel() {
    _closeAll();
    _appsOpen = true;
    _clearToggleActive();
    document.getElementById('vtAppsPanel').classList.add('open');
    document.getElementById('vt-apps-tab').classList.add('active');
    _backdrop(true);
  }
  function closeAppsPanel() {
    _appsOpen = false;
    document.getElementById('vtAppsPanel').classList.remove('open');
    _restoreTab('apps');
    if (!_anyOpen()) _backdrop(false);
  }
  function toggleAppsPanel() { _appsOpen ? closeAppsPanel() : openAppsPanel(); }

  // Đóng tất cả panel không emit backdrop
  function _closeAll() {
    if (_profileOpen) { _profileOpen = false; document.getElementById('vtProfilePanel').classList.remove('open'); _restoreTab('profile'); }
    if (_shopOpen)    { _shopOpen    = false; document.getElementById('vtShopPanel').classList.remove('open');    _restoreTab('shop'); }
    if (_appsOpen)    { _appsOpen    = false; document.getElementById('vtAppsPanel').classList.remove('open');    _restoreTab('apps'); }
    _backdrop(false);
  }

  // Khôi phục trạng thái active của icon theo trang thực tế
  function _restoreTab(key) {
    const activeKey = document.getElementById('vtBottomNav')?.dataset?.activeKey;
    if (activeKey !== key) {
      document.getElementById(`vt-${key}-tab`)?.classList.remove('active');
    } else {
      document.getElementById(`vt-${key}-tab`)?.classList.add('active');
    }
  }

  // ── bind ─────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('vt-apps-tab')?.addEventListener('click', e => { e.preventDefault(); toggleAppsPanel(); });
    document.getElementById('vt-shop-tab')?.addEventListener('click', e => { e.preventDefault(); toggleShopPanel(); });
    document.getElementById('vt-profile-tab')?.addEventListener('click', e => { e.preventDefault(); togglePanel(); });
    document.getElementById('vtPanelBackdrop')?.addEventListener('click', _closeAll);
  }

  // ── init ─────────────────────────────────────────────────
  function init(opts = {}) {
    // Chặn double-init: nếu nav đã tồn tại trong DOM (do trang gọi init() thủ
    // công + listener DOMContentLoaded tự động bên dưới cùng chạy), bỏ qua lần
    // gọi sau. Double-init từng gây lỗi: HTML/id (#vt-profile-tab, #vtProfilePanel...)
    // bị chèn 2 lần -> bindEvents() gắn listener vào bộ đầu tiên (bị bộ thứ hai
    // vẽ đè lên), nên bấm vào bộ hiển thị không có tác dụng, và các hàm update
    // DOM trong quests.js (render profile/quest) cũng cập nhật nhầm bộ bị che
    // khuất -> panel hiển thị luôn kẹt ở "Đang tải...".
    if (document.getElementById('vtBottomNav')) return;
    const activeKey = opts.active || 'home';
    injectStyles();
    document.body.classList.add('has-bottom-nav');
    document.body.insertAdjacentHTML('beforeend', buildHTML(activeKey));
    bindEvents();
    // Tự nạp quests.js (không cần khai báo <script> thủ công ở từng trang).
    // import() cache theo URL nên gọi nhiều lần / nhiều trang vẫn chỉ chạy 1 lần.
    import('./quests.js').catch(err => console.warn('BottomNav: không load được quests.js', err));
  }

  function setBadge(key, count) {
    const badge = document.getElementById(`vt-badge-${key}`);
    if (!badge) return;
    if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.classList.add('visible'); }
    else badge.classList.remove('visible');
  }

  return { init, setBadge, openPanel, closePanel, openAppsPanel, closeAppsPanel, openShopPanel, closeShopPanel };
})();

document.addEventListener('DOMContentLoaded', () => {
  const key = document.body.dataset.bottomNav;
  if (key !== undefined) BottomNav.init({ active: key || 'home' });
});
