// Verify the engine picks a sane move from a tactical position.
// Runs the worker module logic directly (no Worker thread needed for syntax/logic check).
import { Piece } from '../js/piece.js';
import { FenParser } from '../js/fen.js';
import { Moves } from '../js/moves.js';

// Re-implement the bare minimum used by the worker, importing the same modules,
// so we don't depend on the Worker runtime here.
const VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
function evaluate(board, side) {
  let s = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (!p) continue;
    const v = VALUES[p.toLowerCase()];
    s += Piece.isWhite(p) ? v : -v;
  }
  return side === 'w' ? s : -s;
}
function genMoves(fen) {
  const { board } = FenParser.parseFen(fen);
  const all = Moves.getAllMoves(fen);
  return all.map(m => ({ ...m,
    captured: board[m.to.row][m.to.col],
    promotion: m.piece.toLowerCase() === 'p' && (m.to.row === 0 || m.to.row === 7) ? (Piece.isWhite(m.piece) ? 'Q' : 'q') : null
  }));
}
function apply(fen, m) {
  return FenParser.movePiece(fen, m.from, m.to, {
    castling: m.info?.castling || null, enPassant: !!m.info?.enPassant, promotion: m.promotion || null
  });
}
function negamax(fen, depth, alpha, beta) {
  if (depth <= 0) {
    const { board, gameState } = FenParser.parseFen(fen);
    return evaluate(board, gameState.activeColor);
  }
  const ms = genMoves(fen);
  if (!ms.length) {
    const { board, gameState } = FenParser.parseFen(fen);
    if (Moves.isKingInCheck(board, gameState.activeColor === 'w')) return -100000 + depth;
    return 0;
  }
  let best = -Infinity;
  for (const m of ms) {
    const score = -negamax(apply(fen, m), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Mate-in-1: White to move, Re1-e8#
const matein1 = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
const moves = genMoves(matein1);
let best = null, bestScore = -Infinity;
for (const m of moves) {
  const s = -negamax(apply(matein1, m), 1, -Infinity, Infinity);
  if (s > bestScore) { bestScore = s; best = m; }
}
const file = (c) => String.fromCharCode(97 + c);
const rank = (r) => 8 - r;
const uci = `${file(best.from.col)}${rank(best.from.row)}${file(best.to.col)}${rank(best.to.row)}`;
console.log(`Best move chosen: ${uci} (score ${bestScore})`);
if (uci !== 'e1e8') { console.error('FAIL: expected e1e8 (mate)'); process.exit(1); }
console.log('OK engine picks the mate-in-1');
