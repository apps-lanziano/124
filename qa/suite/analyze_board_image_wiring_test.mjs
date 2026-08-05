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
  const usesCore = /analyzeBoardImageCore\(imageDataUrl, apiKey\)/.test(fn);
  const throwsOnFailure = /if \(!result\.ok\) \{\s*throw new HttpsError\("internal"/.test(fn);
  const doesNotWriteFirestore = !/exports\.analyzeBoardImage[\s\S]{0,900}db\.doc\(/.test(fn.slice(0, fn.indexOf("exports.notifyOnPublish")));
  record("משתמשת בלוגיקה הטהורה מ-lib/board_ai_analyze, נכשלת בבירור בכשל, ולא כותבת ל-Firestore בעצמה",
    importsLib && usesCore && throwsOnFailure && doesNotWriteFirestore,
    JSON.stringify({importsLib, usesCore, throwsOnFailure, doesNotWriteFirestore}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
