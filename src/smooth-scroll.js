// Site-wide smooth scrolling (Lenis). It drives the native scroll position, so everything that
// reads scrollY / listens to 'scroll' (About choreography, nav logo spin) just gets smoother input.
// Pages that don't scroll the document (Drafts) simply don't call it.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let lenis = null;

export function initSmoothScroll() {
  if (lenis || matchMedia('(prefers-reduced-motion: reduce)').matches) return lenis;
  lenis = new Lenis({
    autoRaf: true,
    lerp: 0.09,              // lower = floatier
    wheelMultiplier: 1,
  });
  window.__lenis = lenis;
  return lenis;
}

export const getLenis = () => lenis;
