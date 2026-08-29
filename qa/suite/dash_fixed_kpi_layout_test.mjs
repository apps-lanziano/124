/* "מדדים במבט אחד" (רשת ה-KPI בדשבורד המפקד) הוסרה לגמרי לבקשת המשתמש
   (2026-08-29) — יחד עם "יצירת פעולה"/"מיקוד יומי" נשאר, אבל שש
   האריחים (בקשות ממתינות/מטלות בוקר/תקלות/כשירות חיילים/כלים בחדר/
   רכבים) וכפתור "לחיצה = מסך מלא" לא מוצגים יותר בשום צורה. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");
const out = await page.evaluate(async ()=>{
  go("scr-cmd", document.getElementById("nav-cmd"));
  await renderTrends();
  await new Promise(r=>setTimeout(r,80));
  const html = document.getElementById("trends-content").innerHTML;
  return {
    hasKpiGrid: html.includes("cd-kgrid"),
    hasHeading: html.includes("מדדים במבט אחד"),
    hasFullScreenHint: html.includes("לחיצה = מסך מלא"),
    hasFocusSection: html.includes("מיקוד יומי"),
    catalogFnGone: typeof window.dashBannerCatalog === "undefined",
  };
});
record("רשת ה-KPI (\"מדדים במבט אחד\") לא מרונדרת יותר", !out.hasKpiGrid, JSON.stringify(out));
record("כותרת \"מדדים במבט אחד\" לא מופיעה", !out.hasHeading, JSON.stringify(out));
record("הבאדג' \"לחיצה = מסך מלא\" לא מופיע", !out.hasFullScreenHint, JSON.stringify(out));
record("\"מיקוד יומי\" ממשיך להיות מוצג כרגיל", out.hasFocusSection, JSON.stringify(out));
record("dashBannerCatalog הוסרה מהקוד", out.catalogFnGone, JSON.stringify(out));
record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
