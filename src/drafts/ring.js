// Drafts v3 — a ring of shots, seen from INSIDE (camera in the centre of the circle), drawn in WebGL.
//
// Resting state: the current shot fills the screen (screen ratio, small padding, rounded corners) with
// its title / meta / counter. Scrolling: the shot pulls back so the ring shows (it stays the biggest,
// the others are small, far away on the ring; the wide lens makes the ones at the screen edges grow),
// the ring turns to the next shot, then it pushes in to full screen again. While the ring moves the
// shots bend: their middle lags behind the edges, like paper dragged through air.
// Reference: the screen recording Dominik sent (Oct 2026). The ruler at the bottom is ours (v1/v2).
import * as THREE from 'three';
import { tick } from '../sfx.js';
import { pageReady, revealed, arrivedThroughCurtain } from '../curtain.js';

// ---------- content ----------
// Dominik's drafts — two separate sets: landscape screens get the desktop exports (public/drafts/d/NN.webp,
// 2048 px + a 1024 px `-lo` for the ring), phones the portrait exports (public/drafts/m/NN.webp, 590 px).
// Titles / kinds / years (2023–2026) named from what each shot shows.
const DRAFTS = [
  [1, 'McLaren Team', 'Poster', 2025], [2, 'Lando Norris', 'Poster', 2025], [3, 'Private Connections', 'Web Experience', 2025],
  [4, 'AI Toolbox', 'Visual Exploration', 2026], [5, 'Deepflare — Protein Engine', 'Web Experience', 2024],
  [6, 'Artificial Evolution', 'Art Direction', 2026], [7, 'Elegance With Connections', 'Campaign', 2025],
  [8, 'Kwadron — Meet the Cartridge', 'Web Experience', 2024], [9, 'Kwadron — Needles', 'Typography', 2024],
  [10, 'That Others Love', 'Poster', 2023], [11, 'Triverna Zero', 'Campaign', 2026], [12, 'Deepflare — Vaccines With AI', 'Web Experience', 2024],
  [13, 'Scope Summary', 'Product Design', 2025], [14, 'Volvo', 'Product Design', 2025], [15, 'Makadu — Core', 'Brand Identity', 2025],
  [16, 'Rola projektanta', 'Editorial', 2026], [17, 'Lidia Rogaszka', 'Web Experience', 2024], [18, 'The Modern Approach to Dating', 'Web Experience', 2025],
  [19, 'Forge', 'Brand Identity', 2025],
];
const MOBILE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15];   // the portrait exports he sent (no 14, none after 15)
const pad = n => String(n).padStart(2, '0');
const shotsFor = portrait => (portrait ? DRAFTS.filter(d => MOBILE.includes(d[0])) : DRAFTS).map(([n, title, kind, year]) => ({
  title, kind, year,
  lo: portrait ? `/drafts/m/${pad(n)}.webp` : `/drafts/d/${pad(n)}-lo.webp`,
  hi: portrait ? null : `/drafts/d/${pad(n)}.webp`,
}));

// ---------- feel ----------
const FOV = 60;             // vertical, degrees (66 on phones) — a wide lens: shots near the screen edges grow
const ROW = 0.22;           // pulled back, every shot is this share of the screen height (0.3 on phones) — all the same size
const GAP = 0.12;           // space between shots on the ring, in card heights
const ZOOM_IN_K = 34, ZOOM_OUT_K = 55;   // springs (critically damped): glide in, ease out
const TURN_K = 40;          // ring spring (+15 % speed over 30)
const ROW_RADIUS = 2.4;     // pulled back, corners are this much rounder than at full screen (still subtle at that size)
const MOVE_AT = 0.6;        // the ring starts turning once the camera has pulled back this far (overlaps, so it flows)
const SETTLE_MS = 260;      // quiet time before it glides in again
const LAG = 0.014, LAG_MAX = 0.05;       // bend while moving: card widths of lag per card/s, and its cap — subtle

