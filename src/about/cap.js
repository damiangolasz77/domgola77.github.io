// Everyday 6-panel baseball cap: soft structured crown, rounded pre-curved brim with binding and
// rows of stitching, top button, embroidered eyelets, back opening with strap + buckle, and a
// raised front embroidery (own text, Helvetica-style). Optional chrome logo badge on the brim.
import * as THREE from 'three';

const RX = 1.0, RY = 1.06, RZ = 1.1;           // crown half-width, height, half-depth (front = +z)
const L = 0.78;                                 // brim reach in front of the crown
const THICK = 0.03;                             // brim thickness
const TILT = 0.24, DROOP = 0.85;                // brim angles down + bends down towards its corners
const ARCH_V = 0.76;                            // back opening starts at this height (v)

const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- fabric toolkit: cotton twill grain, mottling, height → normal ----------
const rEff = (RX + RZ) / 2;
function smoothNoise(W, H, gw, gh) {                     // value noise, upscaled with bilinear smoothing
  const small = document.createElement('canvas'); small.width = gw; small.height = gh;
  const sx = small.getContext('2d'), d = sx.createImageData(gw, gh);
  for (let i = 0; i < gw * gh; i++) { const v = Math.random() * 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
  sx.putImageData(d, 0, 0);
  const big = document.createElement('canvas'); big.width = W; big.height = H;
  const bx = big.getContext('2d'); bx.imageSmoothingQuality = 'high'; bx.drawImage(small, 0, 0, W, H);
  const px = bx.getImageData(0, 0, W, H).data, out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = px[i * 4] / 255 - 0.5;
  return out;
}
function normalTexture(Hf, W, H, strength, wrapX) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const xl = wrapX ? (x + W - 1) % W : Math.max(x - 1, 0), xr = wrapX ? (x + 1) % W : Math.min(x + 1, W - 1);
    const hx = Hf[y * W + xr] - Hf[y * W + xl], hy = Hf[Math.min(y + 1, H - 1) * W + x] - Hf[Math.max(y - 1, 0) * W + x];
    const nx = -hx * strength, ny = hy * strength, l = Math.hypot(nx, ny, 1), i = (y * W + x) * 4;
    img.data[i] = (nx / l * .5 + .5) * 255; img.data[i + 1] = (ny / l * .5 + .5) * 255; img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; if (wrapX) t.wrapS = THREE.RepeatWrapping;
  return t;
}
const grain = (x, y, r) => 0.07 * Math.sin((x + y) * 1.26) + 0.05 * Math.sin((x - y * 0.5) * 0.35 + r * 2) + 0.16 * (r - 0.5);   // twill ribs + slub + fibre noise
function colorTexture(W, H, base, mul, thread, mask, wrapX) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  const b = new THREE.Color(base), t = new THREE.Color(thread);
  const toS = v => Math.pow(Math.min(Math.max(v, 0), 1), 1 / 2.2) * 255;
  const bl = [b.r, b.g, b.b].map(v => Math.pow(v, 2.2)), tl = [t.r, t.g, t.b].map(v => Math.pow(v, 2.2));
  for (let i = 0; i < W * H; i++) {
    const m = mask ? mask[i] : 0, k = mul[i];
    for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] = toS(bl[ch] * k * (1 - m) + tl[ch] * (0.9 + 0.2 * (k - 1)) * m);
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; if (wrapX) tx.wrapS = THREE.RepeatWrapping;
  return tx;
}
const smooth01 = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };

