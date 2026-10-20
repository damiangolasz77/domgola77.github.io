// Procedural 3D props for the physics pile. Every builder returns { object, colliders } in its own
// unit scale; `colliders` is a list of simple shapes (sphere / box / convex prism / cylinder) that the
// physics side turns into a compound rigid body.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import LOGO_SVG from '../../assets/logo.svg?raw';

const LOGO_D = LOGO_SVG.match(/ d="([^"]+)"/)[1];
const LOGO_BOX = { x: 76, y: 56, w: 310, h: 353 };          // bounds of the logo path (svg units)
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// centre an object on its bounding box and move the collider description with it
function finish(object, colliders) {
  const box = new THREE.Box3().setFromObject(object), c = box.getCenter(new THREE.Vector3());
  object.children.forEach(ch => ch.position.sub(c));
  colliders.forEach(k => { k.at = [k.at[0] - c.x, k.at[1] - c.y, k.at[2] - c.z]; });
  return { object, colliders };
}
const ellipsePts = (a, b, cy, n = 96) => [...Array(n)].map((_, i) => { const t = i / n * Math.PI * 2; return new THREE.Vector2(a * Math.cos(t), cy + b * Math.sin(t)); });

// =================================================================== tennis racket
export function buildRacket(M) {
  const g = new THREE.Group();
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0xf5f3ec, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
  const green = new THREE.MeshPhysicalMaterial({ color: 0x1d4a33, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
  const woodTex = (() => {                                   // lacquered laminate: fine streaks
    const c = canvas(512, 512), x = c.getContext('2d');
    x.fillStyle = '#7b4a22'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * 512, a = Math.random() * 0.18;
      x.strokeStyle = Math.random() < .5 ? `rgba(40,18,6,${a})` : `rgba(200,140,80,${a})`;
      x.lineWidth = 0.6 + Math.random() * 2.2; x.beginPath(); x.moveTo(0, y);
      for (let k = 0; k <= 8; k++) x.lineTo(k * 64, y + Math.sin(k * 0.9 + i) * 3);
      x.stroke();
    }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
  })();
  const wood = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });

  // head: outer white shell + inner wood ring, extruded with soft bevels
  const A = 0.5, B = 0.64, CY = 0.72, W = 0.06, D = 0.085;
  const ring = (a0, b0, a1, b1, mat, depth, bev) => {
    const s = new THREE.Shape(ellipsePts(a0, b0, CY, 128));
    s.holes.push(new THREE.Path(ellipsePts(a1, b1, CY, 128).reverse()));
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 4, curveSegments: 128 });
    geo.translate(0, 0, -depth / 2);
    return new THREE.Mesh(geo, mat);
  };
  g.add(ring(A - 0.008, B - 0.008, A - W * 0.45, B - W * 0.45, lacquer, D - 0.02, 0.01));
  g.add(ring(A - W * 0.45, B - W * 0.45, A - W, B - W, wood, D - 0.026, 0.008));
  // pinstripe around the outside of the frame
  const stripePts = ellipsePts(A + 0.0015, B + 0.0015, CY, 200).map(p => new THREE.Vector3(p.x, p.y, 0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripePts, true), 400, 0.0065, 6, true), green));

  // strings: two alpha-tested layers (mains / crosses) with the logo stencilled in black
  const ai = A - W, bi = B - W, CW = 760, CH = Math.round(760 * bi / ai);
  const stringLayer = (vertical) => {
    const c = canvas(CW, CH), x = c.getContext('2d');
    const n = vertical ? 16 : 19, len = vertical ? CW : CH;
    for (let i = 0; i < n; i++) {
      const p = (i + 0.5) / n * len;
      for (const [w, col] of [[8, '#cfc8b6'], [5, '#f6f2e8'], [2, '#ffffff']]) {
        x.strokeStyle = col; x.lineWidth = w; x.beginPath();
        if (vertical) { x.moveTo(p, 0); x.lineTo(p, CH); } else { x.moveTo(0, p); x.lineTo(CW, p); }
        x.stroke();
      }
    }
    x.globalCompositeOperation = 'source-atop';               // stencil only lands on the strings
    const k = CH * 0.6 / LOGO_BOX.h;
    x.setTransform(k, 0, 0, k, CW / 2 - (LOGO_BOX.x + LOGO_BOX.w / 2) * k, CH * 0.46 - (LOGO_BOX.y + LOGO_BOX.h / 2) * k);
    const logo = new Path2D(LOGO_D);
    x.fillStyle = '#121212'; x.fill(logo, 'evenodd');
    x.strokeStyle = '#121212'; x.lineWidth = 16; x.lineJoin = 'round'; x.stroke(logo);   // bolder stencil reads better on a string bed
    const t = tex(c); return t;
  };
  const bedGeo = () => {
    const geo = new THREE.ShapeGeometry(new THREE.Shape(ellipsePts(ai + 0.004, bi + 0.004, CY, 96)), 1);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + ai) / (2 * ai), (p.getY(i) - CY + bi) / (2 * bi));
    return geo;
  };
  for (const [vertical, z] of [[true, 0.005], [false, -0.005]]) {
    const st = stringLayer(vertical); st.premultiplyAlpha = true;   // premultiplied mips → the stencil survives at small sizes
    const m = new THREE.Mesh(bedGeo(), new THREE.MeshStandardMaterial({ map: st, transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.45 }));
    m.position.z = z; g.add(m);
  }

  // throat: two arms + a wood wedge
  const tA = -Math.PI / 2 - 0.66, tB = -Math.PI / 2 + 0.66;
  const pA = new THREE.Vector3(A * Math.cos(tA), CY + B * Math.sin(tA), 0), pB = new THREE.Vector3(A * Math.cos(tB), CY + B * Math.sin(tB), 0);
  const S = new THREE.Vector3(0, -0.3, 0);
  for (const [p, sx] of [[pA, -1], [pB, 1]]) {
    const curve = new THREE.CatmullRomCurve3([p.clone().add(new THREE.Vector3(-sx * 0.01, 0.02, 0)), new THREE.Vector3(sx * 0.15, -0.04, 0), S.clone().add(new THREE.Vector3(sx * 0.012, 0, 0))]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.034, 12, false), lacquer); arm.scale.z = 1.15; g.add(arm);
  }
  const wedge = new THREE.Shape();
  wedge.moveTo(pA.x * 0.9, pA.y);
  for (let i = 0; i <= 24; i++) { const t = tA + (tB - tA) * i / 24; wedge.lineTo(A * 0.97 * Math.cos(t), CY + B * 0.985 * Math.sin(t)); }
  wedge.lineTo(pB.x * 0.9, pB.y); wedge.quadraticCurveTo(0.13, -0.05, 0.012, -0.24); wedge.lineTo(-0.012, -0.24); wedge.quadraticCurveTo(-0.13, -0.05, pA.x * 0.9, pA.y);
  const wg = new THREE.ExtrudeGeometry(wedge, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2 });
  wg.translate(0, 0, -0.02); g.add(new THREE.Mesh(wg, wood));

  // shaft, collar, grip, butt cap
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.06, 0.26, 8), lacquer); shaft.position.y = -0.42; shaft.rotation.y = Math.PI / 8; shaft.scale.z = 0.85; g.add(shaft);
  for (const z of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.25, 0.004), green); st.position.set(0, -0.42, z * 0.047); g.add(st); }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.03, 8), green); collar.position.y = -0.565; collar.rotation.y = Math.PI / 8; collar.scale.z = 0.85; g.add(collar);
  const gripTex = (() => {
    const c = canvas(256, 1024), x = c.getContext('2d');
    x.fillStyle = '#f7f6f2'; x.fillRect(0, 0, 256, 1024);
    x.strokeStyle = 'rgba(0,0,0,0.13)'; x.lineWidth = 2;
    for (let i = -8; i < 40; i++) { x.beginPath(); x.moveTo(0, i * 34); x.lineTo(256, i * 34 + 110); x.stroke(); }   // spiral overlap
    x.fillStyle = 'rgba(40,40,40,0.55)';
    for (let r = 0; r < 64; r++) for (let k = 0; k < 9; k++) { x.beginPath(); x.arc((k + (r % 2) * 0.5) * 29 + 8, r * 16 + 8, 2.2, 0, 7); x.fill(); }   // perforation
    const t = tex(c); return t;
  })();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.07, 0.7, 8, 1), new THREE.MeshPhysicalMaterial({ map: gripTex, roughness: 0.8, sheen: 0.4 }));
  grip.position.y = -0.93; grip.rotation.y = Math.PI / 8; grip.scale.z = 0.85; g.add(grip);
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.07, 0.05, 8), lacquer); butt.position.y = -1.305; butt.rotation.y = Math.PI / 8; butt.scale.z = 0.86; g.add(butt);
  const buttBand = new THREE.Mesh(new THREE.CylinderGeometry(0.077, 0.077, 0.012, 8), green); buttBand.position.y = -1.29; buttBand.rotation.y = Math.PI / 8; buttBand.scale.z = 0.86; g.add(buttBand);

  const head = ellipsePts(A + 0.01, B + 0.01, CY, 16).map(p => [p.x, p.y]);
  return finish(g, [
    { t: 'convex', pts: head, half: D / 2 + 0.01, at: [0, 0, 0] },
    { t: 'box', half: [0.2, 0.2, 0.045], at: [0, -0.02, 0] },
    { t: 'box', half: [0.075, 0.52, 0.06], at: [0, -0.8, 0] },
  ]);
}

