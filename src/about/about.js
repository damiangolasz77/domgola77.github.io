// About page: a headline with real 3D/2D objects sitting in text slots. Scrolling down fades the
// type, the slot objects let go and drift to the centre, more objects pop in and everything turns
// into a zero-g physics pile you can push, drag and throw. Scrolling back reverses it exactly:
// the extras shrink away, the slot objects spring back and land pixel-exact in their slots.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { buildCap } from './cap.js';
import { buildRacket, buildHanger, buildComputer, buildCursor, buildTennisBall } from './objects.js';
import { studioEnvironment, chromeEnvironment, materials } from '../three/look.js';
import { loadLogoGeometry, loadCursorGeometry, CARDS } from './assets.js';
import { audioContext } from '../sound.js';

const v3 = (x = 0, y = 0, z = 0) => new CANNON.Vec3(x, y, z);
const clamp01 = x => Math.min(Math.max(x, 0), 1);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const backOut = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rnd = a => (Math.random() * 2 - 1) * a;
const sgn = () => (Math.random() < .5 ? -1 : 1);
const ORIENT = {
  cap: () => [0.3 + rnd(0.15), sgn() * (0.45 + Math.random() * 0.55), rnd(0.15)],
  racket: () => [rnd(0.3), rnd(0.45), sgn() * (0.35 + Math.random() * 0.55)],
  computer: () => [rnd(0.12) + 0.05, sgn() * (0.15 + Math.random() * 0.4), rnd(0.08)],
  hanger: () => [rnd(0.2), rnd(0.5), rnd(0.35)],
  cursor: () => [0.2 + rnd(0.3), rnd(0.5), rnd(0.45)],
  ball: () => [rnd(3), rnd(3), rnd(3)],
  logo: () => [rnd(0.35), rnd(0.6), rnd(0.3)],
  card: () => [rnd(0.25), rnd(0.35), rnd(0.3)],
  tall: () => [rnd(0.2), rnd(0.35), rnd(0.18)],
  pill: () => [rnd(3), rnd(3), rnd(3)],
};
const SOUND_HZ = { ball: 420, computer: 520, cap: 700, racket: 1500, card: 2600, tall: 2200, logo: 3600, cursor: 3800, hanger: 4200, pill: 1900 };

