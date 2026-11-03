// Vicarus: offline support.
// App files are cached on install; satellite tiles and fonts are cached as you view them.
const VERSION = "v3";
const APP = `app-${VERSION}`, TILES = "tiles", FONTS = "fonts";
const MAX_TILES = 1500;
const APP_FILES = ["./", "index.html", "places.js", "manifest.webmanifest",
  "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-64.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith("app-") && k !== APP).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

async function trim(name, max){
  const c = await caches.open(name); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Satellite tiles: cache first, keep the most recent ones.
  if (url.hostname.endsWith("arcgisonline.com")) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === "cors") { c.put(req, res.clone()); trim(TILES, MAX_TILES); }
      return res;
    }));
    return;
  }
  // Fonts: cache first.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
    return;
  }
  // App files: network first so updates arrive, cache when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put(req, copy)); }
      return res;
    }).catch(async () => (await caches.match(req, {ignoreSearch: true})) ||
                         (req.mode === "navigate" ? caches.match("index.html") : Response.error())));
  }
});
