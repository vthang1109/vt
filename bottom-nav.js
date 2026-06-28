/**
 * bottom-nav.js — VTWorld Bottom Navigation Component
 * Tab 'profile' mở panel hồ sơ + daily quests thay vì navigate
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
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.8) !important;
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
    .vt-bn-tab:active { background: rgba(2, 136, 209, 0.08); }
    .vt-bn-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .vt-bn-icon svg {
      width: 26px;
      height: 26px;
      stroke-width: 1.8;
      fill: none;
      stroke: rgba(148, 163, 184, 0.7);
      transition: stroke 0.15s, fill 0.15s;
    }
    .vt-bn-tab.active .vt-bn-icon svg { stroke: #0288D1; }
    .vt-bn-tab.active .vt-bn-icon svg.fill-active { fill: #0288D1; stroke: #0288D1; }
    .vt-bn-label { display: none; }
    .vt-bn-badge {
      position: absolute;
      top: -4px;
      right: -6px;
      min-width: 15px;
      height: 15px;
      background: #ef4444;
      border-radius: 8px;
      font-size: 9px;
      font-weight: 800;
      color: #fff;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      font-family: 'Nunito', sans-serif;
      border: 1.5px solid rgba(8, 13, 28, 0.97);
    }
    .vt-bn-badge.visible { display: flex; }
    body.has-bottom-nav {
      padding-bottom: calc(${NAV_H}px + env(safe-area-inset-bottom, 0px));
    }

    /* ===== PROFILE PANEL ===== */
    .vt-profile-panel {
      position: fixed;
      bottom: ${NAV_H}px;
      left: 0;
      right: 0;
      z-index: 99998;
      background: linear-gradient(180deg, rgba(6,14,30,0.98) 0%, rgba(4,10,24,0.99) 100%);
      border-top: 1px solid rgba(2,136,209,0.25);
      box-shadow: 0 -8px 40px rgba(0,0,0,0.7);
      backdrop-filter: blur(20px);
      transform: translateY(calc(100% + ${NAV_H}px));
      transition: transform 0.32s cubic-bezier(0.4,0,0.2,1);
      max-height: 82dvh;
      overflow-y: auto;
      scrollbar-width: none;
    }
    .vt-profile-panel::-webkit-scrollbar { display: none; }
    .vt-profile-panel.open { transform: translateY(0); }

    /* Apps Panel */
    .vt-apps-panel {
      position: fixed;
      left: 0; right: 0;
      bottom: 58px;
      z-index: 99998;
      background: rgba(8, 13, 28, 0.98);
      border-top: 1px solid rgba(2,136,209,0.2);
      border-radius: 20px 20px 0 0;
      box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
      transform: translateY(100%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .vt-apps-panel.open { transform: translateY(0); }

    .vt-ap-handle {
      width: 36px; height: 4px; border-radius: 999px;
      background: rgba(255,255,255,0.12);
      margin: 10px auto 4px;
    }
    .vt-ap-title {
      font-family: 'Orbitron', monospace;
      font-size: 12px; font-weight: 900;
      color: #7dd3fc; letter-spacing: 0.5px;
      padding: 8px 18px 14px; display: block;
    }
    .vt-ap-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 0 14px 18px;
    }
    .vt-ap-card {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 10px; padding: 18px 12px;
      border-radius: 16px; text-decoration: none;
      border: 1px solid rgba(2,136,209,0.15);
      background: rgba(2,136,209,0.06);
      transition: background 0.2s, border-color 0.2s, transform 0.15s;
      cursor: pointer;
    }
    .vt-ap-card:active { transform: scale(0.96); }
    .vt-ap-card:hover {
      background: rgba(2,136,209,0.12);
      border-color: rgba(2,136,209,0.3);
    }
    .vt-ap-card-icon {
      width: 52px; height: 52px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 26px;
    }
    .vt-ap-card-icon.apps-icon { background: linear-gradient(135deg,rgba(2,136,209,0.3),rgba(14,165,233,0.2)); }
    .vt-ap-card-icon.games-icon { background: linear-gradient(135deg,rgba(124,58,237,0.3),rgba(167,139,250,0.2)); }
    .vt-ap-card-label {
      font-family: 'Nunito', sans-serif;
      font-size: 13px; font-weight: 800; color: #e0f2fe;
    }
    .vt-ap-card-sub {
      font-size: 11px; color: #4a7a9b; font-weight: 600; text-align: center;
    }

    /* Backdrop - đã sửa lỗi CSS lặp */
    .vt-panel-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99997;
      background: rgba(0,0,0,0.45);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.28s;
    }
    .vt-panel-backdrop.open {
      opacity: 1;
      pointer-events: all;
    }

    /* Panel inner */
    .vt-pp-inner {
      padding: 0 0 env(safe-area-inset-bottom, 0px);
    }

    /* Drag handle */
    .vt-pp-handle {
      width: 36px;
      height: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      margin: 10px auto 0;
    }

    /* Section header */
    .vt-pp-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 18px 10px;
    }
    .vt-pp-section-title {
      font-family: 'Orbitron', monospace;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #7dd3fc;
    }
    .vt-pp-section-link {
      font-size: 12px;
      font-weight: 700;
      color: #0288D1;
      text-decoration: none;
      font-family: 'Nunito', sans-serif;
      opacity: 0.85;
      transition: opacity 0.15s;
    }
    .vt-pp-section-link:hover { opacity: 1; }

    /* Profile card */
    .vt-pp-profile-card {
      margin: 0 14px 14px;
      background: rgba(2,136,209,0.07);
      border: 1px solid rgba(2,136,209,0.18);
      border-radius: 16px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      text-decoration: none;
      transition: background 0.2s, border-color 0.2s;
      cursor: pointer;
    }
    .vt-pp-profile-card:hover {
      background: rgba(2,136,209,0.12);
      border-color: rgba(2,136,209,0.3);
    }
    .vt-pp-avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0288d1, #38bdf8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 22px;
      color: #fff;
      flex-shrink: 0;
      border: 2px solid rgba(2,136,209,0.4);
      background-size: cover;
      background-position: center;
    }
    .vt-pp-user-info { flex: 1; min-width: 0; }
    .vt-pp-username {
      font-weight: 900;
      font-size: 16px;
      color: #e0f2fe;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .vt-pp-points {
      font-family: 'Orbitron', monospace;
      font-size: 13px;
      font-weight: 700;
      color: #fbbf24;
      margin-top: 3px;
    }
    .vt-pp-chevron {
      color: rgba(148,163,184,0.5);
      flex-shrink: 0;
    }

    /* Divider */
    .vt-pp-divider {
      height: 1px;
      background: rgba(255,255,255,0.05);
      margin: 2px 0 6px;
    }

    /* Daily quests section inside panel */
    .vt-pp-quests-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px 10px;
    }
    .vt-pp-quests-title {
      font-family: 'Orbitron', monospace;
      font-size: 13px;
      font-weight: 900;
      color: #fbbf24;
      letter-spacing: 0.4px;
    }
    .vt-pp-quest-count {
      font-size: 11px;
      font-weight: 800;
      color: #94a3b8;
      font-family: 'Nunito', sans-serif;
    }

    /* Streak mini */
    .vt-pp-streak {
      margin: 0 14px 10px;
      background: linear-gradient(135deg, rgba(251,146,60,0.12), rgba(239,68,68,0.06));
      border: 1px solid rgba(251,146,60,0.28);
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .vt-pp-streak-fire { font-size: 26px; filter: drop-shadow(0 0 8px rgba(251,146,60,0.5)); }
    .vt-pp-streak-info { flex: 1; min-width: 0; }
    .vt-pp-streak-num {
      font-family: 'Orbitron', monospace;
      font-size: 18px;
      font-weight: 900;
      color: #fb923c;
      line-height: 1;
    }
    .vt-pp-streak-label { font-size: 11px; color: #fdba74; font-weight: 700; margin-top: 2px; }
    .vt-pp-streak-btn {
      padding: 7px 14px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: #fff;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
      font-family: 'Nunito', sans-serif;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .vt-pp-streak-btn:hover:not(:disabled) { transform: translateY(-1px); }
    .vt-pp-streak-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #374151; }

    /* Quest mini rows */
    .vt-pp-quest-list {
      padding: 0 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .vt-pp-quest-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(56,189,248,0.04);
      border: 1px solid rgba(56,189,248,0.1);
    }
    .vt-pp-quest-row.q-done {
      background: rgba(52,211,153,0.07);
      border-color: rgba(52,211,153,0.28);
    }
    .vt-pp-quest-row.q-claimed { opacity: 0.5; }
    .vt-pp-quest-icon {
      width: 34px; height: 34px;
      border-radius: 10px;
      background: rgba(56,189,248,0.08);
      display: flex; align-items: center; justify-content: center;
      font-size: 17px;
      flex-shrink: 0;
    }
    .vt-pp-quest-row.q-done .vt-pp-quest-icon { background: rgba(52,211,153,0.15); }
    .vt-pp-quest-info { flex: 1; min-width: 0; }
    .vt-pp-quest-name {
      font-size: 12.5px;
      font-weight: 800;
      color: #e0f2fe;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .vt-pp-quest-bar-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 5px;
    }
    .vt-pp-quest-bar {
      flex: 1;
      height: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      overflow: hidden;
    }
    .vt-pp-quest-bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #38bdf8, #0ea5e9);
      transition: width 0.4s;
    }
    .vt-pp-quest-row.q-done .vt-pp-quest-bar-fill { background: linear-gradient(90deg, #34d399, #059669); }
    .vt-pp-quest-prog { font-size: 10px; color: #94a3b8; font-weight: 700; white-space: nowrap; }
    .vt-pp-quest-claim {
      padding: 6px 11px;
      border-radius: 8px;
      border: none;
      background: linear-gradient(135deg, #34d399, #059669);
      color: #fff;
      font-weight: 800;
      font-size: 11px;
      cursor: pointer;
      font-family: 'Nunito', sans-serif;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .vt-pp-quest-claim:hover:not(:disabled) { transform: translateY(-1px); }
    .vt-pp-quest-claim:disabled {
      background: rgba(255,255,255,0.06);
      color: #64748b;
      cursor: not-allowed;
    }
    .vt-pp-quest-row.q-claimed .vt-pp-quest-claim {
      background: rgba(52,211,153,0.1);
      color: #34d399;
      border: 1px solid rgba(52,211,153,0.2);
    }
  `;

  const TABS = [
    {
      key: 'home',
      label: 'Trang chủ',
      href: 'index.html',
      svg: `<svg viewBox="0 0 24 24"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-9.5z"/><path d="M9 21V13h6v8"/></svg>`,
    },
    {
      key: 'apps',
      label: 'Ứng dụng',
      href: null, // handled by apps panel
      svg: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    },
    {
      key: 'chat',
      label: 'Chat',
      href: 'chat.html',
      svg: `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
    },
    {
      key: 'shop',
      label: 'Shop',
      href: 'shop.html',
      svg: `<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`,
    },
    {
      key: 'profile',
      label: 'Hồ sơ',
      href: null, // handled by panel
      svg: `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    },
  ];

  let _panelOpen = false;
  let _appsPanelOpen = false;

  function injectStyles() {
    if (document.getElementById('vt-bottom-nav-styles')) return;
    const style = document.createElement('style');
    style.id = 'vt-bottom-nav-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function buildHTML(activeKey) {
    const tabsHTML = TABS.map(tab => {
      const isActive = tab.key === activeKey;
      // Profile tab: no href, toggles panel
      if (tab.key === 'profile') {
        return `<button class="vt-bn-tab${isActive ? ' active' : ''}" id="vt-profile-tab" data-key="profile" aria-label="Hồ sơ">
          <span class="vt-bn-icon">
            ${tab.svg}
            <span class="vt-bn-badge" id="vt-badge-profile"></span>
          </span>
          <span class="vt-bn-label">${tab.label}</span>
        </button>`;
      }
      // Apps tab: opens panel
      if (tab.key === 'apps') {
        return `<button class="vt-bn-tab${isActive ? ' active' : ''}" id="vt-apps-tab" data-key="apps" aria-label="Ứng dụng">
          <span class="vt-bn-icon">
            ${tab.svg}
            <span class="vt-bn-badge" id="vt-badge-apps"></span>
          </span>
          <span class="vt-bn-label">${tab.label}</span>
        </button>`;
      }
      return `<a class="vt-bn-tab${isActive ? ' active' : ''}" href="${tab.href}" data-key="${tab.key}">
        <span class="vt-bn-icon">
          ${tab.svg}
          <span class="vt-bn-badge" id="vt-badge-${tab.key}"></span>
        </span>
        <span class="vt-bn-label">${tab.label}</span>
      </a>`;
    }).join('');

    return `
      <div class="vt-panel-backdrop" id="vtPanelBackdrop"></div>

      <!-- APPS PANEL -->
      <div class="vt-apps-panel" id="vtAppsPanel">
        <div style="width:36px;height:4px;border-radius:999px;background:rgba(255,255,255,0.12);margin:10px auto 4px"></div>
        <div style="font-family:'Orbitron',monospace;font-size:12px;font-weight:900;color:#7dd3fc;letter-spacing:.5px;padding:8px 18px 14px;display:block">📱 Ứng dụng & Trò chơi</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 14px 18px">
          <a href="applications.html" onclick="BottomNav.closeAppsPanel()" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(2,136,209,0.18);background:rgba(2,136,209,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,rgba(2,136,209,0.3),rgba(14,165,233,0.2))">📱</div>
            <span style="font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#e0f2fe">Ứng dụng</span>
            <span style="font-family:'Nunito',sans-serif;font-size:11px;color:#4a7a9b;text-align:center">Offline · Không cần login</span>
          </a>
          <a href="games.html" onclick="BottomNav.closeAppsPanel()" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(124,58,237,0.18);background:rgba(124,58,237,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(167,139,250,0.2))">🎮</div>
            <span style="font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#e0f2fe">Game</span>
            <span style="font-family:'Nunito',sans-serif;font-size:11px;color:#4a7a9b;text-align:center">Mini games · Xếp hạng</span>
          </a>
        </div>
      </div>

      <!-- PROFILE PANEL -->
      <div class="vt-profile-panel" id="vtProfilePanel">
        <div style="padding:0 0 env(safe-area-inset-bottom,0px)">
          <div style="width:36px;height:4px;border-radius:999px;background:rgba(255,255,255,0.12);margin:10px auto 0"></div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px">
            <span style="font-family:'Orbitron',monospace;font-size:13px;font-weight:900;letter-spacing:.5px;color:#7dd3fc">👤 Hồ sơ</span>
            <a href="profile.html" style="font-size:12px;font-weight:700;color:#0288D1;text-decoration:none;font-family:'Nunito',sans-serif">Xem đầy đủ →</a>
          </div>

          <a href="profile.html" id="vtPpProfileCard" style="display:flex;align-items:center;gap:14px;margin:0 14px 14px;padding:14px 16px;background:rgba(2,136,209,0.07);border:1px solid rgba(2,136,209,0.18);border-radius:16px;text-decoration:none;cursor:pointer">
            <div id="vtPpAvatar" style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#0288d1,#38bdf8);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;color:#fff;flex-shrink:0;border:2px solid rgba(2,136,209,0.4)">?</div>
            <div style="flex:1;min-width:0">
              <div id="vtPpUsername" style="font-weight:900;font-size:16px;color:#e0f2fe;font-family:'Nunito',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Đang tải...</div>
              <div id="vtPpPoints" style="font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#fbbf24;margin-top:3px">⭐ —</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.5)" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </a>

          <div style="height:1px;background:rgba(255,255,255,0.05);margin:2px 0 6px"></div>

          <div class="vt-pp-quests-head" style="display:flex;align-items:center;justify-content:space-between;padding:10px 18px 8px">
            <span class="vt-pp-quests-title" style="font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#e0f2fe">📅 Nhiệm vụ hôm nay</span>
            <span class="vt-pp-quest-count" id="vtPpQuestCount" style="font-family:'Nunito',sans-serif;font-size:12px;color:#34d399;font-weight:700"></span>
          </div>

          <div id="vtPpStreak" class="vt-pp-streak" style="display:flex;align-items:center;gap:10px;margin:0 14px 10px;padding:10px 14px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:12px">
            <div style="font-size:22px;flex-shrink:0">🔥</div>
            <div style="flex:1">
              <div id="vtPpStreakNum" class="vt-pp-streak-num" style="font-family:'Orbitron',monospace;font-size:18px;font-weight:900;color:#fb923c">0</div>
              <div id="vtPpStreakLabel" class="vt-pp-streak-label" style="font-size:11px;color:#fdba74;font-weight:700;font-family:'Nunito',sans-serif;margin-top:1px">ngày liên tiếp</div>
            </div>
            <button id="vtPpStreakBtn" class="vt-pp-streak-btn" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-weight:800;font-size:12px;cursor:pointer;font-family:'Nunito',sans-serif;flex-shrink:0">Nhận</button>
          </div>

          <div id="vtPpQuestList" class="vt-pp-quest-list" style="display:flex;flex-direction:column;gap:7px;padding:0 14px 16px">
            <div style="padding:10px 0;text-align:center;color:#4a7a9b;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif">Đang tải...</div>
          </div>
        </div>
      </div>
      <div class="vt-bottom-nav" id="vtBottomNav">${tabsHTML}</div>`;
  }

  function openPanel() {
    _panelOpen = true;
    document.getElementById('vtProfilePanel').classList.add('open');
    document.getElementById('vtPanelBackdrop').classList.add('open');
    document.getElementById('vt-profile-tab')?.classList.add('active');
    // Tell quests module to render into panel
    if (window.VTPanelQuests && typeof window.VTPanelQuests.refresh === 'function') {
      window.VTPanelQuests.refresh();
    } else {
      console.warn('VTPanelQuests chưa sẵn sàng, thử lại sau 500ms');
      setTimeout(() => {
        if (window.VTPanelQuests && typeof window.VTPanelQuests.refresh === 'function') {
          window.VTPanelQuests.refresh();
        }
      }, 500);
    }
  }

  function closePanel() {
    _panelOpen = false;
    document.getElementById('vtProfilePanel').classList.remove('open');
    document.getElementById('vtPanelBackdrop').classList.remove('open');
    // Remove active from profile tab only if not truly active page
    const activeKey = document.querySelector('.vt-bottom-nav')?.dataset?.activeKey;
    if (activeKey !== 'profile') {
      document.getElementById('vt-profile-tab')?.classList.remove('active');
    }
  }

  function togglePanel() {
    _panelOpen ? closePanel() : openPanel();
  }

  function openAppsPanel() {
    _appsPanelOpen = true;
    // Đóng profile panel nếu đang mở
    if (_panelOpen) closePanel();
    document.getElementById('vtAppsPanel').classList.add('open');
    document.getElementById('vtPanelBackdrop').classList.add('open');
    document.getElementById('vt-apps-tab')?.classList.add('active');
  }

  function closeAppsPanel() {
    _appsPanelOpen = false;
    document.getElementById('vtAppsPanel').classList.remove('open');
    document.getElementById('vtPanelBackdrop').classList.remove('open');
    const activeKey = document.getElementById('vtBottomNav')?.dataset?.activeKey;
    if (activeKey !== 'apps') {
      document.getElementById('vt-apps-tab')?.classList.remove('active');
    }
  }

  function toggleAppsPanel() {
    _appsPanelOpen ? closeAppsPanel() : openAppsPanel();
  }

  function bindEvents() {
    document.getElementById('vt-apps-tab')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleAppsPanel();
    });
    document.getElementById('vt-profile-tab')?.addEventListener('click', (e) => {
      e.preventDefault();
      // Đóng apps panel nếu đang mở
      if (_appsPanelOpen) closeAppsPanel();
      togglePanel();
    });
    document.getElementById('vtPanelBackdrop')?.addEventListener('click', () => {
      closePanel();
      closeAppsPanel();
    });
  }

  function init(opts = {}) {
    const activeKey = opts.active || 'home';
    injectStyles();
    document.body.classList.add('has-bottom-nav');
    document.body.insertAdjacentHTML('beforeend', buildHTML(activeKey));
    // Store active key for reference
    document.getElementById('vtBottomNav').dataset.activeKey = activeKey;
    bindEvents();
  }

  function setBadge(key, count) {
    const badge = document.getElementById(`vt-badge-${key}`);
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  return { init, setBadge, openPanel, closePanel, openAppsPanel, closeAppsPanel };
})();

document.addEventListener('DOMContentLoaded', () => {
  const key = document.body.dataset.bottomNav;
  if (key !== undefined) BottomNav.init({ active: key || 'home' });
});