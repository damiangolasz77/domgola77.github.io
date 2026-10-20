// Drafts — 3D ring gallery. Ported 1:1 from the karuzela-ring prototype; only the fonts,
// the header (now the site nav), sound (now the site-wide switch) and the intro start (page curtain) changed.
import { audioContext, soundOn } from '../sound.js';
import { pageReady, revealed, arrivedThroughCurtain } from '../curtain.js';

const FALLBACK_IMGS = Array.from({ length: 11 }, (_, i) => `/drafts/fallback/${String(i).padStart(2, "0")}.jpg`);
// Dominik Gola — House of Drfts (domgola.framer.website/gallery)
const framer = f => `https://framerusercontent.com/images/${f}?scale-down-to=512`;
const hiRes = src => src.replace('scale-down-to=512', 'scale-down-to=2048');
const GALLERY = ["Tag42AYMIlM3eZZbY3g4tohMZc8.png", "urAbvp5M9cNUurcwkLyfr6cjjE.png", "4LNtIAGQUTUfXJciAlGHw8zf4.png", "bBchyfd6dG3vjBxojUwmW4cNb0.png", "3coiN6PlCbdT3pXSCxtBvGLjVc.png", "vxHnSFN57pxaoVD0TyBCJ0iuC8g.png", "hIxnPtE4eWBYMUWgKsVr03WvpM.png", "FbMKeURz5FXYwh7nRa6VIvJXMg.png", "dWiz8xZ9pcuqdZFyGfVijNMKq5g.png", "Amizk1wU2y851kEEMAaHi3B4kA.png", "gSbvSI01LTBtbCuz8JvD0Dx9yM.png", "GL9NW3k3HmzFjuaLtTAgd8TzQCQ.png", "FufDUTxWKPMAE0t32JTNRemWsE.png", "zSpRonYg7kJfpOLARZmvFs9GJY.png", "GdujvO5SsY50V20OJezW0VTIUvE.png", "nB7gubdpzIPOaPjGq1VHqYbJ22g.png", "QlMaSrKHMNAuIScIeTP54WanYVY.png", "UcHeAGLwXKI6SEChx7AeeWJQbPQ.png", "oG6FZmpdj1GsuBeOk7f0C6XRE.png", "4uIfcKHi6PCLdCihzzIl9nAP2Ns.png", "KyTkhxhDfHzo4yJJEPxPzKEMj0.png", "7InAQpdtjB0cKz4s9OEjpzf1yk.png", "VbSSfIoe7gcohlRx2tW1QeOoo.png", "0ksDiCWuHuABIXl22x456hZRA.png", "dKNgSJQretAa7X2C8MGK5poFPI.png", "hWHwdOhyltjoy2C4Q34Xnpx8A.png", "1E2c7U5whEwUkj6yWKFqNc5Bwc.png", "rDX0zdMJWHQKuL1PWwlmeYnEM.png", "FF83c5iAHv4Wjulx2ni8UgSOgA.png", "naY2sBcCnc3Mt3r63Y3Tkhi4p6A.png", "yWr4gG0qN5vzMSh9P44mwr2siN4.png", "HDir5kLKoBp7dE1E7D1m8G5qFiA.png", "10i4jdlliiA4Wmql2esMmia4gc.png", "0MpWYoh5pgOfIb2lb9Z2AU973fY.png", "hmjZEyopxOyj2rKu7SbYQdmn6k.png", "zq3QhoRA1Fhbvf79sEw7JvLn5c8.png", "ZJbemxaiNaQNAvoxqmNFeu8Zqs.png"];
const DEFAULT_IMGS = GALLERY.map(framer);
// Random project names — reshuffled on every load
const NAMES = ['Quiet Machines','Soft Static','Paper Moons','Velvet Grid','Northern Echo','Glass Orchard','Slow Signal',
  'Salt & Chrome','Hollow Light','Atlas Bloom','Night Market','Lumen Index','Pale Fire Studio','Second Nature','Tidal Type',
  'Mono Garden','Warm Concrete','Off-White Noise','Silent Motor','Field Notes','Common Ground','Blue Hour','Kinetic Dust',
  'Open Archive','Plastic Sun','Halftone Club','Small Weather','Low Orbit','Grey Matter Co.','Late Bloomers','Folded Space',
  'Studio Fauna','Analog Heart','Neon Vespers','Marble Room','After Hours','Wild Margins','Clear Sky Labs','Rust & Ivory','New Calm'];
const KINDS = ['Brand Identity','Product Design','Web Experience','Campaign','Packaging','Design System','Editorial','Motion','App Concept','Art Direction'];
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffled = NAMES.slice().sort(() => Math.random() - .5);
const CAPTIONS = shuffled.map((n, i) => [pick(KINDS), n, String(2023 + Math.floor(Math.random() * 4))]);

