// Piece glyphs and color helpers.
const SYMBOLS = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙'
};
// Use solid glyphs for both colors and let CSS color them — improves contrast at small sizes.
const SOLID = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

export const Piece = {
  symbol(fen) { return SOLID[fen]; },
  color(fen) { return fen === fen.toUpperCase() ? 'white' : 'black'; },
  isWhite(fen) { return !!fen && fen === fen.toUpperCase(); },
  isBlack(fen) { return !!fen && fen === fen.toLowerCase(); },
  outline(fen) { return SYMBOLS[fen]; }
};
