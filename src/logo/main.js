// /logo/ — the Home chrome G in three finishes, side by side, turning together.
// 01 is the finish before Oct 2026 (PREVIOUS_LOOK); 02 and 03 were the candidates. He picked 03 at the
// normal weight → that's CURRENT_LOOK now (shown as 04, live on the site).
import { initNav } from '../nav/nav.js';
import { pageReady } from '../curtain.js';
import { createChromeLogo, CURRENT_LOOK, PREVIOUS_LOOK } from '../three/chrome-logo.js';
import { polishedChromeEnvironment } from '../three/look.js';

initNav();

const VARIANTS = [
  { name: '01 — Before', note: 'The finish the site had until now.', look: PREVIOUS_LOOK },
  { name: '02 — More chrome', note: 'Mirror-smooth: brighter studio, broader light, harder black edges.',
    look: { env: r => polishedChromeEnvironment(r, 1), exposure: 1.1, bold: 0,
      material: { roughness: 0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.6 } } },
  { name: '03 — Most chrome, bolder', note: 'Brighter, extra light lines, glints. Heavier strokes, same depth.',
    look: { env: r => polishedChromeEnvironment(r, 2), exposure: 1.08, bold: 0.05,
      material: { roughness: 0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.75 } } },
  { name: '04 — Live', note: '03 at the normal weight. What Home and the nav use now.', look: CURRENT_LOOK },
];

const TAU = Math.PI * 2, SPEED = TAU / 7;   // same idle spin as the hero
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const grid = document.getElementById('lgGrid');

const views = [];
const made = VARIANTS.map(v => {
  const li = el('li', 'lg__item'), stage = el('div', 'lg__stage'), big = el('div', 'lg__big'), small = el('div', 'lg__small');
  const foot = el('div', 'lg__foot'), text = el('div');
  text.append(el('h2', 'lg__name', v.name), el('p', 'lg__note', v.note));
  foot.append(text, small); stage.append(big); li.append(stage, foot); grid.append(li);
  return Promise.all([
    createChromeLogo(big, { maxPixelRatio: 2, fallback: { w: 330, h: 376 }, look: v.look }),
    createChromeLogo(small, { look: v.look }),
  ]).then(ls => views.push(...ls));
});

// one shared angle: auto spin, drag to turn (with a little momentum)
let angle = 0, vel = 0, spin = !matchMedia('(prefers-reduced-motion: reduce)').matches, drag = null, prev = 0;
function frame(now) {
  const dt = Math.min(.05, (now - prev) / 1000 || .016); prev = now;
  if (!drag) {
    vel += ((spin ? SPEED : 0) - vel) * (1 - Math.exp(-2.5 * dt));
    angle += vel * dt;
    if (!spin && Math.abs(vel) < .05) angle += (Math.round(angle / TAU) * TAU - angle) * (1 - Math.exp(-6 * dt));   // settle to the front
  }
  for (const l of views) l.draw(angle);
  requestAnimationFrame(frame);
}
grid.addEventListener('pointerdown', e => {
  if (!e.target.closest('.lg__stage')) return;
  drag = { x: e.clientX, t: performance.now() }; e.target.setPointerCapture?.(e.pointerId);
});
addEventListener('pointermove', e => {
  if (!drag) return;
  const now = performance.now(), d = (e.clientX - drag.x) * .012;
  angle += d; vel = d / Math.max(.008, (now - drag.t) / 1000); drag = { x: e.clientX, t: now };
});
addEventListener('pointerup', () => { drag = null; });
addEventListener('resize', () => views.forEach(l => l.resize()));

const spinBtn = document.getElementById('lgSpin');
spinBtn.setAttribute('aria-pressed', String(spin));
spinBtn.addEventListener('click', () => { spin = !spin; spinBtn.setAttribute('aria-pressed', String(spin)); });
for (const b of document.querySelectorAll('.lg__bg')) b.addEventListener('click', () => {
  document.body.dataset.bg = b.dataset.bg;
  document.querySelector('.lg').dataset.navTheme = b.dataset.bg === 'white' ? 'light' : 'dark';
  dispatchEvent(new Event('scroll'));   // nav glass re-reads the theme under it
  for (const o of document.querySelectorAll('.lg__bg')) o.setAttribute('aria-pressed', String(o === b));
});

const ready = Promise.all(made);
pageReady(ready);
ready.then(() => requestAnimationFrame(frame));