/* ---------- Squircle (Figma corner smoothing) ---------- */
function cornerParams(r, s, budget) {
  r = Math.min(r, budget);
  let p = (1 + s) * r;
  const maxS = r > 0 ? budget / r - 1 : 0;
  s = Math.max(0, Math.min(s, maxS)); p = Math.min(p, budget);
  const rad = d => d * Math.PI / 180;
  const arcMeasure = 90 * (1 - s);
  const L = Math.sin(rad(arcMeasure / 2)) * r * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p3p4 = r * Math.tan(rad(alpha / 2));
  const beta = 45 * s;
  const c = p3p4 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - L - c - d) / 3, a = 2 * b;
  return { a, b, c, d, p, L, r };
}
function squirclePath(w, h, radius, smoothing) {
  const { a, b, c, d, p, L, r } = cornerParams(radius, smoothing, Math.min(w, h) / 2);
  const f = n => n.toFixed(2);
  return [`M ${f(w - p)} 0`,
    `c ${f(a)} 0 ${f(a + b)} 0 ${f(a + b + c)} ${f(d)}`, `a ${f(r)} ${f(r)} 0 0 1 ${f(L)} ${f(L)}`,
    `c ${f(d)} ${f(c)} ${f(d)} ${f(b + c)} ${f(d)} ${f(a + b + c)}`, `L ${f(w)} ${f(h - p)}`,
    `c 0 ${f(a)} 0 ${f(a + b)} ${f(-d)} ${f(a + b + c)}`, `a ${f(r)} ${f(r)} 0 0 1 ${f(-L)} ${f(L)}`,
    `c ${f(-c)} ${f(d)} ${f(-(b + c))} ${f(d)} ${f(-(a + b + c))} ${f(d)}`, `L ${f(p)} ${f(h)}`,
    `c ${f(-a)} 0 ${f(-(a + b))} 0 ${f(-(a + b + c))} ${f(-d)}`, `a ${f(r)} ${f(r)} 0 0 1 ${f(-L)} ${f(-L)}`,
    `c ${f(-d)} ${f(-c)} ${f(-d)} ${f(-(b + c))} ${f(-d)} ${f(-(a + b + c))}`, `L 0 ${f(p)}`,
    `c 0 ${f(-a)} 0 ${f(-(a + b))} ${f(d)} ${f(-(a + b + c))}`, `a ${f(r)} ${f(r)} 0 0 1 ${f(L)} ${f(-L)}`,
    `c ${f(c)} ${f(-d)} ${f(b + c)} ${f(-d)} ${f(a + b + c)} ${f(-d)}`, 'Z'].join(' ');
}

/* ---------- Settings ---------- */
const $ = id => document.getElementById(id);
const S = {};
const sliders = {
  size: ['size', v => v.toFixed(3)], aspect: ['aspect', v => v.toFixed(2)],
  gap: ['gap', v => v.toFixed(2)], persp: ['persp', v => v + 'px'], 
  corner: ['corner', v => v + 'px'],
  smooth: ['smooth', v => Math.round(v * 100) + '%'], amb: ['amb', v => Math.round(v * 100) + '%']
};
Object.entries(sliders).forEach(([k, [id, f]]) => {
  const el = $(id);
  const read = () => { S[k] = parseFloat(el.value); $('v-' + k).textContent = f(S[k]); };
  read();
  el.addEventListener('input', () => { read(); layout(); });
});

