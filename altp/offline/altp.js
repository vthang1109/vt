// ============================================================
// ===== AI LÀ TRIỆU PHÚ (ALTP) - SINGLE PLAYER OFFLINE =====
// ============================================================
import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getActivePetInfo } from '../../pet.js';
import { subscribeUserData, auth, db, onAuthStateChanged } from '../../points.js';

// ========== BẢNG THƯỞNG (15 mốc, an toàn ở câu 5 & 10) ==========
const PRIZE_TABLE = [10, 20, 40, 70, 100, 150, 300, 600, 1200, 2000, 3000, 4000, 5500, 7500, 10000];
const SAFE_IDX = [4, 9]; // index 0-based: sau khi trả lời đúng câu 5 (idx4) và câu 10 (idx9)
const TIER_BY_RANGE = (idx) => idx < 5 ? 'de' : idx < 10 ? 'vua' : 'kho';

let _user = null, _unsubMe = null, _myBalance = 0, _myActivePet = null;
let _bank = null; // ngân hàng câu hỏi đã load
let _state = 'idle'; // idle | playing | ended
let _currentIdx = 0; // 0-based, câu hiện tại
let _usedQuestions = new Set();
let _currentQ = null;
let _lifelines = { fifty: false, audience: false, phone: false };
let _hiddenOptions = [];
let _timer = null, _timeLeft = 30;
let _speed = 30;
let _soundOn = true;

// ========== UTILS ==========
function fmt(n) { return n.toLocaleString('vi-VN') + 'đ'; }

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function loadBank() {
  if (_bank) return _bank;
  const [de, vua, kho] = await Promise.all([
    fetch('data/altp-questions-de.json').then(r => r.json()),
    fetch('data/altp-questions-vua.json').then(r => r.json()),
    fetch('data/altp-questions-kho.json').then(r => r.json())
  ]);
  _bank = { de, vua, kho };
  return _bank;
}

function pickQuestion(idx) {
  const tier = TIER_BY_RANGE(idx);
  const pool = (_bank[tier] || []).filter((_, i) => !_usedQuestions.has(tier + i));
  const list = pool.length ? pool : (_bank[tier] || []);
  const realPool = (_bank[tier] || []);
  const availIdx = realPool.map((_, i) => i).filter(i => !_usedQuestions.has(tier + i));
  const chooseFrom = availIdx.length ? availIdx : realPool.map((_, i) => i);
  const pick = chooseFrom[Math.floor(Math.random() * chooseFrom.length)];
  _usedQuestions.add(tier + pick);
  return realPool[pick];
}

// ========== AUTH ==========
onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = '../../index.html'; return; }
  _user = u;
  if (window.TopNav && window.TopNav.setLeaveAction) window.TopNav.setLeaveAction(() => window.altp.quitToLobby());
  setupMenuActions();
  _unsubMe = subscribeUserData((data) => {
    if (data) {
      _myBalance = data.points || 0;
      _myActivePet = data.activePet || null;
      if (window.TopNav) window.TopNav.setPoints(_myBalance);
    }
  });
  await loadBank();
  renderLadder();
});

// Hamburger menu chung của TopNav: Âm thanh / Tốc độ / Luật chơi
const SPEED_LABELS = { 45: 'Chậm (45s)', 30: 'Vừa (30s)', 15: 'Nhanh (15s)' };
const SPEED_CYCLE = [45, 30, 15];
function setupMenuActions() {
  if (!window.TopNav || !window.TopNav.setMenuActions) return;
  window.TopNav.setMenuActions([
    { icon: _soundOn ? '🔊' : '🔇', label: `Âm thanh: ${_soundOn ? 'Bật' : 'Tắt'}`, onClick: () => { window.altp.toggleSound(); setupMenuActions(); } },
    { icon: '⏱️', label: `Tốc độ: ${SPEED_LABELS[_speed]}`, onClick: () => { window.altp.cycleSpeed(); setupMenuActions(); } },
    { icon: '📜', label: 'Luật chơi', onClick: () => window.altp.openSettings() }
  ]);
}

// ========== RENDER ==========
function renderLadder() {
  const el = document.getElementById('altp-ladder');
  el.innerHTML = PRIZE_TABLE.map((amt, i) => {
    let cls = 'altp-ladder-row';
    if (SAFE_IDX.includes(i)) cls += ' safe';
    if (_state === 'playing' && i === _currentIdx) cls += ' current';
    else if (i < _currentIdx) cls += ' passed';
    return `<div class="${cls}">
      <span>Câu ${i + 1}${SAFE_IDX.includes(i) ? ' 🔒' : ''}</span>
      <span>${fmt(amt)}</span>
    </div>`;
  }).join('');
  const currentRow = el.querySelector('.altp-ladder-row.current');
  if (currentRow) {
    el.scrollTop = currentRow.offsetTop - el.clientHeight / 2 + currentRow.clientHeight / 2;
  }
}

