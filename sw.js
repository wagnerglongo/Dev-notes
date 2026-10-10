/**
 * Service worker: guarda os arquivos do app para funcionar offline.
 * Estratégia "stale-while-revalidate": responde do cache na hora e
 * atualiza o cache em segundo plano. Ao mudar VERSION, o cache antigo é apagado.
 */
const VERSION = "dev-notes-v2.0.0";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/styles.css",
  "assets/fonts/plex-sans-400.woff2",
  "assets/fonts/plex-sans-600.woff2",
  "assets/fonts/plex-mono-400.woff2",
  "src/main.js",
  "src/markdown.js",
  "src/notes.js",
  "src/storage.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
