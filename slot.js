// slot.js — Nổ Hũ Online (Jackpot Firestore + Buff Pet + Thưởng thường + Ô kết quả)
import { auth, db } from './points.js';
import {
  doc, onSnapshot, runTransaction, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getPoints, addPoints } from './points.js';

// ========== CẤU HÌNH ==========
const SYMBOLS = ['🍊', '🍇', '🍋', '🔔', '7️⃣'];   // Các biểu tượng trên máy quay
const MIN_BET = 50;                            // Cược tối thiểu
const JACKPOT_DOC_REF = doc(db, 'system', 'jackpot'); // Document Firestore chứa hũ lớn

class SlotGame {
  constructor() {
    this.balance = 0;           // Số dư hiện tại của người chơi
    this.isSpinning = false;    // Cờ đang quay
    this.unsubJackpot = null;   // Listener realtime của hũ
    this.initAfterAuth();
  }

  // ========== KHỞI TẠO SAU KHI ĐĂNG NHẬP ==========
  async initAfterAuth() {
    // Đợi Firebase Auth sẵn sàng
    await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, user => {
        unsub();
        if (user) resolve();
        else location.href = 'index.html'; // Chưa đăng nhập → về trang chủ
      });
    });

    // Lấy số dư một lần từ Firestore (không dùng onSnapshot để tiết kiệm lượt đọc)
    const points = await getPoints();
    this.balance = points || 0;
    document.getElementById('slot-balance').textContent = this.balance.toLocaleString('vi-VN') + ' đ';

    // ===== TẠO DOCUMENT JACKPOT NẾU CHƯA CÓ =====
    try {
      const snap = await getDoc(JACKPOT_DOC_REF);
      if (!snap.exists()) {
        await setDoc(JACKPOT_DOC_REF, { value: 1000 }); // Giá trị khởi tạo 1000
        console.log('✅ Đã tạo document jackpot mới');
      }
    } catch (e) {
      console.error('Lỗi tạo jackpot doc:', e);
    }

    // ===== LẮNG NGHE HŨ LỚN REALTIME (CHỈ ĐỌC) =====
    this.unsubJackpot = onSnapshot(JACKPOT_DOC_REF, (docSnap) => {
      if (docSnap.exists()) {
        const jp = docSnap.data().value || 1000;
        this.updateJackpotDisplay(jp);
      }
    });

    window.game = this; // Gán vào window để gọi từ HTML
  }

  // ========== HIỂN THỊ SỐ DƯ & HŨ LỚN ==========
  updateJackpotDisplay(value) {
    const el = document.getElementById('slot-jackpot-value');
    if (el) el.textContent = value.toLocaleString('vi-VN') + ' đ';
  }

  // Hiển thị kết quả dưới 3 ô reel
  updateResultDisplay(message) {
    const el = document.getElementById('slot-result');
    if (el) el.textContent = message;
  }

  // ========== HÀM QUAY CHÍNH ==========
  async spin() {
    if (this.isSpinning) return; // Đang quay thì bỏ qua

    const betInput = document.getElementById('slot-bet-input');
    const bet = parseInt(betInput.value);
    if (!bet || bet < MIN_BET) {
      window.showToast(`Cược tối thiểu ${MIN_BET}⭐`, 'warn');
      return;
    }

    // Đọc lại số dư mới nhất từ Firestore (phòng trường hợp bị thay đổi bởi nơi khác)
    const currentPoints = await getPoints();
    if (currentPoints !== null) this.balance = currentPoints;

    if (bet > this.balance) {
      window.showToast('Không đủ điểm!', 'error');
      return;
    }

    this.isSpinning = true;
    const btnSpin = document.getElementById('btn-spin');
    if (btnSpin) btnSpin.disabled = true;

    // Xóa kết quả cũ
    this.updateResultDisplay('');

    try {
      // ===== B1: TRỪ ĐIỂM + CỘNG HŨ (GỘP TRANSACTION) =====
      await this.deductAndAddJackpot(bet);

      // ===== B2: QUAY 3 Ô (HIỆU ỨNG) =====
      const result = await this.spinReels();

      // ===== B3: KIỂM TRA KẾT QUẢ & THƯỞNG =====
      await this.checkWin(result, bet);
    } catch (e) {
      console.error('Lỗi trong spin():', e);
      window.showToast('Lỗi quay: ' + e.message, 'error');
    } finally {
      this.isSpinning = false;
      if (btnSpin) btnSpin.disabled = false;
      // Cập nhật hiển thị số dư
      document.getElementById('slot-balance').textContent = this.balance.toLocaleString('vi-VN') + ' đ';
    }
  }

  // ========== GỘP TRỪ ĐIỂM & CỘNG HŨ (1 TRANSACTION) ==========
  async deductAndAddJackpot(betAmount) {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const jackpotRef = JACKPOT_DOC_REF;

    await runTransaction(db, async (transaction) => {
      // a) Đọc điểm người chơi
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error('Tài khoản không tồn tại');
      const currentPoints = userSnap.data().points || 0;
      if (currentPoints < betAmount) throw new Error('Không đủ điểm');
      const newPoints = currentPoints - betAmount;

      // b) Đọc hũ hiện tại
      const jpSnap = await transaction.get(jackpotRef);
      const currentJackpot = jpSnap.exists() ? (jpSnap.data().value || 1000) : 1000;
      const newJackpot = currentJackpot + betAmount;

      // c) Ghi đồng thời: trừ điểm người chơi & cập nhật hũ
      transaction.update(userRef, { points: newPoints, lastUpdate: serverTimestamp() });
      transaction.set(jackpotRef, { value: newJackpot }, { merge: true });

      // Cập nhật biến local để hiển thị
      this.balance = newPoints;
    });
  }

  // ========== HIỆU ỨNG QUAY 3 Ô (GIẢ LẬP NGẪU NHIÊN) ==========
  async spinReels() {
    const reels = [
      document.getElementById('reel-0'),
      document.getElementById('reel-1'),
      document.getElementById('reel-2')
    ];

    // Thêm class spinning để chạy animation
    reels.forEach(r => r && r.classList.add('spinning'));

    // Đợi 1.5 giây cho đẹp
    await new Promise(r => setTimeout(r, 1500));

    // Dừng quay, hiển thị kết quả ngẫu nhiên
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

    // 1. Nổ Hũ (3 số 7)
    if (a === '7️⃣' && b === '7️⃣' && c === '7️⃣') {
      this.updateResultDisplay('🔥 NỔ HŨ! 🔥');
      await this.triggerJackpotWin();
      return;
    }

    // 2. Trùng 3 biểu tượng khác (không phải 7)
    if (a === b && b === c) {
      this.updateResultDisplay(`🎉 Trúng 3x ${result[0]}!`);
      const winAmount = betAmount * 3; // Thưởng gấp 3
      await this.grantNormalWin(winAmount, result[0]);
      return;
    }

    // 3. Không trúng gì
    this.updateResultDisplay('❌ Không trúng');
    window.showToast('Chúc bạn may mắn lần sau!', 'info');
  }

  // ========== NỔ HŨ: NHẬN TOÀN BỘ JACKPOT & RESET ==========
  async triggerJackpotWin() {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    let finalWin = 0;

    // Dùng transaction để đảm bảo an toàn: đọc hũ, reset về 1000, cộng điểm cho người chơi
    try {
      finalWin = await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const currentPoints = userSnap.exists() ? (userSnap.data().points || 0) : 0;

        const jpSnap = await transaction.get(JACKPOT_DOC_REF);
        const jackpotValue = jpSnap.exists() ? (jpSnap.data().value || 1000) : 1000;

        // Reset hũ về 1000
        transaction.update(JACKPOT_DOC_REF, { value: 1000 });
        // Cộng điểm cho người chơi
        transaction.update(userRef, { points: currentPoints + jackpotValue, lastUpdate: serverTimestamp() });

        return jackpotValue;
      });
    } catch (e) {
      console.error('Transaction nổ hũ lỗi:', e);
      // Fallback: đọc thủ công rồi ghi lại (có thể không đồng bộ tuyệt đối)
      const snap = await getDoc(JACKPOT_DOC_REF);
      finalWin = snap.exists() ? (snap.data().value || 1000) : 1000;
      await setDoc(JACKPOT_DOC_REF, { value: 1000 }, { merge: true });
      const userSnap = await getDoc(userRef);
      const currentPoints = userSnap.exists() ? (userSnap.data().points || 0) : 0;
      await setDoc(userRef, { points: currentPoints + finalWin, lastUpdate: serverTimestamp() }, { merge: true });
    }

    // ===== TÍNH BUFF PET (nếu có) =====
    let finalWinWithBuff = finalWin;
    try {
      const { getActiveBuff } = await import('./pet.js');
      const buffPercent = await getActiveBuff();
      if (buffPercent > 0) {
        finalWinWithBuff = Math.round(finalWin * (1 + buffPercent / 100));
        // Cộng thêm phần chênh lệch do buff (nếu buff > 0)
        if (finalWinWithBuff > finalWin) {
          await addPoints('Casino', 'Buff Pet Nổ Hũ', finalWinWithBuff - finalWin);
        }
        window.showToast(`🐾 Pet buff +${buffPercent}%! Nhận ${finalWinWithBuff.toLocaleString('vi-VN')}đ`, 'success');
      }
    } catch (e) {
      // Không có pet hoặc lỗi, bỏ qua
    }

    // Cập nhật biến local
    this.balance += finalWinWithBuff;
    document.getElementById('slot-balance').textContent = this.balance.toLocaleString('vi-VN') + ' đ';

    window.showToast(`🎉🎉 NỔ HŨ! Bạn nhận ${finalWinWithBuff.toLocaleString('vi-VN')}đ 🎉🎉`, 'success');
  }

  // ========== THẮNG THƯỜNG (TRÙNG 3 BIỂU TƯỢNG THƯỜNG) ==========
  async grantNormalWin(baseAmount, symbol) {
    let finalAmount = baseAmount;

    // ===== TÍNH BUFF PET =====
    try {
      const { getActiveBuff } = await import('./pet.js');
      const buffPercent = await getActiveBuff();
      if (buffPercent > 0) {
        finalAmount = Math.round(baseAmount * (1 + buffPercent / 100));
      }
    } catch (e) {}

    // Cộng điểm vào Firestore
    await addPoints('Casino', `Trúng 3x ${symbol}`, finalAmount);

    // Cập nhật biến local
    this.balance += finalAmount;
    document.getElementById('slot-balance').textContent = this.balance.toLocaleString('vi-VN') + ' đ';

    window.showToast(
      `🎉 Trúng 3x ${symbol}! +${finalAmount.toLocaleString('vi-VN')}đ`,
      'success'
    );
  }

  // ========== RỜI GAME ==========
  quit() {
    if (this.unsubJackpot) this.unsubJackpot(); // Hủy listener hũ
    location.href = 'games.html'; // Trở về trang chọn game
  }
}

// Khởi tạo game
new SlotGame();