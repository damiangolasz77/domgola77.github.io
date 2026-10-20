import { initNav } from '../nav/nav.js';
import { soundOn } from '../sound.js';
import { initSmoothScroll } from '../smooth-scroll.js';
import { pageReady } from '../curtain.js';
import { mountAbout } from './about.js';
import { mountFooter } from '../footer/footer.js';
import { mountStack } from './stack.js';

initNav();
initSmoothScroll();
mountFooter();
mountStack(document.getElementById('aboutContent'));

// choreography progress: the first 620 of the track's 880vh (see about.css), independent of what follows
const track = document.getElementById('track');
const CHOREO = 620 / 880;
const progress = () => Math.min(1, Math.max(0, scrollY / (track.offsetHeight * CHOREO)));

// "Have fun then scroll" lives only in the start state: it lifts, blurs and fades over the first
// few percent of the scroll (about the first 20 % of a screen), and comes back at the top.
const title = document.getElementById('introTitle');
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function styleTitle() {
  const t = smooth(0, 0.035, progress());
  title.style.opacity = (1 - t).toFixed(3);
  title.style.transform = `translateY(calc(-50% - ${(t * 0.4).toFixed(3)}em))`;
  title.style.filter = t > 0.01 ? `blur(${(t * 10).toFixed(1)}px)` : '';
}
addEventListener('scroll', styleTitle, { passive: true });
addEventListener('resize', styleTitle);
styleTitle();

const start = () => mountAbout({
  host: document.getElementById('gl'),
  slots: [...document.querySelectorAll('[data-slot]')],
  words: [...document.querySelectorAll('h1 .w')],
  soundEnabled: soundOn,
  variant: 'drop',
  progress,
}).then(api => { window.__about = api; document.body.classList.add('ready'); window.__ready = true; })
  .catch(err => { console.error(err); document.body.classList.add('ready'); });

// wait for the display face so the slots are measured on the final line breaks
// the page curtain lifts once the scene is up
pageReady((document.fonts?.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve()).then(start));
