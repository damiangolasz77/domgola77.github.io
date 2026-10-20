// /more/ strips: like Home's Works (endless, moving right by themselves, the hovered one coasts to a
// stop), but bigger and draggable — grab one and throw it left or right; it keeps the momentum, then
// picks its own pace up again. Trackpad sideways scrolling moves them too. No sound (on request).
// Each case has the Home pill on the right: "Read more" opens the case drawer (also a plain click on the
// strip, but not after a drag), otherwise "Coming soon".
import { openDrawer } from '../drawer/drawer.js';

const SPEED = 50.4;          // px/s at 1512 px wide — same as Home
const EASE = 3.2;            // 1/s — slow down on hover / pick up again
const FRICTION = 2.6;        // 1/s — how fast a thrown strip loses its momentum
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const mod = (a, n) => ((a % n) + n) % n;

function tileOf(t) {
  const tile = el('div', 'mc__tile');
  tile.style.setProperty('--r', t.ratio);
  if (t.type === 'blank') { tile.classList.add('mc__tile--blank'); return tile; }   // dummy white slide
  if (t.type === 'video') {
    const v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.poster = t.poster; v.dataset.src = t.src;
    tile.append(v);
  } else {
    const img = el('img'); img.src = t.src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false;
    tile.append(img);
  }
  return tile;
}

export function mountStrips(host, groups) {
  const strips = [];
  for (const g of groups) {
    const sec = el('section', 'mg');
    const h = el('h2', 'mg__title');
    if (g.with) h.append('With ', el('span', 'mg__by', g.with)); else h.textContent = g.title;
    const list = el('ul', 'mg__cases');
    sec.append(h, list);
    for (const c of g.cases) {
      const li = el('li', 'mc');
      const strip = el('div', 'mc__strip'), track = el('div', 'mc__track');
      const set = c.tiles.map(tileOf);
      track.append(...set); strip.append(track);
      const meta = el('div', 'mc__meta'), text = el('div', 'mc__text');
      text.append(el('h3', 'mc__title', c.title), el('p', 'mc__sub', c.sub));
      let action;
      if (c.details) {
        action = el('button', 'pill pill--on-dark mc__more', 'Read more'); action.type = 'button';
        action.addEventListener('click', () => openDrawer(c, action));
      } else action = el('span', 'pill pill--on-dark mc__soon', 'Coming soon');
      meta.append(text, action);
      li.append(strip, meta); list.append(li);
      const s = { strip, track, set, setW: 0, tileW: 1, x: 24, v: 1, mv: 0, hover: false, drag: null, held: 0, moved: 0 };
      if (c.details) strip.addEventListener('click', () => { if (s.moved < 6) openDrawer(c, action); });
      strips.push(s);
      strip.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') s.hover = true; });
      strip.addEventListener('pointerleave', () => { s.hover = false; });
      grab(s);
    }
    host.append(sec);
  }

  // enough copies of each set to cover the screen on either side of where the strip is
  function layout() {
    for (const s of strips) {
      s.track.replaceChildren(...s.set);
      const gap = parseFloat(getComputedStyle(s.track).columnGap) || 0;
      s.setW = Math.max(1, s.set.reduce((w, t) => w + t.getBoundingClientRect().width + gap, 0));
      s.tileW = s.setW / s.set.length;
      const copies = Math.ceil(innerWidth / s.setW) + 1;
      for (let k = 0; k < copies; k++) s.track.append(...s.set.map(t => t.cloneNode(true)));
    }
  }

  // drag / throw. touch-action: pan-y leaves vertical swipes to the page.
  function grab(s) {
    const st = s.strip;
    st.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      s.drag = { id: e.pointerId, x: e.clientX, t: performance.now(), moved: 0 };
      s.mv = 0; s.held = 0;
      st.setPointerCapture(e.pointerId); st.classList.add('is-grabbing');
    });
    st.addEventListener('pointermove', e => {
      const d = s.drag; if (!d || e.pointerId !== d.id) return;
      const now = performance.now(), dx = e.clientX - d.x, dt = Math.max(1, now - d.t) / 1000;
      s.x += dx; d.moved += Math.abs(dx);
      s.held = s.held * .6 + (dx / dt) * .4;               // smoothed hand speed → the throw
      d.x = e.clientX; d.t = now;
    });
    const end = e => {
      const d = s.drag; if (!d || e.pointerId !== d.id) return;
      if (performance.now() - d.t < 80) s.mv = s.held;     // still moving at release → throw it
      s.moved = d.moved;                                  // a drag isn't a click
      s.drag = null; st.classList.remove('is-grabbing');
    };
    st.addEventListener('pointerup', end);
    st.addEventListener('pointercancel', end);
    // trackpad: sideways scrolling slides the strip (vertical scrolling stays the page's)
    st.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault(); s.x -= e.deltaX; s.mv = 0; s.manual = performance.now();
    }, { passive: false });
  }

  layout();
  addEventListener('resize', layout);
  let lastW = host.offsetWidth;
  new ResizeObserver(() => { if (host.offsetWidth !== lastW) { lastW = host.offsetWidth; layout(); } }).observe(host);

  // motion clips (copies included) only load and play while on screen
  const clips = new IntersectionObserver(entries => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!reduce) v.play().catch(() => {}); } else v.pause();
    }
  }, { rootMargin: '0px 200px' });
  const watchClips = () => host.querySelectorAll('video').forEach(v => clips.observe(v));
  watchClips();
  addEventListener('resize', () => { clips.disconnect(); watchClips(); });

  let raf = 0, prev = 0, visible = false;
  const frame = now => {
    const dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
    const speed = reduce ? 0 : innerWidth <= 760 ? 48 : SPEED * innerWidth / 1512;   // phones: a fixed 48 px/s (scaled it was ~13)
    for (const s of strips) {
      const manual = s.drag || Math.abs(s.mv) > 30 || now - (s.manual || 0) < 200;
      if (!s.drag) {
        s.v += ((s.hover || manual ? 0 : 1) - s.v) * (1 - Math.exp(-EASE * dt));
        s.mv *= Math.exp(-FRICTION * dt);
        s.x += (s.v * speed + s.mv) * dt;
      }
      s.x = mod(s.x, s.setW);
      s.track.style.transform = `translate3d(${(s.x - s.setW).toFixed(2)}px,0,0)`;
    }
    raf = visible ? requestAnimationFrame(frame) : 0;
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(frame); }
  }).observe(host);
}
