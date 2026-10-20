import { initNav, navLogo } from '../nav/nav.js';
import { initSmoothScroll } from '../smooth-scroll.js';
import { pageReady, revealed } from '../curtain.js';
import { splitWords, playIntro, tidySlashes } from './intro.js';
import { mountHeroLogo } from './hero-logo.js';
import { mountWorks, mountYears } from './sections.js';
import { mountFooter } from '../footer/footer.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
initNav();
initSmoothScroll();
const $ = id => document.getElementById(id);

// ---------- live bits of the headline: Warsaw clock (with live seconds), age ----------
// Minutes + seconds: each digit sits in a box as wide as the font's widest digit (--dw, measured), so the
// ticking seconds never change the line's width — nothing in the hero moves. (The font's own tabular
// figures are much looser.) The hour keeps normal spacing.
const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: 'numeric', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const offsetFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', timeZoneName: 'shortOffset' });
function measureDigits() {
  const el = $('heroClock'), cs = getComputedStyle(el), ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const w = Math.max(...'0123456789'.split('').map(d => ctx.measureText(d).width));
  el.style.setProperty('--dw', (w / parseFloat(cs.fontSize)).toFixed(4) + 'em');
}
let lastMinute = '';
function liveFacts() {
  const now = new Date();
  const p = Object.fromEntries(clockFmt.formatToParts(now).map(x => [x.type, x.value]));
  const offset = offsetFmt.formatToParts(now).find(x => x.type === 'timeZoneName')?.value || 'GMT+1';
  const zone = /\+2/.test(offset) ? 'CEST' : 'CET';
  const box = t => t.replace(/\d/g, d => `<span class="dg">${d}</span>`);
  $('heroClock').innerHTML = `${+p.hour}:${box(p.minute)}:${box(p.second)} ${zone} (${offset.replace('GMT', 'UTC')})`;
  const born = new Date(2002, 3, 11);
  let age = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), 3, 11)) age--;
  $('heroBirth').textContent = `11.04.2002 (${age})`;
  const minute = `${p.hour}:${p.minute}`;
  if (minute !== lastMinute) { const first = !lastMinute; lastMinute = minute; if (!first) tidySlashes(heroBlocks()); }
}
liveFacts();
document.fonts?.ready.then(measureDigits); measureDigits();
setTimeout(() => { liveFacts(); setInterval(liveFacts, 1000); }, 1000 - (Date.now() % 1000));   // tick on the second
const heroBlocks = () => [...document.querySelectorAll('.hero__text')];

// ---------- sections ----------
mountWorks($('cases'));
mountYears($('yearGroups'));
mountFooter();

// Hero layout. Desktop: the hero is sticky and Works rises over it from --hero-h (most of the screen,
// a band of Works peeks in). Phones and short screens: the copy doesn't fit one screen, so the hero
// becomes a normal block (.is-flow). Phones use the sticky layout too whenever the copy fits.
const intro = document.querySelector('.intro'), hero = $('hero'), heroInner = $('heroInner'), slot = $('heroLogoSlot');
const phone = matchMedia('(max-width: 760px)');
const STRIP = 28;           // px of black Works peeking in at the bottom — just a strip, the "Works" title stays hidden
function heroLayout() {
  const u = innerWidth / 1512;
  const texts = heroInner.querySelectorAll('.hero__text'), last = texts[texts.length - 1];
  const cols = heroInner.querySelector('.hero__cols'), gut = 24;
  const content = last.offsetTop + last.offsetHeight + Math.max(40, 48 * u) + cols.offsetHeight + gut;   // headline, gap, paragraphs, bottom margin
  const flow = content > innerHeight - STRIP;            // only when the copy can't fit one screen
  intro.classList.toggle('is-flow', flow);
  intro.style.setProperty('--hero-h', Math.max(innerHeight - STRIP, content, slot.offsetTop + slot.offsetHeight + 48 * u) + 'px');
}
heroLayout();
addEventListener('resize', heroLayout);

// hero parallax while Works slides over it (desktop, sticky hero only)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce) {
  let raf = 0;
  const parallax = () => {
    raf = 0;
    const y = intro.classList.contains('is-flow') ? 0 : Math.min(scrollY, innerHeight * 1.5);
    heroInner.style.transform = y ? `translate3d(0, ${(-y * 0.28).toFixed(1)}px, 0)` : '';
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(parallax); }, { passive: true });
}

// ---------- big logo + intro ----------
const words = [...splitWords(heroBlocks(), [$('heroClock'), $('heroBirth')]), ...document.querySelectorAll('.hero__cols p')];
tidySlashes(heroBlocks());
addEventListener('resize', () => tidySlashes(heroBlocks()));
document.fonts?.ready.then(() => tidySlashes(heroBlocks()));
const heroLogo = window.WebGL2RenderingContext
  ? mountHeroLogo({
      host: $('heroLogo'), slot, navSlot: document.querySelector('.nav__logo'),
      onDock: docked => {
        document.body.classList.toggle('logo-docked', docked);
        navLogo.then(api => api?.setActive(docked));
      },
    }).catch(err => { console.warn('hero logo:', err); return null; })
  : Promise.resolve(null);
if (!window.WebGL2RenderingContext) document.body.classList.add('logo-docked');   // static nav logo instead

pageReady(document.fonts?.ready);
// once the real fonts are in, line breaks (and so the phone logo slot) can move: re-measure
document.fonts?.ready.then(() => { heroLayout(); heroLogo.then(l => l?.measure()); });
playIntro({
  words, role: $('heroRole'), revealed,
  ready: Promise.all([document.fonts?.ready, heroLogo]),
  onHeadline: () => heroLogo.then(l => l ? l.show() : document.body.classList.add('logo-docked')),
});
