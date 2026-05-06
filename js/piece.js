// Piece glyphs and color helpers.
// SVG assets live at icons/pieces/{w,b}{K,Q,R,B,N,P}.svg.
// Unicode symbols are kept as a fallback for ARIA / non-graphical contexts.
const SYMBOLS = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

export const Piece = {
  symbol(fen) { return SYMBOLS[fen]; },
  color(fen) { return fen === fen.toUpperCase() ? 'white' : 'black'; },
  isWhite(fen) { return !!fen && fen === fen.toUpperCase(); },
  isBlack(fen) { return !!fen && fen === fen.toLowerCase(); },
  // Path to the SVG asset for the given FEN char (e.g., 'K' -> 'icons/pieces/wK.svg').
  asset(fen) {
    const isWhite = fen === fen.toUpperCase();
    return `icons/pieces/${isWhite ? 'w' : 'b'}${fen.toUpperCase()}.svg`;
  }
};