// ---------- crown ----------
// u: around (0.5 = front centre), v: 0 at the button → 1 at the bottom edge
function crownPoint(u, v, out = new THREE.Vector3()) {
  const phi = (u - 0.5) * Math.PI * 2, th = v * Math.PI / 2;
  const s = Math.sin(th), c = Math.cos(th);
  const front = Math.pow(Math.max(Math.cos(phi), 0), 2);
  let x = RX * s * Math.sin(phi);
  let z = RZ * s * Math.cos(phi) + 0.05 * front * s;               // fuller, structured front panels
  let y = RY * Math.pow(c, 0.82) + 0.05 * front * Math.sin(th * 2);
  y += 0.07 * (1 - Math.cos(phi)) / 2 * Math.pow(v, 4);            // bottom edge rises towards the back
  return out.set(x, y, z);
}
function crownNormal(u, v) {
  const e = 1e-3, p = crownPoint(u, v);
  const du = crownPoint(u + e, v).sub(p), dv = crownPoint(u, Math.min(v + e, 1)).sub(p);
  return new THREE.Vector3().crossVectors(dv, du).normalize();
}
const archHalf = v => v <= ARCH_V ? 0 : 0.36 * Math.sqrt((v - ARCH_V) / (1 - ARCH_V));   // half-angle of the back opening
const seamArc = (u, v) => {                           // arc distance to the nearest panel seam (+ which seam)
  const k = Math.round(u * 6), du = u * 6 - k;
  return { d: Math.abs(du) / 6 * 2 * Math.PI * rEff * Math.max(Math.sin(v * Math.PI / 2), 0.02), k: (k + 6) % 6 };
};
function crownGeometry(SU = 384, SV = 72) {
  const pos = [], uv = [], idx = [], p = new THREE.Vector3();
  for (let j = 0; j <= SV; j++) for (let i = 0; i <= SU; i++) {
    const u = i / SU, v = 0.004 + (1 - 0.004) * j / SV;
    crownPoint(u, v, p);
    const { d, k } = seamArc(u, v);                    // panels puff out, seams pull the cloth in
    if (!(k === 0 && v > ARCH_V)) p.addScaledVector(crownNormal(u, v), -0.009 * Math.exp(-(((d / 0.04)) ** 2)) * smooth01(0.02, 0.12, v));
    pos.push(p.x, p.y, p.z); uv.push(u, 1 - v);
  }
  for (let j = 0; j < SV; j++) for (let i = 0; i < SU; i++) {
    const uc = (i + .5) / SU, vc = 0.004 + (1 - 0.004) * (j + .5) / SV;
    if (Math.abs(wrapPi((uc - 0.5) * Math.PI * 2 - Math.PI)) < archHalf(vc)) continue;   // back opening
    const a = j * (SU + 1) + i, b = a + 1, c = a + SU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const texCache = new Map();
const cached = (key, make) => { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); };
function crownMaps() {
  const W = 2048, H = 1024, Hf = new Float32Array(W * H), mul = new Float32Array(W * H), mask = new Float32Array(W * H);
  const n1 = smoothNoise(W, H, 40, 20), n2 = smoothNoise(W, H, 180, 90);
  for (let y = 0; y < H; y++) {
    const v = (y + .5) / H, sinT = Math.max(Math.sin(v * Math.PI / 2), 0.02), pxPerArc = W / (2 * Math.PI * rEff * sinT);
    for (let x = 0; x < W; x++) {
      const i = y * W + x, u = (x + .5) / W, r = Math.random();
      const { d, k } = seamArc(u, v);
      const live = !(k === 0 && v > ARCH_V - 0.01) && v > 0.03;
      let h = grain(x, y, r) + 0.6 * n1[i] + 0.25 * n2[i], m = 0, ao = 0;
      if (live) {
        const valley = Math.exp(-(((d / 0.03)) ** 2));
        h += -1.1 * valley + 0.55 * Math.exp(-(((d / 0.0065)) ** 2)) + 0.12 * Math.sin(y * 0.7) * Math.exp(-(((d / 0.02)) ** 2));   // fold, ridge, pucker
        ao += 0.16 * valley;
        if (k !== 3) for (const o of [0.018, 0.036]) {                   // double top-stitch both sides (front seam hidden)
          const dp = Math.abs(d - o) * pxPerArc, dash = smooth01(0, 1, Math.min(y % 10, 7 - (y % 10)) + 0.5);
          const cov = smooth01(1.5, 0.5, dp) * dash;
          if (cov > 0) { m = Math.max(m, cov); h -= 0.5 * smooth01(2.6, 0.4, dp); ao += 0.05 * smooth01(2.5, 0.5, dp); }
        }
      }
      const sv = Math.abs(v - 0.972) * H;                                 // sweatband stitching
      if (sv < 2.5) { const cov = smooth01(1.5, 0.5, sv) * smooth01(0, 1, Math.min(x % 11, 7 - (x % 11)) + 0.5); m = Math.max(m, cov); h -= 0.4 * smooth01(2.5, 0.4, sv); }
      const ue = u * 6 - Math.floor(u * 6) - 0.5, ex = ue / 6 * W, ey = (v - 0.2) * H;   // embroidered eyelets
      const er = Math.hypot(ex * sinT / Math.sin(0.2 * Math.PI / 2) * 0.62, ey);
      if (er < 13) { const ring = smooth01(3, 1.5, Math.abs(er - 8.5)); m = Math.max(m, ring); h += 0.8 * ring; if (er < 5) { ao += 0.7; h -= 1; } }
      Hf[i] = h; mask[i] = m;
      mul[i] = 1 + 0.07 * n1[i] + 0.05 * n2[i] + 0.05 * (r - 0.5) - ao;
    }
  }
  return { W, H, mul, mask, normal: normalTexture(Hf, W, H, 2.2, true) };
}

function tubeAlong(points, r, mat, closed = false, seg = 120) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), seg, r, 8, closed), mat);
}
function seamsAndBindings(mat) {
  const grp = new THREE.Group();
  // binding along the bottom edge (skips the opening) and around the arch
  const bottom = [];
  const a0 = archHalf(1);
  for (let i = 0; i <= 160; i++) {
    const phi = Math.PI + a0 + (Math.PI * 2 - 2 * a0) * i / 160;
    bottom.push(crownPoint(phi / (Math.PI * 2) + 0.5, 1));
  }
  grp.add(tubeAlong(bottom, 0.014, mat, false, 240));
  const arch = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60 * 2 - 1, v = ARCH_V + (1 - ARCH_V) * t * t, side = Math.sign(t) || 1;
    const phi = Math.PI + side * Math.max(archHalf(v), 0.0001);
    arch.push(crownPoint(phi / (Math.PI * 2) + 0.5, Math.min(v, 1)).multiplyScalar(1.001));
  }
  grp.add(tubeAlong(arch, 0.016, mat, false, 120));
  return grp;
}
function backStrap(fabricMat, metalMat) {
  const grp = new THREE.Group(), w = archHalf(1) + 0.08;
  const pos = [], idx = [], N = 40;
  for (let i = 0; i <= N; i++) for (const v of [0.9, 0.985]) {
    const phi = Math.PI - w + 2 * w * i / N;
    const p = crownPoint(phi / (Math.PI * 2) + 0.5, v).multiplyScalar(0.985);
    pos.push(p.x, p.y, p.z);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = fabricMat.clone(); m.side = THREE.DoubleSide; m.map = null; m.normalMap = null;
  grp.add(new THREE.Mesh(g, m));
  const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 10, 4), metalMat);
  const bp = crownPoint(0, 0.94);                  // u = 0 → back centre
  buckle.position.copy(bp).multiplyScalar(0.99); buckle.rotation.z = Math.PI / 4; buckle.scale.set(1.5, 1, 1);
  buckle.lookAt(bp.clone().multiplyScalar(2)); buckle.rotateZ(Math.PI / 4);
  grp.add(buckle);
  return grp;
}