function safePrizeBefore(idx) {
  // Số tiền được giữ nếu trả lời sai ở câu idx (0-based)
  let safe = 0;
  for (const s of SAFE_IDX) {
    if (idx > s) safe = PRIZE_TABLE[s];
  }
  return safe;
}

let _lastWin = false;

function updateStatusBar() {
  document.getElementById('altp-level').textContent = `Câu ${Math.min(_currentIdx + 1, 15)}/15`;
  const scoreEl = document.getElementById('altp-score');
  if (_state === 'ended') {
    scoreEl.textContent = _lastWin ? 'WIN' : 'LOSE';
  } else {
    const amt = _state === 'playing' ? PRIZE_TABLE[_currentIdx] : (_currentIdx > 0 ? PRIZE_TABLE[_currentIdx - 1] : 0);
    scoreEl.textContent = fmt(amt);
  }
  document.getElementById('altp-score-sub').textContent = `An toàn: ${fmt(safePrizeBefore(_currentIdx))}`;
}

function renderQuestion() {
  const q = _currentQ;
  document.getElementById('altp-qtext').textContent = q.q;
  const legacyTimerEl = document.getElementById('altp-timer');
  if (legacyTimerEl) legacyTimerEl.style.display = 'none';
  const optEl = document.getElementById('altp-options');
  const keys = ['A', 'B', 'C', 'D'];
  optEl.innerHTML = q.options.map((opt, i) => `
    <button class="altp-opt" id="altp-opt-${i}" onclick="window.altp.answer(${i})">
      <span class="altp-opt-key">${keys[i]}.</span> ${esc(opt)}
    </button>`).join('');
  optEl.style.display = 'grid';
  document.getElementById('altp-qbox').style.display = 'block';
  document.getElementById('altp-lifelines').style.display = 'flex';
  document.getElementById('altp-audience').style.display = 'none';
  document.getElementById('altp-phone-msg').style.display = 'none';
  document.getElementById('life-5050').disabled = _lifelines.fifty;
  document.getElementById('life-audience').disabled = _lifelines.audience;
  document.getElementById('life-phone').disabled = _lifelines.phone;
  renderLadder();
  updateStatusBar();
  startTimer();
}

function startTimer() {
  clearInterval(_timer);
  _timeLeft = _speed;
  const profitEl = document.getElementById('altp-profit');
  profitEl.className = 'stat-profit timer';
  profitEl.textContent = `⏱ ${_timeLeft}s`;
  _timer = setInterval(() => {
    _timeLeft--;
    profitEl.textContent = `⏱ ${_timeLeft}s`;
    profitEl.classList.toggle('warn', _timeLeft <= 10);
    if (_timeLeft <= 0) {
      clearInterval(_timer);
      window.altp.answer(-1); // hết giờ = trả lời sai
    }
  }, 1000);
}

// ========== GAME FLOW ==========
window.altp = {};

window.altp.startGame = async function () {
  await loadBank();
  _state = 'playing';
  _currentIdx = 0;
  _usedQuestions.clear();
  _lifelines = { fifty: false, audience: false, phone: false };
  document.getElementById('btn-start').style.display = 'none';
  document.getElementById('bc-status').classList.remove('result-win', 'result-lose');
  nextQuestion();
};

function nextQuestion() {
  _hiddenOptions = [];
  _currentQ = pickQuestion(_currentIdx);
  renderQuestion();
}

window.altp.answer = function (choiceIdx) {
  clearInterval(_timer);
  const q = _currentQ;
  const correct = q.correct;
  const opts = document.querySelectorAll('.altp-opt');
  opts.forEach(o => o.onclick = null);
  if (choiceIdx >= 0) opts[choiceIdx].classList.add('picked');

  setTimeout(() => {
    if (choiceIdx >= 0) opts[choiceIdx].classList.remove('picked');
    opts[correct].classList.add('correct');
    if (choiceIdx >= 0 && choiceIdx !== correct) opts[choiceIdx].classList.add('wrong');

    if (choiceIdx === correct) {
      _currentIdx++;
      if (_currentIdx >= 15) {
        setTimeout(() => endGame('win', PRIZE_TABLE[14]), 2000);
      } else {
        setTimeout(nextQuestion, 2000);
      }
    } else {
      setTimeout(() => endGame('lose', safePrizeBefore(_currentIdx)), 2000);
    }
  }, 700);
};

window.altp.stopGame = function () {
  if (_state !== 'playing') return;
  clearInterval(_timer);
  const amount = _currentIdx > 0 ? PRIZE_TABLE[_currentIdx - 1] : 0;
  endGame('stop', amount);
};

