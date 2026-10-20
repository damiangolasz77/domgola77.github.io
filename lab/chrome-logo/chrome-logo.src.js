/*!
 * <chrome-logo> — real-time chrome render of the logo (raw WebGL2, no dependencies)
 *
 * Usage:
 *   <script src="chrome-logo.js" defer></script>
 *   <chrome-logo style="width:480px;height:480px"></chrome-logo>
 *
 * Attributes (all optional):
 *   speed="0.35"        rotation speed (rad/s), 0 = still
 *   tilt="-8"           forward tilt in degrees
 *   thickness="1"       tube roundness (1 = circular cross-section)
 *   roughness="0.02"    0 = mirror, 0.3 = brushed
 *   tint="#cfe6ff"      colour of the rim / back lights (cool by default)
 *   background="transparent" | any CSS hex colour
 *   interactive         drag to spin (with inertia)
 *   quality="1"         render scale multiplier (0.5–2)
 *   exposure="1"        overall brightness
 *   light="0"           rotate the studio lights (degrees)
 *
 * Kinetic swell (stroke weight animation):
 *   swell="0"           static weight, −0.5 (thinner) … 1 (fatter)
 *   pulse="0"           breathing amplitude 0 … 1 (swells and thins around `swell`)
 *   pulse-speed="0.5"   breaths per second
 *   wave="0"            0 = whole logo breathes at once, 1 = a bulge travels along the strokes
 *   wave-angle="90"     direction the bulge travels (degrees, 90 = upwards)
 *
 * How it works: the SVG is baked offline into an "inflation field" h(x,y) — the solution of the
 * Poisson equation ∇²h = −1 inside the outline (h = 0 on the edge). The surface z = ±k·√h is a
 * perfectly smooth tube whose radius follows the stroke width. The fragment shader ray-marches that
 * implicit surface per pixel (no triangles → no facets, any resolution), takes analytic normals from
 * a bicubic B-spline of the field, adds one bounce of self-reflection, and lights it with a
 * procedural photo-studio (softboxes + strip lights) — the same setup used to shoot real chrome.
 */
