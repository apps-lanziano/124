/* בודק את החיווט בפועל של markAuthorized (onCall) ב-functions/index.js.
   ------------------------------------------------------------
   רגרסיה קריטית שהתגלתה ב-audit אבטחה (2026-08-22): sign_in_provider
   ==="password" *לבד* לא מוכיח שהקוד הוקצה ע"י מ״ע — כל דפדפן יכול
   ליצור לעצמו חשבון u<קוד-בדוי>@sq124.app (createUserWithEmailAndPassword
   פתוח כברירת מחדל ב-Firebase Auth, ו-App Check-על-Auth רק מוודא
   "דפדפן אמיתי", לא "פעולה שהאתר יזם"). לפני התיקון, markAuthorized
   הסתפק ב-shouldAuthorize() ונתן authorized:true + role ברירת-מחדל
   ("חייל") גם כשלא נמצא authprofile_<hash> תואם — כלומר תוקף בלי
   שום קוד אמיתי היה יכול להעניק לעצמו authorized:true. הבדיקה כאן
   מוודאת שהתיקון (חובת authprofile_ קיים) לא נסוג בעתיד.

   בדיקת מקור סטטית, כמו שאר קבצי ה-wiring_test — firebase-admin/
   functions לא מותקנים בסביבת הבדיקה (ולכן אי אפשר להריץ את
   ה-handler בפועל בלי emulator ל-Auth). ר' גם firestore_rules_test.mjs
   שמאמת את שכבת ה-Firestore rules (השלב שאחרי markAuthorized) על
   emulator אמיתי. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const fn = readFileSync(`${ROOT}/functions/index.js`, 'utf8');

// מבודד את גוף markAuthorized בלבד, כדי שבדיקות לא "יתאימו במקרה"
// לקוד של פונקציה אחרת בקובץ (analyzeBoardImage וכו').
const bodyMatch = /exports\.markAuthorized\s*=\s*onCall\(([\s\S]*?)\n\);/.exec(fn);
const body = bodyMatch ? bodyMatch[1] : "";

record("markAuthorized נמצאה בקובץ", !!bodyMatch, JSON.stringify({found: !!bodyMatch}));

{
  const isOnCall = /exports\.markAuthorized\s*=\s*onCall/.test(fn);
  const enforcesAppCheck = /exports\.markAuthorized[\s\S]{0,80}enforceAppCheck:\s*true/.test(fn);
  record("markAuthorized היא onCall עם enforceAppCheck",
    isOnCall && enforcesAppCheck, JSON.stringify({isOnCall, enforcesAppCheck}));
}

{
  const requiresAuth = /if \(!request\.auth\)/.test(body);
  const requiresShouldAuthorize = /if \(!shouldAuthorize\(request\.auth\)\)/.test(body);
  record("דורשת request.auth ו-shouldAuthorize (password provider) לפני כל המשך",
    requiresAuth && requiresShouldAuthorize, JSON.stringify({requiresAuth, requiresShouldAuthorize}));
}

{
  // ⛔ הליבה של התיקון: קריאה ל-setCustomUserClaims מותרת רק אחרי בדיקה
  // מפורשת ש-authprofile נמצא (prof קיים) — לא ברירת-מחדל "חייל" בלי בדיקה.
  const setClaimsCount = (body.match(/setCustomUserClaims/g) || []).length;
  const hasSingleClaimsCall = setClaimsCount === 1;
  // "if (!prof ...) throw" חייב להופיע *לפני* setCustomUserClaims בטקסט הקוד
  const profGuardIdx = body.search(/if\s*\(\s*!prof[\s\S]{0,300}throw new HttpsError\("permission-denied"/);
  const claimsIdx = body.indexOf("setCustomUserClaims");
  const guardBeforeClaims = profGuardIdx >= 0 && claimsIdx >= 0 && profGuardIdx < claimsIdx;
  record("קריאה יחידה ל-setCustomUserClaims, אחרי guard מפורש שדוחה כשאין authprofile",
    hasSingleClaimsCall && guardBeforeClaims,
    JSON.stringify({setClaimsCount, profGuardIdx, claimsIdx, guardBeforeClaims}));
}

{
  // אין נתיב שבו role מקבל ברירת-מחדל ("חייל") ובכל זאת ממשיך לאשר —
  // role חייב לבוא מ-prof.role בלבד, אחרי שהוכח ש-prof קיים.
  const noSilentDefaultRole = !/let role = "חייל"/.test(body) && !/role = "חייל";\s*\/\/.*ברירת/.test(body);
  const roleFromProfOnly = /const role = prof\.role/.test(body);
  record("role נגזר אך ורק מ-authprofile שאומת (לא ברירת-מחדל שממשיכה לאשר)",
    noSilentDefaultRole && roleFromProfOnly,
    JSON.stringify({noSilentDefaultRole, roleFromProfOnly}));
}

{
  // האימייל חייב להתאים לתבנית u<ספרות>@ — אחרת דחייה, לא "פשוט ממשיך בלי code"
  const deniesOnBadEmailFormat = /if \(!codeMatch\)[\s\S]{0,150}throw new HttpsError\("permission-denied"/.test(body);
  record("פורמט אימייל לא-תקין (לא u<קוד>@) נדחה — לא ממשיך עם code=undefined",
    deniesOnBadEmailFormat, JSON.stringify({deniesOnBadEmailFormat}));
}

{
  // חישוב ה-hash חייב להישאר תואם ל-codeProfileKey בצד הלקוח (sha256("sq124code|"+code))
  const correctHashInput = /createHash\("sha256"\)\.update\("sq124code\|" \+ code\)/.test(body);
  const readsAuthprofileDoc = /db\.doc\("sq124\/authprofile_" \+ hash\)/.test(body);
  record("ה-hash של המסמך תואם לנוסחה שהלקוח משתמש בה ליצירתו (codeProfileKey)",
    correctHashInput && readsAuthprofileDoc, JSON.stringify({correctHashInput, readsAuthprofileDoc}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