// =================================================================== chrome clothes hanger
function fillet(pts, radii, n = 10) {                          // round every corner of a closed polyline
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const d1 = a.clone().sub(p).normalize(), d2 = b.clone().sub(p).normalize();
    const ang = Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1)), t = radii[i] / Math.tan(ang / 2);
    const p1 = p.clone().addScaledVector(d1, t), p2 = p.clone().addScaledVector(d2, t);
    for (let k = 0; k <= n; k++) { const u = k / n; out.push(p1.clone().multiplyScalar((1 - u) ** 2).addScaledVector(p, 2 * u * (1 - u)).addScaledVector(p2, u * u)); }
  }
  return out;
}
export function buildHanger(M) {
  const g = new THREE.Group(), R = 0.03;
  const loop = fillet([new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(-1.05, -0.02, 0), new THREE.Vector3(1.05, -0.02, 0)], [0.05, 0.09, 0.09], 14);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true, 'centripetal'), 500, R, 14, true), M.chrome));
  // neck + hook
  const hook = [new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0.01, 0.62, 0), new THREE.Vector3(0.04, 0.74, 0)];
  const C = new THREE.Vector3(-0.05, 0.92, 0), r = 0.19;
  for (let a = -60; a <= 228; a += 12) hook.push(new THREE.Vector3(C.x + r * Math.cos(a * Math.PI / 180), C.y + r * Math.sin(a * Math.PI / 180), 0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hook, false, 'centripetal'), 200, R * 0.95, 14, false), M.chrome));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(R * 0.95, 14, 10), M.chrome); tip.position.copy(hook[hook.length - 1]); g.add(tip);
  // twisted wire wrapped round the neck
  const helix = [];
  for (let i = 0; i <= 90; i++) { const t = i / 90, a = t * Math.PI * 2 * 3.5; helix.push(new THREE.Vector3(0.006 * t + Math.cos(a) * R * 1.05, 0.5 + t * 0.17, Math.sin(a) * R * 1.05)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 220, R * 0.62, 10, false), M.chrome));
  const sh = Math.atan2(0.52, 1.05), L = Math.hypot(1.05, 0.52) / 2;
  return finish(g, [
    { t: 'box', half: [1.08, 0.045, 0.045], at: [0, -0.02, 0] },
    { t: 'box', half: [L, 0.045, 0.045], at: [-0.525, 0.24, 0], rz: sh },
    { t: 'box', half: [L, 0.045, 0.045], at: [0.525, 0.24, 0], rz: -sh },
    { t: 'box', half: [0.045, 0.13, 0.045], at: [0.02, 0.62, 0] },
    { t: 'sphere', r: 0.21, at: [-0.05, 0.92, 0] },
  ]);
}

