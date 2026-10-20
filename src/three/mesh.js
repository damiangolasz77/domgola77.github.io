import * as THREE from 'three';

async function gunzip(b64) {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

/** Decodes a baked mesh (assets/*mesh.json: gzipped int16 positions, int8 normals, uint32 indices). */
export async function loadMesh(MESH) {
  const buf = await gunzip(MESH.data);
  const nv = MESH.nv, nf = MESH.nf;
  const q = new Int16Array(buf, 0, nv * 3);
  const nq = new Int8Array(buf, nv * 6, nv * 3);
  const off = nv * 9;
  const idx = new Uint32Array(buf.slice(off, off + nf * 12));
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) { pos[i] = q[i] / 32767; nrm[i] = nq[i] / 127; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.userData.spheres = MESH.spheres;
  return g;
}

/** Inflated chrome G (marching cubes of the baked Poisson field), unit radius in xy, front = +z. */
let logoGeo = null;   // decoded once, shared (callers that transform it should .clone())
export const loadLogoGeometry = () => (logoGeo ||= import('../../assets/gmesh.json').then(m => loadMesh(m.default)));
