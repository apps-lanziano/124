/* פופאפ "סקירה יומית" צף: כשמפקד מקיש על התראת הסקירה בטלפון, ה-Service
   Worker (firebase-messaging-sw.js) שומר את תוכן הסקירה תחת "pending_digest"
   ב-IndexedDB, ממקד/פותח את האפליקציה, ושולח SHOW_DIGEST. הלקוח קורא את
   התוכן ומציג חלון צף שנסגר ב-✕. הבדיקה מכסה: פתיחה ישירה, פתיחה מ-IndexedDB
   (מדמה פתיחה קרה אחרי הקשה על ההתראה), ניקוי המפתח, וסגירה ב-✕. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const q = id => document.getElementById(id);

  // 1) פתיחה ישירה של הפופאפ (showDigestPopup) — התוכן מוצג, החלון נפתח
  showDigestPopup("📋 סקירה יומית · סככה 1", "3 חתימות חסרות\n🗓️ תורנות היום — צוות תורן: דני");
  const openedDirect = q("digest-popup").classList.contains("open");
  const titleTxt = q("digest-popup-title").textContent;
  const bodyHasSig = q("digest-popup-body").textContent.includes("חתימות חסרות");
  const bodyHasRoster = q("digest-popup-body").textContent.includes("תורנות היום");

  // 2) סגירה ב-✕ (closeDigestPopup) — החלון נסגר
  closeDigestPopup();
  const closedAfterX = !q("digest-popup").classList.contains("open");

  // 3) פתיחה קרה: כותבים pending_digest ל-IndexedDB וקוראים ל-checkPendingDigest
  await new Promise(res=>{
    idbBadge().then(db=>{
      const tx = db.transaction("kv","readwrite");
      tx.objectStore("kv").put({ title:"📋 סקירה יומית · סככה 2", body:"תוכן מההתראה" }, "pending_digest");
      tx.oncomplete = res; tx.onerror = res;
    }).catch(res);
  });
  await checkPendingDigest();
  const openedFromIdb = q("digest-popup").classList.contains("open");
  const bodyFromIdb = q("digest-popup-body").textContent.includes("תוכן מההתראה");

  // 4) המפתח נמחק אחרי הצגה — לא יוצץ שוב בפתיחה הבאה
  const leftover = await idbGetKV("pending_digest");
  const cleared = !leftover;

  return { openedDirect, titleTxt, bodyHasSig, bodyHasRoster, closedAfterX, openedFromIdb, bodyFromIdb, cleared };
});

record("התחברות מפקד הצליחה", login.ok, JSON.stringify(login));
record("showDigestPopup פותח את החלון הצף", out.openedDirect, JSON.stringify(out));
record("הכותרת מוצגת בחלון", /סקירה יומית/.test(out.titleTxt||""), out.titleTxt);
record("תוכן הסקירה (חתימות + תורנות) מוצג בגוף", out.bodyHasSig && out.bodyHasRoster, JSON.stringify(out));
record("כפתור ✕ (closeDigestPopup) סוגר את החלון", out.closedAfterX, JSON.stringify(out));
record("פתיחה קרה: checkPendingDigest קורא מ-IndexedDB ומציג", out.openedFromIdb && out.bodyFromIdb, JSON.stringify(out));
record("pending_digest נמחק אחרי הצגה (לא חוזר שוב)", out.cleared, JSON.stringify(out));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
