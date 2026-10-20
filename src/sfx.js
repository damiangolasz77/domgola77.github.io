// Small synthesized UI sounds, all through the shared context in sound.js (so the speaker pill
// mutes them and nothing plays before the first click/key — browsers don't allow it earlier).
//  - tick():  the short mechanical click of the Drafts ring, also used by Home's "6+ years" list
//  - hover(): a very soft glassy blip for pills and buttons (mouse only)
//  - knock(): a gentle chrome "tok" for the outro logo hitting the screen edges
import { audioContext, soundOn } from './sound.js';

const live = () => (soundOn() ? audioContext() : null);

let noise = null;
function noiseBuf(ctx) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * .03), ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
  }
  return noise;
}

let lastTick = -1;
/** v 0..1 = how fast things move (louder when faster). */
export function tick(v = 0, level = .2) {
  const ctx = live(); if (!ctx) return;
  const now = ctx.currentTime; if (now - lastTick < .022) return; lastTick = now;
  const vol = level * Math.min(1, .45 + v * .55);
  const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200 + Math.random() * 600; bp.Q.value = 1.4;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(.0001, now + .03);
  n.connect(bp).connect(g).connect(ctx.destination); n.start(now);
}

let lastHover = -1;
export function hover() {
  const ctx = live(); if (!ctx) return;
  const now = ctx.currentTime; if (now - lastHover < .05) return; lastHover = now;
  const f = 1750 + Math.random() * 120;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * .72, now + .05);
  const g = ctx.createGain();
  g.gain.setValueAtTime(.0001, now); g.gain.exponentialRampToValueAtTime(.045, now + .004); g.gain.exponentialRampToValueAtTime(.0001, now + .07);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000;
  o.connect(lp).connect(g).connect(ctx.destination); o.start(now); o.stop(now + .08);
}

/** pan −1..1 (where it hit), level 0..1 (how much of the section is showing), pitch ~1. */
export function knock(pan = 0, level = 1, pitch = 1) {
  const ctx = live(); if (!ctx || level <= .01) return;
  const now = ctx.currentTime, vol = .07 * level;   // quieter on request (was .16)
  const out = ctx.createGain(); out.gain.value = vol;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p).connect(ctx.destination); } else out.connect(ctx.destination);
  // body: a short pitched "tok" with a hint of metal (inharmonic partial) on top
  const f = 380 * pitch * (1 + (Math.random() - .5) * .04);
  for (const [mul, amp, dec] of [[1, 1, .16], [2.76, .28, .07], [5.4, .08, .035]]) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * mul * 1.06, now); o.frequency.exponentialRampToValueAtTime(f * mul, now + .02);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, now); g.gain.exponentialRampToValueAtTime(amp, now + .003); g.gain.exponentialRampToValueAtTime(.0001, now + dec);
    o.connect(g).connect(out); o.start(now); o.stop(now + dec + .02);
  }
  // contact click
  const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = .9;
  const g = ctx.createGain(); g.gain.setValueAtTime(.35, now); g.gain.exponentialRampToValueAtTime(.0001, now + .012);
  n.connect(bp).connect(g).connect(out); n.start(now);
}

/** Hover blips for everything that looks like a button (delegated, mouse only, once per element entry). */
const HOVER_SEL = '.pill, .works__more, .footer__cta, .dr__arrow, [data-sfx-hover]';
export function hoverSounds(root = document) {
  root.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target.closest?.(HOVER_SEL);
    if (!t || t.contains(e.relatedTarget) || t.matches('[aria-hidden="true"], .case__soon')) return;
    hover();
  }, { passive: true });
}
