// Lightweight Web Audio sound effects — synthesized, no external assets.
import { Settings } from './settings.js';

let ctx = null;

function ensureCtx() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  return ctx;
}

function tone({ freq, duration = 0.08, type = 'sine', gain = 0.18, sweep = null, delay = 0 }) {
  if (!Settings.get('sound')) return;
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noiseBurst({ duration = 0.06, gain = 0.12, delay = 0 }) {
  if (!Settings.get('sound')) return;
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const t0 = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.destination);
  src.start(t0);
}

export const AudioFX = {
  // Call once on first user gesture (iOS requires this).
  unlock() { ensureCtx(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
  select() { tone({ freq: 540, duration: 0.04, type: 'triangle', gain: 0.08 }); },
  move()   { tone({ freq: 320, duration: 0.06, type: 'sine', gain: 0.15, sweep: 280 }); },
  capture(){ noiseBurst({ duration: 0.07, gain: 0.18 }); tone({ freq: 220, duration: 0.08, type: 'square', gain: 0.12, sweep: 110 }); },
  castle() { tone({ freq: 360, duration: 0.07, gain: 0.13 }); tone({ freq: 540, duration: 0.07, gain: 0.13, delay: 0.07 }); },
  check()  { tone({ freq: 880, duration: 0.1, type: 'sawtooth', gain: 0.14 }); tone({ freq: 660, duration: 0.1, type: 'sawtooth', gain: 0.14, delay: 0.08 }); },
  checkmate() {
    [880, 740, 587, 440].forEach((f, i) => tone({ freq: f, duration: 0.18, gain: 0.16, type: 'triangle', delay: i * 0.13 }));
  },
  illegal(){ tone({ freq: 160, duration: 0.12, type: 'square', gain: 0.12 }); },
  promote(){ tone({ freq: 523, duration: 0.08, gain: 0.14 }); tone({ freq: 784, duration: 0.1, gain: 0.14, delay: 0.08 }); }
};