// =================================================================== retro computer
export function buildComputer(M) {
  const g = new THREE.Group();
  const plastic = new THREE.MeshPhysicalMaterial({ color: 0xe4d3a6, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.25, sheenColor: new THREE.Color(0xfff6dc) });
  const plasticDark = plastic.clone(); plasticDark.color = new THREE.Color(0xd3c194);
  const ink = new THREE.MeshStandardMaterial({ color: 0x1b1b1a, roughness: 0.6 });
  const W = 1.0, H = 1.02, DPT = 1.0, CY = 0.14;
  const upper = new THREE.Mesh(new RoundedBoxGeometry(W, H, DPT, 6, 0.07), plastic); upper.position.set(0, CY, 0); g.add(upper);
  const base = new THREE.Mesh(new RoundedBoxGeometry(W * 0.985, 0.28, DPT * 0.985, 6, 0.05), plastic); base.position.set(0, -0.515, -0.005); g.add(base);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.006, DPT * 0.96), new THREE.MeshStandardMaterial({ color: 0x6b5f45, roughness: 0.7 })); seam.position.set(0, -0.375, 0); g.add(seam);

  // front bezel with the screen opening
  const rrect = (w, h, r, cx = 0, cy = 0) => {
    const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  };
  const BEV = 0.014;
  const front = rrect(W - 0.03 - 2 * BEV, H - 0.03 - 2 * BEV, 0.05, 0, CY);
  const hole = rrect(0.76, 0.54, 0.04, 0, 0.37); front.holes.push(hole);
  const bezelGeo = new THREE.ExtrudeGeometry(front, { depth: 0.016, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 5, curveSegments: 12 });
  const bezel = new THREE.Mesh(bezelGeo, plastic); bezel.position.z = DPT / 2 - 0.004; g.add(bezel);
  const recess = new THREE.Mesh(new THREE.ShapeGeometry(rrect(0.8, 0.58, 0.05, 0, 0.37)), plasticDark); recess.position.z = DPT / 2 + 0.001; g.add(recess);
  const border = new THREE.Mesh(new THREE.ShapeGeometry(rrect(0.66, 0.46, 0.045, 0, 0.37)), ink); border.position.z = DPT / 2 + 0.003; g.add(border);

  // CRT glass: bulged, pale grey phosphor with a pixel smiley
  const scr = canvas(600, 400), x = scr.getContext('2d');
  const grd = x.createRadialGradient(300, 190, 40, 300, 200, 360); grd.addColorStop(0, '#cfcfca'); grd.addColorStop(1, '#9d9d98');
  x.fillStyle = grd; x.fillRect(0, 0, 600, 400);
  x.fillStyle = 'rgba(0,0,0,0.035)'; for (let y = 0; y < 400; y += 3) x.fillRect(0, y, 600, 1);
  const P = 16, face = ['..X......X..', '..X......X..', '..X......X..', '............', '............', 'X..........X', '.X........X.', '..XXXXXXXX..'];
  x.fillStyle = '#262624';
  face.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') x.fillRect(300 - 6 * P + i * P + 1, 120 + j * P + 1, P - 2, P - 2); }));
  const screenTex = tex(scr);
  const glassGeo = new THREE.PlaneGeometry(0.6, 0.4, 40, 30), gp = glassGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) { const u = gp.getX(i) / 0.3, v = gp.getY(i) / 0.2; gp.setZ(i, 0.024 * (1 - u * u * 0.85) * (1 - v * v * 0.85)); }
  glassGeo.computeVertexNormals();
  const glass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({ map: screenTex, emissiveMap: screenTex, emissive: 0x5a5a58, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.02 }));
  glass.position.set(0, 0.37, DPT / 2 + 0.004); g.add(glass);

  // floppy slot, rainbow badge, dial, port, feet
  const FZ = DPT / 2 + 0.03;
  const slotHouse = new THREE.Mesh(new THREE.ShapeGeometry(rrect(0.13, 0.065, 0.012, 0.335, -0.045)), plasticDark); slotHouse.position.z = FZ - 0.0005; g.add(slotHouse);
  const slot = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.018, 0.01, 2, 0.004), ink); slot.position.set(0.19, -0.045, FZ); g.add(slot);
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.006), new THREE.MeshStandardMaterial({ color: 0xd2414d, roughness: 0.4 })); tab.position.set(0.345, -0.058, FZ + 0.002); g.add(tab);
  const badge = canvas(128, 128), bx = badge.getContext('2d');
  bx.beginPath(); bx.roundRect ? bx.roundRect(4, 4, 120, 120, 14) : bx.rect(4, 4, 120, 120); bx.clip();
  ['#e8473d', '#f08a2c', '#f5cf33', '#5ab94a', '#3a8ad8', '#8a4fc7'].forEach((c, i) => { bx.fillStyle = c; bx.fillRect(0, i * 128 / 6, 128, 128 / 6 + 1); });
  const badgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshPhysicalMaterial({ map: tex(badge), transparent: true, roughness: 0.25, clearcoat: 1 }));
  badgeMesh.position.set(-0.35, -0.2, FZ + 0.001); g.add(badgeMesh);
  const dialGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.04, 64, 1), dp = dialGeo.attributes.position;
  for (let i = 0; i < dp.count; i++) { const a = Math.atan2(dp.getZ(i), dp.getX(i)), r = Math.hypot(dp.getX(i), dp.getZ(i)); if (r > 0.05) { const k = 1 + 0.06 * Math.sign(Math.sin(a * 24)); dp.setX(i, dp.getX(i) * k); dp.setZ(i, dp.getZ(i) * k); } }
  dialGeo.computeVertexNormals();
  const dial = new THREE.Mesh(dialGeo, plasticDark); dial.rotation.z = Math.PI / 2; dial.position.set(-0.3, -0.39, DPT / 2 - 0.02); g.add(dial);
  const port = new THREE.Mesh(new THREE.ShapeGeometry(rrect(0.13, 0.11, 0.02, 0.32, -0.53)), plasticDark); port.position.z = DPT / 2 + 0.001; g.add(port);
  const jack = new THREE.Mesh(new THREE.ShapeGeometry(rrect(0.035, 0.045, 0.006, 0.32, -0.53)), ink); jack.position.z = DPT / 2 + 0.002; g.add(jack);
  for (const k of [-1, 1]) { const b = new THREE.Mesh(new THREE.ShapeGeometry(rrect(0.11, 0.035, 0.01, k * 0.07 + 0.03, -0.42)), plasticDark); b.position.z = DPT / 2 + 0.001; g.add(b); }
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16), ink); f.position.set(fx * 0.4, -0.665, fz * 0.4); g.add(f); }
  return finish(g, [{ t: 'box', half: [0.5, 0.67, 0.52], at: [0, -0.01, 0.01] }]);
}

