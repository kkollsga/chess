// Move-quality classifier. Classifies based on centipawn drop between
// (best-move eval before the move) and (eval after the move was played).
// Inputs are from white's perspective (positive = white better).

export function classify({ scoreBefore, scoreAfter, isWhiteMover }) {
  if (scoreBefore == null || scoreAfter == null) return null;
  // Convert to mover's perspective.
  const before = isWhiteMover ? scoreBefore : -scoreBefore;
  const after = isWhiteMover ? scoreAfter : -scoreAfter;
  const drop = before - after; // how much worse for the mover
  if (drop <= 10) return { tag: 'best', label: 'Best' };
  if (drop <= 40) return { tag: 'good', label: 'Good' };
  if (drop <= 80) return { tag: 'ok', label: 'OK' };
  if (drop <= 150) return { tag: 'inaccuracy', label: 'Inaccuracy' };
  if (drop <= 300) return { tag: 'mistake', label: 'Mistake' };
  return { tag: 'blunder', label: 'Blunder' };
}
