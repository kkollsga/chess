// Renders the chess board, animates piece movement, draws hints/highlights.
// Touch + mouse interaction is handled here via PointerEvents and forwarded to
// the Game controller through callbacks (no globals).

import { Piece } from './piece.js';
import { FenParser } from './fen.js';
import { Moves } from './moves.js';

export class Board {
  constructor(element, { onSquareTap, onPieceDrag } = {}) {
    this.element = element;
    this.onSquareTap = onSquareTap || (() => {});
    this.onPieceDrag = onPieceDrag || (() => {});
    this.currentFen = null;
    this.lastBoard = null;
    this.lastMove = null;        // { from: {row,col}, to: {row,col} }
    this.flipped = false;
    this.showCoords = true;
    this.selected = null;        // { row, col }
    this.legalTargets = [];      // [{row,col,...}]
    this.checkSquare = null;     // { row, col } when king is in check
    this.suppressMoveAnim = false;
    this.installEvents();
  }

  setFlipped(f) { if (this.flipped !== f) { this.flipped = f; if (this.currentFen) this.render(this.currentFen); } }
  setShowCoords(s) { if (this.showCoords !== s) { this.showCoords = s; if (this.currentFen) this.render(this.currentFen); } }

  setSelection(square, legalMoves = []) {
    this.selected = square;
    this.legalTargets = legalMoves;
    this.refreshOverlays();
  }

  clearSelection() { this.setSelection(null, []); }

  setLastMove(move) { this.lastMove = move; this.refreshOverlays(); }

  toLogicalCoords(row, col) {
    return this.flipped ? { row: 7 - row, col: 7 - col } : { row, col };
  }
  toVisualCoords(row, col) {
    return this.flipped ? { row: 7 - row, col: 7 - col } : { row, col };
  }

  squareEl(row, col) {
    const v = this.toVisualCoords(row, col);
    return this.element.querySelector(`[data-row="${v.row}"][data-col="${v.col}"]`);
  }

  refreshOverlays() {
    // Clear all overlays
    this.element.querySelectorAll('.square').forEach(sq => {
      sq.removeAttribute('data-selected');
      sq.removeAttribute('data-last-move');
      sq.removeAttribute('data-check');
      sq.querySelectorAll('.move-dot').forEach(d => d.remove());
    });
    if (this.lastMove) {
      const a = this.squareEl(this.lastMove.from.row, this.lastMove.from.col);
      const b = this.squareEl(this.lastMove.to.row, this.lastMove.to.col);
      if (a) a.dataset.lastMove = 'true';
      if (b) b.dataset.lastMove = 'true';
    }
    if (this.selected) {
      const sel = this.squareEl(this.selected.row, this.selected.col);
      if (sel) sel.dataset.selected = 'true';
    }
    for (const t of this.legalTargets) {
      const sq = this.squareEl(t.row, t.col);
      if (!sq) continue;
      const dot = document.createElement('div');
      dot.className = 'move-dot';
      // capture if there's an opposing piece on the target, or en passant
      const piece = sq.querySelector('.piece');
      const isCapture = !!piece || !!t.enPassant;
      if (isCapture) dot.dataset.capture = 'true';
      sq.appendChild(dot);
    }
    if (this.checkSquare) {
      const sq = this.squareEl(this.checkSquare.row, this.checkSquare.col);
      if (sq) sq.dataset.check = 'true';
    }
  }

  render(fen) {
    const oldBoard = this.lastBoard;
    const { board: newBoard, gameState } = FenParser.parseFen(fen);
    const move = oldBoard && !this.suppressMoveAnim ? findMovedPiece(oldBoard, newBoard) : null;
    this.suppressMoveAnim = false;
    this.currentFen = fen;
    this.lastBoard = newBoard;

    // Determine check square (king of side to move).
    const inCheck = Moves.isKingInCheck(newBoard, gameState.activeColor === 'w');
    this.checkSquare = inCheck ? Moves.findKing(newBoard, gameState.activeColor === 'w') : null;

    this.element.innerHTML = '';

    for (let visRow = 0; visRow < 8; visRow++) {
      for (let visCol = 0; visCol < 8; visCol++) {
        const { row, col } = this.toLogicalCoords(visRow, visCol);
        const square = this.createSquareElement(visRow, visCol, row, col);
        const piece = newBoard[row][col];
        if (piece) {
          const pieceEl = this.createPieceElement(piece);
          if (move && this.shouldAnimate(move, row, col, piece)) this.animateInto(pieceEl, move, row, col);
          square.appendChild(pieceEl);
        }
        this.element.appendChild(square);
      }
    }
    this.refreshOverlays();
  }

  createSquareElement(visRow, visCol, logicalRow, logicalCol) {
    const sq = document.createElement('div');
    const isLight = (logicalRow + logicalCol) % 2 === 0;
    sq.className = 'square aspect-square flex items-center justify-center relative';
    sq.style.backgroundColor = isLight ? 'var(--board-light)' : 'var(--board-dark)';
    sq.dataset.row = visRow;
    sq.dataset.col = visCol;
    sq.dataset.logicalRow = logicalRow;
    sq.dataset.logicalCol = logicalCol;
    if (this.showCoords) {
      // Rank labels on the left edge
      if (visCol === 0) {
        const rank = document.createElement('div');
        rank.className = `coord coord-rank ${isLight ? 'text-[color:var(--board-dark)]' : 'text-[color:var(--board-light)]'}`;
        rank.textContent = 8 - logicalRow;
        sq.appendChild(rank);
      }
      // File labels on the bottom edge
      if (visRow === 7) {
        const file = document.createElement('div');
        file.className = `coord coord-file ${isLight ? 'text-[color:var(--board-dark)]' : 'text-[color:var(--board-light)]'}`;
        file.textContent = String.fromCharCode(97 + logicalCol);
        sq.appendChild(file);
      }
    }
    return sq;
  }

