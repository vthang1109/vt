// ============================================================
// ===== PROFILE CARD v2 — Popup hồ sơ nhỏ tối ưu toàn hệ thống =====
// Cách dùng:
//   <script src="profile-card.js"></script>
//   initProfileCard({ db, getMyUid: () => user.uid, firestore: {...}, titles: {...} });
// Sau đó bất kỳ đâu: onclick="window.showProfileCard('UID')"
// ============================================================
let _db = null;
let _getMyUid = null;

// Firestore functions (passed via initProfileCard)
let _doc = null;
let _getDoc = null;
let _updateDoc = null;
let _deleteDoc = null;
let _setDoc = null;
let _arrayUnion = null;
let _arrayRemove = null;
let _serverTimestamp = null;

// Title functions (passed via initProfileCard)
let _getOwnedTitles = null;
let _getDefaultTitle = null;
let _getTitleById = null;

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectStyles() {
  if (document.getElementById('pc-style')) return;
  const style = document.createElement('style');
  style.id = 'pc-style';
  style.textContent = `
#pc-overlay{position:fixed;inset:0;background:rgba(0,4,16,.7);backdrop-filter:blur(4px);z-index:99990;display:none;align-items:center;justify-content:center;padding:16px;animation:pcFadeIn .2s ease}
#pc-overlay.open{display:flex}
@keyframes pcFadeIn{from{opacity:0}to{opacity:1}}
@keyframes pcSlideUp{from{transform:scale(.92) translateY(16px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
#pc-box{position:relative;width:min(340px,92vw);background:linear-gradient(145deg,#111c2e,#0b0f1c);border:1px solid rgba(56,189,248,.2);border-radius:20px;box-shadow:0 0 40px rgba(0,140,255,.15),0 20px 60px rgba(0,0,0,.6);overflow:hidden;animation:pcSlideUp .25s cubic-bezier(.22,1,.36,1)}
#pc-close-x{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12);color:#cfeeff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;font-weight:700;z-index:20;line-height:1;transition:background .15s}
#pc-close-x:hover{background:rgba(56,189,248,.25);transform:scale(1.08)}
#pc-cover{position:relative;height:110px;overflow:hidden}
#pc-cover-bg{position:absolute;inset:0;background:linear-gradient(135deg,rgba(56,189,248,.18) 0%,rgba(124,58,237,.22) 50%,rgba(52,211,153,.12) 100%);border-bottom:1px solid rgba(56,189,248,.15)}
#pc-cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#pc-header-row{display:flex;align-items:flex-end;gap:10px;padding:0 16px 12px;position:relative;margin-top:-38px;z-index:5}
#pc-av-wrap{width:76px;height:76px;flex-shrink:0}
#pc-av-ring{width:76px;height:76px;border-radius:50%;padding:2px;background:linear-gradient(135deg,#38bdf8,#a78bfa,#34d399);box-shadow:0 0 0 3px #0b0f1c;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
#pc-av{width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 30% 30%,#1cc8ff,#0050d8 70%);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;background-size:cover;background-position:center}
#pc-name-wrap{flex:1;padding-bottom:3px;min-width:0}
#pc-name{font-weight:600;font-size:17px;color:#e6f4ff;text-shadow:0 1px 10px rgba(0,0,0,.8),0 0 8px rgba(0,200,255,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pc-points-box{display:inline-flex;align-items:center;gap:5px;margin-top:5px;background:rgba(15,23,42,.8);backdrop-filter:blur(6px);border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:3px 10px}
#pc-points{font-family:'Science Gothic',sans-serif;font-size:12px;font-weight:500;color:#fbbf24}
#pc-points-label{font-size:10px;color:#fde68a;font-weight:400}
#pc-titles{display:flex;gap:4px;flex-wrap:wrap;padding:0 14px;margin-bottom:8px;min-height:0}
#pc-titles .title-badge{font-size:10px;padding:3px 8px}
#pc-stats{display:flex;gap:6px;padding:0 14px;margin-bottom:10px}
.pc-stat{background:rgba(15,23,42,.5);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:6px 10px;text-align:center;flex:1}
.pc-stat-val{font-family:'Science Gothic',sans-serif;font-size:13px;font-weight:500;color:#e0f2fe}
.pc-stat-lbl{font-size:9px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-top:1px}
#pc-actions{padding:0 14px 14px;display:flex;flex-direction:column;gap:8px}
.pc-row{display:flex;gap:8px}
.pc-btn{flex:1;padding:10px;border-radius:10px;font-weight:600;cursor:pointer;font-family:'Science Gothic',sans-serif;font-size:13px;text-align:center;border:none;transition:transform .12s,filter .12s}
.pc-btn:active{transform:scale(.97)}
.pc-btn:disabled{opacity:.5;cursor:default;transform:none}
#pc-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:24px;color:#7fe3ff;font-size:13px}
#pc-loading .spinner{width:20px;height:20px;border:2.5px solid rgba(56,189,248,.2);border-top-color:#38bdf8;border-radius:50%;animation:pcSpin .7s linear infinite}
@keyframes pcSpin{to{transform:rotate(360deg)}}
`;
  document.head.appendChild(style);
}

