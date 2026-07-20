// blockblast.js — Block Blast (tỷ lệ 1:1, thả chính xác, không lệch)

class BlockBlast {
  constructor() {
    this.board = [];
    this.pieces = [];
    this.score = 0;
    this.highScore = 0;
    this.isPlaying = false;
    this.isDragging = false;
    this.dragPiece = null;
    this.dragPieceIdx = -1;
    this.dragGhost = null;
    this.dragOffsetX = 0;      // offset từ chuột đến góc trái ghost (px)
    this.dragOffsetY = 0;
    this.ghostLift = 0;
    this.ROWS = 8;
    this.COLS = 8;
    this.PADDING = 5;
    this.GAP = 2;
    this.GHOST_CELL = 26;      // bằng TRAY_CELL, tỷ lệ 1:1
    this.TRAY_CELL = 26;
    this.boardEl = null;
    this.piecesEl = null;
    this.playAreaEl = null;
    this.scoreEl = null;
    this.highScoreEl = null;
    this.subEl = null;
    this.startBtn = null;
    this.continueBtn = null;

    // Ngưỡng điểm quyết định độ khó khối ra
    this.SCORE_EASY_MAX = 10000;    // score < 10000: mốc dễ
    this.SCORE_MID_MAX = 100000;    // 10000-100000: mốc trung; >=100000: mốc khó

    // Danh sách hình khối — mỗi hình có màu cố định riêng, khác nhau hoàn toàn
    const rawShapes = [
      [[1]],
      [[1],[1]],
      [[1,1]],
      [[1,1],[1,1]],
      [[1,0],[1,1]],
      [[0,1],[1,1]],
      [[1,1],[1,0]],
      [[1,1],[0,1]],
      [[1],[1],[1]],
      [[1,1,1]],
      [[1,1,1],[0,1,0]],
      [[1,1,0],[0,1,1]],
      [[0,1,1],[1,1,0]],
      [[1,0,0],[1,1,1]],
      [[0,0,1],[1,1,1]],
      [[1,1,1],[1,0,0]],
      [[1,1,1],[0,0,1]],
      [[1,1,1],[1,1,1]],           // 2x3
      [[1,1],[1,1],[1,1]],         // 3x2
      [[1,1,1],[1,1,1],[1,1,1]],   // 3x3
    ];
    const palette = [
      '#38bdf8','#f472b6','#fbbf24','#34d399','#a78bfa','#fb923c','#e879f9','#2dd4bf',
      '#60a5fa','#f87171','#facc15','#4ade80','#c084fc','#fb7185','#22d3ee','#a3e635',
      '#f9a8d4','#93c5fd','#fdba74','#5eead4',
    ];
    this.SHAPES = rawShapes.map((shape, i) => ({
      shape,
      color: palette[i % palette.length],
    }));

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    this.boardEl = document.getElementById('bb-board');
    this.piecesEl = document.getElementById('bb-pieces');
    this.playAreaEl = document.getElementById('bb-play-area');
    this.scoreEl = document.getElementById('bb-score');
    this.highScoreEl = document.getElementById('bb-highscore');
    this.subEl = document.getElementById('bb-sub');
    this.profitEl = document.getElementById('bb-profit');
    this.statusBarEl = document.getElementById('game-status');
    this.startBtn = document.getElementById('bb-start-btn');
    this.continueBtn = document.getElementById('bb-continue-btn');
    this.helpBtn = document.getElementById('bb-help-btn');
    this.helpCountEl = document.getElementById('bb-help-count');

    if (!this.boardEl || !this.piecesEl || !this.startBtn) {
      console.error('Thiếu element cần thiết');
      return;
    }

    this.highScore = parseInt(localStorage.getItem('bb_highscore') || '0');
    this.highScoreEl.textContent = `🏆 ${this.highScore}`;

    this.resetBoard();
    this.generatePieces();
    this.renderBoard();
    this.renderPieces();
    this.updateScoreDisplay();

    // Ban đầu: ẩn hẳn khu vực chơi, chỉ hiện nút
    this.playAreaEl.classList.add('not-started');
    this.setIdle(true);
    this.subEl.textContent = 'Sẵn sàng';
    if (this.helpBtn) this.helpBtn.style.display = 'none';

    // Nếu có ván đang dở, hiện thêm nút "Chơi tiếp"
    const saved = this.loadGame();
    if (saved) {
      this.continueBtn.style.display = '';
    }

    this.startBtn.addEventListener('click', () => this.startGame());
    this.continueBtn.addEventListener('click', () => this.continueGame());
    if (this.helpBtn) this.helpBtn.addEventListener('click', () => this.useHelp());
    this.attachDragListeners();
  }

