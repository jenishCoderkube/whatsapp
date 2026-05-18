const CACHE_NAME = "whatsapp-pwa-cache-v1";
const ASSETS_TO_CACHE = [
  "/chat",
  "/login",
  "/register",
  "/icon.svg",
  "/manifest.json",
];

// Install: Cache essential Shell Assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching App Shell...");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-while-revalidate strategy for maximum speed and offline support
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and skip Supabase/API calls to avoid caching dynamic real-time data
  if (
    event.request.method !== "GET" || 
    event.request.url.includes("/rest/v1/") || 
    event.request.url.includes("/auth/v1/") ||
    event.request.url.includes("supabase.co")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fetch fails, return cached response if available
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
