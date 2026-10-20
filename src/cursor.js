// Custom cursor: the system arrow stays, a small dot follows just beside it. The dot is white with
// mix-blend-mode: difference, so it reads black on white and white on black (and inverts over images).
// Over anything clickable (links, buttons, pointer-cursor things) it grows a little. Mouse only.
const OFFSET_X = -5, OFFSET_Y = -9;    // px from the arrow tip: just above it, a little to the left
const FOLLOW = 9;                      // 1/s — trails the arrow with a soft, visible lag (was 28: too tight)
const CLICKABLE = 'a[href], button, [role="button"], label, select, summary, input, textarea';

export function initCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const make = cls => { const n = document.createElement('div'); n.className = cls; n.setAttribute('aria-hidden', 'true'); document.body.append(n); return n; };
  const els = [make('cursor-dot')];
  const dot = { classList: { add: c => els.forEach(e => e.classList.add(c)), remove: c => els.forEach(e => e.classList.remove(c)),
    toggle: (c, on) => els.forEach(e => e.classList.toggle(c, on)) } };

  let tx = -100, ty = -100, x = tx, y = ty, raf = 0, prev = 0, shown = false;
  const frame = now => {
    const dt = Math.min(.05, (now - prev) / 1000 || .016); prev = now;
    const k = 1 - Math.exp(-FOLLOW * dt);
    x += (tx - x) * k; y += (ty - y) * k;
    const t = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    for (const e of els) e.style.transform = t;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > .1 ? requestAnimationFrame(frame) : 0;
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX + OFFSET_X; ty = e.clientY + OFFSET_Y;
    if (!shown) { shown = true; x = tx; y = ty; dot.classList.add('is-on'); }
    if (!raf) { prev = performance.now(); raf = requestAnimationFrame(frame); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { shown = false; dot.classList.remove('is-on'); });
  addEventListener('blur', () => { shown = false; dot.classList.remove('is-on'); });

  const isClickable = el => !!el && el instanceof Element &&
    (!!el.closest(CLICKABLE) || getComputedStyle(el).cursor === 'pointer');
  addEventListener('pointerover', e => { if (e.pointerType === 'mouse') dot.classList.toggle('is-link', isClickable(e.target)); }, { passive: true });
  addEventListener('pointerdown', () => dot.classList.add('is-down'));
  addEventListener('pointerup', () => dot.classList.remove('is-down'));
}