  // ===== Lưu / tải tiến trình =====
  saveGame() {
    if (!this.isPlaying) return;
    const data = {
      board: this.board,
      pieces: this.pieces,
      score: this.score,
      combo: this.combo,
      batchHasCleared: this.batchHasCleared,
      helpUsesLeft: this.helpUsesLeft,
    };
    try {
      localStorage.setItem('bb_savegame', JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem('bb_savegame');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  clearSavedGame() {
    localStorage.removeItem('bb_savegame');
    if (this.continueBtn) this.continueBtn.style.display = 'none';
  }

  setIdle(idle) {
    if (idle) {
      this.boardEl.classList.add('idle');
      this.piecesEl.classList.add('idle');
    } else {
      this.boardEl.classList.remove('idle');
      this.piecesEl.classList.remove('idle');
    }
  }

  resetBoard() {
    this.board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));
    this.score = 0;
    this.isPlaying = false;
    this.pieces = [];
    this.isDragging = false;
    this.combo = 0;
    this.batchHasCleared = false;
    this.helpUsesLeft = 1;
  }

  generatePieces() {
    this.pieces = [];
    this.batchHasCleared = false;
    const tier = this.getDifficultyTier();
    for (let i = 0; i < 3; i++) {
      this.pieces.push(this.randomPiece(tier));
    }
    this.ensurePlayable();
  }

  // Mốc độ khó dựa trên điểm hiện tại
  getDifficultyTier() {
    if (this.score < this.SCORE_EASY_MAX) return 'easy';
    if (this.score < this.SCORE_MID_MAX) return 'mid';
    return 'hard';
  }

  randomPiece(tier = this.getDifficultyTier()) {
    const def = this.pickShapeForTier(tier);
    return { shape: def.shape.map(row => [...row]), color: def.color };
  }

  // ===== KHỐI THÔNG MINH =====
  // Chọn hình dựa theo mốc điểm: dễ -> khối TO nhưng khớp khoảng trống, ưu tiên khối ăn được hàng/cột để ghi điểm nhanh
  // trung -> ngẫu nhiên cân bằng; khó -> ưu tiên khối lớn/khó đặt
  pickShapeForTier(tier) {
    const candidates = this.SHAPES.map(def => {
      const cellCount = def.shape.flat().filter(Boolean).length;
      const fits = this.shapeCanFitAnywhere(def.shape);
      const clears = fits && this.shapeCanClearLine(def.shape);
      return { def, cellCount, fits, clears };
    });

    let weighted;
    if (tier === 'easy') {
      const pool = candidates.filter(c => c.fits);
      const list = pool.length ? pool : candidates;
      weighted = list.map(c => ({
        item: c.def,
        w: (c.cellCount + 1) * (c.clears ? 4 : 1.5),
      }));
    } else if (tier === 'mid') {
      weighted = candidates.map(c => ({
        item: c.def,
        w: 1 * (c.clears ? 1.5 : 1),
      }));
    } else {
      // hard: ưu tiên khối lớn, khó đặt hơn
      weighted = candidates.map(c => ({
        item: c.def,
        w: c.cellCount * (c.clears ? 0.5 : 1.2),
      }));
    }
    return this.weightedPick(weighted);
  }

  weightedPick(weighted) {
    const total = weighted.reduce((s, w) => s + w.w, 0);
    if (total <= 0) return weighted[Math.floor(Math.random() * weighted.length)].item;
    let r = Math.random() * total;
    for (const w of weighted) {
      if (r < w.w) return w.item;
      r -= w.w;
    }
    return weighted[weighted.length - 1].item;
  }

  // Hình có đặt được ở đâu đó trên bàn hiện tại không
  shapeCanFitAnywhere(shape) {
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.canPlace({ shape }, r, c)) return true;
      }
    }
    return false;
  }

  // Hình có thể ăn được ít nhất 1 hàng/cột nếu đặt đúng chỗ không
  shapeCanClearLine(shape) {
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.canPlace({ shape }, r, c) && this.wouldClearAt(shape, r, c)) return true;
      }
    }
    return false;
  }

  wouldClearAt(shape, row, col) {
    const cells = this.computeClearedCells(shape, row, col);
    return !!cells && cells.size > 0;
  }

  // Trả về Set các ô "r,c" sẽ bị xoá nếu đặt shape tại (row,col). null nếu không đặt được ở đó.
  computeClearedCells(shape, row, col) {
    if (!this.canPlace({ shape }, row, col)) return null;
    const rowsToCheck = new Set();
    const colsToCheck = new Set();
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) { rowsToCheck.add(row + r); colsToCheck.add(col + c); }
      }
    }
    const covered = (r, c) => {
      const sr = r - row, sc = c - col;
      if (sr < 0 || sc < 0 || sr >= shape.length || sc >= shape[0].length) return false;
      return !!shape[sr][sc];
    };
    const cells = new Set();
    for (const r of rowsToCheck) {
      let full = true;
      for (let c = 0; c < this.COLS; c++) {
        if (!(this.board[r][c] || covered(r, c))) { full = false; break; }
      }
      if (full) { for (let c = 0; c < this.COLS; c++) cells.add(`${r},${c}`); }
    }
    for (const c of colsToCheck) {
      let full = true;
      for (let r = 0; r < this.ROWS; r++) {
        if (!(this.board[r][c] || covered(r, c))) { full = false; break; }
      }
      if (full) { for (let r = 0; r < this.ROWS; r++) cells.add(`${r},${c}`); }
    }
    return cells;
  }

  // Bảo đảm luôn có ít nhất 1 trong 3 khối đặt được, tránh thua ngay lập tức bất công
  ensurePlayable() {
    const canAny = this.pieces.some(p => this.shapeCanFitAnywhere(p.shape));
    if (canAny) return;
    const sorted = this.SHAPES.slice().sort((a, b) => {
      const ca = a.shape.flat().filter(Boolean).length;
      const cb = b.shape.flat().filter(Boolean).length;
      return ca - cb;
    });
    for (const def of sorted) {
      if (this.shapeCanFitAnywhere(def.shape)) {
        this.pieces[this.pieces.length - 1] = { shape: def.shape.map(row => [...row]), color: def.color };
        return;
      }
    }
  }

  canPlace(piece, row, col) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const boardR = row + r;
          const boardC = col + c;
          if (boardR < 0 || boardR >= this.ROWS || boardC < 0 || boardC >= this.COLS) return false;
          if (this.board[boardR][boardC]) return false;
        }
      }
    }
    return true;
  }

  // Hút nam châm: nếu ô hiện tại không đặt được, tìm ô hợp lệ gần nhất trong bán kính nhỏ
  findNearestValidPlacement(piece, row, col, maxRadius = 1) {
    if (this.canPlace(piece, row, col)) return { row, col };
    let best = null, bestDist = Infinity;
    for (let dr = -maxRadius; dr <= maxRadius; dr++) {
      for (let dc = -maxRadius; dc <= maxRadius; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (this.canPlace(piece, r, c)) {
          const dist = dr * dr + dc * dc;
          if (dist < bestDist) {
            bestDist = dist;
            best = { row: r, col: c };
          }
        }
      }
    }
    return best;
  }

  placePiece(piece, row, col) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          this.board[row + r][col + c] = piece.color;
        }
      }
    }
    this.checkLines();
  }

  checkLines() {
    let cleared = 0;
    for (let r = this.ROWS - 1; r >= 0; r--) {
      if (this.board[r].every(cell => cell !== 0)) {
        for (let c = 0; c < this.COLS; c++) this.board[r][c] = 0;
        cleared++;
      }
    }
    for (let c = 0; c < this.COLS; c++) {
      let full = true;
      for (let r = 0; r < this.ROWS; r++) {
        if (!this.board[r][c]) { full = false; break; }
      }
      if (full) {
        for (let r = 0; r < this.ROWS; r++) this.board[r][c] = 0;
        cleared++;
      }
    }
    if (cleared > 0) {
      this.combo++;
      this.batchHasCleared = true;
      const comboBonus = this.combo > 1 ? (this.combo - 1) * 5 : 0;
      const gained = cleared * 10 + comboBonus;
      this.score += gained;
      this.updateScoreDisplay();
      if (this.combo > 1) {
        window.showToast(`+${gained} điểm 🔥 Combo x${this.combo}`, 'success');
        this.showComboEffect(this.combo);
      } else {
        window.showToast(`+${gained} điểm`, 'success');
      }
    }
  }

  showComboEffect(combo) {
    const el = document.createElement('div');
    el.className = 'bb-combo-popup';
    el.textContent = `🔥 COMBO x${combo}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  checkGameOver() {
    for (let piece of this.pieces) {
      for (let r = 0; r < this.ROWS; r++) {
        for (let c = 0; c < this.COLS; c++) {
          if (this.canPlace(piece, r, c)) return false;
        }
      }
    }
    return true;
  }

  updateScoreDisplay() {
    this.scoreEl.textContent = this.score;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('bb_highscore', this.highScore);
      this.highScoreEl.textContent = `🏆 ${this.highScore}`;
    }
    this.subEl.textContent = this.isPlaying ? 'Đang chơi' : 'Sẵn sàng';
  }

  // ========== RENDER ==========
  renderBoard(highlightCells = null, clearCells = null) {
    this.boardEl.innerHTML = '';
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'bb-cell';
        const cellValue = this.board[r][c];
        if (cellValue) {
          cell.classList.add('filled');
          cell.style.background = cellValue;
        }
        const key = `${r},${c}`;
        if (highlightCells) {
          if (highlightCells.valid.has(key)) cell.classList.add('highlight');
          if (highlightCells.invalid.has(key)) cell.classList.add('invalid');
        }
        if (clearCells && clearCells.has(key)) cell.classList.add('will-clear');
        this.boardEl.appendChild(cell);
      }
    }
  }

  renderPieces() {
    this.piecesEl.innerHTML = '';
    this.pieces.forEach((piece, idx) => {
      const pieceEl = document.createElement('div');
      pieceEl.className = 'bb-piece';
      pieceEl.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, ${this.TRAY_CELL}px)`;
      pieceEl.dataset.idx = idx;
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          const cell = document.createElement('div');
          cell.className = 'bb-piece-cell';
          if (!piece.shape[r][c]) {
            cell.classList.add('empty');
          } else {
            cell.style.background = piece.color;
            cell.style.borderColor = piece.color;
          }
          pieceEl.appendChild(cell);
        }
      }
      pieceEl.addEventListener('mousedown', (e) => this.startDrag(e, idx));
      pieceEl.addEventListener('touchstart', (e) => this.startDrag(e, idx), { passive: false });
      this.piecesEl.appendChild(pieceEl);
    });
  }

  // ========== DRAG & DROP (tỷ lệ 1:1, thả chính xác) ==========
  attachDragListeners() {
    document.addEventListener('mousemove', (e) => this.onDragMove(e));
    document.addEventListener('mouseup', (e) => this.onDragEnd(e));
    document.addEventListener('touchmove', (e) => {
      if (this.isDragging) e.preventDefault();
      this.onDragMove(e);
    }, { passive: false });
    document.addEventListener('touchend', (e) => this.onDragEnd(e));
  }

  // Tính kích thước 1 ô thật trên board (để ghost khớp 1:1)
  calcBoardCellSize() {
    const computedStyle = getComputedStyle(this.boardEl);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || this.PADDING;
    const gap = parseFloat(computedStyle.gap) || this.GAP;
    return (this.boardEl.clientWidth - paddingLeft * 2 - gap * (this.COLS - 1)) / this.COLS;
  }

  startDrag(e, idx) {
    if (!this.isPlaying) {
      window.showToast('Hãy bắt đầu chơi mới!', 'warn');
      return;
    }
    if (this.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    this.dragPieceIdx = idx;
    this.dragPiece = this.pieces[idx];
    this.GHOST_CELL = this.calcBoardCellSize(); // khối bóng = đúng size ô board thật

    // Tìm tâm phần lấp đầy (cell)
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (let r = 0; r < this.dragPiece.shape.length; r++) {
      for (let c = 0; c < this.dragPiece.shape[r].length; c++) {
        if (this.dragPiece.shape[r][c]) {
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      }
    }
    const centerR = (minR + maxR) / 2;
    const centerC = (minC + maxC) / 2;
    this.dragPieceRows = maxR - minR + 1; // số hàng của khối
    this.dragPieceCols = maxC - minC + 1; // số cột của khối

    // Offset từ chuột đến góc trái ghost (để tâm luôn dưới chuột)
    this.dragOffsetX = centerC * this.GHOST_CELL + this.GHOST_CELL / 2;
    this.dragOffsetY = centerR * this.GHOST_CELL + this.GHOST_CELL / 2;
    // Ghost nâng lên trên ngón tay khi chạm (chỉ hiển thị); điểm rơi vẫn tính theo vị trí tay thật -> nằm dưới ghost
    this.ghostLift = e.touches ? 180 : 0;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    this.createDragGhost();
    // Đặt ghost: tâm dưới tay, nâng lên ghostLift px để không che
    this.updateGhostPosition(clientX - this.dragOffsetX, clientY - this.dragOffsetY - this.ghostLift);

    const pieceEls = this.piecesEl.querySelectorAll('.bb-piece');
    if (pieceEls[idx]) pieceEls[idx].classList.add('dragging');
  }

  createDragGhost() {
    this.removeDragGhost();
    const ghost = document.createElement('div');
    ghost.className = 'bb-drag-ghost';
    ghost.style.gridTemplateColumns = `repeat(${this.dragPiece.shape[0].length}, ${this.GHOST_CELL}px)`;
    // Không transform, vị trí do JS quản lý
    for (let r = 0; r < this.dragPiece.shape.length; r++) {
      for (let c = 0; c < this.dragPiece.shape[r].length; c++) {
        const cell = document.createElement('div');
        cell.className = 'bb-piece-cell';
        cell.style.width = this.GHOST_CELL + 'px';
        cell.style.height = this.GHOST_CELL + 'px';
        if (!this.dragPiece.shape[r][c]) {
          cell.classList.add('empty');
        } else {
          cell.style.background = this.dragPiece.color;
          cell.style.borderColor = this.dragPiece.color;
        }
        ghost.appendChild(cell);
      }
    }
    document.body.appendChild(ghost);
    this.dragGhost = ghost;
  }

  updateGhostPosition(x, y) {
    if (!this.dragGhost) return;
    this.dragGhost.style.left = x + 'px';
    this.dragGhost.style.top = y + 'px';
  }

  removeDragGhost() {
    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }
    const pieceEls = this.piecesEl?.querySelectorAll('.bb-piece');
    if (pieceEls && this.dragPieceIdx >= 0) {
      pieceEls[this.dragPieceIdx]?.classList.remove('dragging');
    }
  }

  // Lấy ô board từ tọa độ client
  getCellFromClient(clientX, clientY) {
    const boardRect = this.boardEl.getBoundingClientRect();
    const computedStyle = getComputedStyle(this.boardEl);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || this.PADDING;
    const paddingTop = parseFloat(computedStyle.paddingTop) || this.PADDING;
    const gap = parseFloat(computedStyle.gap) || this.GAP;

    const cellWidth = (this.boardEl.clientWidth - paddingLeft * 2 - gap * (this.COLS - 1)) / this.COLS;
    const cellHeight = (this.boardEl.clientHeight - paddingTop * 2 - gap * (this.ROWS - 1)) / this.ROWS;

    const relX = clientX - boardRect.left - this.boardEl.clientLeft - paddingLeft;
    const relY = clientY - boardRect.top - this.boardEl.clientTop - paddingTop;

    const col = Math.floor(relX / (cellWidth + gap));
    const row = Math.floor(relY / (cellHeight + gap));

    return { row, col };
  }

  // Rect thật (screen coords) của 1 ô board tại (row, col), kể cả khi row/col nằm ngoài bàn (ngoại suy)
  getBoardCellRect(row, col) {
    const boardRect = this.boardEl.getBoundingClientRect();
    const computedStyle = getComputedStyle(this.boardEl);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || this.PADDING;
    const paddingTop = parseFloat(computedStyle.paddingTop) || this.PADDING;
    const gap = parseFloat(computedStyle.gap) || this.GAP;
    const cellWidth = (this.boardEl.clientWidth - paddingLeft * 2 - gap * (this.COLS - 1)) / this.COLS;
    const cellHeight = (this.boardEl.clientHeight - paddingTop * 2 - gap * (this.ROWS - 1)) / this.ROWS;
    const left = boardRect.left + this.boardEl.clientLeft + paddingLeft + col * (cellWidth + gap);
    const top = boardRect.top + this.boardEl.clientTop + paddingTop + row * (cellHeight + gap);
    return { left, top, right: left + cellWidth, bottom: top + cellHeight };
  }

  // Rect bao trọn khối (dragPieceRows x dragPieceCols) nếu đặt ở góc trên-trái (row, col)
  pieceRectAt(row, col) {
    const topLeft = this.getBoardCellRect(row, col);
    const bottomRight = this.getBoardCellRect(row + this.dragPieceRows - 1, col + this.dragPieceCols - 1);
    return { left: topLeft.left, top: topLeft.top, right: bottomRight.right, bottom: bottomRight.bottom };
  }

  // Diện tích phần chồng lấp giữa 2 rect
  overlapArea(a, b) {
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);
    if (right <= left || bottom <= top) return 0;
    return (right - left) * (bottom - top);
  }

  // Tìm (row, col) mà khối đang kéo (ghostRect) chồng lấp diện tích lớn nhất nếu đặt tại đó
  findBestOverlapPosition(ghostRect) {
    const guess = this.getCellFromClient(ghostRect.left, ghostRect.top);
    let bestRow = guess.row, bestCol = guess.col, bestArea = -1;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = guess.row + dr;
        const c = guess.col + dc;
        const rect = this.pieceRectAt(r, c);
        const area = this.overlapArea(ghostRect, rect);
        if (area > bestArea) {
          bestArea = area;
          bestRow = r;
          bestCol = c;
        }
      }
    }
    return { row: bestRow, col: bestCol };
  }

  onDragMove(e) {
    if (!this.isDragging || !this.dragPiece) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Cập nhật ghost: nâng lên trên tay khi chạm (chỉ hiển thị)
    this.updateGhostPosition(clientX - this.dragOffsetX, clientY - this.dragOffsetY - this.ghostLift);

    // Điểm rơi: tìm vị trí mà khối ghost chồng lấp diện tích lớn nhất
    const rect = this.dragGhost.getBoundingClientRect();
    const { row, col } = this.findBestOverlapPosition(rect);
    const snapped = this.findNearestValidPlacement(this.dragPiece, row, col, 1);
    const useRow = snapped ? snapped.row : row;
    const useCol = snapped ? snapped.col : col;

    const highlightCells = this.getHighlightCells(useRow, useCol);
    const clearCells = this.computeClearedCells(this.dragPiece.shape, useRow, useCol) || new Set();
    this.renderBoard(highlightCells, clearCells);
  }

  onDragEnd(e) {
    if (!this.isDragging || !this.dragPiece) return;
    this.isDragging = false;

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    // Cập nhật ghost về đúng vị trí cuối cùng trước khi đo
    this.updateGhostPosition(clientX - this.dragOffsetX, clientY - this.dragOffsetY - this.ghostLift);
    const rect = this.dragGhost.getBoundingClientRect();
    const { row, col } = this.findBestOverlapPosition(rect);
    const snapped = this.findNearestValidPlacement(this.dragPiece, row, col, 1);
    const useRow = snapped ? snapped.row : row;
    const useCol = snapped ? snapped.col : col;

    if (useRow >= 0 && useRow < this.ROWS && useCol >= 0 && useCol < this.COLS) {
      if (this.canPlace(this.dragPiece, useRow, useCol)) {
        this.placePiece(this.dragPiece, useRow, useCol);
        this.pieces.splice(this.dragPieceIdx, 1);
        this.score += 5;
        this.updateScoreDisplay();
        if (this.pieces.length === 0) {
          if (!this.batchHasCleared) {
            this.combo = 0;
          }
          this.generatePieces();
        }
        this.renderBoard();
        this.renderPieces();
        if (this.checkGameOver()) {
          this.isPlaying = false;
          this.setIdle(true);
          this.clearSavedGame();
          this.updateHelpDisplay();
          window.showToast('Hết nước đi! Game Over', 'warn');
          this.subEl.textContent = 'Game Over';
          this.awardPoints();
        } else {
          this.saveGame();
        }
      }
    }

    this.removeDragGhost();
    this.dragPiece = null;
    this.dragPieceIdx = -1;
    this.renderBoard();
  }

  async awardPoints() {
    if (this.score <= 0) return;
    const reward = Math.round(this.score * 0.3);
    try {
      const { addPoints } = await import('../../points.js');
      const final = await addPoints('Block Blast', 'Chơi Block Blast', reward);
      if (typeof final === 'number') {
        window.showToast(`+${final.toLocaleString('vi-VN')} điểm VTWorld`, 'success');
        if (this.profitEl) {
          this.profitEl.textContent = `+${final.toLocaleString('vi-VN')}`;
          this.profitEl.classList.remove('zero', 'negative');
          this.profitEl.classList.add('positive');
          this.profitEl.style.color = '#4ade80';
        }
        if (this.statusBarEl) {
          this.statusBarEl.classList.remove('result-lose', 'result-draw');
          this.statusBarEl.classList.add('result-win');
        }
      }
    } catch (e) { /* ignore */ }
  }

  getHighlightCells(row, col) {
    const valid = new Set();
    const invalid = new Set();
    if (!this.dragPiece) return { valid, invalid };
    const can = this.canPlace(this.dragPiece, row, col);
    for (let r = 0; r < this.dragPiece.shape.length; r++) {
      for (let c = 0; c < this.dragPiece.shape[r].length; c++) {
        if (this.dragPiece.shape[r][c]) {
          const key = `${row + r},${col + c}`;
          if (can) valid.add(key);
          else invalid.add(key);
        }
      }
    }
    return { valid, invalid };
  }

  startGame() {
    this.clearSavedGame();
    this.resetBoard();
    this.generatePieces();
    this.renderBoard();
    this.renderPieces();
    this.updateScoreDisplay();
    this.isPlaying = true;
    this.playAreaEl.classList.remove('not-started');
    this.continueBtn.style.display = 'none';
    this.setIdle(false);
    window.showToast('Bắt đầu chơi!', 'info');
    this.subEl.textContent = 'Đang chơi';
    if (this.profitEl) {
      this.profitEl.textContent = '';
      this.profitEl.classList.remove('positive', 'negative');
      this.profitEl.classList.add('zero');
      this.profitEl.style.color = '';
    }
    if (this.statusBarEl) {
      this.statusBarEl.classList.remove('result-win', 'result-lose', 'result-draw');
    }
    this.updateHelpDisplay();
    this.saveGame();
  }

  continueGame() {
    const saved = this.loadGame();
    if (!saved) {
      this.startGame();
      return;
    }
    this.board = saved.board;
    this.pieces = saved.pieces;
    this.score = saved.score || 0;
    this.combo = saved.combo || 0;
    this.batchHasCleared = !!saved.batchHasCleared;
    this.helpUsesLeft = saved.helpUsesLeft ?? 1;
    this.isPlaying = true;
    this.renderBoard();
    this.renderPieces();
    this.updateScoreDisplay();
    this.playAreaEl.classList.remove('not-started');
    this.continueBtn.style.display = 'none';
    this.setIdle(false);
    window.showToast('Tiếp tục ván trước!', 'info');
    this.subEl.textContent = 'Đang chơi';
    this.updateHelpDisplay();
  }

  // ===== Nút trợ giúp: quét sạch bàn cờ khi bí nước =====
  updateHelpDisplay() {
    if (!this.helpBtn) return;
    this.helpBtn.style.display = this.isPlaying ? '' : 'none';
    if (this.helpCountEl) this.helpCountEl.textContent = this.helpUsesLeft;
    this.helpBtn.disabled = this.helpUsesLeft <= 0;
  }

  useHelp() {
    if (!this.isPlaying || this.helpUsesLeft <= 0) return;
    this.helpUsesLeft--;
    this.board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));
    this.combo = 0;
    this.renderBoard();
    this.updateHelpDisplay();
    window.showToast('🧹 Đã quét sạch bàn cờ!', 'success');
    this.saveGame();
  }
}

new BlockBlast();
// Rời game
setTimeout(function(){if(window.TopNav&&typeof window.TopNav.setLeaveAction==="function"){window.TopNav.setLeaveAction(function(){window.location.href="../../games.html"})}},100);