const clamp01 = v => Math.max(0, Math.min(1, v));
const mod = (a, n) => ((a % n) + n) % n;
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function mountRing({ host, ruler, caption, count, meta, prevBtn, nextBtn }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xffffff, 1);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 200);
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
  const blank = new THREE.DataTexture(new Uint8Array([238, 238, 238, 255]), 1, 1); blank.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(1, 1, 49, 25);   // odd counts: no vertex row/column exactly on the centre lines

  const vertexShader = /* glsl */`
    uniform vec2 uSize; uniform float uLag, uCurve, uR, uVert;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      float nx = position.x * 2., ny = position.y * 2.;
      float mid = 1. - ny * ny;                       // 1 in the middle row, 0 at top/bottom
      vec3 p = position;                              // unit plane; the mesh is scaled to the card size (x by uSize.x)
      // lie on the inside of the ring: wrap the card around a cylinder of the ring's radius (uCurve 1),
      // flat when it's full screen (uCurve 0)
      if (uVert < .5) {                               // horizontal ring (desktop)
        float X = p.x * uSize.x, phi = X / uR;
        p.x = mix(X, uR * sin(phi), uCurve) / uSize.x;
        p.z = uCurve * uR * (1. - cos(phi));
        p.x += uLag * mid;                            // while moving, the middle lags behind the edges
        p.z += abs(uLag) * uSize.x * .4 * mid * (1. - .5 * nx * nx);
      } else {                                        // vertical ring (phones): same, turned 90°
        float Y = p.y, phi = Y / uR, midX = 1. - nx * nx;
        p.y = mix(Y, uR * sin(phi), uCurve);
        p.z = uCurve * uR * (1. - cos(phi));
        p.y -= uLag * midX;
        p.z += abs(uLag) * .4 * midX * (1. - .5 * ny * ny);
      }
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }`;
  const fragmentShader = /* glsl */`
    uniform sampler2D uMap; uniform float uReady, uRadius, uOpacity; uniform vec2 uSize, uCover;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - .5) * uSize;
      vec2 q = abs(p) - (uSize * .5 - uRadius);
      float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - uRadius;   // rounded rectangle
      float aa = max(fwidth(d), 1e-4);                 // never 0: smoothstep(0, 0, x) is undefined (a white seam down the middle)
      float a = 1. - smoothstep(-aa, aa, d);
      vec3 col = mix(vec3(.93), texture2D(uMap, (vUv - .5) * uCover + .5).rgb, uReady);
      gl_FragColor = vec4(col, a * uOpacity);
      #include <colorspace_fragment>
    }`;

  // ---------- cards ----------
  let shots = [], cards = [], realN = 0;
  const L = {};            // layout (world units; card height = 1)
  function buildCards() {
    cards.forEach(c => { scene.remove(c.mesh); c.mesh.material.dispose(); c.tex?.dispose(); c.hi?.dispose(); });
    const portrait = innerHeight > innerWidth;
    shots = shotsFor(portrait);
    realN = shots.length;
    cards = shots.map((s, i) => {
      const material = new THREE.ShaderMaterial({
        vertexShader, fragmentShader, transparent: true, depthWrite: false,
        uniforms: { uMap: { value: blank }, uReady: { value: 0 }, uRadius: { value: .05 }, uOpacity: { value: 1 },
          uSize: { value: new THREE.Vector2(1, 1) }, uCover: { value: new THREE.Vector2(1, 1) }, uLag: { value: 0 }, uCurve: { value: 1 }, uR: { value: 4 }, uVert: { value: 0 } },
      });
      const mesh = new THREE.Mesh(geo, material); mesh.userData.i = i; mesh.frustumCulled = false;
      scene.add(mesh);
      const c = { i, mesh, aspect: 1, tex: null, hi: null, hiLoading: false };
      loader.load(s.lo, t => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        c.tex = t; c.aspect = t.image.width / t.image.height;
        material.uniforms.uMap.value = t; fit(c);
        c.fade = 0;                                   // eases in (uReady)
      });
      return c;
    });
  }
  // cover-crop the image into the card
  function fit(c) {
    const ca = L.cardW, ia = c.aspect, u = c.mesh.material.uniforms.uCover.value;
    if (ia > ca) u.set(ca / ia, 1); else u.set(1, ia / ca);
  }
  function hiRes(c) {                                 // the shot you're looking at full screen gets the 2048 px file
    if (c.hi || c.hiLoading || !c.tex || !shots[c.i].hi) return;
    c.hiLoading = true;
    loader.load(shots[c.i].hi, t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; c.hi = t;
      c.mesh.material.uniforms.uMap.value = t;
    });
  }

  function layout() {
    const W = innerWidth, H = innerHeight, phone = W < 700;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = phone ? 66 : FOV; camera.updateProjectionMatrix();
    const pad = phone ? 8 : 10, radiusPx = phone ? 14 : 16;
    L.pad = pad;
    L.cardW = (W - 2 * pad) / (H - 2 * pad);          // card ratio = screen ratio (inside the padding)
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    L.dIn = 0.5 / t / ((H - 2 * pad) / H);           // distance at which the card fills the screen minus padding
    L.vert = phone;                                   // phones: the ring stands up — shots above/below each other
    L.R = 1 / ((phone ? .26 : ROW) * 2 * t);          // ring radius: from the centre every shot is ROW of the height
    L.radius = radiusPx / (H - 2 * pad);
    L.s0 = ((L.vert ? 1 : L.cardW) + GAP) / L.R;      // angle between neighbours (cards are arcs of the ring)
    L.gapS = pad * .6 / (H - 2 * pad);                // full screen: gap between sliding shots — a sliver of the next one shows in the padding
    cards.forEach(c => { const u = c.mesh.material.uniforms; u.uSize.value.set(L.cardW, 1); u.uRadius.value = L.radius; u.uR.value = L.R; u.uVert.value = L.vert ? 1 : 0; c.mesh.scale.set(L.cardW, 1, 1); fit(c); });
  }

  // ---------- motion state ----------
  let wheel = 0, target = 0, vel = 0, pending = null, dragging = false, lastInput = -1e9;
  let engaged = false;      // no zoom on arrival: the first shot only glides in after the first interaction
  let full = false;         // full-screen mode: shots slide left/right at full size, no pull-back, no ring turn
  let zoom = 0, zoomV = 0;
  let introT0 = Infinity, introFrom = -4;

  // scroll / swipe / drag always go through the ring (pull back, turn, glide in); only the ← → buttons
  // and arrow keys slide sideways at full size while a shot is full screen
  const step = (dir, slide = false) => {
    lastInput = performance.now(); engaged = true;
    if (full && !slide && !L.vert) full = false;      // phones: once full screen, every swipe pages (TikTok-like)
    if (full) {                                       // full screen + arrows: slide straight to the neighbour
      const base = target ?? Math.round(wheel);
      target = Math.max(wheel - 3, Math.min(wheel + 3, Math.round(base) + dir)); pending = null;
    } else pending = (pending ?? target) + dir;
  };
  // back to the ring (click on the full-screen shot, Esc); it stays there until the next interaction
  const unzoom = () => { if (!full || L.vert) return; full = false; engaged = false; lastInput = performance.now(); };
  prevBtn?.addEventListener('click', () => step(-1, true));
  nextBtn?.addEventListener('click', () => step(1, true));
  // wheel: one notch = one shot; trackpads step after enough travel
  let acc = 0, lastStep = 0;
  addEventListener('wheel', e => {                  // whole window: also over the arrows / captions
    e.preventDefault(); lastInput = performance.now();
    const dl = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.sign(dl) !== Math.sign(acc)) acc = 0;
    acc += dl;
    const now = performance.now();
    if (Math.abs(acc) >= 60 && now - lastStep > 160) { step(Math.sign(acc)); acc = 0; lastStep = now; }
    acc = Math.max(-120, Math.min(120, acc));
  }, { passive: false });
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, a, button')) return;
    if (e.key === 'ArrowRight') step(1, true);
    if (e.key === 'ArrowLeft') step(-1, true);
    if (e.key === 'ArrowDown') step(1);
    if (e.key === 'ArrowUp') step(-1);
    if (e.key === 'Escape') unzoom();
  });
  // drag / swipe (horizontal on desktop, either way on touch)
  let sx = 0, sy = 0, lastX = 0, lastY = 0, lastT = 0, moved = 0, touch = false, startWheel = 0;
  host.addEventListener('pointerdown', e => {
    dragging = true; moved = 0; sx = lastX = e.clientX; sy = lastY = e.clientY; lastT = performance.now(); touch = e.pointerType !== 'mouse';
    startWheel = Math.round(target ?? wheel);
    host.setPointerCapture(e.pointerId); lastInput = lastT; engaged = true;
  });
  host.addEventListener('pointermove', e => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    moved = Math.max(moved, Math.abs(e.clientX - sx), Math.abs(e.clientY - sy));
    if (full && moved > 6 && !L.vert) full = false;   // desktop: dragging a full-screen shot pulls back to the ring
    if (full && L.vert) {                             // phones, full screen: the column of shots follows the finger
      const d = -dy / ((1 + L.gapS) * (innerHeight - 2 * L.pad));
      wheel += d; vel = vel * .6 + d / Math.max(1, now - lastT) * 1000 * .4; target = null;
    } else if (zoom < MOVE_AT + .1) {                 // the ring follows the finger once pulled back
      // mouse: horizontal drag; phones: vertical (the ring stands up there)
      const d = L.vert ? -dy / (innerHeight * 0.24) : -dx / (innerWidth * 0.28);
      wheel += d; vel = vel * .6 + d / Math.max(1, now - lastT) * 1000 * .4; target = null;
    }
    lastT = now; lastInput = now;
  });
  const endDrag = e => {
    if (!dragging) return; dragging = false; lastInput = performance.now();
    if (moved < 6) click(e);
    else if (full && L.vert) {                        // phones, full screen: a short flick is enough to page (TikTok-like)
      const dist = wheel - startWheel, dir = Math.abs(vel) > .6 ? Math.sign(vel) : Math.abs(dist) > .12 ? Math.sign(dist) : 0;
      target = startWheel + dir; pending = null;
    } else { target = Math.round(wheel + vel * .25); pending = null; }
  };
  host.addEventListener('pointerup', endDrag); host.addEventListener('pointercancel', endDrag);
  // click a small shot → go there (on the full-screen one, nothing)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function click(e) {
    if (full) { unzoom(); return; }
    if (zoom > .6) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(cards.map(c => c.mesh))[0];
    if (!hit) return;
    let d = mod(hit.object.userData.i - wheel + realN / 2, realN) - realN / 2;
    pending = Math.round(wheel + d); lastInput = performance.now(); engaged = true;
  }

  // ---------- sound: a short mechanical tick per shot (src/sfx.js) ----------

  // ---------- ruler (the v1/v2 picker, unchanged look; drawn white + difference blend in CSS) ----------
  const rctx = ruler.getContext('2d');
  let rDpr = 1;
  const sizeRuler = () => { rDpr = Math.min(devicePixelRatio || 1, 2); ruler.width = innerWidth * rDpr; ruler.height = 150 * rDpr; };
  function drawRuler() {
    const W = innerWidth, H = 150, ctx = rctx;
    ctx.setTransform(rDpr, 0, 0, rDpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const R = Math.max(W * 1.1, 900), cx = W / 2, cy = 58 + R, per = 5, dA = Math.min(.05, 70 / R);
    const k0 = Math.floor((wheel - 14) * per), k1 = Math.ceil((wheel + 14) * per);
    ctx.textAlign = 'center'; ctx.font = '400 10px "IBM Plex Mono", ui-monospace, Menlo, monospace';
    for (let k = k0; k <= k1; k++) {
      const u = k / per - wheel, a = u * dA, x = cx + Math.sin(a) * R, y = cy - Math.cos(a) * R;
      if (x < -20 || x > W + 20) continue;
      const fade = Math.pow(1 - Math.min(1, Math.abs(x - cx) / (W * .5)), 1.3);
      const major = k % per === 0, near = Math.max(0, 1 - Math.abs(u) * 1.2);
      const al = (major ? .55 : .22) * fade + near * .35 * (major ? 1 : .5);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, al).toFixed(3)})`; ctx.lineWidth = major ? 1.4 : 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, major ? 14 + 6 * near : 6); ctx.stroke();
      if (major) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, .35 * fade + near * .65).toFixed(3)})`;
        ctx.fillText(String(mod(Math.round(k / per), realN) + 1).padStart(2, '0'), 0, -8);
      }
      ctx.restore();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(cx - 4, 34); ctx.lineTo(cx + 4, 34); ctx.lineTo(cx, 40); ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - .75, 58, 1.5, 24);
  }

  // ---------- captions (full-screen state) ----------
  let shown = -1;
  function setCaption(i) {
    if (i === shown) return; shown = i;
    const s = shots[i];
    caption.textContent = s.title;
    meta.textContent = `${s.kind} · ${s.year}`;
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(realN).padStart(2, '0')}`;
  }

  // ---------- loop ----------
  let prev = performance.now(), lastDetent = null, logoWheel = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    const intro = clamp01((now - introT0) / 1700), ie = intro * intro * intro * (intro * (intro * 6 - 15) + 10);
    const inIntro = intro < 1;

    // zoom: pull back on any input, push in when everything has settled
    const settled = engaged && !inIntro && !dragging && pending === null && target !== null && Math.abs(target - wheel) < .002 && Math.abs(vel) < .02 && now - lastInput > SETTLE_MS;
    if (settled && zoom > .985) full = true;
    const zT = full || settled ? 1 : 0, k = zT > zoom ? ZOOM_IN_K : ZOOM_OUT_K, c = 2 * Math.sqrt(k);
    for (let s = 0; s < 3; s++) { const h = dt / 3; zoomV += ((zT - zoom) * k - zoomV * c) * h; zoom += zoomV * h; }
    zoom = Math.max(-.02, Math.min(1.005, zoom));
    if (reduce) zoom = zT;

    // ring: starts turning once the shot has pulled back
    if (pending !== null && zoom < MOVE_AT) { target = pending; pending = null; }
    if (inIntro) { wheel = introFrom * (1 - ie); vel = 0; target = 0; }
    else if (!dragging && target !== null) {
      const st = TURN_K, dmp = 2 * Math.sqrt(st);
      for (let s = 0; s < 4; s++) { const h = dt / 4; vel += ((target - wheel) * st - vel * dmp) * h; wheel += vel * h; }
      if (Math.abs(target - wheel) < .0005 && Math.abs(vel) < .01) { wheel = target; vel = 0; }
    }
    const speed = inIntro ? -introFrom * 30 * intro * intro * (1 - intro) * (1 - intro) / 1.7 : vel;   // cards/s, for the bend

    // camera: from the ring's centre (all shots the same size) it glides toward the current shot until it
    // fills the screen. The distance is interpolated in 1/size, so the growth reads even, not a lurch at the end.
    const z = clamp01(zoom), size = (1 - z) / L.R + z / L.dIn;
    camera.position.set(0, 0, -(L.R - 1 / size) + (1 - ie) * L.R * .9);   // intro: from further back
    // the ring turning forward moves the shots left, so their middle lags to the right (+x)
    const lag = Math.max(-LAG_MAX, Math.min(LAG_MAX, speed * LAG));
    // near full screen the shots leave the ring for a flat strip in front of the camera, so in full-screen
    // mode the neighbours slide in at full size (the current shot sits at the same spot in both layouts)
    const b = ss(.75, 1, z), camZ = camera.position.z;
    for (const cd of cards) {
      const d = mod(cd.i - wheel + realN / 2, realN) - realN / 2;
      const a = d * L.s0, m = cd.mesh, inStrip = Math.abs(d) < 3;
      const bb = inStrip ? b : 0;
      if (Math.abs(a) > 1.7 && !(inStrip && b > 0)) { m.visible = false; continue; }
      m.visible = true;
      const szp = camZ - L.dIn, rz = -L.R * Math.cos(a);
      if (L.vert) {                                   // phones: next shot below, the ring turns upward
        const ry = -L.R * Math.sin(a), syp = -d * (1 + L.gapS);
        m.position.set(0, ry + (syp - ry) * bb, rz + (szp - rz) * bb);
        m.rotation.set(-a * (1 - bb), 0, 0);
      } else {
        const rx = L.R * Math.sin(a), sxp = d * (L.cardW + L.gapS);
        m.position.set(rx + (sxp - rx) * bb, 0, rz + (szp - rz) * bb);
        m.rotation.set(0, -a * (1 - bb), 0);
      }
      const f = ss(.5, 0, Math.abs(d));                                // 1 = the current shot
      const u = m.material.uniforms;
      u.uLag.value = lag;
      const curve = 1 - f * z, rad = ROW_RADIUS + (1 - ROW_RADIUS) * f * z;
      u.uCurve.value = curve * (1 - bb);                               // the current shot flattens as we arrive
      u.uRadius.value = L.radius * (rad + (1 - rad) * bb);             // and its corners tighten to the full-screen radius
      cd.fade = Math.min(1, (cd.fade ?? 0) + dt * 3);
      u.uReady.value = cd.tex ? cd.fade : 0;
      u.uOpacity.value = clamp01(intro * 2.2 - Math.abs(d) * .06);
      if (f > .99 && zoom > .9) hiRes(cd);
    }
    renderer.render(scene, camera);

    // ruler, captions, ticks, logo
    drawRuler();
    const cur = mod(Math.round(wheel), realN);
    setCaption(cur);
    document.body.style.setProperty('--cap', ss(.8, 1, zoom).toFixed(3));
    document.body.classList.toggle('dr-full', full);
    const det = Math.round(wheel);
    if (det !== lastDetent) { if (lastDetent !== null) tick(clamp01(Math.abs(vel) / 8)); lastDetent = det; }
    if (Math.abs(wheel - logoWheel) > 1e-4) { dispatchEvent(new CustomEvent('logo:spin', { detail: (wheel - logoWheel) * 160 })); logoWheel = wheel; }
  }

  buildCards(); layout(); sizeRuler();
  let lastPortrait = innerHeight > innerWidth;
  addEventListener('resize', () => {
    const p = innerHeight > innerWidth;
    if (p !== lastPortrait) { lastPortrait = p; buildCards(); }       // phone turned: other shots fit
    layout(); sizeRuler();
  });
  requestAnimationFrame(frame);

  // intro once the page is visible (after the page curtain, or straight away)
  const wait = ms => new Promise(r => setTimeout(r, ms));
  pageReady(wait(300));
  (arrivedThroughCurtain ? revealed.then(() => wait(80)) : wait(250)).then(() => { introT0 = performance.now(); });

  return { get state() { return { wheel, zoom, target, pending }; }, go: i => { pending = i; lastInput = performance.now(); } };
}
