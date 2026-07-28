// === BÀN CỜ CÁ NGỰA 52 Ô (15×15) ===
// Đi theo chiều kim đồng hồ
const TRACK = [
  [8,13],[7,13],[6,13],[5,13],[4,13],[3,13],[2,13],[1,13],  // 0-7  cánh PHẢI lên
  [0,12],[0,11],[0,10],[0,9],                                 // 8-11 góc trên-phải
  [0,8],[0,7],[0,6],[0,5],[0,4],[0,3],[0,2],[0,1],            // 12-19 cánh TRÊN trái
  [1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],            // 20-27 góc trên-trái xuống
  [9,0],[10,0],[11,0],                                          // 28-30 cánh TRÁI xuống
  [12,1],[13,1],[14,2],[14,3],[14,4],[14,5],                    // 31-36 góc dưới-trái
  [14,6],[14,7],[14,8],[14,9],                                   // 37-40 cánh DƯỚI phải
  [14,10],[14,11],[14,12],[14,13],                               // 41-44 góc dưới-phải
  [13,14],[12,14],[11,14],[10,14],[9,14],[8,14],                // 45-50 cạnh PHẢI lên
  [7,14]                                                         // 51 về sát vị trí 0
];

const START_POS = { red: 0, green: 13, yellow: 25, blue: 38 };
// Red [8,13] | Green [0,7] | Yellow [6,0] | Blue [14,7] — giữa mỗi cánh

// === HOME STRETCH — 6 ô cho mỗi màu ===
const HOME_STRETCH = {
  // Đỏ (phải): hàng 7, cột 12→7 (đi trái về tâm)
  red:  [[7,12],[7,11],[7,10],[7,9],[7,8],[7,7]],
  // Xanh (dưới): cột 7, hàng 13→8 (đi lên về tâm)
  blue: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  // Lục (trên): cột 7, hàng 1→6 (đi xuống về tâm)
  green:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  // Vàng (trái): hàng 7, cột 4→9 (đi phải về tâm)
  yellow:[[7,4],[7,5],[7,6],[7,7],[7,8],[7,9]]
};

// === BASE POSITIONS (chuồng — 2×2) ===
const BASE_POS = {
  red:    { r: 10, c: 11 },  // góc dưới-phải
  blue:   { r: 10, c: 2 },   // góc dưới-trái
  green:  { r: 2, c: 11 },   // góc trên-phải
  yellow: { r: 2, c: 2 }     // góc trên-trái
};

const COLORS = ['red','blue','green','yellow'];
const COLOR_NAMES = { red: 'Đỏ', blue: 'Xanh', green: 'Lục', yellow: 'Vàng' };
const COLOR_HEX = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308' };
const COLOR_ARMS = {
  red:    { c1: 9,  c2: 14, r1: 6,  r2: 8  },   // phải: 3×6
  blue:   { c1: 6,  c2: 8,  r1: 9,  r2: 14 },   // dưới: 6×3
  green:  { c1: 6,  c2: 8,  r1: 0,  r2: 5  },   // trên: 6×3
  yellow: { c1: 0,  c2: 5,  r1: 6,  r2: 8  }    // trái: 3×6
};
const COLOR_QUADS = {
  red:    { c1: 9,  c2: 14, r1: 0,  r2: 5  },  // góc trên-phải
  blue:   { c1: 9,  c2: 14, r1: 9,  r2: 14 },  // góc dưới-phải
  green:  { c1: 0,  c2: 5,  r1: 9,  r2: 14 },  // góc dưới-trái
  yellow: { c1: 0,  c2: 5,  r1: 0,  r2: 5  }   // góc trên-trái
};

const TRACK_LEN = 52;
function mod(n, m) { return ((n % m) + m) % m; }

class LudoPiece {
  constructor(color, id) {
    this.color = color;
    this.id = id;
    this.pos = -1;     // -1 = base, 0-51 = track
    this.homeIdx = -1; // -1 = chưa vào, 0-5 = trong chuồng
    this.finished = false;
  }
}

