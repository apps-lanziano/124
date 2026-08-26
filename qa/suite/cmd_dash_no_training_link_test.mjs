/* "קישור הדרכה" הוסר מסעיף "ניהול" בדשבורד המפקד (scr-cmd) לבקשת המשתמש
   (מיקום לא רלוונטי שם — מפקד סככה מגיע להדרכה דרך השער nav-trainhub).
   נשאר בדיוק כפי שהיה במסך "סקירה" של מ״ע אחזקה (scr-vo-overview), ששם
   הוא כן רלוונטי (מוסיף קישור לצוות שלו, בלי שער הדרכה מקביל). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");
const out = await page.evaluate(()=>{
  const cmdSection = document.getElementById("scr-cmd");
  const voSection = document.getElementById("scr-vo-overview");
  return {
    cmdHasTrainingLink: cmdSection.innerHTML.includes("openTrainingLinkAdd()"),
    cmdHasOtherAdminCards: cmdSection.innerHTML.includes("openBriefMgmt()") && cmdSection.innerHTML.includes("openMsgMgmt()"),
    voHasTrainingLink: voSection.innerHTML.includes("openTrainingLinkAdd()"),
  };
});
record("דשבורד המפקד לא מכיל יותר את כפתור 'קישור הדרכה'", !out.cmdHasTrainingLink, JSON.stringify(out));
record("שאר כפתורי הניהול בדשבורד המפקד נשארו (תדריך בוקר/לוח הודעות)", out.cmdHasOtherAdminCards, JSON.stringify(out));
record("מסך הסקירה של מ״ע אחזקה עדיין מכיל את הכפתור (לא נגעו בו)", out.voHasTrainingLink, JSON.stringify(out));
record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