(() => {
  const FIELD = /*FIELD*/null;

  // ------------------------------------------------------------------ shaders
  const VS = `#version 300 es
  in vec2 aPos; void main(){ gl_Position = vec4(aPos,0.,1.); }`;

  const FS = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  uniform sampler2D uFieldHQ; // R32F, NEAREST — exact bilinear (march) + bicubic (surface, normals)
  uniform sampler2D uGTex;    // R32F, NEAREST — local stroke half-width (for swelling)
  uniform float uGN, uSwell, uPulse, uPhase, uWaveK, uExposure;
  uniform vec2 uWaveDir, uLY;
  float uGrazeV = 0.;
  uniform float uN, uK2, uGmax, uZmax, uRough, uPixAng, uTanHalf, uTime;
  uniform vec2 uRes;
  uniform mat3 uRot;          // object → world
  uniform vec3 uCam, uTint;
  uniform vec4 uBg;           // premultiplied
  out vec4 outColor;

  // ---------- field access ----------
  vec2 toUV(vec2 p){ return vec2(p.x*.5+.5, .5-p.y*.5); }
  vec3 swell(vec3 f, vec2 p, vec3 g);
  vec3 gFieldB(vec2 p);
  vec3 gFieldHQ(vec2 p);
  // exact bilinear with float weights (hardware filtering quantises weights → terraces)
  vec3 fieldB(vec2 p){
    vec2 pt = toUV(p)*uN - .5;
    vec2 i0 = floor(pt), t = pt - i0;
    ivec2 a = clamp(ivec2(i0), ivec2(0), ivec2(int(uN)-2));
    float v00 = texelFetch(uFieldHQ, a, 0).r,            v10 = texelFetch(uFieldHQ, a+ivec2(1,0), 0).r;
    float v01 = texelFetch(uFieldHQ, a+ivec2(0,1), 0).r, v11 = texelFetch(uFieldHQ, a+ivec2(1,1), 0).r;
    float h = mix(mix(v00,v10,t.x), mix(v01,v11,t.x), t.y);
    float hu = mix(v10-v00, v11-v01, t.y), hv = mix(v01-v00, v11-v10, t.x);
    vec3 f = vec3(h, hu*uN*.5, -hv*uN*.5);
    return (uSwell == 0. && uPulse == 0.) ? f : swell(f, p, gFieldB(p));
  }

  // ---------- kinetic swell ----------
  // a stroke of half-width a grown by δ:  h' = h + a·δ + δ²/2   (exact for the Poisson profile)
  vec3 gFieldB(vec2 p){
    vec2 pt = toUV(p)*uGN - .5;
    vec2 i0 = floor(pt), t = pt - i0;
    ivec2 a = clamp(ivec2(i0), ivec2(0), ivec2(int(uGN)-2));
    float v00 = texelFetch(uGTex, a, 0).r,            v10 = texelFetch(uGTex, a+ivec2(1,0), 0).r;
    float v01 = texelFetch(uGTex, a+ivec2(0,1), 0).r, v11 = texelFetch(uGTex, a+ivec2(1,1), 0).r;
    float g = mix(mix(v00,v10,t.x), mix(v01,v11,t.x), t.y);
    float gu = mix(v10-v00, v11-v01, t.y), gv = mix(v01-v00, v11-v10, t.x);
    return vec3(g, gu*uGN*.5, -gv*uGN*.5);
  }
  vec3 swell(vec3 f, vec2 p, vec3 g){
    float ph = uPhase - uWaveK*dot(p, uWaveDir);
    float d = uSwell + uPulse*sin(ph);
    vec2 dd = -uPulse*cos(ph)*uWaveK*uWaveDir;
    if (d < 0.) {                       // thinning: soft limit below the thinnest stroke → strokes never snap
      float m = .011, e = exp(d/m);
      d = m*(e - 1.); dd *= e;
    }
    return vec3(f.x + d*g.x + .5*d*d, f.yz + d*g.yz + (g.x + d)*dd);
  }

  vec4 bw(float t){ float s=1.-t; return vec4(s*s*s, 3.*t*t*t-6.*t*t+4., -3.*t*t*t+3.*t*t+3.*t+1., t*t*t)/6.; }
  vec4 bd(float t){ float s=1.-t; return vec4(-s*s, 3.*t*t-4.*t, -3.*t*t+2.*t+1., t*t)*.5; }
  vec3 gFieldHQ(vec2 p){                       // smooth (C2) swell field for the visible surface
    vec2 pt = toUV(p)*uGN - .5;
    vec2 i0 = floor(pt), t = pt - i0;
    vec4 wx = bw(t.x), wy = bw(t.y), dx = bd(t.x), dy = bd(t.y);
    float g=0., gx=0., gy=0.;
    int n = int(uGN)-1;
    for (int j=0;j<4;j++){
      float g0=0., g1=0.;
      for (int i=0;i<4;i++){
        float v = texelFetch(uGTex, clamp(ivec2(i0)+ivec2(i-1,j-1), ivec2(0), ivec2(n)), 0).r;
        g0 += wx[i]*v; g1 += dx[i]*v;
      }
      g += wy[j]*g0; gx += wy[j]*g1; gy += dy[j]*g0;
    }
    return vec3(g, gx*uGN*.5, -gy*uGN*.5);
  }
  // B-spline value + gradient (object units)
  vec3 fieldHQ(vec2 p){
    vec2 pt = toUV(p)*uN - .5;
    vec2 i0 = floor(pt), t = pt - i0;
    vec4 wx = bw(t.x), wy = bw(t.y), dx = bd(t.x), dy = bd(t.y);
    float h=0., hx=0., hy=0.;
    int n = int(uN)-1;
    for (int j=0;j<4;j++){
      float h0=0., h1=0.;
      for (int i=0;i<4;i++){
        float v = texelFetch(uFieldHQ, clamp(ivec2(i0)+ivec2(i-1,j-1), ivec2(0), ivec2(n)), 0).r;
        h0 += wx[i]*v; h1 += dx[i]*v;
      }
      h += wy[j]*h0; hx += wy[j]*h1; hy += dy[j]*h0;
    }
    vec3 f = vec3(h, hx*uN*.5, -hy*uN*.5);
    return (uSwell == 0. && uPulse == 0.) ? f : swell(f, p, gFieldHQ(p));
  }
  float implicitHQ(vec3 p){ return p.z*p.z - uK2*fieldHQ(p.xy).x; }

  // ---------- ray march the implicit surface  F = z² − k²·h(x,y) ----------
  bool box(vec3 ro, vec3 rd, out float t0, out float t1){
    vec3 b = vec3(1., 1., uZmax);
    vec3 inv = 1./rd, ta = (-b-ro)*inv, tb = (b-ro)*inv;
    vec3 mn = min(ta,tb), mx = max(ta,tb);
    t0 = max(max(mn.x,mn.y),max(mn.z,0.)); t1 = min(min(mx.x,mx.y),mx.z);
    return t1 > t0;
  }
  // returns hit distance or -1; minR/tMin = closest approach in pixel units (for edge AA)
  float march(vec3 ro, vec3 rd, int maxSteps, float tStart, out float minR, out float tMin){
    minR = 1e9; tMin = -1.;
    float t0, t1;
    if (!box(ro, rd, t0, t1)) return -1.;
    float t = max(t0, tStart), tPrev = t;
        for (int i=0;i<360;i++){
      if (i >= maxSteps) { minR = 1e9; break; }      // exhausted: no AA fallback
      if (t > t1) break;
      vec3 p = ro + rd*t;
      vec3 fb = fieldB(p.xy);
      float h = fb.x;
      float F = p.z*p.z - uK2*h, de;
      if (h <= 0.) {
        de = max(-h/uGmax, 0.001);                    // 2D distance lower bound
      } else {
        if (F < 0.) {
          // bracket the smooth (B-spline) surface, then bisect
          float a = tPrev, b = t; bool ok = false;
          for (int k=0;k<6;k++){ if (implicitHQ(ro+rd*b) < 0.) { ok = true; break; } a = b; b += .0015; }
          if (ok) {
            for (int k=0;k<12;k++){ float m=.5*(a+b); if (implicitHQ(ro+rd*m) < 0.) b=m; else a=m; }
            return b;
          }
          tPrev = b; t = b + .0015; continue;           // grazed the bilinear shell only — keep going
        }
        vec3 g = vec3(-uK2*fb.y, -uK2*fb.z, 2.*p.z);
        de = clamp(.7*F/max(length(g),1e-4), 0.001, 0.03);
        de = max(de, abs(p.z) - uZmax);              // above the tallest point: free skip
      }
      // distance used for edge AA: outside the footprint the tube rim sits at z≈0
      float da = h <= 0. ? length(vec2(-h/max(length(fb.yz), 1e-3), p.z)) : de;
      float r = da/(t*uPixAng);
      if (r < minR){ minR = r; tMin = t; }
      tPrev = t; t += de;
    }
    return -1.;
  }

  vec3 normalAt(vec3 p){
    vec3 f = fieldHQ(p.xy);
    // project vertically onto the smooth surface first → normals never inherit march error
    float zs = sign(p.z + 1e-6) * sqrt(max(uK2*f.x, 0.));
    return normalize(vec3(-uK2*f.y, -uK2*f.z, 2.*zs));
  }

  // ---------- procedural photo studio ----------
  float rectL(vec3 r, vec3 c, vec2 hs, float soft){
    c = normalize(c);
    float d = dot(r,c); if (d <= 0.) return 0.;
    vec3 up0 = abs(c.y) > .95 ? vec3(0.,0.,1.) : vec3(0.,1.,0.);
    vec3 rt = normalize(cross(up0,c)), up = cross(c,rt);
    vec2 q = vec2(dot(r,rt), dot(r,up))/d;
    vec2 m = smoothstep(hs+soft, hs-soft*.6, abs(q));
    return m.x*m.y;
  }
  vec3 env(vec3 r, float rough){
    float s = .015 + rough*.6 + uGrazeV;
    float y = r.y;
    // studio: black cyclorama, dim floor, crisp horizon
    vec3 c = vec3(.0);
    c += vec3(.05,.052,.056) * smoothstep(.0,-.3,y);
    c += vec3(.6) * exp(-pow((y+.01)/(.008+rough*.2+uGrazeV),2.));
    // big soft sources → broad white areas (like the references)
    c += vec3(2.6)  * rectL(r, vec3( 0.0, 1.0, 0.25), vec2(1.3,.55), s*6.);   // overhead softbox
    c += vec3(1.7)  * rectL(r, vec3( 0.1, 0.22, 1.0), vec2(.55,.22), s*4.);   // frontal softbox (behind camera)
    c += vec3(1.1)  * rectL(r, vec3(-0.7, 0.35, 0.6), vec2(.35,.5), s*5.);    // fill
    // hard strips → the crisp liquid lines along every stroke
    c += vec3(8.0)  * rectL(r, vec3(-1.0, 0.05, 0.35), vec2(.04,1.6), s);
    c += uTint*7.0  * rectL(r, vec3( 1.0, 0.10, 0.15), vec2(.035,1.6), s);
    c += uTint*3.5  * rectL(r, vec3(-0.45, 0.2,-1.0), vec2(.6,.05), s);       // back rim
    c += vec3(3.0)  * rectL(r, vec3( 0.5, 0.05,-1.0), vec2(.04,1.0), s);
    c += vec3(2.0)  * rectL(r, vec3( 0.0,-0.5, 0.9), vec2(1.,.03), s);        // low kicker
    c += vec3(80.)  * rectL(r, vec3( 0.4, 0.5, 0.8), vec2(.01,.01), s*.5);    // hot spot → glints
    return c;
  }

  vec3 envW(vec3 r){ return env(vec3(uLY.x*r.x + uLY.y*r.z, r.y, -uLY.y*r.x + uLY.x*r.z), uRough); }

  vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }

  vec3 shade(vec3 pO, vec3 rdO, vec3 rdW, bool bounce){
    vec3 nO = normalAt(pO);
    vec3 nW = uRot*nO;
    vec3 rO = reflect(rdO, nO), rW = uRot*rO;
    vec3 F0 = vec3(.90,.91,.93);
    float cosv = clamp(dot(nW,-rdW),0.,1.);
    uGrazeV = pow(1.-cosv, 3.) * .35;   // silhouette rim: widen highlights → no sparkle aliasing
    vec3 fr = F0 + (1.-F0)*pow(1.-cosv,5.);
    // one bounce of self-reflection (the logo reflects itself where strokes meet)
    float mr, tm;
    float t2 = bounce ? march(pO + nO*.004, rO, 120, 0., mr, tm) : -1.;
    vec3 refl;
    if (t2 > 0.) {
      vec3 p2 = pO + nO*.004 + rO*t2;
      vec3 n2 = normalAt(p2);
      vec3 r2 = uRot*reflect(rO, n2);
      refl = envW(r2) * F0 * .9;
    } else refl = envW(rW);
    // subtle cavity darkening where the tube meets itself
    return refl*fr;
  }

  void main(){
    vec2 uv = (gl_FragCoord.xy - .5*uRes)/uRes.y;
    vec3 rdW = normalize(vec3(uv*2.*uTanHalf, -1.));
    mat3 inv = transpose(uRot);
    vec3 roO = inv*uCam, rdO = inv*rdW;

    float minR, tMin;
    float t = march(roO, rdO, 360, 0., minR, tMin);
    vec4 col;
    if (t > 0.) {
      col = vec4(shade(roO+rdO*t, rdO, rdW, true), 1.);
    } else if (tMin > 0. && minR < 1.) {
      // analytic edge anti-aliasing: shade the closest approach, blend by sub-pixel coverage
      vec3 p = roO + rdO*tMin;
      col = vec4(shade(p, rdO, rdW, false), 1.) * (1.-smoothstep(0.,1.,minR));
    } else col = vec4(0.);
    vec3 c = aces(col.rgb*1.05*uExposure);
    c = pow(c, vec3(1./2.2));
    // tiny dither — kills banding in the dark gradients
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)) + uTime)*43758.5453);
    c += (n-.5)/255.;
    float a = col.a;
    outColor = vec4(c*a, a) + uBg*(1.-a);
  }`;

  // ------------------------------------------------------------------ field decode
  let fieldPromise = null;
  function loadField() {
    if (fieldPromise) return fieldPromise;
    fieldPromise = (async () => {
      const bin = Uint8Array.from(atob(FIELD.data), c => c.charCodeAt(0));
      const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
      const buf = await new Response(ds).arrayBuffer();
      const res = new Uint16Array(buf), N = FIELD.n, q = new Int32Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        let p = 0;
        if (y > 0 && x > 0) p = q[i - 1] + q[i - N] - q[i - N - 1];
        else if (x > 0) p = q[i - 1];
        else if (y > 0) p = q[i - N];
        q[i] = (p + res[i]) & 0xffff;
      }
      const S = FIELD.span / 2, h = new Float32Array(N * N), k = (FIELD.hi - FIELD.lo) / 65535;
      let hmax = 0;
      for (let i = 0; i < N * N; i++) { h[i] = (FIELD.lo + q[i] * k) / (S * S); if (h[i] > hmax) hmax = h[i]; }
      // swell field (local stroke half-width), 10-bit, same predictor
      const gb = Uint8Array.from(atob(FIELD.gdata), c => c.charCodeAt(0));
      const gbuf = await new Response(new Blob([gb]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      const gr = new Uint16Array(gbuf), GN = FIELD.gn, gq = new Int32Array(GN * GN), G = new Float32Array(GN * GN);
      let Gmax = 0;
      for (let y = 0; y < GN; y++) for (let x = 0; x < GN; x++) {
        const i = y * GN + x;
        let p = 0;
        if (y > 0 && x > 0) p = gq[i - 1] + gq[i - GN] - gq[i - GN - 1];
        else if (x > 0) p = gq[i - 1];
        else if (y > 0) p = gq[i - GN];
        gq[i] = (p + gr[i]) & 0xffff;
        G[i] = gq[i] / 65535 * FIELD.gmax / S; if (G[i] > Gmax) Gmax = G[i];
      }
      return { N, h, hmax, gmax: FIELD.gmax / S, GN, G, Gmax };
    })();
    return fieldPromise;
  }

  // ------------------------------------------------------------------ element
  const hexToRgb = (s, d) => {
    const m = /^#?([0-9a-f]{6})$/i.exec((s || '').trim()); if (!m) return d;
    const v = parseInt(m[1], 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
  };
  const srgbToLin = c => c.map(v => Math.pow(v, 2.2));

  class ChromeLogo extends HTMLElement {
    static get observedAttributes() { return ['speed', 'tilt', 'thickness', 'roughness', 'tint', 'background', 'quality', 'exposure', 'light',
      'swell', 'pulse', 'pulse-speed', 'wave', 'wave-angle', 'interactive']; }
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>:host{display:block;position:relative;width:100%;aspect-ratio:1/1;contain:strict}
        canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y}</style><canvas></canvas>`;
      this.canvas = root.querySelector('canvas');
      this.angle = 0; this.vel = 0; this.phase = 0; this.visible = true;
      this._setup().catch(e => console.error('[chrome-logo]', e));
    }
    disconnectedCallback() { this._dead = true; this.ro && this.ro.disconnect(); this.io && this.io.disconnect(); }
    attributeChangedCallback() { this._readAttrs(); }
    _num(n, d) { const v = parseFloat(this.getAttribute(n)); return Number.isFinite(v) ? v : d; }
    _readAttrs() {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.speed = reduce ? 0 : this._num('speed', 0.35);
      this.tilt = this._num('tilt', -8) * Math.PI / 180;
      this.thick = this._num('thickness', 1);
      this.rough = this._num('roughness', 0.02);
      this.tint = srgbToLin(hexToRgb(this.getAttribute('tint'), [0.82, 0.9, 1.0]));
      const bg = this.getAttribute('background');
      this.bg = bg && bg !== 'transparent' ? [...hexToRgb(bg, [0, 0, 0]), 1] : [0, 0, 0, 0];
      this.quality = Math.min(2, Math.max(0.5, this._num('quality', 1)));
      this.exposure = this._num('exposure', 1);
      this.light = this._num('light', 0) * Math.PI / 180;
      this.swellAmt = Math.min(1, Math.max(-0.5, this._num('swell', 0)));
      this.pulse = reduce ? 0 : Math.min(1, Math.max(0, this._num('pulse', 0)));
      this.pulseSpeed = this._num('pulse-speed', 0.5);
      this.wave = Math.min(1, Math.max(0, this._num('wave', 0)));
      this.waveAngle = this._num('wave-angle', 90) * Math.PI / 180;
      if (this.canvas) this.canvas.style.cursor = this.hasAttribute('interactive') ? 'grab' : '';
      this._resize && this._resize();
    }
    async _setup() {
      this._readAttrs();
      const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
      if (!gl) { this.shadowRoot.innerHTML += '<p style="color:#888;font:12px sans-serif">WebGL2 unavailable</p>'; return; }
      this.gl = gl;
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = {}; ['uFieldHQ', 'uN', 'uK2', 'uGmax', 'uZmax', 'uRough', 'uPixAng', 'uTanHalf', 'uTime', 'uRes', 'uRot', 'uCam', 'uTint', 'uBg',
        'uGTex', 'uGN', 'uSwell', 'uPulse', 'uPhase', 'uWaveK', 'uExposure', 'uWaveDir', 'uLY']
        .forEach(n => U[n] = gl.getUniformLocation(prog, n));
      this.U = U;

      const F = await loadField();
      if (this._dead) return;
      this.F = F;
      const tex = (unit, internal, filter, n = F.N, data = F.h) => {
        const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, n, n, 0, gl.RED, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      };
      tex(1, gl.R32F, gl.NEAREST);
      tex(2, gl.R32F, gl.NEAREST, F.GN, F.G);
      gl.uniform1i(U.uFieldHQ, 1); gl.uniform1i(U.uGTex, 2); gl.uniform1f(U.uGN, F.GN);
      gl.uniform1f(U.uN, F.N);

      this._resize = () => {
        const r = this.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = dpr * (dpr < 1.5 ? 1.5 : 1) * this.quality;   // supersample low-DPR screens
        const w = Math.max(1, Math.round(r.width * scale)), h = Math.max(1, Math.round(r.height * scale));
        if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
        this._dirty = true;
      };
      this.ro = new ResizeObserver(this._resize); this.ro.observe(this);
      this.io = new IntersectionObserver(es => { this.visible = es[0].isIntersecting; }); this.io.observe(this);
      this._resize();

      {
        let down = false, lx = 0, lt = 0;
        this.canvas.addEventListener('pointerdown', e => { if (!this.hasAttribute('interactive')) return; down = true; lx = e.clientX; lt = performance.now(); this.canvas.setPointerCapture(e.pointerId); });
        this.canvas.addEventListener('pointermove', e => {
          if (!down) return;
          const now = performance.now(), dx = (e.clientX - lx) * 0.012;
          this.angle += dx; this.vel = dx / Math.max(1, now - lt) * 1000; lx = e.clientX; lt = now;
        });
        const up = () => { down = false; };
        this.canvas.addEventListener('pointerup', up); this.canvas.addEventListener('pointercancel', up);
      }

      let last = performance.now();
      const frame = now => {
        if (this._dead) return;
        requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (!this.visible || document.hidden) return;
        this.vel *= Math.pow(0.04, dt);                     // drag inertia
        this.angle += (this.speed + this.vel) * dt;
        this.phase = (this.phase + dt * this.pulseSpeed * 2 * Math.PI) % (2 * Math.PI * 1000);
        this._draw(now / 1000);
      };
      requestAnimationFrame(frame);
      this.dispatchEvent(new Event('ready'));
    }
    _draw(time) {
      const gl = this.gl, U = this.U, F = this.F, W = this.canvas.width, H = this.canvas.height;
      gl.viewport(0, 0, W, H);
      const k2 = 2 * this.thick * this.thick;                 // k = √2 → circular cross-section
      const fov = 24 * Math.PI / 180, tanH = Math.tan(fov / 2);
      const aspect = W / H, R = 0.93;                          // object radius incl. tube depth
      const dist = R / (tanH * Math.min(1, aspect)) * 1.12 + 0.2;
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle), ct = Math.cos(this.tilt), st = Math.sin(this.tilt);
      // rot = Rx(tilt) * Ry(angle), column-major
      const m = [ca, st * sa, -ct * sa, 0, ct, st, sa, -st * ca, ct * ca];
      gl.uniformMatrix3fv(U.uRot, false, m);
      gl.uniform3f(U.uCam, 0, 0, dist);
      gl.uniform2f(U.uRes, W, H);
      gl.uniform1f(U.uTanHalf, tanH);
      gl.uniform1f(U.uPixAng, 2 * tanH / H);
      gl.uniform1f(U.uK2, k2);
      gl.uniform1f(U.uGmax, F.gmax);
      const SW = 0.04;                                         // full slider = ±0.04 obj ≈ 8 svg units of stroke
      const sw = this.swellAmt * SW, pu = this.pulse * SW, dmax = Math.max(0, sw + pu);
      gl.uniform1f(U.uSwell, sw); gl.uniform1f(U.uPulse, pu); gl.uniform1f(U.uPhase, this.phase);
      gl.uniform1f(U.uWaveK, this.wave * 9.0);
      gl.uniform2f(U.uWaveDir, Math.cos(this.waveAngle), Math.sin(this.waveAngle));
      gl.uniform1f(U.uExposure, this.exposure);
      gl.uniform2f(U.uLY, Math.cos(this.light), Math.sin(this.light));
      gl.uniform1f(U.uZmax, Math.sqrt(k2 * (F.hmax + F.Gmax * dmax + 0.5 * dmax * dmax)) + 0.01);
      gl.uniform1f(U.uRough, this.rough);
      gl.uniform1f(U.uTime, time % 100);
      gl.uniform3fv(U.uTint, this.tint);
      gl.uniform4fv(U.uBg, this.bg);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    /** Export the current frame as PNG (transparent unless background is set). */
    toPNG() { this._draw(performance.now() / 1000); return this.canvas.toDataURL('image/png'); }
  }
  if (!customElements.get('chrome-logo')) customElements.define('chrome-logo', ChromeLogo);
})();
