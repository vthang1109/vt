// ===== VT WORLD — DAILY QUESTS & LOGIN STREAK =====
// Hệ thống nhiệm vụ hằng ngày + chuỗi đăng nhập
// Sử dụng cùng Firebase app với points.js (getApps())

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
  {
    id: 'play3',
    icon: '🎮',
    title: 'Chơi 3 ván game bất kỳ',
    desc: 'Hoàn thành 3 lượt chơi (mọi trò)',
    target: 3,
    reward: 300,
    event: 'play_game'
  },
  {
    id: 'win_smart',
    icon: '🧠',
    title: 'Thắng 1 ván Trí Tuệ',
    desc: 'Thắng Caro · Quiz · Sudoku',
    target: 1,
    reward: 500,
    event: 'win_smart'
  },
  {
    id: 'earn1000',
    icon: '💰',
    title: 'Kiếm 1000đ từ trò chơi',
    desc: 'Tích lũy điểm thắng trong ngày',
    target: 1000,
    reward: 400,
    event: 'earn'
  },
  {
    id: 'chat5',
    icon: '💬',
    title: 'Gửi 5 tin nhắn chat',
    desc: 'Trò chuyện cùng bạn bè',
    target: 5,
    reward: 200,
    event: 'chat_message'
  },
  {
    id: 'play_variety',
    icon: '🎲',
    title: 'Chơi 2 game KHÁC NHAU',
    desc: 'Đa dạng hóa trải nghiệm',
    target: 2,
    reward: 350,
    event: 'play_unique'
  }
];

// Phần thưởng theo MỐC chuỗi đăng nhập
const STREAK_REWARDS = {
  1: 100, 2: 150, 3: 300, 4: 400, 5: 500, 6: 700,
  7: 1000, 14: 2500, 30: 7000
};

