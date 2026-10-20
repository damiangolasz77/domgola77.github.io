// Shared nav behaviour: sound switch, the 3D chrome logo (the static render shows until the
// WebGL version is ready) and the light/dark glass that follows the section under the nav.
import { soundOn, toggleSound, onSoundChange } from '../sound.js';
import { initCurtain } from '../curtain.js';
import { hoverSounds } from '../sfx.js';
import { initCursor } from '../cursor.js';

let resolveLogo;
/** Resolves with the nav logo API ({ setActive, kick, … }) or null when it stays static. */
export const navLogo = new Promise(r => { resolveLogo = r; });

export function initNav() {
  initCurtain();
  hoverSounds();             // soft blip on hovering pills / buttons (src/sfx.js)
  initCursor();              // dot beside the arrow (src/cursor.js)

  const btn = document.querySelector('[data-sound-toggle]');
  if (btn) {
    const sync = on => {
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    };
    sync(soundOn());
    onSoundChange(sync);
    btn.addEventListener('click', () => toggleSound());
  }

  const logo = document.querySelector('[data-logo3d]');
  if (logo && window.WebGL2RenderingContext) {
    const start = () => import('./logo3d.js')
      .then(m => m.mountLogo3D(logo))
      .then(api => { if (api) logo.classList.add('is-3d'); resolveLogo(api); })
      .catch(err => { console.warn('nav logo: staying on the static image', err); resolveLogo(null); });
    // Home hands its big logo over to this one, so it has to be ready early there
    if (document.body.hasAttribute('data-logo-dock')) start();
    else {
      const idle = () => (window.requestIdleCallback ? requestIdleCallback(start, { timeout: 800 }) : setTimeout(start, 0));
      if (document.readyState === 'complete') idle(); else addEventListener('load', idle);
    }
  } else resolveLogo(null);

  followSectionTheme();
  mobileMenu();
}

// Phones: "Menu" opens the page pills as a dropdown; any tap outside, a link or Esc closes it.
function mobileMenu() {
  const nav = document.querySelector('.nav'), btn = nav?.querySelector('.nav__menu');
  if (!btn) return;
  const set = open => {
    nav.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '×' : 'Menu'; btn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  };
  btn.addEventListener('click', e => { e.stopPropagation(); set(!nav.classList.contains('is-open')); });
  document.addEventListener('click', e => { if (nav.classList.contains('is-open') && !e.target.closest('.nav__pills, .nav__big')) set(false); });
  nav.querySelector('.nav__pills').addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  nav.querySelector('.nav__big')?.addEventListener('click', () => set(false));
  addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  addEventListener('scroll', () => { if (nav.classList.contains('is-open')) set(false); }, { passive: true });
}

// Sections marked data-nav-theme="dark" switch the pills to the dark-section glass while they sit under the
// nav (black glass vanishes on black). Pages with a fixed theme (Drafts: body[data-nav]) skip this.
function followSectionTheme() {
  const body = document.body;
  if (body.hasAttribute('data-nav') || !document.querySelector('[data-nav-theme]')) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const hit = document.elementsFromPoint(innerWidth / 2, 34).map(el => el.closest('[data-nav-theme]')).find(Boolean);
    const dark = hit?.dataset.navTheme === 'dark';
    // the result lives in a different attribute than the sections' one — otherwise closest() above
    // would find <body> itself next time and the nav would stay dark for good
    if (dark !== (body.dataset.navTone === 'dark')) body.dataset.navTone = dark ? 'dark' : 'light';
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
}
