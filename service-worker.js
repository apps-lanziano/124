const CACHE_NAME = "tayeset124-9eaa7812b30b";
const APP_SHELL = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/emblem-124.png",
  "./icons/apple-touch-icon-180.png",
  "./icons/wing-badge.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
  // skipWaiting אוטומטי — עדכון קורה בשקט ברקע, בלי באנר ובלי לחכות ללחיצת
  // משתמש. הטאב הפתוח כרגע ממשיך לרוץ עם הקוד שכבר נטען בזיכרון (אין רענון
  // בכוח באמצע שימוש/מילוי טופס); הגרסה החדשה פשוט משרתת מהפעם הבאה שהאפליקציה נפתחת.
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// עוטף בקשת רשת בטיימאאוט — כדי שרשת תקועה (לא בהכרח שגיאה, סתם לא עונה) לא תשאיר
// את טעינת הדף תלויה לנצח על שעון חול; נופלים למטמון אחרי 8 שניות בלי תגובה
function fetchWithTimeout(req, ms=8000){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(req).then(res => { clearTimeout(t); resolve(res); }, err => { clearTimeout(t); reject(err); });
  });
}

// דף האפליקציה עצמו: stale-while-revalidate — מגישים מיד מהמטמון (טעינה
// מיידית, בלי להמתין להורדת ~940KB בכל פתיחה), ובמקביל מרעננים ברקע. עדכון
// גרסה שדחפנו לא "נתקע": הוא מגיע דרך גרסת ה-Service Worker (CACHE_NAME
// מתעדכן בכל פריסה → SW חדש נכנס ל-waiting → כפתור "גרסה חדשה זמינה").
// טעינה ראשונה בלבד (אין עדיין מטמון) ממתינה לרשת.
self.addEventListener("fetch", event => {
  const req = event.request;
  const isAppDoc = req.mode === "navigate" || req.url.endsWith("index.html");

  if (isAppDoc) {
    event.respondWith(
      caches.match("./index.html").then(cached => {
        const validCached = cached && cached.ok ? cached : undefined;
        const fromNet = fetchWithTimeout(req)
          .then(res => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
            }
            return res;
          })
          .catch(() => validCached);
        return validCached || fromNet;
      })
    );
    return;
  }

  // קבצים סטטיים (אייקונים/מניפסט): מטמון קודם, רשת כגיבוי
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
