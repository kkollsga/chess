// App entry. Wires DOM refs to the Game controller, registers the SW,
// hooks swipe-to-navigate, and restores any saved game.
import { Game } from './game.js';
import { installUI } from './ui.js';
import { GameStore } from './settings.js';
import { attachSwipe } from './swipe.js';
import { FenParser } from './fen.js';
import { toast } from './notification.js';

function getUrlFen() {
  try {
    const fen = new URLSearchParams(window.location.search).get('fen');
    if (!fen) return null;
    const decoded = decodeURIComponent(fen).trim();
    FenParser.validatePosition(decoded);
    return decoded;
  } catch (err) {
    toast('Invalid FEN in URL: ' + err.message, 'error');
    return null;
  }
}

function bootstrap() {
  const refs = {
    boardEl: document.getElementById('board'),
    whiteCapturesEl: document.getElementById('white-captures'),
    blackCapturesEl: document.getElementById('black-captures'),
    whiteIndicatorEl: document.getElementById('white-indicator'),
    blackIndicatorEl: document.getElementById('black-indicator'),
    navEl: document.getElementById('navigation'),
    moveListEl: document.getElementById('move-list'),
    statusEl: document.getElementById('status'),
    evalBarEl: document.getElementById('eval-bar'),
    evalFillEl: document.getElementById('eval-bar-fill'),
    evalLabelEl: document.getElementById('eval-bar-label')
  };

  const game = new Game(refs);

  // Boot order: URL FEN > saved game > default.
  const urlFen = getUrlFen();
  if (urlFen) game.reset(urlFen);
  else {
    const saved = GameStore.load();
    if (saved && Array.isArray(saved.positions) && saved.positions.length) game.loadFromSnapshot(saved);
  }

  installUI(game);

  // Navigation buttons.
  refs.navEl.querySelector('.nav-back').addEventListener('click', () => game.goBack());
  refs.navEl.querySelector('.nav-forward').addEventListener('click', () => game.goForward());
  refs.navEl.querySelector('.nav-start').addEventListener('click', () => game.goToStart());
  refs.navEl.querySelector('.nav-end').addEventListener('click', () => game.goToEnd());

  // Swipe on the board container for prev/next move (ignores in-progress drags).
  const container = document.getElementById('board-container');
  attachSwipe(container, {
    onSwipeLeft: () => game.goForward(),
    onSwipeRight: () => game.goBack(),
    shouldIgnore: (e) => {
      // If the touch starts on a piece on top of a square that has the active color, treat as drag.
      const t = e.touches?.[0] || e;
      const el = document.elementFromPoint(t.clientX, t.clientY);
      return !!(el && el.closest('.piece'));
    }
  });

  // Keyboard nav (works on iPad with hardware keyboard too).
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') game.goBack();
    else if (e.key === 'ArrowRight') game.goForward();
    else if (e.key === 'Home') game.goToStart();
    else if (e.key === 'End') game.goToEnd();
  });

  // Service worker (PWA / offline).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // Expose for debugging (not relied on by the app).
  window.__game = game;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
