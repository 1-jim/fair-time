// Bump VERSION on every release so phones pick up the new app shell.
const VERSION = "fairtime-v1.3.2";
const SHARE = "fairtime-share";
const SHELL = [
  "./",
  "./index.html",
  "./guide.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== SHARE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const scope = self.registration.scope;

  // Android share sheet: Spond > Share > Fair Time
  if (req.method === "POST" && url.href.startsWith(scope) && url.pathname.endsWith("/share")) {
    event.respondWith(
      (async () => {
        try {
          const form = await req.formData();
          const file = form.get("file");
          if (file) {
            const c = await caches.open(SHARE);
            await c.put(
              new URL("shared-file", scope).href,
              new Response(file, { headers: { "x-name": encodeURIComponent(file.name || "shared.xlsx") } }),
            );
          }
        } catch (e) {}
        return Response.redirect(new URL("./?shared=1", scope).href, 303);
      })(),
    );
    return;
  }
  if (req.method !== "GET") return;

  // App pages: network first so updates arrive, cache when offline on the pitch.
  // Each page is cached under its own path, so opening the guide never replaces the app.
  if (req.mode === "navigate" && url.href.startsWith(scope)) {
    const page = url.origin + url.pathname;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(page, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(page)) || (await caches.match("./index.html")) || caches.match("./")),
    );
    return;
  }

  // Google Fonts: serve cached, refresh in the background
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req)
          .then((res) => {
            c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  // Everything else from this site: cache first
  if (url.href.startsWith(scope)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
