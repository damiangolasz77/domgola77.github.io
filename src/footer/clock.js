// Footer clock: Warsaw time on the Figma face (60 ticks, grey hour/minute hands, red sweeping second hand).
// Only ticks while the footer is on screen.
const NS = 'http://www.w3.org/2000/svg';

export function mountClock(root) {
  const ticks = root.querySelector('.clock__ticks');
  for (let i = 0; i < 60; i++) {                // hour marks 5 long / 1 wide, minute marks 2.5 / 0.5 — as in Figma
    const a = i / 60 * Math.PI * 2, major = i % 5 === 0, r0 = major ? 45 : 47.5;
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', 50 + Math.sin(a) * 50); l.setAttribute('y1', 50 - Math.cos(a) * 50);
    l.setAttribute('x2', 50 + Math.sin(a) * r0); l.setAttribute('y2', 50 - Math.cos(a) * r0);
    l.setAttribute('stroke-width', major ? 1 : 0.5);
    ticks.append(l);
  }
  const [h, m, s] = ['h', 'm', 's'].map(k => root.querySelector(`.clock__hand--${k}`));
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });

  let raf = 0, visible = false;
  function tick() {
    const now = new Date();
    const p = Object.fromEntries(fmt.formatToParts(now).map(x => [x.type, +x.value]));
    const sec = p.second + now.getMilliseconds() / 1000, min = p.minute + sec / 60, hr = (p.hour % 12) + min / 60;
    s.style.transform = `rotate(${sec * 6}deg)`;
    m.style.transform = `rotate(${min * 6}deg)`;
    h.style.transform = `rotate(${hr * 30}deg)`;
    raf = visible ? requestAnimationFrame(tick) : 0;
  }
  tick();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(tick); }).observe(root);
}
