// Legal-move generation, check / checkmate / stalemate detection. Pure module.
import { Piece } from './piece.js';
import { FenParser } from './fen.js';

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function getPawnMoves(board, row, col, piece, ep) {
  const moves = [];
  const dir = Piece.isWhite(piece) ? -1 : 1;
  const start = Piece.isWhite(piece) ? 6 : 1;
  if (inBounds(row + dir, col) && !board[row + dir][col]) {
    moves.push({ row: row + dir, col });
    if (row === start && !board[row + 2 * dir][col]) moves.push({ row: row + 2 * dir, col });
  }
  for (const cc of [col - 1, col + 1]) {
    if (!inBounds(row + dir, cc)) continue;
    const t = board[row + dir][cc];
    if (t && Piece.isWhite(t) !== Piece.isWhite(piece)) moves.push({ row: row + dir, col: cc });
  }
  if (ep && ep !== '-') {
    const epSq = FenParser.algebraicToIndices(ep);
    if (Math.abs(col - epSq.col) === 1 && row + dir === epSq.row) {
      moves.push({ row: epSq.row, col: epSq.col, enPassant: true });
    }
  }
  return moves;
}

function getKnightMoves(board, row, col, piece) {
  const moves = [];
  for (const [dr, dc] of [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]]) {
    const r = row + dr, c = col + dc;
    if (!inBounds(r, c)) continue;
    const t = board[r][c];
    if (!t || Piece.isWhite(t) !== Piece.isWhite(piece)) moves.push({ row: r, col: c });
  }
  return moves;
}

function getSliding(board, row, col, piece, dirs) {
  const moves = [];
  for (const [dr, dc] of dirs) {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const t = board[r][c];
      if (!t) moves.push({ row: r, col: c });
      else {
        if (Piece.isWhite(t) !== Piece.isWhite(piece)) moves.push({ row: r, col: c });
        break;
      }
      r += dr; c += dc;
    }
  }
  return moves;
}

const BISHOP = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK = [[-1,0],[1,0],[0,-1],[0,1]];
const QUEEN = [...BISHOP, ...ROOK];
const KING = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function getKingMoves(board, row, col, piece, castling) {
  const moves = [];
  for (const [dr, dc] of KING) {
    const r = row + dr, c = col + dc;
    if (!inBounds(r, c)) continue;
    const t = board[r][c];
    if (!t || Piece.isWhite(t) !== Piece.isWhite(piece)) moves.push({ row: r, col: c });
  }
  const isWhite = Piece.isWhite(piece);
  const baseRank = isWhite ? 7 : 0;
  if (row === baseRank && col === 4 && castling) {
    if (castling.includes(isWhite ? 'K' : 'k')
      && !board[baseRank][5] && !board[baseRank][6]
      && !isSquareAttacked(board, baseRank, 4, !isWhite)
      && !isSquareAttacked(board, baseRank, 5, !isWhite)
      && !isSquareAttacked(board, baseRank, 6, !isWhite)) {
      moves.push({ row: baseRank, col: 6, castling: 'king' });
    }
    if (castling.includes(isWhite ? 'Q' : 'q')
      && !board[baseRank][1] && !board[baseRank][2] && !board[baseRank][3]
      && !isSquareAttacked(board, baseRank, 4, !isWhite)
      && !isSquareAttacked(board, baseRank, 3, !isWhite)
      && !isSquareAttacked(board, baseRank, 2, !isWhite)) {
      moves.push({ row: baseRank, col: 2, castling: 'queen' });
    }
  }
  return moves;
}

function isSquareAttacked(board, row, col, byWhite) {
  const pawnDir = byWhite ? 1 : -1;
  for (const dc of [-1, 1]) {
    const r = row + pawnDir, c = col + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.toLowerCase() === 'p' && Piece.isWhite(p) === byWhite) return true;
    }
  }
  for (const [dr, dc] of [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]]) {
    const r = row + dr, c = col + dc;
    if (!inBounds(r, c)) continue;
    const p = board[r][c];
    if (p && p.toLowerCase() === 'n' && Piece.isWhite(p) === byWhite) return true;
  }
  for (const [dr, dc] of QUEEN) {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (Piece.isWhite(p) === byWhite) {
          const t = p.toLowerCase();
          const diag = Math.abs(dr) === Math.abs(dc);
          const ortho = dr === 0 || dc === 0;
          if ((diag && (t === 'b' || t === 'q')) || (ortho && (t === 'r' || t === 'q'))) return true;
        }
        break;
      }
      r += dr; c += dc;
    }
  }
  for (const [dr, dc] of KING) {
    const r = row + dr, c = col + dc;
    if (!inBounds(r, c)) continue;
    const p = board[r][c];
    if (p && p.toLowerCase() === 'k' && Piece.isWhite(p) === byWhite) return true;
  }
  return false;
}