export async function mountAbout({ host, slots, words, onChaos, soundEnabled = () => false, variant = 'drop', progress: getProgress } = {}) {
  const DROP = variant === 'drop';   // 'drop': start in the pile, scrolling builds the headline and the rest falls to the floor
  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xffffff, 1);
  const el = renderer.domElement;
  el.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y';
  host.appendChild(el);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(4, 2, -5); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const VIEW_H = 8, view = { w: 12, h: VIEW_H, W: 1, H: 1 };
  function resize() {
    const W = host.clientWidth || innerWidth, H = host.clientHeight || innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.position.set(0, 0, VIEW_H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    Object.assign(view, { W, H, h: VIEW_H, w: VIEW_H * W / H });
    if (items.length) layoutHomes();
  }

  const M = materials();
  M.chrome.envMap = chromeEnvironment(renderer);
  const [logoGeo, cursorGeo] = await Promise.all([loadLogoGeometry(), loadCursorGeometry()]);
  const cardTex = {};
  await Promise.all(Object.entries(CARDS).map(async ([k, c]) => {
    const t = await new THREE.TextureLoader().loadAsync(c.uri); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cardTex[k] = t;
  }));

  // ---------- physics ----------
  const world = new CANNON.World({ gravity: v3(0, 0, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 10;
  world.defaultContactMaterial.friction = 0.25;
  world.defaultContactMaterial.restitution = 0.2;
  world.defaultContactMaterial.contactEquationStiffness = 1e7;
  const objMat = new CANNON.Material('object'), ballMat = new CANNON.Material('ball');
  world.addContactMaterial(new CANNON.ContactMaterial(ballMat, objMat, { friction: 0.3, restitution: 0.75 }));
  world.addContactMaterial(new CANNON.ContactMaterial(ballMat, ballMat, { friction: 0.3, restitution: 0.85 }));
  world.addContactMaterial(new CANNON.ContactMaterial(objMat, objMat, { friction: 0.25, restitution: 0.2 }));
  // side + front/back walls are frictionless: otherwise a big object (a cap) can wedge between them and hang mid-air
  const wallMat = new CANNON.Material('wall');
  world.addContactMaterial(new CANNON.ContactMaterial(objMat, wallMat, { friction: 0, restitution: 0.1 }));
  world.addContactMaterial(new CANNON.ContactMaterial(ballMat, wallMat, { friction: 0, restitution: 0.5 }));

  const items = [];
  let audio = null, lastTick = 0;
  function impactSound(it, v) {
    if (!soundEnabled() || v < 1.4) return;
    const now = performance.now(); if (now - lastTick < 28) return; lastTick = now;
    audio = audioContext(); if (!audio) return;
    if (!audio._noise) { const b = audio.createBuffer(1, audio.sampleRate * 0.12, audio.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; audio._noise = b; }
    const t = audio.currentTime, src = audio.createBufferSource(), bp = audio.createBiquadFilter(), g = audio.createGain();
    src.buffer = audio._noise; bp.type = 'bandpass'; bp.frequency.value = (SOUND_HZ[it.kind] || 1500) * (0.85 + Math.random() * 0.3); bp.Q.value = 5;
    g.gain.setValueAtTime(Math.min(0.32, v / 16), t); g.gain.exponentialRampToValueAtTime(0.0006, t + 0.07);
    src.connect(bp).connect(g).connect(audio.destination); src.start(t); src.stop(t + 0.09);
  }
  function add(object, body, kind, baseScale) {
    body.linearDamping = 0.55; body.angularDamping = 0.4;
    if (!body.material) body.material = objMat;
    world.addBody(body); scene.add(object);
    const it = { object, body, kind, baseScale, hero: null, appear: 1, a: 0 };
    object.traverse(m => { m.userData.item = it; });
    body.addEventListener('collide', e => { if (body.collisionResponse) impactSound(it, Math.abs(e.contact.getImpactVelocityAlongNormal())); });
    items.push(it);
    return it;
  }
  function prism(poly, half) {
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    poly = poly.map(([x, y]) => [x - cx, y - cy]);
    let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) poly = [...poly].reverse();
    const n = poly.length, verts = [], faces = [];
    poly.forEach(([x, y]) => verts.push(v3(x, y, half))); poly.forEach(([x, y]) => verts.push(v3(x, y, -half)));
    faces.push([...Array(n).keys()]); faces.push([...Array(n).keys()].map(i => n + (n - 1 - i)));
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([i, n + i, n + j, j]); }
    return { shape: new CANNON.ConvexPolyhedron({ vertices: verts, faces }), offset: v3(cx, cy, 0) };
  }
  function bodyFrom(colliders, s, mass) {
    const body = new CANNON.Body({ mass });
    for (const c of colliders) {
      const at = v3(c.at[0] * s, c.at[1] * s, c.at[2] * s);
      if (c.t === 'sphere') body.addShape(new CANNON.Sphere(c.r * s), at);
      else if (c.t === 'box') { const q = new CANNON.Quaternion(); q.setFromEuler(0, 0, c.rz || 0); body.addShape(new CANNON.Box(v3(c.half[0] * s, c.half[1] * s, c.half[2] * s)), at, q); }
      else if (c.t === 'convex') { const pr = prism(c.pts.map(([x, y]) => [x * s, y * s]), c.half * s); body.addShape(pr.shape, at.vadd(pr.offset)); }
    }
    return body;
  }
  const prop = ({ object, colliders }, s, mass, kind) => add(object, bodyFrom(colliders, s, mass), kind, s);
  const logoSpheres = logoGeo.userData.spheres.filter((q, i) => q[2] > 0.075 || i % 3 === 0);
  function logo3D(s) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(logoGeo, M.chrome));
    const body = new CANNON.Body({ mass: 1.2 * s * s });
    for (const [x, y, r] of logoSpheres) body.addShape(new CANNON.Sphere(r * s * 1.12), v3(x * s, y * s, 0));
    return add(g, body, 'logo', s);
  }
  function card2D(key, width) {
    const c = CARDS[key], aspect = c.h / c.w, g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(width, width * aspect),
      new THREE.MeshBasicMaterial({ map: cardTex[key], side: THREE.DoubleSide, alphaTest: 0.45, toneMapped: false })));
    const body = new CANNON.Body({ mass: 0.5 * width * width * aspect });
    for (const hull of c.hulls) { const pr = prism(hull.map(([x, y]) => [x * width, y * width]), 0.04); body.addShape(pr.shape, pr.offset); }
    return add(g, body, aspect > 1.2 ? 'tall' : 'card', 1);
  }
  const cap3D = (colorway, s, badge = false) => {
    const grp = buildCap({ colorway, badgeGeometry: badge ? logoGeo : null, badgeMaterial: M.chrome, metalMaterial: M.chrome });
    const c = grp.userData.collider;
    return prop({ object: grp, colliders: [{ t: 'sphere', r: c.sphere.r, at: c.sphere.at.toArray() }, { t: 'box', half: c.box.half.toArray(), at: c.box.at.toArray() }] }, s, s * s, 'cap');
  };
  const racket3D = s => prop(buildRacket(M), s, 0.8 * s / 1.2, 'racket');
  const mac3D = s => prop(buildComputer(M), s, 2.2 * (s / 1.4) ** 2, 'computer');
  const ball3D = s => { const it = prop(buildTennisBall(), s, 0.35 * s, 'ball'); it.body.material = ballMat; return it; };
  function pill3D(s) {
    const r = 0.32 * s, L = 0.9 * s, grp = new THREE.Group();
    const half = (top, mat) => {
      const pts = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r, L / 2 + Math.cos(a) * r)); }
      pts.push(new THREE.Vector2(r, 0));
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 48), mat); if (!top) m.rotation.x = Math.PI; return m;
    };
    grp.add(half(true, M.pillA), half(false, M.pillB));
    const body = new CANNON.Body({ mass: 0.4 * s });
    body.addShape(new CANNON.Cylinder(r, r, L, 12)); body.addShape(new CANNON.Sphere(r), v3(0, L / 2, 0)); body.addShape(new CANNON.Sphere(r), v3(0, -L / 2, 0));
    return add(grp, body, 'pill', 1);
  }

  // ---------- cast ----------
  resize();
  const f = view.W / view.H < 0.8 ? THREE.MathUtils.clamp(view.w / 7.5, 0.6, 0.85) : THREE.MathUtils.clamp(view.w / 13, 0.65, 1);
  const HERO = {
    racket:   { make: () => racket3D(1.2 * f), rot: [0.12, 0, -Math.PI / 2] },          // perfectly level in the headline
    f1:       { make: () => card2D('f1', 2.4 * f), rot: [0, 0, 0] },
    mac:      { make: () => mac3D(1.4 * f), rot: [0, 0, 0] },                          // facing front
    sneakers: { make: () => card2D('sneaker', 2.2 * f), rot: [0, 0, 0] },
    coffee:   { make: () => card2D('coffee', 1.15 * f), rot: [0, 0, 0] },
    cap:      { make: () => cap3D('cream', 0.85 * f), rot: [0.18, -0.7, 0] },
  };
  const heroItems = [];
  slots.forEach((slotEl, i) => {
    const def = HERO[slotEl.dataset.slot]; if (!def) return;
    const it = def.make(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...def.rot));
    const o = it.object; o.quaternion.copy(q); o.position.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o, true), size = box.getSize(new THREE.Vector3());
    it.hero = { el: slotEl, i, q, nat: size, off: box.getCenter(new THREE.Vector3()), anchor: new THREE.Vector3(), scale: 1, hover: 0 };
    it.a = 1;
    heroItems.push(it);
  });
  // Every object appears exactly twice on the page (the headline one + one in the pile),
  // caps three times, each in a different colourway (cream is the headline cap).
  const EXTRAS = [
    () => logo3D(1.05 * f), () => ball3D(1.0 * f), () => cursor(1.3 * f), () => hanger(1.15 * f), () => cap3D('black', 0.8 * f, true),
    () => card2D('lamp', 1.3 * f), () => racket3D(1.05 * f), () => card2D('plant', 1.35 * f), () => mac3D(1.15 * f), () => logo3D(0.75 * f),
    () => card2D('sneaker', 1.8 * f), () => cap3D('forest', 0.75 * f), () => cursor(0.95 * f), () => ball3D(0.85 * f), () => pill3D(0.85 * f),
    () => card2D('lamp', 1.1 * f), () => hanger(0.95 * f), () => card2D('f1', 1.9 * f), () => card2D('plant', 1.15 * f), () => card2D('coffee', 0.95 * f), () => pill3D(0.7 * f),
  ];
  function cursor(s) { return prop(buildCursor(M, cursorGeo), s, 0.5 * s, 'cursor'); }
  function hanger(s) { return prop(buildHanger(M), s, 0.6 * s, 'hanger'); }
  const extraItems = EXTRAS.map((make, j) => { const it = make(); it.j = j; it.appear = 0; return it; });
  const STAGGER = Math.min(0.017, 0.28 / (EXTRAS.length - 1));   // the last object still lands before p = 1

  // chaos resting spots: slot objects gather near the middle, extras fill the frame around them
  function layoutHomes() {
    const pts = [];
    const place = (it, W, H) => {
      let best = null, bestD = -1;
      for (let c = 0; c < 50; c++) {
        const x = rnd(W), y = rnd(H) - view.h * 0.05;
        let d = Infinity; for (const q of pts) d = Math.min(d, Math.hypot((x - q.x) / view.w, (y - q.y) / view.h));
        if (!pts.length) d = 1 - Math.hypot(x / W, y / H);
        if (d > bestD) { bestD = d; best = { x, y }; }
      }
      pts.push(best);
      it.home = new CANNON.Vec3(best.x, best.y, rnd(0.8));
      const [px, py, pz] = (ORIENT[it.kind] || ORIENT.card)();
      it.homeQ = new CANNON.Quaternion().setFromEuler(px, py, pz);
      it.standQ = new CANNON.Quaternion().setFromEuler(-0.08, rnd(0.4), rnd(0.07));
    };
    heroItems.forEach(it => DROP ? place(it, view.w * 0.42, view.h * 0.33) : place(it, view.w * 0.2, view.h * 0.2));
    extraItems.forEach(it => {
      place(it, view.w * 0.42, view.h * 0.33);
      // entry point: straight out past the nearest edge (left/right/top/bottom), well outside the frame
      const nx = it.home.x / (view.w / 2), ny = it.home.y / (view.h / 2), M = 2.6 * f;
      it.spawn = Math.abs(nx) > Math.abs(ny)
        ? new CANNON.Vec3(Math.sign(nx || 1) * (view.w / 2 + M), it.home.y + rnd(view.h * 0.15), it.home.z)
        : new CANNON.Vec3(it.home.x + rnd(view.w * 0.1), Math.sign(ny || 1) * (view.h / 2 + M), it.home.z);
      it.spawnQ = new CANNON.Quaternion().setFromEuler(rnd(1.2), rnd(1.2), rnd(1.2));
    });
  }
  layoutHomes();
  if (DROP) {
    [...heroItems, ...extraItems].forEach(it => { it.body.position.copy(it.home); it.body.quaternion.copy(it.homeQ); it.a = 0; it.appear = 1; });
  } else extraItems.forEach(it => { it.body.position.copy(it.spawn); it.body.collisionResponse = false; it.object.visible = false; });
  // floor + side walls (used by the 'drop' variant: the non-headline objects land on the bottom edge)
  const walls = [];
  function buildWalls() {
    walls.forEach(b => world.removeBody(b)); walls.length = 0;
    if (!DROP) return;
    const W = view.w / 2, H = view.h / 2, T = 3;
    const mk = (hx, hy, hz, x, y, z, material = wallMat) => { const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material }); b.addShape(new CANNON.Box(v3(hx, hy, hz))); b.position.set(x, y, z); world.addBody(b); walls.push(b); };
    mk(W + T, T, 4, 0, -H - T + 0.45, 0, objMat); mk(T, H * 3, 4, -W - T + 0.2, H, 0); mk(T, H * 3, 4, W + T - 0.2, H, 0);   // floor sits a bit above the edge
    mk(W + T, H * 3, T, 0, H, -1.1 - T); mk(W + T, H * 3, T, 0, H, 0.9 + T);
  }
  buildWalls(); addEventListener('resize', () => buildWalls());
  addEventListener('resize', resize);

  // ---------- pointer ----------
  const cursorBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
  cursorBody.addShape(new CANNON.Sphere(0.95 * f)); cursorBody.position.set(999, 999, 0); world.addBody(cursorBody);
  const pointer = { x: -1, y: -1, active: false, world: new THREE.Vector3(999, 999, 0), prev: new THREE.Vector3(999, 999, 0) };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ndc = new THREE.Vector2();
  const hand = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC }); hand.collisionResponse = false; world.addBody(hand);
  let joint = null, chaos = 0;
  const dragPlane = new THREE.Plane();
  const setRay = e => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
  addEventListener('pointermove', e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
    setRay(e); ray.ray.intersectPlane(plane, pointer.world);
    if (joint) { const p = new THREE.Vector3(); if (ray.ray.intersectPlane(dragPlane, p)) hand.position.set(p.x, p.y, p.z); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; });
  el.addEventListener('pointerdown', e => {
    if (chaos < 0.6) return;
    setRay(e);
    const live = items.filter(it => it.object.visible && (it.hero ? it.a < 0.3 : it.appear > 0.7)).map(it => it.object);
    const hit = ray.intersectObjects(live, true)[0];
    if (hit) {
      el.setPointerCapture(e.pointerId);
      const it = hit.object.userData.item, p = hit.point;
      dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), p); hand.position.set(p.x, p.y, p.z);
      it.body.wakeUp();
      joint = new CANNON.PointToPointConstraint(it.body, it.body.pointToLocalFrame(v3(p.x, p.y, p.z)), hand, v3(), 40);
      joint.item = it; it.body.angularDamping = 0.8; world.addConstraint(joint); el.style.cursor = 'grabbing';
    } else { const p = new THREE.Vector3(); ray.ray.intersectPlane(plane, p); burst(p, 1); }
  });
  const release = () => { if (joint) { world.removeConstraint(joint); joint.item.body.angularDamping = 0.4; joint = null; el.style.cursor = ''; } };
  addEventListener('pointerup', release); addEventListener('pointercancel', release);
  function burst(p, strength) {
    for (const it of items) {
      if (it.hero ? it.a > 0.3 : it.appear < 0.7) continue;
      const d = new THREE.Vector3(it.body.position.x - p.x, it.body.position.y - p.y, it.body.position.z - p.z);
      const L = Math.max(d.length(), 0.5); d.normalize();
      const k = strength * 14 * it.body.mass / Math.pow(L, 0.6);
      it.body.applyImpulse(v3(d.x * k, d.y * k, d.z * k * 0.3));
      it.body.angularVelocity.vadd(v3(rnd(3), rnd(3), rnd(3)), it.body.angularVelocity);
    }
  }

  // ---------- scroll choreography ----------
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // scroll progress of the choreography; the page can pass its own (About has more content below the track)
  const progress = getProgress || (() => { const max = document.documentElement.scrollHeight - innerHeight; return max > 0 ? clamp01(scrollY / max) : 0; });
  let lastP = -1, burstArmed = true;
  const tmp = new CANNON.Vec3(), tq = new CANNON.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), hoverQ = new THREE.Quaternion();
  const e1 = new THREE.Euler();

  function styleWords(p) {
    if (Math.abs(p - lastP) < 1e-4) return; lastP = p;
    words.forEach((w, k) => {
      const t = DROP ? 1 - smooth(0.2 + k * 0.008, 0.36 + k * 0.008, p) : smooth(0.015 + k * 0.006, 0.17 + k * 0.006, p);
      w.style.opacity = (1 - t).toFixed(3);
      w.style.transform = t ? `translate3d(0, ${(-t * 0.35).toFixed(3)}em, 0)` : '';
      w.style.filter = t > 0.01 ? `blur(${(t * 8).toFixed(1)}px)` : '';
    });
  }
  function springTo(it, T, TQ, k, kr, extraDamp) {
    const b = it.body, p = b.position, m = b.mass, c = 2 * Math.sqrt(k) * extraDamp;
    b.applyForce(tmp.set(((T.x - p.x) * k - b.velocity.x * c) * m, ((T.y - p.y) * k - b.velocity.y * c) * m, ((T.z - p.z) * k * 1.8 - b.velocity.z * c) * m));
    const q = b.quaternion;
    let dx = TQ.w * -q.x + TQ.x * q.w + TQ.y * -q.z - TQ.z * -q.y;
    let dy = TQ.w * -q.y + TQ.y * q.w + TQ.z * -q.x - TQ.x * -q.z;
    let dz = TQ.w * -q.z + TQ.z * q.w + TQ.x * -q.y - TQ.y * -q.x;
    if (TQ.w * q.w + TQ.x * q.x + TQ.y * q.y + TQ.z * q.z < 0) { dx = -dx; dy = -dy; dz = -dz; }
    const cr = 2 * Math.sqrt(kr) * extraDamp * 0.5;
    b.torque.x += (dx * 2 * kr - b.angularVelocity.x * cr) * m; b.torque.y += (dy * 2 * kr - b.angularVelocity.y * cr) * m; b.torque.z += (dz * 2 * kr - b.angularVelocity.z * cr) * m;
  }

  function update(dt) {
    const p = progress();
    styleWords(p);
    chaos = DROP ? 1 - smooth(0.04, 0.16, p) : smooth(0.34, 0.5, p);
    if (onChaos) onChaos(chaos);
    if (!DROP && chaos > 0.95 && burstArmed && !reduce) { burstArmed = false; burst(new THREE.Vector3(0, -0.2, 0), 0.3); }
    if (p < 0.25) burstArmed = true;
    const pxw = view.h / view.H;

    // slot objects: anchored ⇄ free
    for (const it of heroItems) {
      const h = it.hero, r = h.el.getBoundingClientRect();
      it.a = DROP ? smooth(0.05 + 0.04 * h.i, 0.33 + 0.04 * h.i, p) : 1 - smooth(0.05 + 0.025 * h.i, 0.3 + 0.025 * h.i, p);
      const over = it.a > 0.98 && pointer.active && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
      h.hover += ((over && !reduce ? 1 : 0) - h.hover) * (1 - Math.exp(-dt * 10));
      h.scale = Math.min(r.width * pxw / h.nat.x, r.height * pxw / h.nat.y) * (1 + 0.06 * h.hover);
      hoverQ.setFromEuler(e1.set(-0.12 * h.hover, 0.55 * h.hover, 0));
      qa.copy(hoverQ).multiply(h.q);                          // anchored orientation (+ hover tilt)
      h.anchor.set(((r.left + r.width / 2) - view.W / 2) * pxw, -((r.top + r.height / 2) - view.H / 2) * pxw, 0)
        .sub(h.off.clone().applyQuaternion(hoverQ).multiplyScalar(h.scale));
      const b = it.body;
      if (it.a > 0.999) {
        b.position.set(h.anchor.x, h.anchor.y, h.anchor.z); b.quaternion.set(qa.x, qa.y, qa.z, qa.w);
        b.velocity.setZero(); b.angularVelocity.setZero(); b.collisionResponse = false;
      } else {
        const d = 1 - it.a, dx = d * d * (3 - 2 * d);
        const T = { x: mix(h.anchor.x, it.home.x, dx), y: mix(h.anchor.y, it.home.y, d * d), z: mix(0, it.home.z, d) };
        qb.set(it.homeQ.x, it.homeQ.y, it.homeQ.z, it.homeQ.w).slerp(qa, it.a);
        tq.set(qb.x, qb.y, qb.z, qb.w);
        springTo(it, T, tq, 1.6 + 40 * it.a * it.a, 1.6 + 30 * it.a * it.a, it.a > 0.02 ? 0.35 + 0.65 * it.a : 0);
        setCollide(it, it.a < 0.12);
        if (it.a < 0.02) floatExtras(it, dt);
      }
    }
    // extras ('drop'): float ⇄ fall to the floor
    if (DROP) for (const it of extraItems) {
      // weight fades in one object at a time, only after most of the headline has assembled
      const g = smooth(0.46 + STAGGER * it.j, 0.7 + STAGGER * it.j, p), b = it.body, u = 1 - g;
      it.fall = g;
      setCollide(it, true);
      // while the headline assembles, the weightless pile drifts down out of the text's way
      const low = smooth(0.08, 0.42, p), band = (it.home.y + view.h * 0.4) / (view.h * 0.8);
      const H0 = { x: it.home.x, y: mix(it.home.y, -view.h * 0.5 + 0.9 + band * view.h * 0.38, low), z: it.home.z };
      const flat = it.kind === 'card' || it.kind === 'tall';
      if (flat) {   // cut-outs stand up like cardboard standees instead of lying flat
        qb.set(it.homeQ.x, it.homeQ.y, it.homeQ.z, it.homeQ.w).slerp(qa.set(it.standQ.x, it.standQ.y, it.standQ.z, it.standQ.w), smooth(0, 0.6, g));
        springTo(it, H0, tq.set(qb.x, qb.y, qb.z, qb.w), 1.4 * u * u, 1.6 + 7 * g, g > 0 ? 0.6 : 0);
      } else springTo(it, H0, it.homeQ, 1.4 * u * u, 1.6 * u, 0);
      if (g > 0 && g < 1) {
        b.applyForce(tmp.set(0, -17 * g * g * b.mass, 0));          // gravity ramps up smoothly…
        b.linearDamping = mix(0.75, 0.12, g); b.angularDamping = mix(0.5, 0.25, g);
        const v = b.velocity.length(), lim = 1.2 + 9 * g;          // …and nothing shoots up or down abruptly
        if (v > lim) b.velocity.scale(lim / v, b.velocity);
      } else if (g >= 1) { b.applyForce(tmp.set(0, -17 * b.mass, 0)); b.linearDamping = 0.12; b.angularDamping = 0.25; }
      else { b.linearDamping = 0.55; b.angularDamping = 0.4; }
      floatExtras(it, dt);
    }
    // extras ('scatter'): slide in from the edges / back out
    if (!DROP) for (const it of extraItems) {
      it.appear = smooth(0.16 + 0.013 * it.j, 0.42 + 0.013 * it.j, p);
      const b = it.body, e = 1 - Math.pow(1 - it.appear, 3);
      it.T = { x: mix(it.spawn.x, it.home.x, e), y: mix(it.spawn.y, it.home.y, e), z: it.home.z };
      it.TQ = qb.set(it.spawnQ.x, it.spawnQ.y, it.spawnQ.z, it.spawnQ.w).slerp(qa.set(it.homeQ.x, it.homeQ.y, it.homeQ.z, it.homeQ.w), e).clone();
      if (it.appear < 0.003) {
        it.object.visible = false; b.collisionResponse = false;
        b.position.copy(it.spawn); b.quaternion.copy(it.spawnQ); b.velocity.setZero(); b.angularVelocity.setZero();
        continue;
      }
      it.object.visible = true; setCollide(it, it.appear > 0.8);
      const u = 1 - it.appear;
      tq.set(it.TQ.x, it.TQ.y, it.TQ.z, it.TQ.w);
      springTo(it, it.T, tq, 1.6 + 30 * u * u, 1.6 + 20 * u * u, u > 0.02 ? 0.4 + 0.6 * u : 0);
      floatExtras(it, dt);
    }

    // cursor sphere + soft repulsion (only once the pile is alive)
    const live = chaos > 0.6 && pointer.active && !joint;
    const target = live ? pointer.world : new THREE.Vector3(999, 999, 0);
    const vel = target.clone().sub(pointer.prev).divideScalar(Math.max(dt, 1e-3));
    if (!live || pointer.prev.x > 900) vel.set(0, 0, 0); else if (vel.length() > 30) vel.setLength(30);
    cursorBody.position.set(target.x, target.y, 0); cursorBody.velocity.set(vel.x, vel.y, 0); cursorBody.aabbNeedsUpdate = true;
    pointer.prev.copy(target);
    if (live) for (const it of items) {
      if (!it.body.collisionResponse) continue;
      const q = it.body.position, dx = q.x - target.x, dy = q.y - target.y, d = Math.hypot(dx, dy), R = 1.9 * f;
      if (d < R && d > 1e-3) { const s = (1 - d / R) * 40 * it.body.mass; it.body.applyForce(tmp.set(dx / d * s, dy / d * s, 0)); }
    }

    world.step(1 / 60, dt, 3);
    softClamp(dt);

    // write transforms (slot objects blend the physics pose into the exact slot pose near the end)
    for (const it of items) {
      const o = it.object, b = it.body;
      if (it.hero) {
        const h = it.hero, w = smooth(0.55, 1, it.a);
        qa.setFromEuler(e1.set(-0.12 * h.hover, 0.55 * h.hover, 0)).multiply(h.q);
        o.position.set(mix(b.position.x, h.anchor.x, w), mix(b.position.y, h.anchor.y, w), mix(b.position.z, h.anchor.z, w));
        o.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).slerp(qa, w);
        o.scale.setScalar(mix(it.baseScale, h.scale, smooth(0, 1, it.a)));
      } else {
        const w = it.T ? smooth(0.45, 1, 1 - it.appear) : 0;
        if (w > 0) {
          o.position.set(mix(b.position.x, it.T.x, w), mix(b.position.y, it.T.y, w), mix(b.position.z, it.T.z, w));
          o.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).slerp(it.TQ, w);
        } else { o.position.copy(b.position); o.quaternion.copy(b.quaternion); }
        o.scale.setScalar(it.baseScale);
      }
    }
  }
  // switching collisions on while colliders overlap would fling things across the screen:
  // for a moment after switching on, speeds are clamped so overlaps resolve gently
  function setCollide(it, on) {
    if (on && !it.body.collisionResponse) it.soft = 0.7;
    it.body.collisionResponse = on;
  }
  function softClamp(dt) {
    for (const it of items) {
      if (!(it.soft > 0)) continue;
      it.soft -= dt;
      const b = it.body, v = b.velocity.length(), w = b.angularVelocity.length(), lim = 3.5;
      if (v > lim) b.velocity.scale(lim / v, b.velocity);
      if (w > lim) b.angularVelocity.scale(lim / w, b.angularVelocity);
    }
  }
  function floatExtras(it, dt) {
    const b = it.body, p = b.position;
    if (!reduce) { b.torque.x += rnd(0.075) * b.mass; b.torque.y += rnd(0.075) * b.mass; }
    const W = view.w / 2, H = view.h / 2;
    if (Math.abs(p.x) > W * 3 || Math.abs(p.y) > H * 3) { p.set(it.home.x * 2, it.home.y * 2, it.home.z); b.velocity.scale(0.2, b.velocity); }
    if (b.velocity.length() > 25) b.velocity.scale(25 / b.velocity.length(), b.velocity);
  }

  let last = performance.now(), running = true;
  const loop = now => {
    if (!running) return;
    requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
    update(dt); renderer.render(scene, camera);
  };
  update(1 / 60); renderer.render(scene, camera);
  requestAnimationFrame(loop);
  return {
    burst: () => burst(new THREE.Vector3(), 1.2),
    _advance(seconds) { const n = Math.max(1, Math.round(seconds * 60)); for (let i = 0; i < n; i++) update(1 / 60); renderer.render(scene, camera); },
    _extras() { return extraItems.map(it => ({ k: it.kind, y: +it.body.position.y.toFixed(2), z: +it.body.position.z.toFixed(2), g: +(it.fall || 0).toFixed(2), v: +it.body.velocity.length().toFixed(2) })); },
    _hero() { return heroItems.map(it => ({ a: +it.a.toFixed(3), dx: +(it.object.position.x - it.hero.anchor.x).toFixed(4), dy: +(it.object.position.y - it.hero.anchor.y).toFixed(4) })); },
    destroy() { running = false; renderer.dispose(); el.remove(); },
  };
}
