// ===== VT WORLD — DAILY QUESTS & LOGIN STREAK =====
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  serverTimestamp, onSnapshot, increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ====== ĐỊNH NGHĨA NHIỆM VỤ HẰNG NGÀY ======
const DAILY_QUESTS = [
  { id: 'play3',        icon: '🎮', title: 'Chơi 3 ván game bất kỳ',   desc: 'Hoàn thành 3 lượt chơi (mọi trò)', target: 3,    reward: 300, event: 'play_game' },
  { id: 'win_smart',    icon: '🧠', title: 'Thắng 1 ván Trí Tuệ',      desc: 'Thắng Caro · Quiz · Sudoku',        target: 1,    reward: 500, event: 'win_smart' },
  { id: 'earn1000',     icon: '💰', title: 'Kiếm 1000đ từ trò chơi',   desc: 'Tích lũy điểm thắng trong ngày',   target: 1000, reward: 400, event: 'earn' },
  { id: 'chat5',        icon: '💬', title: 'Gửi 5 tin nhắn chat',       desc: 'Trò chuyện cùng bạn bè',           target: 5,    reward: 200, event: 'chat_message' },
  { id: 'play_variety', icon: '🎲', title: 'Chơi 2 game KHÁC NHAU',    desc: 'Đa dạng hóa trải nghiệm',          target: 2,    reward: 350, event: 'play_unique' }
];

const STREAK_REWARDS = { 1:100, 2:150, 3:300, 4:400, 5:500, 6:700, 7:1000, 14:2500, 30:7000 };

// ====== UTIL ======
function todayStr() {
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate()-1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dayRef(uid) { return doc(db, 'users', uid, 'dailyState', todayStr()); }
function userRef(uid) { return doc(db, 'users', uid); }

async function getDayDoc(uid) {
  const snap = await getDoc(dayRef(uid));
  if (snap.exists()) return snap.data();
  const init = { date: todayStr(), progress: {}, claimed: {}, uniqueGames: [], loginClaimed: false, createdAt: serverTimestamp() };
  await setDoc(dayRef(uid), init);
  return init;
}

// ====== STREAK LOGIN ======
async function processStreakLogin(uid) {
  const uSnap = await getDoc(userRef(uid));
  const data = uSnap.exists() ? uSnap.data() : {};
  const streak = data.streak || { current: 0, longest: 0, lastDate: null };
  const today = todayStr(), yest = yesterdayStr();
  if (streak.lastDate === today) return { current: streak.current, longest: streak.longest, todayClaimed: true, reward: 0 };
  let newCurrent = streak.lastDate === yest ? (streak.current || 0) + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longest || 0);
  const reward = STREAK_REWARDS[newCurrent] || 50;
  await updateDoc(userRef(uid), {
    points: (data.points || 0) + reward,
    'streak.current': newCurrent, 'streak.longest': newLongest, 'streak.lastDate': today,
    lastUpdate: serverTimestamp()
  });
  await getDayDoc(uid);
  await updateDoc(dayRef(uid), { loginClaimed: true });
  return { current: newCurrent, longest: newLongest, todayClaimed: false, reward };
}

// ====== TRACKING ======
async function track(eventType, value = 1) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await getDayDoc(user.uid);
    const updates = {};
    if (eventType === 'play_game')        updates['progress.play3']      = increment(1);
    else if (eventType === 'win_smart')   updates['progress.win_smart']  = increment(1);
    else if (eventType === 'earn') { const amt = Math.max(0, Number(value)||0); if (amt>0) updates['progress.earn1000'] = increment(amt); }
    else if (eventType === 'chat_message') updates['progress.chat5']     = increment(1);
    else if (eventType === 'play_unique') {
      const snap = await getDoc(dayRef(user.uid));
      const arr = (snap.exists() && snap.data().uniqueGames) || [];
      if (!arr.includes(value)) { arr.push(value); updates['uniqueGames'] = arr; updates['progress.play_variety'] = arr.length; }
    }
    if (Object.keys(updates).length) await updateDoc(dayRef(user.uid), updates);
  } catch(e) { console.warn('quest track err', e); }
}

