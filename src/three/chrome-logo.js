// The chrome G as a small self-contained WebGL view: one canvas, one mesh, rendered on demand.
// Used by the nav logo, the big Home hero logo and anything else that needs the 3D letter.
// `look` overrides the finish (environment, material, exposure, `bold`); /logo/ compares variants.
import * as THREE from 'three';
import { chromeEnvironment, polishedChromeEnvironment } from './look.js';
import { loadLogoGeometry } from './mesh.js';

// The site's finish = variant 03 from /logo/ ("most chrome") at the normal weight (Oct 2026).
export const CURRENT_LOOK = {
  env: r => polishedChromeEnvironment(r, 2), exposure: 1.08, bold: 0,
  material: { roughness: 0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.75 },
};
// The finish before that (kept for /logo/ and in case he wants it back).
export const PREVIOUS_LOOK = {
  env: chromeEnvironment, exposure: 1, bold: 0,
  material: { roughness: 0.035, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.25 },
};

export async function createChromeLogo(host, { maxPixelRatio = 3, fallback = { w: 44, h: 50 }, look = CURRENT_LOOK } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxPixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure ?? 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const geo = (await loadLogoGeometry()).clone();
  if (look.bold) embolden(geo, look.bold);
  geo.computeBoundingBox();
  const box = geo.boundingBox, c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z);       // spin axis goes through the middle of the letter

  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, ...look.material });
  mat.envMap = (look.env || chromeEnvironment)(renderer);
  const mesh = new THREE.Mesh(geo, mat);
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.PerspectiveCamera(18, 1, 0.1, 50);

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  let angle = 0;
  const draw = (a = angle) => { angle = a; mesh.rotation.y = a; renderer.render(scene, camera); };
  function resize() {
    const w = host.clientWidth || fallback.w, h = host.clientHeight || fallback.h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // fit the letter's height (and width when the box is narrow), small margin for the spin
    const fitH = Math.max(size.y, size.x / camera.aspect) * 1.1;
    camera.position.set(0, 0, fitH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + size.z / 2);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    draw();
  }
  resize();
  return { canvas, draw, resize, get angle() { return angle; }, dispose() { renderer.dispose(); canvas.remove(); } };
}

// Heavier strokes seen from the front, same depth: every vertex moves outwards along the sideways
// part of its normal only (n.x, n.y) — the walls of the letter go out, the front face stays put.
// The baked normals stay valid for an offset surface; recomputing them from the marching-cubes
// triangles makes the reflections wavy.
function embolden(geo, t) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXY(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t);
  p.needsUpdate = true;
  geo.computeBoundingBox(); geo.computeBoundingSphere();
}
