// Burger menu, modals (PGN/FEN import, settings, daily puzzle).
import { FenParser } from './fen.js';
import { PGNHandler } from './pgn.js';
import { Settings, GameStore, PuzzleStore } from './settings.js';
import { dailyPuzzle, dayKey } from './puzzles.js';
import { Moves } from './moves.js';
import { toast } from './notification.js';

export function installUI(game) {
  const $ = (id) => document.getElementById(id);

  const menuBtn = $('menu-button');
  const dropdown = $('menu-dropdown');
  const closeMenu = () => dropdown.classList.add('hidden');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', closeMenu);
  dropdown.addEventListener('click', (e) => e.stopPropagation());

  // ---- New game -----------------------------------------------------
  $('btn-new-game').addEventListener('click', () => {
    closeMenu();
    game.reset();
    toast('New game started', 'success');
  });

  // ---- Flip board ---------------------------------------------------
  $('btn-flip-board').addEventListener('click', () => {
    closeMenu();
    Settings.set('flipBoard', !Settings.get('flipBoard'));
  });

  // ---- AI toggle ---------------------------------------------------
  $('btn-toggle-ai').addEventListener('click', () => {
    closeMenu();
    const next = !Settings.get('aiEnabled');
    Settings.set('aiEnabled', next);
    toast(next ? 'AI opponent enabled' : 'AI opponent disabled', 'info');
    if (next) game.maybeMakeAIMove();
  });

  // ---- Settings modal -----------------------------------------------
  const settingsModal = $('settings-modal');
  const showSettings = () => {
    closeMenu();
    settingsModal.classList.remove('hidden');
    syncSettingsUI();
  };
  $('btn-settings').addEventListener('click', showSettings);
  $('settings-close').addEventListener('click', () => settingsModal.classList.add('hidden'));
  $('settings-done').addEventListener('click', () => settingsModal.classList.add('hidden'));
  settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });

  function syncSettingsUI() {
    settingsModal.querySelectorAll('[data-setting]').forEach(el => {
      const k = el.dataset.setting;
      const v = Settings.get(k);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v;
    });
  }
  settingsModal.querySelectorAll('[data-setting]').forEach(el => {
    el.addEventListener('change', () => {
      const k = el.dataset.setting;
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'number' || el.dataset.kind === 'number') v = parseInt(el.value, 10);
      else v = el.value;
      Settings.set(k, v);
    });
  });
  $('settings-reset').addEventListener('click', () => {
    Settings.reset();
    syncSettingsUI();
    toast('Settings reset to defaults', 'info');
  });

  // ---- PGN import ---------------------------------------------------
  const pgnModal = $('pgn-modal');
  $('btn-import-pgn').addEventListener('click', () => { closeMenu(); pgnModal.classList.remove('hidden'); });
  $('pgn-cancel').addEventListener('click', () => { pgnModal.classList.add('hidden'); $('pgn-input').value = ''; });
  $('pgn-confirm').addEventListener('click', () => {
    const text = $('pgn-input').value;
    try {
      const { metadata, positions, sans } = PGNHandler.parsePGN(text);
      game.loadFromSnapshot({ positions, sans, currentIndex: positions.length - 1, metadata });
      pgnModal.classList.add('hidden');
      $('pgn-input').value = '';
      GameStore.save(game.snapshot());
      toast('PGN imported', 'success');
    } catch (err) {
      toast(err.message || String(err), 'error');
    }
  });

  // ---- PGN export ---------------------------------------------------
  $('btn-export-pgn').addEventListener('click', async () => {
    closeMenu();
    const pgn = game.toPGN();
    try {
      await navigator.clipboard.writeText(pgn);
      toast('PGN copied to clipboard', 'success');
    } catch {
      // Fallback — show in a prompt
      window.prompt('Copy your PGN:', pgn);
    }
  });

  // ---- FEN import ---------------------------------------------------
  const fenModal = $('fen-modal');
  $('btn-import-fen').addEventListener('click', () => { closeMenu(); fenModal.classList.remove('hidden'); });
  $('fen-cancel').addEventListener('click', () => { fenModal.classList.add('hidden'); $('fen-input').value = ''; });
  $('fen-confirm').addEventListener('click', () => {
    const text = $('fen-input').value.trim();
    try {
      FenParser.validatePosition(text);
      game.reset(text);
      fenModal.classList.add('hidden');
      $('fen-input').value = '';
      toast('FEN imported', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ---- Daily puzzle ------------------------------------------------
  $('btn-daily-puzzle').addEventListener('click', () => {
    closeMenu();
    const p = dailyPuzzle();
    game.reset(p.fen);
    game._currentPuzzle = p;  // hint state, attached for the result modal
    toast(`Daily puzzle — ${p.hint}`, 'info', 6000);
    showStreakBadge();
  });

  function showStreakBadge() {
    const data = PuzzleStore.read();
    $('streak-display').textContent = data.streak ? `🔥 ${data.streak}-day streak` : '';
  }
  showStreakBadge();

  // Watch for puzzle completion (mate or matching the puzzle's first move).
  document.addEventListener('chess:moveCommitted', (e) => {
    if (!game._currentPuzzle) return;
    const { board, gameState } = FenParser.parseFen(game.currentFen);
    const mate = Moves.isCheckmate(board, gameState.activeColor === 'w');
    const playedUci = e.detail?.uci || '';
    const expected = (game._currentPuzzle.solution || [])[0] || '';
    const matchedFirst = expected && playedUci.startsWith(expected);
    if (!mate && !matchedFirst) return;
    const today = dayKey();
    const data = PuzzleStore.read();
    const yesterday = (() => {
      const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d);
    })();
    if (data.lastSolvedDate === today) return; // already counted
    if (data.lastSolvedDate === yesterday) data.streak += 1;
    else data.streak = 1;
    data.lastSolvedDate = today;
    data.solvedDates = data.solvedDates || [];
    if (!data.solvedDates.includes(today)) data.solvedDates.push(today);
    PuzzleStore.write(data);
    toast(`Solved! 🔥 ${data.streak}-day streak`, 'success', 5000);
    showStreakBadge();
    game._currentPuzzle = null;
  });
}
