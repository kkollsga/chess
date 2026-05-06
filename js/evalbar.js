// Evaluation bar (vertical). Centipawn input; clamps to [-1000, +1000] for visual range.
const CLAMP = 1000;

export class EvalBar {
  constructor(barEl, fillEl, labelEl) {
    this.bar = barEl;
    this.fill = fillEl;
    this.label = labelEl;
    this.set(0);
  }

  set(scoreCp, mateIn = null) {
    if (mateIn !== null) {
      const whiteWinning = mateIn > 0;
      this.fill.style.inset = whiteWinning ? '0 0 100% 0' : '0';
      if (this.label) this.label.textContent = `M${Math.abs(mateIn)}`;
      return;
    }
    const clamped = Math.max(-CLAMP, Math.min(CLAMP, scoreCp || 0));
    // Bar fills from bottom up for "white winning"
    const whitePct = 50 + (clamped / CLAMP) * 50;
    const blackPct = 100 - whitePct;
    this.fill.style.inset = `${blackPct}% 0 0 0`;
    if (this.label) {
      const pawns = (clamped / 100).toFixed(1);
      const sign = clamped > 0 ? '+' : '';
      this.label.textContent = `${sign}${pawns}`;
    }
  }
}
