// The big chrome G over the hero. At the top of the page it spins slowly around its own axis.
// Scrolling down flies it (and shrinks it) into the nav logo slot, turning it to face front on the
// way; once it lands, the nav's own logo takes over (and keeps spinning on scroll there).
// Scrolling back up takes it out of the nav again.
import { createChromeLogo } from '../three/chrome-logo.js';

const TAU = Math.PI * 2;
const IDLE_SPEED = TAU / 7;          // rad/s while it floats in the hero
const DOCK_VH = 0.55;                // scroll distance (in viewport heights) of the whole flight
const SPRING_K = 60;                 // angle smoothing spring (critically damped)
const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);
const clamp01 = v => Math.max(0, Math.min(1, v));

export async function mountHeroLogo({ host, slot, navSlot, onDock }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const logo = await createChromeLogo(host, { maxPixelRatio: 2, fallback: { w: 287, h: 327 } });

  let start = null, end = null;
  function measure() {
    const s = slot.getBoundingClientRect(), n = navSlot.getBoundingClientRect();
    // the hero is sticky at the top, so the slot's viewport rect is its rect at scroll 0
    start = { x: s.left, y: s.top, w: s.width, h: s.height };
    end = { x: n.left, y: n.top, w: n.width, h: n.height };
    host.style.width = start.w + 'px'; host.style.height = start.h + 'px';
    logo.resize();
  }

  let angle = 0, vel = 0, idle = 0, latched = null, docked = null, raf = 0, prev = 0;
  function place(e) {
    const k = (start.w + (end.w - start.w) * e) / start.w;
    const cx = start.x + start.w / 2 + (end.x + end.w / 2 - start.x - start.w / 2) * e;
    const cy = start.y + start.h / 2 + (end.y + end.h / 2 - start.y - start.h / 2) * e - Math.sin(Math.PI * e) * start.h * 0.18;   // slight arc
    host.style.transform = `translate3d(${(cx - start.w * k / 2).toFixed(2)}px, ${(cy - start.h * k / 2).toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
    const p = clamp01(scrollY / (innerHeight * DOCK_VH)), e = smooth(p);

    // target angle: free spin at the top; once the flight starts, the scroll drives it forward
    // to the next front-facing turn, reached exactly when it lands
    let target;
    if (p <= 0.001 || reduce) {
      latched = null;
      if (!reduce) idle += IDLE_SPEED * dt;
      target = reduce ? 0 : idle;
    } else {
      if (latched === null) latched = { from: angle, to: Math.ceil(angle / TAU + 0.35) * TAU };
      target = latched.from + (latched.to - latched.from) * e;
      idle = angle;
    }
    const sub = 3, h = dt / sub, damp = 2 * Math.sqrt(SPRING_K);
    for (let i = 0; i < sub; i++) { vel += ((target - angle) * SPRING_K - vel * damp) * h; angle += vel * h; }
    if (p >= 0.999) angle = latched ? latched.to : angle;

    const isDocked = p >= 0.999;
    if (isDocked !== docked) { docked = isDocked; host.style.visibility = isDocked ? 'hidden' : ''; onDock?.(isDocked); }
    if (!isDocked) { place(e); logo.draw(angle); }
    raf = requestAnimationFrame(frame);
  }

  measure();
  addEventListener('resize', measure);
  return {
    measure,
    /** fade/scale the logo in and start the loop */
    show() {
      host.classList.add('is-in');
      if (!raf) { prev = performance.now(); raf = requestAnimationFrame(frame); }
    },
  };
}
