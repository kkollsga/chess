// Smoke test: exercise the core engine modules in Node.
// Verifies imports, FEN parse/generate, legal moves, checkmate, and PGN parsing.
import { FenParser } from '../js/fen.js';
import { Moves } from '../js/moves.js';
import { PGNHandler } from '../js/pgn.js';
import { Piece } from '../js/piece.js';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('OK  ' + name); pass++; }
  catch (e) { console.error('FAIL ' + name + '\n     ' + e.message); fail++; }
}

test('default FEN parses', () => {
  const { board, gameState } = FenParser.parseFen(FenParser.DEFAULT);
  if (board.length !== 8) throw new Error('not 8 ranks');
  if (gameState.activeColor !== 'w') throw new Error('expected white to move');
});

test('e4 then e5 then Nf3 produce expected positions', () => {
  let fen = FenParser.DEFAULT;
  fen = FenParser.movePiece(fen, 'e2', 'e4');
  fen = FenParser.movePiece(fen, 'e7', 'e5');
  fen = FenParser.movePiece(fen, 'g1', 'f3');
  const { board, gameState } = FenParser.parseFen(fen);
  if (gameState.activeColor !== 'b') throw new Error('expected black to move');
  if (board[5][5] !== 'N') throw new Error('Nf3 missing');
});

test('legal moves for opening knight', () => {
  const moves = Moves.getPieceMoves(FenParser.DEFAULT, 7, 1); // b1 knight
  if (moves.length !== 2) throw new Error('expected 2 moves, got ' + moves.length);
});

test('detects scholar mate', () => {
  // Position after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
  let fen = FenParser.DEFAULT;
  fen = FenParser.movePiece(fen, 'e2','e4');
  fen = FenParser.movePiece(fen, 'e7','e5');
  fen = FenParser.movePiece(fen, 'f1','c4');
  fen = FenParser.movePiece(fen, 'b8','c6');
  fen = FenParser.movePiece(fen, 'd1','h5');
  fen = FenParser.movePiece(fen, 'g8','f6');
  fen = FenParser.movePiece(fen, 'h5','f7');
  const { board, gameState } = FenParser.parseFen(fen);
  if (gameState.activeColor !== 'b') throw new Error('expected black to move');
  if (!Moves.isKingInCheck(board, false)) throw new Error('black king should be in check');
  if (!Moves.isCheckmate(board, false)) throw new Error('expected checkmate');
});

test('castling is generated when legal', () => {
  // Set up a position where white can castle kingside.
  const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
  const moves = Moves.getPieceMoves(fen, 7, 4);
  const hasKingside = moves.some(m => m.castling === 'king');
  const hasQueenside = moves.some(m => m.castling === 'queen');
  if (!hasKingside || !hasQueenside) throw new Error('missing castling moves');
});

test('en passant generated and captured', () => {
  // After 1.e4 d6 2.e5 f5 the white pawn can capture en passant.
  let fen = FenParser.DEFAULT;
  fen = FenParser.movePiece(fen, 'e2','e4');
  fen = FenParser.movePiece(fen, 'd7','d6');
  fen = FenParser.movePiece(fen, 'e4','e5');
  fen = FenParser.movePiece(fen, 'f7','f5');
  const moves = Moves.getPieceMoves(fen, 3, 4); // e5 pawn
  const ep = moves.find(m => m.enPassant);
  if (!ep) throw new Error('expected en passant move');
  // Apply it and confirm captured pawn is gone.
  const next = FenParser.movePiece(fen, { row: 3, col: 4 }, { row: ep.row, col: ep.col }, { enPassant: true });
  const { board } = FenParser.parseFen(next);
  if (board[3][5] !== null) throw new Error('captured pawn should be gone');
});

test('insufficient material draw — KvK', () => {
  const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
  const { board } = FenParser.parseFen(fen);
  if (!Moves.isInsufficientMaterial(board)) throw new Error('expected draw');
});

test('PGN: parse a simple game', () => {
  const pgn = `[Event "Test"]
[Site "?"]
[Date "2024.01.01"]
[Round "1"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;
  const { metadata, positions, sans } = PGNHandler.parsePGN(pgn);
  if (metadata.White !== 'A') throw new Error('metadata wrong');
  if (positions.length !== 7) throw new Error('expected 7 positions, got ' + positions.length);
  if (sans.length !== 6) throw new Error('expected 6 sans');
  if (sans[0] !== 'e4') throw new Error('first san wrong');
});

test('Piece glyphs/colors', () => {
  if (Piece.color('K') !== 'white') throw new Error('K should be white');
  if (Piece.color('k') !== 'black') throw new Error('k should be black');
  if (!Piece.symbol('N')) throw new Error('symbol missing');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
