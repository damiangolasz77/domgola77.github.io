// Renders each prop on black and on white (same frame) so the PNG alpha can be pulled exactly by
// difference matting: alpha = 1 − (white − black), colour = black / alpha.
import * as THREE from 'three';
import { buildCap } from './cap.js';
import { buildRacket, buildHanger, buildComputer, buildCursor, buildTennisBall } from './objects.js';
import { studioEnvironment, chromeEnvironment, materials } from './look.js';
import { loadLogoGeometry, loadCursorGeometry } from './assets.js';

(async () => {
  const S = +(new URLSearchParams(location.search).get('s') || 2400);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(S, S);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(4, 2, -5); scene.add(rim);
  const M = materials(); M.chrome.envMap = chromeEnvironment(renderer);
  const [logoGeo, cursorGeo] = await Promise.all([loadLogoGeometry(), loadCursorGeometry()]);

  const pill = () => {
    const r = 0.32, L = 0.9, grp = new THREE.Group();
    const half = (top, mat) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r, L / 2 + Math.cos(a) * r)); }
      pts.push(new THREE.Vector2(r, 0));
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 96), mat); if (!top) m.rotation.x = Math.PI; return m;
    };
    grp.add(half(true, M.pillA), half(false, M.pillB)); return grp;
  };
  const logo = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(logoGeo, M.chrome)); return g; };
  const cap = (colorway, badge) => buildCap({ colorway, badgeGeometry: badge ? logoGeo : null, badgeMaterial: M.chrome, metalMaterial: M.chrome });

  const LIST = [
    ['cap-cream', () => cap('cream'), [0.18, -0.7, 0]],
    ['cap-black-chrome-logo', () => cap('black', true), [0.45, -0.45, 0]],
    ['cap-forest', () => cap('forest'), [0.18, 0.7, 0]],
    ['retro-computer', () => buildComputer(M).object, [0.1, -0.45, 0]],
    ['tennis-racket', () => buildRacket(M).object, [0.15, 0.35, 0.45]],
    ['hanger-chrome', () => buildHanger(M).object, [0.1, 0.4, 0]],
    ['cursor-chrome', () => buildCursor(M, cursorGeo).object, [-0.3, 0.5, 0.4]],
    ['tennis-ball', () => buildTennisBall().object, [0.3, 0.6, 0]],
    ['logo-g-chrome', logo, [0.2, 0.5, 0.1]],
    ['logo-g-chrome-front', logo, [0.06, 0.18, 0]],
    ['pill', pill, [0.4, 0.3, 0.75]],
  ];
  const only = new URLSearchParams(location.search).get('only');
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  window.__out = [];
  for (const [name, make, rot] of LIST) {
    if (only && !only.split(',').includes(name)) continue;
    const obj = make(); obj.rotation.set(...rot); scene.add(obj);
    const sph = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
    cam.position.set(sph.center.x, sph.center.y, sph.center.z + sph.radius / Math.sin(15 * Math.PI / 180) * 1.02);
    cam.lookAt(sph.center);
    const shots = [];
    for (const bg of [0x000000, 0xffffff]) { renderer.setClearColor(bg, 1); renderer.render(scene, cam); shots.push(renderer.domElement.toDataURL('image/png')); }
    window.__out.push({ name, black: shots[0], white: shots[1] });
    scene.remove(obj);
  }
  window.__done = true;
})();