/* ---------- Detent click (Web Audio) ---------- */
let actx = null, noiseBuf = null, lastClick = 0;
function initAudio() {
  const ctx = audioContext();               // shared site-wide context (src/sound.js)
  if (!ctx || ctx === actx) return;
  actx = ctx;
  noiseBuf = actx.createBuffer(1, Math.round(actx.sampleRate * 0.03), actx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
}
function click(intensity = 1) {
  if (!soundOn()) return;
  initAudio(); if (!actx) return;
  const now = actx.currentTime;
  if (now - lastClick < 0.022) return;             // cap ~45 clicks/s
  lastClick = now;
  const vol = 0.22 * Math.min(1, 0.45 + intensity * 0.55);
  // mechanical "tick": short filtered noise transient …
  const n = actx.createBufferSource(); n.buffer = noiseBuf;
  const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200 + Math.random() * 600; bp.Q.value = 1.4;
  const g1 = actx.createGain(); g1.gain.setValueAtTime(vol, now); g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
  n.connect(bp).connect(g1).connect(actx.destination); n.start(now);
  // … plus a tiny woody body
  const o = actx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(1500, now); o.frequency.exponentialRampToValueAtTime(420, now + 0.025);
  const g2 = actx.createGain(); g2.gain.setValueAtTime(vol * 0.5, now); g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
  o.connect(g2).connect(actx.destination); o.start(now); o.stop(now + 0.04);
  if (navigator.vibrate) navigator.vibrate(4);
}

/* 1px inner border (white 10%) that follows the squircle: a 2px stroke, outer half clipped away */
function innerBorder(w, h, d) {
  return `<svg class="ib" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="2"/></svg>`;
}


/* ---------- Strip ---------- */
const stage = $('stage'), ring3d = $('ring3d');
let images = DEFAULT_IMGS;
let cards = [];
let G = {};
const wrapPI = a => Math.atan2(Math.sin(a), Math.cos(a));

function buildCards() {
  cards.forEach(c => c.el.remove()); cards = [];
  // the ring always has SLOTS places; with fewer projects the list repeats, with more it just scrolls on
  const realN = images.length, reps = Math.max(1, Math.ceil(SLOTS / Math.max(1, realN)));
  const list = []; for (let r = 0; r < reps; r++) images.forEach((src, j) => list.push([src, j]));
  list.forEach(([src0, real], i) => {
    const el = document.createElement('div'); el.className = 'card'; el.dataset.i = i;
    const inner = document.createElement('i');
    const card = { el, inner, i, real, src: src0, z: -1 };
    inner.style.backgroundImage = `url("${src0}")`;
    if (images === DEFAULT_IMGS) {
      const probe = new Image();
      probe.onerror = () => { card.src = FALLBACK_IMGS[real % FALLBACK_IMGS.length]; inner.style.backgroundImage = `url("${card.src}")`; };
      probe.src = src0;
    }
    el.appendChild(inner); ring3d.appendChild(el); cards.push(card);
  });
  layout();
}

/* ---- intro pool: many decorative slots (images cycle), so the entrance always looks rich,
   whether there are 15 or 100 projects. Swapped for the real cards when the intro ends. */
let pool = [];
const INTRO_COUNT = 20;      // the entrance always shows exactly this many cards, whatever the project count
function styleSlot(p) {
  p.el.style.width = G.w + 'px'; p.el.style.height = G.h + 'px';
  p.inner.style.clipPath = G.clip; p.inner.style.webkitClipPath = G.clip;
  p.inner.innerHTML = innerBorder(G.w, G.h, G.d);
}
function buildExtras(lap) {
  pool.forEach(p => p.el.remove()); pool = [];
  const n = cards.length; if (!n) return;
  const h = Math.floor(lap / 2);
  for (let m = -h; m < lap - h; m++) {
    const el = document.createElement('div'); el.className = 'card';
    const inner = document.createElement('i');
    const src = cards[mod(Math.round(wheel) + m + lap, n)];         // other projects, so the big ring looks fuller
    el.appendChild(inner); ring3d.insertBefore(el, ring3d.firstChild);
    const p = { el, inner, m, src }; styleSlot(p); pool.push(p);
  }
}
function buildPool() {
  pool.forEach(p => p.el.remove()); pool = [];
  const n = cards.length; if (!n) return;
  const M = INTRO_COUNT;
  for (let j = 0; j < M; j++) {
    const k = j - Math.floor(M / 2);                       // slot offset from the front
    const el = document.createElement('div'); el.className = 'card';
    const inner = document.createElement('i');
    const src = cards[mod(k, n)];
    inner.style.backgroundImage = src.inner.style.backgroundImage;
    el.appendChild(inner); ring3d.appendChild(el);
    const p = { el, inner, k, src }; styleSlot(p); pool.push(p);
  }
}
function layout() {
  const W = innerWidth, H = innerHeight;
  G.cx = W / 2;
  stage.style.perspective = S.persp + 'px';
  G.h = Math.min(H * S.size, W * .42 / S.aspect, H - 300);
  G.cy = Math.max(70 + G.h / 2, (H - 150 - (G.h + 90)) / 2 + G.h / 2 + 45);
  G.w = G.h * S.aspect;
  const r = S.corner;                       // fixed radius in px (16 by default)
  const d = squirclePath(G.w, G.h, r, S.smooth);
  const clip = `path('${d}')`;
  cards.forEach(c => {
    c.w = G.w; c.h = G.h;
    c.el.style.width = G.w + 'px'; c.el.style.height = G.h + 'px';
    c.inner.style.clipPath = clip; c.inner.style.webkitClipPath = clip;
    c.inner.innerHTML = innerBorder(G.w, G.h, d);
  });
  G.clip = clip; G.d = d;
  pool.forEach(p => styleSlot(p));
  // ring around the active card (5px dark outline following the squircle)
  const pad = 2.5, rw = G.w + pad * 2, rh = G.h + pad * 2;
  G.ringPath = squirclePath(rw, rh, r + pad, S.smooth);
  $('caption').style.left = G.cx + 'px';
}
addEventListener('resize', layout);

// lens plate: flat top/bottom, soft points left/right
function lensPath(A, B, a) {
  // A = half width incl. points, B = half height, a = half width of the flat part
  const k = B * .55;
  return `M ${-a} ${-B} L ${a} ${-B} C ${a + (A - a) * .55} ${-B} ${A - (A - a) * .12} ${-k * .5} ${A} 0
          C ${A - (A - a) * .12} ${k * .5} ${a + (A - a) * .55} ${B} ${a} ${B} L ${-a} ${B}
          C ${-a - (A - a) * .55} ${B} ${-A + (A - a) * .12} ${k * .5} ${-A} 0
          C ${-A + (A - a) * .12} ${-k * .5} ${-a - (A - a) * .55} ${-B} ${-a} ${-B} Z`;
}
function drawExpand() {
  $('expPlate').setAttribute('d', squirclePath(84, 84, 30, 1));
}

/* ---------- Interaction ---------- */
let wheel = 0;            // fractional index of the card in the lens
let wheelAcc = 0, lastStep = 0;
let target = null, vel = 0, dragging = false, lastX = 0, lastT = 0, downX = 0, downY = 0, downT = 0, idleUntil = 0, spinVis = 0;
const N = () => cards.length;
const SLOTS = 24;                         // fixed visual: the ring always holds 24 cards
const realN = () => images.length || 1;
const realOf = i => (cards[i] ? cards[i].real : i);
const mod = (a, n) => ((a % n) + n) % n;
const pxPerCard = () => Math.max(40, G.w * (1 + S.gap));
function currentIndex() { return mod(Math.round(wheel), N()); }
function goTo(i) {
  const n = N(); let diff = mod(i - wheel, n); if (diff > n / 2) diff -= n;
  target = Math.round(wheel + diff);
}
stage.addEventListener('pointerdown', e => {
  if (lb.open || stage.classList.contains('intro')) return;
  initAudio();
  dragging = true; target = null; lastX = downX = e.clientX; downY = e.clientY; lastT = downT = performance.now();
  stage.setPointerCapture(e.pointerId); stage.classList.add('dragging');
});
let hoverI = -1, hoverMX = 0, hoverMY = 0;
stage.addEventListener('pointerleave', () => { hoverI = -1; });
stage.addEventListener('pointermove', e => {
  if (!dragging) {
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find(n => n.classList && n.classList.contains('card'));
    hoverI = hit ? +hit.dataset.i : -1;
    if (hit) { const r = hit.getBoundingClientRect(); hoverMX = ((e.clientX - r.left) / r.width) * 2 - 1; hoverMY = ((e.clientY - r.top) / r.height) * 2 - 1; }
  }
  if (!dragging) return;
  const now = performance.now(), dx = e.clientX - lastX;
  const d = -dx / pxPerCard();
  wheel += d; vel = vel * .6 + (d / Math.max(1, now - lastT) * 1000) * .4;
  lastX = e.clientX; lastT = now;
});
function endDrag() { if (!dragging) return; dragging = false; stage.classList.remove('dragging'); }
stage.addEventListener('pointerup', e => {
  const tap = Math.hypot(e.clientX - downX, e.clientY - downY) < 7 && performance.now() - downT < 450;
  endDrag();
  if (!tap) return;
  const hit = document.elementsFromPoint(e.clientX, e.clientY).find(n => n.classList && n.classList.contains('card'));
  if (!hit) return;
  const i = +hit.dataset.i;
  if (i === currentIndex() && Math.abs(wheel - Math.round(wheel)) < .08) openLightbox(i); else goTo(i);
});
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('wheel', e => {
  e.preventDefault(); initAudio();
  // accumulate scroll: ~one card per mouse-wheel notch, trackpads step gradually
  let dlt = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (e.deltaMode === 1) dlt *= 33;                         // lines → px
  if (Math.sign(dlt) !== Math.sign(wheelAcc)) wheelAcc = 0;
  wheelAcc += dlt;
  const now = performance.now();
  if (Math.abs(wheelAcc) >= 90 && now - lastStep > 140) {
    const dir = Math.sign(wheelAcc);
    target = Math.round(target ?? wheel) + dir;
    wheelAcc -= dir * 90; lastStep = now;
  }
  wheelAcc = Math.max(-180, Math.min(180, wheelAcc));
}, { passive: false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'h' || e.key === 'H') $('panel').classList.toggle('hidden');
  if (lb.open) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') lbNav(1);
    if (e.key === 'ArrowLeft') lbNav(-1);
    return;
  }
  initAudio();
  if (e.key === 'ArrowRight') goTo(Math.round(target ?? wheel) + 1);
  if (e.key === 'ArrowLeft') goTo(Math.round(target ?? wheel) - 1);
  if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest?.('a, button')) { e.preventDefault(); openLightbox(currentIndex()); }   // not while a nav pill has focus
});
async function useFiles(list) {
  list = [...list].filter(f => f.type.startsWith('image/')); if (!list.length) return;
  images = list.map(f => URL.createObjectURL(f)); wheel = 0; buildCards();
}
$('files').addEventListener('change', e => useFiles(e.target.files));
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); useFiles(e.dataTransfer.files); });

