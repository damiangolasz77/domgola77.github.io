// Physics playground: 3D models + 2D cut-outs floating in zero-g (or falling under gravity),
// pushed by the cursor, draggable, colliding with each other.
// Rendering: three.js (PBR + procedural studio HDR). Physics: cannon-es rigid bodies with
// simplified compound colliders (spheres / boxes / convex hulls) — never the render mesh itself.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { buildCap } from './cap.js';
import { buildRacket, buildHanger, buildComputer, buildCursor, buildTennisBall } from './objects.js';
import { studioEnvironment, chromeEnvironment, materials } from './look.js';
import { loadLogoGeometry, loadCursorGeometry, CARDS } from './assets.js';

const v3 = (x = 0, y = 0, z = 0) => new CANNON.Vec3(x, y, z);
const rnd = a => (Math.random() * 2 - 1) * a;
const sgn = () => (Math.random() < .5 ? -1 : 1);

// resting orientation per kind [pitch, yaw, roll] → "presentable" 3/4 views, never edge-on
const ORIENT = {
  cap:      () => [0.3 + rnd(0.15), sgn() * (0.45 + Math.random() * 0.55), rnd(0.15)],
  racket:   () => [rnd(0.3), rnd(0.45), sgn() * (0.35 + Math.random() * 0.55)],
  computer: () => [rnd(0.12) + 0.05, sgn() * (0.15 + Math.random() * 0.4), rnd(0.08)],
  hanger:   () => [rnd(0.2), rnd(0.5), rnd(0.35)],
  cursor:   () => [0.2 + rnd(0.3), rnd(0.5), rnd(0.45)],
  ball:     () => [rnd(3), rnd(3), rnd(3)],
  logo:     () => [rnd(0.35), rnd(0.6), rnd(0.3)],
  card:     () => [rnd(0.25), rnd(0.35), rnd(0.3)],
  tall:     () => [rnd(0.2), rnd(0.35), rnd(0.18)],
  pill:     () => [rnd(3), rnd(3), rnd(3)],
};

