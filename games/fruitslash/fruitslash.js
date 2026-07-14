// fruitslash.js — VTWorld Fruit Slash (status bar: phải hiển thị giây/mạng, kết thúc hiển thị thưởng)
import { auth, db } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { addPoints, subscribeBalance } from '../../points.js';

class FruitSlash {
  constructor() {
    this.uid = null;
    this.canvas = null;
    this.ctx = null;
    this.W = 0;
    this.H = 0;
    this.objects = [];
    this.score = 0;
    this.highScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = null;
    this.lastSliceTime = 0;
    this.lives = 3;
    this.maxLives = 3;
    this.timeLeft = 0;
    this.totalTime = 0;
    this.isPlaying = false;
    this.gameMode = 'timed';
    this.isTimeFrozen = false;
    this.freezeTimer = null;
    this.spawnInterval = null;
    this.iceTimer = null;
    this.doubleTimer = null;
    this.isScoreDoubled = false;
    this.doubleScoreTimer = null;
    this.gameLoopId = null;
    this.balance = 0;
    this.unsubBalance = null;
    this.cachedBuffPct = 0;
    this.cachedPetLabel = '🐾 Pet';
    this.lastSliceX = undefined;
    this.lastSliceY = undefined;
    this.reward = 0; // lưu tiền thưởng khi kết thúc

    // Hiệu ứng kiểu Fruit Ninja
    this.trail = [];       // vệt lưỡi dao
    this.particles = [];   // hạt nước ép + mảnh vụn khi chém
    this.flashAlpha = 0;   // chớp trắng khi trúng bom
    this.shakeUntil = 0;   // rung màn hình khi trúng bom
    this.missed = 0;       // số quả bỏ lỡ (chế độ 3 mạng)
    this.locked = false;   // khoá thao tác khi đang chờ hiệu ứng nổ bom

    // Pha thưởng khi hết giờ (chế độ đếm giây): chém liên tục quả đặc biệt để ăn điểm
    this.bonusPhase = false;
    this.bonusTimeLeft = 0;
    this.bonusLastHitTime = 0;
    this.bonusEnding = false; // đang phát nổ, chờ trước khi kết thúc ván
    this.slowMoUntil = 0;     // mốc thời gian slow-motion khi nổ quả đặc biệt

    this.FRUIT_COLORS = {
      '🍓': '#f472b6', '🍎': '#f87171', '🍑': '#fda4af', '🍊': '#fb923c',
      '🥭': '#f59e0b', '🍏': '#a3e635', '🥝': '#84cc16', '🍇': '#a78bfa',
      '🍉': '#4ade80', '🥑': '#65a30d', '❄️': '#7dd3fc', '🍈': '#bef264',
    };

    this.EMOJIS = ['🍓','🍎','🍑','🍊','🥭','🍏','🥝','🍇','🍉','🥑'];
    this.SPECIAL_EMOJI = '❄️';
    this.DOUBLE_EMOJI = '🌟';
    this.BOMB_EMOJI = '💣';
    this.BONUS_EMOJI = '🍈'; // quả đặc biệt xuất hiện trong pha chém liên tục cuối giờ

    // Elements
    this.highScoreEl = null;
    this.scoreEl = null;
    this.subEl = null;
    this.profitEl = null;
    this.overlay = null;
    this.resultDiv = null;
    this.finalScoreEl = null;
    this.rewardEl = null;
    this.comboEl = null;
    this.bonusHitEl = null;
    this.replayBtn = null;
    this.canvasWrap = null;
    this.gameStatusEl = null;
    this.bonusHitCount = 0;

    this.initAfterAuth();
  }

