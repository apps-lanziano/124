/* "מסך מלא" של לוח הצוות בדסקטופ (@media min-width:768px) — היחיד
   באפליקציה שכולה נעולה ל-480px (מובייל-פירסט). ב-#roster-full.open
   הופך ל-position:fixed ומתרחב עד min(94vw,1000px) כדי לנצל את רוחב
   המסך בלי לגעת ב-#app/שאר המסכים. במסך צר (מובייל) חוזר ל-
   position:absolute הרגיל, כמו קודם. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

async function seedAndOpenFull(page){
  return page.evaluate(async ()=>{
    const r = {};
    user = "טל מלכה";
    await refreshAreaPermissions();
    const draft = migrateRosterToV2(null);
    draft.days["שני"].lead = "חייל ב סככה 1";
    await saveDutyRosterV2(draft);
    go("scr-board", null);
    await renderBoard();
    setRosterView("board"); await renderRosterView();
    await openRosterFull();
    await new Promise(res=>setTimeout(res, 500));   // מעבר האנימציה (350ms)
    const el = document.getElementById("roster-full");
    const cs = getComputedStyle(el);
    r.position = cs.position;
    r.rectWidth = el.getBoundingClientRect().width;
    r.viewportW = window.innerWidth;
    const table = document.querySelector("#roster-full-inner table");
    r.tableNaturalWidth = table ? table.offsetWidth : null;
    r.hasLeadName = document.getElementById("roster-full-inner").innerHTML.includes("חייל ב סככה 1");
    return r;
  });
}

{
  const { page } = await newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsFramework(page, "shed1", "מפקד");
  const out = await seedAndOpenFull(page);
  record("דסקטופ (1440px): מסך מלא הופך ל-position:fixed", out.position === "fixed", out.position);
  record("דסקטופ: הרוחב מוגבל (לא נמתח לכל רוחב המסך)", out.rectWidth < out.viewportW && out.rectWidth <= 1001, `rect=${out.rectWidth} vw=${out.viewportW}`);
  record("דסקטופ: הטבלה נכנסת ברוחב בלי לחרוג (100% זום)", out.tableNaturalWidth <= out.rectWidth, `table=${out.tableNaturalWidth} rect=${out.rectWidth}`);
  record("דסקטופ: השם שהוזן מוצג בלוח", out.hasLeadName === true, out.hasLeadName);
  await closeBrowser();
}

{
  const { page } = await newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsFramework(page, "shed1", "מפקד");
  const out = await seedAndOpenFull(page);
  record("מובייל (390px): מסך מלא נשאר position:absolute כרגיל", out.position === "absolute", out.position);
  record("מובייל: הרוחב תואם את המסך המלא (לא נחתך למידה קבועה)", out.rectWidth === out.viewportW, `rect=${out.rectWidth} vw=${out.viewportW}`);
  record("מובייל: השם שהוזן מוצג בלוח", out.hasLeadName === true, out.hasLeadName);
  await closeBrowser();
}

console.log("=== SUMMARY ===");
let allPass = true;
for(const t of results){
  console.log(`${t.pass ? "✅" : "❌"} ${t.name}${t.pass ? "" : " - " + JSON.stringify(t.detail)}`);
  if(!t.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass ? 0 : 1);