function buildModal() {
  if (document.getElementById('pc-overlay')) return;
  injectStyles();
  const overlay = document.createElement('div');
  overlay.id = 'pc-overlay';
  overlay.onclick = (e) => { if (e.target.id === 'pc-overlay') closeProfileCard(); };
  overlay.innerHTML = `
    <div id="pc-box">
      <button id="pc-close-x" onclick="window.closeProfileCard()">✕</button>
      <div id="pc-cover">
        <div id="pc-cover-bg"></div>
        <img id="pc-cover-img" />
      </div>
      <div id="pc-header-row">
        <div id="pc-av-wrap"><div id="pc-av-ring"><div id="pc-av">?</div></div></div>
        <div id="pc-name-wrap">
          <div id="pc-name">—</div>
          <div id="pc-points-box"><span>⭐</span><span id="pc-points">—</span><span id="pc-points-label">điểm</span></div>
        </div>
      </div>
      <div id="pc-titles"></div>
      <div id="pc-stats"></div>
      <div id="pc-actions"><div id="pc-loading"><div class="spinner"></div><span>Đang tải...</span></div></div>
    </div>`;
  document.body.appendChild(overlay);

  // Escape key to close
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeProfileCard();
  });
}

function closeProfileCard() {
  const overlay = document.getElementById('pc-overlay');
  if (overlay) overlay.classList.remove('open');
}
window.closeProfileCard = closeProfileCard;

async function getFriendStatus(myUid, otherUid) {
  try {
    const mySnap = await _getDoc(_doc(_db, 'users', myUid));
    if (mySnap.exists() && (mySnap.data().friends || []).includes(otherUid)) return 'friends';
    const sentSnap = await _getDoc(_doc(_db, 'friendRequests', otherUid, 'requests', myUid));
    if (sentSnap.exists()) return 'pending_sent';
    const recvSnap = await _getDoc(_doc(_db, 'friendRequests', myUid, 'requests', otherUid));
    if (recvSnap.exists()) return 'pending_received';
    return 'none';
  } catch (e) {
    return 'none';
  }
}

async function sendFriendRequest(uid) {
  const myUid = _getMyUid();
  await _setDoc(_doc(_db, 'friendRequests', uid, 'requests', myUid), { fromUid: myUid, toUid: uid, createdAt: _serverTimestamp() });
  window.showToast ? window.showToast('✅ Đã gửi lời mời kết bạn', 'success') : null;
  showProfileCard(uid);
}
async function acceptFriend(uid) {
  const myUid = _getMyUid();
  await _updateDoc(_doc(_db, 'users', myUid), { friends: _arrayUnion(uid) });
  await _updateDoc(_doc(_db, 'users', uid), { friends: _arrayUnion(myUid) });
  await _deleteDoc(_doc(_db, 'friendRequests', myUid, 'requests', uid));
  showProfileCard(uid);
}
async function declineFriend(uid) {
  const myUid = _getMyUid();
  await _deleteDoc(_doc(_db, 'friendRequests', myUid, 'requests', uid));
  showProfileCard(uid);
}
async function unfriend(uid) {
  const myUid = _getMyUid();
  await _updateDoc(_doc(_db, 'users', myUid), { friends: _arrayRemove(uid) });
  await _updateDoc(_doc(_db, 'users', uid), { friends: _arrayRemove(myUid) });
  showProfileCard(uid);
}
window.pcSendFriendRequest = sendFriendRequest;
window.pcAcceptFriend = acceptFriend;
window.pcDeclineFriend = declineFriend;
window.pcUnfriend = unfriend;
window.pcMessage = (uid, name) => {
  // Đóng profile card trước
  if (window.closeProfileCard) window.closeProfileCard();
  // Nếu đã ở trang chat → mở trực tiếp, không cần reload
  if (window.location.pathname.includes('chat.html') && window.openConvo) {
    window.openConvo(uid, name || 'Người lạ', (name || '?')[0].toUpperCase(), 'dm');
  } else {
    location.href = 'chat.html?uid=' + uid + '&name=' + encodeURIComponent(name || '');
  }
};

