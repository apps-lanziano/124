/* בקשת משתמש: לשונית "חומרי הדרכה" קבועה בבאנר הניווט התחתון ליוזר
   החייל בכל מסגרת — לא רק בתפריט "עוד" הנסתר.
   עדכון: אצל מפקד סככה הפריט עבר למסך-השער "הדרכה" (nav-trainhub),
   ולכן ירד גם מהבאנר וגם מתפריט "עוד" — הכניסה אליו היא דרך השער. */
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

// 2. מפקד באותה טעינת-דף: הלשונית בבאנר מוסתרת, וגם הפריט ב"עוד" —
//    כי שניהם התאחדו למסך-השער "הדרכה", שאמור להיות גלוי במקומם.
{
  const r = await loginAsFramework(page, "shed1", "מפקד");
  const navHidden = await hidden("nav-training");
  const sheetHidden = await hidden("sheet-training");
  const hubHidden = await hidden("nav-trainhub");
  const certsNavHidden = await hidden("nav-certs");
  const onbHidden = await hidden("sheet-onboarding");
  record("מפקד אחרי חייל: nav-training מוסתר (הנראות מתאפסת נכון)", r.ok && navHidden, JSON.stringify({ok:r.ok, navHidden}));
  record("מפקד: חומרי הדרכה ירד מ\"עוד\" (עבר לשער)", sheetHidden, String(sheetHidden));
  record("מפקד: לשונית \"הדרכה\" גלויה בבאנר", !hubHidden, String(hubHidden));
  record("מפקד: \"הסמכות\" ירדה מהבאנר (נכנסים דרך השער)", certsNavHidden, String(certsNavHidden));
  record("מפקד: \"קליטת חייל חדש\" ירדה מ\"עוד\" (עברה לשער)", onbHidden, String(onbHidden));
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
