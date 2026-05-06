// Chess AI worker. Runs in a separate thread so the UI never freezes.
// Uses negamax + alpha-beta + piece-square tables + light quiescence.
// Loaded as an ES module worker — imports the same engine modules as the main thread.

import { Piece } from './piece.js';
import { FenParser } from './fen.js';
import { Moves } from './moves.js';

const VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-square tables (from white's perspective, rank 8 at top).
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
  ]
};

function pstValue(piece, row, col) {
  const t = piece.toLowerCase();
  const tbl = PST[t];
  if (!tbl) return 0;
  // PST is from white perspective; mirror for black.
  const idx = Piece.isWhite(piece) ? row * 8 + col : (7 - row) * 8 + col;
  return tbl[idx];
}

function evaluate(board, sideToMove) {
  let score = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (!p) continue;
    const v = VALUES[p.toLowerCase()] + pstValue(p, r, c);
    score += Piece.isWhite(p) ? v : -v;
  }
  // From perspective of the side to move (negamax).
  return sideToMove === 'w' ? score : -score;
}

function moveScore(move) {
  // MVV-LVA-style move ordering: captures and promotions first.
  let s = 0;
  if (move.info && (move.info.castling || move.info.enPassant)) s += 20;
  if (move.captured) s += 10 * (VALUES[move.captured.toLowerCase()] || 0) - (VALUES[move.piece.toLowerCase()] || 0);
  if (move.info && move.promotion) s += 800;
  return s;
}

function generateMoves(fen) {
  const { board } = FenParser.parseFen(fen);
  const all = Moves.getAllMoves(fen);
  return all.map(m => {
    const captured = board[m.to.row][m.to.col];
    const promotion = (m.piece.toLowerCase() === 'p' && (m.to.row === 0 || m.to.row === 7))
      ? (Piece.isWhite(m.piece) ? 'Q' : 'q')
      : null;
    return { ...m, captured, promotion };
  }).sort((a, b) => moveScore(b) - moveScore(a));
}

function applyMove(fen, mv) {
  const opts = {
    castling: mv.info?.castling || null,
    enPassant: mv.info?.enPassant || false,
    promotion: mv.promotion || null
  };
  return FenParser.movePiece(fen, mv.from, mv.to, opts);
}

const MATE = 100000;

function quiescence(fen, alpha, beta, ply) {
  const { board, gameState } = FenParser.parseFen(fen);
  const standPat = evaluate(board, gameState.activeColor);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (ply > 4) return alpha;
  const moves = generateMoves(fen).filter(m => m.captured || m.promotion);
  for (const m of moves) {
    const next = applyMove(fen, m);
    const score = -quiescence(next, -beta, -alpha, ply + 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(fen, depth, alpha, beta, ply = 0) {
  if (depth <= 0) return quiescence(fen, alpha, beta, 0);
  const moves = generateMoves(fen);
  if (moves.length === 0) {
    const { board, gameState } = FenParser.parseFen(fen);
    const isWhiteSide = gameState.activeColor === 'w';
    if (Moves.isKingInCheck(board, isWhiteSide)) return -MATE + ply;
    return 0; // stalemate
  }
  let best = -Infinity;
  for (const m of moves) {
    const next = applyMove(fen, m);
    const score = -negamax(next, depth - 1, -beta, -alpha, ply + 1);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function pickMove(fen, depth) {
  const moves = generateMoves(fen);
  if (!moves.length) return { move: null, score: 0 };
  let bestMove = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  for (const m of moves) {
    const next = applyMove(fen, m);
    const score = -negamax(next, depth - 1, -beta, -alpha);
    if (score > bestScore) { bestScore = score; bestMove = m; }
    if (score > alpha) alpha = score;
  }
  return { move: bestMove, score: bestScore };
}

// Lightweight evaluator used for the eval bar (cheap; depth-1 negamax).
function evalForBar(fen) {
  const moves = generateMoves(fen);
  if (!moves.length) {
    const { board, gameState } = FenParser.parseFen(fen);
    if (Moves.isKingInCheck(board, gameState.activeColor === 'w')) {
      return gameState.activeColor === 'w' ? -MATE : MATE;
    }
    return 0;
  }
  let best = -Infinity;
  for (const m of moves) {
    const next = applyMove(fen, m);
    const { board, gameState } = FenParser.parseFen(next);
    const s = -evaluate(board, gameState.activeColor);
    if (s > best) best = s;
  }
  // Normalize so positive = white advantage.
  const { gameState } = FenParser.parseFen(fen);
  return gameState.activeColor === 'w' ? best : -best;
}

self.onmessage = (e) => {
  const { id, type, fen, depth } = e.data || {};
  try {
    if (type === 'best') {
      const t0 = Date.now();
      const { move, score } = pickMove(fen, Math.max(1, Math.min(4, depth || 2)));
      const elapsed = Date.now() - t0;
      self.postMessage({ id, type: 'best', move, score, elapsed });
    } else if (type === 'eval') {
      const score = evalForBar(fen);
      self.postMessage({ id, type: 'eval', score });
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', message: err.message });
  }
};
