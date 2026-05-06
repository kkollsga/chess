// Promotion picker modal. Returns a promise resolved with 'Q'|'R'|'B'|'N' (or 'q' etc).
export function pickPromotion(color) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl p-4 shadow-2xl">
        <div class="text-sm font-semibold text-gray-700 mb-3 text-center">Promote to</div>
        <div class="flex gap-3">
          ${['q','r','b','n'].map(t => {
            const ch = color === 'w' ? t.toUpperCase() : t;
            return `<button type="button" class="promo-piece piece" data-piece="${ch}" data-type="${ch}" data-color="${color === 'w' ? 'white' : 'black'}" aria-label="Promote to ${t}"></button>`;
          }).join('')}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('button[data-piece]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.piece;
        overlay.remove();
        resolve(p);
      });
    });
    // Default to queen on outside-tap.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(color === 'w' ? 'Q' : 'q');
      }
    });
  });
}
