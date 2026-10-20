// Site-wide sound switch + one shared AudioContext.
// Pages ask `soundOn()` before playing and take the context from `audioContext()`.
// Switching off suspends the context, so anything already playing stops at once.
const KEY = 'dg:sound';
const subs = new Set();
let on = read();
let ctx = null;

function read() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export const soundOn = () => on;

export function setSound(v) {
  on = !!v;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
  if (ctx) on ? ctx.resume() : ctx.suspend();
  subs.forEach(fn => fn(on));
}

export const toggleSound = () => setSound(!on);
export function onSoundChange(fn) { subs.add(fn); return () => subs.delete(fn); }

/** Shared context; null until the browser allows audio (first click / key press). */
export function audioContext() {
  if (!ctx) return null;
  if (on && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Browsers only start audio after a user gesture, so create/resume it on the first one.
function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (on && ctx.state === 'suspended') ctx.resume();
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true, passive: true });

// another tab flipped the switch
addEventListener('storage', e => { if (e.key === KEY) setSound(e.newValue !== 'off'); });
