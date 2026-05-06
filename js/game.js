// Game controller. Owns positions, turn flow, AI, coach, autosave.
import { Piece } from './piece.js';
import { FenParser } from './fen.js';
import { Moves } from './moves.js';
import { Board } from './board.js';
import { SideBoard, materialSum } from './sideboard.js';
import { EvalBar } from './evalbar.js';
import { pickPromotion } from './promotion.js';
import { AudioFX } from './audio.js';
import { Haptics } from './haptics.js';
import { Settings, GameStore } from './settings.js';
import { Engine } from './engine.js';
import { classify } from './coach.js';
import { banner, toast } from './notification.js';

export class Game {
  constructor(refs) {
    this.refs = refs;
    this.positions = [FenParser.DEFAULT];
    this.sans = [];
    this.evals = [];        // centipawn eval after position[i], from white's perspective
    this.qualities = [];    // qualities[i] = move-quality tag at sans[i-1]
    this.currentIndex = 0;
    this.metadata = {
      Event: '?', Site: '?',
      Date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      White: 'Player White', Black: 'Player Black', Result: '*'
    };
    this.aiThinking = false;
    this.evaluating = false;

    this.board = new Board(refs.boardEl, {
      onSquareTap: (info) => this.onSquareTap(info),
      onPieceDrag: (m) => this.onPieceDrag(m)
    });
    this.whiteSide = new SideBoard('white', refs.whiteCapturesEl);
    this.blackSide = new SideBoard('black', refs.blackCapturesEl);
    this.evalBar = new EvalBar(refs.evalBarEl, refs.evalFillEl, refs.evalLabelEl);

    this.applySettings();

    Settings.onChange(() => this.applySettings());
  }

  applySettings() {
    this.board.setShowCoords(Settings.get('showCoords'));
    this.board.setFlipped(Settings.get('flipBoard'));
    document.documentElement.dataset.theme = Settings.get('theme');
    if (this.refs.evalBarEl) {
      this.refs.evalBarEl.parentElement?.classList.toggle('hidden', !Settings.get('coach'));
    }
  }

  // ---- State accessors ------------------------------------------------
  get currentFen() { return this.positions[this.currentIndex]; }
  get isAtEnd() { return this.currentIndex === this.positions.length - 1; }

  loadFromSnapshot(snap) {
    this.positions = snap.positions || [FenParser.DEFAULT];
    this.sans = snap.sans || [];
    this.evals = snap.evals || [];
    this.qualities = snap.qualities || [];
    this.currentIndex = Math.min(snap.currentIndex ?? this.positions.length - 1, this.positions.length - 1);
    this.metadata = { ...this.metadata, ...(snap.metadata || {}) };
    this.board.lastBoard = null;
    this.board.suppressMoveAnim = true;
    this.update();
  }

  snapshot() {
    return {
      positions: this.positions, sans: this.sans, evals: this.evals,
      qualities: this.qualities, currentIndex: this.currentIndex,
      metadata: this.metadata
    };
  }

  reset(fen = null) {
    this.positions = [fen || FenParser.DEFAULT];
    this.sans = [];
    this.evals = [];
    this.qualities = [];
    this.currentIndex = 0;
    this.metadata.Result = '*';
    this.board.lastBoard = null;
    this.board.clearSelection();
    this.board.setLastMove(null);
    this.update();
    GameStore.save(this.snapshot());
  }

  // ---- Navigation -----------------------------------------------------
  goBack() { if (this.currentIndex > 0) { this.currentIndex--; this.update(); } }
  goForward() { if (this.currentIndex < this.positions.length - 1) { this.currentIndex++; this.update(); } }
  goToStart() { this.currentIndex = 0; this.update(); }
  goToEnd() { this.currentIndex = this.positions.length - 1; this.update(); }
  jumpTo(i) { if (i >= 0 && i < this.positions.length) { this.currentIndex = i; this.update(); } }

  // ---- Tap/drag handlers ---------------------------------------------
  onSquareTap({ row, col, piece }) {
    AudioFX.unlock();
    if (!this.isAtEnd) {
      // Snap to current position before allowing input.
      this.goToEnd();
      return;
    }
    const sel = this.board.selected;
    if (sel) {
      // If tapped a legal target, play it.
      const isLegal = this.board.legalTargets.some(t => t.row === row && t.col === col);
      if (isLegal) {
        this.attemptMove({ row: sel.row, col: sel.col }, { row, col });
        return;
      }
      // If tapped a same-color piece, switch selection. Otherwise deselect.
      const { gameState } = FenParser.parseFen(this.currentFen);
      if (piece && Piece.isWhite(piece) === (gameState.activeColor === 'w')) {
        this.selectSquare(row, col);
      } else {
        this.board.clearSelection();
        Haptics.light();
      }
      return;
    }
    if (piece) {
      const { gameState } = FenParser.parseFen(this.currentFen);
      if (Piece.isWhite(piece) === (gameState.activeColor === 'w')) {
        this.selectSquare(row, col);
      }
    }
  }