function findKing(board, isWhite) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p.toLowerCase() === 'k' && Piece.isWhite(p) === isWhite) return { row: r, col: c };
  }
  return null;
}

function isKingInCheck(board, isWhite) {
  const k = findKing(board, isWhite);
  if (!k) return false;
  return isSquareAttacked(board, k.row, k.col, !isWhite);
}

function movePutsKingInCheck(board, fromR, fromC, toR, toC, piece, opts = {}) {
  const tmp = board.map(r => [...r]);
  tmp[toR][toC] = opts.promotion || piece;
  tmp[fromR][fromC] = null;
  if (opts.enPassant) tmp[fromR][toC] = null;
  if (opts.castling) {
    const rookRow = Piece.isWhite(piece) ? 7 : 0;
    if (opts.castling === 'king') { tmp[rookRow][7] = null; tmp[rookRow][5] = Piece.isWhite(piece) ? 'R' : 'r'; }
    else { tmp[rookRow][0] = null; tmp[rookRow][3] = Piece.isWhite(piece) ? 'R' : 'r'; }
  }
  return isKingInCheck(tmp, Piece.isWhite(piece));
}

export const Moves = {
  isInBounds: inBounds,
  isKingInCheck,
  isSquareAttacked,
  findKing,

  getPieceMoves(fen, fromRow, fromCol) {
    const { board, gameState } = FenParser.parseFen(fen);
    const piece = board[fromRow][fromCol];
    if (!piece) return [];
    const pieceColor = Piece.isWhite(piece) ? 'w' : 'b';
    if (pieceColor !== gameState.activeColor) return [];
    let pseudo;
    switch (piece.toLowerCase()) {
      case 'p': pseudo = getPawnMoves(board, fromRow, fromCol, piece, gameState.enPassant); break;
      case 'n': pseudo = getKnightMoves(board, fromRow, fromCol, piece); break;
      case 'b': pseudo = getSliding(board, fromRow, fromCol, piece, BISHOP); break;
      case 'r': pseudo = getSliding(board, fromRow, fromCol, piece, ROOK); break;
      case 'q': pseudo = getSliding(board, fromRow, fromCol, piece, QUEEN); break;
      case 'k': pseudo = getKingMoves(board, fromRow, fromCol, piece, gameState.castling); break;
      default: pseudo = [];
    }
    return pseudo.filter(m => !movePutsKingInCheck(board, fromRow, fromCol, m.row, m.col, piece, m));
  },

  isValidMove(fen, fromR, fromC, toR, toC) {
    return this.getPieceMoves(fen, fromR, fromC).some(m => m.row === toR && m.col === toC);
  },

  getAllMoves(fen) {
    const { board, gameState } = FenParser.parseFen(fen);
    const all = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const isW = Piece.isWhite(p);
      if ((isW && gameState.activeColor !== 'w') || (!isW && gameState.activeColor !== 'b')) continue;
      const moves = this.getPieceMoves(fen, r, c);
      for (const m of moves) all.push({ from: { row: r, col: c }, to: { row: m.row, col: m.col }, info: m, piece: p });
    }
    return all;
  },

  isCheckmate(board, isWhiteKing) {
    if (!isKingInCheck(board, isWhiteKing)) return false;
    return !this.hasAnyLegalMove(board, isWhiteKing);
  },

  isStalemate(board, isWhiteKing) {
    if (isKingInCheck(board, isWhiteKing)) return false;
    return !this.hasAnyLegalMove(board, isWhiteKing);
  },

  hasAnyLegalMove(board, isWhiteKing) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || Piece.isWhite(piece) !== isWhiteKing) continue;
      let pseudo;
      switch (piece.toLowerCase()) {
        case 'p': pseudo = getPawnMoves(board, r, c, piece, '-'); break;
        case 'n': pseudo = getKnightMoves(board, r, c, piece); break;
        case 'b': pseudo = getSliding(board, r, c, piece, BISHOP); break;
        case 'r': pseudo = getSliding(board, r, c, piece, ROOK); break;
        case 'q': pseudo = getSliding(board, r, c, piece, QUEEN); break;
        case 'k': pseudo = getKingMoves(board, r, c, piece, '-'); break;
        default: pseudo = [];
      }
      if (pseudo.some(m => !movePutsKingInCheck(board, r, c, m.row, m.col, piece, m))) return true;
    }
    return false;
  },

  // Insufficient-material draw detection (KvK, KvK+B, KvK+N).
  isInsufficientMaterial(board) {
    const pieces = [];
    for (const row of board) for (const p of row) if (p) pieces.push(p);
    if (pieces.length === 2) return true; // K v K
    if (pieces.length === 3) {
      const non = pieces.find(p => p.toLowerCase() !== 'k');
      if (non && (non.toLowerCase() === 'b' || non.toLowerCase() === 'n')) return true;
    }
    return false;
  }
};