function renderActions(uid, data, status) {
  const area = document.getElementById('pc-actions');
  const myUid = _getMyUid();
  const name = data.nickname || data.email?.split('@')[0] || '?';
  if (uid === myUid) {
    area.innerHTML = '<div style="padding:14px;text-align:center"><span style="color:#7dd3fc;font-size:14px">✨ Đây là bạn!</span></div>';
    return;
  }
  if (status === 'friends') {
    area.innerHTML = `
      <div class="pc-row">
        <button class="pc-btn" style="background:linear-gradient(135deg,#34d399,#059669);color:#fff" onclick="window.pcMessage('${uid}','${esc(name)}')">💬 Nhắn tin</button>
        <button class="pc-btn" style="background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);color:#38bdf8" onclick="location.href='profile.html?uid=${uid}'">👤 Hồ sơ</button>
      </div>
      <div class="pc-row">
        <button class="pc-btn" style="background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.3);color:#fbbf24" onclick="window.openSendPointsModal&&window.openSendPointsModal('${uid}','${esc(name)}')">💸 Gửi điểm</button>
        <button class="pc-btn" style="background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171" onclick="window.pcUnfriend('${uid}')">🗑️ Hủy KB</button>
      </div>`;
  } else if (status === 'pending_sent') {
    area.innerHTML = `
      <div class="pc-row">
        <button class="pc-btn" style="background:linear-gradient(135deg,#34d399,#059669);color:#fff" onclick="window.pcMessage('${uid}','${esc(name)}')">💬 Nhắn tin</button>
        <button class="pc-btn" style="background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);color:#38bdf8" onclick="location.href='profile.html?uid=${uid}'">👤 Hồ sơ</button>
      </div>
      <div style="text-align:center;padding:8px;border-radius:10px;background:rgba(56,189,248,.07);border:1px solid rgba(56,189,248,.2);color:#7dd3fc;font-weight:600;font-size:12px">⏳ Đã gửi lời mời kết bạn</div>`;
  } else if (status === 'pending_received') {
    area.innerHTML = `
      <div class="pc-row">
        <button class="pc-btn" style="background:linear-gradient(135deg,#34d399,#059669);color:#fff" onclick="window.pcAcceptFriend('${uid}')\">✅ Chấp nhận</button>
        <button class="pc-btn" style="background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171" onclick="window.pcDeclineFriend('${uid}')\">❌ Từ chối</button>
        <button class="pc-btn" style="background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);color:#38bdf8" onclick="window.pcMessage('${uid}','${esc(name)}')">💬 Nhắn tin</button>
      </div>`;
  } else {
    area.innerHTML = `
      <div class="pc-row">
        <button class="pc-btn" style="background:linear-gradient(135deg,#34d399,#059669);color:#fff" onclick="window.pcMessage('${uid}','${esc(name)}')">💬 Nhắn tin</button>
        <button class="pc-btn" style="background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);color:#38bdf8" onclick="location.href='profile.html?uid=${uid}'">👤 Hồ sơ</button>
        <button class="pc-btn" style="background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.3);color:#fbbf24" onclick="window.openSendPointsModal&&window.openSendPointsModal('${uid}','${esc(name)}')">💸 Gửi điểm</button>
      </div>
      <button class="pc-btn" style="width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#94a3b8" onclick="window.pcSendFriendRequest('${uid}')">➕ Kết bạn</button>`;
  }
}

function renderTitles(uid, data) {
  const el = document.getElementById('pc-titles');
  if (!el) return;
  try {
    const points = data.points || 0;
    const friends = data.friends || [];
    const petCol = data.petCollection || {};
    const petCount = Object.values(petCol).reduce((s, q) => s + (q || 0), 0);
    const streak = data.streak || {};
    const ownedShopIds = data.ownedTitles || [];
    const us = data.stats || {};
    const stats = {
      points, friends: friends.length, petsOwned: petCount,
      streakCurrent: streak.current || 0, titlesOwned: ownedShopIds.length,
      hasNickname: !!(data.nickname), hasAvatar: !!data.avatarUrl,
      gamesPlayed: us.gamesPlayed || 0, uniqueGamesPlayed: us.uniqueGamesPlayed || 0,
      chessGamesPlayed: us.chessGamesPlayed || 0, cardGamesPlayed: us.cardGamesPlayed || 0,
      smartGamesPlayed: us.smartGamesPlayed || 0,
      xidachWins: us.xidachWins || 0, xidachSpecials: us.xidachSpecials || 0,
      casinoGamesPlayed: us.casinoGamesPlayed || 0,
      slotWins: us.slotWins || 0, baucuaWins: us.baucuaWins || 0, taixiuWins: us.taixiuWins || 0,
      casinoWins: us.casinoWins || 0, totalWins: us.totalWins || 0,
    };
    const owned = _getOwnedTitles(stats, ownedShopIds);
    const activeStr = data.activeTitle || '';
    let activeIds = [];
    if (typeof activeStr === 'string') {
      try { const p = JSON.parse(activeStr); if (Array.isArray(p)) activeIds = p; } catch { activeIds = [activeStr]; }
    }
    const showTitles = activeIds.length ? activeIds.map(id => _getTitleById(id)).filter(Boolean) : [_getDefaultTitle(stats, ownedShopIds)].filter(Boolean);
    if (showTitles.length) {
      el.innerHTML = showTitles.map(t => `<span class="title-badge ${t.cls}">${esc(t.label)}</span>`).join('');
    } else {
      el.style.display = 'none';
    }
  } catch(e) {
    el.style.display = 'none';
  }
}

