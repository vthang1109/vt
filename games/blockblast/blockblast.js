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
    this.ROWS = 8;
    this.COLS = 8;
    this.PADDING = 5;
    this.GAP = 2;
    this.GHOST_CELL = 26;      // bằng TRAY_CELL, tỷ lệ 1:1
    this.TRAY_CELL = 26;
    this.boardEl = null;
    this.piecesEl = null;
    this.scoreEl = null;
    this.highScoreEl = null;
    this.subEl = null;
    this.startBtn = null;

    this.COLORS = [
      '#38bdf8', '#f472b6', '#fbbf24', '#34d399',
      '#a78bfa', '#fb923c', '#e879f9', '#2dd4bf',
    ];

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    this.boardEl = document.getElementById('bb-board');
    this.piecesEl = document.getElementById('bb-pieces');
    this.scoreEl = document.getElementById('bb-score');
    this.highScoreEl = document.getElementById('bb-highscore');
    this.subEl = document.getElementById('bb-sub');
    this.startBtn = document.getElementById('bb-start-btn');

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
    this.setIdle(true);
    this.updateScoreDisplay();

    this.startBtn.addEventListener('click', () => this.startGame());
    this.attachDragListeners();

    this.subEl.textContent = 'Sẵn sàng';
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
  }

  generatePieces() {
    this.pieces = [];
    for (let i = 0; i < 3; i++) {
      this.pieces.push(this.randomPiece());
    }
  }

  randomPiece() {
    const shapes = [
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
    ];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const color = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
    return { shape: shape.map(row => [...row]), color };
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
      this.score += cleared * 10;
      this.updateScoreDisplay();
      window.showToast(`+${cleared * 10} điểm`, 'success');
    }
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
  renderBoard(highlightCells = null) {
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
        if (highlightCells) {
          const key = `${r},${c}`;
          if (highlightCells.valid.has(key)) cell.classList.add('highlight');
          if (highlightCells.invalid.has(key)) cell.classList.add('invalid');
        }
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

    // Offset từ chuột đến góc trái ghost (để tâm luôn dưới chuột)
    this.dragOffsetX = centerC * this.GHOST_CELL + this.GHOST_CELL / 2;
    this.dragOffsetY = centerR * this.GHOST_CELL + this.GHOST_CELL / 2;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    this.createDragGhost();
    // Đặt ghost sao cho tâm khớp chuột
    this.updateGhostPosition(clientX - this.dragOffsetX, clientY - this.dragOffsetY);

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

  onDragMove(e) {
    if (!this.isDragging || !this.dragPiece) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Cập nhật ghost: tâm luôn dưới chuột
    this.updateGhostPosition(clientX - this.dragOffsetX, clientY - this.dragOffsetY);

    // Lấy vị trí bắt đầu của piece dựa trên góc trái ghost
    const ghostLeft = clientX - this.dragOffsetX;
    const ghostTop = clientY - this.dragOffsetY;
    const { row, col } = this.getCellFromClient(ghostLeft, ghostTop);

    const highlightCells = this.getHighlightCells(row, col);
    this.renderBoard(highlightCells);
  }

  onDragEnd(e) {
    if (!this.isDragging || !this.dragPiece) return;
    this.isDragging = false;

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    const ghostLeft = clientX - this.dragOffsetX;
    const ghostTop = clientY - this.dragOffsetY;
    const { row, col } = this.getCellFromClient(ghostLeft, ghostTop);

    if (row >= 0 && row < this.ROWS && col >= 0 && col < this.COLS) {
      if (this.canPlace(this.dragPiece, row, col)) {
        this.placePiece(this.dragPiece, row, col);
        this.pieces.splice(this.dragPieceIdx, 1);
        this.score += 5;
        this.updateScoreDisplay();
        if (this.pieces.length === 0) {
          this.generatePieces();
        }
        this.renderBoard();
        this.renderPieces();
        if (this.checkGameOver()) {
          this.isPlaying = false;
          this.setIdle(true);
          window.showToast('Hết nước đi! Game Over', 'warn');
          this.subEl.textContent = 'Game Over';
        }
      }
    }

    this.removeDragGhost();
    this.dragPiece = null;
    this.dragPieceIdx = -1;
    this.renderBoard();
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
    this.resetBoard();
    this.generatePieces();
    this.renderBoard();
    this.renderPieces();
    this.updateScoreDisplay();
    this.isPlaying = true;
    this.setIdle(false);
    window.showToast('Bắt đầu chơi!', 'info');
    this.subEl.textContent = 'Đang chơi';
  }
}

new BlockBlast();