  createPieceElement(fenChar) {
    const el = document.createElement('div');
    el.className = 'piece w-full h-full select-none';
    el.dataset.color = Piece.color(fenChar);
    el.dataset.type = fenChar;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${Piece.color(fenChar)} ${pieceName(fenChar)}`);
    return el;
  }

  shouldAnimate(move, row, col, piece) {
    return move && move.to && piece === move.to.piece && row === move.to.row && col === move.to.col;
  }

  animateInto(pieceEl, move, row, col) {
    const start = move.from;
    const visStart = this.toVisualCoords(start.row, start.col);
    const visEnd = this.toVisualCoords(row, col);
    const dr = visStart.row - visEnd.row;
    const dc = visStart.col - visEnd.col;
    pieceEl.style.zIndex = '20';
    pieceEl.style.transform = `translate(${dc * 100}%, ${dr * 100}%)`;
    requestAnimationFrame(() => {
      pieceEl.style.transition = 'transform 0.25s cubic-bezier(.2,.7,.2,1)';
      pieceEl.style.transform = 'translate(0, 0)';
    });
    pieceEl.addEventListener('transitionend', () => {
      pieceEl.style.transition = '';
      pieceEl.style.transform = '';
      pieceEl.style.zIndex = '';
    }, { once: true });
  }

  // ---- Pointer interaction (tap-to-move + drag) -----------------------
  installEvents() {
    let dragState = null;

    const sqAt = (clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      return el.closest('[data-row]');
    };

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const sq = e.target.closest('[data-row]');
      if (!sq) return;
      const visRow = parseInt(sq.dataset.row, 10);
      const visCol = parseInt(sq.dataset.col, 10);
      const { row, col } = this.toLogicalCoords(visRow, visCol);
      const piece = this.lastBoard?.[row]?.[col];

      // Tell the game we tapped this square — it decides whether to select / deselect / move.
      this.onSquareTap({ row, col, piece, square: sq, visRow, visCol, original: e });

      // If a piece is here and it's a draggable origin, begin a drag.
      if (!piece) return;
      const pieceEl = sq.querySelector('.piece');
      if (!pieceEl) return;

      const rect = sq.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;

      dragState = {
        pieceEl, fromRow: row, fromCol: col, originSq: sq,
        startX: e.clientX, startY: e.clientY,
        offsetX, offsetY, moved: false, pointerId: e.pointerId
      };
      try { sq.setPointerCapture(e.pointerId); } catch {}
    };

    const onPointerMove = (e) => {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(dx, dy) < 8) return;
      if (!dragState.moved) {
        dragState.moved = true;
        dragState.pieceEl.classList.add('dragging');
      }
      dragState.pieceEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`;
    };

    const onPointerUp = (e) => {
      if (!dragState) return;
      const ds = dragState;
      dragState = null;
      ds.pieceEl.classList.remove('dragging');
      ds.pieceEl.style.transform = '';
      try { ds.originSq.releasePointerCapture(ds.pointerId); } catch {}
      if (!ds.moved) return; // a tap, already handled
      const target = sqAt(e.clientX, e.clientY);
      if (!target) return;
      const visRow = parseInt(target.dataset.row, 10);
      const visCol = parseInt(target.dataset.col, 10);
      if (Number.isNaN(visRow) || Number.isNaN(visCol)) return;
      const { row, col } = this.toLogicalCoords(visRow, visCol);
      this.onPieceDrag({
        from: { row: ds.fromRow, col: ds.fromCol },
        to: { row, col }
      });
    };

    this.element.addEventListener('pointerdown', onPointerDown);
    this.element.addEventListener('pointermove', onPointerMove);
    this.element.addEventListener('pointerup', onPointerUp);
    this.element.addEventListener('pointercancel', () => { dragState = null; });
  }
}

function pieceName(fen) {
  const map = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  return map[fen.toLowerCase()] || 'piece';
}

function findMovedPiece(oldBoard, newBoard) {
  const getMap = (b) => {
    const m = new Map();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p) {
        const arr = m.get(p) || [];
        arr.push({ row: r, col: c });
        m.set(p, arr);
      }
    }
    return m;
  };
  const oldM = getMap(oldBoard);
  const newM = getMap(newBoard);
  for (const [piece, oldPos] of oldM) {
    const newPos = newM.get(piece) || [];
    if (JSON.stringify(oldPos) === JSON.stringify(newPos)) continue;
    const from = oldPos.find(p => !newPos.some(q => q.row === p.row && q.col === p.col));
    const to = newPos.find(p => !oldPos.some(q => q.row === p.row && q.col === p.col));
    if (from && to) return { from: { ...from, piece }, to: { ...to, piece } };
  }
  return null;
}