// ---------- brim ----------
const BRIM_N = 2.7;
const brimTaper = s => 1 - Math.pow(Math.abs(s), 10);                                // superellipse exponent → a soft "D", not a point
function brimPoint(s, t, out = new THREE.Vector3()) {
  const th = s * Math.PI / 2;                      // attachment angle on the crown (−90° … +90°)
  const inner = crownPoint(th / (Math.PI * 2) + 0.5, 1).multiplyScalar(0.995);
  const sx = Math.sign(Math.sin(th)) * Math.pow(Math.abs(Math.sin(th)), 2 / BRIM_N);
  const cz = Math.pow(Math.abs(Math.cos(th)), 2 / BRIM_N);
  const ox = RX * 1.03 * sx, oz = (RZ + L) * cz;
  const tp = brimTaper(s);                         // ends blend smoothly into the crown (no tab / step)
  const x = inner.x + (ox - inner.x) * t * tp, z = inner.z + (oz - inner.z) * t * tp;
  const d = t * tp * Math.hypot(ox - inner.x, oz - inner.z);
  const y = inner.y - d * (TILT + DROOP * Math.pow(x / RX, 2));
  return out.set(x, y, z);
}
const brimLen = s => brimPoint(s, 0).distanceTo(brimPoint(s, 1));
function brimGeometry(top, SS = 128, ST = 28) {
  const pos = [], uv = [], idx = [], p = new THREE.Vector3();
  for (let j = 0; j <= ST; j++) for (let i = 0; i <= SS; i++) {
    const s = i / SS * 2 - 1, t = j / ST;
    brimPoint(s, t, p); if (!top) p.y -= THICK * brimTaper(s);
    pos.push(p.x, p.y, p.z); uv.push(i / SS, (1 - t) * brimLen(s) / L);   // v = distance from the outer edge
  }
  for (let j = 0; j < ST; j++) for (let i = 0; i < SS; i++) {
    const a = j * (SS + 1) + i, b = a + 1, c = a + SS + 1, d = c + 1;
    if (top) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function brimMaps() {
  const W = 2048, H = 512, Hf = new Float32Array(W * H), mul = new Float32Array(W * H), mask = new Float32Array(W * H);
  const n1 = smoothNoise(W, H, 60, 16), n2 = smoothNoise(W, H, 240, 60);
  for (let y = 0; y < H; y++) {
    const dist = 1 - (y + .5) / H;                                      // distance from the outer edge / L
    for (let x = 0; x < W; x++) {
      const i = y * W + x, r = Math.random();
      let h = grain(x, y, r) + 0.6 * n1[i] + 0.25 * n2[i], m = 0, ao = 0;
      for (let k = 0; k < 8; k++) {                                     // rows of stitching → slightly quilted cloth
        const dp = Math.abs(dist - (0.05 + k * 0.05)) * H;
        if (dp < 3) {
          const cov = smooth01(1.5, 0.5, dp) * smooth01(0, 1, Math.min(x % 13, 8 - (x % 13)) + 0.5);
          m = Math.max(m, cov); h -= 0.7 * smooth01(3, 0.4, dp); ao += 0.06 * smooth01(3, 0.5, dp);
        }
      }
      if (dist < 0.42) h += 0.18 * Math.cos(((dist - 0.05) / 0.05) * Math.PI * 2);
      Hf[i] = h; mask[i] = m;
      mul[i] = 1 + 0.07 * n1[i] + 0.05 * n2[i] + 0.05 * (r - 0.5) - ao;
    }
  }
  return { W, H, mul, mask, normal: normalTexture(Hf, W, H, 2.2, false) };
}
function grainNormalTile() {
  const S = 512, Hf = new Float32Array(S * S), n = smoothNoise(S, S, 16, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) Hf[y * S + x] = grain(x, y, Math.random()) + 0.5 * n[y * S + x];
  const t = normalTexture(Hf, S, S, 2.2, true); t.wrapT = THREE.RepeatWrapping; return t;
}
function brimBinding(mat) {
  const N = 220, RS = 10, pts = [], rad = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N * 2 - 1, tp = brimTaper(s);
    pts.push(brimPoint(s, 1).add(new THREE.Vector3(0, -THICK * tp / 2, 0))); rad.push((THICK * tp / 2 + 0.006) * Math.sqrt(tp) + 0.0005);
  }
  const curve = new THREE.CatmullRomCurve3(pts), fr = curve.computeFrenetFrames(N, false);
  const pos = [], nrm = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N);
    for (let j = 0; j <= RS; j++) {
      const a = j / RS * Math.PI * 2, n = fr.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i], Math.sin(a));
      pos.push(p.x + n.x * rad[i], p.y + n.y * rad[i], p.z + n.z * rad[i]); nrm.push(n.x, n.y, n.z); uv.push(i / N * 30, j / RS);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < RS; j++) { const a = i * (RS + 1) + j, b = a + RS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return new THREE.Mesh(g, mat);
}