  onPieceDrag({ from, to }) {
    if (!this.isAtEnd) { this.goToEnd(); return; }
    if (from.row === to.row && from.col === to.col) return; // tap, not drag
    this.attemptMove(from, to);
  }

  selectSquare(row, col) {
    const moves = Moves.getPieceMoves(this.currentFen, row, col);
    if (!moves.length) {
      this.board.clearSelection();
      AudioFX.illegal();
      Haptics.illegal();
      return;
    }
    this.board.setSelection({ row, col }, Settings.get('showHints') ? moves : []);
    AudioFX.select();
    Haptics.select();
  }

  // ---- Move application ----------------------------------------------
  async attemptMove(from, to) {
    const fen = this.currentFen;
    const validMoves = Moves.getPieceMoves(fen, from.row, from.col);
    const target = validMoves.find(m => m.row === to.row && m.col === to.col);
    if (!target) {
      this.board.clearSelection();
      AudioFX.illegal();
      Haptics.illegal();
      return;
    }
    const { board: boardArr, gameState } = FenParser.parseFen(fen);
    const piece = boardArr[from.row][from.col];
    const opts = {
      castling: target.castling || null,
      enPassant: !!target.enPassant
    };
    const isPromotion = piece.toLowerCase() === 'p' && (to.row === 0 || to.row === 7);
    if (isPromotion) {
      const choice = await pickPromotion(Piece.isWhite(piece) ? 'w' : 'b');
      opts.promotion = choice;
    }
    const newFen = FenParser.movePiece(fen, from, to, opts);
    this.commitMove(newFen, { from, to, piece, captured: boardArr[to.row][to.col], opts });
  }

  commitMove(newFen, info) {
    // Truncate forward history if branching.
    if (this.currentIndex < this.positions.length - 1) {
      this.positions = this.positions.slice(0, this.currentIndex + 1);
      this.sans = this.sans.slice(0, this.currentIndex);
      this.evals = this.evals.slice(0, this.currentIndex + 1);
      this.qualities = this.qualities.slice(0, this.currentIndex);
      this.metadata.Result = '*';
    }
    this.positions.push(newFen);
    this.sans.push(toSAN(info));
    this.qualities.push(null);
    this.currentIndex++;
    this.board.clearSelection();
    this.board.setLastMove({ from: info.from, to: info.to });

    this.playMoveSound(info, newFen);
    this.update();
    GameStore.save(this.snapshot());

    document.dispatchEvent(new CustomEvent('chess:moveCommitted', {
      detail: {
        from: info.from, to: info.to, piece: info.piece,
        captured: info.captured, opts: info.opts,
        san: this.sans[this.sans.length - 1],
        uci: uciOf(info.from, info.to, info.opts.promotion)
      }
    }));

    // Background eval for the bar + coach.
    this.scheduleEval();
    this.maybeMakeAIMove();
  }

  playMoveSound(info, newFen) {
    const { board, gameState } = FenParser.parseFen(newFen);
    const sideJustMoved = gameState.activeColor === 'w' ? 'b' : 'w';
    const inCheck = Moves.isKingInCheck(board, gameState.activeColor === 'w');
    const mate = inCheck && Moves.isCheckmate(board, gameState.activeColor === 'w');
    if (mate) { AudioFX.checkmate(); Haptics.win(); }
    else if (inCheck) { AudioFX.check(); Haptics.check(); }
    else if (info.opts.castling) { AudioFX.castle(); Haptics.move(); }
    else if (info.opts.promotion) { AudioFX.promote(); Haptics.move(); }
    else if (info.captured || info.opts.enPassant) { AudioFX.capture(); Haptics.capture(); }
    else { AudioFX.move(); Haptics.move(); }
  }