async function trackPlay(gameId) { await track('play_game'); await track('play_unique', gameId); }
async function trackWinSmart() { return track('win_smart'); }
async function trackEarn(amount) { return track('earn', amount); }
async function trackChat() { return track('chat_message'); }

// ====== CLAIM REWARD ======
async function claimQuest(questId) {
  const user = auth.currentUser;
  if (!user) return { ok: false, msg: 'Hãy đăng nhập' };
  const q = DAILY_QUESTS.find(x => x.id === questId);
  if (!q) return { ok: false };
  const day = await getDayDoc(user.uid);
  if (day.claimed && day.claimed[questId]) return { ok: false, msg: 'Đã nhận' };
  const prog = (day.progress && day.progress[questId]) || 0;
  if (prog < q.target) return { ok: false, msg: 'Chưa đủ tiến độ' };
  const uSnap = await getDoc(userRef(user.uid));
  const currentPts = (uSnap.exists() ? uSnap.data().points : 0) || 0;
  await updateDoc(userRef(user.uid), { points: currentPts + q.reward, lastUpdate: serverTimestamp() });
  await updateDoc(dayRef(user.uid), { ['claimed.'+questId]: true });
  return { ok: true, reward: q.reward };
}

// ====== TOAST ======
function toast(msg, type) {
  if (window.showToast) { window.showToast(msg, type); return; }
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 18px;border-radius:12px;background:#0b1f3a;border:1px solid #38bdf8;color:#e0f2fe;font-weight:700;font-family:Nunito,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5)';
  c.textContent = msg;
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 2800);
}

// ====== BADGE trên bottom-nav profile tab ======
async function updateBadge() {
  const user = auth.currentUser;
  if (!user) { window.BottomNav?.setBadge('profile', 0); return; }
  try {
    const day = await getDayDoc(user.uid);
    let n = 0;
    for (const q of DAILY_QUESTS) {
      const prog = (day.progress && day.progress[q.id]) || 0;
      const claimed = day.claimed && day.claimed[q.id];
      if (prog >= q.target && !claimed) n++;
    }
    const uSnap = await getDoc(userRef(user.uid));
    const streak = (uSnap.exists() && uSnap.data().streak) || {};
    if (streak.lastDate !== todayStr()) n++;
    window.BottomNav?.setBadge('profile', n);
  } catch(e) {}
}

// ====== PANEL RENDERING (trong bottom-nav panel) ======
async function renderPanelProfile() {
  let user = auth.currentUser;
  // Retry nếu auth chưa sẵn
  if (!user) {
    await new Promise(res => setTimeout(res, 800));
    user = auth.currentUser;
  }
  if (!user) return;
  try {
    const snap = await getDoc(userRef(user.uid));
    const data = snap.exists() ? snap.data() : {};
    const name = data.nickname || user.displayName || user.email?.split('@')[0] || '?';
    const pts  = (data.points ?? 0).toLocaleString('vi');

    const nameEl = document.getElementById('vtPpUsername');
    const ptsEl  = document.getElementById('vtPpPoints');
    const avEl   = document.getElementById('vtPpAvatar');
    if (nameEl) nameEl.textContent = name;
    if (ptsEl)  ptsEl.textContent  = '⭐ ' + pts;
    if (avEl) {
      if (data.avatarUrl) {
        avEl.style.backgroundImage = `url(${data.avatarUrl})`;
        avEl.textContent = '';
      } else {
        avEl.textContent = name[0].toUpperCase();
      }
    }
  } catch(e) {}
}

