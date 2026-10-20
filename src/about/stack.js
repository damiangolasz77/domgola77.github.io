// About blocks stack like cards: each one is sticky right under the "About" title, so the next one
// slides over it. A block taller than the space under the title first scrolls until its bottom
// reaches the bottom of the screen, then sticks — so nothing is ever hidden before it was readable.
export function mountStack(section) {
  const head = section.querySelector('.ab__head');
  const blocks = [...section.querySelectorAll('.ab__block')];
  function layout() {
    const top = head.offsetHeight;
    for (const b of blocks) b.style.setProperty('--stick', Math.min(top, innerHeight - b.offsetHeight) + 'px');
  }
  // a block whose top has gone above the divider line has content sliding under it → show the fade
  let raf = 0;
  const under = () => {
    raf = 0;
    const line = head.getBoundingClientRect().bottom;
    for (const b of blocks) b.classList.toggle('is-under', b.getBoundingClientRect().top < line - 2);
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(under); }, { passive: true });
  layout();
  addEventListener('resize', layout);
  document.fonts?.ready.then(layout);
  new ResizeObserver(layout).observe(section);
}
