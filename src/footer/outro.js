// Last section, revealed from under the footer (it's sticky at the bottom, under everything).
// While it's showing: the giant "Creative Designer - Dominik Gola" loops (CSS marquee), the
// content drifts into place a little slower than the footer moves (parallax), and the chrome G
// bounces off the edges like an old DVD screensaver — no spinning, no touching. Each bounce makes a
// soft chrome knock (src/sfx.js), panned to where it hit and only as loud as the section is uncovered.
import { knock } from '../sfx.js';

const SPEED = 150;      // px/s at 1512 px wide

export function mountOutro({ section, inner, logo, footer }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let x = 0, y = 0, vx = 1, vy = 1, raf = 0, prev = 0, live = false, shownR = 0;

  const bounds = () => ({ W: section.clientWidth - logo.offsetWidth, H: section.clientHeight - logo.offsetHeight });
  function reset() {
    const { W, H } = bounds();
    x = Math.min(Math.max(x, 0), W) || W * 0.17; y = Math.min(Math.max(y, 0), H) || H * 0.6;
    draw();
  }
  const draw = () => { logo.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; };

  function tick(now) {
    const dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
    const { W, H } = bounds(), v = Math.max(SPEED * innerWidth / 1512, 80);   // phones: at least 80 px/s (scaled it was ~39)
    x += vx * v * dt; y += vy * v * 0.8 * dt;
    let hit = 0;
    if (x <= 0) { x = 0; vx = 1; hit++; } else if (x >= W) { x = W; vx = -1; hit++; }
    if (y <= 0) { y = 0; vy = 1; hit += 2; } else if (y >= H) { y = H; vy = -1; hit += 2; }
    // side walls a touch higher than top/bottom; a corner hit (both) a bit lower and fuller
    if (hit) knock((x / (W || 1)) * 1.4 - .7, shownR * shownR * (hit === 3 ? 1.25 : 1), hit === 1 ? 1.12 : hit === 2 ? 1 : .9);
    draw();
    raf = live ? requestAnimationFrame(tick) : 0;
  }

  // how much of the section is uncovered (footer's bottom edge vs viewport bottom)
  function onScroll() {
    const shown = Math.max(0, Math.min(section.offsetHeight, innerHeight - footer.getBoundingClientRect().bottom));
    const r = shown / section.offsetHeight;
    shownR = r;
    const nowLive = shown > 1;
    if (!reduce) inner.style.transform = r < 1 ? `translate3d(0, ${(-(1 - r) * 22).toFixed(2)}%, 0)` : '';
    if (nowLive !== live) {
      live = nowLive;
      section.classList.toggle('is-live', live);
      if (live && !reduce && !raf) { prev = performance.now(); raf = requestAnimationFrame(tick); }
    }
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { reset(); onScroll(); });
  if (logo.complete) reset(); else logo.addEventListener('load', reset, { once: true });
  onScroll();
}
