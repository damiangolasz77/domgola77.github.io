// Works strips (endless loop to the right, the hovered one coasts to a stop) and the
// "6+ years of work" list. Content lives in content.js.
import { CASES, GROUPS, logoFor, linkFor } from './content.js';
import { tick } from '../sfx.js';
import { openDrawer } from '../drawer/drawer.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Works ----------
const SPEED = 50.4;          // px/s at 1512 px wide, scaled with the viewport (+20 % on request)
const EASE = 3.2;            // 1/s — how fast a strip slows down on hover / picks up again
const PHONE_SPEED = 48;      // px/s on phones (the width-scaled speed was ~13 px/s there — far too slow)
const FRICTION = 2.6;        // 1/s — a swiped strip loses its throw this fast (phones)
const phone = matchMedia('(max-width: 760px)');
const stripSpeed = () => phone.matches ? PHONE_SPEED : SPEED * innerWidth / 1512;
const mod = (a, n) => ((a % n) + n) % n;

export function mountWorks(list) {
  const strips = CASES.map((c, i) => {
    const li = el('li', 'case');
    const strip = el('div', 'case__strip'), track = el('div', 'case__track');
    // every tile keeps its media's ratio (4:5, 1:1 or 16:9) at the strip's height
    const set = c.tiles.map(t => {
      const tile = el('div', 'case__tile');
      tile.style.setProperty('--r', t.ratio);
      if (t.type === 'video') {
        const v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
        v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.poster = t.poster; v.dataset.src = t.src;
        tile.append(v);
      } else {
        const img = el('img'); img.src = t.src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
        tile.append(img);
      }
      return tile;
    });
    track.append(...set);
    strip.append(track);
    const meta = el('div', 'case__meta');
    const text = el('div', 'case__text');
    text.append(el('h3', 'case__title', c.title), el('p', 'case__sub', c.sub));
    // a case with `details` opens the drawer; the rest still say "Coming soon"
    let action;
    if (c.details) {
      action = el('button', 'pill pill--on-dark case__more', 'Read more'); action.type = 'button';
      action.addEventListener('click', () => openDrawer(c, action));
      // the whole case (strip, title) opens it too — no hover state, no pointer cursor (on request);
      // keyboard users have the Read more button
      li.addEventListener('click', e => { if (!e.target.closest('.case__more') && !s.swiped) openDrawer(c, action); });
    } else action = el('span', 'pill pill--on-dark case__soon', 'Coming soon');
    meta.append(text, action);
    li.append(strip, meta);
    list.append(li);
    const s = { li, track, set, setW: 0, x: 24, v: 1, hover: false, mv: 0, drag: null, swiped: false };   // starts with the cover at the left edge (gutter)
    li.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') s.hover = true; });
    li.addEventListener('pointerleave', () => { s.hover = false; });
    swipe(s, strip);
    return s;
  });

  // phones: a finger drags the strip left/right and throws it (touch only; desktop stays as it was).
  // touch-action: pan-y (home.css, phones) leaves vertical swipes to the page.
  function swipe(s, strip) {
    strip.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      s.drag = { id: e.pointerId, x: e.clientX, t: performance.now(), held: 0, moved: 0 }; s.mv = 0; s.swiped = false;
    });
    strip.addEventListener('pointermove', e => {
      const d = s.drag; if (!d || e.pointerId !== d.id) return;
      const now = performance.now(), dx = e.clientX - d.x, dt = Math.max(1, now - d.t) / 1000;
      s.x += dx; d.moved += Math.abs(dx); d.held = d.held * .6 + (dx / dt) * .4; d.x = e.clientX; d.t = now;
      if (d.moved > 6) s.swiped = true;
    });
    const end = e => {
      const d = s.drag; if (!d || e.pointerId !== d.id) return;
      if (performance.now() - d.t < 80) s.mv = d.held;      // still moving at release → throw it
      s.drag = null;
      setTimeout(() => { s.swiped = false; }, 50);          // the click that ends a swipe doesn't open the drawer
    };
    strip.addEventListener('pointerup', end);
    strip.addEventListener('pointercancel', end);
  }

  // enough copies of each set to cover the viewport while it slides by one set width
  function layout() {
    for (const s of strips) {
      s.track.replaceChildren(...s.set);
      const gap = parseFloat(getComputedStyle(s.track).columnGap) || 0;
      s.setW = s.set.reduce((w, t) => w + t.getBoundingClientRect().width + gap, 0);
      const copies = Math.ceil(innerWidth / s.setW) + 1;
      for (let k = 0; k < copies; k++) s.track.append(...s.set.map(t => t.cloneNode(true)));
    }
  }
  layout();
  addEventListener('resize', layout);

  // motion clips (including the strips' copies) only load and play while they're on screen
  const clips = new IntersectionObserver(entries => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        if (!reduce) v.play().catch(() => {});
      } else v.pause();
    }
  }, { rootMargin: '0px 200px' });
  const watchClips = () => list.querySelectorAll('video').forEach(v => clips.observe(v));
  watchClips();
  addEventListener('resize', () => { clips.disconnect(); watchClips(); });
  if (reduce) return;

  let raf = 0, prev = 0, visible = false;
  const tick = now => {
    const dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
    const speed = stripSpeed();
    for (const s of strips) {
      const held = s.drag || Math.abs(s.mv) > 30;            // a finger has it / it's still coasting
      s.v += ((s.hover || held ? 0 : 1) - s.v) * (1 - Math.exp(-EASE * dt));
      s.mv *= Math.exp(-FRICTION * dt);
      if (!s.drag) s.x += (s.v * speed + s.mv) * dt;         // moves right
      s.x = mod(s.x, s.setW);
      s.track.style.transform = `translate3d(${(s.x - s.setW).toFixed(2)}px,0,0)`;
    }
    raf = visible ? requestAnimationFrame(tick) : 0;
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(tick); }
  }).observe(list);
}

