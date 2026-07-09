// slot.js — Nổ Hũ Online (Jackpot Firestore + Buff Pet + Thưởng thường + Ô kết quả)
import { auth, db } from './points.js';
import {
  doc, onSnapshot, runTransaction, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { subscribeBalance } from './points.js';
import { getActiveBuff } from './pet.js';

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

    this.updateStatusBar(0, '--', null);

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
    window.game = this;
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
    const isJackpot = a === '7️⃣' && b === '7️⃣' && c === '7️⃣';
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

    if (isJackpot) {
      this.updateResultDisplay('🔥 NỔ HŨ! 🔥', 'jackpot');
      this.updateStatusBar(betAmount, '777', finalWin - betAmount);
      if (buffPercent > 0) {
        window.showToast(`🐾 Pet buff +${buffPercent}%! Nhận ${finalWin.toLocaleString('vi-VN')} 〄`, 'success');
      }
      window.showToast(`🎉🎉 NỔ HŨ! Bạn nhận ${finalWin.toLocaleString('vi-VN')} 〄 🎉🎉`, 'success');
    } else if (isTriple) {
      this.updateResultDisplay(`🎉 Trúng 3x ${a}!`, 'win');
      this.updateStatusBar(betAmount, 'Triple', finalWin - betAmount);
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
    location.href = 'games.html';
  }
}

new SlotGame();
