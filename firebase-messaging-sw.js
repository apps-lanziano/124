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

  // עדכון ה-badge: בסיס מהחלון + מספר הפריטים החדשים בהודעה זו
  let count = 1;
  try{
    const db = await idbBadge();
    const base = Number(await idbGet(db, "count")) || 0;
    const inc  = Number(d.n) || 1;
    count = base + inc;
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

// הקשה על ההתראה — פותח/ממקד את האפליקציה
self.addEventListener("notificationclick", (event)=>{
  event.notification.close();
  event.waitUntil((async ()=>{
    const all = await self.clients.matchAll({ type:"window", includeUncontrolled:true });
    for(const c of all){ if("focus" in c) return c.focus(); }
    if(self.clients.openWindow) return self.clients.openWindow("./");
  })());
});
