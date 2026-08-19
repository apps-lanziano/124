/* בודק שהחיווט בפועל של functions/index.js לפונקציית analyzeBoardImage
   (onCall) תקין — דורשת אימות, App Check, ה-secret של המפתח, ומחוברת
   ללוגיקה הטהורה ב-lib/board_ai_analyze. בדיקת מקור, כמו שאר קבצי
   ה-wiring_test — firebase-admin/functions לא מותקנים בסביבת הבדיקה. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const fn = readFileSync(`${ROOT}/functions/index.js`, 'utf8');

{
  const definesSecret = /defineSecret\("ANTHROPIC_API_KEY"\)/.test(fn);
  const importsParams = /require\("firebase-functions\/params"\)/.test(fn);
  record("מפתח ה-API מוגדר כ-Secret של Firebase (לא כמשתנה סביבה רגיל)",
    definesSecret && importsParams, JSON.stringify({definesSecret, importsParams}));
}

{
  const isOnCall = /exports\.analyzeBoardImage\s*=\s*onCall/.test(fn);
  const enforcesAppCheck = /exports\.analyzeBoardImage[\s\S]{0,120}enforceAppCheck:\s*true/.test(fn);
  const bindsSecret = /exports\.analyzeBoardImage[\s\S]{0,160}secrets:\s*\[ANTHROPIC_API_KEY\]/.test(fn);
  record("analyzeBoardImage היא onCall עם enforceAppCheck ומחוברת ל-secret",
    isOnCall && enforcesAppCheck && bindsSecret, JSON.stringify({isOnCall, enforcesAppCheck, bindsSecret}));
}

{
  const requiresAuth = /exports\.analyzeBoardImage[\s\S]{0,400}if \(!request\.auth\)/.test(fn);
  const requiresImage = /if \(!imageDataUrl \|\| typeof imageDataUrl !== "string"\)/.test(fn);
  const requiresApiKey = /if \(!apiKey\)/.test(fn);
  record("דורשת משתמש מחובר, תמונה תקינה, ומפתח API מוגדר — לפני קריאה ל-AI",
    requiresAuth && requiresImage && requiresApiKey, JSON.stringify({requiresAuth, requiresImage, requiresApiKey}));
}

{
  const importsLib = /require\("\.\/lib\/board_ai_analyze"\)/.test(fn);
  const usesCore = /analyzeBoardImageCore\(imageDataUrl, apiKey, \{rosterNames\}\)/.test(fn);
  const throwsOnFailure = /if \(!result\.ok\) \{\s*throw new HttpsError\("internal"/.test(fn);
  // מאז הוספת מכסת שימוש יומית — הפונקציה כותבת ל-ai_quota_<uid> בלבד, לא לנתוני לוח
  const hasRateLimit = /DAILY_LIMIT/.test(fn) && /runTransaction/.test(fn) && /ai_quota_/.test(fn);
  record("משתמשת בלוגיקה הטהורה מ-lib/board_ai_analyze, נכשלת בבירור בכשל, ומגבילה קריאות ע\"י מכסה יומית",
    importsLib && usesCore && throwsOnFailure && hasRateLimit,
    JSON.stringify({importsLib, usesCore, throwsOnFailure, hasRateLimit}));
}

{
  const sanitizesRoster = /Array\.isArray\(rawRoster\)/.test(fn);
  const capsCount = /\.slice\(0,\s*300\)/.test(fn);
  const capsLength = /\.slice\(0,\s*60\)/.test(fn);
  const defaultsToEmpty = /: \[\];\s*\n\s*const result = await analyzeBoardImageCore/.test(fn);
  record("rosterNames מהלקוח מסונן ומוגבל (מערך מחרוזות, עד 300 שמות, 60 תווים כל אחד) לפני שהוא מגיע ל-AI",
    sanitizesRoster && capsCount && capsLength && defaultsToEmpty,
    JSON.stringify({sanitizesRoster, capsCount, capsLength, defaultsToEmpty}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
