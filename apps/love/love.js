// love.js — VTWorld Love App 💝 (Firestore + Kết đôi Online + Cây sinh lãi)
import { auth, db } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, collection, where, getDocs, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { addPoints } from '../../points.js';

class LoveApp {
  constructor() {
    this.uid = null;
    this.user = null;
    this.coupleId = null;
    this.data = null;
    this.currentTab = null;
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
    await this.loadMyProfile();
    await this.checkCouple();
  }

  async loadMyProfile() {
    if (this.myProfile) return this.myProfile;
    try {
      const snap = await getDoc(doc(db, 'users', this.uid));
      const d = snap.exists() ? snap.data() : {};
      this.myProfile = {
        name: d.nickname || this.user?.displayName || this.user?.email?.split('@')[0] || 'Người ấy',
        avatarUrl: d.avatarUrl || ''
      };
    } catch (e) {
      console.error(e);
      this.myProfile = { name: this.user?.displayName || this.user?.email?.split('@')[0] || 'Người ấy', avatarUrl: '' };
    }
    return this.myProfile;
  }

  // ========== CHECK COUPLE ==========
  async checkCouple() {
    try {
      await new Promise(r => setTimeout(r, 400));
      const q1 = query(collection(db, 'love_apps'), where('person1.uid', '==', this.uid));
      const q2 = query(collection(db, 'love_apps'), where('person2.uid', '==', this.uid));
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      let coupleDoc = null;
      if (!snap1.empty) {
        for (const d of snap1.docs) if (d.data().person1) { coupleDoc = d; break; }
      }
      if (!coupleDoc && !snap2.empty) {
        for (const d of snap2.docs) if (d.data().person1) { coupleDoc = d; break; }
      }
      if (coupleDoc) {
        this.coupleId = coupleDoc.id;
        this.listenCouple();
      } else {
        this.coupleId = null; this.data = null; this.showLanding();
      }
    } catch (e) {
      console.error(e); window.showToast('Lỗi kết nối!', 'error');
    }
  }

  cleanupListener() {
    if (this.unsubFirestore) { this.unsubFirestore(); this.unsubFirestore = null; }
  }

  getMySide() {
    return this.data?.person1?.uid === this.uid ? 'person1' : 'person2';
  }

  getOtherSide() {
    return this.getMySide() === 'person1' ? 'person2' : 'person1';
  }

  // ========== LANDING ==========
  showLanding() {
    this.cleanupListener(); this.coupleId = null; this.data = null;
    window.TopNav?.setMenuActions([]);
    document.getElementById('love-status').style.display = 'none';
    document.getElementById('love-tabs').style.display = 'none';
    document.getElementById('love-content').innerHTML = `
      <div style="max-width:400px;margin:40px auto;text-align:center;animation:fadeUp 0.6s ease both">
        <div style="font-size:64px;margin-bottom:12px">💝</div>
        <div style="font-size:22px;font-weight:500;color:#fce7f3;margin-bottom:6px">Love App</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:32px">Kết nối trái tim, lưu giữ kỷ niệm</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <button id="btn-create" style="padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#f472b6,#ec4899);color:#fff;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:15px;cursor:pointer">💕 Tạo hồ sơ & Mời người ấy</button>
          <button id="btn-join" style="padding:14px;border-radius:14px;border:1px solid rgba(244,114,182,0.4);background:rgba(244,114,182,0.08);color:#f9a8d4;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:15px;cursor:pointer">🔗 Nhập mã mời</button>
        </div>
      </div>
    `;
    document.getElementById('btn-create').addEventListener('click', () => this.createCouple());
    document.getElementById('btn-join').addEventListener('click', () => this.showJoinForm());
  }

