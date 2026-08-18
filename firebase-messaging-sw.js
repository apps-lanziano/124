/* Service Worker להתראות Push (FCM) — טייסת 124
   ------------------------------------------------
   מקבל התראות מ-Firebase Cloud Messaging גם כשהאפליקציה סגורה, מציג התראה,
   ומעדכן את ה-badge על סמל האפליקציה. נרשם ב-scope ייעודי
   ("firebase-cloud-messaging-push-scope") כדי לא להתנגש ב-service-worker.js
   של המטמון. אין כאן שום סוד — כל הערכים פומביים (כמו בקוד הלקוח). */

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAEA2_BgNWhvZUvLBjdRVvW3epJgSHOZ6M",
  authDomain: "squadron124-96357.firebaseapp.com",
  projectId: "squadron124-96357",
  storageBucket: "squadron124-96357.firebasestorage.app",
  messagingSenderId: "752623099673",
  appId: "1:752623099673:web:e5362a81c7bca1e9e2ef88"
});

const messaging = firebase.messaging();

/* מונה ה-badge משותף עם חלון האפליקציה דרך IndexedDB: החלון כותב את הספירה
   המדויקת, וכאן מגדילים ממנה כשמגיע push בזמן שהאפליקציה סגורה. */
function idbBadge(){
  return new Promise((res, rej)=>{
    const r = indexedDB.open("sq124-badge", 1);
    r.onupgradeneeded = ()=> r.result.createObjectStore("kv");
    r.onsuccess = ()=> res(r.result);
    r.onerror = ()=> rej(r.error);
  });
}
function idbGet(db, key){
  return new Promise((res)=>{
    const rq = db.transaction("kv","readonly").objectStore("kv").get(key);
    rq.onsuccess = ()=> res(rq.result); rq.onerror = ()=> res(undefined);
  });
}
function idbPut(db, key, val){
  return new Promise((res)=>{
    const tx = db.transaction("kv","readwrite");
    tx.objectStore("kv").put(val, key);
    tx.oncomplete = ()=> res(); tx.onerror = ()=> res();
  });
}

messaging.onBackgroundMessage(async (payload)=>{
  const d = payload.data || {};
  const title = d.title || "טייסת 124";
  const body  = d.body  || "";

  // עדכון ה-badge: מונה *התראות שלא נצפו* — כל התראה מוסיפה 1 (לא לפי
  // מספר הפריטים בתוכה), כדי שהמספר על הסמל יהיה מובן: "כמה התראות חדשות
  // מאז שפתחת את האפליקציה". החלון מאפס את הבסיס ל-0 בכל פתיחה (updateAppBadge).
  let count = 1;
  try{
    const db = await idbBadge();
    const base = Number(await idbGet(db, "count")) || 0;
    count = base + 1;
    await idbPut(db, "count", count);
  }catch(e){}
  try{ if(self.navigator && "setAppBadge" in self.navigator) await self.navigator.setAppBadge(count); }catch(e){}

  return self.registration.showNotification(title, {
    body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: d.kind || "sq124",
    renotify: true,
    data: d
  });
});

// הקשה על ההתראה — פותח/ממקד את האפליקציה, ומנווט למסך הרלוונטי לפי סוג
// ההתראה (d.kind). "סקירה יומית" נשארת מקרה מיוחד: שומרים תוכן מלא
// ב-IndexedDB כדי שהאפליקציה תציג חלון פופאפ צף (וסוגרים אותו ב-✕). שאר
// הסוגים שומרים רק את ה-kind תחת pending_nav, כדי שהאפליקציה תנווט למסך
// המתאים דרך handleNotificationNav — גם כשהאפליקציה כבר פתוחה (postMessage)
// וגם בפתיחה קרה (נקרא בעליית העמוד, בדיוק כמו pending_digest).
self.addEventListener("notificationclick", (event)=>{
  event.notification.close();
  const d = (event.notification && event.notification.data) || {};
  event.waitUntil((async ()=>{
    try{
      const db = await idbBadge();
      if(d.kind === "daily_digest" && (d.title || d.body)){
        await idbPut(db, "pending_digest", { title: d.title || "", body: d.body || "", ts: Date.now() });
      } else if(d.kind){
        await idbPut(db, "pending_nav", { kind: d.kind, ts: Date.now() });
      }
    }catch(e){}
    const all = await self.clients.matchAll({ type:"window", includeUncontrolled:true });
    for(const c of all){
      if("focus" in c){
        try{
          if(d.kind === "daily_digest") c.postMessage({ type:"SHOW_DIGEST" });
          else if(d.kind) c.postMessage({ type:"NOTIFICATION_NAV", kind: d.kind });
        }catch(e){}
        return c.focus();
      }
    }
    if(self.clients.openWindow) return self.clients.openWindow("./");
  })());
});
