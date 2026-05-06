// Persistent settings (localStorage). Subscribe with onChange to react to updates.
const KEY = 'chess.settings.v1';

const DEFAULTS = {
  sound: true,
  haptics: true,
  aiEnabled: false,
  aiColor: 'b',          // 'w' | 'b' — color the AI plays
  aiDepth: 3,            // 1-4
  coach: true,
  showHints: true,       // legal-move dots when piece selected
  flipBoard: false,      // bottom-of-screen color
  theme: 'classic',      // classic | midnight | emerald | rose | slate
  showCoords: true,
  autoSave: true
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

const state = load();
const listeners = new Set();

export const Settings = {
  get(k) { return state[k]; },
  all() { return { ...state }; },
  set(k, v) {
    if (state[k] === v) return;
    state[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    for (const fn of listeners) fn(k, v, state);
  },
  update(patch) {
    let dirty = false;
    for (const [k, v] of Object.entries(patch)) {
      if (state[k] !== v) { state[k] = v; dirty = true; }
    }
    if (dirty) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
      for (const fn of listeners) fn(null, null, state);
    }
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  reset() {
    Object.assign(state, DEFAULTS);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    for (const fn of listeners) fn(null, null, state);
  }
};

// Persistent game-save (separate slot so settings reset doesn't clobber the game).
const GAME_KEY = 'chess.game.v1';
export const GameStore = {
  save(snapshot) {
    if (!Settings.get('autoSave')) return;
    try { localStorage.setItem(GAME_KEY, JSON.stringify(snapshot)); } catch {}
  },
  load() {
    try {
      const raw = localStorage.getItem(GAME_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  clear() { try { localStorage.removeItem(GAME_KEY); } catch {} }
};

// Streak / puzzle store.
const PUZZLE_KEY = 'chess.puzzles.v1';
export const PuzzleStore = {
  read() {
    try {
      const raw = localStorage.getItem(PUZZLE_KEY);
      return raw ? JSON.parse(raw) : { streak: 0, lastSolvedDate: null, solvedDates: [] };
    } catch { return { streak: 0, lastSolvedDate: null, solvedDates: [] }; }
  },
  write(data) { try { localStorage.setItem(PUZZLE_KEY, JSON.stringify(data)); } catch {} }
};
