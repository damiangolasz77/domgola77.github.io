// /more/ content. Groups → strips (same tile model as Home's Works: type, src, ratio).
// Personal = every case study from Home (same order, same drawers) — public anyway. The other groups are
// encrypted (src/more/sealed.json, made by `npm run seal:more` from private/more-content.js) and only
// exist in the page after the key decrypts them (gate.js). `dummy` = a placeholder case of white slides.
import { CASES } from '../home/content.js';

const blank = ratio => ({ type: 'blank', ratio });
export const dummy = { title: 'Project title', sub: 'Placeholder', tiles: [blank(.8), blank(16 / 9), blank(1), blank(.8), blank(16 / 9), blank(1), blank(.8)] };

export const groupsWith = studios => [...studios, { title: 'Personal', cases: CASES }];