  // ---- AI -------------------------------------------------------------
  async maybeMakeAIMove() {
    if (!Settings.get('aiEnabled')) return;
    const { gameState, board } = FenParser.parseFen(this.currentFen);
    if (gameState.activeColor !== Settings.get('aiColor')) return;
    if (Moves.isCheckmate(board, gameState.activeColor === 'w')) return;
    if (Moves.isStalemate(board, gameState.activeColor === 'w')) return;

    this.aiThinking = true;
    this.refs.statusEl.innerHTML = '<span class="thinking"></span>AI thinking…';
    try {
      const depth = Settings.get('aiDepth') || 2;
      const { move } = await Engine.bestMove(this.currentFen, depth);
      if (!move) return;
      // Validate the move is still legal (it should be, but be safe).
      const legal = Moves.getPieceMoves(this.currentFen, move.from.row, move.from.col)
        .find(m => m.row === move.to.row && m.col === move.to.col);
      if (!legal) return;
      const opts = {
        castling: move.info?.castling || null,
        enPassant: !!move.info?.enPassant,
        promotion: move.promotion || null
      };
      const { board: bArr } = FenParser.parseFen(this.currentFen);
      const captured = bArr[move.to.row][move.to.col];
      const newFen = FenParser.movePiece(this.currentFen, move.from, move.to, opts);
      this.commitMove(newFen, { from: move.from, to: move.to, piece: move.piece, captured, opts });
    } catch (err) {
      console.warn('AI move failed:', err.message);
      toast('AI move failed: ' + err.message, 'warning');
    } finally {
      this.aiThinking = false;
      this.refs.statusEl.textContent = '';
    }
  }

  // ---- Eval / coach ---------------------------------------------------
  async scheduleEval() {
    if (!Settings.get('coach')) return;
    if (this.evaluating) return;
    this.evaluating = true;
    try {
      const fen = this.currentFen;
      const { board, gameState } = FenParser.parseFen(fen);
      // Mate / stalemate detection up front.
      if (Moves.isCheckmate(board, gameState.activeColor === 'w')) {
        const mateScore = gameState.activeColor === 'w' ? -100000 : 100000;
        this.evals[this.currentIndex] = mateScore;
        this.evalBar.set(0, gameState.activeColor === 'w' ? -1 : 1);
      } else if (Moves.isStalemate(board, gameState.activeColor === 'w')) {
        this.evals[this.currentIndex] = 0;
        this.evalBar.set(0);
      } else {
        const { score } = await Engine.evaluate(fen);
        this.evals[this.currentIndex] = score;
        this.evalBar.set(score);
      }
      // Annotate the move that just produced this position.
      if (this.currentIndex >= 1) {
        const before = this.evals[this.currentIndex - 1];
        const after = this.evals[this.currentIndex];
        if (before != null && after != null) {
          const isWhiteMover = (this.currentIndex % 2 === 1); // ply 1, 3, 5 are white moves
          const q = classify({ scoreBefore: before, scoreAfter: after, isWhiteMover });
          this.qualities[this.currentIndex - 1] = q;
          this.renderMoveList();
        }
      }
    } catch {
      // Eval is best-effort; ignore failures.
    } finally {
      this.evaluating = false;
    }
  }

  // ---- Rendering ------------------------------------------------------
  update() {
    const fen = this.currentFen;
    this.board.render(fen);
    this.renderCaptures(fen);
    this.renderIndicators(fen);
    this.renderNavigation(fen);
    this.renderMoveList();
  }

  renderCaptures(fen) {
    const { gameState } = FenParser.parseFen(fen);
    const capt = gameState.capturedPieces || [];
    const whiteCaptured = capt.filter(p => Piece.isWhite(p)); // captured white pieces (taken from white)
    const blackCaptured = capt.filter(p => !Piece.isWhite(p));
    // White's side board shows the BLACK pieces white has captured.
    const whiteHas = blackCaptured;
    const blackHas = whiteCaptured;
    this.whiteSide.render(whiteHas, materialSum(blackHas));
    this.blackSide.render(blackHas, materialSum(whiteHas));
  }

  renderIndicators(fen) {
    const { board, gameState } = FenParser.parseFen(fen);
    const isWhiteActive = gameState.activeColor === 'w';
    const isLast = this.isAtEnd;
    let whiteText = this.metadata.White || 'Player White';
    let blackText = this.metadata.Black || 'Player Black';
    let whiteWins = false, blackWins = false;
    if (isLast) {
      if (Moves.isKingInCheck(board, isWhiteActive)) {
        if (Moves.isCheckmate(board, isWhiteActive)) {
          if (isWhiteActive) { whiteText += ' (checkmate)'; blackText += ' wins!'; blackWins = true; this.metadata.Result = '0-1'; }
          else               { blackText += ' (checkmate)'; whiteText += ' wins!'; whiteWins = true; this.metadata.Result = '1-0'; }
        } else {
          if (isWhiteActive) whiteText += ' (check)';
          else               blackText += ' (check)';
        }
      } else if (Moves.isStalemate(board, isWhiteActive)) {
        whiteText += ' (stalemate)';
        blackText += ' (stalemate)';
        this.metadata.Result = '1/2-1/2';
      } else if (Moves.isInsufficientMaterial(board)) {
        whiteText += ' (draw)';
        blackText += ' (draw)';
        this.metadata.Result = '1/2-1/2';
      }
    }
    setIndicator(this.refs.whiteIndicatorEl, whiteText, isWhiteActive, whiteWins, 'white');
    setIndicator(this.refs.blackIndicatorEl, blackText, !isWhiteActive, blackWins, 'black');
  }