export async function mountPlayground(container, opts = {}) {
  const o = Object.assign({ background: 0xf3f3f1, mode: 'float', pixelRatio: Math.min(devicePixelRatio || 1, 2),
    capText: null }, opts);   // optional 3-line embroidery on the caps

  // ---------- renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(o.pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(o.background);
  scene.environment = studioEnvironment(renderer);
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(4, 2, -5); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const VIEW_H = 8;                                    // world units visible vertically at z = 0
  const view = { w: 16, h: VIEW_H, f: 1 };

  const M = materials();
  M.chrome.envMap = chromeEnvironment(renderer); M.chrome.envMapIntensity = 1.0;
  const [logoGeo, cursorGeo] = await Promise.all([loadLogoGeometry(), loadCursorGeometry()]);

  // ---------- physics world ----------
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

  const items = [];
  world.allowSleep = false;
  function add(mesh, body, kind) {
    body.linearDamping = 0.55; body.angularDamping = 0.4;
    body.sleepSpeedLimit = 0.25; body.sleepTimeLimit = 0.5;
    if (!body.material) body.material = objMat;
    world.addBody(body); scene.add(mesh);
    const it = { mesh, body, kind };
    mesh.traverse(m => { m.userData.item = it; });
    items.push(it);
    return it;
  }
  // generic: collider description (unit scale) → compound rigid body at scale s
  function bodyFrom(colliders, s, mass) {
    const body = new CANNON.Body({ mass });
    for (const c of colliders) {
      const at = v3(c.at[0] * s, c.at[1] * s, c.at[2] * s);
      if (c.t === 'sphere') body.addShape(new CANNON.Sphere(c.r * s), at);
      else if (c.t === 'box') {
        const q = new CANNON.Quaternion(); q.setFromEuler(0, 0, c.rz || 0);
        body.addShape(new CANNON.Box(v3(c.half[0] * s, c.half[1] * s, c.half[2] * s)), at, q);
      } else if (c.t === 'convex') { const pr = prism(c.pts.map(([x, y]) => [x * s, y * s]), c.half * s); body.addShape(pr.shape, at.vadd(pr.offset)); }
    }
    return body;
  }
  function prism(poly, half) {                         // convex polygon extruded ±half in z, centred on its centroid
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    poly = poly.map(([x, y]) => [x - cx, y - cy]);
    let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) poly = [...poly].reverse();
    const n = poly.length, verts = [], faces = [];
    poly.forEach(([x, y]) => verts.push(v3(x, y, half)));
    poly.forEach(([x, y]) => verts.push(v3(x, y, -half)));
    faces.push([...Array(n).keys()]);
    faces.push([...Array(n).keys()].map(i => n + (n - 1 - i)));
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([i, n + i, n + j, j]); }
    return { shape: new CANNON.ConvexPolyhedron({ vertices: verts, faces }), offset: v3(cx, cy, 0) };
  }
  function prop({ object, colliders }, s, mass, kind) {
    object.scale.multiplyScalar(s);
    return add(object, bodyFrom(colliders, s, mass), kind);
  }

  // --- 3D: chrome logo (collider = sphere chain along the stroke) ---
  const logoSpheres = logoGeo.userData.spheres.filter((q, i) => q[2] > 0.075 || i % 3 === 0);
  function logo3D(s) {
    const mesh = new THREE.Mesh(logoGeo, M.chrome); mesh.scale.setScalar(s);
    const body = new CANNON.Body({ mass: 1.2 * s * s });
    for (const [x, y, r] of logoSpheres) body.addShape(new CANNON.Sphere(r * s * 1.12), v3(x * s, y * s, 0));
    return add(mesh, body, 'logo');
  }

  // --- 2D: photo cut-outs (plane + alpha; collider = extruded convex hull(s) of the alpha) ---
  const cardTex = {};
  await Promise.all(Object.entries(CARDS).map(async ([k, c]) => {
    const t = await new THREE.TextureLoader().loadAsync(c.uri); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cardTex[k] = t;
  }));
  function card2D(key, width) {
    const c = CARDS[key], aspect = c.h / c.w;
    const mat = new THREE.MeshBasicMaterial({ map: cardTex[key], side: THREE.DoubleSide, alphaTest: 0.45, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * aspect), mat);
    const body = new CANNON.Body({ mass: 0.5 * width * width * aspect });
    for (const hull of c.hulls) { const pr = prism(hull.map(([x, y]) => [x * width, y * width]), 0.04); body.addShape(pr.shape, pr.offset); }
    return add(mesh, body, aspect > 1.2 ? 'tall' : 'card');
  }

  // --- 3D props ---
  const cap3D = (colorway, s, badge = false) => {
    const grp = buildCap({ colorway, text: o.capText, badgeGeometry: badge ? logoGeo : null, badgeMaterial: M.chrome, metalMaterial: M.chrome });
    const c = grp.userData.collider;
    return prop({ object: grp, colliders: [{ t: 'sphere', r: c.sphere.r, at: c.sphere.at.toArray() }, { t: 'box', half: c.box.half.toArray(), at: c.box.at.toArray() }] }, s, 1.0 * s * s, 'cap');
  };
  const racket3D = s => prop(buildRacket(M), s, 0.8 * s, 'racket');
  const hanger3D = s => prop(buildHanger(M), s, 0.6 * s, 'hanger');
  const computer3D = s => prop(buildComputer(M), s, 2.2 * s * s, 'computer');
  const cursor3D = s => prop(buildCursor(M, cursorGeo), s, 0.5 * s, 'cursor');
  const ball3D = s => { const it = prop(buildTennisBall(), s, 0.35 * s, 'ball'); it.body.material = ballMat; return it; };
  function pill3D(s) {
    const r = 0.32 * s, L = 0.9 * s, grp = new THREE.Group();
    const half = (top, mat) => {
      const pts = [];
      for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r, L / 2 + Math.cos(a) * r)); }
      pts.push(new THREE.Vector2(r, 0));
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 48), mat); if (!top) m.rotation.x = Math.PI; return m;
    };
    grp.add(half(true, M.pillA), half(false, M.pillB));
    const body = new CANNON.Body({ mass: 0.4 * s });
    body.addShape(new CANNON.Cylinder(r, r, L, 12));
    body.addShape(new CANNON.Sphere(r), v3(0, L / 2, 0)); body.addShape(new CANNON.Sphere(r), v3(0, -L / 2, 0));
    return add(grp, body, 'pill');
  }

  // ---------- the cast ----------
  function populate() {
    const f = view.f, narrow = view.w < 8;
    // most important first: on narrow screens only the first part of the list is used
    const cast = [
      () => cap3D('cream', 0.85 * f), () => computer3D(1.5 * f), () => racket3D(1.25 * f), () => card2D('f1', 2.6 * f),
      () => logo3D(1.05 * f), () => ball3D(1.0 * f), () => cursor3D(1.3 * f), () => hanger3D(1.15 * f),
      () => card2D('sneaker', 2.3 * f), () => card2D('coffee', 1.2 * f), () => card2D('lamp', 1.3 * f), () => card2D('plant', 1.35 * f),
      () => ball3D(0.9 * f), () => cap3D('black', 0.8 * f, true),
      () => logo3D(0.75 * f), () => cursor3D(0.95 * f), () => racket3D(1.05 * f), () => card2D('f1', 2.0 * f), () => ball3D(0.85 * f),
      () => cap3D('forest', 0.75 * f), () => card2D('sneaker', 1.9 * f), () => hanger3D(0.95 * f), () => card2D('coffee', 0.95 * f),
      () => pill3D(0.85 * f), () => logo3D(0.6 * f), () => pill3D(0.7 * f),
    ];
    cast.slice(0, narrow ? 14 : cast.length).forEach(make => make());
    layoutHomes();
    scatter(true);
  }
  // every object gets its own resting spot spread over the frame (best-candidate sampling),
  // so the pile fills the screen and drifts back after being pushed
  function layoutHomes() {
    const pts = [], W = view.w * 0.44, H = view.h * 0.40;
    const order = [...items].sort(() => Math.random() - .5);
    for (const it of order) {
      let best = null, bestD = -1;
      for (let c = 0; c < 40; c++) {
        const x = (Math.random() * 2 - 1) * W, y = (Math.random() * 2 - 1) * H;
        let d = Infinity; for (const q of pts) d = Math.min(d, Math.hypot((x - q.x) / W, (y - q.y) / H));
        if (!pts.length) d = 1 - Math.hypot(x / W, y / H);
        if (d > bestD) { bestD = d; best = { x, y }; }
      }
      pts.push(best);
      it.home = new CANNON.Vec3(best.x, best.y, (Math.random() - .5) * 1.6);
      const [px, py, pz] = (ORIENT[it.kind] || ORIENT.card)();
      it.homeQ = new CANNON.Quaternion().setFromEuler(px, py, pz);
    }
  }
  function scatter(fromOutside) {
    items.forEach((it, i) => {
      const a = (i / items.length) * Math.PI * 2 + Math.random() * 0.4;
      const R = fromOutside ? Math.max(view.w, view.h) * 0.75 : 1 + Math.random() * 2;
      it.body.position.set(Math.cos(a) * R, Math.sin(a) * R * 0.7, (Math.random() - 0.5) * 2);
      it.body.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      it.body.velocity.set(-Math.cos(a) * 6, -Math.sin(a) * 4, 0);
      it.body.angularVelocity.set((Math.random() - .5) * 3, (Math.random() - .5) * 3, (Math.random() - .5) * 3);
    });
  }

  // ---------- walls (gravity mode) ----------
  const walls = [];
  function buildWalls() {
    walls.forEach(b => world.removeBody(b)); walls.length = 0;
    const W = view.w / 2, H = view.h / 2, T = 2;
    const mk = (hx, hy, hz, x, y, z) => { const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: objMat }); b.addShape(new CANNON.Box(v3(hx, hy, hz))); b.position.set(x, y, z); walls.push(b); };
    mk(W + T, T, 4, 0, -H - T + 0.9, 0);      // floor (sits above the control bar)
    mk(W + T, T, 4, 0, H + T + 6, 0);         // ceiling (high, objects can be tossed up)
    mk(T, H + 8, 4, -W - T, 0, 0); mk(T, H + 8, 4, W + T, 0, 0);
    mk(W + T, H + 8, T, 0, 0, -2.2 - T); mk(W + T, H + 8, T, 0, 0, 2.2 + T);
    if (mode === 'gravity') walls.forEach(b => world.addBody(b));
  }

  // ---------- cursor: kinematic sphere that shoves things ----------
  const cursor = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
  cursor.addShape(new CANNON.Sphere(1));
  cursor.position.set(999, 999, 0); world.addBody(cursor);
  const pointer = { ndc: new THREE.Vector2(), active: false, world: new THREE.Vector3(999, 999, 0), prev: new THREE.Vector3(999, 999, 0) };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  // drag joint
  const hand = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC }); hand.collisionResponse = false; world.addBody(hand);
  let joint = null, dragPlane = new THREE.Plane();

  function setPointer(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer.ndc, camera);
  }
  const el = renderer.domElement;
  el.addEventListener('pointermove', e => {
    setPointer(e); pointer.active = true;
    ray.ray.intersectPlane(plane, pointer.world);
    if (joint) { const p = new THREE.Vector3(); if (ray.ray.intersectPlane(dragPlane, p)) hand.position.set(p.x, p.y, p.z); }
  });
  el.addEventListener('pointerleave', () => { pointer.active = false; });
  el.addEventListener('pointerdown', e => {
    setPointer(e); el.setPointerCapture(e.pointerId);
    const hits = ray.intersectObjects(items.map(i => i.mesh), true);
    if (hits.length) {
      const it = hits[0].object.userData.item, p = hits[0].point;
      dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), p);
      hand.position.set(p.x, p.y, p.z);
      const local = it.body.pointToLocalFrame(v3(p.x, p.y, p.z));
      it.body.wakeUp();
      joint = new CANNON.PointToPointConstraint(it.body, local, hand, v3(), 40);
      world.addConstraint(joint);
      it.body.angularDamping = 0.8;
      joint.item = it;
      el.style.cursor = 'grabbing';
    } else {
      const p = new THREE.Vector3(); ray.ray.intersectPlane(plane, p); burst(p, 1);
    }
  });
  const release = () => {
    if (joint) { world.removeConstraint(joint); joint.item.body.angularDamping = 0.35; joint = null; el.style.cursor = ''; }
  };
  el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release);

  function burst(p = new THREE.Vector3(), strength = 1) {
    items.forEach(it => {
      it.body.wakeUp();
      const d = new THREE.Vector3(it.body.position.x - p.x, it.body.position.y - p.y, it.body.position.z - p.z);
      const L = Math.max(d.length(), 0.5); d.normalize();
      const k = strength * 14 * it.body.mass / Math.pow(L, 0.6);
      it.body.applyImpulse(v3(d.x * k, d.y * k, d.z * k * 0.3));
      it.body.angularVelocity.vadd(v3((Math.random() - .5) * 6, (Math.random() - .5) * 6, (Math.random() - .5) * 6), it.body.angularVelocity);
    });
  }

  // ---------- modes ----------
  let mode = o.mode;
  function setMode(m) {
    mode = m;
    world.gravity.set(0, m === 'gravity' ? -16 : 0, 0);
    world.allowSleep = m === 'gravity';                     // resting pile sleeps → almost free
    walls.forEach(b => world.removeBody(b));
    if (m === 'gravity') walls.forEach(b => world.addBody(b));
    items.forEach(it => { it.body.linearDamping = m === 'gravity' ? 0.05 : 0.55; it.body.wakeUp(); });
  }

  // ---------- layout ----------
  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vh = camera.aspect < 0.8 ? VIEW_H * 1.2 : VIEW_H;       // portrait: show a bit more height
    camera.position.set(0, 0, vh / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    view.h = vh; view.w = vh * camera.aspect;
    view.f = camera.aspect < 0.8 ? THREE.MathUtils.clamp(view.w / 7.5, 0.6, 0.85) : THREE.MathUtils.clamp(view.w / 13, 0.65, 1);
    buildWalls();
    if (items.length) layoutHomes();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  populate();
  setMode(mode);

  // ---------- simulation ----------
  const tmp = new CANNON.Vec3();
  function forces(dt) {
    const cr = 0.95 * view.f;
    // cursor collider follows the pointer; its velocity transfers momentum on contact
    const target = pointer.active && !joint ? pointer.world : new THREE.Vector3(999, 999, 0);
    let vel = target.clone().sub(pointer.prev).divideScalar(Math.max(dt, 1e-3));
    if (target.x > 900 || pointer.prev.x > 900) vel.set(0, 0, 0);
    else if (vel.length() > 30) vel.setLength(30);
    if (cursor.shapes[0].radius !== cr) { cursor.shapes[0].radius = cr; cursor.shapes[0].updateBoundingSphereRadius(); cursor.updateBoundingRadius(); }
    cursor.aabbNeedsUpdate = true;
    cursor.position.set(target.x, target.y, 0); cursor.velocity.set(vel.x, vel.y, 0);
    pointer.prev.copy(target);

    for (const it of items) {
      const b = it.body, p = b.position;
      if (mode === 'float') {
        // spring towards its own resting spot (soft in-plane, firmer in depth)
        const k = 1.6, kz = 3.0, h = it.home;
        tmp.set((h.x - p.x) * k * b.mass, (h.y - p.y) * k * b.mass, (h.z - p.z) * kz * b.mass);
        b.applyForce(tmp);
        // tiny drift keeps the pile alive
        b.torque.x += (Math.random() - .5) * 0.15 * b.mass; b.torque.y += (Math.random() - .5) * 0.15 * b.mass;
        // slow pull back to its resting orientation (after the cursor knocks it around)
        const q = b.quaternion, hq = it.homeQ;
        let dx = hq.w * -q.x + hq.x * q.w + hq.y * -q.z - hq.z * -q.y;
        let dy = hq.w * -q.y + hq.y * q.w + hq.z * -q.x - hq.x * -q.z;
        let dz = hq.w * -q.z + hq.z * q.w + hq.x * -q.y - hq.y * -q.x;
        const dw = hq.w * q.w + hq.x * q.x + hq.y * q.y + hq.z * q.z;
        if (dw < 0) { dx = -dx; dy = -dy; dz = -dz; }
        const kr = 1.6 * b.mass;
        b.torque.x += dx * 2 * kr; b.torque.y += dy * 2 * kr; b.torque.z += dz * 2 * kr;
      }
      // soft repulsion field around the cursor (feels like a hand moving through the pile)
      if (pointer.active && !joint) {
        const dx = p.x - target.x, dy = p.y - target.y, d = Math.hypot(dx, dy), R = cr * 2.0;
        if (d < R && d > 1e-3) {
          if (b.sleepState) b.wakeUp();
          const s = (1 - d / R) * 40 * b.mass;
          b.applyForce(tmp.set(dx / d * s, dy / d * s, 0));
        }
      }
      // anything that escaped the box (fast throw, mode switch mid-flight) re-enters from the top
      const W = view.w / 2, H = view.h / 2;
      if (mode === 'gravity' && (Math.abs(p.x) > W + 0.5 || p.y < -H - 1 || Math.abs(p.z) > 2.4)) {
        b.position.set((Math.random() - .5) * W * 1.4, H + 1.5 + Math.random() * 2, (Math.random() - .5) * 1.5);
        b.velocity.set(0, 0, 0); b.wakeUp();
      }
      if (mode === 'float' && (Math.abs(p.x) > W * 3 || Math.abs(p.y) > H * 3)) {
        b.position.set(it.home.x * 2, it.home.y * 2, it.home.z); b.velocity.scale(0.2, b.velocity);
      }
      // keep everything inside a sane volume
      if (Math.abs(p.z) > 3) b.velocity.z *= 0.9;
      if (b.velocity.length() > 25) b.velocity.scale(25 / b.velocity.length(), b.velocity);
    }
  }

  let last = performance.now(), running = true, t0 = last;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
    forces(dt);
    world.step(1 / 60, dt, 3);
    for (const it of items) { it.mesh.position.copy(it.body.position); it.mesh.quaternion.copy(it.body.quaternion); }
    const t = (now - t0) / 1000;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    setMode, burst: () => burst(new THREE.Vector3(), 1.4), reset: () => scatter(true),
    get mode() { return mode; },
    // deterministic stepping for screenshots/tests
    _advance(seconds) { const n = Math.round(seconds * 60); for (let i = 0; i < n; i++) { forces(1 / 60); world.step(1 / 60); } for (const it of items) { it.mesh.position.copy(it.body.position); it.mesh.quaternion.copy(it.body.quaternion); } renderer.render(scene, camera); },
    _profile(n = 120) {
      const t = performance.now(); for (let i = 0; i < n; i++) { forces(1 / 60); world.step(1 / 60); }
      const per = (performance.now() - t) / n;
      const shapes = items.map(it => it.kind + ':' + it.body.shapes.length).join(' ');
      return { msPerStep: per.toFixed(2), contacts: world.contacts.length, shapes };
    },
    _screen(i) { const v = items[i].mesh.position.clone().project(camera), r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + (v.x * .5 + .5) * r.width, y: r.top + (-v.y * .5 + .5) * r.height, kind: items[i].kind }; },
    _pos(i) { const p = items[i].body.position; return [p.x, p.y, p.z].map(v => +v.toFixed(2)); },
    _pointer(x, y) { pointer.active = true; pointer.world.set(x, y, 0); },
    destroy() { running = false; renderer.dispose(); el.remove(); },
  };
}
