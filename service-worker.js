const CACHE = "triangle-progress-v3";

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([
        "./",
        "./index.html",
        "./style.css",
        "./sketch.js",
        "./manifest.json",
        "./image/icon-192.png",
        "./image/icon-512.png",
        "https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js",
        "https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/addons/p5.sound.min.js"
      ])
    )
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
