/* בקשת משתמש: לשונית "חומרי הדרכה" קבועה בבאנר הניווט התחתון, ליד
   "הסמכות", ליוזר החייל בכל מסגרת — לא רק בתפריט "עוד" הנסתר. למפקד
   נשארת הגישה דרך "עוד" כמקודם (לא נוספת לו לשונית נוספת בבאנר). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();

function hidden(id){
  return page.evaluate((id)=>document.getElementById(id).classList.contains("hidden"), id);
}

// 1. חייל בסככה רגילה: הלשונית בבאנר גלויה, הפריט בתפריט "עוד" מוסתר
{
  const r = await loginAsFramework(page, "shed1", "חייל");
  const navHidden = await hidden("nav-training");
  const sheetHidden = await hidden("sheet-training");
  record("חייל: nav-training גלוי בבאנר התחתון", r.ok && !navHidden, JSON.stringify({ok:r.ok, navHidden}));
  record("חייל: הפריט הכפול בתפריט \"עוד\" מוסתר", sheetHidden, String(sheetHidden));
}

// 2. מפקד באותה טעינת-דף: הלשונית בבאנר חוזרת ומוסתרת, הפריט ב\"עוד\" חוזר וגלוי (toggle, לא add)
{
  const r = await loginAsFramework(page, "shed1", "מפקד");
  const navHidden = await hidden("nav-training");
  const sheetHidden = await hidden("sheet-training");
  record("מפקד אחרי חייל: nav-training מוסתר (הנראות מתאפסת נכון)", r.ok && navHidden, JSON.stringify({ok:r.ok, navHidden}));
  record("מפקד: הפריט בתפריט \"עוד\" גלוי כרגיל", !sheetHidden, String(sheetHidden));
}

// 3. חייל במחלקה (isDept) ובמ״ע אחזקה (isMaint) — עדיין רלוונטי (חומרי הדרכה אינם תלויי-סוג-מסגרת)
for(const [shedId, label] of [["dept","מחלקות"], ["maint","מ״ע אחזקה"]]){
  const r = await loginAsFramework(page, shedId, "חייל");
  const navHidden = await hidden("nav-training");
  record(`חייל ב${label}: nav-training גלוי בבאנר התחתון גם כן`, r.ok && !navHidden, JSON.stringify({ok:r.ok, navHidden}));
}

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
