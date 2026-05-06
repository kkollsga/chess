// Toasts and on-board banners.
const TYPE_BG = {
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  success: 'bg-green-500',
  info: 'bg-blue-500'
};

export function toast(message, type = 'info', ms = 3500) {
  if (message instanceof Error) {
    console.error(message);
    message = message.message;
  }
  const el = document.createElement('div');
  el.className = `toast fixed top-4 right-4 px-4 py-3 rounded-lg text-white max-w-xs shadow-lg z-[9999] ${TYPE_BG[type] || TYPE_BG.info}`;
  el.style.top = `calc(env(safe-area-inset-top) + 1rem)`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    setTimeout(() => el.remove(), 350);
  }, ms);
}

export function banner(text, side = 'top', ms = null) {
  const container = document.querySelector('#board-container');
  if (!container) return;
  const existing = container.querySelector(`[data-banner="${side}"]`);
  if (existing) existing.remove();
  if (!text) return;
  const el = document.createElement('div');
  const baseCls = 'absolute left-1/2 -translate-x-1/2 px-5 py-2 rounded-xl text-sm font-bold shadow-lg z-30 pointer-events-none';
  const sideCls = side === 'top'
    ? 'board-banner-top -top-7 bg-black/90 text-white'
    : 'board-banner-bottom -bottom-9 bg-white/95 text-gray-800';
  el.className = `${baseCls} ${sideCls}`;
  el.dataset.banner = side;
  el.innerHTML = text;
  container.appendChild(el);
  if (ms) setTimeout(() => el.remove(), ms);
}