  // ========== TẠO HỒ SƠ ==========
  async createCouple() {
    const { name: myName, avatarUrl: myAvatar } = await this.loadMyProfile();
    const inviteCode = String(Math.floor(1000 + Math.random() * 9000));
    const coupleData = {
      person1: { uid: this.uid, name: myName, avatarUrl: myAvatar },
      person2: null,
      startDate: "",
      inviteCode,
      timeline: [],
      wishlist: [],
      diary: [],
      extraDays: 0,
      waterLog: {},
      fertilizerLog: {},
      harvestLog: {},
      lastRewardedLevel: 0,
      treesPlanted: 0,
      quiz: {
        person1: { questions: [], locked: false, result: null },
        person2: { questions: [], locked: false, result: null }
      },
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
        navigator.clipboard.writeText(inviteCode).then(() => window.showToast('Đã copy mã mời! 📋', 'success'));
      });
      document.getElementById('btn-goto-app').addEventListener('click', () => this.listenCouple());
    } catch (e) { console.error(e); window.showToast('Lỗi tạo hồ sơ!', 'error'); }
  }

  // ========== JOIN ==========
  async showJoinForm() {
    const { name: myName } = await this.loadMyProfile();
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
        <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;font-weight:700">Mã mời (4 số)</label>
        <input id="join-code" placeholder="VD: 1234" maxlength="4" style="width:100%;padding:11px 14px;border-radius:10px;border:1px solid rgba(244,114,182,0.3);background:rgba(244,114,182,0.05);color:#e0f2fe;font-family:'Science Gothic',sans-serif;font-size:18px;text-align:center;letter-spacing:8px;margin-bottom:20px;outline:none">
        <button id="btn-submit-join" style="width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#f472b6,#ec4899);color:#fff;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:14px;cursor:pointer">💝 Kết đôi ngay</button>
      </div>
    `;
    document.getElementById('btn-back-landing').addEventListener('click', () => this.showLanding());
    document.getElementById('btn-submit-join').addEventListener('click', () => this.joinCouple());
  }

  async joinCouple() {
    const code = document.getElementById('join-code').value.trim();
    if (!code || code.length !== 4) { window.showToast('Mã mời không hợp lệ!', 'warn'); return; }
    try {
      const q = query(collection(db, 'love_apps'), where('inviteCode', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) { window.showToast('Không tìm thấy mã mời!', 'error'); return; }
      const coupleDoc = snap.docs[0];
      const coupleData = coupleDoc.data();
      if (coupleData.person2) { window.showToast('Mã mời đã có người join!', 'error'); return; }
      if (coupleData.person1.uid === this.uid) { window.showToast('Không thể tự kết đôi!', 'warn'); return; }
      const { name: myName, avatarUrl: myAvatar } = await this.loadMyProfile();
      await updateDoc(doc(db, 'love_apps', coupleDoc.id), {
        person2: { uid: this.uid, name: myName, avatarUrl: myAvatar }
      });
      this.coupleId = coupleDoc.id;
      window.showToast('Kết đôi thành công! 💕🎉', 'success');
      this.listenCouple();
    } catch (e) { console.error(e); window.showToast('Lỗi kết nối!', 'error'); }
  }

  // ========== LISTEN REALTIME ==========
  listenCouple() {
    if (!this.coupleId) return;
    document.getElementById('love-status').style.display = '';
    document.getElementById('love-tabs').style.display = '';
    window.TopNav?.setMenuActions([{ icon: '💔', label: 'Xoá mối quan hệ', onClick: () => this.confirmDeleteRelationship() }]);
    const loveRef = doc(db, 'love_apps', this.coupleId);
    this.cleanupListener();
    this.unsubFirestore = onSnapshot(loveRef, (snap) => {
      if (!snap.exists()) {
        window.showToast('Hồ sơ không tồn tại!', 'error');
        this.cleanupListener(); this.coupleId = null; this.data = null; this.showLanding();
        return;
      }
      this.data = snap.data();
      this.data._loaded = true;
      this.syncMyProfileToCouple();
      if (!this.data.person2) { this.showWaitingForPartner(); return; }
      if (!this.data.startDate) { this.showSetDate(); return; }
      this.renderAll();
      this.bindTabs();
    });
  }

  async syncMyProfileToCouple() {
    if (!this.coupleId || !this.data) return;
    const myKey = this.data.person1?.uid === this.uid ? 'person1' : (this.data.person2?.uid === this.uid ? 'person2' : null);
    if (!myKey) return;
    const { name, avatarUrl } = await this.loadMyProfile();
    const current = this.data[myKey] || {};
    if (current.name === name && (current.avatarUrl || '') === avatarUrl) return;
    try {
      await updateDoc(doc(db, 'love_apps', this.coupleId), {
        [`${myKey}.name`]: name,
        [`${myKey}.avatarUrl`]: avatarUrl
      });
    } catch (e) { console.error(e); }
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
      navigator.clipboard.writeText(this.data.inviteCode).then(() => window.showToast('Đã copy mã mời! 📋', 'success'));
    });
    document.getElementById('btn-cancel-couple').addEventListener('click', async () => {
      if (!confirm('Bạn có chắc muốn hủy hồ sơ này?')) return;
      const idToDelete = this.coupleId;
      try {
        this.cleanupListener(); this.coupleId = null; this.data = null;
        await deleteDoc(doc(db, 'love_apps', idToDelete));
        window.showToast('Đã hủy hồ sơ!', 'info');
      } catch (e) { console.error(e); window.showToast('Lỗi hủy hồ sơ!', 'error'); }
      this.showLanding();
    });
  }

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
      await updateDoc(doc(db, 'love_apps', this.coupleId), { startDate: date });
      window.showToast('Đã lưu ngày yêu! 💕', 'success');
    });
    document.getElementById('btn-skip-date').addEventListener('click', () => { this.renderAll(); this.bindTabs(); });
  }

  // ========== RENDER ALL ==========
  renderAll() {
    this.renderStatusBar();
    if (this.currentTab) this.renderTab(this.currentTab);
    this.updateTabIndicator();
  }

  renderStatusBar() {
    if (!this.data?._loaded || !this.data.person2) return;
    const p1 = this.data.person1?.name || '?';
    const p2 = this.data.person2?.name || '?';
    const startDate = this.data.startDate;
    const days = this.getDaysSince(startDate);
    document.getElementById('love-left').textContent = `${p1}`;
    document.getElementById('love-mid').textContent = startDate ? `${days}` : 'Chưa yêu';
    document.getElementById('love-sub').textContent = startDate ? (days === 1 ? 'day' : 'days') : 'Chưa set ngày';
    document.getElementById('love-right').textContent = `${p2}`;
    document.getElementById('love-status').className = 'bc-status cat-love';
  }

  getDaysSince(dateStr) {
    if (!dateStr) return 0;
    return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
  }

  // ========== TABS & INDICATOR ==========
  bindTabs() {
    const tabs = document.querySelectorAll('.love-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderTab(tab.dataset.tab);
        this.updateTabIndicator();
        this.showContentView();
      });
    });
    const backBtn = document.getElementById('love-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.showLobbyView());
    this.updateTabIndicator();
  }

  showContentView() {
    const lobby = document.getElementById('love-tabs');
    const content = document.getElementById('love-content');
    const backBtn = document.getElementById('love-back-btn');
    if (lobby) lobby.style.display = 'none';
    if (content) content.style.display = '';
    if (backBtn) backBtn.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showLobbyView() {
    const lobby = document.getElementById('love-tabs');
    const content = document.getElementById('love-content');
    const backBtn = document.getElementById('love-back-btn');
    if (lobby) lobby.style.display = '';
    if (content) content.style.display = 'none';
    if (backBtn) backBtn.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateTabIndicator() {
    const activeTab = document.querySelector('.love-tab.active');
    const indicator = document.querySelector('.love-tab-indicator');
    if (!activeTab || !indicator) return;
    const container = document.getElementById('love-tabs');
    const containerRect = container.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    indicator.style.left = (tabRect.left - containerRect.left) + 'px';
    indicator.style.width = tabRect.width + 'px';
  }

  renderTab(tab) {
    if (!this.data?._loaded) return;
    this.currentTab = tab;
    const content = document.getElementById('love-content');
    switch (tab) {
      case 'home': content.innerHTML = this.renderHome(); break;
      case 'timeline': content.innerHTML = this.renderTimeline(); this.bindTimeline(); break;
      case 'wishlist': content.innerHTML = this.renderWishlist(); this.bindWishlist(); break;
      case 'diary': content.innerHTML = this.renderDiary(); this.bindDiary(); break;
      case 'interact': content.innerHTML = this.renderInteract(); this.bindInteract(); break;
      case 'quiz': content.innerHTML = this.renderQuiz(); this.bindQuiz(); break;
      case 'tree': content.innerHTML = this.renderTree(); this.bindTree(); break;
    }
    this.updateTabIndicator();
  }

  // ========== HOME ==========
  renderHome() {
    const p1 = this.data.person1?.name || '?';
    const p2 = this.data.person2?.name || '?';
    const p1Avatar = this.data.person1?.avatarUrl || '';
    const p2Avatar = this.data.person2?.avatarUrl || '';
    const startDate = this.data.startDate;
    const days = this.getDaysSince(startDate);
    const nextMilestone = startDate ? this.getNextMilestone(days) : null;
    return `
      <div class="love-home">
        <div class="love-couple-card">
          <div class="love-avatars">
            <div class="love-avatar" style="${p1Avatar ? `background-image:url(${p1Avatar});background-size:cover;background-position:center` : ''}">${p1Avatar ? '' : (p1[0] || '?')}</div>
            <span class="love-heart-big">💕</span>
            <div class="love-avatar" style="${p2Avatar ? `background-image:url(${p2Avatar});background-size:cover;background-position:center` : ''}">${p2Avatar ? '' : (p2[0] || '?')}</div>
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
            <button class="love-td-btn dare" onclick="window.loveApp.confirmDeleteRelationship()" style="font-size:11px;padding:6px 14px">💔 Xoá mối quan hệ</button>
          </div>
        </div>
      </div>
    `;
  }

  openSetDate() { this.showSetDate(); }

  async leaveCouple() {
    const isPerson1 = this.data.person1?.uid === this.uid;
    if (isPerson1) {
      const idToDelete = this.coupleId;
      try {
        this.cleanupListener(); this.coupleId = null; this.data = null;
        await deleteDoc(doc(db, 'love_apps', idToDelete));
        window.showToast('Đã xóa hồ sơ!', 'info');
      } catch (e) { console.error(e); }
    } else {
      try {
        await updateDoc(doc(db, 'love_apps', this.coupleId), { person2: null });
        window.showToast('Đã rời khỏi hồ sơ!', 'info');
      } catch (e) { console.error(e); }
      this.cleanupListener(); this.coupleId = null; this.data = null;
    }
    this.showLanding();
  }

  confirmDeleteRelationship() {
    const overlay = document.createElement('div');
    overlay.className = 'love-td-overlay open';
    overlay.innerHTML = `
      <div class="love-td-box">
        <div style="font-size:20px;font-weight:800;color:#fce7f3;margin-bottom:10px">⚠️ Xoá mối quan hệ</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:18px;text-align:left">Toàn bộ kỷ niệm, nhật ký, wishlist và cây tình yêu sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.</div>
        <button class="love-td-btn dare" id="confirm-delete-rel" style="width:100%">🗑 Xác nhận xoá</button>
        <button class="love-td-btn close" id="cancel-delete-rel" style="width:100%;margin-top:6px">Huỷ</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirm-delete-rel').addEventListener('click', () => { overlay.remove(); this.leaveCouple(); });
    overlay.querySelector('#cancel-delete-rel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  getNextMilestone(days) {
    const milestones = [
      { d: 100, label: '💯 100 ngày' }, { d: 200, label: '💕 200 ngày' },
      { d: 300, label: '💗 300 ngày' }, { d: 365, label: '🎂 1 năm' },
      { d: 500, label: '💝 500 ngày' }, { d: 730, label: '💎 2 năm' },
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
    document.querySelectorAll('.love-tl-edit').forEach(btn => btn.addEventListener('click', () => this.openMilestoneForm(btn.dataset.id)));
    document.querySelectorAll('.love-tl-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Xóa kỷ niệm này?')) return;
        const timeline = (this.data.timeline || []).filter(item => item.id !== btn.dataset.id);
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
        timeline = timeline.map(item => item.id === editId ? { ...item, title, desc, date } : item);
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

  // ========== DIARY ==========
  renderDiary() {
    const diary = this.data.diary || [];
    const today = new Date().toDateString();
    const myUid = this.uid;
    const myTodayEntries = diary.filter(e => e.uid === myUid && new Date(e.createdAt).toDateString() === today);
    const remaining = 2 - myTodayEntries.length;
    const sorted = [...diary].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const entriesHtml = sorted.map(entry => {
      const entryDate = new Date(entry.createdAt);
      const dateStr = entryDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = entryDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="diary-entry">
          <div class="diary-header">
            <span class="diary-author">${entry.name}</span>
            <span class="diary-time">${dateStr} ${timeStr}</span>
          </div>
          <div class="diary-text">${this.escapeHtml(entry.text)}</div>
        </div>
      `;
    }).join('');
    return `
      <div class="love-diary">
        <div class="diary-input-area">
          <textarea id="diary-input" placeholder="Hôm nay bạn muốn nói gì với người ấy? (Còn ${remaining}/2 bài)" maxlength="500" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(244,114,182,0.3);background:rgba(244,114,182,0.05);color:#e0f2fe;font-family:'Science Gothic',sans-serif;font-size:14px;resize:vertical;min-height:80px;outline:none" ${remaining <= 0 ? 'disabled' : ''}></textarea>
          <button id="btn-post-diary" style="margin-top:8px;padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#f472b6,#ec4899);color:#fff;font-family:'Science Gothic',sans-serif;font-weight:500;font-size:13px;cursor:pointer" ${remaining <= 0 ? 'disabled' : ''}>📝 Viết nhật ký</button>
          ${remaining <= 0 ? '<p style="font-size:11px;color:#fbbf24;margin-top:6px">⚠️ Bạn đã viết đủ 2 bài hôm nay</p>' : ''}
        </div>
        <div class="diary-list" style="margin-top:16px;">
          ${entriesHtml || '<div style="text-align:center;color:#94a3b8;padding:20px">Chưa có dòng nhật ký nào</div>'}
        </div>
      </div>
    `;
  }

  bindDiary() {
    const postBtn = document.getElementById('btn-post-diary');
    const input = document.getElementById('diary-input');
    if (postBtn) {
      postBtn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) return;
        const diary = [...(this.data.diary || [])];
        diary.push({
          id: Date.now().toString(),
          uid: this.uid,
          name: this.data.person1.uid === this.uid ? this.data.person1.name : this.data.person2.name,
          text: text,
          createdAt: new Date().toISOString()
        });
        await updateDoc(doc(db, 'love_apps', this.coupleId), { diary });
        input.value = '';
        window.showToast('Đã viết nhật ký! 💌', 'success');
      });
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== INTERACT ==========
  renderInteract() {
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

  bindInteract() {
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

  // ========== LOVE QUIZ (soạn câu hỏi, đủ 10 câu thành bài kiểm tra) ==========
  renderQuiz() {
    const mySide = this.getMySide();
    const otherSide = this.getOtherSide();
    const myQuiz = this.data.quiz?.[mySide] || { questions: [], locked: false, result: null };
    const otherQuiz = this.data.quiz?.[otherSide] || { questions: [], locked: false, result: null };
    const otherName = this.data[otherSide]?.name || 'Người ấy';

    const myCount = myQuiz.questions?.length || 0;
    const myStatusHtml = myQuiz.locked
      ? (myQuiz.result
          ? `<div class="love-quiz-status done">✅ ${this.escapeHtml(otherName)} đã làm bài — đúng ${myQuiz.result.score}/${myQuiz.result.total}</div>`
          : `<div class="love-quiz-status waiting">🔒 Đã khoá — đang chờ ${this.escapeHtml(otherName)} làm bài</div>`)
      : `<div class="love-quiz-status">📝 ${myCount}/10 câu đã soạn</div>`;

    const otherCount = otherQuiz.questions?.length || 0;
    let otherAction;
    if (!otherQuiz.locked) {
      otherAction = `<div class="love-quiz-status">⏳ ${this.escapeHtml(otherName)} đang soạn câu hỏi (${otherCount}/10)</div>`;
    } else if (!otherQuiz.result) {
      otherAction = `<button class="love-quiz-btn" id="btn-take-quiz">📝 Làm bài kiểm tra</button>`;
    } else {
      otherAction = `
        <div class="love-quiz-status done">✅ Bạn đúng ${otherQuiz.result.score}/${otherQuiz.result.total} câu</div>
        <button class="love-quiz-btn ghost" id="btn-review-quiz">👀 Xem lại</button>
      `;
    }

    return `
      <div class="love-quiz">
        <div class="love-quiz-card">
          <div class="love-quiz-title">💗 Quiz về bạn</div>
          <div class="love-quiz-sub">${this.escapeHtml(otherName)} sẽ làm bài kiểm tra để xem hiểu bạn đến đâu</div>
          ${myStatusHtml}
          <div class="love-quiz-actions">
            ${!myQuiz.locked
              ? `<button class="love-quiz-btn" id="btn-build-quiz">✏️ Soạn câu hỏi</button>`
              : `<button class="love-quiz-btn ghost" id="btn-reset-quiz">🔄 Soạn lại từ đầu</button>`}
          </div>
        </div>
        <div class="love-quiz-card">
          <div class="love-quiz-title">🧠 Quiz về ${this.escapeHtml(otherName)}</div>
          <div class="love-quiz-sub">Xem bạn hiểu ${this.escapeHtml(otherName)} đến đâu</div>
          <div class="love-quiz-actions">${otherAction}</div>
        </div>
      </div>
    `;
  }

  bindQuiz() {
    document.getElementById('btn-build-quiz')?.addEventListener('click', () => this.openQuizBuilder());
    document.getElementById('btn-reset-quiz')?.addEventListener('click', () => this.confirmResetQuiz());
    document.getElementById('btn-take-quiz')?.addEventListener('click', () => this.openQuizTaker(false));
    document.getElementById('btn-review-quiz')?.addEventListener('click', () => this.openQuizTaker(true));
  }

  confirmResetQuiz() {
    const overlay = document.createElement('div');
    overlay.className = 'love-td-overlay open';
    overlay.innerHTML = `
      <div class="love-td-box">
        <div style="font-size:18px;font-weight:800;color:#fce7f3;margin-bottom:10px">⚠️ Soạn lại từ đầu?</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:18px;text-align:left">Toàn bộ câu hỏi và kết quả bài kiểm tra hiện tại sẽ bị xoá.</div>
        <button class="love-td-btn dare" id="confirm-reset-quiz" style="width:100%">🗑 Xác nhận</button>
        <button class="love-td-btn close" id="cancel-reset-quiz" style="width:100%;margin-top:6px">Huỷ</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirm-reset-quiz').addEventListener('click', async () => { overlay.remove(); await this.resetMyQuiz(); });
    overlay.querySelector('#cancel-reset-quiz').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  async resetMyQuiz() {
    const mySide = this.getMySide();
    try {
      await updateDoc(doc(db, 'love_apps', this.coupleId), {
        [`quiz.${mySide}.questions`]: [],
        [`quiz.${mySide}.locked`]: false,
        [`quiz.${mySide}.result`]: null
      });
      window.showToast('Đã xoá, soạn lại nhé! 📝', 'info');
    } catch (e) { console.error(e); }
  }

  openQuizBuilder() {
    const mySide = this.getMySide();
    let questions = [...(this.data.quiz?.[mySide]?.questions || [])];
    const overlay = document.createElement('div');
    overlay.className = 'love-td-overlay open';
    overlay.innerHTML = `<div class="love-td-box love-quiz-box"></div>`;
    document.body.appendChild(overlay);
    const box = overlay.querySelector('.love-td-box');

    const render = () => {
      const locked = questions.length >= 10;
      const listHtml = questions.map((item, i) => `
        <div class="love-quiz-q-item">
          <div class="love-quiz-q-text">${i + 1}. ${this.escapeHtml(item.q)}</div>
          <button class="love-quiz-q-del" data-idx="${i}">✕</button>
        </div>
      `).join('');
      box.innerHTML = `
        <div style="font-size:18px;font-weight:800;color:#fce7f3;margin-bottom:6px">✏️ Soạn câu hỏi về bạn (${questions.length}/10)</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:14px;text-align:left">Đủ 10 câu sẽ tự động khoá lại thành bài kiểm tra cho đối phương.</div>
        <div class="love-quiz-q-list">${listHtml || '<div style="font-size:12px;color:#94a3b8;padding:8px 0">Chưa có câu nào</div>'}</div>
        ${!locked ? `
          <div class="love-quiz-form">
            <input id="qz-question" class="love-quiz-input" placeholder="Câu hỏi (VD: Món ăn tôi thích nhất là gì?)" style="margin-bottom:8px">
            <input class="qz-opt love-quiz-input" data-i="0" placeholder="Đáp án A" style="margin-bottom:6px">
            <input class="qz-opt love-quiz-input" data-i="1" placeholder="Đáp án B" style="margin-bottom:6px">
            <input class="qz-opt love-quiz-input" data-i="2" placeholder="Đáp án C" style="margin-bottom:6px">
            <input class="qz-opt love-quiz-input" data-i="3" placeholder="Đáp án D" style="margin-bottom:10px">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;text-align:left">Chọn đáp án đúng:</div>
            <div class="love-quiz-radio-row">
              <label><input type="radio" name="qz-correct" value="0" checked> A</label>
              <label><input type="radio" name="qz-correct" value="1"> B</label>
              <label><input type="radio" name="qz-correct" value="2"> C</label>
              <label><input type="radio" name="qz-correct" value="3"> D</label>
            </div>
            <button class="love-td-btn dare" id="qz-add-btn" style="width:100%;margin-top:10px">➕ Thêm câu hỏi</button>
          </div>
        ` : `<div style="font-size:13px;color:#34d399;margin-top:10px">🔒 Đủ 10 câu, bài kiểm tra đã khoá!</div>`}
        <button class="love-td-btn close" id="qz-close-btn" style="width:100%;margin-top:10px">Đóng</button>
      `;
      box.querySelectorAll('.love-quiz-q-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.idx);
          questions = questions.filter((_, i) => i !== idx);
          render();
          try {
            await updateDoc(doc(db, 'love_apps', this.coupleId), {
              [`quiz.${mySide}.questions`]: questions,
              [`quiz.${mySide}.locked`]: false
            });
          } catch (e) { console.error(e); }
        });
      });
      document.getElementById('qz-add-btn')?.addEventListener('click', async () => {
        const qText = document.getElementById('qz-question').value.trim();
        const opts = Array.from(box.querySelectorAll('.qz-opt')).map(i => i.value.trim());
        const correctIdx = parseInt(box.querySelector('input[name="qz-correct"]:checked').value);
        if (!qText || opts.some(o => !o)) { window.showToast('Điền đủ câu hỏi và 4 đáp án!', 'warn'); return; }
        questions = [...questions, { q: qText, options: opts, correct: correctIdx }];
        const nowLocked = questions.length >= 10;
        render();
        try {
          const updates = { [`quiz.${mySide}.questions`]: questions };
          if (nowLocked) updates[`quiz.${mySide}.locked`] = true;
          await updateDoc(doc(db, 'love_apps', this.coupleId), updates);
          if (nowLocked) window.showToast('Đủ 10 câu! Bài kiểm tra đã khoá 🔒', 'success');
        } catch (e) { console.error(e); }
      });
      document.getElementById('qz-close-btn').addEventListener('click', () => overlay.remove());
    };
    render();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  openQuizTaker(reviewMode) {
    const otherSide = this.getOtherSide();
    const otherName = this.data[otherSide]?.name || 'Người ấy';
    const quiz = this.data.quiz?.[otherSide] || { questions: [], result: null };
    const questions = quiz.questions || [];
    const overlay = document.createElement('div');
    overlay.className = 'love-td-overlay open';
    overlay.innerHTML = `<div class="love-td-box love-quiz-box"></div>`;
    document.body.appendChild(overlay);
    const box = overlay.querySelector('.love-td-box');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    if (reviewMode && quiz.result) {
      const answers = quiz.result.answers || [];
      const reviewHtml = questions.map((item, i) => {
        const picked = answers[i];
        const isRight = picked === item.correct;
        return `
          <div class="love-quiz-review-item ${isRight ? 'right' : 'wrong'}">
            <div class="love-quiz-q-text">${i + 1}. ${this.escapeHtml(item.q)}</div>
            <div class="love-quiz-review-answer">Bạn chọn: ${this.escapeHtml(item.options[picked] ?? '—')} ${isRight ? '✅' : '❌'}</div>
            ${!isRight ? `<div class="love-quiz-review-answer correct">Đáp án đúng: ${this.escapeHtml(item.options[item.correct])}</div>` : ''}
          </div>
        `;
      }).join('');
      box.innerHTML = `
        <div style="font-size:18px;font-weight:800;color:#fce7f3;margin-bottom:10px">📋 Kết quả: ${quiz.result.score}/${quiz.result.total}</div>
        <div class="love-quiz-q-list">${reviewHtml}</div>
        <button class="love-td-btn close" id="qz-review-close" style="width:100%;margin-top:12px">Đóng</button>
      `;
      document.getElementById('qz-review-close').addEventListener('click', () => overlay.remove());
      return;
    }

    const myAnswers = new Array(questions.length).fill(null);
    const render = () => {
      const qHtml = questions.map((item, i) => `
        <div class="love-quiz-take-item">
          <div class="love-quiz-q-text">${i + 1}. ${this.escapeHtml(item.q)}</div>
          <div class="love-quiz-opt-list">
            ${item.options.map((opt, oi) => `
              <label class="love-quiz-opt-label">
                <input type="radio" name="qz-take-${i}" value="${oi}" ${myAnswers[i] === oi ? 'checked' : ''}>
                ${this.escapeHtml(opt)}
              </label>
            `).join('')}
          </div>
        </div>
      `).join('');
      box.innerHTML = `
        <div style="font-size:18px;font-weight:800;color:#fce7f3;margin-bottom:12px">🧠 Quiz về ${this.escapeHtml(otherName)}</div>
        <div class="love-quiz-q-list">${qHtml}</div>
        <button class="love-td-btn dare" id="qz-submit-btn" style="width:100%;margin-top:10px">✅ Nộp bài</button>
        <button class="love-td-btn close" id="qz-take-close" style="width:100%;margin-top:6px">Đóng</button>
      `;
      box.querySelectorAll('input[type=radio]').forEach(r => {
        r.addEventListener('change', (e) => {
          const idx = parseInt(e.target.name.split('-')[2]);
          myAnswers[idx] = parseInt(e.target.value);
        });
      });
      document.getElementById('qz-submit-btn').addEventListener('click', async () => {
        if (myAnswers.some(a => a === null)) { window.showToast('Trả lời hết các câu nhé!', 'warn'); return; }
        const score = myAnswers.reduce((sum, a, i) => sum + (a === questions[i].correct ? 1 : 0), 0);
        try {
          await updateDoc(doc(db, 'love_apps', this.coupleId), {
            [`quiz.${otherSide}.result`]: { score, total: questions.length, answers: myAnswers, takenAt: new Date().toISOString() }
          });
          window.showToast(`Bạn đúng ${score}/${questions.length} câu! 🎉`, 'success');
        } catch (e) { console.error(e); }
        overlay.remove();
      });
      document.getElementById('qz-take-close').addEventListener('click', () => overlay.remove());
    };
    render();
  }

  // ========== CÂY TÌNH YÊU (150 ngày + sinh lãi mỗi ngày) ==========
  getTreeLevel(days) {
    const base = './assets/tree/tree-';
    if (days < 30) return { level: 1, img: base + '1.png', name: 'Mầm non', desc: 'Mầm xanh vừa nhú', next: 30, dailyInterest: 50 };
    if (days < 60) return { level: 2, img: base + '2.png', name: 'Cây nhỏ', desc: 'Bắt đầu bén rễ', next: 60, dailyInterest: 100 };
    if (days < 90) return { level: 3, img: base + '3.png', name: 'Cây lớn', desc: 'Vững chãi, xanh tốt', next: 90, dailyInterest: 200 };
    if (days < 120) return { level: 4, img: base + '4.png', name: 'Cây ra hoa', desc: 'Tình yêu nở rộ', next: 120, dailyInterest: 350 };
    if (days < 150) return { level: 5, img: base + '5.png', name: 'Cây kết trái', desc: 'Ngọt ngào, đơm hoa kết trái', next: 150, dailyInterest: 500 };
    return { level: 6, img: base + '6.png', name: 'Cây vĩnh cửu', desc: 'Tình yêu trường tồn mãi mãi', next: Infinity, dailyInterest: 800 };
  }

  async checkAndRewardLevelUp() {
    const startDate = this.data.startDate;
    if (!startDate) return;
    const realDays = this.getDaysSince(startDate);
    const extraDays = this.data.extraDays || 0;
    const totalDays = realDays + extraDays;
    const level = this.getTreeLevel(totalDays).level;
    const lastRewarded = this.data.lastRewardedLevel || 0;

    if (level > lastRewarded) {
      const rewards = {
        2: { points: 200, msg: 'Cây đã lớn thêm một chút! 🌿' },
        3: { points: 500, msg: 'Cây đã trở nên vững chãi! 🌳' },
        4: { points: 1000, msg: 'Cây đã ra hoa rực rỡ! 🌸' },
        5: { points: 2000, msg: 'Cây đã kết trái ngọt lành! 🍎' },
        6: { points: 5000, msg: 'Cây đã đạt đến sự vĩnh cửu! 💎' }
      };
      const reward = rewards[level];
      if (reward) {
        try {
          await addPoints('Love App', `Cây lên cấp ${level}`, reward.points);
          window.showToast(`${reward.msg} Nhận được ${reward.points}〄!`, 'success');
        } catch (e) { console.error(e); }
      }
      await updateDoc(doc(db, 'love_apps', this.coupleId), { lastRewardedLevel: level });
    }
  }

  renderTree() {
    if (!this.data?.startDate) {
      return `
        <div class="love-tree-container">
          <img src="./assets/tree/tree-1.png" class="love-tree-img love-tree-placeholder" alt="Chưa có cây" />
          <p style="color:#94a3b8;margin-top:12px">Hãy set ngày yêu để cây bắt đầu lớn nhé!</p>
          <button class="love-td-btn truth" onclick="window.loveApp.openSetDate()">📅 Set ngày yêu</button>
        </div>
      `;
    }

    const realDays = this.getDaysSince(this.data.startDate);
    const extraDays = this.data.extraDays || 0;
    const totalDays = realDays + extraDays;
    const level = this.getTreeLevel(totalDays);
    const progress = level.next === Infinity ? 100 : Math.min(100, Math.round((totalDays / level.next) * 100));

    const todayStr = new Date().toISOString().split('T')[0];
    const waterLog = this.data.waterLog || {};
    const fertilizerLog = this.data.fertilizerLog || {};
    const harvestLog = this.data.harvestLog || {};

    const myLastWater = waterLog[this.uid] || '';
    const myLastFertilizer = fertilizerLog[this.uid] || '';
    const myLastHarvest = harvestLog[this.uid] || '';

    const canWater = (myLastWater !== todayStr);
    const canFertilize = (myLastFertilizer !== todayStr);
    const canHarvestInterest = (myLastHarvest !== todayStr);

    const isMaxLevel = (level.level === 6);
    const dailyInterest = level.dailyInterest || 0;

    return `
      <div class="love-tree-container">
        <img src="${level.img}" class="love-tree-img" alt="${level.name}" />
        <div class="love-tree-level-name">${level.name}</div>
        <div class="love-tree-level-desc">${level.desc}</div>
        <div class="love-tree-progress">
          <div class="love-tree-progress-fill" style="width:${progress}%"></div>
        </div>
        <p style="font-size:11px;color:#64748b;margin-top:8px">
          ${isMaxLevel ? 'Cây đã trưởng thành tối đa!' : `Còn ${level.next - totalDays} ngày đến cấp tiếp theo`}
        </p>
        <div class="love-tree-stats">
          <div class="love-tree-stat"><strong>${realDays}</strong> Ngày thực</div>
          <div class="love-tree-stat"><strong>+${extraDays}</strong> Ngày thưởng</div>
          <div class="love-tree-stat"><strong>${dailyInterest}〄</strong> Lãi/ngày</div>
        </div>
        <div class="love-tree-actions" style="margin-top:16px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          ${!isMaxLevel ? `
            ${canWater ? `<button id="btn-water-tree" class="love-td-btn truth" style="background: linear-gradient(135deg, #38bdf8, #0ea5e9);">💧 Tưới nước (+1)</button>` : `<span style="color:#94a3b8;font-size:12px;">💧 Đã tưới</span>`}
            ${canFertilize ? `<button id="btn-fertilize-tree" class="love-td-btn truth" style="background: linear-gradient(135deg, #fbbf24, #f59e0b);">🌱 Bón phân (+2) - 300〄</button>` : `<span style="color:#94a3b8;font-size:12px;">🌱 Đã bón</span>`}
          ` : ''}
          ${canHarvestInterest ? `<button id="btn-harvest-interest" class="love-td-btn truth" style="background: linear-gradient(135deg, #34d399, #059669);">💰 Thu lãi (${dailyInterest}〄)</button>` : `<span style="color:#94a3b8;font-size:12px;">💰 Đã thu lãi hôm nay</span>`}
          ${isMaxLevel ? `<button id="btn-reset-tree" class="love-td-btn dare" style="background: linear-gradient(135deg, #f87171, #dc2626);">🔄 Thu hoạch & Trồng mới</button>` : ''}
        </div>
      </div>
    `;
  }

  bindTree() {
    // Tưới nước
    const waterBtn = document.getElementById('btn-water-tree');
    if (waterBtn) {
      waterBtn.addEventListener('click', async () => {
        const today = new Date().toISOString().split('T')[0];
        const waterLog = { ...(this.data.waterLog || {}) };
        waterLog[this.uid] = today;
        await updateDoc(doc(db, 'love_apps', this.coupleId), {
          waterLog,
          extraDays: (this.data.extraDays || 0) + 1
        });
        window.showToast('Đã tưới cây! 🌱💧', 'success');
      });
    }

    // Bón phân
    const fertBtn = document.getElementById('btn-fertilize-tree');
    if (fertBtn) {
      fertBtn.addEventListener('click', async () => {
        try {
          await addPoints('Love App', 'Bón phân', -300);
          const today = new Date().toISOString().split('T')[0];
          const fertilizerLog = { ...(this.data.fertilizerLog || {}) };
          fertilizerLog[this.uid] = today;
          await updateDoc(doc(db, 'love_apps', this.coupleId), {
            fertilizerLog,
            extraDays: (this.data.extraDays || 0) + 2
          });
          window.showToast('Đã bón phân! 🌱✨ (+2 ngày)', 'success');
        } catch (e) {
          window.showToast('Không đủ điểm để bón phân!', 'error');
        }
      });
    }

    // Thu lãi hàng ngày
    const harvestInterestBtn = document.getElementById('btn-harvest-interest');
    if (harvestInterestBtn) {
      harvestInterestBtn.addEventListener('click', async () => {
        const today = new Date().toISOString().split('T')[0];
        const harvestLog = { ...(this.data.harvestLog || {}) };
        harvestLog[this.uid] = today;
        const dailyInterest = this.getTreeLevel(this.getDaysSince(this.data.startDate) + (this.data.extraDays || 0)).dailyInterest;
        try {
          await addPoints('Love App', 'Thu lãi cây tình yêu', dailyInterest);
          await updateDoc(doc(db, 'love_apps', this.coupleId), { harvestLog });
          window.showToast(`Đã thu lãi ${dailyInterest}〄! 💰`, 'success');
        } catch (e) {
          window.showToast('Lỗi thu lãi!', 'error');
        }
      });
    }

    // Reset cây
    const resetBtn = document.getElementById('btn-reset-tree');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (!confirm('Bạn có muốn thu hoạch cây hiện tại và trồng cây mới? Tiến trình sẽ được làm mới.')) return;
        await updateDoc(doc(db, 'love_apps', this.coupleId), {
          extraDays: 0,
          waterLog: {},
          fertilizerLog: {},
          harvestLog: {},
          lastRewardedLevel: 0,
          treesPlanted: increment(1)
        });
        window.showToast('Đã thu hoạch! Cây mới đã sẵn sàng. 🌱', 'success');
      });
    }

    // Kiểm tra lên cấp sau mỗi thay đổi (sẽ được gọi lại từ listenCouple)
    this.checkAndRewardLevelUp();
  }
}

new LoveApp();