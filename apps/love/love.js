// love.js — VTWorld Love App 💝 (Firestore + Kết đôi Online)
import { auth, db } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, updateDoc, onSnapshot, query, collection, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

class LoveApp {
  constructor() {
    this.uid = null;
    this.user = null;
    this.coupleId = null;
    this.data = null;
    this.currentTab = 'home';
    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizAnswered = false;
    this.unsubFirestore = null;
    this.init();
  }

  async init() {
    await new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        if (user) {
          this.uid = user.uid;
          this.user = user;
          resolve();
        } else {
          location.href = '../../index.html';
        }
      });
    });

    window.loveApp = this;
    await this.checkCouple();
  }

  // ========== LẤY TÊN NGƯỜI CHƠI ==========
  getUserName() {
    // Ưu tiên: nickname trong Firestore → displayName → email
    return this.user?.displayName || this.user?.email?.split('@')[0] || 'Người ấy';
  }

  // ========== CHECK COUPLE ==========
  async checkCouple() {
    try {
      const q1 = query(collection(db, 'love_apps'), where('person1.uid', '==', this.uid));
      const q2 = query(collection(db, 'love_apps'), where('person2.uid', '==', this.uid));

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      let coupleDoc = null;
      if (!snap1.empty) coupleDoc = snap1.docs[0];
      else if (!snap2.empty) coupleDoc = snap2.docs[0];

      if (coupleDoc) {
        this.coupleId = coupleDoc.id;
        this.listenCouple();
      } else {
        this.showLanding();
      }
    } catch (e) {
      console.error('Lỗi check couple:', e);
      window.showToast('Lỗi kết nối!', 'error');
    }
  }

  // ========== LANDING PAGE ==========
  showLanding() {
    document.getElementById('love-status').style.display = 'none';
    document.getElementById('love-tabs').style.display = 'none';
    document.getElementById('love-content').innerHTML = `
      <div style="max-width:400px;margin:40px auto;text-align:center;animation:fadeUp 0.6s ease both">
        <div style="font-size:64px;margin-bottom:12px">💝</div>
        <div style="font-size:22px;font-weight:500;color:#fce7f3;margin-bottom:6px">Love App</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:32px">Kết nối trái tim, lưu giữ kỷ niệm</div>

        <div style="display:flex;flex-direction:column;gap:12px">
          <button id="btn-create" style="padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#f472b6,#ec4899);color:#fff;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:15px;cursor:pointer;transition:all 0.2s">
            💕 Tạo hồ sơ & Mời người ấy
          </button>
          <button id="btn-join" style="padding:14px;border-radius:14px;border:1px solid rgba(244,114,182,0.4);background:rgba(244,114,182,0.08);color:#f9a8d4;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:15px;cursor:pointer;transition:all 0.2s">
            🔗 Nhập mã mời
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-create').addEventListener('click', () => this.createCouple());
    document.getElementById('btn-join').addEventListener('click', () => this.showJoinForm());
  }

  // ========== TẠO HỒ SƠ (TỰ LẤY TÊN) ==========
  async createCouple() {
    const myName = this.getUserName();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const coupleData = {
      person1: { uid: this.uid, name: myName },
      person2: null,
      startDate: null,           // Set sau khi cả 2 join
      inviteCode: inviteCode,
      timeline: [],
      wishlist: [],
      createdAt: new Date().toISOString(),
      createdBy: this.uid
    };

    try {
      const coupleRef = doc(collection(db, 'love_apps'));
      await setDoc(coupleRef, coupleData);
      this.coupleId = coupleRef.id;

      document.getElementById('love-content').innerHTML = `
        <div style="max-width:400px;margin:30px auto;padding:28px 20px;border-radius:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(52,211,153,0.3);text-align:center;animation:fadeUp 0.4s ease both">
          <div style="font-size:48px;margin-bottom:12px">🎉</div>
          <div style="font-size:18px;font-weight:500;color:#fce7f3;margin-bottom:6px">Hồ sơ đã được tạo!</div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:16px">Gửi mã này cho người ấy để kết đôi</div>
          <div style="font-size:36px;font-weight:500;color:#34d399;letter-spacing:8px;padding:14px;background:rgba(52,211,153,0.1);border:2px dashed rgba(52,211,153,0.4);border-radius:14px;margin-bottom:16px;user-select:all;cursor:pointer" id="invite-code-display">${inviteCode}</div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:20px">👆 Bấm vào mã để copy</div>
          <button id="btn-goto-app" style="width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#34d399,#059669);color:#fff;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:14px;cursor:pointer">💝 Vào App</button>
        </div>
      `;

      document.getElementById('invite-code-display').addEventListener('click', () => {
        navigator.clipboard.writeText(inviteCode).then(() => {
          window.showToast('Đã copy mã mời! 📋', 'success');
        });
      });

      document.getElementById('btn-goto-app').addEventListener('click', () => {
        this.listenCouple();
      });

    } catch (e) {
      console.error('Lỗi tạo couple:', e);
      window.showToast('Lỗi tạo hồ sơ!', 'error');
    }
  }

  // ========== JOIN BẰNG MÃ MỜI ==========
  showJoinForm() {
    const myName = this.getUserName();

    document.getElementById('love-content').innerHTML = `
      <div style="max-width:400px;margin:30px auto;padding:28px 20px;border-radius:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(244,114,182,0.2);animation:fadeUp 0.4s ease both">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
          <button id="btn-back-landing" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px">←</button>
          <div style="font-size:18px;font-weight:500;color:#fce7f3">Nhập mã mời</div>
        </div>

        <div style="padding:12px;border-radius:10px;background:rgba(244,114,182,0.05);border:1px solid rgba(244,114,182,0.15);margin-bottom:14px;text-align:center">
          <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">Bạn sẽ kết đôi với tên</div>
          <div style="font-size:16px;font-weight:500;color:#fce7f3">${myName}</div>
        </div>

        <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;font-weight:700">Mã mời (6 ký tự)</label>
        <input id="join-code" placeholder="VD: ABC123" maxlength="6" style="width:100%;padding:11px 14px;border-radius:10px;border:1px solid rgba(244,114,182,0.3);background:rgba(244,114,182,0.05);color:#e0f2fe;font-family:'Science Gothic',sans-serif;font-size:18px;text-align:center;letter-spacing:8px;text-transform:uppercase;margin-bottom:20px;outline:none">

        <button id="btn-submit-join" style="width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#f472b6,#ec4899);color:#fff;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:14px;cursor:pointer">💝 Kết đôi ngay</button>
      </div>
    `;

    document.getElementById('btn-back-landing').addEventListener('click', () => this.showLanding());
    document.getElementById('btn-submit-join').addEventListener('click', () => this.joinCouple());
  }

  async joinCouple() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();

    if (!code) {
      window.showToast('Vui lòng nhập mã mời! 🥺', 'warn');
      return;
    }

    if (code.length !== 6) {
      window.showToast('Mã mời phải có 6 ký tự!', 'warn');
      return;
    }

    try {
      const q = query(collection(db, 'love_apps'), where('inviteCode', '==', code));
      const snap = await getDocs(q);

      if (snap.empty) {
        window.showToast('Không tìm thấy mã mời này! 🔍', 'error');
        return;
      }

      const coupleDoc = snap.docs[0];
      const coupleData = coupleDoc.data();

      if (coupleData.person2) {
        window.showToast('Mã mời này đã có người join rồi! 💔', 'error');
        return;
      }

      if (coupleData.person1.uid === this.uid) {
        window.showToast('Bạn không thể tự kết đôi với chính mình! 😅', 'warn');
        return;
      }

      const myName = this.getUserName();
      await updateDoc(doc(db, 'love_apps', coupleDoc.id), {
        person2: { uid: this.uid, name: myName }
      });

      this.coupleId = coupleDoc.id;
      window.showToast('Kết đôi thành công! 💕🎉', 'success');
      this.listenCouple();

    } catch (e) {
      console.error('Lỗi join couple:', e);
      window.showToast('Lỗi kết nối!', 'error');
    }
  }

  // ========== LẮNG NGHE COUPLE REALTIME ==========
  listenCouple() {
    if (!this.coupleId) return;

    document.getElementById('love-status').style.display = '';
    document.getElementById('love-tabs').style.display = '';

    const loveRef = doc(db, 'love_apps', this.coupleId);

    if (this.unsubFirestore) this.unsubFirestore();

    this.unsubFirestore = onSnapshot(loveRef, (snap) => {
      if (!snap.exists()) {
        window.showToast('Hồ sơ không tồn tại!', 'error');
        return;
      }

      this.data = snap.data();
      this.data._loaded = true;

      // Chưa có person2 → chờ
      if (!this.data.person2) {
        this.showWaitingForPartner();
        return;
      }

      // Có đủ 2 người nhưng chưa set ngày yêu → hiện form set ngày
      if (!this.data.startDate) {
        this.showSetDate();
        return;
      }

      // Đầy đủ → render app
      this.renderAll();
      this.bindTabs();
    });
  }

  showWaitingForPartner() {
    document.getElementById('love-content').innerHTML = `
      <div style="max-width:400px;margin:30px auto;text-align:center;animation:fadeUp 0.4s ease both">
        <div style="font-size:48px;margin-bottom:12px">⏳</div>
        <div style="font-size:18px;font-weight:500;color:#fce7f3;margin-bottom:6px">Đang chờ người ấy...</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:16px">Hãy gửi mã mời cho người ấy để kết đôi</div>
        <div style="font-size:28px;font-weight:500;color:#34d399;letter-spacing:6px;padding:12px;background:rgba(52,211,153,0.1);border:2px dashed rgba(52,211,153,0.4);border-radius:12px;margin-bottom:12px;user-select:all;cursor:pointer" id="invite-code-waiting">${this.data.inviteCode}</div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:16px">👆 Bấm vào mã để copy</div>
        <button id="btn-cancel-couple" style="padding:10px 20px;border-radius:10px;border:1px solid rgba(248,113,113,0.3);background:rgba(248,113,113,0.08);color:#f87171;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:12px;cursor:pointer">🗑 Hủy hồ sơ</button>
      </div>
    `;

    document.getElementById('invite-code-waiting').addEventListener('click', () => {
      navigator.clipboard.writeText(this.data.inviteCode).then(() => {
        window.showToast('Đã copy mã mời! 📋', 'success');
      });
    });

    document.getElementById('btn-cancel-couple').addEventListener('click', async () => {
      if (!confirm('Bạn có chắc muốn hủy hồ sơ này?')) return;
      try {
        await updateDoc(doc(db, 'love_apps', this.coupleId), { person2: null });
      } catch (e) {
        console.error(e);
      }
      this.coupleId = null;
      if (this.unsubFirestore) this.unsubFirestore();
      this.showLanding();
    });
  }

  // ========== FORM SET NGÀY YÊU ==========
  showSetDate() {
    document.getElementById('love-content').innerHTML = `
      <div style="max-width:400px;margin:30px auto;padding:28px 20px;border-radius:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(244,114,182,0.2);text-align:center;animation:fadeUp 0.4s ease both">
        <div style="font-size:48px;margin-bottom:12px">💕</div>
        <div style="font-size:18px;font-weight:500;color:#fce7f3;margin-bottom:6px">Đã kết đôi thành công!</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:20px">Hãy chọn ngày bắt đầu yêu nhau</div>

        <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;font-weight:700;text-align:left">Ngày bắt đầu yêu</label>
        <input id="set-start-date" type="date" style="width:100%;padding:11px 14px;border-radius:10px;border:1px solid rgba(244,114,182,0.3);background:rgba(244,114,182,0.05);color:#e0f2fe;font-family:'Science Gothic',sans-serif;font-size:14px;margin-bottom:16px;outline:none">

        <button id="btn-set-date" style="width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#f472b6,#ec4899);color:#fff;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:14px;cursor:pointer">💝 Lưu ngày yêu</button>
        <button id="btn-skip-date" style="width:100%;padding:10px;margin-top:8px;background:none;border:none;color:#94a3b8;font-family:'Science Gothic',sans-serif;font-size:12px;cursor:pointer">Để sau</button>
      </div>
    `;

    document.getElementById('btn-set-date').addEventListener('click', async () => {
      const date = document.getElementById('set-start-date').value;
      if (!date) return window.showToast('Vui lòng chọn ngày!', 'warn');
      const loveRef = doc(db, 'love_apps', this.coupleId);
      await updateDoc(loveRef, { startDate: date });
      window.showToast('Đã lưu ngày yêu! 💕', 'success');
    });

    document.getElementById('btn-skip-date').addEventListener('click', () => {
      // Vẫn render app bình thường, startDate = null
      this.renderAll();
      this.bindTabs();
    });
  }

  // ========== RENDER ALL ==========
  renderAll() {
    this.renderStatusBar();
    if (this.currentTab) this.renderTab(this.currentTab);
  }

  // ========== STATUS BAR ==========
  renderStatusBar() {
    if (!this.data?._loaded || !this.data.person2) return;

    const p1 = this.data.person1?.name || '?';
    const p2 = this.data.person2?.name || '?';
    const startDate = this.data.startDate;
    const days = this.getDaysSince(startDate);

    document.getElementById('love-left').textContent = `💝 ${p1}`;
    document.getElementById('love-mid').textContent = startDate ? 'ĐÃ YÊU NHAU' : 'ĐÃ KẾT ĐÔI';
    document.getElementById('love-sub').textContent = startDate ? `${days} ngày` : 'Chưa set ngày';
    document.getElementById('love-right').textContent = `${p2} ♥`;

    const statusEl = document.getElementById('love-status');
    statusEl.className = 'bc-status cat-may_man';
  }

  getDaysSince(dateStr) {
    if (!dateStr) return 0;
    const start = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  }

  // ========== TABS ==========
  bindTabs() {
    document.querySelectorAll('.love-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.love-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderTab(tab.dataset.tab);
      });
    });
  }

  renderTab(tab) {
    if (!this.data?._loaded) return;
    this.currentTab = tab;
    const content = document.getElementById('love-content');

    switch (tab) {
      case 'home': content.innerHTML = this.renderHome(); break;
      case 'timeline': content.innerHTML = this.renderTimeline(); this.bindTimeline(); break;
      case 'quiz': content.innerHTML = this.renderQuiz(); this.bindQuiz(); break;
      case 'wishlist': content.innerHTML = this.renderWishlist(); this.bindWishlist(); break;
      case 'game': content.innerHTML = this.renderGame(); this.bindGame(); break;
    }
  }

  // ========== HOME ==========
  renderHome() {
    const p1 = this.data.person1?.name || '?';
    const p2 = this.data.person2?.name || '?';
    const startDate = this.data.startDate;
    const days = this.getDaysSince(startDate);
    const nextMilestone = startDate ? this.getNextMilestone(days) : null;

    return `
      <div class="love-home">
        <div class="love-couple-card">
          <div class="love-avatars">
            <div class="love-avatar">${p1[0] || '?'}</div>
            <span class="love-heart-big">💕</span>
            <div class="love-avatar">${p2[0] || '?'}</div>
          </div>
          <div class="love-couple-names">${p1} & ${p2}</div>
          ${startDate ? `
            <div class="love-days-count">${days}</div>
            <div class="love-days-label">ngày yêu thương</div>
            ${nextMilestone ? `<div class="love-next-milestone">🎯 Còn ${nextMilestone.daysLeft} ngày đến ${nextMilestone.label}</div>` : ''}
          ` : `
            <div style="padding:12px;margin:10px 0;border-radius:10px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2)">
              <button onclick="window.loveApp.openSetDate()" style="background:none;border:none;color:#fbbf24;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:13px;cursor:pointer">📅 Set ngày yêu ngay</button>
            </div>
          `}

          <div style="margin-top:12px">
            <button class="love-td-btn truth" onclick="window.loveApp.leaveCouple()" style="font-size:11px;padding:6px 14px">🚪 Rời</button>
          </div>
        </div>
      </div>
    `;
  }

  openSetDate() {
    this.showSetDate();
  }

  async leaveCouple() {
    if (!confirm('Bạn có chắc muốn rời khỏi hồ sơ này?')) return;
    const loveRef = doc(db, 'love_apps', this.coupleId);

    if (this.data.person1?.uid === this.uid) {
      await updateDoc(loveRef, { person2: null });
    } else {
      await updateDoc(loveRef, { person2: null });
    }

    this.coupleId = null;
    if (this.unsubFirestore) this.unsubFirestore();
    this.showLanding();
  }

  getNextMilestone(days) {
    const milestones = [
      { d: 100, label: '💯 100 ngày' },
      { d: 200, label: '💕 200 ngày' },
      { d: 300, label: '💗 300 ngày' },
      { d: 365, label: '🎂 1 năm' },
      { d: 500, label: '💝 500 ngày' },
      { d: 730, label: '💎 2 năm' },
      { d: 1000, label: '👑 1000 ngày' },
    ];
    for (const m of milestones) {
      if (days < m.d) return { ...m, daysLeft: m.d - days };
    }
    return null;
  }

  // ========== TIMELINE ==========
  renderTimeline() {
    const timeline = this.data.timeline || [];
    const sorted = [...timeline].sort((a, b) => new Date(b.date) - new Date(a.date));

    const items = sorted.map(item => `
      <div class="love-tl-item" data-id="${item.id}">
        <div class="love-tl-date">${this.formatDate(item.date)}</div>
        <div class="love-tl-title">${item.title}</div>
        <div class="love-tl-desc">${item.desc || ''}</div>
        <div style="margin-top:8px;display:flex;gap:6px">
          <button class="love-tl-edit" data-id="${item.id}" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(56,189,248,0.3);background:rgba(56,189,248,0.1);color:#38bdf8;font-size:10px;cursor:pointer;font-family:'Science Gothic',sans-serif">✏️</button>
          <button class="love-tl-del" data-id="${item.id}" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(248,113,113,0.3);background:rgba(248,113,113,0.1);color:#f87171;font-size:10px;cursor:pointer;font-family:'Science Gothic',sans-serif">🗑</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="love-timeline">
        <button id="add-milestone-btn" style="width:100%;padding:10px;border-radius:12px;border:1px dashed rgba(244,114,182,0.4);background:rgba(244,114,182,0.05);color:#f9a8d4;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:13px;cursor:pointer;margin-bottom:14px">➕ Thêm kỷ niệm</button>
        ${items || '<div style="text-align:center;color:#94a3b8;padding:20px">Chưa có kỷ niệm nào 💤</div>'}
      </div>
    `;
  }

  bindTimeline() {
    document.getElementById('add-milestone-btn')?.addEventListener('click', () => this.openMilestoneForm());
    document.querySelectorAll('.love-tl-edit').forEach(btn => {
      btn.addEventListener('click', () => this.openMilestoneForm(btn.dataset.id));
    });
    document.querySelectorAll('.love-tl-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Xóa kỷ niệm này?')) return;
        const id = btn.dataset.id;
        const timeline = (this.data.timeline || []).filter(item => item.id !== id);
        await updateDoc(doc(db, 'love_apps', this.coupleId), { timeline });
        window.showToast('Đã xóa!', 'info');
      });
    });
  }

  openMilestoneForm(editId = null) {
    const existing = editId ? (this.data.timeline || []).find(item => item.id === editId) : null;
    const overlay = document.createElement('div');
    overlay.className = 'love-td-overlay open';
    overlay.innerHTML = `
      <div class="love-td-box">
        <div style="font-size:20px;font-weight:800;color:#fce7f3;margin-bottom:14px">${existing ? '✏️ Sửa' : '➕ Thêm'} kỷ niệm</div>
        <input id="ml-title" placeholder="Tiêu đề" value="${existing?.title || ''}" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(244,114,182,0.3);background:rgba(244,114,182,0.05);color:#e0f2fe;font-family:'Science Gothic',sans-serif;font-size:13px;margin-bottom:8px;outline:none">
        <input id="ml-desc" placeholder="Mô tả" value="${existing?.desc || ''}" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(244,114,182,0.3);background:rgba(244,114,182,0.05);color:#e0f2fe;font-family:'Science Gothic',sans-serif;font-size:13px;margin-bottom:8px;outline:none">
        <label style="font-size:11px;color:#94a3b8;display:block;text-align:left;margin-bottom:4px">Ngày:</label>
        <input id="ml-date" type="date" value="${existing?.date || ''}" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(244,114,182,0.3);background:rgba(244,114,182,0.05);color:#e0f2fe;font-family:'Science Gothic',sans-serif;font-size:13px;margin-bottom:12px;outline:none">
        <button class="love-td-btn dare" id="save-milestone" style="width:100%">💾 Lưu</button>
        <button class="love-td-btn close" id="close-milestone" style="width:100%;margin-top:6px">Đóng</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#save-milestone').addEventListener('click', async () => {
      const title = overlay.querySelector('#ml-title').value.trim();
      const desc = overlay.querySelector('#ml-desc').value.trim();
      const date = overlay.querySelector('#ml-date').value;
      if (!title || !date) return window.showToast('Điền tiêu đề và ngày!', 'warn');

      let timeline = [...(this.data.timeline || [])];
      if (existing) {
        timeline = timeline.map(item =>
          item.id === editId ? { ...item, title, desc, date } : item
        );
      } else {
        timeline.push({ id: Date.now().toString(), title, desc, date, createdAt: new Date().toISOString() });
      }

      await updateDoc(doc(db, 'love_apps', this.coupleId), { timeline });
      window.showToast(existing ? 'Đã cập nhật!' : 'Đã thêm! 💕', 'success');
      overlay.remove();
    });
    overlay.querySelector('#close-milestone').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  // ========== QUIZ ==========
  renderQuiz() {
    const quiz = this.getDefaultQuiz();
    if (this.quizIndex >= quiz.length) {
      const pct = Math.round((this.quizScore / quiz.length) * 100);
      let msg = pct === 100 ? '🏆 100%!' : pct >= 80 ? '😍 Rất hiểu!' : pct >= 60 ? '😊 Khá hiểu!' : '🤔 Cần tìm hiểu thêm!';
      return `
        <div class="love-quiz">
          <div class="love-quiz-result">${msg}<br><span style="font-size:24px">${this.quizScore}/${quiz.length}</span></div>
          <button class="love-td-btn truth" onclick="window.loveApp.resetQuiz()" style="width:100%">🔄 Chơi lại</button>
        </div>
      `;
    }

    const q = quiz[this.quizIndex];
    this.quizAnswered = false;
    return `
      <div class="love-quiz">
        <div class="love-quiz-card">
          <div class="love-quiz-q">${this.quizIndex + 1}. ${q.question}</div>
          <div class="love-quiz-options" id="quiz-options">
            ${q.options.map((opt, i) => `<button class="love-quiz-opt" data-idx="${i}">${opt}</button>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  getDefaultQuiz() {
    return [
      { question: "Người ấy thích món gì nhất?", options: ["Phở", "Bún bò Huế", "Cơm tấm", "Hủ tiếu"], answer: 1 },
      { question: "Màu sắc yêu thích của người ấy?", options: ["Hồng", "Xanh dương", "Tím", "Trắng"], answer: 0 },
      { question: "Người ấy sinh năm bao nhiêu?", options: ["2000", "2001", "2002", "2003"], answer: 1 },
    ];
  }

  bindQuiz() {
    const quiz = this.getDefaultQuiz();
    if (this.quizIndex >= quiz.length) return;
    document.querySelectorAll('.love-quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.quizAnswered) return;
        this.quizAnswered = true;
        const idx = parseInt(btn.dataset.idx);
        const correct = quiz[this.quizIndex].answer;
        if (idx === correct) { btn.classList.add('correct'); this.quizScore++; window.showToast('Đúng! 💕', 'success'); }
        else { btn.classList.add('wrong'); document.querySelector(`.love-quiz-opt[data-idx="${correct}"]`).classList.add('correct'); window.showToast('Sai! 🥺', 'warn'); }
        document.querySelectorAll('.love-quiz-opt').forEach(b => b.style.pointerEvents = 'none');
        setTimeout(() => { this.quizIndex++; this.renderTab('quiz'); }, 2000);
      });
    });
  }

  resetQuiz() { this.quizIndex = 0; this.quizScore = 0; this.renderTab('quiz'); }

  // ========== WISHLIST ==========
  renderWishlist() {
    const items = this.data.wishlist || [];
    const list = items.map((item, i) => `
      <div class="love-wish-item ${item.done ? 'done-item' : ''}" data-idx="${i}">
        <div class="love-wish-check ${item.done ? 'done' : ''}">${item.done ? '✓' : ''}</div>
        <span class="love-wish-text">${item.text}</span>
        <button class="love-wish-del" data-idx="${i}" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:14px;opacity:0.6">✕</button>
      </div>
    `).join('');

    return `
      <div class="love-wishlist">
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input id="new-wish" placeholder="Thêm điều muốn làm..." style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(52,211,153,0.3);background:rgba(52,211,153,0.05);color:#e0f2fe;font-family:'Science Gothic',sans-serif;font-size:13px;outline:none">
          <button id="add-wish-btn" style="padding:10px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#34d399,#059669);color:#fff;cursor:pointer;font-weight:700;font-family:'Science Gothic',sans-serif;font-size:13px">➕</button>
        </div>
        ${list || '<div style="text-align:center;color:#94a3b8;padding:20px">Chưa có mục nào</div>'}
      </div>
    `;
  }

  bindWishlist() {
    document.getElementById('add-wish-btn')?.addEventListener('click', async () => {
      const input = document.getElementById('new-wish');
      const text = input.value.trim();
      if (!text) return;
      const wishlist = [...(this.data.wishlist || []), { id: Date.now().toString(), text, done: false }];
      await updateDoc(doc(db, 'love_apps', this.coupleId), { wishlist });
      input.value = '';
    });

    document.querySelectorAll('.love-wish-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('love-wish-del')) return;
        const idx = parseInt(item.dataset.idx);
        const wishlist = [...(this.data.wishlist || [])];
        wishlist[idx].done = !wishlist[idx].done;
        await updateDoc(doc(db, 'love_apps', this.coupleId), { wishlist });
      });
    });

    document.querySelectorAll('.love-wish-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const wishlist = (this.data.wishlist || []).filter((_, i) => i !== idx);
        await updateDoc(doc(db, 'love_apps', this.coupleId), { wishlist });
      });
    });
  }

  // ========== GAME ==========
  renderGame() {
    return `
      <div class="love-game">
        <div class="love-game-card" id="game-truth-dare">
          <div class="love-game-icon">🎭</div>
          <div class="love-game-title">Truth or Dare</div>
          <div class="love-game-desc">Thử thách vui nhộn cho cặp đôi</div>
        </div>
        <div class="love-game-card" id="game-spin">
          <div class="love-game-icon">🎡</div>
          <div class="love-game-title">Vòng quay hẹn hò</div>
          <div class="love-game-desc">Quay để chọn địa điểm hẹn hò tiếp theo!</div>
        </div>
      </div>
    `;
  }

  bindGame() {
    document.getElementById('game-truth-dare')?.addEventListener('click', () => this.openTruthOrDare());
    document.getElementById('game-spin')?.addEventListener('click', () => this.spinDate());
  }

  openTruthOrDare() {
    const truth = ["Lần đầu bạn biết mình thích đối phương là khi nào?", "Điều gì ở đối phương khiến bạn cười nhiều nhất?", "Khoảnh khắc nào bên nhau bạn nhớ nhất?", "Bạn đã từng mơ về đối phương chưa?", "Điều gì bạn muốn nói với đối phương nhất lúc này?"];
    const dare = ["Gọi điện nói 'Em yêu anh/chị' 3 lần", "Chụp ảnh mặt xấu gửi cho đối phương", "Nhắn tin 'Nhớ em/anh quá'", "Hát bài cả hai cùng thích", "Kể kỷ niệm xấu hổ của bản thân"];

    const overlay = document.createElement('div');
    overlay.className = 'love-td-overlay open';
    overlay.innerHTML = `
      <div class="love-td-box">
        <div class="love-td-text">Chọn Truth hay Dare? 😈</div>
        <div class="love-td-btns">
          <button class="love-td-btn truth" id="td-truth">🟢 Truth</button>
          <button class="love-td-btn dare" id="td-dare">🔴 Dare</button>
        </div>
        <button class="love-td-btn close" id="td-close" style="margin-top:10px">Đóng</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const showResult = (arr, type) => {
      const item = arr[Math.floor(Math.random() * arr.length)];
      const color = type === 'truth' ? '#38bdf8' : '#f472b6';
      overlay.querySelector('.love-td-box').innerHTML = `
        <div class="love-td-text" style="color:${color};font-size:18px">${type === 'truth' ? '🟢 Truth:' : '🔴 Dare:'}<br><br>${item}</div>
        <button class="love-td-btn close" id="td-again" style="margin-top:10px">🔄 Làm lại</button>
        <button class="love-td-btn close" id="td-close2" style="margin-top:10px">Đóng</button>
      `;
      overlay.querySelector('#td-again')?.addEventListener('click', () => { overlay.remove(); this.openTruthOrDare(); });
      overlay.querySelector('#td-close2')?.addEventListener('click', () => overlay.remove());
    };

    overlay.querySelector('#td-truth').addEventListener('click', () => showResult(truth, 'truth'));
    overlay.querySelector('#td-dare').addEventListener('click', () => showResult(dare, 'dare'));
    overlay.querySelector('#td-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  spinDate() {
    const places = ['☕ Quán cà phê mèo', '🎬 Rạp phim', '🍜 Ăn lẩu', '🌸 Công viên', '🛍️ Shopping mall', '🎳 Bowling', '🍣 Sushi date', '🏖️ Biển', '🎨 Vẽ tranh couple', '🍦 Ăn kem', '📸 Chụp ảnh', '🏔️ Leo núi'];
    const overlay = document.createElement('div');
    overlay.className = 'love-td-overlay open';
    overlay.innerHTML = `
      <div class="love-td-box">
        <div class="love-td-text" style="font-size:40px" id="spin-result">🎡</div>
        <button class="love-td-btn dare" id="spin-btn" style="margin-top:10px">Quay! 🎰</button>
        <button class="love-td-btn close" id="spin-close" style="margin-top:10px">Đóng</button>
      </div>
    `;
    document.body.appendChild(overlay);
    let spinning = false;
    overlay.querySelector('#spin-btn').addEventListener('click', () => {
      if (spinning) return;
      spinning = true;
      const resultEl = overlay.querySelector('#spin-result');
      let count = 0;
      const interval = setInterval(() => { resultEl.textContent = places[Math.floor(Math.random() * places.length)]; count++; if (count > 15) { clearInterval(interval); resultEl.textContent = places[Math.floor(Math.random() * places.length)]; spinning = false; window.showToast(`Địa điểm: ${resultEl.textContent}`, 'success'); } }, 100);
    });
    overlay.querySelector('#spin-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }
}

new LoveApp();