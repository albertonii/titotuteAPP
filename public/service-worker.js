/* global workbox */

importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js"
);

if (workbox) {
  workbox.core.clientsClaim();
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  workbox.routing.registerRoute(
    ({ request }) => request.mode === "navigate",
    new workbox.strategies.NetworkFirst({ cacheName: "app-shell" })
  );

  workbox.routing.registerRoute(
    ({ request }) => ["style", "script"].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "static-resources",
    })
  );

  workbox.routing.registerRoute(
    ({ url }) =>
      url.origin === self.location.origin && url.pathname.startsWith("/api"),
    new workbox.strategies.NetworkFirst({
      cacheName: "api-cache",
      networkTimeoutSeconds: 5,
    })
  );

  workbox.routing.registerRoute(
    ({ request }) => request.destination === "image",
    new workbox.strategies.CacheFirst({
      cacheName: "images",
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          purgeOnQuotaError: true,
        }),
      ],
    })
  );
} else {
  console.warn(
    "Workbox no se pudo cargar. El modo offline puede ser limitado."
  );
}
