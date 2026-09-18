/* Gentle life for the page: butterflies and balloons drifting past, and a slow, soft change of background tint.
   Everything is decorative (aria-hidden) and switches itself off when the visitor prefers reduced motion,
   when the tab is hidden, or on very small screens (fewer flyers). */
(() => {
  "use strict";
  const TINTS = ["cream", "rose", "mint", "sky", "sun", "lilac", "peach"];
  const FLYERS = [
    { emo: "🦋", cls: "fly-b", n: 2 },
    { emo: "🎈", cls: "fly-o", n: 1 },
    { emo: "🕊️", cls: "fly-b", n: 1 }
  ];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- soft background tint, changed slowly ---------- */
  let tint = TINTS[(Math.random() * TINTS.length) | 0];
  const setTint = t => { tint = t; document.documentElement.setAttribute("data-tint", t); };
  setTint(tint);
  if (!reduce) setInterval(() => {
    if (document.hidden) return;
    let t; do { t = TINTS[(Math.random() * TINTS.length) | 0]; } while (t === tint);
    setTint(t);
  }, 75000);

  /* ---------- butterflies and balloons ---------- */
  function fly(emo, cls) {
    const el = document.createElement("span");
    el.className = "flyer " + cls;
    el.textContent = emo;
    const up = cls === "fly-o"; // balloons rise, butterflies cross
    el.style.setProperty("--dur", `${up ? rnd(38, 70) : rnd(26, 52)}s`);
    el.style.setProperty("--delay", `-${rnd(0, 40)}s`);
    el.style.setProperty("--y", `${rnd(12, 82)}%`);
    el.style.setProperty("--x", `${rnd(5, 88)}%`);
    el.style.setProperty("--swing", `${rnd(18, 52)}px`);
    el.style.setProperty("--size", `${rnd(20, 34)}px`);
    el.style.setProperty("--dir", Math.random() < 0.5 ? "normal" : "reverse");
    return el;
  }
  function start() {
    if (reduce) return;
    const layer = document.querySelector(".doodles") || document.body;
    const small = innerWidth < 640;
    for (const f of FLYERS) {
      const n = small ? Math.max(1, f.n - 1) : f.n;
      for (let i = 0; i < n; i++) layer.appendChild(fly(f.emo, f.cls));
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
