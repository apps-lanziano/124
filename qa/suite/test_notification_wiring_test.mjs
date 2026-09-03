/* בודק שהחיווט בפועל של functions/index.js לפונקציית sendTestNotificationToSelf
   (onCall) תקין — במיוחד שהיא שולחת FCM רק לטוקן שהגיע מהלקוח עצמו
   (send({token}) לטוקן בודד), ולא מחפשת/משדרת לרשימת טוקנים כלשהי
   לפי סככה/תפקיד כמו שאר פונקציות ההתראה. בדיקת מקור, כמו שאר
   קבצי ה-wiring_test — firebase-admin/functions לא מותקנים בסביבת הבדיקה. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const fn = readFileSync(`${ROOT}/functions/index.js`, 'utf8');

{
  const isOnCall = /exports\.sendTestNotificationToSelf\s*=\s*onCall/.test(fn);
  const enforcesAppCheck = /exports\.sendTestNotificationToSelf[\s\S]{0,120}enforceAppCheck:\s*true/.test(fn);
  record("sendTestNotificationToSelf היא onCall עם enforceAppCheck",
    isOnCall && enforcesAppCheck, JSON.stringify({isOnCall, enforcesAppCheck}));
}

{
  const requiresAuth = /exports\.sendTestNotificationToSelf[\s\S]{0,300}if \(!request\.auth\)/.test(fn);
  const usesLib = /require\("\.\/lib\/test_notification"\)/.test(fn);
  const validatesInput = /validateTestNotificationRequest\(request\.data\)/.test(fn);
  const throwsOnInvalid = /if \(!ok\) \{\s*throw new HttpsError\("invalid-argument", error\)/.test(fn);
  record("דורשת משתמש מחובר ומשתמשת בלוגיקת האימות הטהורה מ-lib/test_notification",
    requiresAuth && usesLib && validatesInput && throwsOnInvalid,
    JSON.stringify({requiresAuth, usesLib, validatesInput, throwsOnInvalid}));
}

{
  const start = fn.indexOf("exports.sendTestNotificationToSelf");
  const end = fn.indexOf("exports.dailyBackup");
  const body = start >= 0 && end > start ? fn.slice(start, end) : "";
  const sendsToSingleToken = /getMessaging\(\)\.send\(\{token, data:/.test(body);
  const noTokenListLookup = !/push_tokens_/.test(body) && !/sendEachForMulticast/.test(body);
  record("שולחת רק לטוקן הבודד שהגיע מהלקוח (send, לא sendEachForMulticast) — לא מחפשת רשימת טוקנים בשרת",
    sendsToSingleToken && noTokenListLookup, JSON.stringify({sendsToSingleToken, noTokenListLookup}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
