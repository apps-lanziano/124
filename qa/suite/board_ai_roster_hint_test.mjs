/* משוב משתמש: ניתוח ה-AI של "לוח צוות תורן" לא זיהה שמות נכון. שני
   תיקונים: (1) שולחים ל-AI את רשימת השמות המלאים של כל אנשי הטייסת
   כעזר-קריאה, במקום לתת לו לנחש איות מאפס (ראו lib/board_ai_analyze
   ו-board_ai_analyze_lib_test.mjs לבדיקת הפרומפט עצמו); (2) מעלים את
   רזולוציית/איכות תמונת הלוח שנשלחת לניתוח, כי מדובר בצילום גיליון
   Excel עם טקסט קטן ולא בכתב יד — דחיסה אגרסיבית פוגעת בדיוק הקריאה.
   בדיקת מקור (regex על index.html), לא הרצה בפועל — הקריאה האמיתית
   ל-httpsCallable דורשת Firebase Functions SDK אמיתי שלא זמין בסביבת בדיקה. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const html = readFileSync(`${ROOT}/index.html`, 'utf8');

// 1. analyzeLatestBoardWithAI בונה רשימת שמות מכל הסככות ושולח אותה ל-AI
{
  const start = html.indexOf("async function analyzeLatestBoardWithAI");
  const body = start >= 0 ? html.slice(start, start + 1400) : "";
  const buildsRoster = /fetchAllPersonnelByShed\(\)/.test(body) && /rosterNames/.test(body);
  const excludesReleased = /!\(p\.release && p\.release ?<= ?todayKey\(\)\)/.test(body);
  const sendsRosterToFn = /analyzeFn\(\{image: full, rosterNames\}\)/.test(body);
  record("analyzeLatestBoardWithAI בונה רשימת שמות מכל הסככות (מוחרגים משוחררים) ושולח אותה לפונקציית הענן",
    buildsRoster && excludesReleased && sendsRosterToFn,
    JSON.stringify({buildsRoster, excludesReleased, sendsRosterToFn}));
}

// 2. תמונת הלוח שנשלחת לניתוח: רזולוציה ואיכות גבוהות יותר מהעבר (720KB/1000px)
{
  const start = html.indexOf("function onBoardFile");
  const body = start >= 0 ? html.slice(start, start + 1400) : "";
  const higherRes = /const maxW = 1568/.test(body);
  const higherByteBudget = /900_000/.test(body);
  const noRegressionToOldCaps = !/const maxW = 1000/.test(body) && !/720_000/.test(body);
  record("תמונת לוח הצוות המנותחת ב-AI ברזולוציה/איכות גבוהה יותר (1568px / 900KB, לא 1000px / 720KB)",
    higherRes && higherByteBudget && noRegressionToOldCaps,
    JSON.stringify({higherRes, higherByteBudget, noRegressionToOldCaps}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
