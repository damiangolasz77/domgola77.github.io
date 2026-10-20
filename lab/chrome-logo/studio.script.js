(() => {
  const logo = document.getElementById('logo');
  const DEFAULTS = { speed: 0.35, tilt: -8, thickness: 1, roughness: 0.02, exposure: 1, light: 0,
    swell: 0, pulse: 0, 'pulse-speed': 0.5, wave: 0, 'wave-angle': 90, tint: '#cfe6ff' };
  const START = { ...DEFAULTS, pulse: 0.45, 'pulse-speed': 0.45, wave: 0.35 };
  const PRESETS = {
    still:  { pulse: 0, swell: 0, wave: 0 },
    breath: { swell: 0, pulse: 0.45, 'pulse-speed': 0.35, wave: 0 },
    pump:   { swell: 0.25, pulse: 0.7, 'pulse-speed': 1.1, wave: 0 },
    wave:   { swell: 0.1, pulse: 0.6, 'pulse-speed': 0.5, wave: 0.65, 'wave-angle': 90 },
    heavy:  { swell: 0.9, pulse: 0.15, 'pulse-speed': 0.3, wave: 0.2, thickness: 1.15 },
  };
  const state = { ...START, bg: 'transparent', interactive: true };
  const ranges = [...document.querySelectorAll('input[type=range][data-attr]')];
  const fmt = (el, v) => {
    const n = parseFloat(v);
    switch (el.dataset.fmt) {
      case 'deg': return Math.round(n) + '°';
      case 'hz': return n.toFixed(2) + '/s';
      case 'signed': return (n > 0 ? '+' : '') + n.toFixed(2);
      default: return n.toFixed(2);
    }
  };
  const paint = el => {
    const p = (el.value - el.min) / (el.max - el.min) * 100;
    el.style.setProperty('--p', p + '%');
    document.getElementById('o-' + el.id).textContent = fmt(el, el.value);
  };
  const clean = v => +parseFloat(v).toFixed(3);

  function apply() {
    for (const el of ranges) {
      el.value = state[el.dataset.attr]; paint(el);
      logo.setAttribute(el.dataset.attr, state[el.dataset.attr]);
    }
    document.getElementById('tint').value = state.tint;
    logo.setAttribute('tint', state.tint);
    logo.setAttribute('background', state.bg);
    logo.toggleAttribute('interactive', state.interactive);
    document.getElementById('interactive').checked = state.interactive;
    const stage = document.getElementById('stage');
    stage.classList.toggle('transparent', state.bg === 'transparent');
    stage.style.setProperty('--stage', state.bg === 'transparent' ? 'transparent' : state.bg);
    document.querySelectorAll('[data-bg]').forEach(b => {
      const on = b.dataset.bg === 'custom' ? (state.bg !== 'transparent' && state.bg !== '#000000') : b.dataset.bg === state.bg;
      b.setAttribute('aria-pressed', on);
    });
    document.querySelectorAll('[data-preset]').forEach(b => {
      const p = PRESETS[b.dataset.preset];
      b.setAttribute('aria-pressed', Object.keys(p).every(k => clean(state[k]) === clean(p[k])));
    });
    renderCode();
  }

  function renderCode() {
    const attrs = [];
    for (const [k, d] of Object.entries(DEFAULTS)) {
      const v = state[k];
      if (k === 'tint') { if (v.toLowerCase() !== d) attrs.push(`tint="${v}"`); continue; }
      if (clean(v) !== clean(d)) attrs.push(`${k}="${clean(v)}"`);
    }
    if (state.bg !== 'transparent') attrs.push(`background="${state.bg}"`);
    if (state.interactive) attrs.push('interactive');
    const tag = attrs.length ? `<chrome-logo\n  ${attrs.join('\n  ')}\n  style="width:480px;height:480px"></chrome-logo>`
                             : `<chrome-logo style="width:480px;height:480px"></chrome-logo>`;
    document.getElementById('code').textContent = `<script src="chrome-logo.js" defer><\/script>\n${tag}`;
  }

  ranges.forEach(el => el.addEventListener('input', () => { state[el.dataset.attr] = parseFloat(el.value); apply(); }));
  document.getElementById('tint').addEventListener('input', e => { state.tint = e.target.value; apply(); });
  document.getElementById('interactive').addEventListener('change', e => { state.interactive = e.target.checked; apply(); });
  document.querySelectorAll('[data-bg]').forEach(b => b.addEventListener('click', () => {
    state.bg = b.dataset.bg === 'custom' ? document.getElementById('bgColor').value : b.dataset.bg; apply();
  }));
  document.getElementById('bgColor').addEventListener('input', e => { state.bg = e.target.value; apply(); });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    Object.assign(state, PRESETS[b.dataset.preset]); apply();
  }));
  document.getElementById('reset').addEventListener('click', () => {
    Object.assign(state, START, { bg: 'transparent', interactive: true }); apply();
  });
  const toast = document.getElementById('toast');
  document.getElementById('copy').addEventListener('click', async () => {
    const text = document.getElementById('code').textContent;
    try { await navigator.clipboard.writeText(text); toast.textContent = 'Skopiowano'; }
    catch {
      const r = document.createRange(); r.selectNodeContents(document.getElementById('code'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      toast.textContent = 'Zaznaczono — skopiuj skrótem klawiszowym';
    }
    clearTimeout(toast._t); toast._t = setTimeout(() => toast.textContent = '', 2400);
  });
  apply();
})();
