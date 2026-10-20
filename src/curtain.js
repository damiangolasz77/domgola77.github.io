// Page transition: one dark blind, the same on every page.
//   leave:  the blind rolls up from the bottom edge and covers the page → navigate
//   arrive: the new page loads behind it, and once it's ready the blind keeps rolling up and off the top
// Pages say when they're ready with pageReady(promise); Drafts waits for `revealed` to start its intro.
const COVER_MS = 750;
const REVEAL_MS = 900;
const EASE = 'cubic-bezier(.76, 0, .24, 1)';      // slow start, fast middle, soft landing
const MAX_WAIT_MS = 3500;                           // never keep the page covered longer than this

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const arrived = !!window.__curtainArrived;
let el = null, leaving = false, readyCalled = false;

let resolveRevealed;
/** Resolves when the blind starts lifting (immediately on a direct load). */
export const revealed = new Promise(r => { resolveRevealed = r; });
export const arrivedThroughCurtain = arrived;

const wait = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

/** Call once per page with a promise that settles when the page is worth showing. */
export function pageReady(promise = Promise.resolve()) {
  if (readyCalled) return; readyCalled = true;
  if (!arrived) { resolveRevealed(); return; }
  Promise.race([Promise.resolve(promise).catch(() => {}), wait(MAX_WAIT_MS)]).then(nextFrame).then(reveal);
}

function reveal() {
  if (!el) { root.classList.remove('curtain-covered'); resolveRevealed(); return; }
  resolveRevealed();
  if (reduce) { root.classList.remove('curtain-covered'); return; }
  const anim = el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], { duration: REVEAL_MS, easing: EASE, fill: 'forwards' });
  anim.finished.then(() => { root.classList.remove('curtain-covered'); anim.cancel(); });
}

function leave(url) {
  if (leaving) return; leaving = true;
  try { sessionStorage.setItem('dg:curtain', '1'); } catch {}
  if (!el || reduce) { location.href = url; return; }
  const anim = el.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: COVER_MS, easing: EASE, fill: 'forwards' });
  anim.finished.then(() => { location.href = url; });
}

export function initCurtain() {
  el = document.querySelector('.curtain');
  // a page that forgets pageReady() still gets uncovered
  setTimeout(() => pageReady(), MAX_WAIT_MS);

  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }   // placeholder links (LD)
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    e.preventDefault();
    if (url.pathname === location.pathname) {           // same page: just glide to the anchor / top
      const target = url.hash ? document.querySelector(url.hash) : null;
      if (window.__lenis) window.__lenis.scrollTo(target || 0, { offset: -80 }); else (target ? target.scrollIntoView({ behavior: 'smooth' }) : scrollTo({ top: 0, behavior: 'smooth' }));
      return;
    }
    leave(url.href);
  });

  // back/forward cache: the page comes back exactly as we left it — covered. Uncover it.
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    leaving = false;
    el?.getAnimations().forEach(a => a.cancel());
    root.classList.remove('curtain-covered');
  });
}