// =================================================================== chrome cursor
export function buildCursor(M, geo) {
  // inflated (Poisson) pointer, same family as the logo; collider = 2D convex hull of the mesh
  const g = new THREE.Group(), k = 0.6;
  const m = new THREE.Mesh(geo, M.chrome); m.scale.set(k, k, k); g.add(m);
  const p = geo.attributes.position, pts = [];
  for (let i = 0; i < p.count; i += 7) pts.push([p.getX(i) * k, p.getY(i) * k]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of pts.reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  let hull = lo.slice(0, -1).concat(hi.slice(0, -1));
  while (hull.length > 10) {                                 // drop the least important vertex
    let best = 0, bestA = Infinity;
    hull.forEach((q, i) => { const a = Math.abs(cross(hull[(i - 1 + hull.length) % hull.length], q, hull[(i + 1) % hull.length])); if (a < bestA) { bestA = a; best = i; } });
    hull.splice(best, 1);
  }
  geo.computeBoundingBox();
  return finish(g, [{ t: 'convex', pts: hull, half: geo.boundingBox.max.z * k + 0.01, at: [0, 0, 0] }]);
}

// =================================================================== tennis ball (felt via shell fur)
let ballKit = null;
function tennisBallKit() {
  if (ballKit) return ballKit;
  const TW = 2048, TH = 1024;
  // seam curve on the unit sphere
  const seam = []; const bS = 0.27, aS = 1 - bS;
  for (let i = 0; i < 1400; i++) { const t = i / 1400 * Math.PI * 2;
    seam.push(new THREE.Vector3(aS * Math.cos(t) + bS * Math.cos(3 * t), 2 * Math.sqrt(aS * bS) * Math.sin(2 * t), aS * Math.sin(t) - bS * Math.sin(3 * t)).normalize()); }   // keeps the seam away from the texture poles
  // three.js sphere uv: u = lon, v = lat (y up). point → (u, v) in canvas px
  const toUV = p => [((Math.atan2(p.z, -p.x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * TW, (1 - (Math.acos(THREE.MathUtils.clamp(p.y, -1, 1)) / Math.PI)) * TH];
  const stampSeam = (ctx, w) => {
    ctx.beginPath();
    for (let i = 0; i < seam.length; i += 1) {
      const p = seam[i], [u, v] = toUV(p), lat = Math.asin(THREE.MathUtils.clamp(p.y, -1, 1)), rx = w / Math.max(Math.cos(lat), 0.2);
      for (const du of [-TW, 0, TW]) { if (u + du < -rx || u + du > TW + rx) continue; ctx.moveTo(u + du + rx, TH - v); ctx.ellipse(u + du, TH - v, rx, w, 0, 0, Math.PI * 2); }
    }
    ctx.fill();
  };
  // smooth value noise (upscaled random grid) → felt clumps / mottling
  const smooth = (gw, gh) => {
    const small = canvas(gw, gh), sx = small.getContext('2d'), sd = sx.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) { const v = Math.random() * 255; sd.data[i * 4] = sd.data[i * 4 + 1] = sd.data[i * 4 + 2] = v; sd.data[i * 4 + 3] = 255; }
    sx.putImageData(sd, 0, 0);
    const big = canvas(TW, TH), bx = big.getContext('2d'); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
    bx.drawImage(small, 0, 0, TW, TH);
    const d = bx.getImageData(0, 0, TW, TH).data, out = new Float32Array(TW * TH);
    for (let i = 0; i < TW * TH; i++) out[i] = d[i * 4] / 255;
    return out;
  };
  const n1 = smooth(48, 24), n2 = smooth(220, 110);
  const mask = canvas(TW, TH), mx = mask.getContext('2d'); mx.fillStyle = '#000'; mx.fillRect(0, 0, TW, TH);
  mx.fillStyle = '#fff'; stampSeam(mx, 15);
  const sharp = mx.getImageData(0, 0, TW, TH).data;                    // the rubber line itself
  const soft = canvas(TW, TH), so = soft.getContext('2d'); so.filter = 'blur(14px)'; so.drawImage(mask, 0, 0);
  const sm = so.getImageData(0, 0, TW, TH).data;                       // groove / fur fall-off around it
  const col = canvas(TW, TH), cx = col.getContext('2d'), ci = cx.createImageData(TW, TH);
  const fur = canvas(TW, TH), fx = fur.getContext('2d'), fd = fx.createImageData(TW, TH);
  const nrm = canvas(TW, TH), nx = nrm.getContext('2d'), nd = nx.createImageData(TW, TH);
  const H = new Float32Array(TW * TH);
  for (let i = 0; i < TW * TH; i++) {
    const clump = 0.55 * n1[i] + 0.45 * n2[i], r = Math.random(), seamA = sharp[i * 4] / 255, near = sm[i * 4] / 255;
    // felt: optic yellow-green, slightly darker at the fibre roots, cloudy variation
    const k = 0.8 + 0.14 * clump + 0.26 * (r - 0.5);
    let R = 150 * k, G = 172 * k, B = 12 * k;
    R = R + (205 - R) * seamA; G = G + (203 - G) * seamA; B = B + (192 - B) * seamA;    // rubber seam
    const sh = 1 - 0.38 * near * (1 - seamA); R *= sh; G *= sh; B *= sh;   // shadowed groove edge
    ci.data[i * 4] = R; ci.data[i * 4 + 1] = G; ci.data[i * 4 + 2] = B; ci.data[i * 4 + 3] = 255;
    // fibres: per-texel strands, longer where the felt clumps, none on/near the seam
    const len = Math.pow(r, 0.9) * (0.6 + 0.55 * clump) * Math.max(0, 1 - near * 1.3);
    fd.data[i * 4] = fd.data[i * 4 + 1] = fd.data[i * 4 + 2] = Math.min(255, len * 255); fd.data[i * 4 + 3] = 255;
    H[i] = 0.5 * r + 0.6 * clump - 2.2 * near;
  }
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const i = y * TW + x, hx = H[y * TW + (x + 1) % TW] - H[y * TW + (x + TW - 1) % TW], hy = H[Math.min(y + 1, TH - 1) * TW + x] - H[Math.max(y - 1, 0) * TW + x];
    const ax = -hx * 1.2, ay = hy * 1.2, l = Math.hypot(ax, ay, 1);
    nd.data[i * 4] = (ax / l * .5 + .5) * 255; nd.data[i * 4 + 1] = (ay / l * .5 + .5) * 255; nd.data[i * 4 + 2] = (1 / l * .5 + .5) * 255; nd.data[i * 4 + 3] = 255;
  }
  cx.putImageData(ci, 0, 0); nx.putImageData(nd, 0, 0);
  const FW = TW / 2, FH = TH / 2, furH = canvas(FW, FH), fh = furH.getContext('2d'), fhd = fh.createImageData(FW, FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const o = (y * FW + x) * 4, src = ((y * 2) * TW + x * 2) * 4;
    fhd.data[o] = fhd.data[o + 1] = fhd.data[o + 2] = fd.data[src]; fhd.data[o + 3] = 255; }
  fh.putImageData(fhd, 0, 0);
  const furTex = new THREE.CanvasTexture(furH); furTex.magFilter = THREE.NearestFilter; furTex.minFilter = THREE.NearestFilter; furTex.generateMipmaps = false;   // fibres stay fibres at any distance
  const normalTex = new THREE.CanvasTexture(nrm); normalTex.anisotropy = 4;
  // tone mapping off on the felt: ACES pulls optic yellow towards pastel; albedo is chosen so lit felt lands near the real colour
  const base = new THREE.MeshPhysicalMaterial({ map: tex(col), normalMap: normalTex, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1,
    sheen: 0.5, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xc4e030), toneMapped: false });
  // fur: 26 shells merged into ONE mesh; a shader picks per-fibre visibility by shell height,
  // darkens the roots, lightens the tips and leans the fibres a little → real fuzz, one draw call
  const SHELLS = 26, LEN = 0.11, sg = new THREE.SphereGeometry(1, 52, 34);
  const nv = sg.attributes.position.count, pos = new Float32Array(nv * 3 * SHELLS), fnrm = new Float32Array(nv * 3 * SHELLS), uvs = new Float32Array(nv * 2 * SHELLS), shell = new Float32Array(nv * SHELLS);
  const sidx = sg.index.array, idx = new Uint32Array(sidx.length * SHELLS);
  for (let k = 0; k < SHELLS; k++) {
    const t = (k + 1) / SHELLS, sc = 1 + LEN * t;
    for (let i = 0; i < nv; i++) {
      for (let c = 0; c < 3; c++) { pos[(k * nv + i) * 3 + c] = sg.attributes.position.array[i * 3 + c] * sc; fnrm[(k * nv + i) * 3 + c] = sg.attributes.normal.array[i * 3 + c]; }
      uvs[(k * nv + i) * 2] = sg.attributes.uv.array[i * 2]; uvs[(k * nv + i) * 2 + 1] = sg.attributes.uv.array[i * 2 + 1]; shell[k * nv + i] = t;
    }
    for (let j = 0; j < sidx.length; j++) idx[k * sidx.length + j] = sidx[j] + k * nv;
  }
  const furGeo = new THREE.BufferGeometry();
  furGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); furGeo.setAttribute('normal', new THREE.BufferAttribute(fnrm, 3));
  furGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); furGeo.setAttribute('shell', new THREE.BufferAttribute(shell, 1));
  furGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  const root = new THREE.Color().setRGB(88 / 255, 104 / 255, 4 / 255, THREE.SRGBColorSpace);
  const tip = new THREE.Color().setRGB(214 / 255, 232 / 255, 66 / 255, THREE.SRGBColorSpace);
  const furMat = new THREE.MeshStandardMaterial({ alphaMap: furTex, roughness: 1, toneMapped: false, alphaToCoverage: true });
  furMat.onBeforeCompile = sh => {
    sh.uniforms.rootCol = { value: root }; sh.uniforms.tipCol = { value: tip };
    sh.vertexShader = 'attribute float shell;\nvarying float vShell;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvShell = shell;');
    sh.fragmentShader = 'varying float vShell;\nuniform vec3 rootCol, tipCol;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(rootCol, tipCol, pow(vShell, 0.75));')
      .replace('#include <alphamap_fragment>', `
        float fib = textureLod(alphaMap, vAlphaMapUv + vec2(vShell * 0.0035, vShell * 0.002), 0.0).g;
        float cut = 0.04 + vShell * 0.92;
        if (fib < cut) discard;
        diffuseColor.a = clamp((fib - cut) * 12.0 + 0.35, 0.0, 1.0);`);
  };
  ballKit = { base, furMat, furGeo, geo: new THREE.SphereGeometry(1, 72, 48) };
  return ballKit;
}
export function buildTennisBall() {
  const k = tennisBallKit(), R = 0.4, g = new THREE.Group();
  const core = new THREE.Mesh(k.geo, k.base); core.scale.setScalar(R); g.add(core);
  const fur = new THREE.Mesh(k.furGeo, k.furMat); fur.scale.setScalar(R); g.add(fur);
  return { object: g, colliders: [{ t: 'sphere', r: R * 1.05, at: [0, 0, 0] }] };
}
