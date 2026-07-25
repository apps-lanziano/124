const CACHE_NAME = "tayeset124-v1";
const APP_SHELL = [
  "./index-pwa.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting(); // גרסה חדשה מתחילה לפעול מיד — לא מחכה שכל הטאבים הישנים ייסגרו
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// דף האפליקציה עצמו: תמיד קודם מהרשת (כדי שעדכון שדחפנו יגיע מיד),
// ורק אם אין רשת בכלל — נופלים למטמון (שימוש לא מקוון)
self.addEventListener("fetch", event => {
  const req = event.request;
  const isAppDoc = req.mode === "navigate" || req.url.endsWith("index-pwa.html");

  if (isAppDoc) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index-pwa.html", copy));
          return res;
        })
        .catch(() => caches.match("./index-pwa.html"))
    );
    return;
  }

  // קבצים סטטיים (אייקונים/מניפסט): מטמון קודם, רשת כגיבוי
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
