import { initNav } from '../nav/nav.js';
import { mountRing } from './ring.js';

initNav();
const $ = id => document.getElementById(id);
window.__ring = mountRing({ host: $('gl'), ruler: $('ruler'), caption: $('drTitle'), meta: $('drMeta'), count: $('drCount'), prevBtn: $('drPrev'), nextBtn: $('drNext') });
