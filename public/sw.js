const CACHE_NAME = "mreitibot-shell-v2";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return;

  // Next.js bundle les JS/CSS avec un hash dans le nom de fichier
  // (/_next/static/...), donc network-first est sûr pour eux (un nouveau
  // déploiement change le hash, l'ancien fichier caché n'est simplement plus
  // référencé) — mais cache-first pour ces routes servait indéfiniment un
  // bundle périmé si la requête réseau réussissait quand même à cacher un
  // fichier avant que l'app ait pu naviguer, laissant l'UI figée sur un
  // ancien build après un déploiement tant que le cache n'expire pas.
  // Network-first partout, avec repli sur le cache uniquement hors-ligne.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