// ====== UTIL ======
function todayStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function yesterdayStr(){
  const d = new Date(); d.setDate(d.getDate()-1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dayRef(uid){ return doc(db, 'users', uid, 'dailyState', todayStr()); }
function userRef(uid){ return doc(db, 'users', uid); }

async function getDayDoc(uid){
  const snap = await getDoc(dayRef(uid));
  if (snap.exists()) return snap.data();
  const init = {
    date: todayStr(),
    progress: {},
    claimed: {},
    uniqueGames: [],
    loginClaimed: false,
    createdAt: serverTimestamp()
  };
  await setDoc(dayRef(uid), init);
  return init;
}

// ====== STREAK LOGIN ======
// Trả về: { current, longest, todayClaimed, reward }
async function processStreakLogin(uid){
  const uSnap = await getDoc(userRef(uid));
  const data = uSnap.exists() ? uSnap.data() : {};
  const streak = data.streak || { current: 0, longest: 0, lastDate: null };
  const today = todayStr();
  const yest = yesterdayStr();

  // Đã claim hôm nay rồi
  if (streak.lastDate === today){
    return { current: streak.current, longest: streak.longest, todayClaimed: true, reward: 0 };
  }

  let newCurrent;
  if (streak.lastDate === yest) newCurrent = (streak.current || 0) + 1;
  else newCurrent = 1; // reset

  const newLongest = Math.max(newCurrent, streak.longest || 0);
  const reward = STREAK_REWARDS[newCurrent] || 50; // mặc định 50đ/ngày nếu không trùng mốc

  // Cộng điểm + cập nhật streak
  const currentPts = data.points || 0;
  await updateDoc(userRef(uid), {
    points: currentPts + reward,
    'streak.current': newCurrent,
    'streak.longest': newLongest,
    'streak.lastDate': today,
    lastUpdate: serverTimestamp()
  });

  // Đánh dấu trong dailyState
  const day = await getDayDoc(uid);
  await updateDoc(dayRef(uid), { loginClaimed: true });

  return { current: newCurrent, longest: newLongest, todayClaimed: false, reward };
}

// ====== TRACKING ======
// API public dùng trong các game / chat
async function track(eventType, value = 1){
  const user = auth.currentUser;
  if (!user) return;
  try {
    await getDayDoc(user.uid);
    const updates = {};

    if (eventType === 'play_game'){
      updates['progress.play3'] = increment(1);
    } else if (eventType === 'win_smart'){
      updates['progress.win_smart'] = increment(1);
    } else if (eventType === 'earn'){
      const amt = Math.max(0, Number(value) || 0);
      if (amt > 0) updates['progress.earn1000'] = increment(amt);
    } else if (eventType === 'chat_message'){
      updates['progress.chat5'] = increment(1);
    } else if (eventType === 'play_unique'){
      // value = gameId
      const snap = await getDoc(dayRef(user.uid));
      const arr = (snap.exists() && snap.data().uniqueGames) || [];
      if (!arr.includes(value)){
        arr.push(value);
        updates['uniqueGames'] = arr;
        updates['progress.play_variety'] = arr.length;
      }
    }

    if (Object.keys(updates).length){
      await updateDoc(dayRef(user.uid), updates);
    }
  } catch(e){ console.warn('quest track err', e); }
}

// Helper hợp nhất: gọi 1 lần khi vào game = play_game + play_unique
async function trackPlay(gameId){
  await track('play_game');
  await track('play_unique', gameId);
}
async function trackWinSmart(){ return track('win_smart'); }
async function trackEarn(amount){ return track('earn', amount); }
async function trackChat(){ return track('chat_message'); }

// ====== CLAIM REWARD ======
async function claimQuest(questId){
  const user = auth.currentUser;
  if (!user) return { ok: false, msg: 'Hãy đăng nhập' };
  const q = DAILY_QUESTS.find(x => x.id === questId);
  if (!q) return { ok: false };
  const day = await getDayDoc(user.uid);
  if (day.claimed && day.claimed[questId]) return { ok: false, msg: 'Đã nhận' };
  const prog = (day.progress && day.progress[questId]) || 0;
  if (prog < q.target) return { ok: false, msg: 'Chưa đủ tiến độ' };

  // Cộng điểm
  const uSnap = await getDoc(userRef(user.uid));
  const currentPts = (uSnap.exists() ? uSnap.data().points : 0) || 0;
  await updateDoc(userRef(user.uid), {
    points: currentPts + q.reward,
    lastUpdate: serverTimestamp()
  });
  await updateDoc(dayRef(user.uid), { ['claimed.'+questId]: true });
  return { ok: true, reward: q.reward };
}

// ====== UI ======
function ensureModal(){
  if (document.getElementById('vt-quest-modal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'vt-quest-modal';
  wrap.className = 'vtq-overlay';
  wrap.innerHTML = `
    <div class="vtq-box" onclick="event.stopPropagation()">
      <div class="vtq-head">
        <div class="vtq-title">📅 Nhiệm vụ hôm nay</div>
        <button class="vtq-close" id="vtq-close">✕</button>
      </div>

      <div class="vtq-streak" id="vtq-streak">
        <div class="vtq-streak-icon">🔥</div>
        <div class="vtq-streak-body">
          <div class="vtq-streak-row">
            <span class="vtq-streak-num" id="vtq-streak-num">0</span>
            <span class="vtq-streak-label">ngày liên tiếp</span>
          </div>
          <div class="vtq-streak-sub" id="vtq-streak-sub">Đăng nhập mỗi ngày để giữ chuỗi!</div>
        </div>
        <button class="vtq-streak-btn" id="vtq-streak-btn">Nhận</button>
      </div>

      <div class="vtq-week" id="vtq-week"></div>

      <div class="vtq-list" id="vtq-list"></div>

      <div class="vtq-footer">Hoàn thành nhiệm vụ để nhận điểm. Reset mỗi ngày 00:00.</div>
    </div>
  `;
  wrap.addEventListener('click', () => wrap.classList.remove('open'));
  document.body.appendChild(wrap);
  document.getElementById('vtq-close').onclick = () => wrap.classList.remove('open');
  document.getElementById('vtq-streak-btn').onclick = onClickStreak;
}

function renderWeek(currentStreak){
  const el = document.getElementById('vtq-week');
  if (!el) return;
  let html = '';
  for (let d = 1; d <= 7; d++){
    const reward = STREAK_REWARDS[d];
    const reached = currentStreak >= d;
    html += `<div class="vtq-day ${reached?'on':''}">
      <div class="vtq-day-num">N${d}</div>
      <div class="vtq-day-rw">+${reward}</div>
    </div>`;
  }
  el.innerHTML = html;
}

async function renderQuests(){
  const user = auth.currentUser;
  if (!user) return;
  const day = await getDayDoc(user.uid);
  const list = document.getElementById('vtq-list');
  if (!list) return;
  list.innerHTML = '';
  for (const q of DAILY_QUESTS){
    const prog = Math.min(q.target, (day.progress && day.progress[q.id]) || 0);
    const claimed = day.claimed && day.claimed[q.id];
    const done = prog >= q.target;
    const pct = Math.round((prog / q.target) * 100);
    const row = document.createElement('div');
    row.className = 'vtq-row' + (claimed ? ' claimed' : (done ? ' done' : ''));
    row.innerHTML = `
      <div class="vtq-icon">${q.icon}</div>
      <div class="vtq-info">
        <div class="vtq-row-title">${q.title}</div>
        <div class="vtq-row-desc">${q.desc}</div>
        <div class="vtq-bar"><div class="vtq-bar-fill" style="width:${pct}%"></div></div>
        <div class="vtq-row-bottom">
          <span class="vtq-prog">${prog}/${q.target}</span>
          <span class="vtq-reward">+${q.reward}đ</span>
        </div>
      </div>
      <button class="vtq-claim" data-q="${q.id}" ${(!done || claimed) ? 'disabled' : ''}>
        ${claimed ? '✓ Đã nhận' : (done ? 'Nhận' : 'Khoá')}
      </button>
    `;
    list.appendChild(row);
  }
  list.querySelectorAll('.vtq-claim').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-q');
      btn.disabled = true;
      btn.textContent = '...';
      const res = await claimQuest(id);
      if (res.ok){
        toast(`🎉 Nhận +${res.reward}đ!`, 'success');
      } else {
        toast(res.msg || 'Không thể nhận', 'error');
      }
      renderQuests();
      updateBadge();
    });
  });
}

