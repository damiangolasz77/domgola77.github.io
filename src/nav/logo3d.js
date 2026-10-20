// Chrome G in the nav. It spins around its own vertical axis only while the page scrolls:
// the turn follows the scrolled distance (smoothed), and once scrolling stops a soft
// spring brings it back to face front (the nearest full turn), so it never rests edge-on.
// Renders on demand: no frames are drawn while it is still.
import { createChromeLogo } from '../three/chrome-logo.js';

const RAD_PER_PX = 0.0065;      // one scrolled pixel → this much turn (~1 full turn per 1000 px)
const FOLLOW = 12;              // 1/s — how tightly the letter follows the scroll
const MAX_LAG = 2.5;            // rad — a big jump doesn't wind it up into a long spin
const IDLE_MS = 140;            // no scroll for this long → settle to front
const SETTLE_K = 40;            // settle spring stiffness (critically damped)

export async function mountLogo3D(host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const logo = await createChromeLogo(host);

  // Home docks the big hero logo into this slot; until then the nav logo ignores scrolling
  let active = !document.body.hasAttribute('data-logo-dock');
  let angle = 0, goal = 0, vel = 0, lastInput = 0, raf = 0, prevT = 0, lastY = scrollY;
  const draw = () => logo.draw(angle);

  function tick(now) {
    const dt = Math.min(0.05, (now - prevT) / 1000 || 0.016); prevT = now;
    if (now - lastInput < IDLE_MS) {
      const prev = angle;
      angle += (goal - angle) * (1 - Math.exp(-FOLLOW * dt));
      vel = (angle - prev) / dt;
    } else {
      // critically damped spring to the nearest front-facing pose; keeps the momentum it has
      const target = Math.round(angle / (2 * Math.PI)) * 2 * Math.PI;
      const sub = 4, h = dt / sub, damp = 2 * Math.sqrt(SETTLE_K);
      for (let i = 0; i < sub; i++) { vel += ((target - angle) * SETTLE_K - vel * damp) * h; angle += vel * h; }
      if (Math.abs(target - angle) < 1e-4 && Math.abs(vel) < 1e-3) {
        angle = goal = 0; vel = 0; draw(); raf = 0; return;     // at rest: stop drawing
      }
      goal = angle;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }
  function kick(px) {
    if (!px || !active) return;
    goal = angle + Math.max(-MAX_LAG, Math.min(MAX_LAG, goal - angle + px * RAD_PER_PX));
    lastInput = performance.now();
    if (!raf) { prevT = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function setActive(on) {
    if (on === active) return;
    active = on;
    if (!on) { cancelAnimationFrame(raf); raf = 0; angle = goal = vel = 0; draw(); }   // parked facing front
  }

  addEventListener('scroll', () => { const y = scrollY; kick(y - lastY); lastY = y; }, { passive: true });
  // pages that move without scrolling the document (the Drafts ring) report their movement here
  addEventListener('logo:spin', e => kick(e.detail || 0));
  addEventListener('resize', logo.resize);
  const api = { kick, setActive, resize: logo.resize, _pose(a) { angle = goal = a; draw(); }, get angle() { return angle; } };    // _pose: test hook
  window.__logo3d = api;
  return api;
}
