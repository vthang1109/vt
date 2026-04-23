// ===== send-points.js =====
// Logic gửi điểm (points) cho bạn bè trong chat.
// Yêu cầu: trang nào dùng phải có Firebase init (chat.js đã init sẵn).
// Cách dùng:
//   <script type="module" src="send-points.js"></script>
// Sau đó gọi: window.openSendPointsModal(toUid, toName)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, runTransaction,
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ===== TẠO MODAL DOM (1 lần) =====
function ensureModal() {
  if (document.getElementById('sendPointsModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'sendPointsModal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;background:rgba(2,11,24,0.78);backdrop-filter:blur(6px)';
  wrap.innerHTML = `
    <div style="width:92%;max-width:380px;background:rgba(4,20,40,0.97);border:1px solid rgba(56,189,248,0.25);border-radius:18px;padding:22px 22px 18px;box-shadow:0 20px 60px rgba(0,0,0,0.6);font-family:'Nunito',sans-serif">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center;font-size:22px">💸</div>
        <div>
          <div style="font-weight:900;font-size:16px;color:#e0f2fe">Gửi điểm cho bạn</div>
          <div id="spm-target" style="font-size:12px;color:#7dd3fc;margin-top:2px">—</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;font-size:12px;color:#7dd3fc;margin-bottom:6px">
        <span>Số điểm hiện có</span>
        <span id="spm-balance" style="font-weight:800;color:#38bdf8">0 đ</span>
      </div>

      <input id="spm-amount" type="number" min="1" placeholder="Nhập số điểm muốn gửi"
        style="width:100%;padding:11px 14px;border-radius:12px;border:1px solid rgba(56,189,248,0.25);background:rgba(56,189,248,0.06);color:#e0f2fe;font-size:15px;font-weight:700;outline:none;font-family:'Nunito',sans-serif"/>

      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <button data-q="100"  class="spm-quick">+100</button>
        <button data-q="500"  class="spm-quick">+500</button>
        <button data-q="1000" class="spm-quick">+1K</button>
        <button data-q="5000" class="spm-quick">+5K</button>
        <button data-q="all"  class="spm-quick">Tất cả</button>
      </div>

      <input id="spm-note" type="text" maxlength="80" placeholder="Lời nhắn (tuỳ chọn)…"
        style="width:100%;margin-top:10px;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#e0f2fe;font-size:13px;outline:none;font-family:'Nunito',sans-serif"/>

      <div style="display:flex;gap:8px;margin-top:14px">
        <button id="spm-cancel" style="flex:1;padding:11px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#cbd5e1;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">Huỷ</button>
        <button id="spm-confirm" style="flex:2;padding:11px;border-radius:12px;background:linear-gradient(135deg,#34d399,#059669);border:none;color:#fff;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif">💸 Gửi ngay</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // Style nhanh cho nút quick
  const style = document.createElement('style');
  style.textContent = `
    .spm-quick{flex:1;min-width:60px;padding:7px 6px;border-radius:10px;border:1px solid rgba(56,189,248,0.25);background:rgba(56,189,248,0.07);color:#7dd3fc;font-weight:800;cursor:pointer;font-size:12px;font-family:'Nunito',sans-serif;transition:all .15s}
    .spm-quick:hover{background:rgba(56,189,248,0.18);color:#e0f2fe}
  `;
  document.head.appendChild(style);

  // Events
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal(); });
  wrap.querySelector('#spm-cancel').onclick = closeModal;
  wrap.querySelector('#spm-confirm').onclick = doSend;
  wrap.querySelectorAll('.spm-quick').forEach(b => {
    b.onclick = () => {
      const q = b.dataset.q;
      const balance = parseInt(wrap.dataset.balance || '0', 10);
      const inp = wrap.querySelector('#spm-amount');
      if (q === 'all') inp.value = balance;
      else inp.value = (parseInt(inp.value || '0', 10) + parseInt(q, 10));
    };
  });
}

function closeModal() {
  const m = document.getElementById('sendPointsModal');
  if (m) m.style.display = 'none';
}

function toast(msg, type='info') {
  if (window.showToast) return window.showToast(msg, type);
  alert(msg.replace(/<[^>]+>/g,''));
}

// ===== MỞ MODAL =====
window.openSendPointsModal = async function(toUid, toName) {
  if (!auth.currentUser) { toast('⚠️ Hãy đăng nhập!', 'warn'); return; }
  if (!toUid || toUid === auth.currentUser.uid) { toast('❌ Không thể gửi cho chính mình!', 'error'); return; }

  ensureModal();
  const m = document.getElementById('sendPointsModal');
  m.querySelector('#spm-target').textContent = '→ ' + (toName || 'Người nhận');
  m.querySelector('#spm-amount').value = '';
  m.querySelector('#spm-note').value   = '';

  // Lấy số dư hiện tại
  try {
    const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
    const bal  = snap.exists() ? (snap.data().points || 0) : 0;
    m.dataset.balance = bal;
    m.querySelector('#spm-balance').textContent = bal.toLocaleString() + ' đ';
  } catch(e) { m.querySelector('#spm-balance').textContent = '0 đ'; }

  m.style.display = 'flex';
  m.dataset.toUid = toUid;
  m.dataset.toName = toName || '';
  setTimeout(() => m.querySelector('#spm-amount').focus(), 100);
};

// ===== XỬ LÝ GỬI =====
async function doSend() {
  const m = document.getElementById('sendPointsModal');
  const fromUid = auth.currentUser?.uid;
  const toUid   = m.dataset.toUid;
  const toName  = m.dataset.toName;
  const amount  = parseInt(m.querySelector('#spm-amount').value || '0', 10);
  const note    = (m.querySelector('#spm-note').value || '').trim();

  if (!fromUid) { toast('⚠️ Hãy đăng nhập!', 'warn'); return; }
  if (!toUid || toUid === fromUid) { toast('❌ Người nhận không hợp lệ!', 'error'); return; }
  if (!Number.isFinite(amount) || amount <= 0) { toast('❌ Số điểm phải > 0!', 'error'); return; }
  if (amount > 1_000_000_000) { toast('❌ Số điểm quá lớn!', 'error'); return; }

  const btn = m.querySelector('#spm-confirm');
  btn.disabled = true; btn.textContent = 'Đang gửi…';

  try {
    // Transaction: trừ người gửi, cộng người nhận (an toàn race condition)
    await runTransaction(db, async (tx) => {
      const fromRef = doc(db, 'users', fromUid);
      const toRef   = doc(db, 'users', toUid);
      const fromSnap = await tx.get(fromRef);
      const toSnap   = await tx.get(toRef);

      if (!fromSnap.exists()) throw new Error('Tài khoản của bạn không tồn tại');
      if (!toSnap.exists())   throw new Error('Người nhận không tồn tại');

      const fromPoints = fromSnap.data().points || 0;
      const toPoints   = toSnap.data().points   || 0;

      if (fromPoints < amount) throw new Error('Không đủ điểm để gửi');

      tx.update(fromRef, { points: fromPoints - amount });
      tx.update(toRef,   { points: toPoints   + amount });
    });

    // Ghi log giao dịch
    try {
      await addDoc(collection(db, 'transactions'), {
        fromUid, toUid, amount, note,
        createdAt: serverTimestamp(),
        type: 'transfer'
      });
    } catch(e) { /* không chặn nếu log lỗi */ }

    // Gửi tin nhắn hệ thống vào DM (nếu hàm sendMessage có sẵn từ chat.js)
    try {
      if (typeof window.sendMessage === 'function') {
        const msg = `💸 Đã gửi ${amount.toLocaleString()} đ${note ? ' — “'+note+'”' : ''}`;
        await window.sendMessage(toUid, msg);
      }
    } catch(e) {}

    toast(`✅ Đã gửi <b>${amount.toLocaleString()}</b> đ cho ${esc(toName)}!`, 'success');
    closeModal();
  } catch(e) {
    console.error(e);
    toast('❌ ' + (e.message || 'Gửi thất bại!'), 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💸 Gửi ngay';
  }
}
