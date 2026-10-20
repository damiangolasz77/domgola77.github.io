// Case study drawer — the reusable component from Figma (personal-brand, node 127:633).
// openDrawer(caseData, opener) builds it from data, slides it in from the right and keeps the page
// still underneath; a click outside or Esc closes it (focus goes back to the opener); phones also get a ×.
// Data (content.js, `details` on a case):
//   { kind, lead, roles: [..], meta: [..], sections: [{ title, items: [{ h, p }] }], credits: [..] }
// plus the case's own title. No photos in it (on request) — the strip on the page shows them.
import { getLenis } from '../smooth-scroll.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let current = null;

function section(title, body, mod = '') {
  const s = el('section', `dw__sec ${mod}`.trim());
  s.append(el('h3', 'dw__h', title), body);
  return s;
}

function build(c) {
  const d = c.details;
  const root = el('div', 'dw-root');
  const backdrop = el('div', 'dw-backdrop');
  const shell = el('div', 'dw');
  shell.setAttribute('role', 'dialog'); shell.setAttribute('aria-modal', 'true'); shell.setAttribute('aria-label', c.title);
  shell.tabIndex = -1;
  const close = el('button', 'dw__close'); close.type = 'button'; close.setAttribute('aria-label', 'Close');   // shown on phones only (CSS)
  close.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const scroll = el('div', 'dw__scroll');
  scroll.setAttribute('data-lenis-prevent', '');                  // the page's smooth scroll leaves this one alone

  // header: kind | title, lead … roles + meta at the bottom
  const head = el('header', 'dw__head');
  const right = el('div', 'dw__intro');
  right.append(el('h2', 'dw__title', c.title), el('p', 'dw__lead', d.lead));
  const foot = el('div', 'dw__foot');
  const roles = el('ul', 'dw__mono'); d.roles.forEach(r => roles.append(el('li', '', r)));
  const meta = el('ul', 'dw__mono dw__meta'); d.meta.forEach(m => meta.append(el('li', '', m)));
  foot.append(roles, meta); right.append(foot);
  head.append(el('p', 'dw__h dw__kind', d.kind), right);
  scroll.append(head);

  for (const s of d.sections) {
    const list = el('div', 'dw__items');
    for (const it of s.items) { const b = el('div', 'dw__item'); b.append(el('h4', '', it.h), el('p', '', it.p)); list.append(b); }
    scroll.append(section(s.title, list));
  }
  if (d.credits?.length) { const cr = el('ul', 'dw__mono'); d.credits.forEach(n => cr.append(el('li', '', n))); scroll.append(section('Credits', cr)); }

  const grab = el('div', 'dw__grab'); grab.setAttribute('aria-hidden', 'true');   // phones: drag the sheet down to close (CSS shows it)
  shell.append(scroll, grab, close);
  root.append(backdrop, shell);
  return { root, backdrop, shell, close, scroll, grab };
}

export function openDrawer(c, opener) {
  if (current) return;
  const parts = build(c);
  const { root, backdrop, shell, close, grab } = parts;
  document.body.append(root);
  document.documentElement.classList.add('dw-lock');
  getLenis()?.stop();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-open')));
  shell.focus({ preventScroll: true });

  const onKey = e => { if (e.key === 'Escape') closeDrawer(); };
  backdrop.addEventListener('click', () => closeDrawer());
  close.addEventListener('click', () => closeDrawer());
  dragToClose(shell, grab);
  addEventListener('keydown', onKey);
  current = { root, opener, onKey };
}

export function closeDrawer() {
  if (!current) return;
  const { root, opener, onKey } = current; current = null;
  removeEventListener('keydown', onKey);
  root.classList.remove('is-open'); root.classList.add('is-closing');
  const done = () => {
    root.remove();
    document.documentElement.classList.remove('dw-lock');
    getLenis()?.start();
    opener?.focus?.({ preventScroll: true });
  };
  if (reduce) done(); else setTimeout(done, 620);
}

// Phones: the grab handle drags the bottom sheet; let go past a third of its height (or flick down) to close,
// otherwise it springs back.
function dragToClose(shell, grab) {
  let start = null;
  grab.addEventListener('pointerdown', e => {
    start = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
    grab.setPointerCapture(e.pointerId);
    shell.classList.remove('is-settling'); shell.classList.add('is-dragging');
  });
  grab.addEventListener('pointermove', e => {
    if (!start) return;
    const now = performance.now(), dy = Math.max(0, e.clientY - start.y);
    start.v = (dy - start.dy) / Math.max(1, now - start.t); start.dy = dy; start.t = now;
    shell.style.transform = `translate3d(0, ${dy}px, 0)`;
  });
  const end = () => {
    if (!start) return;
    const { dy, v } = start; start = null;
    shell.classList.remove('is-dragging');
    if (dy > shell.offsetHeight / 3 || v > .6) { shell.style.transform = ''; closeDrawer(); return; }
    shell.classList.add('is-settling'); shell.style.transform = '';
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
}