async function refreshStreakUI(){
  const user = auth.currentUser;
  if (!user) return;
  const uSnap = await getDoc(userRef(user.uid));
  const data = uSnap.exists() ? uSnap.data() : {};
  const streak = data.streak || { current: 0, longest: 0, lastDate: null };
  const today = todayStr();
  const claimed = streak.lastDate === today;
  const numEl = document.getElementById('vtq-streak-num');
  const subEl = document.getElementById('vtq-streak-sub');
  const btnEl = document.getElementById('vtq-streak-btn');
  if (numEl) numEl.textContent = streak.current || 0;
  if (subEl) subEl.textContent = claimed
    ? `Quay lại ngày mai để +${STREAK_REWARDS[(streak.current||0)+1] || 50}đ`
    : `Nhận ngay +${STREAK_REWARDS[((streak.current||0)+ (streak.lastDate===yesterdayStr()?1:1))] || 50}đ`;
  if (btnEl){
    btnEl.disabled = claimed;
    btnEl.textContent = claimed ? '✓ Đã nhận' : 'Nhận';
  }
  renderWeek(streak.current || 0);
}

async function onClickStreak(e){
  e.stopPropagation();
  const user = auth.currentUser;
  if (!user) return;
  const btn = document.getElementById('vtq-streak-btn');
  btn.disabled = true; btn.textContent = '...';
  const res = await processStreakLogin(user.uid);
  if (!res.todayClaimed && res.reward){
    toast(`🔥 Chuỗi ${res.current} ngày · +${res.reward}đ!`, 'success');
  } else {
    toast('Bạn đã nhận hôm nay rồi!', 'info');
  }
  refreshStreakUI();
  updateBadge();
}

function toast(msg, type){
  if (window.showToast) { window.showToast(msg, type); return; }
  // fallback toast nhỏ
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 18px;border-radius:12px;background:#0b1f3a;border:1px solid #38bdf8;color:#e0f2fe;font-weight:700;font-family:Nunito,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5)';
  c.textContent = msg;
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 2800);
}

// ====== BADGE (số nhiệm vụ có thể nhận) ======
async function updateBadge(){
  const user = auth.currentUser;
  const badge = document.getElementById('vtq-badge');
  if (!badge) return;
  if (!user) { badge.style.display = 'none'; return; }
  try {
    const day = await getDayDoc(user.uid);
    let n = 0;
    for (const q of DAILY_QUESTS){
      const prog = (day.progress && day.progress[q.id]) || 0;
      const claimed = day.claimed && day.claimed[q.id];
      if (prog >= q.target && !claimed) n++;
    }
    const uSnap = await getDoc(userRef(user.uid));
    const streak = (uSnap.exists() && uSnap.data().streak) || {};
    if (streak.lastDate !== todayStr()) n++; // streak có thể nhận
    if (n > 0){
      badge.textContent = n;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  } catch(e){}
}

// ====== NÚT NỔI MỞ MODAL ======
function ensureFab(){
  if (document.getElementById('vtq-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'vtq-fab';
  fab.className = 'vtq-fab';
  fab.innerHTML = '📅<span id="vtq-badge" class="vtq-badge" style="display:none">0</span>';
  fab.title = 'Nhiệm vụ hằng ngày';
  fab.addEventListener('click', openQuests);
  document.body.appendChild(fab);
}

function openQuests(){
  ensureModal();
  const m = document.getElementById('vt-quest-modal');
  m.classList.add('open');
  refreshStreakUI();
  renderQuests();
}

// ====== EXPOSE ======
window.VTQuests = {
  open: openQuests,
  track,
  trackPlay,
  trackWinSmart,
  trackEarn,
  trackChat,
  processStreakLogin
};

// ====== AUTO PHÁT HIỆN GAME ĐANG MỞ ======
const PAGE_TO_GAME = {
  'caro.html': 'caro', 'quiz.html': 'quiz', 'sudoku.html': 'sudoku',
  'snake.html': 'snake', 'bird.html': 'bird', 'dino.html': 'dino',
  'memory.html': 'memory', 'guess.html': 'guess',
  'xidach.html': 'xidach', 'baucua.html': 'baucua'
};
let _autoPlayedThisLoad = false;
function autoTrackPlay(){
  if (_autoPlayedThisLoad) return;
  const path = window.location.pathname.split('/').pop();
  const gid = PAGE_TO_GAME[path];
  if (!gid) return;
  _autoPlayedThisLoad = true;
  trackPlay(gid);
}

// ====== AUTO INIT ======
document.addEventListener('DOMContentLoaded', () => {
  ensureFab();
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    ensureFab();
    updateBadge();
    autoTrackPlay();
    // Realtime cập nhật badge khi điểm/streak thay đổi
    onSnapshot(userRef(user.uid), () => updateBadge());
    onSnapshot(dayRef(user.uid), () => updateBadge());
  } else {
    const fab = document.getElementById('vtq-fab');
    if (fab) fab.style.display = 'none';
  }
});
