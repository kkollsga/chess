// Captured-pieces sidebar.
import { Piece } from './piece.js';

const VALUES = { Q: 9, R: 5, B: 3, N: 3, P: 1, q: 9, r: 5, b: 3, n: 3, p: 1 };

export class SideBoard {
  constructor(side, container) {
    this.side = side;
    this.container = container;
    this.piecesEl = container.querySelector('.pieces-container');
    this.advantageEl = container.querySelector('.advantage');
  }

  render(captured, opposingMaterial) {
    if (!this.piecesEl) return;
    this.piecesEl.innerHTML = '';
    const sorted = [...captured].sort((a, b) => VALUES[b] - VALUES[a]);
    for (const ch of sorted) {
      const el = document.createElement('div');
      el.className = 'piece text-[length:clamp(0.9rem,3vw,1.6rem)] flex items-center justify-center';
      el.dataset.color = Piece.color(ch);
      el.textContent = Piece.symbol(ch);
      this.piecesEl.appendChild(el);
    }
    if (this.advantageEl) {
      const sumCap = captured.reduce((s, p) => s + (VALUES[p] || 0), 0);
      const diff = sumCap - opposingMaterial;
      this.advantageEl.textContent = diff > 0 ? `+${diff}` : '';
    }
  }
}

export function materialSum(captured) {
  return captured.reduce((s, p) => s + (VALUES[p] || 0), 0);
}