  async initAfterAuth() {
    await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, user => {
        unsub();
        if (user) { this.uid = user.uid; resolve(); }
        else { location.href = '../../index.html'; }
      });
    });

    this.canvas = document.getElementById('fs-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scoreEl = document.getElementById('fs-score');
    this.highScoreEl = document.getElementById('fs-highscore');
    this.subEl = document.getElementById('fs-sub');
    this.profitEl = document.getElementById('fs-profit');
    this.overlay = document.getElementById('fs-overlay');
    this.resultDiv = document.getElementById('fs-result');
    this.finalScoreEl = document.getElementById('fs-final-score');
    this.rewardEl = document.getElementById('fs-reward');
    this.comboEl = document.getElementById('fs-combo');
    this.bonusHitEl = document.getElementById('fs-bonus-hit');
    this.replayBtn = document.getElementById('fs-replay-btn');
    this.canvasWrap = this.canvas.parentElement;
    this.gameStatusEl = document.getElementById('game-status');

    // Gắn sự kiện nút bấm TRƯỚC TIÊN, tránh trường hợp lỗi ở các bước phụ
    // bên dưới (balance / buff / high score) làm nút chọn chế độ bị "chết"
    // (im lặng, không có phản ứng gì) vì initAfterAuth() dừng giữa chừng.
    this.bindUI();

    try { this.listenBalance(); } catch (e) { console.error('listenBalance lỗi:', e); }
    try { this.refreshBuffCache(); } catch (e) { console.error('refreshBuffCache lỗi:', e); }
    try { this.loadHighScore(); } catch (e) { console.error('loadHighScore lỗi:', e); }

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Slice events
    this.canvas.addEventListener('mousedown', e => this.startSlice(e));
    this.canvas.addEventListener('mousemove', e => this.onSliceMove(e));
    this.canvas.addEventListener('mouseup', () => this.onSliceEnd());
    this.canvas.addEventListener('touchstart', e => { e.preventDefault(); this.startSlice(e.touches[0]); });
    this.canvas.addEventListener('touchmove', e => { e.preventDefault(); this.onSliceMove(e.touches[0]); });
    this.canvas.addEventListener('touchend', e => { e.preventDefault(); this.onSliceEnd(); });

    window.game = this;
  }

  listenBalance() {
    if (this.unsubBalance) this.unsubBalance();
    this.unsubBalance = subscribeBalance(pts => { this.balance = pts; });
  }

  async refreshBuffCache() {
    try {
      const { getPetData, getPetById, getTierById } = await import('../../pet.js');
      const d = await getPetData();
      const pet = d.activePet ? getPetById(d.activePet) : null;
      this.cachedBuffPct = pet ? (getTierById(pet.tier).buff || 0) : 0;
      this.cachedPetLabel = pet ? `${pet.emoji} ${pet.name}` : '🐾 Pet';
    } catch { this.cachedBuffPct = 0; this.cachedPetLabel = '🐾 Pet'; }
  }

  async loadHighScore() {
    try {
      const q = query(collection(db, 'fruit_slash_scores'), where('uid', '==', this.uid), orderBy('score', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) this.highScore = snap.docs[0].data().score || 0;
    } catch (e) {}
    this.highScoreEl.textContent = `🏆 ${this.highScore}`;
  }

  async saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.highScoreEl.textContent = `🏆 ${this.highScore}`;
      try {
        await setDoc(doc(collection(db, 'fruit_slash_scores')), {
          uid: this.uid, score: this.score, mode: this.gameMode, timestamp: new Date().toISOString()
        });
      } catch (e) {}
    }
  }

  bindUI() {
    document.querySelectorAll('.fs-mode-card').forEach(card => {
      card.addEventListener('click', () => {
        this.gameMode = card.dataset.mode;
        this.startGame();
      });
    });

    this.replayBtn.addEventListener('click', () => {
      this.resultDiv.style.display = 'none';
      this.overlay.style.display = 'flex';
      this.resetGame();
    });
  }

  resizeCanvas() {
    const wrap = this.canvas.parentElement;
    this.W = wrap.clientWidth;
    this.H = wrap.clientHeight;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
  }

  resetGame() {
    this.objects = [];
    this.trail = [];
    this.particles = [];
    this.flashAlpha = 0;
    this.missed = 0;
    this.locked = false;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.reward = 0;
    this.bonusPhase = false;
    this.bonusTimeLeft = 0;
    this.bonusLastHitTime = 0;
    this.bonusHitCount = 0;
    this.bonusEnding = false;
    this.slowMoUntil = 0;
    clearTimeout(this.comboTimer);
    clearTimeout(this.freezeTimer);
    clearTimeout(this.iceTimer);
    clearTimeout(this.doubleTimer);
    clearTimeout(this.doubleScoreTimer);
    this.isTimeFrozen = false;
    this.isScoreDoubled = false;
    this.updateUI();
    this.comboEl?.classList.remove('active');
    this.bonusHitEl?.classList.remove('active');
    if (this.bonusHitEl) this.bonusHitEl.textContent = '0 Hit';
    this.canvasWrap?.classList.remove('frozen');
    this.canvasWrap?.classList.remove('golden');
    this.gameStatusEl?.classList.remove('result-win');
    this.profitEl.className = 'stat-profit zero';
    this.profitEl.textContent = '+0';
    this.subEl.textContent = 'Sẵn sàng';
    this.scoreEl.textContent = '0';
  }

  startGame() {
    this.resetGame();
    this.overlay.style.display = 'none';
    this.resultDiv.style.display = 'none';
    this.isPlaying = true;
    this.subEl.textContent = 'Đang chơi';

    if (this.gameMode === 'timed') {
      this.totalTime = 60;
      this.timeLeft = this.totalTime;
      this.profitEl.textContent = `${this.timeLeft}s`;
      this.profitEl.className = 'stat-profit zero';
    } else {
      this.lives = this.maxLives;
      this.profitEl.textContent = `❤️ ${this.lives}`;
      this.profitEl.className = 'stat-profit zero';
    }

    this.lastFrameTime = performance.now();
    this.spawnObjects();
    // Trái băng & trái x2: mỗi trái chỉ xuất hiện DUY NHẤT 1 lần / ván,
    // ở 1 thời điểm ngẫu nhiên, cách nhau tối thiểu 2s để tránh trùng lúc.
    const iceDelay = 4000 + Math.random() * 8000; // 4s..12s
    const doubleDelay = 25000 + Math.random() * 10000; // rơi quanh giây 30 (25s..35s)
    this.scheduleSpecial(this.createIceFruit, 'iceTimer', iceDelay);
    this.scheduleSpecial(this.createDoubleFruit, 'doubleTimer', doubleDelay);
    this.gameLoop();
  }

  spawnObjects() {
    const spawnRate = 1800; // chu kỳ giữa các wave
    this.spawnInterval = setInterval(() => {
      if (!this.isPlaying || this.locked) return;
      const total = 2 + Math.floor(Math.random() * 7); // 2..8 trái / wave
      // Rải từng trái ra đều nhau, chỉ lệch nhẹ để không chồng lấp
      for (let i = 0; i < total; i++) {
        const delay = i * 170 + Math.random() * 40;
        setTimeout(() => {
          if (!this.isPlaying || this.locked) return;
          this.objects.push(this.createFruit());
        }, delay);
      }
      const elapsed = this.gameMode === 'timed' ? (this.totalTime - this.timeLeft) : (this.maxLives - this.lives) * 15;
      const bombChance = Math.min(0.3, 0.02 + elapsed * 0.005);
      if (Math.random() < bombChance) {
        const bombDelay = total * 170 + 150;
        setTimeout(() => {
          if (!this.isPlaying || this.locked) return;
          this.objects.push(this.createBomb());
        }, bombDelay);
      }
    }, spawnRate);
  }

  // Lên lịch trái đặc biệt (băng / x2) chỉ xuất hiện DUY NHẤT 1 lần trong ván
  scheduleSpecial(createFn, timerKey, delay) {
    this[timerKey] = setTimeout(() => {
      if (this.isPlaying && !this.locked) this.objects.push(createFn.call(this));
    }, delay);
  }

  // Tính vận tốc bay lên vừa đủ để trái không vượt quá khung hình
  randomRiseVY(minFrac = 0.35, maxFrac = 0.65) {
    const rise = this.H * (minFrac + Math.random() * (maxFrac - minFrac));
    return -Math.sqrt(2 * 0.13 * rise);
  }

  createFruit() {
    return {
      type: 'fruit',
      emoji: this.EMOJIS[Math.floor(Math.random() * this.EMOJIS.length)],
      special: false,
      double: false,
      x: Math.random() * this.W * 0.8 + this.W * 0.1,
      y: this.H + 30,
      vx: (Math.random() - 0.5) * 2,
      vy: this.randomRiseVY(),
      r: 19 + Math.random() * 11,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.18,
      hoverLeft: 16,
      hoverDone: false,
      sliced: false,
    };
  }

  createIceFruit() {
    return {
      type: 'fruit',
      emoji: this.SPECIAL_EMOJI,
      special: true,
      double: false,
      x: Math.random() * this.W * 0.8 + this.W * 0.1,
      y: this.H + 30,
      vx: (Math.random() - 0.5) * 2,
      vy: this.randomRiseVY(),
      r: 19 + Math.random() * 11,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.18,
      hoverLeft: 16,
      hoverDone: false,
      sliced: false,
    };
  }

  createDoubleFruit() {
    return {
      type: 'fruit',
      emoji: this.DOUBLE_EMOJI,
      special: false,
      double: true,
      x: Math.random() * this.W * 0.8 + this.W * 0.1,
      y: this.H + 30,
      vx: (Math.random() - 0.5) * 2,
      vy: this.randomRiseVY(),
      r: 19 + Math.random() * 11,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.18,
      hoverLeft: 16,
      hoverDone: false,
      sliced: false,
    };
  }

  createBomb() {
    return {
      type: 'bomb',
      emoji: this.BOMB_EMOJI,
      x: Math.random() * this.W * 0.8 + this.W * 0.1,
      y: this.H + 30,
      vx: (Math.random() - 0.5) * 1.4,
      vy: this.randomRiseVY(),
      r: 26,
      rot: 0,
      vr: (Math.random() - 0.5) * 0.06,
      hoverLeft: 16,
      hoverDone: false,
      sliced: false,
    };
  }

  startSlice(e) {
    if (!this.isPlaying) return;
    this.lastSliceX = e.clientX;
    this.lastSliceY = e.clientY;
  }

  onSliceMove(e) {
    if (!this.isPlaying || this.lastSliceX === undefined) return;
    const x = e.clientX, y = e.clientY;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.W / rect.width, scaleY = this.H / rect.height;
    const cx0 = (this.lastSliceX - rect.left) * scaleX, cy0 = (this.lastSliceY - rect.top) * scaleY;
    const cx1 = (x - rect.left) * scaleX, cy1 = (y - rect.top) * scaleY;

    this.trail.push({ x: cx1, y: cy1, t: performance.now() });
    if (this.trail.length > 20) this.trail.shift();

    this.checkSlice(cx0, cy0, cx1, cy1);
    this.lastSliceX = x; this.lastSliceY = y;
  }

  onSliceEnd() { this.lastSliceX = undefined; this.lastSliceY = undefined; }

  // Khoảng cách ngắn nhất từ điểm (px,py) tới đoạn thẳng (x0,y0)-(x1,y1)
  distToSegment(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - x0) * dx + (py - y0) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = x0 + t * dx, cy = y0 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  checkSlice(x0, y0, x1, y1) {
    if (this.locked) return;
    for (let obj of this.objects) {
      if (obj.type === 'bonusFruit') {
        const d = this.distToSegment(obj.x, obj.y, x0, y0, x1, y1);
        if (d < obj.r) this.hitBonusFruit(obj);
        continue;
      }
      if (obj.sliced || obj.type === 'half' || obj.type === 'particle') continue;
      const d = this.distToSegment(obj.x, obj.y, x0, y0, x1, y1);
      if (d < obj.r) {
        obj.sliced = true;
        if (obj.type === 'bomb') { this.handleBombHit(obj); return; }
        this.handleFruitHit(obj);
      }
    }
  }

  // Chém quả sao thưởng trong pha spam cuối giờ: mỗi nhát chém rời +10 điểm
  hitBonusFruit(obj) {
    const now = performance.now();
    if (now - this.bonusLastHitTime < 90) return; // chặn đếm trùng trong 1 lần kéo chuột
    this.bonusLastHitTime = now;
    this.score += 10;
    this.bonusHitCount++;
    if (this.bonusHitEl) {
      this.bonusHitEl.textContent = `${this.bonusHitCount} Hit`;
      this.bonusHitEl.classList.add('active');
    }
    this.spawnJuice(obj.x, obj.y, obj.emoji);
    this.updateUI();
  }

  // Bắt đầu pha thưởng khi hết giờ chế độ đếm giây
  startBonusPhase() {
    this.bonusPhase = true;
    this.bonusTimeLeft = 4;
    this.bonusLastHitTime = 0;
    this.bonusEnding = false;
    clearInterval(this.spawnInterval);
    this.objects = this.objects.filter(o => o.type === 'half');
    this.objects.push({
      type: 'bonusFruit', emoji: this.BONUS_EMOJI,
      x: this.W / 2, y: this.H + 30, r: 45, rot: 0,
      vr: 0.05, t: 0,
      startY: this.H + 30, targetY: this.H / 2,
      riseElapsed: 0, riseDuration: 0.5, arrived: false,
    });
    this.bonusHitCount = 0;
    if (this.bonusHitEl) {
      this.bonusHitEl.textContent = '0 Hit';
      this.bonusHitEl.classList.add('active');
    }
    this.subEl.textContent = 'CHÉM LIÊN TỤC!';
    window.showToast('⏱️ Hết giờ! Chém liên tục quả sao để ăn thêm điểm!', 'success');
  }

  handleFruitHit(obj) {
    let points = obj.special ? 30 : (obj.double ? 20 : 10);
    if (obj.special) this.activateFreeze();
    if (obj.double) this.activateDoubleScore();
    const now = Date.now();
    this.combo = (now - this.lastSliceTime < 500) ? this.combo + 1 : 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.lastSliceTime = now;
    const mult = this.combo >= 3 ? Math.min(this.combo, 5) : 1;
    const scoreMult = this.isScoreDoubled ? 2 : 1;
    this.score += points * mult * scoreMult;
    if (this.combo >= 3) {
      this.comboEl.textContent = `🔥 x${mult}`;
      this.comboEl.classList.add('active');
      clearTimeout(this.comboTimer);
      this.comboTimer = setTimeout(() => { this.comboEl.classList.remove('active'); this.combo = 0; }, 800);
    }
    this.splitFruit(obj);
    this.updateUI();
  }

  // Tách quả thành 2 nửa bay ngược hướng nhau + bắn nước ép
  splitFruit(obj) {
    const idx = this.objects.indexOf(obj);
    if (idx >= 0) this.objects.splice(idx, 1);
    for (const side of [-1, 1]) {
      this.objects.push({
        type: 'half', half: side, emoji: obj.emoji,
        x: obj.x, y: obj.y,
        vx: obj.vx + side * (3 + Math.random() * 2),
        vy: obj.vy - 2 - Math.random() * 2,
        r: obj.r, rot: obj.rot, vr: side * (0.15 + Math.random() * 0.15),
        life: 45,
      });
    }
    this.spawnJuice(obj.x, obj.y, obj.emoji);
  }

  // Hạt nước ép văng ra khi chém trúng
  spawnJuice(x, y, emoji) {
    const color = this.FRUIT_COLORS[emoji] || '#fbbf24';
    const count = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      this.particles.push({
        x, y, color,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        r: 2 + Math.random() * 3,
        life: 30 + Math.random() * 15,
      });
    }
  }

  handleBombHit(obj) {
    const idx = this.objects.indexOf(obj);
    if (idx >= 0) this.objects.splice(idx, 1);
    this.combo = 0;
    this.comboEl?.classList.remove('active');
    this.spawnExplosion(obj.x, obj.y);
    this.canvas.style.transform = 'translateX(6px)';
    setTimeout(() => this.canvas.style.transform = '', 90);

    // Xoá sạch trái cây còn lại trên bàn khi trúng bom
    for (const o of this.objects) {
      if (o.type === 'fruit') this.spawnJuice(o.x, o.y, o.emoji);
    }
    this.objects = this.objects.filter(o => o.type !== 'fruit');

    if (this.gameMode === 'timed') {
      // Chế độ đếm giây: trúng bom trừ nặng điểm + dọn sạch bàn, không thua ngay
      this.score = Math.max(0, this.score - 500);
      this.flashAlpha = 0.4;
      window.showToast('💣 Trúng bom! -500 điểm, quả trên bàn nổ sạch!', 'error');
      this.updateUI();
      return;
    }

    // Chế độ 3 mạng: trúng bom thua ngay
    this.locked = true;
    this.flashAlpha = 0.85;
    window.showToast('💣 Trúng bom! Game Over', 'error');
    this.updateUI();
    // Để hiệu ứng nổ kịp hiển thị trước khi hiện kết quả
    setTimeout(() => this.endGame(), 350);
  }

  // Hạt nổ khi trúng bom (đen/cam/đỏ, văng mạnh hơn nước ép)
  spawnExplosion(x, y) {
    const colors = ['#1f2937', '#f97316', '#ef4444', '#fbbf24'];
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 9;
      this.particles.push({
        x, y, color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        r: 3 + Math.random() * 5,
        life: 35 + Math.random() * 20,
      });
    }
  }

  // Quả đặc biệt (🍈) phát sáng rồi nổ tung nhiều hướng khi hết giờ pha thưởng
  spawnBonusBurst(x, y) {
    const colors = ['#bef264', '#facc15', '#fef08a', '#a3e635', '#d9f99d'];
    const rays = 16;
    // Tia sáng toả đều nhiều hướng
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const speed = 7 + Math.random() * 5;
      this.particles.push({
        x, y, color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 4 + Math.random() * 4,
        life: 45 + Math.random() * 20,
      });
    }
    // Mảnh vụn nổ ngẫu nhiên thêm cho dày hiệu ứng
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      this.particles.push({
        x, y, color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2 + Math.random() * 5,
        life: 35 + Math.random() * 20,
      });
    }
    this.flashAlpha = 0.55;
    window.showToast('🍈 Nổ tung!', 'success');
  }

  activateFreeze() {
    this.isTimeFrozen = true;
    this.canvasWrap?.classList.add('frozen');
    clearTimeout(this.freezeTimer);
    this.freezeTimer = setTimeout(() => {
      this.isTimeFrozen = false;
      this.canvasWrap?.classList.remove('frozen');
    }, 10000);
    window.showToast('❄️ Đóng băng thời gian 10 giây!', 'success');
  }

  activateDoubleScore() {
    this.isScoreDoubled = true;
    this.canvasWrap?.classList.add('golden');
    clearTimeout(this.doubleScoreTimer);
    this.doubleScoreTimer = setTimeout(() => {
      this.isScoreDoubled = false;
      this.canvasWrap?.classList.remove('golden');
    }, 10000);
    window.showToast('🌟 x2 điểm trong 10 giây!', 'success');
  }

  updateUI() {
    this.scoreEl.textContent = this.score;
    if (this.score > this.highScore) this.highScoreEl.textContent = `🏆 ${this.score}`;

    if (this.isPlaying) {
      if (this.gameMode === 'timed') {
        if (this.bonusPhase) {
          this.profitEl.textContent = `⚡${Math.ceil(this.bonusTimeLeft)}s`;
          this.profitEl.className = 'stat-profit positive';
        } else if (this.isTimeFrozen) {
          this.profitEl.textContent = `❄️ ${Math.ceil(this.timeLeft)}s`;
          this.profitEl.className = 'stat-profit frozen';
        } else if (this.isScoreDoubled) {
          this.profitEl.textContent = `🌟 x2 ${Math.ceil(this.timeLeft)}s`;
          this.profitEl.className = 'stat-profit golden';
        } else {
          this.profitEl.textContent = `${Math.ceil(this.timeLeft)}s`;
          this.profitEl.className = 'stat-profit zero';
        }
      } else if (this.isTimeFrozen) {
        this.profitEl.textContent = `❄️ ❤️ ${this.lives}`;
        this.profitEl.className = 'stat-profit frozen';
      } else if (this.isScoreDoubled) {
        this.profitEl.textContent = `🌟 x2 ❤️ ${this.lives}`;
        this.profitEl.className = 'stat-profit golden';
      } else {
        this.profitEl.textContent = `❤️ ${this.lives}`;
        this.profitEl.className = 'stat-profit zero';
      }
    } else {
      // Khi không chơi (kết thúc) profit đã được set trong endGame(), không thay đổi
    }
  }

  gameLoop() {
    if (!this.isPlaying) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    const slowFactor = (this.slowMoUntil && now < this.slowMoUntil) ? 0.35 : 1;
    const k = dt * 60 * slowFactor;
    this.ctx.clearRect(0, 0, this.W, this.H);

    if (this.gameMode === 'timed') {
      if (!this.bonusPhase) {
        if (!this.isTimeFrozen && !this.locked) this.timeLeft -= dt;
        if (this.timeLeft <= 0) { this.startBonusPhase(); }
      } else {
        this.bonusTimeLeft -= dt;
        if (this.bonusTimeLeft <= 0 && !this.bonusEnding) {
          this.bonusEnding = true;
          this.locked = true;
          const bonusObj = this.objects.find(o => o.type === 'bonusFruit');
          if (bonusObj) {
            this.spawnBonusBurst(bonusObj.x, bonusObj.y);
            const idx = this.objects.indexOf(bonusObj);
            if (idx >= 0) this.objects.splice(idx, 1);
          }
          this.slowMoUntil = now + 1400;
          setTimeout(() => this.endGame(), 1400);
        }
      }
    }

    // ----- Quả / bom còn nguyên -----
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (obj.type === 'fruit' || obj.type === 'bomb') {
        obj.x += obj.vx * k;
        // Đứng khựng một chút ở đỉnh trước khi rơi xuống
        const nearApex = Math.abs(obj.vy) < 0.9;
        if (nearApex && !obj.hoverDone && obj.hoverLeft > 0) {
          obj.hoverLeft -= k;
          obj.vy += 0.035 * k;
        } else {
          obj.hoverDone = true;
          obj.y += obj.vy * k;
          obj.vy += 0.13 * k;
        }
        obj.rot += obj.vr * k;
        if (obj.y > this.H + 60 || obj.x < -60 || obj.x > this.W + 60) {
          // Bỏ lỡ quả (không phải bom) trong chế độ 3 mạng -> mất 1 mạng
          if (obj.type === 'fruit' && this.gameMode === 'lives' && !this.locked) {
            this.missed++;
            this.lives--;
            this.updateUI();
            if (this.lives <= 0) { this.objects.splice(i, 1); this.endGame(); return; }
            window.showToast(`💨 Vuột mất quả! Còn ${this.lives} mạng`, 'warn');
          }
          this.objects.splice(i, 1);
          continue;
        }
        this.ctx.save();
        this.ctx.translate(obj.x, obj.y);
        this.ctx.rotate(obj.rot);
        if (obj.type === 'bomb') {
          this.ctx.beginPath();
          this.ctx.arc(0, 0, obj.r * 0.95, 0, Math.PI * 2);
          this.ctx.strokeStyle = '#a855f7';
          this.ctx.lineWidth = 4;
          this.ctx.shadowColor = '#c084fc';
          this.ctx.shadowBlur = 10;
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;
        } else if (obj.special) {
          this.ctx.beginPath();
          this.ctx.arc(0, 0, obj.r * 0.95, 0, Math.PI * 2);
          this.ctx.strokeStyle = '#38bdf8';
          this.ctx.lineWidth = 4;
          this.ctx.shadowColor = '#7dd3fc';
          this.ctx.shadowBlur = 14;
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;
        } else if (obj.double) {
          this.ctx.beginPath();
          this.ctx.arc(0, 0, obj.r * 0.95, 0, Math.PI * 2);
          this.ctx.strokeStyle = '#facc15';
          this.ctx.lineWidth = 4;
          this.ctx.shadowColor = '#fde047';
          this.ctx.shadowBlur = 14;
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;
        }
        this.ctx.font = `${obj.r * 2}px serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(obj.emoji, 0, 0);
        this.ctx.restore();
      } else if (obj.type === 'bonusFruit') {
        obj.t += dt;
        if (!obj.arrived) {
          obj.riseElapsed += dt;
          const p = Math.min(1, obj.riseElapsed / obj.riseDuration);
          const eased = 1 - Math.pow(1 - p, 3); // ease-out: bay lên nhanh rồi khựng lại
          obj.y = obj.startY + (obj.targetY - obj.startY) * eased;
          if (p >= 1) obj.arrived = true;
        } else {
          obj.y = obj.targetY + Math.sin(obj.t * 4) * 8;
        }
        obj.rot += obj.vr * k;
        this.ctx.save();
        this.ctx.translate(obj.x, obj.y);
        this.ctx.rotate(obj.rot);
        // Vòng sáng nhấp nháy quanh quả đặc biệt
        const pulse = 22 + Math.sin(obj.t * 6) * 10;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, obj.r * 1.08, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#bef264';
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = '#d9f99d';
        this.ctx.shadowBlur = pulse + 18;
        this.ctx.stroke();
        this.ctx.shadowBlur = pulse;
        this.ctx.shadowColor = '#facc15';
        this.ctx.font = `${obj.r * 2}px serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(obj.emoji, 0, 0);
        this.ctx.restore();
      } else if (obj.type === 'half') {
        obj.x += obj.vx * k; obj.y += obj.vy * k; obj.vy += 0.3 * k;
        obj.rot += obj.vr * k;
        obj.life -= k;
        if (obj.life <= 0 || obj.y > this.H + 80) { this.objects.splice(i, 1); continue; }
        const alpha = Math.min(1, obj.life / 15);
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.translate(obj.x, obj.y);
        this.ctx.rotate(obj.rot);
        this.ctx.beginPath();
        if (obj.half < 0) this.ctx.rect(-obj.r * 1.1, -obj.r * 1.1, obj.r * 1.1, obj.r * 2.2);
        else this.ctx.rect(0, -obj.r * 1.1, obj.r * 1.1, obj.r * 2.2);
        this.ctx.clip();
        this.ctx.font = `${obj.r * 2}px serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(obj.emoji, 0, 0);
        this.ctx.restore();
      }
    }

    // ----- Hạt nước ép / mảnh nổ -----
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * k; p.y += p.vy * k; p.vy += 0.3 * k; p.vx *= Math.pow(0.97, k);
      p.life -= k;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      this.ctx.globalAlpha = Math.max(0, p.life / 40);
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }

    // ----- Vệt lưỡi dao -----
    this.trail = this.trail.filter(pt => now - pt.t < 140);
    if (this.trail.length > 1) {
      this.ctx.save();
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowColor = 'rgba(224,242,254,0.9)';
      this.ctx.shadowBlur = 12;
      for (let i = 1; i < this.trail.length; i++) {
        const p0 = this.trail[i - 1], p1 = this.trail[i];
        const age = (now - p1.t) / 140;
        this.ctx.globalAlpha = Math.max(0, 1 - age);
        this.ctx.strokeStyle = '#f0f9ff';
        this.ctx.lineWidth = Math.max(1, 7 * (1 - age));
        this.ctx.beginPath();
        this.ctx.moveTo(p0.x, p0.y);
        this.ctx.lineTo(p1.x, p1.y);
        this.ctx.stroke();
      }
      this.ctx.restore();
      this.ctx.globalAlpha = 1;
    }

    // ----- Chớp trắng khi trúng bom -----
    if (this.flashAlpha > 0) {
      this.ctx.fillStyle = `rgba(255,255,255,${this.flashAlpha})`;
      this.ctx.fillRect(0, 0, this.W, this.H);
      this.flashAlpha -= 0.06 * k;
    }

    this.updateUI();
    this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
  }

  async endGame() {
    this.isPlaying = false;
    cancelAnimationFrame(this.gameLoopId);
    clearInterval(this.spawnInterval);
    clearTimeout(this.iceTimer);
    clearTimeout(this.doubleTimer);
    clearTimeout(this.doubleScoreTimer);
    this.isScoreDoubled = false;
    this.canvasWrap?.classList.remove('golden');

    let reward = Math.floor(this.score / 10);
    let buffBonus = 0;
    if (this.cachedBuffPct > 0 && reward > 0) {
      buffBonus = Math.round(reward * this.cachedBuffPct / 100);
      reward += buffBonus;
    }
    try {
      if (reward > 0) {
        await addPoints('Casino', 'Thắng Fruit Slash', reward, false);
        if (buffBonus > 0) window.showToast(`${this.cachedPetLabel} +${buffBonus.toLocaleString('vi-VN')}〄 (${this.cachedBuffPct}%)!`, 'success');
      }
    } catch (e) {}
    await this.saveHighScore();

    // Cập nhật status bar cho kết thúc
    this.subEl.textContent = 'Kết thúc';
    this.profitEl.textContent = `+${reward}`;
    this.profitEl.className = 'stat-profit positive';
    this.reward = reward;
    this.bonusHitEl?.classList.remove('active');
    if (reward > 0) this.gameStatusEl?.classList.add('result-win');

    // Hiển thị kết quả bên trong bàn chứa hoa quả (canvas wrap)
    this.finalScoreEl.textContent = this.score;
    this.rewardEl.textContent = reward;
    this.resultDiv.style.display = 'flex';
  }
}

new FruitSlash();