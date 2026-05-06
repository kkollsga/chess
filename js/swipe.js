// Horizontal swipe detection. Only fires when the gesture is clearly horizontal
// and the touch did not start a piece drag (caller passes shouldIgnore).
export function attachSwipe(el, { onSwipeLeft, onSwipeRight, threshold = 50, shouldIgnore } = {}) {
  let startX = 0, startY = 0, startT = 0, active = false;

  const onStart = (e) => {
    if (shouldIgnore && shouldIgnore(e)) { active = false; return; }
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY; startT = Date.now();
    active = true;
  };
  const onEnd = (e) => {
    if (!active) return;
    active = false;
    const t = (e.changedTouches && e.changedTouches[0]) || e;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startT;
    if (dt > 600) return;
    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.7) return;
    if (dx < 0 && onSwipeLeft) onSwipeLeft();
    else if (dx > 0 && onSwipeRight) onSwipeRight();
  };

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchend', onEnd, { passive: true });
  el.addEventListener('touchcancel', () => { active = false; }, { passive: true });

  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchend', onEnd);
  };
}
