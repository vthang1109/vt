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
    .vt-bn-tab:active .vt-bn-icon { transform: scale(0.88); }
    .vt-bn-tab.active:active .vt-bn-icon { transform: scale(0.92); }
    .vt-bn-icon {
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      position: relative;
      transition: transform 0.12s cubic-bezier(0.4,0,0.2,1);
    }
    .vt-bn-icon svg {
      stroke-width: 1.8; fill: none;
      stroke: rgba(148,163,184,0.7);
      transition: stroke 0.15s, fill 0.15s;
    }
    .vt-bn-icon svg.vt-bn-fill {
      fill: rgba(148,163,184,0.7);
      stroke: none;
    }
    .vt-bn-tab.active .vt-bn-icon svg { stroke: #0288D1; }
    .vt-bn-tab.active .vt-bn-icon svg.vt-bn-fill { fill: #0288D1; stroke: none; }
    .vt-bn-tab.active .vt-bn-icon svg.fill-active { fill: #0288D1; stroke: #0288D1; }
    .vt-bn-tab.active .vt-bn-icon::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 6px;
      background: rgba(2,136,209,0.08);
      animation: vtBnPulse 2s ease-in-out infinite;
    }
    @keyframes vtBnPulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.12); }
    }
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

  // BASE = thu muc chua chinh file bottom-nav.js (vd: vt-main/ hoac vt-main/js/).
  // Dung document.currentScript (khong phai import.meta.url) de KHONG bat buoc
  // cac trang phai khai bao <script type="module">. import.meta.url chi hop le
  // trong module script -> neu co 1 trang quen type="module" thi ca file loi cu
  // phap ngay luc parse, khong chay duoc dong nao (nav bien mat hoan toan).
  // document.currentScript hoat dong binh thuong voi <script src="..."> thuong.
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
      svg: `<svg class="vt-bn-fill" viewBox="0 0 512 512"><path d="M277.8 8.6c-12.3-11.4-31.3-11.4-43.5 0l-224 208c-9.6 9-12.8 22.9-8 35.1S18.8 272 32 272l16 0 0 176c0 35.3 28.7 64 64 64l288 0c35.3 0 64-28.7 64-64l0-176 16 0c13.2 0 25-8.1 29.8-20.3s1.6-26.2-8-35.1l-224-208zM240 320l32 0c26.5 0 48 21.5 48 48l0 96-128 0 0-96c0-26.5 21.5-48 48-48z"/></svg>`,
    },
    {
      key: 'apps', label: 'Ứng dụng', href: null,
      svg: `<svg class="vt-bn-fill" viewBox="0 0 640 512"><path d="M448 64c106 0 192 86 192 192S554 448 448 448l-256 0C86 448 0 362 0 256S86 64 192 64l256 0zM192 176c-13.3 0-24 10.7-24 24l0 32-32 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l32 0 0 32c0 13.3 10.7 24 24 24s24-10.7 24-24l0-32 32 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-32 0 0-32c0-13.3-10.7-24-24-24zm240 96a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm64-96a32 32 0 1 0 0 64 32 32 0 1 0 0-64z"/></svg>`,
    },
    {
      key: 'chat', label: 'Chat', href: 'app/chat.html',
      svg: `<svg class="vt-bn-fill" viewBox="0 0 512 512"><path d="M256 0c-13.3 0-26.3 1-39.1 3l3.7 23.7C232.1 24.9 244 24 256 24s23.9 .9 35.4 2.7L295.1 3C282.3 1 269.3 0 256 0zm60.8 7.3l-5.7 23.3c23.4 5.7 45.4 14.9 65.4 27.1l12.5-20.5c-22.1-13.4-46.4-23.6-72.2-29.9zm76.4 61.6c19.1 14 36 30.9 50.1 50.1l19.4-14.2C447 83.6 428.4 65 407.3 49.5L393.1 68.8zm81.7 54.2l-20.5 12.5c12.2 20 21.4 42 27.1 65.4l23.3-5.7c-6.3-25.8-16.5-50.1-29.9-72.2zm10.5 97.5c1.8 11.5 2.7 23.4 2.7 35.4s-.9 23.9-2.7 35.4l23.7 3.7c1.9-12.7 3-25.8 3-39.1s-1-26.3-3-39.1l-23.7 3.7zm-31 155.9l20.5 12.5c13.4-22.1 23.6-46.4 29.9-72.2l-23.3-5.7c-5.7 23.4-14.9 45.4-27.1 65.4zm8.2 30.8l-19.4-14.2c-14 19.1-30.9 36-50.1 50.1l14.2 19.4c21.1-15.5 39.8-34.1 55.2-55.2zm-86.1 47c-20 12.2-42 21.4-65.4 27.1l5.7 23.3c25.8-6.3 50.1-16.5 72.2-29.9l-12.5-20.5zM295.1 509l-3.7-23.7C279.9 487.1 268 488 256 488s-23.9-.9-35.4-2.7L216.9 509c12.7 1.9 25.8 3 39.1 3s26.3-1 39.1-3zm-94.1-27.6c-17.6-4.3-34.4-10.6-50.1-18.6l-7.8-4-32.8 7.7 5.5 23.4 24.3-5.7c17.4 8.9 35.9 15.8 55.3 20.5l5.7-23.3zM95.4 494.6L90 471.3 48.3 481c-10.4 2.4-19.7-6.9-17.3-17.3l9.7-41.6-23.4-5.5-9.7 41.6C1.2 486 26 510.8 53.8 504.4l41.6-9.7zm-50-92.9l7.7-32.8-4-7.8c-8-15.7-14.3-32.5-18.6-50.1L7.3 316.7C12 336.1 18.9 354.7 27.7 372l-5.7 24.3 23.4 5.5zM3 295.1l23.7-3.7C24.9 279.9 24 268 24 256s.9-23.9 2.7-35.4L3 216.9C1 229.7 0 242.7 0 256s1 26.3 3 39.1zm27.6-94.1c5.7-23.4 14.9-45.4 27.1-65.4L37.2 123.1c-13.4 22.1-23.6 46.4-29.9 72.2l23.3 5.7zm18.9-96.2l19.4 14.2c14-19.1 30.9-36 50.1-50.1L104.7 49.5C83.6 65 65 83.6 49.5 104.7zm86.1-47c20-12.2 42-21.4 65.4-27.1L195.2 7.3c-25.8 6.3-50.1 16.5-72.2 29.9l12.5 20.5zM256 464c114.9 0 208-93.1 208-208S370.9 48 256 48 48 141.1 48 256c0 36.4 9.4 70.7 25.8 100.5 1.6 2.9 2.1 6.2 1.4 9.4l-21.6 92.5 92.5-21.6c3.2-.7 6.5-.2 9.4 1.4 29.8 16.5 64 25.8 100.5 25.8z"/></svg>`,
    },
    {
      key: 'shop', label: 'Shop', href: null,
      svg: `<svg class="vt-bn-fill" viewBox="0 0 448 512"><path d="M388.5 104.1c-.2-1.1-.7-2.1-1.5-2.8s-1.8-1.2-2.9-1.2c-2 0-37.2-.8-37.2-.8s-21.6-20.8-29.6-28.8l0 432.7 125.7-31.2s-54-365.5-54.4-367.9zM288.9 70.5c-1.9-6.1-4.3-11.9-7.2-17.6-10.4-20-26-30.9-44.4-30.9-1.3 0-2.7 .1-4 .4-.4-.8-1.2-1.2-1.6-2-8-8.8-18.4-12.8-30.8-12.4-24 .8-48 18-67.2 48.8-13.6 21.6-24 48.8-26.8 70.1-27.6 8.4-46.8 14.4-47.2 14.8-14 4.4-14.4 4.8-16 18-1.2 10-38 291.8-38 291.8l302.6 52.5 0-438.3c-1.5 .1-2.9 .2-4.4 .4 0 0-5.6 1.6-14.8 4.4zM233.6 87.7c-16 4.8-33.6 10.4-50.8 15.6 4.8-18.8 14.4-37.6 25.6-50 4.4-4.4 10.4-9.6 17.2-12.8 6.8 14.4 8.4 34 8 47.2zM200.8 24.4c5-.2 10 1.1 14.4 3.6-6.4 3.2-12.8 8.4-18.8 14.4-15.2 16.4-26.8 42-31.6 66.5-14.4 4.4-28.8 8.8-42 12.8 8.8-38.4 41.2-96.4 78-97.2zM154.4 244.6c1.6 25.6 69.2 31.2 73.2 91.7 2.8 47.6-25.2 80.1-65.6 82.5-48.8 3.2-75.6-25.6-75.6-25.6l10.4-44s26.8 20.4 48.4 18.8c14-.8 19.2-12.4 18.8-20.4-2-33.6-57.2-31.6-60.8-86.9-3.2-46.4 27.2-93.3 94.5-97.7 26-1.6 39.2 4.8 39.2 4.8l-15.2 57.6s-17.2-8-37.6-6.4c-29.6 2-30 20.8-29.6 25.6zM249.6 82.9c0-12-1.6-29.2-7.2-43.6 18.4 3.6 27.2 24 31.2 36.4-7.2 2-15.2 4.4-24 7.2z"/></svg>`,
    },
    {
      key: 'profile', label: 'Hồ sơ', href: null,
      svg: `<svg class="vt-bn-fill" viewBox="0 0 512 512"><path d="M399 384.2C376.9 345.8 335.4 320 288 320l-64 0c-47.4 0-88.9 25.8-111 64.2 35.2 39.2 86.2 63.8 143 63.8s107.8-24.7 143-63.8zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zm256 16a72 72 0 1 0 0-144 72 72 0 1 0 0 144z"/></svg>`,
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
          <a href="${resolveHref('app/shop.html')}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(34,197,94,0.25);background:rgba(34,197,94,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:72px;height:72px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:#bbf7d0;box-shadow:0 2px 8px rgba(0,0,0,0.12)"><img src="https://img.icons8.com/?size=100&id=Ypj9RsvB5YHH&format=png&color=000000" width="44" height="44" alt="Shop" style="object-fit:contain"></div>
            <span style="font-family:'Science Gothic', sans-serif;font-size:13px;font-weight:500;color:#e0f2fe">Shop</span>
            <span style="font-family:'Science Gothic', sans-serif;font-size:11px;color:#4a7a9b;text-align:center">Gacha · Mua vật phẩm</span>
          </a>
          <a href="${resolveHref('app/bag.html')}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(239,68,68,0.20);background:rgba(239,68,68,0.06);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:72px;height:72px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:#fecaca;box-shadow:0 2px 8px rgba(0,0,0,0.12)"><img src="https://img.icons8.com/?size=100&id=BwkSLLBADf4F&format=png&color=000000" width="44" height="44" alt="Túi đồ" style="object-fit:contain"></div>
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
          <a href="${resolveHref('app/applications.html')}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(251,146,60,0.25);background:rgba(251,146,60,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:72px;height:72px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:#fed7aa;box-shadow:0 2px 8px rgba(0,0,0,0.12)"><img width="44" height="44" src="https://img.icons8.com/?size=100&id=aofWp8x2uWHs&format=png&color=000000" alt="Ứng dụng" style="object-fit:contain"/></div>
            <span style="font-family:'Science Gothic', sans-serif;font-size:13px;font-weight:500;color:#e0f2fe">Ứng dụng</span>
            <span style="font-family:'Science Gothic', sans-serif;font-size:11px;color:#4a7a9b;text-align:center">Offline · Không cần login</span>
          </a>
          <a href="${resolveHref('games.html')}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px 12px;border-radius:16px;text-decoration:none;border:1px solid rgba(6,182,212,0.25);background:rgba(6,182,212,0.07);cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:72px;height:72px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:#a5f3fc;box-shadow:0 2px 8px rgba(0,0,0,0.12)"><img width="44" height="44" src="https://img.icons8.com/?size=100&id=cdTzm4ndoVu4&format=png&color=000000" alt="Game" style="object-fit:contain"/></div>
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
            <a href="${resolveHref('app/profile.html')}" style="font-size:12px;font-weight:400;color:#0288D1;text-decoration:none;font-family:'Science Gothic', sans-serif">Xem đầy đủ →</a>
          </div>
          <a href="${resolveHref('app/profile.html')}" id="vtPpProfileCard" style="display:flex;align-items:center;gap:14px;margin:0 14px 14px;padding:14px 16px;background:rgba(2,136,209,0.07);border:1px solid rgba(2,136,209,0.18);border-radius:16px;text-decoration:none;cursor:pointer">
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

  // -- helpers ------------------------------------------------------------
  function _backdrop(show) {
    document.getElementById('vtPanelBackdrop').classList.toggle('open', show);
  }
  function _anyOpen() { return _profileOpen || _appsOpen || _shopOpen; }
  // Gỡ 'active' khỏi cả 3 tab toggle (apps/shop/profile) trước khi bật 1 tab --
  // tránh trường hợp tab của trang hiện tại (vd 'shop' trên shop.html) và tab
  // vừa bấm cùng sáng 1 lúc.
  function _clearToggleActive() {
    ['apps', 'shop', 'profile'].forEach(k => document.getElementById(`vt-${k}-tab`)?.classList.remove('active'));
  }

  // -- profile ------------------------------------------------------------
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

  // -- shop ---------------------------------------------------------------
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

  // -- apps ---------------------------------------------------------------
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

  // -- bind ---------------------------------------------------------------
  function bindEvents() {
    document.getElementById('vt-apps-tab')?.addEventListener('click', e => { e.preventDefault(); toggleAppsPanel(); });
    document.getElementById('vt-shop-tab')?.addEventListener('click', e => { e.preventDefault(); toggleShopPanel(); });
    document.getElementById('vt-profile-tab')?.addEventListener('click', e => { e.preventDefault(); togglePanel(); });
    document.getElementById('vtPanelBackdrop')?.addEventListener('click', _closeAll);
  }

  // -- init
  function init(opts = {}) {
    if (document.getElementById('vtBottomNav')) return;
    const activeKey = opts.active || 'home';
    injectStyles();
    document.body.classList.add('has-bottom-nav');
    document.body.insertAdjacentHTML('beforeend', buildHTML(activeKey));
    bindEvents();
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