class LudoGame {
  constructor() {
    this.playerCount = 3;
    this.playerColor = 'blue';
    this.players = [];
    this.currentPlayer = 0;
    this.diceValue = 0;
    this.phase = 'menu';
    this.consecutiveSixes = 0;
    this.canRoll = true;
    this.movablePieces = [];
    this.selectedPiece = null;
    this.lastDice = 0;
    this.init();
  }

  init() {
    this.setPlayerCount(this.playerCount);
    this.setColor(this.playerColor);
  }

  setPlayerCount(n) {
    this.playerCount = n;
    document.querySelectorAll('.ld-player-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.n) === n);
    });
  }

  setColor(c) {
    this.playerColor = c;
    document.querySelectorAll('.ld-color-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.color === c);
    });
  }

  startGame() {
    const n = this.playerCount;
    const colors = COLORS.slice(0, n);
    const idx = colors.indexOf(this.playerColor);
    const ordered = [...colors.slice(idx), ...colors.slice(0, idx)];

    this.players = ordered.map((c, i) => ({
      color: c,
      name: i === 0 ? 'Bạn' : `Bot ${COLOR_NAMES[c]}`,
      isHuman: i === 0,
      pieces: [0,1,2,3].map(id => new LudoPiece(c, id)),
      finishedCount: 0
    }));

    this.currentPlayer = 0;
    this.phase = 'rolling';
    this.canRoll = true;
    this.movablePieces = [];
    this.lastDice = 0;
    this.consecutiveSixes = 0;

    document.getElementById('ld-start').style.display = 'none';
    const gameEl = document.getElementById('ld-game');
    gameEl.style.display = 'block';
    gameEl.classList.add('visible');

    this.renderPlayers();
    this.renderBoard();
    this.updateUI();
    this.setInfo(`Lượt của bạn — tung xúc xắc!`);
  }

  // ====== XÚC XẮC ======
  rollDice() {
    if (this.phase === 'finished' || !this.canRoll) return;
    const cur = this.players[this.currentPlayer];
    if (cur.finishedCount === 4) { this.nextTurn(); return; }

    this.canRoll = false;
    const btn = document.getElementById('ld-dice-btn');
    btn.classList.add('rolling');

    let count = 0;
    const interval = setInterval(() => {
      btn.textContent = Math.floor(Math.random() * 6) + 1;
      if (++count > 12) {
        clearInterval(interval);
        btn.classList.remove('rolling');
        const val = Math.floor(Math.random() * 6) + 1;
        this.lastDice = val;
        btn.textContent = val === 6 ? '⚡' : val;

        this.consecutiveSixes = val === 6 ? this.consecutiveSixes + 1 : 0;
        if (this.consecutiveSixes >= 3) {
          this.setInfo('⚡ 3 lần 6 liên tiếp! Mất lượt!', 'warn');
          this.consecutiveSixes = 0;
          setTimeout(() => this.nextTurn(), 1000);
          return;
        }
        this.handleDiceRolled(val);
      }
    }, 60);
  }

  handleDiceRolled(val) {
    const player = this.players[this.currentPlayer];
    const movable = [];

    for (const piece of player.pieces) {
      if (piece.finished) continue;
      if (piece.pos === -1) { if (val === 6) movable.push(piece); }
      else if (piece.homeIdx >= 0) { if (piece.homeIdx + val <= 5) movable.push(piece); }
      else { movable.push(piece); }
    }

    this.movablePieces = movable;

    if (movable.length === 0) {
      this.setInfo(`🎲 ${val} — Không có nước đi`, 'warn');
      setTimeout(() => this.nextTurn(), 800);
      return;
    }

    if (!player.isHuman) {
      setTimeout(() => this.movePiece(this.aiChoosePiece(movable, val), val), 400);
      return;
    }

    if (movable.length === 1) {
      this.movePiece(movable[0], val);
      return;
    }

    this.phase = 'moving';
    this.setInfo(`🎲 ${val} — Chọn quân để di chuyển`);
    this.renderBoard(true);
  }

  aiChoosePiece(movable, val) {
    const player = this.players[this.currentPlayer];
    let best = movable[0], bestScore = -9999;
    for (const piece of movable) {
      let score = 0;
      const newPos = piece.pos >= 0 ? mod(piece.pos + val, TRACK_LEN) : -1;
      if (newPos >= 0 && this.getPiecesAt(newPos, player.color).length > 0) score += 100;
      if (piece.pos >= 0 && piece.homeIdx === -1 && this.wouldEnterHome(piece, val)) score += 80;
      if (piece.homeIdx >= 0) score += 60 + piece.homeIdx + val;
      if (piece.pos === -1 && val === 6) score += 40;
      if (newPos >= 0) {
        if (newPos === START_POS[player.color]) score += 30;
        COLORS.forEach(c => { if (c !== player.color && START_POS[c] === newPos) score += 30; });
      }
      if (piece.pos >= 0) score -= Math.max(0, 50 - mod(piece.pos - START_POS[player.color], TRACK_LEN)) * 0.5;
      if (score > bestScore) { bestScore = score; best = piece; }
    }
    return best;
  }

  // ====== DI CHUYỂN ======
  selectPiece(pieceId) {
    if (this.phase !== 'moving') return;
    const player = this.players[this.currentPlayer];
    if (!player.isHuman) return;
    const piece = player.pieces.find(p => p.id === pieceId);
    if (!piece || !this.movablePieces.includes(piece)) return;
    this.movePiece(piece, this.lastDice);
  }

  movePiece(piece, val) {
    const player = this.players[this.currentPlayer];

    if (piece.pos === -1 && val === 6) {
      piece.pos = START_POS[player.color];
      piece.homeIdx = -1;
      this.checkCapture(piece);
    } else if (piece.homeIdx >= 0) {
      piece.homeIdx += val;
      if (piece.homeIdx >= 6) {
        piece.homeIdx = 5;
        piece.finished = true;
        player.finishedCount++;
        this.setInfo(`🏁 ${COLOR_NAMES[player.color]} đã về đích!`, 'success');
      }
    } else {
      if (this.wouldEnterHome(piece, val)) {
        const start = START_POS[player.color];
        const steps = mod(piece.pos - start, TRACK_LEN);
        const overage = steps + val - 50;
        piece.homeIdx = Math.min(Math.max(0, overage), 5);
        piece.pos = -2;
        if (overage >= 6) {
          piece.finished = true;
          player.finishedCount++;
          this.setInfo(`🏁 ${COLOR_NAMES[player.color]} đã về đích!`, 'success');
        }
      } else {
        piece.pos = mod(piece.pos + val, TRACK_LEN);
        this.checkCapture(piece);
      }
    }

    this.renderBoard();
    this.updateUI();
    this.renderPlayers();

    if (player.finishedCount === 4) {
      this.showResult(player);
      return;
    }

    if (val === 6) {
      this.setInfo(`⚡ Được tung thêm!`);
      this.canRoll = true;
      this.phase = 'rolling';
    } else {
      this.nextTurn();
    }
  }

  wouldEnterHome(piece, val) {
    if (piece.pos < 0 || piece.homeIdx >= 0) return false;
    const start = START_POS[this.players[this.currentPlayer].color];
    const steps = mod(piece.pos - start, TRACK_LEN);
    return steps + val >= 50;
  }

  checkCapture(piece) {
    const player = this.players[this.currentPlayer];
    if (piece.pos < 0) return;
    for (const other of this.players) {
      if (other.color === player.color) continue;
      for (const op of other.pieces) {
        if (op.pos === piece.pos && op.homeIdx === -1) {
          op.pos = -1;
          op.homeIdx = -1;
          this.setInfo(`🎯 Ăn quân ${COLOR_NAMES[other.color]}!`, 'success');
          return;
        }
      }
    }
  }

  getPiecesAt(trackPos, excludeColor) {
    const found = [];
    for (const p of this.players) {
      if (p.color === excludeColor) continue;
      for (const piece of p.pieces) {
        if (piece.pos === trackPos && piece.homeIdx === -1) found.push(piece);
      }
    }
    return found;
  }

  // ====== TURN ======
  nextTurn() {
    this.phase = 'rolling';
    this.canRoll = true;
    this.consecutiveSixes = 0;

    let next = (this.currentPlayer + 1) % this.players.length;
    let attempts = 0;
    while (this.players[next].finishedCount === 4 && attempts < this.players.length) {
      next = (next + 1) % this.players.length;
      attempts++;
    }
    if (attempts >= this.players.length) return;

    this.currentPlayer = next;
    const player = this.players[next];
    this.renderBoard();
    this.updateUI();
    this.renderPlayers();

    if (player.isHuman) {
      this.setInfo(`Lượt của bạn — tung xúc xắc!`);
    } else {
      this.setInfo(`🧠 ${player.name} đang suy nghĩ...`);
      this.canRoll = false;
      setTimeout(() => this.rollDice(), 800 + Math.random() * 600);
    }
  }

  // ====== VẼ BÀN CỜ (VẼ LẠI HOÀN TOÀN) ======
  renderBoard(highlight = false) {
    const canvas = document.getElementById('ld-board-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cell = w / 15;

    // === NỀN ===
    ctx.fillStyle = '#f8f0e3';
    ctx.fillRect(0, 0, w, h);

    // === 4 GÓC MÀU (quadrants) ===
    ctx.globalAlpha = 0.12;
    for (const c of COLORS) {
      const q = COLOR_QUADS[c];
      ctx.fillStyle = COLOR_HEX[c];
      ctx.fillRect(q.c1 * cell, q.r1 * cell, (q.c2 - q.c1 + 1) * cell, (q.r2 - q.r1 + 1) * cell);
    }
    ctx.globalAlpha = 1;

    // === 4 CÁNH TAY ===
    ctx.globalAlpha = 0.25;
    for (const c of COLORS) {
      const a = COLOR_ARMS[c];
      ctx.fillStyle = COLOR_HEX[c];
      ctx.fillRect(a.c1 * cell, a.r1 * cell, (a.c2 - a.c1 + 1) * cell, (a.r2 - a.r1 + 1) * cell);
    }
    ctx.globalAlpha = 1;

    // === TRUNG TÂM 3×3 ===
    ctx.fillStyle = '#fbbf24'; ctx.globalAlpha = 0.15;
    ctx.fillRect(6 * cell, 6 * cell, 3 * cell, 3 * cell);
    ctx.globalAlpha = 1;

    // Đường viền trung tâm
    ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 2;
    ctx.strokeRect(6 * cell, 6 * cell, 3 * cell, 3 * cell);

    // === VẼ ĐƯỜNG ĐUA (52 ô) ===
    for (let i = 0; i < 52; i++) {
      const [r, c] = TRACK[i];
      const x = c * cell, y = r * cell;
      const pad = 2;

      // Xác định màu nền ô
      let cellColor = 'rgba(255,255,255,0.7)';
      let isStart = false;
      for (const [color, pos] of Object.entries(START_POS)) {
        if (pos === i) {
          cellColor = COLOR_HEX[color];
          isStart = true;
          break;
        }
      }

      ctx.fillStyle = cellColor;
      ctx.globalAlpha = isStart ? 0.5 : 0.7;
      ctx.fillRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2);

      // Viền ô
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2);
      ctx.globalAlpha = 1;

      // Nếu là ô xuất phát, vẽ sao
      if (isStart) {
        const cx = x + cell/2, cy = y + cell/2;
        ctx.fillStyle = '#fff';
        ctx.font = `${cell * 0.4}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', cx, cy);
      }
    }

    // === BASE (chuồng) ===
    for (const [color, pos] of Object.entries(BASE_POS)) {
      const x = pos.c * cell, y = pos.r * cell;
      const s = cell * 2;

      // Nền
      ctx.fillStyle = COLOR_HEX[color];
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x, y, s, s);
      ctx.globalAlpha = 1;

      // Viền
      ctx.strokeStyle = COLOR_HEX[color];
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, s, s);

      // Chấm tròn nhỏ cho 4 vị trí quân
      for (let pi = 0; pi < 4; pi++) {
        const bx = x + (pi % 2) * cell + cell/2;
        const by = y + Math.floor(pi / 2) * cell + cell/2;
        ctx.beginPath();
        ctx.arc(bx, by, cell * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fill();
      }
    }

    // === HOME STRETCH ===
    for (const [color, cells] of Object.entries(HOME_STRETCH)) {
      ctx.fillStyle = COLOR_HEX[color];
      ctx.globalAlpha = 0.25;
      for (const [r, c] of cells) {
        ctx.fillRect(c * cell + 3, r * cell + 3, cell - 6, cell - 6);
        ctx.strokeStyle = COLOR_HEX[color];
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 1;
        ctx.strokeRect(c * cell + 3, r * cell + 3, cell - 6, cell - 6);
      }
      ctx.globalAlpha = 1;
    }

    // === ĐÁNH SỐ Ô XUẤT PHÁT ===
    for (const [color, posIdx] of Object.entries(START_POS)) {
      const [r, c] = TRACK[posIdx];
      const cx = c * cell + cell/2, cy = r * cell + cell/2;
      ctx.fillStyle = COLOR_HEX[color];
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${cell * 0.35}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', cx, cy + 1);
    }

    // === VẼ QUÂN CỜ ===
    for (const player of this.players) {
      for (const piece of player.pieces) {
        if (piece.finished) continue;
        let px, py;
        const isMovable = highlight && this.movablePieces.includes(piece) && player.isHuman && this.phase === 'moving';

        if (piece.homeIdx >= 0) {
          // Trong đường về — đặt dọc theo home stretch
          const cells = HOME_STRETCH[player.color];
          if (cells && cells[piece.homeIdx]) {
            const [r, c] = cells[piece.homeIdx];
            px = (c + 0.5) * cell;
            py = (r + 0.5) * cell;
          } else {
            // Fallback: xoay quanh trung tâm
            const angle = (COLORS.indexOf(player.color) / 4) * Math.PI * 2;
            px = 7.5 * cell + Math.cos(angle) * cell * 1.2;
            py = 7.5 * cell + Math.sin(angle) * cell * 1.2;
          }
        } else if (piece.pos === -1) {
          // Trong chuồng — 4 quân xếp 2×2
          const base = BASE_POS[player.color];
          const bx = piece.id % 2, by = Math.floor(piece.id / 2);
          px = (base.c + 0.5 + bx * 0.8) * cell;
          py = (base.r + 0.5 + by * 0.8) * cell;
        } else {
          // Trên track
          if (piece.pos >= 0 && piece.pos < TRACK.length) {
            const [r, c] = TRACK[piece.pos];
            px = (c + 0.5) * cell;
            py = (r + 0.5) * cell;
          } else {
            continue;
          }
        }

        // Vẽ viền chọn (nếu movable)
        const size = cell * 0.32;
        if (isMovable) {
          ctx.beginPath();
          ctx.arc(px, py, size + 5, 0, Math.PI * 2);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Hình tròn quân cờ
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = COLOR_HEX[player.color];
        ctx.fill();
        ctx.strokeStyle = isMovable ? '#fbbf24' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = isMovable ? 3 : 1.5;
        ctx.stroke();

        // Trắng tròn nhỏ bên trong
        ctx.beginPath();
        ctx.arc(px, py, size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();

        // Emoji ngựa
        ctx.font = `${size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐴', px, py + 1);
      }
    }

    this._cellSize = cell;
  }

  updateUI() {
    const player = this.players[this.currentPlayer];
    if (!player) return;
    document.getElementById('ld-turn-dot').style.background = COLOR_HEX[player.color];
    document.getElementById('ld-turn-name').textContent = player.name;
    document.getElementById('ld-turn-name').style.color = COLOR_HEX[player.color];
    const btn = document.getElementById('ld-dice-btn');
    btn.style.borderColor = this.phase === 'rolling' && this.canRoll ? COLOR_HEX[player.color] : 'rgba(255,255,255,0.15)';
    btn.textContent = this.lastDice && this.phase === 'rolling' ? (this.lastDice === 6 ? '⚡' : this.lastDice) : '🎲';
    btn.disabled = !(this.phase === 'rolling' && this.canRoll && player.isHuman);
  }

  renderPlayers() {
    document.getElementById('ld-players').innerHTML = this.players.map((p, i) =>
      `<div class="ld-player-tag ${i === this.currentPlayer ? 'current' : ''} ${p.finishedCount === 4 ? 'finished' : ''}">
        <div class="ld-pt-color" style="background:${COLOR_HEX[p.color]}"></div>
        <div class="ld-pt-name" style="color:${i === this.currentPlayer ? COLOR_HEX[p.color] : '#94a3b8'}">${p.name}</div>
        <div class="ld-pt-home"><span>${p.finishedCount}</span>/4 🏁</div>
      </div>`).join('');
  }

  setInfo(msg, type) {
    const el = document.getElementById('ld-info');
    el.innerHTML = msg;
    el.style.color = type === 'success' ? '#34d399' : type === 'warn' ? '#fbbf24' : type === 'error' ? '#f87171' : '#7dd3fc';
  }

  showResult(player) {
    document.getElementById('ld-res-emoji').textContent = player.isHuman ? '🏆' : '🤖';
    document.getElementById('ld-res-title').textContent = player.isHuman ? 'Bạn thắng!' : `${player.name} thắng!`;
    document.getElementById('ld-res-title').style.color = COLOR_HEX[player.color];
    document.getElementById('ld-res-sub').textContent = '🐴 Cả 4 ngựa đã về đích!';
    document.getElementById('ld-result').classList.add('visible');
    this.phase = 'finished';
  }

  reset() {
    document.getElementById('ld-result').classList.remove('visible');
    document.getElementById('ld-game').style.display = 'none';
    document.getElementById('ld-game').classList.remove('visible');
    document.getElementById('ld-start').style.display = '';
    this.phase = 'menu';
  }

  handleCanvasClick(e) {
    if (this.phase !== 'moving' || !this.players[this.currentPlayer].isHuman) return;
    const canvas = document.getElementById('ld-board-canvas');
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    for (const piece of this.movablePieces) {
      let px, py;
      if (piece.pos === -1) {
        const base = BASE_POS[this.players[this.currentPlayer].color];
        const bx = piece.id % 2, by = Math.floor(piece.id / 2);
        px = (base.c + 0.5 + bx * 0.8) * this._cellSize;
        py = (base.r + 0.5 + by * 0.8) * this._cellSize;
      } else if (piece.homeIdx >= 0) {
        const cells = HOME_STRETCH[this.players[this.currentPlayer].color];
        if (cells && cells[piece.homeIdx]) {
          const [r, c] = cells[piece.homeIdx];
          px = (c + 0.5) * this._cellSize;
          py = (r + 0.5) * this._cellSize;
        } else {
          const angle = (COLORS.indexOf(this.players[this.currentPlayer].color) / 4) * Math.PI * 2;
          px = 7.5 * this._cellSize + Math.cos(angle) * this._cellSize * 1.2;
          py = 7.5 * this._cellSize + Math.sin(angle) * this._cellSize * 1.2;
        }
      } else {
        const [r, c] = TRACK[piece.pos];
        px = (c + 0.5) * this._cellSize;
        py = (r + 0.5) * this._cellSize;
      }
      if (Math.hypot(mx - px, my - py) < this._cellSize * 0.5) {
        this.selectPiece(piece.id);
        return;
      }
    }
  }
}

// ====== INIT ======
const Ludo = new LudoGame();
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ld-board-canvas').addEventListener('click', e => Ludo.handleCanvasClick(e));
});
setTimeout(() => {
  if (window.TopNav?.setLeaveAction) window.TopNav.setLeaveAction(() => Ludo.reset());
}, 100);