// ---------- 6+ years ----------
export function mountYears(host) {
  for (const g of GROUPS) {
    const group = el('section', 'group');
    const head = el('header', 'group__head');
    let icon = el('span', 'group__icon');
    if (g.icon) { icon = el('img', 'group__icon group__icon--img'); icon.src = g.icon; icon.alt = ''; icon.width = 24; icon.height = 24; }
    head.append(icon, el('h3', 'group__title', g.title));
    group.append(head);
    for (const [year, rows] of g.years) {
      const block = el('div', 'yearblock');
      rows.forEach(([brand, work], i) => {
        const key = `${brand} - ${work}`;                   // what the logo / link tables match on
        const href = linkFor(key);
        const row = el(href ? 'a' : 'div', 'row');
        if (href) { row.href = href; row.target = '_blank'; row.rel = 'noopener'; row.classList.add('row--link'); }
        const proj = el('span', 'row__project');
        const img = el('img', 'row__logo'); img.src = logoFor(key); img.alt = ''; img.width = 18; img.height = 18; img.decoding = 'async';
        proj.append(img, el('span', '', brand));
        if (href) proj.append(el('span', 'row__go', '↗'));   // shows on hover
        row.append(el('span', 'row__year', i === 0 ? year : ''), proj, el('span', 'row__work', work));
        block.append(row);
      });
      group.append(block);
    }
    host.append(group);
  }
  // header stuck (its group has scrolled above the top) → rows are sliding under it → fade them
  const groups = [...host.querySelectorAll('.group')];
  let raf = 0;
  const under = () => { raf = 0; for (const g of groups) g.classList.toggle('is-under', g.getBoundingClientRect().top < -1); };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(under); }, { passive: true });

  // sound: the Drafts ring's mechanical tick when the mouse enters a record (no scroll ticks anymore)
  host.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const row = e.target.closest('.row');
    if (row && !row.contains(e.relatedTarget)) tick(.6);
  }, { passive: true });
}
