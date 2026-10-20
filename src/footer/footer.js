import { mountOutro } from './outro.js';
import { mountClock } from './clock.js';

/** Footer clock + the outro under the footer (markup: src/footer/footer.html). */
export function mountFooter() {
  const $ = id => document.getElementById(id);
  mountOutro({ section: $('outro'), inner: $('outroInner'), logo: $('outroLogo'), footer: document.querySelector('.footer') });
  mountClock($('footerClock'));
}
