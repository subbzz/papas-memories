/* Tiny offline helper: always try the network first (so new versions and private media are never stale),
   and fall back to a cached copy of the page shell only when the device is offline.
   Nothing under /api/ is ever stored: media and sign-in answers stay out of the cache. */
const CACHE = "pm-shell-v1";
const SHELL = ["/", "/family/", "/styles.css", "/app.js", "/music.js", "/sky.js", "/config.js", "/memories.js",
  "/favicon.svg", "/icons/icon-192.png", "/vendor/msal-browser.min.js",
  "/fonts/gochi-hand-latin-400-normal.woff2", "/fonts/fredoka-latin-600-normal.woff2"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/cdn-cgi/")) return;
  e.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh.ok && (request.mode === "navigate" || SHELL.includes(url.pathname))) {
        const copy = fresh.clone(); caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
      }
      return fresh;
    } catch {
      const hit = await caches.match(request, { ignoreSearch: true });
      return hit || caches.match("/") || Response.error();
    }
  })());
});
