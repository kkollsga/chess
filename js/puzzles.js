// Daily puzzles. Static curated set (mate-in-1 and mate-in-2 positions).
// `dailyPuzzle()` returns a deterministic puzzle for the current calendar day.

const PUZZLES = [
  { fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', solution: ['e1e8'], hint: 'White to mate in 1.' },
  { fen: '7k/6pp/8/8/8/8/6PP/3R3K w - - 0 1', solution: ['d1d8'], hint: 'White to mate in 1.' },
  { fen: 'r1bqkbnr/pppp1Qpp/2n5/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 3', solution: ['e8e7'], hint: "Black is forced — there's only one move." },
  { fen: '5rk1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', solution: ['d1d8'], hint: 'White to mate in 1.' },
  { fen: 'r5k1/5ppp/8/8/8/2B5/5PPP/6K1 w - - 0 1', solution: ['c3a5'], hint: 'White wins the rook.' },
  { fen: '3k4/3P4/3K4/8/8/8/8/8 w - - 0 1', solution: ['d6c6'], hint: 'White promotes after this key move.' },
  { fen: 'r1b1k2r/pppp1ppp/2n2n2/2b1p2q/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1', solution: ['c4f7'], hint: 'Forking attack on f7.' },
  { fen: '2r3k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1', solution: ['c1c8'], hint: 'Trade rooks first.' }
];

function dayIndex(d = new Date()) {
  // Days since 2020-01-01 (UTC) as a stable integer.
  const epoch = Date.UTC(2020, 0, 1);
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - epoch) / 86400000);
}

export function dailyPuzzle(d = new Date()) {
  const idx = dayIndex(d) % PUZZLES.length;
  return { ...PUZZLES[idx], dayKey: dayKey(d) };
}

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
