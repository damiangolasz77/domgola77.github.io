// Home intro.
//   Preloader (first visit in a session): small "Dominik Gola" in the middle of a white screen →
//   it slides away for "Creative Designer & Developer" → that line flies into its place in the
//   headline, growing to full size and turning blue → the rest of the headline rises in.
//   Later visits (and reduced motion) skip straight to the headline rise.
const EASE = 'cubic-bezier(.76, 0, .24, 1)';
const OUT_EXPO = 'cubic-bezier(.16, 1, .3, 1)';
const SMALL_PX = 24;                 // preloader type size
const SEEN = 'dg:intro-seen';
const wait = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;

/** Wrap every word of the headline in span.w (the clock and birth date stay whole), skipping the blue role. */
export function splitWords(blocks, keepWhole) {
  const words = [];
  for (const block of blocks) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement.closest('.hero__role') || keepWhole.some(k => k.contains(node))) continue;
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/([ \t\n\r]+)/)) {    // not \s: a no-break space glues "/" to the next phrase
        if (!part) continue;
        if (/^[ \t\n\r]+$/.test(part)) { frag.append(part); continue; }
        const w = document.createElement('span'); w.className = 'w'; w.textContent = part; frag.append(w);
      }
      node.replaceWith(frag);
    }
  }
  for (const k of keepWhole) k.classList.add('w');
  // a word that begins with "/ " gets the slash in its own span, so it can be hidden at a line start
  for (const w of blocks.flatMap(b => [...b.querySelectorAll('.w')])) {
    const t = w.firstChild;
    if (t?.nodeType === 3 && t.textContent.startsWith('/\u00a0')) {
      const sl = document.createElement('span'); sl.className = 'sl'; sl.textContent = '/\u00a0';
      t.textContent = t.textContent.slice(2); w.prepend(sl);
    }
  }
  // reading order
  return [...document.querySelectorAll('.hero__text .w')];
}

function riseWords(words, delay = 0) {
  root.classList.remove('hero-hidden');
  return Promise.all(words.map((w, i) => w.animate(
    [{ opacity: 0, transform: 'translateY(.35em)' }, { opacity: 1, transform: 'none' }],
    { duration: 900, delay: delay + i * 14, easing: OUT_EXPO, fill: 'backwards' }).finished));
}

/** The copy keeps its slashes, but a slash that would open a line is hidden (glued to the next phrase,
    it can never close one). Re-run after anything that can move line breaks. */
export function tidySlashes(blocks) {
  for (const block of blocks) {
    block.querySelectorAll('br.sl-br').forEach(b => b.remove());
    const words = [...block.querySelectorAll('.w')].filter(w => !w.parentElement.closest('.w'));
    words.forEach(w => w.classList.remove('sl-start'));
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (!w.firstElementChild?.classList.contains('sl')) continue;
      const prev = words[i - 1], top = () => w.getBoundingClientRect().top;
      if (prev && Math.abs(top() - prev.getBoundingClientRect().top) <= 2) continue;   // mid-line: keep the slash
      w.classList.add('sl-start');
      // without its slash the word might now fit on the line above — keep it where it was
      if (prev && Math.abs(top() - prev.getBoundingClientRect().top) <= 2) {
        const br = document.createElement('br'); br.className = 'sl-br';
        (w.closest('.hero__glue') || w).before(br);
      }
    }
  }
}

export async function playIntro({ words, role, ready, onHeadline, revealed }) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { sessionStorage.setItem(SEEN, '1'); } catch {}
  await revealed;                                       // the page curtain (if we came through it) has lifted

  if (!root.classList.contains('is-preloading')) {      // decided in <head> (index.html): seen this session / reduced motion
    onHeadline?.();
    if (!reduceMotion) await riseWords(words); else root.classList.remove('hero-hidden');
    return;
  }

  const line = document.querySelector('.preload__line');
  const name = document.getElementById('preloadName'), roleWord = document.getElementById('preloadRole');
  const lenis = window.__lenis; lenis?.stop();
  scrollTo(0, 0);
  await Promise.race([document.fonts?.ready, wait(1500)]);   // lay out on the real font

  // lay the line out at headline size, scaled down to a small label in the middle of the screen
  const fs = parseFloat(getComputedStyle(role).fontSize);
  const target = role.getBoundingClientRect();
  const s = Math.min(SMALL_PX / fs, innerWidth * 0.9 / target.width);   // phones: never wider than the screen
  line.style.width = target.width + 'px';
  const w = target.width, h = line.getBoundingClientRect().height;
  const centre = `translate(${innerWidth / 2 - w * s / 2}px, ${innerHeight / 2 - h * s / 2}px) scale(${s})`;
  line.style.transform = centre; line.style.opacity = 1;

  const slide = (el, from, to, opts = {}) => el.animate([{ transform: `translateY(${from})` }, { transform: `translateY(${to})` }],
    { duration: 700, easing: EASE, fill: 'forwards', ...opts }).finished;

  await wait(250);
  await slide(name, '105%', '0%');
  await wait(550);
  await Promise.all([slide(name, '0%', '-105%'), slide(roleWord, '105%', '0%', { delay: 80 })]);
  await Promise.race([ready, wait(2500)]);              // the 3D logo / fonts
  await wait(250);

  // fly into the headline: position + size + colour
  const fly = line.animate([
    { transform: centre, color: '#0b0b0c' },
    { transform: `translate(${target.left}px, ${target.top}px) scale(1)`, color: '#0051f8' },
  ], { duration: 1200, easing: EASE, fill: 'forwards' });
  // the white screen thins out as the line travels, so the headline is there when it lands
  document.getElementById('preload').animate([{ backgroundColor: '#fff' }, { backgroundColor: 'rgba(255,255,255,0)' }],
    { duration: 500, delay: 900, easing: 'linear', fill: 'forwards' });
  await fly.finished;

  root.classList.remove('is-preloading');             // real blue line takes over, preloader goes
  lenis?.start();
  onHeadline?.();
  await riseWords(words);
}
