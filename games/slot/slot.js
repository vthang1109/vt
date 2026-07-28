// slot.js — Nổ Hũ Online (Jackpot Firestore + Buff Pet + Thưởng thường + Ô kết quả)
import { auth, db } from '../../points.js';
import {
  doc, onSnapshot, runTransaction, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { subscribeBalance } from '../../points.js';
import { getActiveBuff } from '../../pet.js';

// ========== CẤU HÌNH ==========
const SYMBOLS = ['🍊', '🍇', '🍋', '🔔', '7️⃣'];
const MIN_BET = 50;
const JACKPOT_DOC_REF = doc(db, 'system', 'jackpot');

class SlotGame {
  constructor() {
    this.balance = 0;
    this.isSpinning = false;
    this.unsubJackpot = null;
    this.unsubBalance = null;
    this.cachedBuffPct = 0;
    this.initAfterAuth();
  }

  // ========== KHỞI TẠO SAU KHI ĐĂNG NHẬP ==========
  async initAfterAuth() {
    await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, user => {
        unsub();
        if (user) resolve();
        else location.href = 'index.html';
      });
    });

    // TopNav đã tự init() lúc DOMContentLoaded, không gọi lại để tránh tạo nav trùng

    // ===== ĐỒNG BỘ ĐIỂM REALTIME (thay getPoints 1 lần) =====
    this.unsubBalance = subscribeBalance((points) => {
      this.balance = points || 0;
      if (window.TopNav) TopNav.setPoints(this.balance);
    });

    // ===== TẠO DOCUMENT JACKPOT NẾU CHƯA CÓ =====
    try {
      const snap = await getDoc(JACKPOT_DOC_REF);
      if (!snap.exists()) {
        await setDoc(JACKPOT_DOC_REF, { value: 1000 });
        console.log('✅ Đã tạo document jackpot mới');
      }
    } catch (e) {
      console.error('Lỗi tạo jackpot doc:', e);
    }

    // ===== LẮNG NGHE HŨ LỚN REALTIME =====
    this.unsubJackpot = onSnapshot(JACKPOT_DOC_REF, (docSnap) => {
      if (docSnap.exists()) {
        const jp = docSnap.data().value || 1000;
        this.updateJackpotDisplay(jp);
      }
    });

    this.refreshBuffCache();
    this.setupSplash();
    window.game = this;
  }

  setupSplash() {
    const playBtn = document.getElementById('slot-play-btn');
    const menu = document.getElementById('slot-menu');
    const gameScreen = document.getElementById('slot-game-screen');
    const betInputMenu = document.getElementById('slot-bet-input-menu');
    const betInput = document.getElementById('slot-bet-input');
    if (!playBtn || !menu || !gameScreen) return;
    playBtn.addEventListener('click', () => {
      if (betInput && betInputMenu) betInput.value = betInputMenu.value;
      menu.classList.remove('active');
      menu.style.display = 'none';
      gameScreen.classList.add('active');
      gameScreen.style.display = '';
      this.updateStatusBar(0, '--', null);
    });
  }

  async refreshBuffCache() {
    try { this.cachedBuffPct = await getActiveBuff(); } catch { this.cachedBuffPct = 0; }
  }

  // ========== HIỂN THỊ SỐ DƯ & HŨ LỚN ==========
  updateJackpotDisplay(value) {
    const el = document.getElementById('slot-jackpot-value');
    if (el) el.textContent = value.toLocaleString('vi-VN') + '〄';
  }

  updateResultDisplay(message, type = '') {
    const el = document.getElementById('slot-result');
    if (!el) return;
    el.textContent = message;
    el.className = 'slot-result' + (type ? ' result-' + type : '');
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = '';
  }

  // ========== CẬP NHẬT STATUS BAR: [cược] [Lose/Triple/777] [lời-lỗ] ==========
  updateStatusBar(bet, mid, net) {
    const betEl = document.getElementById('slot-bet-total');
    const midEl = document.getElementById('slot-result-mid');
    const profitEl = document.getElementById('slot-profit');
    const statusEl = document.getElementById('bc-status');

    if (betEl) betEl.textContent = bet > 0 ? bet.toLocaleString('vi-VN') : '0';
    if (midEl) midEl.textContent = mid;

    if (profitEl) {
      if (net === null) {
        profitEl.textContent = '+0';
        profitEl.className = 'stat-profit zero';
      } else if (net > 0) {
        profitEl.textContent = `+${net.toLocaleString('vi-VN')}`;
        profitEl.className = 'stat-profit positive';
      } else if (net < 0) {
        profitEl.textContent = `${net.toLocaleString('vi-VN')}`;
        profitEl.className = 'stat-profit negative';
      } else {
        profitEl.textContent = 'Huề';
        profitEl.className = 'stat-profit zero';
      }
    }

    if (statusEl) {
      statusEl.classList.remove('rolling', 'result-win', 'result-lose', 'result-jackpot');
      if (net !== null) {
        if (mid === '777') statusEl.classList.add('result-jackpot');
        else if (net > 0) statusEl.classList.add('result-win');
        else if (net < 0) statusEl.classList.add('result-lose');
      }
    }
  }

  // ========== HÀM QUAY CHÍNH ==========
  async spin() {
    if (this.isSpinning) return;

    const betInput = document.getElementById('slot-bet-input');
    const bet = parseInt(betInput.value);
    if (!bet || bet < MIN_BET) {
      window.showToast(`Cược tối thiểu ${MIN_BET}〄`, 'warn');
      return;
    }

    // this.balance đã được đồng bộ realtime qua subscribeBalance, không cần getPoints()
    if (bet > this.balance) {
      window.showToast('Không đủ điểm!', 'error');
      return;
    }

    this.isSpinning = true;
    const btnSpin = document.getElementById('btn-spin');
    if (btnSpin) btnSpin.disabled = true;

    this.updateResultDisplay('');
    this.updateStatusBar(bet, 'Đang quay...', null);
    document.getElementById('bc-status')?.classList.add('rolling');

    try {
      const result = await this.spinReels();
      await this.resolveRound(result, bet);
    } catch (e) {
      console.error('Lỗi trong spin():', e);
      window.showToast('Lỗi quay: ' + e.message, 'error');
    } finally {
      this.isSpinning = false;
      if (btnSpin) btnSpin.disabled = false;
      document.getElementById('bc-status')?.classList.remove('rolling');
    }
  }

  // ========== HIỆU ỨNG QUAY 3 Ô ==========
  async spinReels() {
    const reels = [
      document.getElementById('reel-0'),
      document.getElementById('reel-1'),
      document.getElementById('reel-2')
    ];

    reels.forEach(r => r && r.classList.add('spinning'));
    await new Promise(r => setTimeout(r, 1500));

    const result = [];
    for (let i = 0; i < 3; i++) {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      result.push(symbol);
      if (reels[i]) {
        reels[i].textContent = symbol;
        reels[i].classList.remove('spinning');
      }
    }
    return result;
  }

  // ========== GỘP TRỪ CƯỢC + CỘNG HŨ + PHÁT THƯỞNG THÀNH 1 TRANSACTION/VÁN ==========
  async resolveRound(result, betAmount) {
    const [a, b, c] = result;
    let isJackpot = a === .7️⃣. && b === .7️⃣. && c === .7️⃣.;
    let isTriple = !isJackpot && a === b && b === c;
    if (window.__ADMIN_FORCED_RESULT === .win.) { isJackpot = false; isTriple = true; }
    else if (window.__ADMIN_FORCED_RESULT === .lose.) { isJackpot = false; isTriple = false; }
    const isTriple = !isJackpot && a === b && b === c;
    const buffPercent = this.cachedBuffPct;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    let finalWin = 0;
    let newUserPoints = 0;

    try {
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('Tài khoản không tồn tại');
        const currentPoints = userSnap.data().points || 0;
        if (currentPoints < betAmount) throw new Error('Không đủ điểm');

        const jpSnap = await transaction.get(JACKPOT_DOC_REF);
        const currentJackpot = jpSnap.exists() ? (jpSnap.data().value || 1000) : 1000;

        const pointsAfterBet = currentPoints - betAmount;
        let newJackpotValue;

        if (isJackpot) {
          finalWin = buffPercent > 0
            ? Math.round(currentJackpot * (1 + buffPercent / 100))
            : currentJackpot;
          newJackpotValue = 1000;
        } else if (isTriple) {
          const baseWin = betAmount * 3;
          finalWin = buffPercent > 0
            ? Math.round(baseWin * (1 + buffPercent / 100))
            : baseWin;
          newJackpotValue = currentJackpot + betAmount;
        } else {
          finalWin = 0;
          newJackpotValue = currentJackpot + betAmount;
        }

        newUserPoints = pointsAfterBet + finalWin;

        transaction.update(userRef, { points: newUserPoints, lastUpdate: serverTimestamp() });
        transaction.set(JACKPOT_DOC_REF, { value: newJackpotValue }, { merge: true });
      });
    } catch (e) {
      console.error('Lỗi transaction ván chơi:', e);
      window.showToast('Lỗi: ' + e.message, 'error');
      this.updateStatusBar(betAmount, '--', null);
      return;
    }

    // this.balance sẽ được listener subscribeBalance cập nhật; set tạm để UI mượt
    this.balance = newUserPoints;
    if (window.TopNav) TopNav.setPoints(this.balance);

    if (window.VTQuests) window.VTQuests.trackPlay('slot');
    if (isJackpot) {
      this.updateResultDisplay('🔥 NỔ HŨ! 🔥', 'jackpot');
      this.updateStatusBar(betAmount, '777', finalWin - betAmount);
      if (window.VTQuests) window.VTQuests.trackGameWin('slot');
      if (buffPercent > 0) {
        window.showToast(`🐾 Pet buff +${buffPercent}%! Nhận ${finalWin.toLocaleString('vi-VN')} 〄`, 'success');
      }
      window.showToast(`🎉🎉 NỔ HŨ! Bạn nhận ${finalWin.toLocaleString('vi-VN')} 〄 🎉🎉`, 'success');
    } else if (isTriple) {
      this.updateResultDisplay(`🎉 Trúng 3x ${a}!`, 'win');
      this.updateStatusBar(betAmount, 'Triple', finalWin - betAmount);
      if (window.VTQuests) window.VTQuests.trackGameWin('slot');
      window.showToast(`🎉 Trúng 3x ${a}! +${finalWin.toLocaleString('vi-VN')} 〄`, 'success');
    } else {
      this.updateResultDisplay('❌ Không trúng', 'lose');
      this.updateStatusBar(betAmount, 'Lose', -betAmount);
      window.showToast('Chúc bạn may mắn lần sau!', 'info');
    }
  }

  // ========== RỜI GAME ==========
  quit() {
    if (this.unsubJackpot) this.unsubJackpot();
    if (this.unsubBalance) this.unsubBalance();
    var sel=document.getElementById('slot-menu'),g=document.getElementById('slot-game-screen');if(sel){sel.classList.add('active');sel.style.display=''}if(g){g.classList.remove('active');g.style.display='none'}var sb=document.getElementById('bc-status');if(sb)sb.style.display='none';
  }
}