  renderNavigation(fen) {
    const { gameState } = FenParser.parseFen(fen);
    const back = this.refs.navEl.querySelector('.nav-back');
    const fwd = this.refs.navEl.querySelector('.nav-forward');
    const start = this.refs.navEl.querySelector('.nav-start');
    const end = this.refs.navEl.querySelector('.nav-end');
    const moveNum = this.refs.navEl.querySelector('.move-number');
    if (back) back.disabled = this.currentIndex === 0;
    if (fwd)  fwd.disabled = this.currentIndex === this.positions.length - 1;
    if (start) start.disabled = this.currentIndex === 0;
    if (end)   end.disabled = this.currentIndex === this.positions.length - 1;
    if (moveNum) moveNum.textContent = `${gameState.fullmove}${this.sans.length === 0 ? '' : (gameState.activeColor === 'b' ? '.' : '...')}`;
  }

  renderMoveList() {
    if (!this.refs.moveListEl) return;
    const el = this.refs.moveListEl;
    el.innerHTML = '';
    for (let i = 0; i < this.sans.length; i++) {
      if (i % 2 === 0) {
        const num = document.createElement('span');
        num.className = 'text-gray-500 ml-1';
        num.textContent = `${(i / 2) + 1}.`;
        el.appendChild(num);
      }
      const span = document.createElement('span');
      span.className = 'ply';
      span.dataset.idx = (i + 1).toString();
      if (i + 1 === this.currentIndex) span.dataset.current = 'true';
      const q = this.qualities[i];
      span.innerHTML = `${this.sans[i]}${q ? ` <span class="move-tag" data-quality="${q.tag}">${q.label}</span>` : ''}`;
      span.addEventListener('click', () => this.jumpTo(i + 1));
      el.appendChild(span);
    }
  }

  // ---- PGN export -----------------------------------------------------
  toPGN() {
    const lines = [];
    for (const [k, v] of Object.entries(this.metadata)) lines.push(`[${k} "${v}"]`);
    lines.push('');
    let body = '';
    for (let i = 0; i < this.sans.length; i++) {
      if (i % 2 === 0) body += `${(i / 2) + 1}. `;
      body += this.sans[i] + ' ';
    }
    body += this.metadata.Result || '*';
    lines.push(body.trim());
    return lines.join('\n');
  }
}

function uciOf(from, to, promotion) {
  const file = (c) => String.fromCharCode(97 + c);
  const rank = (r) => (8 - r).toString();
  return `${file(from.col)}${rank(from.row)}${file(to.col)}${rank(to.row)}${promotion ? promotion.toLowerCase() : ''}`;
}

function setIndicator(el, text, active, winner, side) {
  if (!el) return;
  const base = 'px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200';
  let cls = `${base} text-gray-400`;
  if (winner) cls = `${base} bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.7)]`;
  else if (active) {
    cls = side === 'white'
      ? `${base} bg-white text-gray-800 ring-2 ring-gray-400 shadow-lg scale-105`
      : `${base} bg-gray-800 text-white ring-2 ring-gray-600 shadow-lg scale-105`;
  }
  el.className = cls;
  el.textContent = text;
}

// ---- SAN derivation -----------------------------------------------------
// Minimal SAN — sufficient for the move list display.
function toSAN(info) {
  const { from, to, piece, captured, opts } = info;
  if (opts.castling === 'king') return 'O-O';
  if (opts.castling === 'queen') return 'O-O-O';
  const file = (c) => String.fromCharCode(97 + c);
  const rank = (r) => (8 - r).toString();
  const pt = piece.toUpperCase();
  let san = '';
  if (pt === 'P') {
    if (captured || opts.enPassant) san += `${file(from.col)}x`;
    san += `${file(to.col)}${rank(to.row)}`;
    if (opts.promotion) san += `=${opts.promotion.toUpperCase()}`;
  } else {
    san += pt;
    if (captured) san += 'x';
    san += `${file(to.col)}${rank(to.row)}`;
  }
  return san;
}