function renderStats(uid, data) {
  const el = document.getElementById('pc-stats');
  if (!el) return;
  const friends = (data.friends || []).length;
  const joined = data.createdAt
    ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('vi-VN')
    : '—';
  el.innerHTML = `
    <div class="pc-stat"><div class="pc-stat-val">${friends}</div><div class="pc-stat-lbl">Bạn bè</div></div>
    <div class="pc-stat"><div class="pc-stat-val">${(data.points || 0) >= 1000000 ? ((data.points/1000000).toFixed(1)+'M') : (data.points||0) >= 1000 ? ((data.points/1000).toFixed(1)+'K') : data.points||0}</div><div class="pc-stat-lbl">Điểm</div></div>
    <div class="pc-stat"><div class="pc-stat-val">${joined}</div><div class="pc-stat-lbl">Tham gia</div></div>`;
}

async function showProfileCard(uid) {
  if (!_db || !_getMyUid) { console.warn('[profile-card] chưa gọi initProfileCard()'); return; }
  buildModal();
  const overlay = document.getElementById('pc-overlay');
  overlay.classList.add('open');

  // Reset
  document.getElementById('pc-actions').innerHTML = '<div id="pc-loading"><div class="spinner"></div><span>Đang tải...</span></div>';
  document.getElementById('pc-titles').style.display = '';
  document.getElementById('pc-titles').innerHTML = '';
  document.getElementById('pc-stats').innerHTML = '';

  try {
    const snap = await _getDoc(_doc(_db, 'users', uid));
    if (!snap.exists()) {
      document.getElementById('pc-actions').innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;font-size:13px">❌ Không tìm thấy người dùng.</div>';
      return;
    }
    const data = snap.data();
    const name = data.nickname || data.email?.split('@')[0] || '?';
    const colors = ['#a78bfa,#7c3aed','#38bdf8,#0ea5e9','#34d399,#059669','#fbbf24,#f59e0b','#f87171,#ef4444'];
    const colorIdx = uid.charCodeAt(0) % colors.length;
    const avEl = document.getElementById('pc-av');
    if (data.avatarUrl) {
      avEl.style.background = `url(${data.avatarUrl}) center/cover`;
      avEl.textContent = '';
    } else {
      avEl.style.background = `linear-gradient(135deg,${colors[colorIdx]})`;
      avEl.textContent = name[0].toUpperCase();
    }
    const coverImg = document.getElementById('pc-cover-img');
    const coverBg = document.getElementById('pc-cover-bg');
    if (data.coverUrl) {
      coverImg.src = data.coverUrl;
      coverImg.style.display = 'block';
      coverBg.style.display = 'none';
    } else {
      coverImg.style.display = 'none';
      coverBg.style.display = 'block';
    }
    document.getElementById('pc-name').textContent = name;
    document.getElementById('pc-points').textContent = (data.points ?? 0).toLocaleString('vi-VN');

    // Render titles & stats
    renderTitles(uid, data);
    renderStats(uid, data);

    // Render friend actions
    const status = await getFriendStatus(_getMyUid(), uid);
    renderActions(uid, data, status);
  } catch (e) {
    console.error('[profile-card] error:', e);
    document.getElementById('pc-actions').innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;font-size:13px">❌ Lỗi tải hồ sơ.</div>';
  }
}

function initProfileCard({ db, getMyUid, firestore, titles }) {
  _db = db;
  _getMyUid = getMyUid;
  if (firestore) {
    _doc = firestore.doc;
    _getDoc = firestore.getDoc;
    _updateDoc = firestore.updateDoc;
    _deleteDoc = firestore.deleteDoc;
    _setDoc = firestore.setDoc;
    _arrayUnion = firestore.arrayUnion;
    _arrayRemove = firestore.arrayRemove;
    _serverTimestamp = firestore.serverTimestamp;
  }
  if (titles) {
    _getOwnedTitles = titles.getOwnedTitles;
    _getDefaultTitle = titles.getDefaultTitle;
    _getTitleById = titles.getTitleById;
  }
  window.showProfileCard = showProfileCard;
}

window.initProfileCard = initProfileCard;
