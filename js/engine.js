// Promise wrapper around the engine worker.
// Uses module workers (supported on iOS Safari 15+, Chrome, Firefox).
// Falls back gracefully if module workers aren't supported.

let worker = null;
let nextId = 1;
const pending = new Map();
let supported = true;

function ensureWorker() {
  if (worker || !supported) return worker;
  try {
    worker = new Worker(new URL('./engine-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, type, move, score, message, elapsed } = e.data || {};
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (type === 'error') p.reject(new Error(message || 'engine error'));
      else p.resolve({ type, move, score, elapsed });
    };
    worker.onerror = (err) => {
      console.warn('Engine worker error:', err.message);
      for (const p of pending.values()) p.reject(err);
      pending.clear();
    };
  } catch (err) {
    console.warn('Module worker unsupported, AI disabled:', err.message);
    supported = false;
  }
  return worker;
}

function send(type, payload, timeoutMs = 15000) {
  const w = ensureWorker();
  if (!w) return Promise.reject(new Error('Engine unavailable'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Engine timeout'));
    }, timeoutMs);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); }
    });
    w.postMessage({ id, type, ...payload });
  });
}

export const Engine = {
  isSupported() { ensureWorker(); return supported; },
  bestMove(fen, depth = 2) { return send('best', { fen, depth }); },
  evaluate(fen) { return send('eval', { fen }, 5000); },
  terminate() {
    if (worker) { worker.terminate(); worker = null; pending.clear(); }
  }
};