async function renderPanelStreak() {
  let user = auth.currentUser;
  if (!user) {
    await new Promise(res => setTimeout(res, 800));
    user = auth.currentUser;
  }
  if (!user) return;
  try {
    const uSnap = await getDoc(userRef(user.uid));
    const data  = uSnap.exists() ? uSnap.data() : {};
    const streak = data.streak || { current: 0, lastDate: null };
    const today  = todayStr();
    const claimed = streak.lastDate === today;

    const numEl = document.getElementById('vtPpStreakNum');
    const lblEl = document.getElementById('vtPpStreakLabel');
    const btnEl = document.getElementById('vtPpStreakBtn');
    if (numEl) { numEl.textContent = ''; numEl.textContent = String(streak.current || 0); }
    if (lblEl) lblEl.textContent = claimed
      ? `Quay lại ngày mai để +${STREAK_REWARDS[(streak.current||0)+1] || 50}đ`
      : `Nhận ngay +${STREAK_REWARDS[(streak.current||0)+1] || 50}đ`;
    if (btnEl) {
      btnEl.disabled   = claimed;
      btnEl.textContent = claimed ? '✓ Đã nhận' : 'Nhận';
      btnEl.onclick = async (e) => {
        e.stopPropagation();
        btnEl.disabled = true; btnEl.textContent = '...';
        const res = await processStreakLogin(user.uid);
        toast(res.todayClaimed ? 'Bạn đã nhận hôm nay rồi!' : `🔥 Chuỗi ${res.current} ngày · +${res.reward}đ!`, res.todayClaimed ? 'info' : 'success');
        // Update UI trực tiếp từ kết quả — không đọc lại Firestore (tránh cache cũ)
        if (numEl) numEl.textContent = String(res.current || 0);
        if (lblEl) lblEl.textContent = `Quay lại ngày mai để +${STREAK_REWARDS[(res.current||0)+1] || 50}đ`;
        btnEl.disabled = true;
        btnEl.textContent = '✓ Đã nhận';
        updateBadge();
      };
    }
  } catch(e) {}
}

