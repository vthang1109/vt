/**
 * admin-toggle.js — VTWorld Admin Testing Tool
 * 
 * Chỉ hiện với tài khoản thang@game.com
 * Floating button → popup với các công cụ debug:
 *   - Force Win / Force Lose / Normal
 *   - Points: +10k, -10k, set tuỳ ý, reset 10000
 *   - Game Hacks: các công cụ đặc thù cho từng game
 *   - Debug: Log state, Refund, Auto-play
 * 
 * Globals:
 *   window.__ADMIN_FORCED_RESULT = null | 'win' | 'lose'
 *   window.__ADMIN_GAME_HACKS = []  — game đăng ký hack qua array này
 */

// Registry cho game-specific hacks
// Mỗi phần tử: { id, label, icon, render(container) }
window.__ADMIN_GAME_HACKS = [];

(function() {
  'use strict';

  const ADMIN_EMAIL = 'thang@game.com';
  let _isAdmin = false;
  let _popupOpen = false;
  let _autoPlayInterval = null;
  let _pointsModule = null;

  // ========== DOM ==========
  let btn, badge, popup, debugToast;

  function _initUI() {
    // Style (có thể inject vào head ngay lúc này)
    const style = document.createElement('style');
    style.textContent = `
    .vt-admin-btn {
      position: fixed; bottom: calc(84px + env(safe-area-inset-bottom, 0px)); left: 14px;
      width: 44px; height: 44px; border-radius: 50%;
      border: 1px solid rgba(251, 191, 36, 0.3);
      background: rgba(20, 10, 4, 0.92); color: #fbbf24;
      font-size: 18px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 999999; backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: all 0.25s;
      box-shadow: 0 2px 12px rgba(0,0,0,0.4); line-height: 1;
      opacity: 0; transform: scale(0.8); pointer-events: none;
    }
    .vt-admin-btn.visible { opacity: 1; transform: scale(1); pointer-events: auto; }
    .vt-admin-btn:hover { border-color: rgba(251, 191, 36, 0.6); background: rgba(251, 191, 36, 0.15); transform: scale(1.1); }
    .vt-admin-btn.force-win { border-color: rgba(52, 211, 153, 0.6); color: #34d399; }
    .vt-admin-btn.force-lose { border-color: rgba(248, 113, 113, 0.6); color: #f87171; }
    .vt-admin-btn.auto-mode { border-color: rgba(167, 139, 250, 0.6); color: #a78bfa; }

    .vt-admin-popup {
      position: fixed; bottom: calc(140px + env(safe-area-inset-bottom, 0px)); left: 14px;
      z-index: 999999;
      background: rgba(8, 13, 28, 0.98);
      border: 1px solid rgba(251, 191, 36, 0.2);
      border-radius: 14px; min-width: 200px;
      padding: 6px 0; max-height: 70vh; overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      transform: translateY(-6px) scale(0.97); opacity: 0;
      pointer-events: none;
      transition: transform 0.18s ease, opacity 0.18s ease;
    }
    .vt-admin-popup.open { transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }

    .vt-admin-section {
      padding: 6px 16px 4px;
      font-size: 10px; color: #64748b;
      font-weight: 700; letter-spacing: 0.8px;
      font-family: "Science Gothic", sans-serif;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      margin: 0 0 2px;
    }

    .vt-admin-row {
      display: flex; gap: 4px; padding: 4px 12px;
      flex-wrap: wrap;
    }
    .vt-admin-row .vt-btn {
      padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04); color: #94a3b8;
      font-size: 11px; font-family: "Science Gothic", sans-serif;
      cursor: pointer; transition: all 0.15s; font-weight: 600;
      flex: 1; min-width: 48px; text-align: center;
    }
    .vt-admin-row .vt-btn:hover { background: rgba(255,255,255,0.08); color: #e0f2fe; border-color: rgba(255,255,255,0.15); }
    .vt-admin-row .vt-btn:active { transform: scale(0.95); }
    .vt-admin-row .vt-btn.green { border-color: rgba(52,211,153,0.3); color: #34d399; }
    .vt-admin-row .vt-btn.green:hover { background: rgba(52,211,153,0.1); }
    .vt-admin-row .vt-btn.red { border-color: rgba(248,113,113,0.3); color: #f87171; }
    .vt-admin-row .vt-btn.red:hover { background: rgba(248,113,113,0.1); }
    .vt-admin-row .vt-btn.purple { border-color: rgba(167,139,250,0.3); color: #a78bfa; }
    .vt-admin-row .vt-btn.purple:hover { background: rgba(167,139,250,0.1); }
    .vt-admin-row .vt-btn.yellow { border-color: rgba(251,191,36,0.3); color: #fbbf24; }
    .vt-admin-row .vt-btn.yellow:hover { background: rgba(251,191,36,0.1); }
    .vt-admin-row .vt-btn.active-opt {
      background: rgba(52,211,153,0.12); border-color: #34d399; color: #34d399;
    }
    .vt-admin-row .vt-btn.active-opt.lose-opt {
      background: rgba(248,113,113,0.12); border-color: #f87171; color: #f87171;
    }
    .vt-admin-row .vt-btn.active-opt.normal-opt {
      background: rgba(148,163,184,0.12); border-color: #94a3b8; color: #94a3b8;
    }
    .vt-admin-row .vt-btn.active-auto {
      background: rgba(167,139,250,0.15); border-color: #a78bfa; color: #a78bfa;
    }

    .vt-admin-badge {
      position: absolute; top: -4px; right: -4px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #fbbf24; font-size: 8px;
      display: none; align-items: center; justify-content: center;
      color: #000; font-weight: 700;
    }
    .vt-admin-badge.show { display: flex; }

    /* Debug overlay */
    .vt-debug-toast {
      position: fixed; top: 60px; left: 14px; right: 14px;
      z-index: 9999; max-width: 380px;
      padding: 12px 16px; border-radius: 12px;
      background: rgba(8, 13, 28, 0.97);
      border: 1px solid rgba(167, 139, 250, 0.3);
      color: #e0f2fe; font-size: 12px;
      font-family: monospace; line-height: 1.5;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      pointer-events: none; white-space: pre-wrap;
      opacity: 0; transition: opacity 0.3s;
    }
    .vt-debug-toast.show { opacity: 1; }
  `;
    document.head.appendChild(style);

    btn = document.createElement('button');
    btn.className = 'vt-admin-btn';
    btn.id = 'vt-admin-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>';
    btn.title = 'Admin Test Tools';
    btn.setAttribute('aria-label', 'Admin test tools');
    document.body.appendChild(btn);

    badge = document.createElement('div');
    badge.className = 'vt-admin-badge';
    badge.id = 'vt-admin-badge';
    btn.appendChild(badge);

    popup = document.createElement('div');
    popup.className = 'vt-admin-popup';
    popup.id = 'vt-admin-popup';
    popup.innerHTML = `
    <div class="vt-admin-section" style="color:#fbbf24;letter-spacing:0;font-size:11px">⚙️ TEST TOOLS</div>

    <div class="vt-admin-section">KẾT QUẢ</div>
    <div class="vt-admin-row" id="vtForceRow">
      <button class="vt-btn yellow active-opt normal-opt" data-force="normal">Normal</button>
      <button class="vt-btn green" data-force="win">🔥 Win</button>
      <button class="vt-btn red" data-force="lose">💀 Lose</button>
    </div>

    <div class="vt-admin-section">🔚 KẾT THÚC VÁN</div>
    <div class="vt-admin-row">
      <button class="vt-btn green" id="vtEndWin">🔥 Thắng ngay</button>
      <button class="vt-btn red" id="vtEndLose">💀 Thua ngay</button>
    </div>

    <div class="vt-admin-section" id="vtGameHacksSection" style="display:none">🎮 GAME HACKS</div>
    <div class="vt-admin-row" id="vtGameHacksRow" style="display:none"></div>

    <div class="vt-admin-section">ĐIỂM</div>
    <div class="vt-admin-row">
      <button class="vt-btn green" id="vtAdd10k">+10k〄</button>
      <button class="vt-btn red" id="vtSub10k">-10k〄</button>
      <button class="vt-btn yellow" id="vtSetPts">Set</button>
      <button class="vt-btn purple" id="vtResetPts">Reset</button>
    </div>

    <div class="vt-admin-section">DEBUG</div>
    <div class="vt-admin-row">
      <button class="vt-btn purple" id="vtLogState">📝 Log</button>
      <button class="vt-btn yellow" id="vtRefund">↩️ Refund</button>
      <button class="vt-btn" id="vtAutoPlay">🤖 Auto</button>
    </div>
  `;
    document.body.appendChild(popup);

    debugToast = document.createElement('div');
    debugToast.className = 'vt-debug-toast';
    debugToast.id = 'vt-debug-toast';
    document.body.appendChild(debugToast);
  }

  function showDebugToast(msg, duration = 4000) {
    debugToast.textContent = msg;
    debugToast.classList.add('show');
    clearTimeout(debugToast._timer);
    debugToast._timer = setTimeout(() => debugToast.classList.remove('show'), duration);
  }

  // ========== State ==========
  let _currentForce = 'normal';
  window.__ADMIN_FORCED_RESULT = null;

  function setForce(mode) {
    _currentForce = mode;
    popup.querySelectorAll('#vtForceRow .vt-btn').forEach(el => {
      el.classList.remove('active-opt', 'lose-opt', 'normal-opt');
    });
    const opt = popup.querySelector(`[data-force="${mode}"]`);
    if (opt) {
      opt.classList.add('active-opt');
      if (mode === 'lose') opt.classList.add('lose-opt');
      if (mode === 'normal') opt.classList.add('normal-opt');
    }

    btn.className = 'vt-admin-btn visible';
    if (mode === 'win') {
      btn.classList.add('force-win'); btn.classList.remove('force-lose', 'auto-mode');
      badge.textContent = 'W'; badge.className = 'vt-admin-badge show';
      window.__ADMIN_FORCED_RESULT = 'win';
    } else if (mode === 'lose') {
      btn.classList.add('force-lose'); btn.classList.remove('force-win', 'auto-mode');
      badge.textContent = 'L'; badge.className = 'vt-admin-badge show';
      window.__ADMIN_FORCED_RESULT = 'lose';
    } else {
      btn.classList.remove('force-win', 'force-lose', 'auto-mode');
      badge.className = 'vt-admin-badge';
      window.__ADMIN_FORCED_RESULT = null;
    }
    updateAutoBtn();
  }

  // ========== Points ==========
  async function ensurePoints() {
    if (_pointsModule) return _pointsModule;
    try {
      _pointsModule = await import('../../points.js');
      return _pointsModule;
    } catch (e) {
      showDebugToast('❌ Không thể import points.js: ' + e.message, 3000);
      return null;
    }
  }

  async function addAdminPoints(amount, reason = 'Admin test') {
    const pts = await ensurePoints();
    if (!pts) return;
    try {
      await pts.addPoints('Admin', reason, amount, false);
      showDebugToast(`✅ ${amount > 0 ? '+' : ''}${amount.toLocaleString('vi-VN')}〄`, 2000);
    } catch (e) {
      showDebugToast('❌ Lỗi: ' + e.message, 3000);
    }
  }

  async function setPoints(target) {
    const pts = await ensurePoints();
    if (!pts) return;
    try {
      const user = pts.auth.currentUser;
      if (!user) { showDebugToast('❌ Chưa đăng nhập', 3000); return; }
      const userRef = pts.doc(pts.db, 'users', user.uid);
      await pts.setDoc(userRef, { points: target }, { merge: true });
      showDebugToast(`✅ Set điểm → ${target.toLocaleString('vi-VN')}〄`, 2000);
    } catch (e) {
      showDebugToast('❌ Lỗi: ' + e.message, 3000);
    }
  }

  // ========== Log State ==========
  function logState() {
    const state = {};
    // Detect game
    const game = window.game || window.txGame || window.bcGame;
    if (game) {
      // Baicao / Poker / Taixiu / Baucua
      state.balance = game.balance || game._myBalance || '?';
      state.phase = game.phase || '?';
      if (game.bets) state.bets = game.bets;
      if (game.currentBet) state.currentBet = game.currentBet;
      if (game.betSettled !== undefined) state.betSettled = game.betSettled;
      if (game.constructor) state.gameType = game.constructor.name;
    }
    state.__ADMIN_FORCED_RESULT = window.__ADMIN_FORCED_RESULT;
    state.user = window.auth?.currentUser?.email || '?';
    console.log('[ADMIN DEBUG]', state);
    showDebugToast(JSON.stringify(state, null, 2), 5000);
  }

  // ========== Refund ==========
  async function doRefund() {
    const game = window.game || window.txGame || window.bcGame;
    if (!game) { showDebugToast('❌ Không tìm thấy game instance', 3000); return; }

    // Detect game by constructor name for refund
    const gameName = game.constructor?.name;

    // Taixiu has resetBoard()
    if (gameName === 'TaiXiu' && game.resetBoard) {
      game.resetBoard();
      showDebugToast('✅ Đã hoàn cược Tài Xỉu', 2000);
      return;
    }

    // Baucua has resetBoard() too
    if (gameName === 'BauCua' && game.resetBoard) {
      game.resetBoard();
      showDebugToast('✅ Đã hoàn cược Bầu Cua', 2000);
      return;
    }

    // Baicao / Poker
    const pts = await ensurePoints();
    if (!pts) return;

    let refunded = 0;

    // Baicao
    if (window.game && window.game.constructor && window.game.constructor.name === 'BaiCao') {
      const g = window.game;
      if (g.currentBet > 0 && !g.betSettled) {
        refunded = g.currentBet;
        g.betSettled = true;
        g.phase = 'betting';
        g.currentBet = 0;
        try { await pts.addPoints('Admin', 'Refund - Bài Cào', refunded, false); } catch {}
      }
    }

    // Poker
    if (window.game && window.game.constructor && window.game.constructor.name === 'Poker') {
      const g = window.game;
      refunded = (g.currentBet || 0) + (g.pot || 0);
      g.betSettled = true;
      g.phase = 'betting';
      g.pot = 0;
      g.currentBet = 0;
      if (refunded > 0) {
        try { await pts.addPoints('Admin', 'Refund - Poker', refunded, false); } catch {}
      }
    }

    if (refunded > 0) {
      showDebugToast(`✅ Đã hoàn ${refunded.toLocaleString('vi-VN')}〄`, 2000);
    } else {
      showDebugToast('ℹ️ Không có cược nào để hoàn', 2000);
    }
  }

  // ========== Auto-play ==========
  function isAutoPlaying() { return _autoPlayInterval !== null; }

  function updateAutoBtn() {
    const autoBtn = document.getElementById('vtAutoPlay');
    if (!autoBtn) return;
    if (isAutoPlaying()) {
      autoBtn.classList.add('active-auto');
      autoBtn.textContent = '⏹ Stop';
      btn.classList.add('auto-mode');
    } else {
      autoBtn.classList.remove('active-auto');
      autoBtn.textContent = '🤖 Auto';
      btn.classList.remove('auto-mode');
      // restore force badge
      if (_currentForce !== 'normal') {
        badge.className = 'vt-admin-badge show';
        badge.textContent = _currentForce === 'win' ? 'W' : 'L';
      } else {
        badge.className = 'vt-admin-badge';
      }
    }
  }

  function toggleAutoPlay() {
    if (isAutoPlaying()) {
      clearInterval(_autoPlayInterval);
      _autoPlayInterval = null;
      showDebugToast('⏹ Auto-play stopped', 1500);
      updateAutoBtn();
      return;
    }

    const game = window.game || window.txGame || window.bcGame;
    if (!game) { showDebugToast('❌ No game instance found', 3000); return; }

    const isBcGame = !!window.bcGame;
    const isTxGame = !!window.txGame;
    const isBaicao = window.game && window.game.constructor && window.game.constructor.name === 'BaiCao';
    const isPoker = window.game && window.game.constructor && window.game.constructor.name === 'Poker';

    showDebugToast('▶️ Auto-play started!', 1500);
    updateAutoBtn();

    _autoPlayInterval = setInterval(async () => {
      // === BẦU CUA ===
      if (isBcGame) {
        const bc = window.bcGame;
        if (!bc) return;
        if (bc._isResultShowing) {
          // Ván mới
          const rollBtn = document.getElementById('btn-roll');
          if (rollBtn && rollBtn.textContent.includes('Ván mới')) rollBtn.click();
          return;
        }
        if (bc.isRolling) return;
        // Place a small bet on first item if no bets
        const totalBet = Object.values(bc.bets).reduce((a,b) => a+b, 0);
        if (totalBet === 0) {
          bc.currentChip = 100;
          bc.placeBet(bc.items[0].id);
        }
        const rollBtn = document.getElementById('btn-roll');
        if (rollBtn && !rollBtn.disabled && totalBet > 0) rollBtn.click();
        return;
      }

      // === TÀI XỈU ===
      if (isTxGame) {
        const tx = window.txGame;
        if (!tx || tx.isRolling) return;
        const totalBet = Object.values(tx.bets).reduce((a,b) => a+b, 0);
        if (totalBet === 0) {
          tx.currentChip = 100;
          tx.placeBet('tai');
        } else {
          const bowl = document.getElementById('bowl');
          if (bowl && !bowl.classList.contains('disabled')) bowl.click();
        }
        return;
      }

      // === BÀI CÀO ===
      if (isBaicao) {
        const bc = window.game;
        if (!bc) return;
        const menu = document.getElementById('bc-menu');
        const menuActive = menu && menu.classList.contains('active');
        
        if (menuActive && bc.phase === 'betting') {
          // Menu screen active, click play to start game
          const playBtn = document.getElementById('bc-play-btn');
          if (playBtn) playBtn.click();
        } else if (bc.phase === 'betting' || bc.phase === 'result') {
          // Game screen active, place bet
          document.getElementById('btn-place-bet')?.click();
        } else if (bc.phase === 'playing') {
          const flipBtn = document.getElementById('btn-flip');
          if (flipBtn && !flipBtn.disabled) flipBtn.click();
        }
        return;
      }

      // === POKER ===
      if (isPoker) {
        const pk = window.game;
        if (!pk) return;
        if (pk.phase === 'betting') {
          const playBtn = document.getElementById('pk-play-btn');
          if (!playBtn || playBtn.closest('#pk-menu')?.classList.contains('active') === false) {
            // Already in game, auto place bet
            document.getElementById('btn-place-bet')?.click();
          }
          return;
        }
        if (pk.phase === 'playing') {
          const callBtn = document.getElementById('pk-call');
          if (callBtn && callBtn.closest('#pk-actions')?.style.display !== 'none') callBtn.click();
          else if (pk.stage === 'preflop' || pk.stage === 'flop' || pk.stage === 'turn') {
            // Wait for AI decision
          }
        }
        return;
      }

      showDebugToast('⚠️ Auto-play chưa hỗ trợ game này', 2000);
      toggleAutoPlay();
    }, 2000);
  }

  // ========== Instant End Round ==========
  async function instantEndRound(forcedResult) {
    window.__ADMIN_FORCED_RESULT = forcedResult;

    // === PENALTY (đơn + MP) — penalty chỉ set window.penaltyGame, KHÔNG set
    // window.game nên phải xử lý TRƯỚC khi lookup game generic bên dưới. ===
    if (window.penaltyGame) {
      const pg = window.penaltyGame;
      const isMp = pg.constructor?.name === 'PenaltyMP';
      // MP: phase đọc từ Firestore snapshot (_gs); đơn: đọc từ state.phase
      const phase = isMp ? (pg._gs && pg._gs.phase) : pg.state.phase;
      const inMatch = phase && phase !== 'finished' && phase !== 'idle' && phase !== 'setup' && phase !== 'tournament';
      if (inMatch) {
        if (isMp && typeof pg.adminForceEnd === 'function') {
          // Ghi kết quả ép lên Firestore để CẢ 2 client cùng thấy màn kết thúc,
          // rồi host bấm "Hoàn thành" để giải đấu tiếp tục.
          try {
            const ok = await pg.adminForceEnd(forcedResult);
            showDebugToast(ok ? '✅ Penalty MP: ' + (forcedResult === 'win' ? 'THẮNG' : 'THUA') : '❌ Penalty MP: không ép được kết quả', 1500);
          } catch (e) {
            showDebugToast('❌ Penalty MP: lỗi ép kết quả — ' + e.message, 2500);
          }
          return;
        }
        // Đơn: endMatch() của PenaltyGame tự đọc __ADMIN_FORCED_RESULT (5-0 / 0-5)
        pg.endMatch();
        showDebugToast('✅ Penalty: ' + (forcedResult === 'win' ? 'THẮNG' : 'THUA'), 1500);
        return;
      }
      showDebugToast('⚠️ Penalty chưa có trận đang đá', 2000);
      return;
    }

    const game = window.game || window.txGame || window.bcGame;
    if (!game) { showDebugToast('❌ Không tìm thấy game instance', 2000); return; }

    const name = game.constructor?.name;

    // === BÀI CÀO ===
    if (name === 'BaiCao') {
      if (game.phase === 'playing') {
        game.player.revealed = [true, true, true];
        game.dealer.revealed = [true, true, true];
        game.canFlip = false;
        let fb = document.getElementById('btn-flip');
        if (fb) fb.style.display = 'none';
        await game.endRound();
        showDebugToast('✅ Bài Cào: ' + (forcedResult === 'win' ? 'THẮNG' : 'THUA'), 1500);
        return;
      }
      showDebugToast('⚠️ Bài Cào chưa có ván đang chơi', 2000);
      return;
    }

    // === POKER ===
    if (name === 'Poker') {
      if (game.phase === 'playing') {
        let ac = document.getElementById('pk-actions');
        if (ac) ac.style.display = 'none';
        while (game.stage !== 'river' && game.community.length < 5) {
          if (game.stage === 'preflop') {
            for (let i = 0; i < 3; i++) game.community.push(game.deck.pop());
            game.stage = 'flop';
          } else if (game.stage === 'flop') {
            game.community.push(game.deck.pop());
            game.stage = 'turn';
          } else if (game.stage === 'turn') {
            game.community.push(game.deck.pop());
            game.stage = 'river';
          }
        }
        game.renderCommunity();
        await game.delay(100);
        await game.showdown();
        showDebugToast('✅ Poker: ' + (forcedResult === 'win' ? 'THẮNG' : 'THUA'), 1500);
        return;
      }
      showDebugToast('⚠️ Poker chưa có ván đang chơi', 2000);
      return;
    }

    // === BẦU CUA ===
    if (name === 'BauCua') {
      if (game._isResultShowing) {
        showDebugToast('⚠️ Ván Bầu Cua đã xong, bấm Ván mới trước', 2000);
        return;
      }
      let totalBet = Object.values(game.bets).reduce(function(a,b){return a+b}, 0);
      if (totalBet === 0) {
        showDebugToast('⚠️ Chưa đặt cược Bầu Cua', 2000);
        return;
      }
      if (game.isRolling) return;
      await game.finishRoll();
      showDebugToast('✅ Bầu Cua: ' + (forcedResult === 'win' ? 'THẮNG' : 'THUA'), 1500);
      return;
    }

    // === TÀI XỈU ===
    if (name === 'TaiXiu') {
      if (game.isRolling) return;
      let totalBet2 = Object.values(game.bets).reduce(function(a,b){return a+b}, 0);
      if (totalBet2 === 0) {
        showDebugToast('⚠️ Chưa đặt cược Tài Xỉu', 2000);
        return;
      }
      await game.finishRoll();
      showDebugToast('✅ Tài Xỉu: ' + (forcedResult === 'win' ? 'THẮNG' : 'THUA'), 1500);
      return;
    }

    // === XÌ DÁCH (player mode) ===
    if (name === 'XiDach') {
      if (game.phase === 'playing' || game.phase === 'dealer') {
        if (game.mode !== 'dealer') {
          const dStat = game.getHandStatus(game.dealer.hand);
          const pStat = game.getHandStatus(game.players[0].hand);
          let { res, delta } = game.resolveOne(pStat, dStat, game.currentBet);
          if (forcedResult === 'win') { res = 'THẮNG'; delta = game.currentBet * 2; }
          else { res = 'THUA'; delta = 0; }
          game.players[0].result = res;
          game.phase = 'result';
          game.isBusy = false;
          await game.settlePoints(delta);
          game.render(true);
          game.updateStatusBar(res, delta - game.currentBet, `Điểm: ${pStat.score}`);
          document.getElementById('xd-bet-row').style.display = 'flex';
          showDebugToast('✅ Xì Dách: ' + (forcedResult === 'win' ? 'THẮNG' : 'THUA'), 1500);
          return;
        }
      }
      showDebugToast('⚠️ Xì Dách chưa có ván đang chơi', 2000);
      return;
    }

    // === TIM SO ===
    if (name === 'TimSo') {
      showDebugToast('⚠️ Tìm Số chưa hỗ trợ kết thúc ván ngay', 2000);
      return;
    }

    showDebugToast('⚠️ Game này chưa hỗ trợ kết thúc ván ngay', 2000);
  }

  // ========== Events ==========
  function _initEvents() {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _popupOpen = !_popupOpen;
      popup.classList.toggle('open', _popupOpen);
    });

    // Force options
    popup.querySelectorAll('#vtForceRow .vt-btn').forEach(opt => {
      opt.addEventListener('click', () => {
        setForce(opt.dataset.force);
        _popupOpen = false;
        popup.classList.remove('open');
      });
    });

    // End Round Now
    document.getElementById('vtEndWin').addEventListener('click', async () => {
      await instantEndRound('win');
      _popupOpen = false; popup.classList.remove('open');
    });
    document.getElementById('vtEndLose').addEventListener('click', async () => {
      await instantEndRound('lose');
      _popupOpen = false; popup.classList.remove('open');
    });

    // Points
    document.getElementById('vtAdd10k').addEventListener('click', () => addAdminPoints(10000, 'Admin +10k'));
    document.getElementById('vtSub10k').addEventListener('click', () => addAdminPoints(-10000, 'Admin -10k'));

    document.getElementById('vtSetPts').addEventListener('click', async () => {
      const input = prompt('Nhập số điểm muốn set:', '100000');
      if (input === null) return;
      const val = parseInt(input);
      if (isNaN(val) || val < 0) { showDebugToast('❌ Số không hợp lệ', 2000); return; }
      await setPoints(val);
      _popupOpen = false; popup.classList.remove('open');
    });

    document.getElementById('vtResetPts').addEventListener('click', async () => {
      if (!confirm('Reset điểm về 10000?')) return;
      await setPoints(10000);
      _popupOpen = false; popup.classList.remove('open');
    });

    // Debug
    document.getElementById('vtLogState').addEventListener('click', () => {
      logState();
      _popupOpen = false; popup.classList.remove('open');
    });

    document.getElementById('vtRefund').addEventListener('click', () => {
      doRefund();
      _popupOpen = false; popup.classList.remove('open');
    });

    document.getElementById('vtAutoPlay').addEventListener('click', () => {
      toggleAutoPlay();
      _popupOpen = false; popup.classList.remove('open');
    });

    // Close popup on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.vt-admin-btn') && !e.target.closest('.vt-admin-popup')) {
        _popupOpen = false;
        popup.classList.remove('open');
      }
    });
  }

  // ========== Auth check ==========
  // Áp dụng trạng thái admin từ bất kỳ nguồn auth nào (dynamic import hoặc hook
  // game tự đẩy) — tách riêng để cả 2 con đường dùng chung 1 logic.
  function applyAdminState(user) {
    if (user && user.email === ADMIN_EMAIL) {
      _isAdmin = true;
      if (btn) btn.classList.add('visible');
      if (btn && popup) setForce(_currentForce);
      // expose auth for debug
      updateGameHacks();
      registerMpAdminHack();
    } else {
      _isAdmin = false;
      if (btn) btn.classList.remove('visible');
      if (btn) btn.classList.remove('force-win', 'force-lose', 'auto-mode');
      if (badge) badge.className = 'vt-admin-badge';
      window.__ADMIN_FORCED_RESULT = null;
      window.auth = null;
      if (isAutoPlaying()) toggleAutoPlay();
    }
  }

  // Hook cho game (penalty.js / penalty-mp.js) tự đẩy user vào — chắc chắn chạy
  // trên mobile vì game vốn đã có onAuthStateChanged riêng (không phụ thuộc dynamic
  // import của admin-toggle, vốn dễ fail/block trên mạng mobile).
  window.__VT_ADMIN_ONAUTH__ = applyAdminState;

  function checkAdmin() {
    import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js').then(({ onAuthStateChanged }) => {
      import('../../points.js').then(({ auth }) => {
        window.auth = auth;
        onAuthStateChanged(auth, applyAdminState);
      });
    }).catch(e => {
      console.warn('Admin toggle: Auth not available', e);
    });
  }

  // ========== Game Hacks ==========
  function showGameHackModal(hack) {
    const existing = document.getElementById('vtHackModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'vtHackModal';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;
      padding:16px;animation:fadeIn 0.15s ease;
    `;
    const box = document.createElement('div');
    box.style.cssText = `
      background:linear-gradient(145deg,#1a2744,#0f172a);
      border:1px solid rgba(167,139,250,0.25);
      border-radius:20px;padding:20px;
      max-width:460px;width:100%;max-height:80vh;overflow-y:auto;
      box-shadow:0 20px 60px rgba(0,0,0,0.6);
    `;
    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:14px;font-weight:700;color:#e0f2fe;">${hack.icon || '🎮'} ${hack.label}</span>
        <button id="vtHackClose" style="background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;padding:4px;">✕</button>
      </div>
      <div id="vtHackBody"></div>
    `;
    modal.appendChild(box);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    document.getElementById('vtHackClose').addEventListener('click', () => modal.remove());

    if (hack.render) {
      hack.render(document.getElementById('vtHackBody'), () => modal.remove());
    }
  }

  function updateGameHacks() {
    const section = document.getElementById('vtGameHacksSection');
    const row = document.getElementById('vtGameHacksRow');
    if (!section || !row) return;

    const hacks = window.__ADMIN_GAME_HACKS || [];
    if (hacks.length === 0) {
      section.style.display = 'none';
      row.style.display = 'none';
      return;
    }

    section.style.display = '';
    row.style.display = '';
    row.innerHTML = hacks.map(h => `
      <button class="vt-btn purple" data-hack-id="${h.id}" style="flex:1;min-width:60px">
        ${h.icon || '⚡'} ${h.label}
      </button>
    `).join('');

    row.querySelectorAll('[data-hack-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const hack = hacks.find(h => h.id === btn.dataset.hackId);
        if (hack) {
          _popupOpen = false;
          popup.classList.remove('open');
          setTimeout(() => showGameHackModal(hack), 200);
        }
      });
    });
  }

  // Watch for new hacks registered after page load
  const _origPush = window.__ADMIN_GAME_HACKS.push;
  window.__ADMIN_GAME_HACKS.push = function(...items) {
    const result = _origPush.apply(this, items);
    if (_isAdmin) updateGameHacks();
    return result;
  };

  // ========== Cleanup on navigate ==========
  window.addEventListener('pagehide', () => {
    if (isAutoPlaying()) {
      clearInterval(_autoPlayInterval);
      _autoPlayInterval = null;
    }
  });
  window.addEventListener('beforeunload', () => {
    if (isAutoPlaying()) {
      clearInterval(_autoPlayInterval);
      _autoPlayInterval = null;
    }
  });

  // ── MP CARD PICKER HACK (chỉ cho xidach) ──────────────
  // Chỉ hiển thị với game xidach MP
  // Kết nối tới cùng Firestore instance của game (points.js) để tránh conflict
  let _mpHackRegistered = false;
  function registerMpAdminHack() {
    // Guard idempotent — applyAdminState có thể chạy 2 lần (hook game + dynamic
    // import đều fire) → tránh push hack 'mp_admin' trùng lặp.
    if (_mpHackRegistered) return;
    _mpHackRegistered = true;
    const roomId = (typeof ROOM_ID !== 'undefined' && ROOM_ID)
      || new URLSearchParams(window.location.search).get('room');
    if (!roomId) return;

    let _mpFs = null;
    let _mpDb = null;
    let _mpRoomRef = null;
    let _mpMyUid = null;

    async function ensureMpDb() {
      if (_mpDb && _mpRoomRef) return;
      try {
        if (!_mpFs) {
          _mpFs = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        }
        // Dùng window.auth (set bởi admin toggle) và points.js db (cùng Firebase project)
        const points = await import('../../points.js');
        _mpDb = points.db;
        _mpRoomRef = _mpFs.doc(_mpDb, 'rooms', roomId);
      } catch (e) {
        console.warn('MP hack: cannot get db', e);
      }
    }

    // Kiểm tra game type trước khi đăng ký hack
    (async () => {
      await ensureMpDb();
      if (!_mpRoomRef) return;
      try {
        const snap = await _mpFs.getDoc(_mpRoomRef);
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.gameType !== 'xidach') return;

        window.__ADMIN_GAME_HACKS.push({
          id: 'mp_admin',
          label: 'Chọn Bài',
          icon: '🃏',
          render: (container, closeModal) => {
            container.innerHTML = `
              <p style="color:#94a3b8;font-size:12px;margin-bottom:8px;">Phòng: <b style="color:#e0f2fe">#${roomId}</b></p>
              <div id="mpPhaseInfo" style="color:#64748b;font-size:10px;margin-bottom:6px;min-height:14px;"></div>
              <div id="mpCardStatus" style="color:#34d399;font-size:12px;font-weight:700;margin-bottom:8px;min-height:18px;"></div>
              <div style="display:flex;gap:6px;margin-bottom:8px;">
                <button id="mpTabInitial" class="vt-btn" data-active="false" style="flex:1;">📋 Bài đầu</button>
                <button id="mpTabHit" class="vt-btn" data-active="true" style="flex:1;border-color:rgba(52,211,153,0.5);color:#34d399;background:rgba(52,211,153,0.1);">🎯 Rút bài</button>
              </div>
              <div id="mpInitialSection" style="margin-bottom:10px;background:rgba(167,139,250,0.06);border-radius:8px;padding:8px;">
                <div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:4px;">📋 Bài đầu ván sau (chọn 2 lá)</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">
                  <span id="mpInitialStatus" style="font-size:9px;color:#fbbf24;flex:1;min-height:14px;"></span>
                  <button id="mpInitialConfirm" class="vt-btn green" style="display:none;padding:3px 8px;font-size:10px;">✅ Xác nhận</button>
                </div>
                <div id="mpInitialCards" style="display:flex;gap:4px;flex-wrap:wrap;min-height:20px;"><span style="color:#64748b;font-size:10px;">Chưa chọn</span></div>
                <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;">
                  <button class="mpQuickBtn" data-combo="19" style="flex:1;padding:4px;border-radius:6px;border:1px solid rgba(52,211,153,0.2);background:rgba(52,211,153,0.06);color:#34d399;font-size:10px;font-weight:700;cursor:pointer;transition:all 0.15s;">19</button>
                  <button class="mpQuickBtn" data-combo="20" style="flex:1;padding:4px;border-radius:6px;border:1px solid rgba(52,211,153,0.2);background:rgba(52,211,153,0.06);color:#34d399;font-size:10px;font-weight:700;cursor:pointer;transition:all 0.15s;">20</button>
                  <button class="mpQuickBtn" data-combo="xidach" style="flex:1;padding:4px;border-radius:6px;border:1px solid rgba(167,139,250,0.2);background:rgba(167,139,250,0.06);color:#a78bfa;font-size:10px;font-weight:700;cursor:pointer;transition:all 0.15s;">🎯 Xì Dách</button>
                  <button class="mpQuickBtn" data-combo="xiban" style="flex:1;padding:4px;border-radius:6px;border:1px solid rgba(251,191,36,0.2);background:rgba(251,191,36,0.06);color:#fbbf24;font-size:10px;font-weight:700;cursor:pointer;transition:all 0.15s;">👑 Xì Bàn</button>
                  <button class="mpQuickBtn" data-combo="clear" style="flex:1;padding:4px;border-radius:6px;border:1px solid rgba(248,113,113,0.2);background:rgba(248,113,113,0.06);color:#f87171;font-size:10px;font-weight:700;cursor:pointer;transition:all 0.15s;">🗑️ Xoá</button>
                </div>
              </div>
              <div id="mpHitSection" style="margin-bottom:10px;display:block;background:rgba(52,211,153,0.06);border-radius:8px;padding:8px;">
                <div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:4px;">🎯 Rút bài (ván hiện tại)</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">
                  <span id="mpHitStatus" style="font-size:9px;color:#34d399;flex:1;min-height:14px;"></span>
                  <button id="mpHitConfirm" class="vt-btn green" style="display:none;padding:3px 8px;font-size:10px;">✅ Xác nhận</button>
                </div>
                <div id="mpHitCards" style="display:flex;gap:4px;flex-wrap:wrap;min-height:20px;"><span style="color:#64748b;font-size:10px;">Chưa chọn</span></div>
              </div>
              <p id="mpGridHint" style="color:#94a3b8;font-size:11px;margin-bottom:8px;">Click lá để thêm rút bài — lá đã dùng ⛔</p>
              <div id="mpCardGrid"></div>
              <div style="margin-top:8px;">
                <button id="mpHackClose" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);background:none;color:#94a3b8;font-size:11px;cursor:pointer;">✕ Đóng</button>
              </div>
            `;

            let activeTab = 'hit'; // mặc định Rút bài
            let myInitialCards = [];
            let pendingInitialCards = [];
            let myHitCards = [];
            let pendingHitCards = [];
            let usedCards = new Set();
            const suits = ['♠', '♣', '♦', '♥'];
            const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

            function getSuitColor(s) {
              return s === '♥' || s === '♦' ? '#f87171' : '#94a3b8';
            }

            function setActiveTab(tab) {
              activeTab = tab;
              const tabInit = document.getElementById('mpTabInitial');
              const tabHit = document.getElementById('mpTabHit');
              const secInit = document.getElementById('mpInitialSection');
              const secHit = document.getElementById('mpHitSection');
              const hint = document.getElementById('mpGridHint');
              if (tab === 'initial') {
                tabInit.style.borderColor = 'rgba(167,139,250,0.5)';
                tabInit.style.color = '#a78bfa';
                tabInit.style.background = 'rgba(167,139,250,0.1)';
                tabHit.style.borderColor = 'rgba(255,255,255,0.08)';
                tabHit.style.color = '#94a3b8';
                tabHit.style.background = 'rgba(255,255,255,0.04)';
                secInit.style.display = '';
                secHit.style.display = 'none';
                hint.textContent = 'Click lá để thêm vào bài đầu — hiện tất cả 52 lá 🃏';
              } else {
                tabHit.style.borderColor = 'rgba(52,211,153,0.5)';
                tabHit.style.color = '#34d399';
                tabHit.style.background = 'rgba(52,211,153,0.1)';
                tabInit.style.borderColor = 'rgba(255,255,255,0.08)';
                tabInit.style.color = '#94a3b8';
                tabInit.style.background = 'rgba(255,255,255,0.04)';
                secHit.style.display = '';
                secInit.style.display = 'none';
                hint.textContent = 'Click lá để thêm vào rút bài — lá đã dùng ⛔';
              }
              renderMpCardGrid();
            }

            document.getElementById('mpTabInitial').addEventListener('click', () => setActiveTab('initial'));
            document.getElementById('mpTabHit').addEventListener('click', () => setActiveTab('hit'));

            // ── Load data from Firestore ──
            async function loadCardData() {
              _mpMyUid = window.auth?.currentUser?.uid;
              if (!_mpMyUid) {
                document.getElementById('mpCardStatus').textContent = '❌ Chưa đăng nhập';
                return;
              }
              await ensureMpDb();
              if (!_mpRoomRef) {
                document.getElementById('mpCardStatus').textContent = '❌ Không kết nối được Firestore';
                return;
              }
              try {
                const snap = await _mpFs.getDoc(_mpRoomRef);
                if (!snap.exists()) {
                  document.getElementById('mpCardStatus').textContent = '❌ Phòng không tồn tại';
                  return;
                }
                const gs = snap.data().gameState || {};
                const phase = gs.phase || 'betting';
                document.getElementById('mpPhaseInfo').textContent = `Phase: ${phase}`;

                const preselected = gs.preselectedCards || {};
                const preselectedHit = gs.preselectedHitCards || {};
                myInitialCards = preselected[_mpMyUid] || [];
                myHitCards = preselectedHit[_mpMyUid] || [];
                pendingHitCards = [];

                // usedCards: các lá đang có trên bàn + đã chọn
                const hands = gs.hands || {};
                const allCards = [
                  ...Object.values(hands).flat(),
                  ...Object.values(preselected).flat(),
                  ...Object.values(preselectedHit).flat()
                ];
                usedCards = new Set(allCards.map(c => c.v + c.s));

                // Cập nhật UI
                renderInitialHand();
                renderHitHand();
                renderMpCardGrid();

                document.getElementById('mpCardStatus').textContent = `✅ Đã tải: ${myInitialCards.length} lá đầu, ${myHitCards.length} lá rút`;
              } catch (e) {
                document.getElementById('mpCardStatus').textContent = '❌ Lỗi tải: ' + e.message;
              }
            }

            // ── UI helpers ──
            function updateInitialConfirmBtn() {
              const btn = document.getElementById('mpInitialConfirm');
              const status = document.getElementById('mpInitialStatus');
              if (!btn || !status) return;
              if (pendingInitialCards.length === 2) {
                btn.style.display = '';
                status.textContent = '📝 2 lá chờ xác nhận';
              } else {
                btn.style.display = 'none';
                status.textContent = myInitialCards.length > 0
                  ? `✅ ${myInitialCards.length} lá đã lưu`
                  : 'Chọn 2 lá rồi Xác nhận';
              }
            }

            function renderInitialHand() {
              const el = document.getElementById('mpInitialCards');
              if (!el) return;
              const cards = pendingInitialCards.length > 0 ? pendingInitialCards : myInitialCards;
              if (!cards || cards.length === 0) {
                el.innerHTML = '<span style="color:#64748b;font-size:10px;">Chưa chọn</span>';
                updateInitialConfirmBtn();
                return;
              }
              const isPending = pendingInitialCards.length > 0;
              el.innerHTML = cards.map((card, idx) => `
                <span class="mp-hand-card" data-idx="${idx}" data-list="initial"
                  style="display:inline-flex;align-items:center;gap:2px;padding:3px 6px;border-radius:6px;
                    background:${isPending ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)'};
                    border:1px solid ${isPending ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'};
                    color:${getSuitColor(card.s)};font-size:13px;font-weight:700;font-family:monospace;
                    cursor:pointer;transition:all 0.15s;line-height:1;"
                  title="Xoá ${card.v}${card.s}">${card.v}${card.s} ✕</span>
              `).join('');
              updateInitialConfirmBtn();
              // Gán sự kiện xoá
              el.querySelectorAll('.mp-hand-card').forEach(cardEl => {
                cardEl.addEventListener('click', async (e) => {
                  const idx = parseInt(cardEl.dataset.idx);
                  if (isNaN(idx)) return;
                  if (pendingInitialCards.length > 0) {
                    if (idx >= pendingInitialCards.length) return;
                    const rm = pendingInitialCards[idx];
                    pendingInitialCards.splice(idx, 1);
                    usedCards.delete(rm.v + rm.s);
                    renderInitialHand();
                    renderMpCardGrid();
                    document.getElementById('mpCardStatus').textContent = '🗑️ Đã xoá ' + rm.v + rm.s;
                    return;
                  }
                  // Xoá khỏi Firestore (arrayRemove — atomic, không cần getDoc trước)
                  try {
                    if (idx >= myInitialCards.length) return;
                    const rm = myInitialCards[idx];
                    const upd = [...myInitialCards]; upd.splice(idx, 1);
                    await _mpFs.updateDoc(_mpRoomRef, { ['gameState.preselectedCards.' + _mpMyUid]: _mpFs.arrayRemove(rm) });
                    myInitialCards = upd;
                    usedCards.delete(rm.v + rm.s);
                    renderInitialHand();
                    renderMpCardGrid();
                    document.getElementById('mpCardStatus').textContent = '🗑️ Đã xoá ' + rm.v + rm.s;
                  } catch (e) {
                    document.getElementById('mpCardStatus').textContent = '❌ Lỗi: ' + e.message;
                  }
                });
              });
            }

            function updateHitConfirmBtn() {
              const btn = document.getElementById('mpHitConfirm');
              const status = document.getElementById('mpHitStatus');
              if (!btn || !status) return;
              if (pendingHitCards.length > 0) {
                btn.style.display = '';
                status.textContent = '📝 ' + pendingHitCards.length + ' lá chờ xác nhận';
              } else {
                btn.style.display = 'none';
                status.textContent = myHitCards.length > 0
                  ? '✅ ' + myHitCards.length + ' lá đã rút'
                  : 'Chọn lá muốn rút rồi Xác nhận';
              }
            }

            function renderHitHand() {
              const el = document.getElementById('mpHitCards');
              if (!el) return;
              const cards = pendingHitCards.length > 0 ? pendingHitCards : myHitCards;
              if (!cards || cards.length === 0) {
                el.innerHTML = '<span style="color:#64748b;font-size:10px;">Chưa chọn</span>';
                updateHitConfirmBtn();
                return;
              }
              const isPending = pendingHitCards.length > 0;
              el.innerHTML = cards.map((card, idx) => `
                <span class="mp-hand-card" data-idx="${idx}" data-list="hit"
                  style="display:inline-flex;align-items:center;gap:2px;padding:3px 6px;border-radius:6px;
                    background:${isPending ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)'};
                    border:1px solid ${isPending ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'};
                    color:${getSuitColor(card.s)};font-size:13px;font-weight:700;font-family:monospace;
                    cursor:pointer;transition:all 0.15s;line-height:1;"
                  title="Xoá ${card.v}${card.s}">${card.v}${card.s} ✕</span>
              `).join('');
              updateHitConfirmBtn();
              // Gán sự kiện xoá
              el.querySelectorAll('.mp-hand-card').forEach(cardEl => {
                cardEl.addEventListener('click', async () => {
                  const idx = parseInt(cardEl.dataset.idx);
                  if (isNaN(idx)) return;
                  if (pendingHitCards.length > 0) {
                    if (idx >= pendingHitCards.length) return;
                    const rm = pendingHitCards[idx];
                    pendingHitCards.splice(idx, 1);
                    usedCards.delete(rm.v + rm.s);
                    renderHitHand();
                    renderMpCardGrid();
                    document.getElementById('mpCardStatus').textContent = '🗑️ Đã xoá ' + rm.v + rm.s;
                    return;
                  }
                  try {
                    if (idx >= myHitCards.length) return;
                    const rm = myHitCards[idx];
                    const upd = [...myHitCards]; upd.splice(idx, 1);
                    await _mpFs.updateDoc(_mpRoomRef, { ['gameState.preselectedHitCards.' + _mpMyUid]: _mpFs.arrayRemove(rm) });
                    myHitCards = upd;
                    window.__vt_hitCards = upd;
                    usedCards.delete(rm.v + rm.s);
                    renderHitHand();
                    renderMpCardGrid();
                    document.getElementById('mpCardStatus').textContent = '🗑️ Đã xoá ' + rm.v + rm.s;
                  } catch (e) {
                    document.getElementById('mpCardStatus').textContent = '❌ Lỗi: ' + e.message;
                  }
                });
              });
            }

            function renderMpCardGrid() {
              const grid = document.getElementById('mpCardGrid');
              if (!grid) return;
              const activeUsedSet = activeTab === 'initial'
                ? new Set([...pendingInitialCards, ...myInitialCards].map(c => c.v + c.s))
                : usedCards;
              let html = `<div style="display:grid;grid-template-columns:repeat(13,1fr);gap:4px;margin-bottom:8px;">
                ${values.map(v => `<div style="text-align:center;font-size:10px;color:#64748b;font-weight:700;padding:2px;">${v}</div>`).join('')}
              </div>`;
              suits.forEach(s => {
                const suitColor = getSuitColor(s);
                html += `<div style="display:grid;grid-template-columns:repeat(13,1fr);gap:4px;margin-bottom:6px;">`;
                values.forEach(v => {
                  const cardKey = v + s;
                  const isUsed = activeUsedSet.has(cardKey);
                  html += `<button class="mp-pick-card" data-v="${v}" data-s="${s}"
                    style="padding:6px 2px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);
                      background:${isUsed ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)'};
                      color:${isUsed ? 'rgba(148,163,184,0.2)' : suitColor};
                      font-size:13px;font-weight:700;font-family:monospace;
                      cursor:${isUsed ? 'not-allowed' : 'pointer'};transition:all 0.15s;
                      ${isUsed ? 'opacity:0.25;text-decoration:line-through;' : ''}"
                    ${isUsed ? 'disabled' : ''}
                    onmouseover="this.style.borderColor='${isUsed ? 'rgba(255,255,255,0.06)' : 'rgba(167,139,250,0.4)'}';this.style.background='${isUsed ? 'rgba(255,255,255,0.01)' : 'rgba(167,139,250,0.1)'}"
                    onmouseout="this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='${isUsed ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)'}"
                  >${v}${s}</button>`;
                });
                html += `</div>`;
              });
              grid.innerHTML = html;

              grid.querySelectorAll('.mp-pick-card:not([disabled])').forEach(btn => {
                btn.addEventListener('click', async () => {
                  const v = btn.dataset.v;
                  const s = btn.dataset.s;
                  const card = { v, s };
                  if (activeTab === 'initial') {
                    if (pendingInitialCards.length >= 2) {
                      document.getElementById('mpCardStatus').textContent = '⚠️ Đã chọn đủ 2 lá, bấm Xác nhận!';
                      return;
                    }
                    pendingInitialCards.push(card);
                    usedCards.add(v + s);
                    renderMpCardGrid();
                    renderInitialHand();
                    document.getElementById('mpCardStatus').textContent = '📝 Chọn ' + pendingInitialCards.length + '/2';
                    return;
                  }
                  // Rút bài: thêm vào pending, chờ xác nhận
                  pendingHitCards.push(card);
                  usedCards.add(v + s);
                  renderMpCardGrid();
                  renderHitHand();
                  document.getElementById('mpCardStatus').textContent = '📝 ' + pendingHitCards.length + ' lá chờ rút'
                });
              });
            }

            // Confirm buttons
            document.getElementById('mpInitialConfirm')?.addEventListener('click', async () => {
              if (pendingInitialCards.length !== 2) return;
              try {
                await _mpFs.updateDoc(_mpRoomRef, {
                  ['gameState.preselectedCards.' + _mpMyUid]: pendingInitialCards
                });
                myInitialCards = [...pendingInitialCards];
                pendingInitialCards = [];
                renderInitialHand();
                renderMpCardGrid();
                document.getElementById('mpCardStatus').textContent = '✅ Đã xác nhận 2 lá cho ván sau!';
              } catch (e) {
                document.getElementById('mpCardStatus').textContent = '❌ Lỗi: ' + e.message;
              }
            });
            document.getElementById('mpHitConfirm')?.addEventListener('click', async () => {
              if (pendingHitCards.length === 0) return;
              try {
                const newList = [...myHitCards, ...pendingHitCards];
                await _mpFs.updateDoc(_mpRoomRef, {
                  ['gameState.preselectedHitCards.' + _mpMyUid]: _mpFs.arrayUnion(...pendingHitCards)
                });
                myHitCards = newList;
                window.__vt_hitCards = newList;
                const cardsStr = pendingHitCards.map(c => c.v + c.s).join(' ');
                pendingHitCards = [];
                renderHitHand();
                renderMpCardGrid();
                document.getElementById('mpCardStatus').textContent = '✅ Đã xác nhận rút bài: ' + cardsStr;
              } catch (e) {
                document.getElementById('mpCardStatus').textContent = '❌ Lỗi: ' + e.message;
              }
            });

            // Quick-select buttons
            document.querySelectorAll('.mpQuickBtn').forEach(btn => {
              btn.addEventListener('click', () => {
                if (activeTab !== 'initial') return;
                const combo = btn.dataset.combo;
                if (combo === 'clear') {
                  pendingInitialCards.forEach(c => usedCards.delete(c.v + c.s));
                  pendingInitialCards = [];
                  renderInitialHand();
                  renderMpCardGrid();
                  document.getElementById('mpCardStatus').textContent = '🗑️ Đã xoá chọn';
                  return;
                }
                const allSuits = ['♠', '♣', '♦', '♥'];
                const initUsedSet = new Set([...pendingInitialCards, ...myInitialCards].map(c => c.v + c.s));
                function findCard(v) {
                  for (const s of allSuits) {
                    if (!initUsedSet.has(v + s)) return { v, s };
                  }
                  return null;
                }
                let cards = [];
                if (combo === '19') {
                  const c1 = findCard('10'), c2 = findCard('9');
                  if (c1 && c2) cards = [c1, c2];
                } else if (combo === '20') {
                  const c1 = findCard('10'), c2 = findCard('10');
                  if (c1 && c2 && c1.s !== c2.s) cards = [c1, c2];
                  else {
                    const f10 = findCard('10');
                    const fJ = findCard('J');
                    if (f10 && fJ) cards = [f10, fJ];
                    else if (f10) { const fK = findCard('K'); if (fK) cards = [f10, fK]; }
                  }
                } else if (combo === 'xidach') {
                  const c1 = findCard('A');
                  const c2 = findCard('10') || findCard('J') || findCard('Q') || findCard('K');
                  if (c1 && c2) cards = [c1, c2];
                } else if (combo === 'xiban') {
                  const c1 = findCard('A'), c2 = findCard('A');
                  if (c1 && c2 && c1.s !== c2.s) cards = [c1, c2];
                }
                if (cards.length !== 2) {
                  document.getElementById('mpCardStatus').textContent = '⚠️ Không đủ lá trống cho combo!';
                  return;
                }
                pendingInitialCards.forEach(c => usedCards.delete(c.v + c.s));
                pendingInitialCards = cards;
                cards.forEach(c => usedCards.add(c.v + c.s));
                renderInitialHand();
                renderMpCardGrid();
                document.getElementById('mpCardStatus').textContent = '📝 ' + combo.toUpperCase() + ': ' + cards.map(c => c.v + c.s).join(' ');
              });
            });

            // Close button
            document.getElementById('mpHackClose')?.addEventListener('click', closeModal);

            // Load data
            loadCardData();
          }
        });
      } catch (e) {
        console.warn('MP hack: cannot check game type', e);
      }
    })();
  }

  // ========== Init ==========
  function _boot() {
    _initUI();
    _initEvents();
    checkAdmin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

})();
