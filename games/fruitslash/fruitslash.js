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
    this.gameLoopId = null;
    this.balance = 0;
    this.unsubBalance = null;
    this.cachedBuffPct = 0;
    this.cachedPetLabel = '🐾 Pet';
    this.lastSliceX = undefined;
    this.lastSliceY = undefined;
    this.reward = 0; // lưu tiền thưởng khi kết thúc

    this.EMOJIS = ['🍎','🍊','🍋','🍉','🍇','🍓','🍒','🍑','🥝','🍌'];
    this.SPECIAL_EMOJI = '❄️';
    this.BOMB_EMOJI = '💣';

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
    this.freezeEl = null;
    this.replayBtn = null;

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
    this.freezeEl = document.getElementById('fs-freeze');
    this.replayBtn = document.getElementById('fs-replay-btn');

    this.listenBalance();
    this.refreshBuffCache();
    this.loadHighScore();
    this.bindUI();

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
    document.querySelectorAll('.fs-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fs-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.gameMode = btn.dataset.mode;
        document.getElementById('fs-time-select').style.display = this.gameMode === 'timed' ? 'block' : 'none';
      });
    });

    document.getElementById('fs-start-btn').addEventListener('click', () => this.startGame());
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
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.reward = 0;
    clearTimeout(this.comboTimer);
    clearTimeout(this.freezeTimer);
    this.isTimeFrozen = false;
    this.updateUI();
    this.comboEl?.classList.remove('active');
    this.freezeEl?.classList.remove('active');
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
      this.totalTime = parseInt(document.getElementById('fs-time-selector').value);
      this.timeLeft = this.totalTime;
      this.profitEl.textContent = `${this.timeLeft}s`;
      this.profitEl.className = 'stat-profit zero';
    } else {
      this.lives = this.maxLives;
      this.profitEl.textContent = `❤️ ${this.lives}`;
      this.profitEl.className = 'stat-profit zero';
    }

    this.spawnObjects();
    this.gameLoop();
  }

  spawnObjects() {
    const spawnRate = 800;
    this.spawnInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) this.objects.push(this.createFruit());
      const elapsed = this.gameMode === 'timed' ? (this.totalTime - this.timeLeft) : (this.maxLives - this.lives) * 15;
      const bombChance = Math.min(0.3, 0.02 + elapsed * 0.005);
      if (Math.random() < bombChance) this.objects.push(this.createBomb());
    }, spawnRate);
  }

  createFruit() {
    const isSpecial = Math.random() < 0.08;
    return {
      type: 'fruit',
      emoji: isSpecial ? this.SPECIAL_EMOJI : this.EMOJIS[Math.floor(Math.random() * this.EMOJIS.length)],
      special: isSpecial,
      x: Math.random() * this.W * 0.8 + this.W * 0.1,
      y: this.H + 30,
      vx: (Math.random() - 0.5) * 3,
      vy: -(10 + Math.random() * 6),
      r: 25 + Math.random() * 15,
      sliced: false,
    };
  }

  createBomb() {
    return {
      type: 'bomb',
      emoji: this.BOMB_EMOJI,
      x: Math.random() * this.W * 0.8 + this.W * 0.1,
      y: this.H + 30,
      vx: (Math.random() - 0.5) * 2,
      vy: -(10 + Math.random() * 6),
      r: 30,
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
    this.checkSlice((x - rect.left) * scaleX, (y - rect.top) * scaleY);
    this.lastSliceX = x; this.lastSliceY = y;
  }

  onSliceEnd() { this.lastSliceX = undefined; this.lastSliceY = undefined; }

  checkSlice(cx, cy) {
    for (let obj of this.objects) {
      if (obj.sliced) continue;
      const dx = cx - obj.x, dy = cy - obj.y;
      if (dx * dx + dy * dy < obj.r * obj.r) {
        obj.sliced = true;
        obj.type === 'bomb' ? this.handleBombHit() : this.handleFruitHit(obj);
        break;
      }
    }
  }

  handleFruitHit(obj) {
    let points = obj.special ? 30 : 10;
    if (obj.special) this.activateFreeze();
    const now = Date.now();
    this.combo = (now - this.lastSliceTime < 500) ? this.combo + 1 : 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.lastSliceTime = now;
    const mult = this.combo >= 3 ? Math.min(this.combo, 5) : 1;
    this.score += points * mult;
    if (this.combo >= 3) {
      this.comboEl.textContent = `🔥 x${mult}`;
      this.comboEl.classList.add('active');
      clearTimeout(this.comboTimer);
      this.comboTimer = setTimeout(() => { this.comboEl.classList.remove('active'); this.combo = 0; }, 800);
    }
    this.updateUI();
  }

  handleBombHit() {
    if (this.gameMode === 'timed') {
      this.score = Math.max(0, this.score - 50);
      window.showToast('💥 Trúng bom! -50 điểm', 'error');
    } else {
      this.lives--;
      if (this.lives <= 0) { this.endGame(); return; }
    }
    this.combo = 0;
    this.comboEl?.classList.remove('active');
    this.canvas.style.transform = 'translateX(5px)';
    setTimeout(() => this.canvas.style.transform = '', 100);
    this.updateUI();
  }

  activateFreeze() {
    this.isTimeFrozen = true;
    this.freezeEl.textContent = '❄️ ĐÓNG BĂNG 3s';
    this.freezeEl.classList.add('active');
    clearTimeout(this.freezeTimer);
    this.freezeTimer = setTimeout(() => {
      this.isTimeFrozen = false;
      this.freezeEl.classList.remove('active');
    }, 3000);
    window.showToast('Đóng băng thời gian 3 giây!', 'success');
  }

  updateUI() {
    this.scoreEl.textContent = this.score;
    if (this.score > this.highScore) this.highScoreEl.textContent = `🏆 ${this.score}`;

    if (this.isPlaying) {
      if (this.gameMode === 'timed') {
        this.profitEl.textContent = `${Math.ceil(this.timeLeft)}s`;
        this.profitEl.className = 'stat-profit zero';
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
    this.ctx.clearRect(0, 0, this.W, this.H);

    if (this.gameMode === 'timed') {
      if (!this.isTimeFrozen) this.timeLeft -= 1/60;
      if (this.timeLeft <= 0) { this.endGame(); return; }
    }

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      obj.x += obj.vx; obj.y += obj.vy; obj.vy += 0.25;
      if (obj.y > this.H + 60 || obj.x < -60 || obj.x > this.W + 60) {
        this.objects.splice(i, 1); continue;
      }
      this.ctx.font = `${obj.r * (obj.sliced ? 1.5 : 2)}px serif`;
      this.ctx.globalAlpha = obj.sliced ? 0.4 : 1;
      this.ctx.fillText(obj.emoji, obj.x - obj.r, obj.y + (obj.sliced ? -obj.r * 0.5 : obj.r * 0.5));
      this.ctx.globalAlpha = 1;
    }

    this.updateUI();
    this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
  }

  async endGame() {
    this.isPlaying = false;
    cancelAnimationFrame(this.gameLoopId);
    clearInterval(this.spawnInterval);

    let reward = this.score;
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

    // Hiển thị kết quả dưới canvas
    this.finalScoreEl.textContent = this.score;
    this.rewardEl.textContent = reward;
    this.resultDiv.style.display = 'block';
  }
}

new FruitSlash();