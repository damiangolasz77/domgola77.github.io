// /more/ — hidden "More works" page. Locked: just the headline with the spinning G and a key field.
// With the key: the hero shrinks to its Figma height, the black works slide up under it (sections
// "With @studio" / "Personal", draggable strips), then the shared footer + outro.
import { initNav, navLogo } from '../nav/nav.js';
import { initSmoothScroll } from '../smooth-scroll.js';
import { pageReady } from '../curtain.js';
import { mountHeroLogo } from '../home/hero-logo.js';
import { mountFooter } from '../footer/footer.js';
import { knock, tick } from '../sfx.js';
import { gate, remembered } from './gate.js';
import { mountStrips } from './strips.js';
import { groupsWith } from './content.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
initNav();
initSmoothScroll();
const $ = id => document.getElementById(id);
const root = document.documentElement;

const heroLogo = window.WebGL2RenderingContext
  ? mountHeroLogo({
      host: $('heroLogo'), slot: $('heroLogoSlot'), navSlot: document.querySelector('.nav__logo'),
      onDock: docked => {
        document.body.classList.toggle('logo-docked', docked);
        navLogo.then(api => api?.setActive(docked));
      },
    }).catch(err => { console.warn('hero logo:', err); return null; })
  : Promise.resolve(null);
if (!window.WebGL2RenderingContext) document.body.classList.add('logo-docked');

let built = false;
function build({ studios, logos }) {
  if (built) return; built = true;
  mountLogos(logos);
  mountStrips($('more'), groupsWith(studios));
  mountFooter();
  fitHero();
  addEventListener('resize', fitHero);
  document.fonts?.ready.then(fitHero);
}

// brand strip under the hero (sealed content: it doesn't exist in the page before unlocking); the set is
// doubled so the CSS loop (-50 %) is seamless
function mountLogos(logos = []) {
  const host = $('mlogos'); if (!logos.length) return;
  const img = (l, dup) => { const i = document.createElement('img'); i.src = l.src; i.alt = dup ? '' : l.alt; i.decoding = 'async'; return i; };
  const track = document.createElement('div'), dup = document.createElement('span');
  track.className = 'mlogos__track'; dup.className = 'mlogos__dup'; dup.setAttribute('aria-hidden', 'true');
  dup.append(...logos.map(l => img(l, true)));
  track.append(...logos.map(l => img(l, false)), dup);
  host.append(track); host.hidden = false;
}

// Open hero height: tall enough that only a sliver (PEEK of the screen) of the first case's strip shows
// under it on arrival; never shorter than Figma's 546 px frame (scaled).
const PEEK = 0.05;
function fitHero() {
  const more = $('more'), strip = more.querySelector('.mc__strip');
  if (!strip) return;
  const toStrip = strip.getBoundingClientRect().top - more.getBoundingClientRect().top;   // works top → first strip
  const min = Math.max(546 * innerWidth / 1512, 420);
  document.documentElement.style.setProperty('--mh-open', Math.max(min, innerHeight * (1 - PEEK) - toStrip) + 'px');
}

pageReady(document.fonts?.ready);
document.fonts?.ready.then(() => heroLogo.then(l => { l?.measure(); l ? l.show() : document.body.classList.add('logo-docked'); }));
addEventListener('resize', () => heroLogo.then(l => l?.measure()));

// the key: a browser that unlocked before opens at once (head script guessed it from the stored key;
// if that key no longer decrypts, the page locks again); otherwise wait for the right phrase
function unlock(content, animate) {
  root.classList.remove('more-locked'); root.classList.add('more-open');   // first: the strips measure their tiles, so they must be visible
  build(content);
  if (!animate) return;
  root.classList.add('more-opening');
  knock(0, 1, 1.6); setTimeout(() => knock(0, .7, 2.1), 110);
  // the hero shrinks (CSS transition), so the G's slot moves: follow it until it settles
  const t0 = performance.now();
  const follow = now => { heroLogo.then(l => l?.measure()); if (now - t0 < 1400) requestAnimationFrame(follow); else root.classList.remove('more-opening'); };
  requestAnimationFrame(follow);
}
remembered().then(content => {
  if (content) return unlock(content, false);
  root.classList.remove('more-open'); root.classList.add('more-locked');
  gate($('gate'), { onWrong: () => tick(1, .25) }).then(s => unlock(s, true));
  if (matchMedia('(pointer: fine)').matches) setTimeout(() => $('gateKey').focus({ preventScroll: true }), 1200);   // no keyboard pop-up on phones
});
