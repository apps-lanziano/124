/* דשבורד מפקד — עדכוני 2026-08-27:
   1-2. באנרי "נע\"תים" ו"הסמכות" הוסרו לגמרי מ"מדדים במבט אחד".
   3. באנר "בקשות ממתינות" תופס את מקום "הסמכות" (סופר duty_requests
      ממתינות, בדיוק כמו renderCommanderConstraints).
   4-5. הבאנר הרחב "בקשות לאישור" וכפתור "הזן אילוץ בשם חייל" הוסרו
      מהדשבורד (cmd-constraints-wrap) — עדיין קיימים במסך התורנויות
      (board-constraints-wrap, לא נגע).
   6. באנר "יצירת פעולה" חדש פותח גיליון עם כל פעולות היצירה. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");
const out = await page.evaluate(async ()=>{
  await sSet("duty_requests", [{id:"r1", status:"pending", type:"vacation", name:"חייל א סככה 1"}]);
  go("scr-cmd", document.getElementById("nav-cmd"));
  await renderTrends();
  await new Promise(r=>setTimeout(r,80));
  const catalog = dashBannerCatalog();
  const gridHtml = document.getElementById("trends-content").innerHTML;
  const cmdHtml = document.getElementById("scr-cmd").innerHTML;
  const r = {};
  r.catalogNoNaatim = !catalog.some(c=>c.key==="naatim");
  r.catalogNoCerts = !catalog.some(c=>c.key==="certs");
  r.catalogHasRequests = catalog.some(c=>c.key==="requests" && c.l==="בקשות ממתינות");
  r.gridNoNaatimLabel = !gridHtml.includes('>נע"תים<');
  r.gridNoCertsLabel = !gridHtml.includes(">הסמכות<");
  r.gridHasRequestsLabel = gridHtml.includes(">בקשות ממתינות<");
  const m = gridHtml.match(/onclick="openRequestsInbox\(\)"[\s\S]*?<div class="cd-kn">([^<]+)<\/div>/);
  r.requestsCount = m ? m[1] : null;
  r.noConstraintsWrap = !document.getElementById("cmd-constraints-wrap");
  r.noWideApprovalBanner = !cmdHtml.includes("openRequestsInbox()") || !/בקשות לאישור/.test(cmdHtml);
  r.noManualConstraintBtn = !cmdHtml.includes("+ הזן אילוץ בשם חייל");
  r.hasQuickActionBanner = cmdHtml.includes("openQuickActionSheet()") && cmdHtml.includes("יצירת פעולה");

  openQuickActionSheet();
  const sheetOpen = document.getElementById("quick-action-sheet").classList.contains("open");
  const toolVisible = !document.getElementById("qa-tool-item").classList.contains("hidden");
  const vehicleVisible = !document.getElementById("qa-vehicle-item").classList.contains("hidden");
  const faultVisible = !document.getElementById("qa-fault-item").classList.contains("hidden");
  const binuiVisible = !document.getElementById("qa-binui-item").classList.contains("hidden");
  document.getElementById("quick-action-sheet").classList.remove("open");

  return {...r, sheetOpen, toolVisible, vehicleVisible, faultVisible, binuiVisible};
});
record("קטלוג הבאנרים: נע\"תים הוסר לגמרי", out.catalogNoNaatim, JSON.stringify(out));
record("קטלוג הבאנרים: הסמכות הוסר", out.catalogNoCerts, JSON.stringify(out));
record("קטלוג הבאנרים: בקשות ממתינות נוסף במקום הסמכות", out.catalogHasRequests, JSON.stringify(out));
record("רשת ה-KPI לא מציגה נע\"תים", out.gridNoNaatimLabel, JSON.stringify(out));
record("רשת ה-KPI לא מציגה הסמכות", out.gridNoCertsLabel, JSON.stringify(out));
record("רשת ה-KPI מציגה בקשות ממתינות עם הספירה הנכונה (1)", out.gridHasRequestsLabel && out.requestsCount==="1", JSON.stringify(out));
record("cmd-constraints-wrap הוסר מהדשבורד לגמרי", out.noConstraintsWrap, JSON.stringify(out));
record("הבאנר הרחב \"בקשות לאישור\" הוסר מהדשבורד", out.noWideApprovalBanner, JSON.stringify(out));
record("כפתור \"הזן אילוץ בשם חייל\" הוסר מהדשבורד", out.noManualConstraintBtn, JSON.stringify(out));
record("באנר \"יצירת פעולה\" קיים בדשבורד", out.hasQuickActionBanner, JSON.stringify(out));
record("הגיליון נפתח ומציג פריטים תלויי-הרשאה (כלים/רכבים/תקלות) למפקד סככה רגילה", out.sheetOpen && out.toolVisible && out.vehicleVisible && out.faultVisible && out.binuiVisible, JSON.stringify(out));
record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
