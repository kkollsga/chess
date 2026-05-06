// Haptic feedback wrapper. iOS Safari gates navigator.vibrate to PWA installs in some cases —
// silently no-ops where unsupported.
import { Settings } from './settings.js';

function buzz(pattern) {
  if (!Settings.get('haptics')) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
}

export const Haptics = {
  light()    { buzz(8); },
  select()   { buzz(6); },
  move()     { buzz(12); },
  capture()  { buzz([18, 30, 12]); },
  illegal()  { buzz([6, 30, 6]); },
  check()    { buzz([22, 35, 22]); },
  win()      { buzz([35, 60, 35, 60, 80]); },
  lose()     { buzz([80, 100, 80]); }
};
