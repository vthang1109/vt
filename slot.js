// slot.js — Nổ Hũ Online (Jackpot Firestore + Buff Pet + Thưởng thường + Ô kết quả)
import { auth, db } from './points.js';
import {
  doc, onSnapshot, runTransaction, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getPoints, addPoints } from './points.js';

// ========== CẤU HÌNH ==========
const SYMBOLS = ['🍊', '🍇', '🍋', '🔔', '7️⃣'];
const MIN_BET = 50;
const JACKPOT_DOC_REF = doc(db, 'system', 'jackpot');

class SlotGame {
  constructor() {
    this.balance = 0;
    this.isSpinning = false;
    this.unsubJackpot = null;
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

    const points = await getPoints();
    this.balance = points || 0;

    // Hiển thị điểm trên top-nav (tiền đã lên nav, không hiện bank riêng)
    if (window.TopNav) TopNav.setPoints(this.balance);
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

    window.game = this;
  }

  // ========== HIỂN THỊ SỐ DƯ & HŨ LỚN ==========
  updateJackpotDisplay(value) {
    const el = document.getElementById('slot-jackpot-value');
    if (el) el.textContent = value.toLocaleString('vi-VN') + ' đ';
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
        profitEl.className = 'bc-profit zero';
      } else if (net > 0) {
        profitEl.textContent = `+${net.toLocaleString('vi-VN')}`;
        profitEl.className = 'bc-profit positive';
      } else if (net < 0) {
        profitEl.textContent = `${net.toLocaleString('vi-VN')}`;
        profitEl.className = 'bc-profit negative';
      } else {
        profitEl.textContent = 'Huề';
        profitEl.className = 'bc-profit zero';
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
      window.showToast(`Cược tối thiểu ${MIN_BET}⭐`, 'warn');
      return;
    }

    const currentPoints = await getPoints();
    if (currentPoints !== null) this.balance = currentPoints;

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
      await this.deductAndAddJackpot(bet);
      const result = await this.spinReels();
      await this.checkWin(result, bet);
    } catch (e) {
      console.error('Lỗi trong spin():', e);
      window.showToast('Lỗi quay: ' + e.message, 'error');
    } finally {
      this.isSpinning = false;
      if (btnSpin) btnSpin.disabled = false;
      document.getElementById('bc-status')?.classList.remove('rolling');
      if (window.TopNav) TopNav.setPoints(this.balance);
    }
  }

  // ========== GỘP TRỪ ĐIỂM & CỘNG HŨ (1 TRANSACTION) ==========
  async deductAndAddJackpot(betAmount) {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const jackpotRef = JACKPOT_DOC_REF;

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error('Tài khoản không tồn tại');
      const currentPoints = userSnap.data().points || 0;
      if (currentPoints < betAmount) throw new Error('Không đủ điểm');
      const newPoints = currentPoints - betAmount;

      const jpSnap = await transaction.get(jackpotRef);
      const currentJackpot = jpSnap.exists() ? (jpSnap.data().value || 1000) : 1000;
      const newJackpot = currentJackpot + betAmount;

      transaction.update(userRef, { points: newPoints, lastUpdate: serverTimestamp() });
      transaction.set(jackpotRef, { value: newJackpot }, { merge: true });

      this.balance = newPoints;
    });
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

  // ========== KIỂM TRA KẾT QUẢ & PHÁT THƯỞNG ==========
  async checkWin(result, betAmount) {
    const [a, b, c] = result;

    if (a === '7️⃣' && b === '7️⃣' && c === '7️⃣') {
      this.updateResultDisplay('🔥 NỔ HŨ! 🔥', 'jackpot');
      await this.triggerJackpotWin(betAmount);
      return;
    }

    if (a === b && b === c) {
      this.updateResultDisplay(`🎉 Trúng 3x ${result[0]}!`, 'win');
      const winAmount = betAmount * 3;
      await this.grantNormalWin(winAmount, result[0], betAmount);
      return;
    }

    this.updateResultDisplay('❌ Không trúng', 'lose');
    this.updateStatusBar(betAmount, 'Lose', -betAmount);
    window.showToast('Chúc bạn may mắn lần sau!', 'info');
  }

  // ========== NỔ HŨ: NHẬN TOÀN BỘ JACKPOT & RESET ==========
  async triggerJackpotWin(betAmount) {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    let finalWin = 0;

    try {
      finalWin = await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const currentPoints = userSnap.exists() ? (userSnap.data().points || 0) : 0;

        const jpSnap = await transaction.get(JACKPOT_DOC_REF);
        const jackpotValue = jpSnap.exists() ? (jpSnap.data().value || 1000) : 1000;

        transaction.update(JACKPOT_DOC_REF, { value: 1000 });
        transaction.update(userRef, { points: currentPoints + jackpotValue, lastUpdate: serverTimestamp() });

        return jackpotValue;
      });
    } catch (e) {
      console.error('Transaction nổ hũ lỗi:', e);
      const snap = await getDoc(JACKPOT_DOC_REF);
      finalWin = snap.exists() ? (snap.data().value || 1000) : 1000;
      await setDoc(JACKPOT_DOC_REF, { value: 1000 }, { merge: true });
      const userSnap = await getDoc(userRef);
      const currentPoints = userSnap.exists() ? (userSnap.data().points || 0) : 0;
      await setDoc(userRef, { points: currentPoints + finalWin, lastUpdate: serverTimestamp() }, { merge: true });
    }

    let finalWinWithBuff = finalWin;
    try {
      const { getActiveBuff } = await import('./pet.js');
      const buffPercent = await getActiveBuff();
      if (buffPercent > 0) {
        finalWinWithBuff = Math.round(finalWin * (1 + buffPercent / 100));
        if (finalWinWithBuff > finalWin) {
          await addPoints('Casino', 'Buff Pet Nổ Hũ', finalWinWithBuff - finalWin);
        }
        window.showToast(`🐾 Pet buff +${buffPercent}%! Nhận ${finalWinWithBuff.toLocaleString('vi-VN')} ⭐`, 'success');
      }
    } catch (e) {}

    this.balance += finalWinWithBuff;
    if (window.TopNav) TopNav.setPoints(this.balance);
    this.updateStatusBar(betAmount, '777', finalWinWithBuff - betAmount);

    window.showToast(`🎉🎉 NỔ HŨ! Bạn nhận ${finalWinWithBuff.toLocaleString('vi-VN')} ⭐ 🎉🎉`, 'success');
  }

  // ========== THẮNG THƯỜNG ==========
  async grantNormalWin(baseAmount, symbol, betAmount) {
    let finalAmount = baseAmount;

    try {
      const { getActiveBuff } = await import('./pet.js');
      const buffPercent = await getActiveBuff();
      if (buffPercent > 0) {
        finalAmount = Math.round(baseAmount * (1 + buffPercent / 100));
      }
    } catch (e) {}

    await addPoints('Casino', `Trúng 3x ${symbol}`, finalAmount);

    this.balance += finalAmount;
    if (window.TopNav) TopNav.setPoints(this.balance);
    this.updateStatusBar(betAmount, 'Triple', finalAmount - betAmount);

    window.showToast(
      `🎉 Trúng 3x ${symbol}! +${finalAmount.toLocaleString('vi-VN')} ⭐`,
      'success'
    );
  }

  // ========== RỜI GAME ==========
  quit() {
    if (this.unsubJackpot) this.unsubJackpot();
    location.href = 'games.html';
  }
}

new SlotGame();
