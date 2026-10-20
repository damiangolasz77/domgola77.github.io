// Inlined into every page's <head> by the shared-nav plugin (vite.config.js), so it runs before
// the first paint: when we arrive through the curtain, the page starts fully covered.
(function () {
  var arrived = false;
  try { arrived = sessionStorage.getItem('dg:curtain') === '1'; sessionStorage.removeItem('dg:curtain'); } catch (e) {}
  if (arrived) document.documentElement.classList.add('curtain-covered');
  window.__curtainArrived = arrived;
})();