async function renderPanelQuests() {
  let user = auth.currentUser;
  if (!user) {
    await new Promise(res => setTimeout(res, 800));
    user = auth.currentUser;
  }
  if (!user) {
    const list = document.getElementById('vtPpQuestList');
    if (list) {
      list.innerHTML = '<div style="padding:8px 0;text-align:center;color:#f87171;font-size:13px;font-weight:700">Vui lòng đăng nhập để xem nhiệm vụ</div>';
    }
    return;
  }
  const list = document.getElementById('vtPpQuestList');
  const countEl = document.getElementById('vtPpQuestCount');
  if (!list) return;
  list.innerHTML = '<div style="padding:8px 0;text-align:center;color:#4a7a9b;font-size:12px;font-weight:700">Đang tải...</div>';
  try {
    const day = await getDayDoc(user.uid);
    list.innerHTML = '';
    let claimable = 0;
    for (const q of DAILY_QUESTS) {
      const prog    = Math.min(q.target, (day.progress && day.progress[q.id]) || 0);
      const claimed = day.claimed && day.claimed[q.id];
      const done    = prog >= q.target;
      const pct     = Math.round((prog / q.target) * 100);
      if (done && !claimed) claimable++;

      const row = document.createElement('div');
      // Style dùng inline để không bị style.css override
      const rowBg    = claimed ? 'rgba(52,211,153,0.05)' : done ? 'rgba(52,211,153,0.08)' : 'rgba(56,189,248,0.04)';
      const rowBord  = claimed ? 'rgba(52,211,153,0.15)' : done ? 'rgba(52,211,153,0.3)' : 'rgba(56,189,248,0.1)';
      const rowOpac  = claimed ? '0.55' : '1';
      const iconBg   = done ? 'rgba(52,211,153,0.15)' : 'rgba(56,189,248,0.08)';
      const barFill  = done ? 'linear-gradient(90deg,#34d399,#059669)' : 'linear-gradient(90deg,#38bdf8,#0ea5e9)';
      const claimBg  = claimed ? 'rgba(52,211,153,0.1)' : done ? 'linear-gradient(135deg,#34d399,#059669)' : 'rgba(255,255,255,0.05)';
      const claimClr = claimed ? '#34d399' : done ? '#fff' : '#64748b';
      const claimBrd = claimed ? '1px solid rgba(52,211,153,0.25)' : 'none';
      row.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:${rowBg};border:1px solid ${rowBord};opacity:${rowOpac};font-family:'Nunito',sans-serif`;
      row.innerHTML = `
        <div style="width:34px;height:34px;border-radius:10px;background:${iconBg};display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">${q.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:800;color:#e0f2fe;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Nunito',sans-serif">${q.title}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
            <div style="flex:1;height:4px;border-radius:999px;background:rgba(255,255,255,0.06);overflow:hidden">
              <div style="height:100%;border-radius:999px;background:${barFill};width:${pct}%;transition:width .4s"></div>
            </div>
            <span style="font-size:10px;color:#94a3b8;font-weight:700;white-space:nowrap;font-family:'Nunito',sans-serif">${prog}/${q.target}</span>
          </div>
        </div>
        <button class="vt-pp-quest-claim" data-q="${q.id}" ${(!done || claimed) ? 'disabled' : ''}
          style="padding:6px 11px;border-radius:8px;border:${claimBrd};background:${claimBg};color:${claimClr};font-weight:800;font-size:11px;cursor:${(!done||claimed)?'not-allowed':'pointer'};font-family:'Nunito',sans-serif;flex-shrink:0;min-width:52px">
          ${claimed ? '✓' : done ? `+${q.reward}đ` : '🔒'}
        </button>`;
      list.appendChild(row);
    }
    if (countEl) countEl.textContent = claimable > 0 ? `${claimable} có thể nhận` : '';
    list.querySelectorAll('.vt-pp-quest-claim').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-q');
        btn.disabled = true; btn.textContent = '...';
        const res = await claimQuest(id);
        toast(res.ok ? `🎉 Nhận +${res.reward}đ!` : (res.msg || 'Không thể nhận'), res.ok ? 'success' : 'error');
        renderPanelQuests();
        updateBadge();
      });
    });
  } catch(e) {
    list.innerHTML = '<div style="padding:8px 0;text-align:center;color:#f87171;font-size:12px">Lỗi tải nhiệm vụ</div>';
  }
}

// ====== EXPOSE cho BottomNav ======
window.VTPanelQuests = {
  refresh() {
    // Delay nhỏ để DOM panel đã render xong
    setTimeout(() => {
      renderPanelProfile();
      renderPanelStreak();
      renderPanelQuests();
    }, 80);
  }
};

// ====== LEGACY: openQuests vẫn hoạt động (dùng panel thay modal) ======
window.VTQuests = {
  open: () => window.BottomNav?.openPanel(),
  track,
  trackPlay,
  trackWinSmart,
  trackEarn,
  trackChat,
  processStreakLogin
};

// ====== AUTO PHÁT HIỆN GAME ĐANG MỞ ======
const PAGE_TO_GAME = {
  'caro.html':'caro','quiz.html':'quiz','sudoku.html':'sudoku',
  'snake.html':'snake','bird.html':'bird','dino.html':'dino',
  'memory.html':'memory','guess.html':'guess',
  'xidach.html':'xidach','baucua.html':'baucua'
};
let _autoPlayedThisLoad = false;
function autoTrackPlay() {
  if (_autoPlayedThisLoad) return;
  const path = window.location.pathname.split('/').pop();
  const gid  = PAGE_TO_GAME[path];
  if (!gid) return;
  _autoPlayedThisLoad = true;
  trackPlay(gid);
}

// ====== AUTH ======
onAuthStateChanged(auth, (user) => {
  if (user) {
    updateBadge();
    autoTrackPlay();
    onSnapshot(userRef(user.uid), () => updateBadge());
    onSnapshot(dayRef(user.uid),  () => updateBadge());
    // Nếu panel đang mở thì refresh ngay khi auth xong
    const panel = document.getElementById('vtProfilePanel');
    if (panel && panel.classList.contains('open')) {
      window.VTPanelQuests?.refresh();
    }
  } else {
    window.BottomNav?.setBadge('profile', 0);
  }
});