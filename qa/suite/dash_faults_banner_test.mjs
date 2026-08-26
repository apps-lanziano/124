/* "מדדים במבט אחד" בדשבורד המפקד: באנר "חתימות" הוסר והוחלף בבאנר "תקלות"
   מאוחד (סופר תקלות ציוד פתוחות + תקלות בינוי פתוחות של המסגרת, יחד),
   לבקשת המשתמש לצמצם מסכים/באנרים כפולים. בדיקות נגד רגרסיה:
   - הבאנר "חתימות" לא מופיע יותר בקטלוג/ברשת ה-KPI.
   - הבאנר "תקלות" מופיע ומראה את הסכום הנכון (ציוד+בינוי, מסונן למסגרת).
   - לחיצה על הבאנר מנווטת למסך התקלות המאוחד. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");
const out = await page.evaluate(async ()=>{
  const catalog = dashBannerCatalog();
  const r = {};
  r.catalogHasFaults = catalog.some(c=>c.key==="faults" && c.l==="תקלות");
  r.catalogHasSigs = catalog.some(c=>c.key==="sigs");

  go("scr-cmd", document.getElementById("nav-cmd"));
  await renderTrends();
  await new Promise(res=>setTimeout(res,50));
  const html = document.getElementById("trends-content").innerHTML;
  r.gridHasFaultsLabel = html.includes(">תקלות<");
  r.gridHasSigsLabel = html.includes(">חתימות<");
  // seed: תקלת ציוד אחת פתוחה (מ-harness) + תקלת בינוי אחת פתוחה לshed1 (מ-harness) = 2
  const m = html.match(/onclick="go\('scr-faults'[^>]*>[\s\S]*?<div class="cd-kn">(\d+)<\/div>/);
  r.faultsCount = m ? Number(m[1]) : null;
  r.faultsGoesToFaultsScreen = html.includes("onclick=\"go('scr-faults',document.getElementById('nav-faults'))\"");
  return r;
});
record("קטלוג הבאנרים כולל 'תקלות' ולא 'חתימות'", out.catalogHasFaults && !out.catalogHasSigs, JSON.stringify(out));
record("רשת ה-KPI מציגה באנר תקלות ולא חתימות", out.gridHasFaultsLabel && !out.gridHasSigsLabel, JSON.stringify(out));
record("באנר התקלות מסכם ציוד+בינוי (2 = 1+1 מהזריעה)", out.faultsCount===2, JSON.stringify(out));
record("לחיצה על הבאנר מנווטת למסך התקלות המאוחד", out.faultsGoesToFaultsScreen, JSON.stringify(out));
record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
