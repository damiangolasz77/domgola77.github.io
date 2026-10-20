// The key for /more/. Nothing in the code reveals it: the studio case studies are encrypted
// (src/more/sealed.json, AES-256-GCM with a key derived from the key phrase by PBKDF2) and only a correct
// phrase can decrypt them — that IS the check. A browser that unlocked once keeps the derived key
// (localStorage, tied to this seal's salt), so it opens straight away next time.
import sealed from './sealed.json';

const STORE = 'dg:more-k';
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const toB64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));

async function derive(phrase) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(sealed.salt), iterations: sealed.iter },
    base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
}
async function open(key) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(sealed.iv) }, key, b64(sealed.data));   // throws on a wrong key
  return JSON.parse(new TextDecoder().decode(plain));
}

/** { studios, logos } from a key this browser kept, or null (the stored key is dropped if it no longer fits). */
export async function remembered() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!s || s.salt !== sealed.salt) return null;
    const key = await crypto.subtle.importKey('raw', b64(s.k), 'AES-GCM', false, ['decrypt']);
    return await open(key);
  } catch { try { localStorage.removeItem(STORE); } catch {} return null; }
}

/** Wires the form; resolves with the decrypted { studios, logos } once the right key is in. */
export function gate(form, { onWrong } = {}) {
  const input = form.querySelector('input'), btn = form.querySelector('button');
  return new Promise(resolve => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      btn.disabled = true;
      try {
        const key = await derive(input.value.trim().toLowerCase());
        const studios = await open(key);
        try { localStorage.setItem(STORE, JSON.stringify({ salt: sealed.salt, k: toB64(await crypto.subtle.exportKey('raw', key)) })); } catch {}
        input.blur();
        resolve(studios);
      } catch {
        form.classList.remove('is-wrong'); void form.offsetWidth; form.classList.add('is-wrong');
        input.select(); onWrong?.();
      } finally { btn.disabled = false; }
    });
  });
}