new SlotGame();

// ── ADMIN HACK: CHỌN KẾT QUẢ ────────────────────────────
if (window.__ADMIN_GAME_HACKS) {
  const HACK_SYMBOLS = ['🍊', '🍇', '🍋', '🔔', '7️⃣', '💎', '⭐', '👑'];

  // Patch spinReels để dùng forced results từ hack
  const origSpinReels = SlotGame.prototype.spinReels;
  SlotGame.prototype.spinReels = async function() {
    if (this.slotResult) {
      const result = this.slotResult;
      this.slotResult = null;
      const reels = [0,1,2].map(i => document.getElementById('reel-' + i));
      reels.forEach(r => r && r.classList.add('spinning'));
      await new Promise(r => setTimeout(r, 500));
      result.forEach((sym, i) => {
        if (reels[i]) {
          reels[i].textContent = sym;
          reels[i].classList.remove('spinning');
        }
      });
      return result;
    }
    return origSpinReels.call(this);
  };

  window.__ADMIN_GAME_HACKS.push({
    id: 'slot_choose_result',
    label: 'Chọn kết quả',
    icon: '🎰',
    render: (container, closeModal) => {
      let selected = [null, null, null];
      let currentReel = 0;

      function renderUI() {
        container.innerHTML = `
          <p style="color:#94a3b8;font-size:12px;margin-bottom:10px;">Click để chọn biểu tượng cho từng cột (đang chọn <b id="slotHackCurrentReel">Cột 1</b>)</p>
          <div id="slotHackStatus" style="color:#34d399;font-size:12px;font-weight:700;margin-bottom:8px;min-height:18px;"></div>
          <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px;">
            ${[0,1,2].map(r => `
              <div style="flex:1;text-align:center;">
                <div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:6px;">Cột ${r+1}</div>
                <div id="slotReel${r}" style="
                  width:60px;height:60px;margin:0 auto;
                  background:rgba(255,255,255,0.03);border:2px solid ${selected[r] ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'};
                  border-radius:12px;display:flex;align-items:center;justify-content:center;
                  font-size:28px;transition:border-color 0.2s;
                ">${selected[r] || '?'}</div>
              </div>
            `).join('')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:12px;">
            ${HACK_SYMBOLS.map(sym => `
              <button class="slot-hack-btn" data-sym="${sym}" style="
                padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);
                background:rgba(255,255,255,0.03);color:#e0f2fe;font-size:22px;
                cursor:pointer;transition:all 0.15s;
              " onmouseover="this.style.borderColor='rgba(167,139,250,0.4)';this.style.background='rgba(167,139,250,0.1)'"
                 onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.03)'">${sym}</button>
            `).join('')}
          </div>
          <div style="display:flex;gap:8px;">
            <button id="slotHackApply" style="flex:1" class="green">🎯 Áp dụng</button>
            <button id="slotHackJackpot" style="flex:1" class="yellow">👑 Jackpot</button>
            <button id="slotHackClose" style="background:rgba(148,163,184,0.1);color:#94a3b8;border-color:rgba(148,163,184,0.2);">✕</button>
          </div>
        `;

        container.querySelectorAll('.slot-hack-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            selected[currentReel] = btn.dataset.sym;
            const el = document.getElementById('slotReel' + currentReel);
            if (el) { el.textContent = btn.dataset.sym; el.style.borderColor = 'rgba(52,211,153,0.4)'; }
            currentReel = (currentReel + 1) % 3;
            const reelLabel = document.getElementById('slotHackCurrentReel');
            if (reelLabel) reelLabel.textContent = 'Cột ' + (currentReel + 1);
          });
        });

        document.getElementById('slotHackApply')?.addEventListener('click', () => {
          const g = window.game;
          if (!g) return;
          if (selected.includes(null)) { document.getElementById('slotHackStatus').textContent = '⚠️ Chọn đủ 3 cột!'; return; }
          g.slotResult = [...selected];
          document.getElementById('slotHackStatus').textContent = '✅ Kết quả set: ' + selected.join(' ');
        });

        document.getElementById('slotHackJackpot')?.addEventListener('click', () => {
          const g = window.game;
          if (!g) return;
          selected = ['👑', '👑', '👑'];
          g.slotResult = ['👑', '👑', '👑'];
          currentReel = 0;
          renderUI();
          document.getElementById('slotHackStatus').textContent = '👑 Jackpot set! Quay để nhận.';
        });

        document.getElementById('slotHackClose')?.addEventListener('click', closeModal);
      }
      renderUI();
    }
  });
}