// ---------- raised front embroidery (decal hugging the front panels) ----------
const FONT = '"Helvetica Neue", Helvetica, Arial, "Nimbus Sans", "Liberation Sans", sans-serif';
function embroidery(lines, thread) {
  const U0 = 0.5 - 0.15, U1 = 0.5 + 0.15, V0 = 0.25, V1 = 0.76;
  const CW = 1536, CH = 768;
  // world size of the patch → compensate the horizontal squeeze so letters keep their proportions
  let hgt = 0; for (let i = 0; i < 50; i++) hgt += crownPoint(0.5, V0 + (V1 - V0) * i / 50).distanceTo(crownPoint(0.5, V0 + (V1 - V0) * (i + 1) / 50));
  const widthAt = v => (U1 - U0) * 2 * Math.PI * RX * Math.sin(v * Math.PI / 2);
  const pxPerUnitY = CH / hgt;
  const mask = document.createElement('canvas'); mask.width = CW; mask.height = CH;
  const m = mask.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, CW, CH); m.fillStyle = '#fff'; m.textAlign = 'center'; m.textBaseline = 'alphabetic';
  const spec = [
    { text: lines[0], size: 0.135, weight: 700, y: 0.27, track: -0.003 },
    { text: lines[1], size: 0.190, weight: 700, y: 0.57, track: 0.004 },
    { text: lines[2], size: 0.180, weight: 700, y: 0.86, track: 0.004 },
  ];
  for (const l of spec) {
    if (!l.text) continue;
    const v = V0 + (V1 - V0) * l.y, sx = (CW / widthAt(v)) / pxPerUnitY;
    m.setTransform(sx, 0, 0, 1, CW / 2, l.y * CH);
    m.font = `${l.weight} ${l.size * pxPerUnitY}px ${FONT}`;
    if ('letterSpacing' in m) m.letterSpacing = `${l.track * pxPerUnitY}px`;
    m.fillText(l.text, 0, 0);
  }
  m.setTransform(1, 0, 0, 1, 0, 0);
  const src = m.getImageData(0, 0, CW, CH).data, A = new Float32Array(CW * CH);
  for (let i = 0; i < CW * CH; i++) A[i] = src[i * 4] / 255;
  // height: rounded satin-stitch profile + fine diagonal stitches
  const blur = (a, r) => {
    const o = new Float32Array(a.length), t = new Float32Array(a.length);
    for (let y = 0; y < CH; y++) { let s = 0; for (let x = -r; x < CW + r; x++) { if (x + r < CW) s += a[y * CW + x + r]; if (x - r - 1 >= 0) s -= a[y * CW + x - r - 1]; if (x >= 0 && x < CW) t[y * CW + x] = s / (2 * r + 1); } }
    for (let x = 0; x < CW; x++) { let s = 0; for (let y = -r; y < CH + r; y++) { if (y + r < CH) s += t[(y + r) * CW + x]; if (y - r - 1 >= 0) s -= t[(y - r - 1) * CW + x]; if (y >= 0 && y < CH) o[y * CW + x] = s / (2 * r + 1); } }
    return o;
  };
  const B = blur(blur(A, 3), 2), Hh = new Float32Array(CW * CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const i = y * CW + x, stitch = 0.5 + 0.5 * Math.sin((x * 0.82 + y * 0.57) * 1.25);
    Hh[i] = Math.sqrt(Math.max(B[i], 0)) * 1.0 + A[i] * stitch * 0.25;
  }
  const col = document.createElement('canvas'); col.width = CW; col.height = CH;
  const nrm = document.createElement('canvas'); nrm.width = CW; nrm.height = CH;
  const cg = col.getContext('2d'), ng = nrm.getContext('2d');
  const ci = cg.createImageData(CW, CH), ni = ng.createImageData(CW, CH);
  const tc = new THREE.Color(thread);
  const tr = Math.pow(tc.r, 1 / 2.2) * 255, tgc = Math.pow(tc.g, 1 / 2.2) * 255, tb = Math.pow(tc.b, 1 / 2.2) * 255;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const i = y * CW + x, o = i * 4;
    const hx = Hh[y * CW + Math.min(x + 1, CW - 1)] - Hh[y * CW + Math.max(x - 1, 0)];
    const hy = Hh[Math.min(y + 1, CH - 1) * CW + x] - Hh[Math.max(y - 1, 0) * CW + x];
    const nx = -hx * 3, ny = hy * 3, l = Math.hypot(nx, ny, 1);
    ni.data[o] = (nx / l * .5 + .5) * 255; ni.data[o + 1] = (ny / l * .5 + .5) * 255; ni.data[o + 2] = (1 / l * .5 + .5) * 255; ni.data[o + 3] = 255;
    const shade = 0.85 + 0.15 * (0.5 + 0.5 * Math.sin((x * 0.82 + y * 0.57) * 1.25));
    ci.data[o] = tr * shade; ci.data[o + 1] = tgc * shade; ci.data[o + 2] = tb * shade; ci.data[o + 3] = Math.min(1, A[i] * 1.15) * 255;
  }
  cg.putImageData(ci, 0, 0); ng.putImageData(ni, 0, 0);
  const map = new THREE.CanvasTexture(col); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const nmap = new THREE.CanvasTexture(nrm); nmap.anisotropy = 8;
  const mat = new THREE.MeshPhysicalMaterial({ map, normalMap: nmap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.75,
    sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(thread).lerp(new THREE.Color(0xffffff), 0.2), alphaTest: 0.5, alphaToCoverage: true });
  // patch geometry following the crown, lifted a hair off the fabric
  const SU = 64, SV = 40, pos = [], uv = [], idx = [];
  for (let j = 0; j <= SV; j++) for (let i = 0; i <= SU; i++) {
    const u = U0 + (U1 - U0) * i / SU, v = V0 + (V1 - V0) * j / SV;
    const p = crownPoint(u, v).addScaledVector(crownNormal(u, v), 0.008);
    pos.push(p.x, p.y, p.z); uv.push(i / SU, 1 - j / SV);
  }
  for (let j = 0; j < SV; j++) for (let i = 0; i < SU; i++) { const a = j * (SU + 1) + i, b = a + 1, c = a + SU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// ---------- public ----------
const COLORWAYS = {
  cream:  { base: '#ece6da', thread: '#2a2925', binding: '#f4f1ea', under: '#ece6da', sheen: '#8a8780' },
  black:  { base: '#1e1f22', thread: '#d9d4c9', binding: '#1e1f22', under: '#1e1f22', sheen: '#5a5d63' },
  forest: { base: '#24382c', thread: '#d9d4c9', binding: '#24382c', under: '#24382c', sheen: '#5f7d69' },
};
const embroideryCache = new Map();

export function buildCap({ colorway = 'cream', text = null, badgeGeometry = null, badgeMaterial = null, metalMaterial = null } = {}) {
  const cw = COLORWAYS[colorway] || COLORWAYS.cream;
  // cotton: no gloss, soft fibre sheen; grain + seams + stitching live in the normal maps
  const sheenCol = new THREE.Color(cw.sheen);
  const fabric = (map, normalMap, color, side = THREE.FrontSide) => new THREE.MeshPhysicalMaterial({
    map, color: color || 0xffffff, normalMap, normalScale: new THREE.Vector2(1, 1), roughness: 1, specularIntensity: 0.25,
    sheen: 1, sheenRoughness: 0.6, sheenColor: sheenCol, side,
  });
  const cm = cached('crownMaps', crownMaps), bm = cached('brimMaps', brimMaps);
  const tile = cached('grainTile', () => { const t = grainNormalTile(); t.repeat.set(6, 6); return t; });
  const cap = new THREE.Group();
  const crownGeo = cached('crownGeo', crownGeometry);
  cap.add(new THREE.Mesh(crownGeo, fabric(cached('crownCol' + cw.base + cw.thread, () => colorTexture(cm.W, cm.H, cw.base, cm.mul, cw.thread, cm.mask, true)), cm.normal)));
  const lining = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(cw.base).lerp(new THREE.Color('#cfcac0'), 0.3), roughness: 0.92, side: THREE.BackSide,
    sheen: 0.5, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x777777) });
  cap.add(new THREE.Mesh(crownGeo, lining));
  const trim = fabric(null, tile, new THREE.Color(cw.base).multiplyScalar(0.93));
  cap.add(seamsAndBindings(trim));
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.085, 32, 16), trim);
  button.scale.set(1, 0.45, 1); button.position.copy(crownPoint(0.5, 0)).add(new THREE.Vector3(0, 0.012, 0)); cap.add(button);
  const metal = metalMaterial || new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.2 });
  cap.add(backStrap(trim, metal));

  const brimTop = fabric(cached('brimCol' + cw.base + cw.thread, () => colorTexture(bm.W, bm.H, cw.base, bm.mul, cw.thread, bm.mask, false)), bm.normal);
  const brimBottom = fabric(cached('brimCol' + cw.under + cw.thread, () => colorTexture(bm.W, bm.H, cw.under, bm.mul, cw.thread, bm.mask, false)), bm.normal);
  cap.add(new THREE.Mesh(brimGeometry(true), brimTop), new THREE.Mesh(brimGeometry(false), brimBottom));
  cap.add(brimBinding(fabric(null, tile, new THREE.Color(cw.binding))));

  if (text && text.some(Boolean)) {
    const key = text.join('|') + cw.thread;
    if (!embroideryCache.has(key)) embroideryCache.set(key, embroidery(text, cw.thread));
    const e = embroideryCache.get(key);
    cap.add(new THREE.Mesh(e.geometry, e.material));
  }

  if (badgeGeometry && badgeMaterial) {             // chrome logo resting on the brim
    const s = 0, t = 0.55, eps = 0.01;
    const p = brimPoint(s, t), pT = brimPoint(s, t + eps), pS = brimPoint(s + eps, t);
    const fwd = pT.clone().sub(p).normalize(), right = pS.clone().sub(p).normalize();
    const nrm = new THREE.Vector3().crossVectors(fwd, right).normalize(); if (nrm.y < 0) nrm.negate();
    const yAxis = fwd.clone().negate(), xAxis = new THREE.Vector3().crossVectors(yAxis, nrm).normalize();
    const badge = new THREE.Mesh(badgeGeometry, badgeMaterial);
    badge.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, nrm));
    badge.scale.set(0.2, 0.2, 0.16);
    badge.position.copy(p).addScaledVector(nrm, 0.016);
    cap.add(badge);
  }
  const box = new THREE.Box3().setFromObject(cap), ctr = box.getCenter(new THREE.Vector3());
  cap.children.forEach(c => c.position.sub(ctr));
  cap.userData.collider = {
    sphere: { r: 1.0, at: new THREE.Vector3(0, 0.32, 0).sub(ctr) },
    box: { half: new THREE.Vector3(0.82, 0.07, 0.36), at: new THREE.Vector3(0, -0.14, RZ + L * 0.5).sub(ctr) },
  };
  return cap;
}
export const CAP_COLORWAYS = Object.keys(COLORWAYS);