/* ---------- Ambient gradient from image colours ---------- */
const palette = new Map();   // src → { cols:[[r,g,b]×3], w, h }
function sample(src) {
  if (palette.has(src)) return palette.get(src);
  const rec = { cols: null, w: 3, h: 4 };
  palette.set(src, rec);
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    rec.w = img.naturalWidth; rec.h = img.naturalHeight;
    try {
      const cv = document.createElement('canvas'); cv.width = cv.height = 24;
      const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 24, 24);
      const d = x.getImageData(0, 0, 24, 24).data;
      const avg = (x0, y0, x1, y1) => { let r = 0, g = 0, b = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let xx = x0; xx < x1; xx++) { const k = (y * 24 + xx) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
        r /= n; g /= n; b /= n; const m = (r + g + b) / 3, boost = 1.5;        // lift saturation a touch
        return [r, g, b].map(v => Math.max(0, Math.min(255, m + (v - m) * boost))); };
      rec.cols = [avg(0, 0, 12, 12), avg(12, 0, 24, 12), avg(0, 12, 24, 24)];
    } catch (e) { /* tainted canvas → keep neutral */ }
  };
  img.src = src;
  return rec;
}
const ambEl = $('ambient'), ambCtx = ambEl.getContext('2d');
let ambCur = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], ambSig = '';
function updateAmbient(dt) {
  const idx = lb.open ? lb.idx : currentIndex();
  const c = cards[idx]; if (!c) return;
  const rec = sample(c.src);
  const tgt = rec.cols || [[40, 40, 48], [40, 40, 48], [40, 40, 48]];
  const k = 1 - Math.pow(0.06, dt);                // ~1s ease between images
  let moving = false;
  ambCur = ambCur.map((col, j) => col.map((v, q) => { const nv = v + (tgt[j][q] - v) * k; if (Math.abs(tgt[j][q] - nv) > .5) moving = true; return nv; }));
  const sig = ambCur.flat().map(v => v | 0).join() + S.amb;
  if (sig === ambSig) return;                      // nothing changed → no redraw
  ambSig = sig;
  const W = 64, H = 40, a = S.amb;
  ambCtx.clearRect(0, 0, W, H);
  const blob = (x, y, r, col, m) => {
    const g = ambCtx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col.map(Math.round).join(',')},${(a * m).toFixed(3)})`);
    g.addColorStop(1, `rgba(${col.map(Math.round).join(',')},0)`);
    ambCtx.fillStyle = g; ambCtx.fillRect(0, 0, W, H);
  };
  blob(W * .18, H * .22, W * .5, ambCur[0], 1);
  blob(W * .84, H * .18, W * .45, ambCur[1], 1);
  blob(W * .5, H * .95, W * .6, ambCur[2], .8);
}


/* ---------- Lightbox (flip → fullscreen) ---------- */
const lb = { open: false, idx: 0, w: 0, h: 0, anim: null, busy: false };
const lbEl = $('lb'), flyer = $('flyer'), fFront = $('fFront'), fBack = $('fBack');
function lbSize(src) {
  const rec = sample(src);
  const ar = rec.w / rec.h || .75;
  const maxW = innerWidth * (innerWidth < 600 ? .9 : .78), maxH = innerHeight * .72;
  let w = maxW, h = w / ar; if (h > maxH) { h = maxH; w = h * ar; }
  return { w, h };
}
/* Geometry of the flyer is tweened for real (size, corner radius, crop) instead of being scaled,
   so a 3:4 card morphs cleanly into a 16:10 image without squashed corners. */
const fBorder = () => fFront.querySelector('.ib path');
function finalRadius(w, h) { return S.corner; }
function applyGeom(g) {
  const w = Math.max(1, g.w), h = Math.max(1, g.h);
  flyer.style.width = w + 'px'; flyer.style.height = h + 'px';
  flyer.style.left = -w / 2 + 'px'; flyer.style.top = -h / 2 + 'px';
  const d = squirclePath(w, h, g.r, S.smooth);
  const clip = `path('${d}')`;
  fFront.style.clipPath = fBack.style.clipPath = clip;
  fFront.style.webkitClipPath = fBack.style.webkitClipPath = clip;
  const svg = fFront.querySelector('.ib');
  if (svg) { svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('viewBox', `0 0 ${w} ${h}`); fBorder().setAttribute('d', d); }
  flyer.style.transform = `${P} translate(${g.x}px, ${g.y}px) rotate(${g.rot}rad) rotateY(${g.spin}deg)`;
}
function setFlyer(src) {
  const { w, h } = lbSize(src); lb.w = w; lb.h = h;
  fBack.style.backgroundImage = `url("${src}")`;
  fFront.style.backgroundImage = `url("${hiRes(src)}"), url("${src}")`;
  fFront.innerHTML = innerBorder(w, h, squirclePath(w, h, finalRadius(w, h), S.smooth));
  // caption under the image
  const cap = CAPTIONS[realOf(lb.idx) % CAPTIONS.length];
  $('lbTitle').textContent = cap[1]; $('lbMeta').textContent = cap[0] + ' · ' + cap[2];
  $('lbCap').style.top = (innerHeight / 2 + h / 2 + 22) + 'px';
  $('lbCount').textContent = String(realOf(lb.idx) + 1).padStart(2, '0') + ' / ' + String(realN()).padStart(2, '0');
}
const P = 'perspective(1800px)';
const centre = () => `translate(${innerWidth / 2}px, ${innerHeight / 2}px)`;
const centreGeom = (spin = 0) => ({ x: innerWidth / 2, y: innerHeight / 2, w: lb.w, h: lb.h, rot: 0, spin, r: finalRadius(lb.w, lb.h) });
const cardGeom = (c, spin) => ({ x: c.x, y: c.y, w: c.w * c.sc, h: c.h * c.sc, rot: wrapPI(c.a), spin,
  r: S.corner * c.sc });
// smooth, symmetric ease (quint in-out, softened) — gentle start, gentle landing
const easeFlip = t => t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;
const easeSoft = t => { const q = easeFlip(t); return q * .7 + (t < .5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2) * .3; };
let tweenId = 0;
function tween(from, to, dur, done) {
  flyer.getAnimations().forEach(a => a.cancel());
  const id = ++tweenId, t0 = performance.now();
  const keys = Object.keys(from);
  (function step(now) {
    if (id !== tweenId) return;
    const t = Math.min(1, (now - t0) / dur), e = easeSoft(t);
    const g = {}; keys.forEach(k => g[k] = from[k] + (to[k] - from[k]) * e);
    applyGeom(g);
    if (t < 1) requestAnimationFrame(step); else done && done();
  })(t0);
}
function openLightbox(i) {
  if (lb.open || lb.busy) return;
  const c = cards[i]; if (!c) return;
  lb.open = true; lb.busy = true; lb.idx = i;
  goTo(i);
  setFlyer(c.src);
  lbEl.classList.add('open'); lbEl.classList.remove('ready');
  c.el.style.visibility = 'hidden';
  click(1);
  tween(cardGeom(c, -180), centreGeom(0), 1100, () => { lb.busy = false; lbEl.classList.add('ready'); c.el.style.visibility = ''; });
}
function closeLightbox() {
  if (!lb.open || lb.busy) return;
  lb.busy = true; lbEl.classList.remove('ready');
  const c = cards[lb.idx];
  // fly back to where the card sits on top of the wheel
  const dest = { x: G.cx, y: G.cy, a: 0, sc: 1, w: c.w, h: c.h };
  c.el.style.visibility = 'hidden';
  lbEl.classList.remove('open'); lbEl.classList.add('closing');
  tween(centreGeom(0), cardGeom(dest, 180), 1050, () => {
    c.el.style.visibility = ''; lbEl.classList.remove('closing'); lb.open = false; lb.busy = false; idleUntil = performance.now() + 2500;
  });
}
function lbNav(dir, fromDx = 0) {
  if (!lb.open || lb.busy) return;
  lb.busy = true;
  const n = cards.length;
  const out = flyer.animate([
    { transform: `${P} translate(${innerWidth / 2 + fromDx}px, ${innerHeight / 2}px) rotate(0rad) scale(1, 1) rotateY(0deg)`, opacity: 1 },
    { transform: `${P} translate(${innerWidth / 2 - dir * innerWidth * .35}px, ${innerHeight / 2}px) rotate(0rad) scale(.9, .9) rotateY(${dir * 25}deg)`, opacity: 0 }
  ], { duration: 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  out.onfinish = () => {
    lb.idx = ((lb.idx + dir) % n + n) % n;
    goTo(lb.idx); if (target !== null) { wheel = target; target = null; } click(1);
    setFlyer(cards[lb.idx].src);
    applyGeom(centreGeom(0));
    const inn = flyer.animate([
      { transform: `${P} translate(${innerWidth / 2 + dir * innerWidth * .35}px, ${innerHeight / 2}px) rotate(0rad) scale(.9, .9) rotateY(${-dir * 25}deg)`, opacity: 0 },
      { transform: `${P} ${centre()} rotate(0rad) scale(1, 1) rotateY(0deg)`, opacity: 1 }
    ], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' });
    inn.onfinish = () => { lb.busy = false; };
  };
}
$('lbPrev').onclick = e => { e.stopPropagation(); lbNav(-1); };
$('lbNext').onclick = e => { e.stopPropagation(); lbNav(1); };
$('lbClose').onclick = e => { e.stopPropagation(); closeLightbox(); };
$('lbBg').addEventListener('click', closeLightbox);
// swipe / drag the image sideways
let sw = null;
flyer.addEventListener('pointerdown', e => {
  if (lb.busy) return;
  sw = { x: e.clientX, dx: 0 }; flyer.setPointerCapture(e.pointerId); flyer.classList.add('dragging');
});
flyer.addEventListener('pointermove', e => {
  if (!sw) return;
  sw.dx = e.clientX - sw.x;
  flyer.getAnimations().forEach(a => a.cancel());
  flyer.style.transform = `${P} translate(${innerWidth / 2 + sw.dx}px, ${innerHeight / 2}px) rotate(0rad) scale(1, 1) rotateY(${sw.dx * .03}deg)`;
});
flyer.addEventListener('pointerup', () => {
  if (!sw) return;
  const dx = sw.dx; sw = null; flyer.classList.remove('dragging');
  if (Math.abs(dx) > 70) lbNav(dx < 0 ? 1 : -1, dx);
  else {
    const a = flyer.animate([
      { transform: `${P} translate(${innerWidth / 2 + dx}px, ${innerHeight / 2}px) rotate(0rad) scale(1, 1) rotateY(${dx * .03}deg)` },
      { transform: `${P} ${centre()} rotate(0rad) scale(1, 1) rotateY(0deg)` }
    ], { duration: 300, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' });
    if (Math.abs(dx) < 4) closeLightbox();        // plain tap on the image closes too
  }
});
addEventListener('resize', () => { if (lb.open && !lb.busy) { setFlyer(cards[lb.idx].src); flyer.getAnimations().forEach(a => a.cancel()); applyGeom(centreGeom(0)); } });


/* ---------- Ruler (arc of ticks + numbers, like the knob's scale) ---------- */
const ruler = $('ruler'), rctx = ruler.getContext('2d');
let rDpr = 1, rAct = 0;
function sizeRuler() {
  rDpr = Math.min(devicePixelRatio, 2);
  ruler.width = innerWidth * rDpr; ruler.height = 150 * rDpr;
}
addEventListener('resize', sizeRuler); sizeRuler();
function drawRuler(dt, motion) {
  const W = innerWidth, H = 150;
  rAct += ((motion > .02 ? 1 : 0) - rAct) * Math.min(1, dt * (motion > .02 ? 10 : 2.2));
  const ctx = rctx; ctx.setTransform(rDpr, 0, 0, rDpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const R = Math.max(W * 1.1, 900);                // big shallow arc
  const cx = W / 2, cy = 58 + R;                   // arc apex sits 58px below the canvas top
  const per = 5;                                   // minor ticks per card
  const dA = Math.min(.05, 70 / R);                // angle between cards on the ruler
  const n = N();
  const base = .32 + .68 * rAct;                   // dim at rest, bright while scrolling
  const k0 = Math.floor((wheel - 14) * per), k1 = Math.ceil((wheel + 14) * per);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '400 10px "IBM Plex Mono", ui-monospace, Menlo, monospace';
  for (let k = k0; k <= k1; k++) {
    const u = k / per - wheel;                     // position in cards relative to centre
    const a = u * dA;
    const x = cx + Math.sin(a) * R, y = cy - Math.cos(a) * R;
    if (x < -20 || x > W + 20) continue;
    const edge = 1 - Math.min(1, Math.abs(x - cx) / (W * .5));        // fade toward the sides
    const fade = Math.pow(edge, 1.3);
    const major = k % per === 0, near = Math.max(0, 1 - Math.abs(u) * 1.2);
    const len = major ? 14 + 6 * near : 6;
    const al = (major ? .55 : .22) * fade * base + near * .35 * (major ? 1 : .5);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, al).toFixed(3)})`;
    ctx.lineWidth = major ? 1.4 : 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len); ctx.stroke();
    if (major) {
      const num = String(mod(Math.round(k / per), realN()) + 1).padStart(2, '0');
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (.35 * fade * base + near * .65)).toFixed(3)})`;
      ctx.fillText(num, 0, -8);
    }
    ctx.restore();
  }
  // fixed pointer at the apex
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(cx - 4, 34); ctx.lineTo(cx + 4, 34); ctx.lineTo(cx, 40); ctx.closePath(); ctx.fill();
  ctx.fillRect(cx - .75, 58, 1.5, 24);
}

/* ---------- Loop ---------- */
const clamp01 = v => Math.max(0, Math.min(1, v));
let prev = performance.now(), lastIdx = -1, lastDetent = null, logoWheel = 0;
const INTRO_MS = 2400;                     // 20% faster than before
const EDGE_MIN = .3;                       // side cards never vanish, they just dim
let introT0 = performance.now() + 250;
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
  if (lb.open && !lb.busy) { updateAmbient(dt); requestAnimationFrame(frame); return; }
  const introOn = now < introT0 + INTRO_MS;
  let dW = 0;
  if (!dragging) {
    // release → project where the throw would land, then a critically-damped spring glides there
    if (target === null) target = Math.round(wheel + vel * .32);
    const stiff = 70, damp = 2 * Math.sqrt(stiff);
    const sub = 4, h4 = dt / sub;
    for (let k = 0; k < sub; k++) {
      const acc = (target - wheel) * stiff - vel * damp;
      vel += acc * h4; wheel += vel * h4; dW += vel * h4;
    }
    if (Math.abs(target - wheel) < 0.0005 && Math.abs(vel) < 0.01) { wheel = target; vel = 0; }
  }
  const instV = dragging ? vel : dW / Math.max(dt, 1e-4);
  spinVis += (instV - spinVis) * Math.min(1, dt * 8);

  const n = N(), w = G.w, h = G.h;
  const ip = (() => { const m = /intro=([\d.]+)/.exec(location.hash); return m ? +m[1] : clamp01((now - introT0) / INTRO_MS); })();
  // smootherstep: zero velocity AND zero acceleration at both ends → no jolt at start or landing
  const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
  const ie = smoother(ip);
  const ieRot = smoother(clamp01(ip / .9));        // orbit/tilt settle a touch before the dolly → softer landing
  const step0 = w * (1 + S.gap);
  const P = S.persp, W = innerWidth, fadeW = W * .24;
  const sm = v => v * v * (3 - 2 * v);
  // one fixed ring: exactly SLOTS cards close the circle. State 0 and state 1 are the SAME ring;
  // the intro only moves the camera (far, above, orbited → into the centre).
  const lap = SLOTS, half = lap / 2, dA = 2 * Math.PI / lap;
  const R = lap * step0 / (2 * Math.PI), Rc = R;
  const push = (1 - ie) * (R * 3.4 + 2200);
  const tiltDeg = (1 - ieRot) * 26, tilt = -tiltDeg * Math.PI / 180;
  const spin = (1 - ieRot) * 1.8;
  if (ip < 1) {
    ring3d.style.transformOrigin = `${G.cx}px ${G.cy}px ${R}px`;
    ring3d.style.transform = `translateZ(${-push}px) rotateX(${-tiltDeg}deg) rotateY(${spin}rad)`;
  } else {
    if (stage.classList.contains('intro')) stage.classList.remove('intro');
    if (ring3d.style.transform !== 'none') ring3d.style.transform = 'none';
  }
  const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(tilt);
  const W2 = W / 2;
  const project = (x, z) => {
    const pz = z - Rc, x1 = x * cs + pz * sn, z1 = -x * sn + pz * cs;
    const depth = P - (Rc + z1 * ct - push);
    return { depth, sx: W2 + (G.cx + x1 - W2) * P / Math.max(1, depth) };
  };
  const shade = (sx, depth) => {
    const lens = sm(clamp01((depth - P * .3) / (P * .4)));      // cards right at / behind the camera melt away
    const edge = clamp01(Math.min(sx, W - sx) / fadeW);
    return (EDGE_MIN + (1 - EDGE_MIN) * edge * edge * (3 - 2 * edge)) * lens;
  };
  cards.forEach(c => {
    let d = mod(c.i - wheel + n / 2, n) - n / 2;
    const ad = Math.abs(d);
    const th = d * dA;
    const lapFade = (d >= -half && d < half) ? 1 : 0;
    if (lapFade <= 0) { if (c.vis !== false) { c.el.style.visibility = 'hidden'; c.vis = false; } return; }
    const x = Rc * Math.sin(th);
    const z = Rc - Rc * Math.cos(th);
    const pr = project(x, z);
    const op = shade(pr.sx, pr.depth);
    if (op < .003) { if (c.vis !== false) { c.el.style.visibility = 'hidden'; c.vis = false; } return; }
    if (c.vis === false) { c.el.style.visibility = ''; c.vis = true; }
    // 3D hover: card lifts toward the viewer and tilts toward the cursor
    const on = hoverI === c.i && !dragging;
    c.hv = (c.hv || 0) + ((on ? 1 : 0) - (c.hv || 0)) * Math.min(1, dt * 8);
    if (on) { c.mx = (c.mx || 0) + (hoverMX - (c.mx || 0)) * Math.min(1, dt * 10); c.my = (c.my || 0) + (hoverMY - (c.my || 0)) * Math.min(1, dt * 10); }
    const hv = c.hv;
    c.x = G.cx + x; c.y = G.cy; c.a = 0; c.sc = 1;
    c.el.style.transform = `translate3d(${G.cx + x - w / 2}px, ${G.cy - h / 2}px, ${z}px) rotateY(${-th}rad)` +
      (hv > .001 ? ` translateZ(${(70 * hv).toFixed(1)}px) rotateY(${((c.mx || 0) * 16 * hv).toFixed(2)}deg) rotateX(${(-(c.my || 0) * 12 * hv).toFixed(2)}deg)` : '');
    c.el.style.opacity = op.toFixed(3);
  });

  // labels
  $('caption').style.top = (G.cy + h / 2 + 26) + 'px';

  drawRuler(dt, clamp01(Math.abs(spinVis) / 3 + Math.abs(wheel - Math.round(wheel)) * 2));

  // detent click
  const det = Math.round(wheel);
  if (det !== lastDetent) { if (lastDetent !== null) click(clamp01(Math.abs(spinVis) / 8)); lastDetent = det; }

  const idx = currentIndex();
  if (idx !== lastIdx) {
    lastIdx = idx;
    const cap = CAPTIONS[realOf(idx) % CAPTIONS.length];
    const t = $('title'), m = $('meta');
    t.textContent = cap[1]; m.textContent = cap[0] + ' · ' + cap[2];
    [t, m].forEach(e => { e.classList.remove('tick'); void e.offsetWidth; e.classList.add('tick'); });
  }
  if (Math.abs(wheel - logoWheel) > 1e-4) { dispatchEvent(new CustomEvent('logo:spin', { detail: (wheel - logoWheel) * 160 })); logoWheel = wheel; }
  updateAmbient(dt);
  requestAnimationFrame(frame);
}
buildCards();
introT0 = performance.now() + 99999;
// Intro start. Direct load: once the images are in (as before).
// Arriving through the page curtain (src/curtain.js): the page is ready once the images are in or
// after 1.5 s, the curtain lifts off the far "state 0" ring and the camera move starts with it.
const wait = ms => new Promise(r => setTimeout(r, ms));
const loaded = new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }));
pageReady(Promise.race([loaded, wait(1500)]));
(arrivedThroughCurtain ? revealed.then(() => wait(120)) : loaded.then(() => wait(200)))
  .then(() => { introT0 = performance.now(); });
requestAnimationFrame(frame);
