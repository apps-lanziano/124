/* דשבורד מפקד — עדכוני 2026-08-27 + 2026-08-29:
   1. הבאנר הרחב "בקשות לאישור" וכפתור "הזן אילוץ בשם חייל" הוסרו
      מהדשבורד (cmd-constraints-wrap) — עדיין קיימים במסך התורנויות
      (board-constraints-wrap, לא נגע).
   2. באנר "יצירת פעולה" חדש פותח גיליון עם כל פעולות היצירה.
   3. "מדדים במבט אחד" (רשת ה-KPI, כולל "בקשות ממתינות") הוסרה לגמרי
      מהדשבורד לבקשת המשתמש — ר' dash_fixed_kpi_layout_test.mjs. */
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
  const cmdHtml = document.getElementById("scr-cmd").innerHTML;
  const r = {};
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
