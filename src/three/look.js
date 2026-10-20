// Studio lighting (procedural HDR environment) and the material library.
import * as THREE from 'three';

export function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; void main(){
      float y = normalize(vP).y;
      vec3 top = vec3(.95), mid = vec3(.62), low = vec3(.22);
      vec3 c = mix(low, mid, smoothstep(-.6, .0, y));
      c = mix(c, top, smoothstep(.0, .9, y));
      c += vec3(.8) * exp(-pow(y*30.,2.));          // bright horizon line
      gl_FragColor = vec4(c, 1.);
    }`,
  }));
  env.add(sky);
  const panel = (w, h, pos, color, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(16, 5, [0, 12, 6], 0xffffff, 4.0);        // overhead softbox
  panel(5, 12, [-12, 2, 4], 0xffffff, 3.0);       // left strip
  panel(3, 12, [12, 1, -3], 0xfff6ea, 2.4);       // warm right strip
  panel(10, 10, [0, 0, 14], 0xffffff, 1.4);       // frontal fill
  panel(8, 14, [8, 0, 10], 0x000000, 1);          // black flags → contrast lines on chrome
  panel(6, 14, [-9, 0, -10], 0x000000, 1);
  panel(20, 3, [0, -10, 4], 0x0a0a0a, 1);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return tex;
}

// High-contrast photo studio just for chrome: dark room, hard strips, a horizon line.
export function chromeEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; void main(){
      float y = normalize(vP).y;
      vec3 c = mix(vec3(.02), vec3(.32), smoothstep(-.05, .7, y));
      c += vec3(1.4) * exp(-pow(y*40.,2.));
      gl_FragColor = vec4(c, 1.);
    }`,
  })));
  const strip = (w, h, pos, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  strip(18, 1.4, [0, 12, 3], 6);
  strip(1.2, 16, [-12, 0, 6], 7);
  strip(0.9, 16, [12, 2, -2], 5);
  strip(7, 7, [5, 7, 10], 2.5);
  strip(14, 0.5, [0, -8, 9], 2.5);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture; pm.dispose();
  return tex;
}

export function materials() {
  const M = {};
  M.chrome = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.035, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.25 });
  M.ceramic = new THREE.MeshPhysicalMaterial({ color: 0xfafaf7, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.clay = new THREE.MeshPhysicalMaterial({ color: 0xe9e9e6, roughness: 0.92, sheen: 0.4, sheenRoughness: 0.9, sheenColor: new THREE.Color(0xffffff) });
  M.jelly = new THREE.MeshPhysicalMaterial({ color: 0xe4ff4a, transmission: 0.85, thickness: 0.9, roughness: 0.06, ior: 1.4,
    attenuationColor: new THREE.Color(0xc6f000), attenuationDistance: 0.45, clearcoat: 1, clearcoatRoughness: 0.03,
    emissive: new THREE.Color(0xa8d400), emissiveIntensity: 0.35 });
  M.pearl = new THREE.MeshPhysicalMaterial({ color: 0xf1eef6, metalness: 0.65, roughness: 0.18, iridescence: 1, iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 650], clearcoat: 1, clearcoatRoughness: 0.05 });
  M.rubber = new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: 0.55, sheen: 0.8, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x4a4a52) });
  M.holo = new THREE.MeshPhysicalMaterial({ color: 0xf4f6ff, metalness: 0.9, roughness: 0.16, iridescence: 1, iridescenceIOR: 1.35,
    iridescenceThicknessRange: [320, 680], side: THREE.DoubleSide });
  M.pillA = new THREE.MeshPhysicalMaterial({ color: 0xd8261f, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 });
  M.pillB = new THREE.MeshPhysicalMaterial({ color: 0xf5f4f0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 });
  M.disc = new THREE.MeshPhysicalMaterial({ color: 0xb9c0cc, metalness: 1, roughness: 0.07, iridescence: 1, iridescenceIOR: 1.3,
    iridescenceThicknessRange: [250, 520], side: THREE.DoubleSide });
  return M;
}

// Brighter, crisper chrome studio for the /logo/ comparison. level 1 = "more chrome": a brighter sky
// over a black floor, broad softboxes and a hot horizon, no PMREM blur → bigger, cleaner white areas
// with hard dark edges. level 2 = "most chrome": even brighter, a frontal softbox (the front face
// mirrors it), a second horizon line and a few small hot spots for glints.
export function polishedChromeEnvironment(renderer, level = 1) {
  const L = level - 1;
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uL: { value: L } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uL; varying vec3 vP; void main(){
      float y = normalize(vP).y;
      vec3 c = mix(vec3(.0), vec3(.55), smoothstep(.0, .75, y));
      c += vec3(3.) * exp(-pow(y * 45., 2.));                               // hot horizon
      c += vec3(2.) * exp(-pow((y + .3) * 40., 2.)) * uL;                  // second line below (level 2)
      gl_FragColor = vec4(c, 1.);
    }`,
  })));
  const strip = (w, h, pos, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  strip(20, 2.6, [0, 12, 3], 7);              // overhead
  strip(2.2, 16, [-12, 0, 6], 8);             // left
  strip(1.4, 16, [12, 2, -2], 6);             // right
  strip(9, 9, [6, 6, 11], 3.2);               // key
  strip(16, .7, [0, -8, 9], 4);               // floor bounce → rim under the letter
  if (L) {
    strip(7, 2.4, [-3, 6, 13], 4);            // frontal softbox, high
    strip(.6, 18, [-6, 0, 12], 9);            // a crisp vertical line across the front
    for (const [x, y, z] of [[-7, 9, 8], [8, 5, 10], [-10, -3, 8]]) strip(.9, .9, [x, y, z], 30);   // glints
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0).texture; pm.dispose();
  return tex;
}
