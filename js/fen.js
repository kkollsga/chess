// FEN parsing/generation and move execution. Pure module — no DOM or notifications.

const VALID_PIECES = new Set(['K','Q','R','B','N','P','k','q','r','b','n','p']);
const VALID_COLORS = new Set(['w','b']);
const VALID_CASTLING_CHARS = new Set(['K','Q','k','q','-']);
const STANDARD_PIECE_COUNTS = {
  K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8,
  k: 1, q: 1, r: 2, b: 2, n: 2, p: 8
};

export const FenParser = {
  DEFAULT: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',

  getDefaultFen() { return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'; },

  countPieces(board) {
    const counts = {};
    for (const p of VALID_PIECES) counts[p] = 0;
    for (const row of board) for (const p of row) if (p !== null) counts[p]++;
    return counts;
  },

  validatePosition(position) {
    const boardPos = position.split(' ')[0];
    if (!boardPos || typeof boardPos !== 'string') throw new Error('Invalid FEN: position required');
    const rows = boardPos.split('/');
    if (rows.length !== 8) throw new Error(`Invalid FEN: must have 8 ranks (got ${rows.length})`);
    for (const row of rows) {
      let count = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) count += parseInt(ch, 10);
        else if (VALID_PIECES.has(ch)) count++;
        else throw new Error(`Invalid FEN: bad character '${ch}'`);
      }
      if (count !== 8) throw new Error(`Invalid FEN: rank '${row}' must total 8`);
    }
    return true;
  },

  validateGameState(gs) {
    if (!VALID_COLORS.has(gs.activeColor)) throw new Error(`Invalid FEN: active color '${gs.activeColor}'`);
    if (gs.castling !== '-') {
      for (const c of gs.castling) if (!VALID_CASTLING_CHARS.has(c)) throw new Error(`Invalid FEN: castling '${c}'`);
    }
    if (gs.enPassant !== '-' && !/^[a-h][36]$/.test(gs.enPassant)) {
      throw new Error(`Invalid FEN: en passant '${gs.enPassant}'`);
    }
    if (!/^\d+$/.test(gs.halfmove)) throw new Error('Invalid FEN: halfmove');
    if (!/^\d+$/.test(gs.fullmove) || parseInt(gs.fullmove, 10) < 1) throw new Error('Invalid FEN: fullmove');
    return true;
  },

  validatePieceCounts(counts) {
    const warnings = [];
    if (counts.K !== 1) warnings.push(`Invalid white king count: ${counts.K}`);
    if (counts.k !== 1) warnings.push(`Invalid black king count: ${counts.k}`);
    const wPawns = counts.P, bPawns = counts.p;
    const wPromo = Math.max(0, 8 - wPawns), bPromo = Math.max(0, 8 - bPawns);
    const check = (piece, std, promo) => {
      const c = counts[piece];
      const max = std + promo;
      if (c > max) warnings.push(`Too many ${piece}: ${c}/${std} (max ${max})`);
    };
    check('Q', 1, wPromo); check('R', 2, wPromo); check('B', 2, wPromo); check('N', 2, wPromo);
    check('q', 1, bPromo); check('r', 2, bPromo); check('b', 2, bPromo); check('n', 2, bPromo);
    return warnings;
  },

  isValidSetup(counts) {
    if (counts.K !== 1 || counts.k !== 1) return false;
    const okCount = (piece, std) => {
      const c = counts[piece];
      const isWhite = piece === piece.toUpperCase();
      if (piece === 'P' || piece === 'p') return c <= 8;
      const pawns = counts[isWhite ? 'P' : 'p'];
      const promos = Math.max(0, 8 - pawns);
      return c <= std + promos;
    };
    return Object.entries(STANDARD_PIECE_COUNTS).every(([p, s]) => okCount(p, s));
  },

  calculateCapturedPieces(counts) {
    const captured = [];
    const order = ['q','r','b','n','p','Q','R','B','N','P'];
    for (const piece of order) {
      const std = STANDARD_PIECE_COUNTS[piece];
      const missing = Math.max(0, std - counts[piece]);
      for (let i = 0; i < missing; i++) captured.push(piece);
    }
    return captured;
  },

  parseFen(fen) {
    const parts = fen.split(' ');
    const position = parts[0];
    this.validatePosition(position);
    const board = [];
    for (const row of position.split('/')) {
      const r = [];
      for (const ch of row) {
        if (/\d/.test(ch)) r.push(...Array(parseInt(ch, 10)).fill(null));
        else r.push(ch);
      }
      board.push(r);
    }
    const counts = this.countPieces(board);
    const warnings = this.validatePieceCounts(counts);
    const isValidSetup = this.isValidSetup(counts);
    const capturedPieces = isValidSetup ? this.calculateCapturedPieces(counts) : [];
    const gameState = {
      activeColor: parts[1] || 'w',
      castling: parts[2] || 'KQkq',
      enPassant: parts[3] || '-',
      halfmove: parts[4] || '0',
      fullmove: parts[5] || '1',
      isValidSetup, warnings, capturedPieces
    };
    this.validateGameState(gameState);
    return { board, gameState };
  },

  generateFen(board, gs = {}) {
    const { activeColor='w', castling='KQkq', enPassant='-', halfmove='0', fullmove='1' } = gs;
    const rows = board.map(row => {
      let empty = 0, out = '';
      for (const sq of row) {
        if (sq === null) empty++;
        else { if (empty) { out += empty; empty = 0; } out += sq; }
      }
      if (empty) out += empty;
      return out;
    });
    return `${rows.join('/')} ${activeColor} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
  },

  algebraicToIndices(sq) {
    return { row: 8 - parseInt(sq.charAt(1), 10), col: sq.charCodeAt(0) - 97 };
  },

  indicesToAlgebraic(row, col) {
    return `${String.fromCharCode(97 + col)}${8 - row}`;
  },

  movePiece(fen, from, to, options = {}) {
    const { board, gameState } = this.parseFen(fen);
    const fromPos = typeof from === 'string' ? this.algebraicToIndices(from) : { row: from.row, col: from.col };
    const toPos = typeof to === 'string' ? this.algebraicToIndices(to) : { row: to.row, col: to.col };
    const moving = board[fromPos.row][fromPos.col];
    const captured = board[toPos.row][toPos.col];
    if (!moving) throw new Error('No piece at source');
    board[toPos.row][toPos.col] = options.promotion || moving;
    board[fromPos.row][fromPos.col] = null;

    if (options.enPassant && gameState.enPassant === this.indicesToAlgebraic(toPos.row, toPos.col)) {
      board[fromPos.row][toPos.col] = null;
    }
    if (options.castling) {
      const rookRow = gameState.activeColor === 'w' ? 7 : 0;
      if (options.castling === 'king') {
        board[rookRow][7] = null;
        board[rookRow][5] = gameState.activeColor === 'w' ? 'R' : 'r';
      } else {
        board[rookRow][0] = null;
        board[rookRow][3] = gameState.activeColor === 'w' ? 'R' : 'r';
      }
    }

    gameState.activeColor = gameState.activeColor === 'w' ? 'b' : 'w';

    if (moving === 'K') gameState.castling = gameState.castling.replace(/[KQ]/g, '');
    else if (moving === 'k') gameState.castling = gameState.castling.replace(/[kq]/g, '');
    else if (moving === 'R') {
      if (fromPos.col === 0 && fromPos.row === 7) gameState.castling = gameState.castling.replace('Q','');
      if (fromPos.col === 7 && fromPos.row === 7) gameState.castling = gameState.castling.replace('K','');
    } else if (moving === 'r') {
      if (fromPos.col === 0 && fromPos.row === 0) gameState.castling = gameState.castling.replace('q','');
      if (fromPos.col === 7 && fromPos.row === 0) gameState.castling = gameState.castling.replace('k','');
    }
    if (gameState.castling === '') gameState.castling = '-';

    if (moving.toLowerCase() === 'p' && Math.abs(fromPos.row - toPos.row) === 2) {
      const file = String.fromCharCode(97 + toPos.col);
      const epRank = gameState.activeColor === 'w' ? '6' : '3';
      const enemyPawn = gameState.activeColor === 'w' ? 'P' : 'p';
      const adj = (toPos.col > 0 && board[toPos.row][toPos.col - 1] === enemyPawn) ||
                  (toPos.col < 7 && board[toPos.row][toPos.col + 1] === enemyPawn);
      gameState.enPassant = adj ? file + epRank : '-';
    } else {
      gameState.enPassant = '-';
    }

    const isPawnMove = moving.toLowerCase() === 'p';
    if (isPawnMove || captured || options.enPassant) gameState.halfmove = '0';
    else gameState.halfmove = (parseInt(gameState.halfmove, 10) + 1).toString();
    if (gameState.activeColor === 'w') gameState.fullmove = (parseInt(gameState.fullmove, 10) + 1).toString();

    return this.generateFen(board, gameState);
  },

  getPiecesAtSquares(squares, fen) {
    const { board } = this.parseFen(fen);
    return squares.map(sq => {
      const file = sq.charCodeAt(0) - 97;
      const rank = 8 - parseInt(sq.charAt(1), 10);
      return board[rank][file] || null;
    });
  }
};