async function endGame(outcome, amount) {
  _state = 'ended';
  document.getElementById('btn-start').style.display = 'inline-block';
  document.getElementById('btn-start').textContent = '🔄 Chơi Lại';
  document.getElementById('altp-lifelines').style.display = 'none';
  document.getElementById('altp-qbox').style.display = 'none';
  document.getElementById('altp-options').style.display = 'none';

  let buffBonus = 0, buffPct = 0;
  if (amount > 0) {
    try {
      const info = await getActivePetInfo(); // 1 lần đọc: buff% + pet cùng lúc
      buffPct = info.buff || 0;
      if (buffPct > 0) buffBonus = Math.round(amount * buffPct / 100);
    } catch {}
    const total = amount + buffBonus;
    try {
      await updateDoc(doc(db, 'users', _user.uid), { points: increment(total) });
    } catch (e) {}
    if (window.VTQuests) { window.VTQuests.trackEarn(total); if (outcome === 'win') window.VTQuests.trackWinSmart(); }
  }

  const total = amount + buffBonus;
  const profitEl = document.getElementById('altp-profit');
  const statusBar = document.getElementById('bc-status');
  statusBar.classList.remove('result-win', 'result-lose');
  _lastWin = total > 0;
  if (total > 0) {
    profitEl.textContent = `+${fmt(total)}`;
    profitEl.className = 'stat-profit positive';
    statusBar.classList.add('result-win');
  } else {
    profitEl.textContent = '+0';
    profitEl.className = 'stat-profit zero';
    statusBar.classList.add('result-lose');
  }

  renderLadder();
  updateStatusBar();
}

// ========== TRỢ GIÚP ==========
window.altp.useFiftyFifty = function () {
  if (_lifelines.fifty) return;
  _lifelines.fifty = true;
  document.getElementById('life-5050').disabled = true;
  const correct = _currentQ.correct;
  const wrongIdxs = [0, 1, 2, 3].filter(i => i !== correct);
  const toHide = wrongIdxs.sort(() => Math.random() - 0.5).slice(0, 2);
  toHide.forEach(i => {
    const el = document.getElementById(`altp-opt-${i}`);
    el.classList.add('hidden-5050');
    el.disabled = true;
  });
};

window.altp.useAskAudience = function () {
  if (_lifelines.audience) return;
  _lifelines.audience = true;
  document.getElementById('life-audience').disabled = true;
  const correct = _currentQ.correct;
  // Sinh % giả lập, thiên vị đáp án đúng
  let vals = [0, 0, 0, 0];
  let remain = 100;
  const correctShare = 40 + Math.floor(Math.random() * 35); // 40-74%
  vals[correct] = correctShare;
  remain -= correctShare;
  const others = [0, 1, 2, 3].filter(i => i !== correct);
  others.forEach((idx, k) => {
    const isLast = k === others.length - 1;
    const share = isLast ? remain : Math.floor(Math.random() * (remain / (others.length - k) * 1.5));
    vals[idx] = Math.min(share, remain);
    remain -= vals[idx];
  });
  const audEl = document.getElementById('altp-audience');
  const keys = ['A', 'B', 'C', 'D'];
  audEl.innerHTML = vals.map((v, i) => `<div class="altp-audience-bar" style="height:${Math.max(v, 3)}%"><span>${keys[i]} ${v}%</span></div>`).join('');
  audEl.style.display = 'flex';
};

window.altp.usePhoneFriend = function () {
  if (_lifelines.phone) return;
  _lifelines.phone = true;
  document.getElementById('life-phone').disabled = true;
  const correct = _currentQ.correct;
  const keys = ['A', 'B', 'C', 'D'];
  const isRight = Math.random() < 0.75; // 75% gợi ý đúng
  const suggested = isRight ? correct : [0, 1, 2, 3].filter(i => i !== correct)[Math.floor(Math.random() * 3)];
  const confidence = isRight ? ['khá chắc chắn', 'khá tự tin'][Math.floor(Math.random() * 2)] : ['không chắc lắm', 'phân vân'][Math.floor(Math.random() * 2)];
  const msg = `📞 "Tôi nghĩ đáp án là ${keys[suggested]}, tôi ${confidence}!"`;
  const el = document.getElementById('altp-phone-msg');
  el.textContent = msg;
  el.style.display = 'block';
};

// ========== SETTINGS ==========
window.altp.openSettings = function () { document.getElementById('altp-settings-modal').style.display = 'flex'; };
window.altp.closeSettings = function () { document.getElementById('altp-settings-modal').style.display = 'none'; };
window.altp.toggleSound = function () {
  _soundOn = !_soundOn;
  document.getElementById('altp-sound-toggle').textContent = _soundOn ? 'Bật' : 'Tắt';
};
window.altp.setSpeed = function (val) { _speed = parseInt(val, 10); };
window.altp.cycleSpeed = function () {
  const i = SPEED_CYCLE.indexOf(_speed);
  _speed = SPEED_CYCLE[(i + 1) % SPEED_CYCLE.length];
};
window.altp.quitToLobby = function () { location.href = '../../games.html'; };
