/* בקשת המשתמש (2026-08-23): (1) הקשה על באנר ההתראה בנייד תוביל למסך הרלוונטי
   — היום, לאחר הקשה, האפליקציה נפתחת על מסך הכניסה, ואחרי הקשת קוד נוחתת על
   מסך ברירת-המחדל במקום על המסך של ההתראה. (2) המספר על סמל האפליקציה = כמות
   ההתראות שהתקבלו מאז הפתיחה האחרונה, בלי "מספרים לא-הגיוניים".

   בדיקת מקור (הלוגיקה תלויה ב-DOM/IndexedDB/זרימת כניסה מלאה — כמו
   scheduled_functions_wiring_test.mjs לצד השרת). מאמתת את הקוד ב-index.html
   וב-firebase-messaging-sw.js. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const html = readFileSync(`${ROOT}/index.html`, 'utf8');
const sw = readFileSync(`${ROOT}/firebase-messaging-sw.js`, 'utf8');

// ===== ניווט מהתראה =====

// 1. ⛔ הבאג המרכזי: אסור לצרוך את יעד-הניווט לפני שהמשתמש מחובר. checkPendingNav
// ו-checkPendingDigest חייבים לצאת מוקדם כש-user ריק, אחרת הפתיחה-הקרה (שמגיעה
// תמיד על מסך הכניסה) הייתה מוחקת את היעד עוד לפני ההזדהות.
{
  const navGuard = /async function checkPendingNav\(\)\{\s*try\{\s*[^]*?if\(!user\) return;/.test(html);
  const digestGuard = /async function checkPendingDigest\(\)\{\s*try\{\s*if\(!user\) return;/.test(html);
  record("checkPendingNav + checkPendingDigest יוצאים מוקדם כשאין user (לא מבזבזים את היעד לפני כניסה)",
    navGuard && digestGuard, JSON.stringify({navGuard, digestGuard}));
}

// 2. doLogin קורא ל-checkPendingNav ול-checkPendingDigest אחרי go(landingScreen)
// ו-refreshAll — כך שהיעד גובר על מסך הנחיתה אחרי כניסה מוצלחת
{
  const goIdx = html.indexOf("go(landingScreen, landingBtn);");
  const clearFailsIdx = html.indexOf("clearLoginFails();");
  const between = goIdx >= 0 && clearFailsIdx > goIdx ? html.slice(goIdx, clearFailsIdx) : "";
  const callsNav = /checkPendingNav\(\);/.test(between);
  const callsDigest = /checkPendingDigest\(\);/.test(between);
  const skipsImpersonation = /if\(!impersonating\)\{ checkPendingNav\(\); checkPendingDigest\(\); \}/.test(between);
  record("doLogin מנווט להתראה שהמתינה אחרי כניסה מוצלחת (לא ב'כניסה בתור')",
    callsNav && callsDigest && skipsImpersonation, JSON.stringify({callsNav, callsDigest, skipsImpersonation}));
}

// 3. מפת הניווט כוללת את כל סוגי התראות הלוח החדשים (roster_publish/roster_week/
// roster_change) + תאימות לאחור ל-roster_current הישן — כולם למסך התורנויות
{
  const map = html.slice(html.indexOf("const NOTIF_NAV_MAP"), html.indexOf("function handleNotificationNav"));
  const hasPublish = /roster_publish:\s*"scr-board"/.test(map);
  const hasWeek = /roster_week:\s*"scr-board"/.test(map);
  const hasChange = /roster_change:\s*"scr-board"/.test(map);
  const hasLegacy = /roster_current:\s*"scr-board"/.test(map);
  // cert_reminder ירד — אין יותר התראת "הסמכות דורשות תשומת לב"
  const noCert = !/cert_reminder:/.test(map);
  record("NOTIF_NAV_MAP: roster_publish/roster_week/roster_change/roster_current→scr-board, cert_reminder הוסר",
    hasPublish && hasWeek && hasChange && hasLegacy && noCert,
    JSON.stringify({hasPublish, hasWeek, hasChange, hasLegacy, noCert}));
}

// 4. ה-SW שומר את היעד ל-IndexedDB (pending_nav) לפני שהוא ממקד/פותח את
// האפליקציה — כדי שגם פתיחה קרה מלאה (וגם אפליקציה נעולה על מסך הכניסה) לא
// תאבד את היעד; והחלון עובר דרך checkPendingNav (המוגן ב-user), לא ישירות על e.data
{
  const swStoresNav = /idbPut\(db, "pending_nav", \{ kind: d\.kind/.test(sw);
  const swStoresDigest = /idbPut\(db, "pending_digest"/.test(sw);
  const winRoutesViaChecker = /if\(e\.data && e\.data\.type === "NOTIFICATION_NAV"\) checkPendingNav\(\);/.test(html);
  record("SW כותב את היעד ל-IndexedDB לפני focus/openWindow, והחלון מנתב דרך checkPendingNav",
    swStoresNav && swStoresDigest && winRoutesViaChecker,
    JSON.stringify({swStoresNav, swStoresDigest, winRoutesViaChecker}));
}

// ===== מונה ה-badge =====

// 5. ⛔ הבאג של "המספר הלא-הגיוני": updateAppBadge חייב לאפס את בסיס-הספירה
// ל-0 באופן אמין (await idbSetBadgeBase) *לפני* נגיעה ב-OS, ובלי יציאה מוקדמת
// כשאין setAppBadge. אחרת הבסיס נתקע על ערך ישן וההתראה הבאה מציגה מספר מנופח.
{
  const fn = html.slice(html.indexOf("async function updateAppBadge()"), html.indexOf("function idbBadge()"));
  const awaitsReset = /await idbSetBadgeBase\(0\);/.test(fn);
  const noEarlyReturn = !/if\(!\("setAppBadge" in navigator\)\) return;/.test(fn);
  const resetBeforeOs = fn.indexOf("idbSetBadgeBase(0)") < fn.indexOf("clearAppBadge");
  record("updateAppBadge מאפס את בסיס-הספירה באופן אמין (await) ולפני ה-OS, בלי יציאה מוקדמת",
    awaitsReset && noEarlyReturn && resetBeforeOs,
    JSON.stringify({awaitsReset, noEarlyReturn, resetBeforeOs}));
}

// 6. idbSetBadgeBase ממתין לסיום הכתיבה בפועל (tx.oncomplete) — בלי זה האיפוס
// לא מובטח וה-SW ממשיך לספור מערך ישן
{
  const fn = html.slice(html.indexOf("async function idbSetBadgeBase"), html.indexOf("async function idbSetBadgeBase")+400);
  const awaitsCommit = /await new Promise\(\(res\)=>\{[^]*?tx\.oncomplete=\(\)=>res\(\)/.test(fn);
  record("idbSetBadgeBase ממתין ל-tx.oncomplete (איפוס מובטח)", awaitsCommit, String(awaitsCommit));
}

// 7. ה-SW סופר +1 לכל התראה (כמות ההתראות שהתקבלו), מהבסיס ששמור ב-IndexedDB
{
  const countsPerPush = /const base = Number\(await idbGet\(db, "count"\)\) \|\| 0;\s*count = base \+ 1;\s*await idbPut\(db, "count", count\);/.test(sw);
  const setsBadge = /setAppBadge\(count\)/.test(sw);
  record("SW מגדיל את המונה ב-1 לכל התראה שמתקבלת ברקע ומעדכן את הסמל",
    countsPerPush && setsBadge, JSON.stringify({countsPerPush, setsBadge}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
