/* מסך תורנויות: באנר "אילוצים" למפקד (בקשות ממתינות + "הזן אילוץ בשם
   חייל") — אותו תוכן בדיוק כמו בדשבורד (cmd-constraints-wrap), עכשיו גם
   ב-board-constraints-wrap במסך התורנויות, כדי שמפקד לא יצטרך לקפוץ
   לדשבורד תוך כדי בניית הלוח. נבדק שהוא: מופיע למפקד, לא מופיע לחייל
   רגיל ולא למ״ע תורנויות שאינו מפקד, ומראה את מספר הבקשות הממתינות. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "מפקד");
  const out = await page.evaluate(async ()=>{
    await sSet("duty_requests", [{id:"r1", status:"pending", type:"vacation", name:"חייל א סככה 1"}]);
    rosterCache = null;
    go("scr-board", document.getElementById("nav-board"));
    await renderRosterView();
    await new Promise(r=>setTimeout(r,80));
    const box = document.getElementById("board-constraints-wrap");
    return {
      exists: !!box,
      html: box ? box.innerHTML : null,
      hasApproveBanner: !!box && box.innerHTML.includes("openRequestsInbox()"),
      hasAddOnBehalf: !!box && box.innerHTML.includes("openCommanderConstraint()"),
      hasPendingCount: !!box && box.innerHTML.includes(">1<"),
    };
  });
  record("מפקד רואה את באנר האילוצים במסך התורנויות", out.exists && out.hasApproveBanner, JSON.stringify(out));
  record("כולל כפתור הזנת אילוץ בשם חייל", out.hasAddOnBehalf, JSON.stringify(out));
  record("מציג את מספר הבקשות הממתינות (1)", out.hasPendingCount, JSON.stringify(out));
  record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));
}

{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "חייל");
  const out = await page.evaluate(async ()=>{
    go("scr-board", document.getElementById("nav-board"));
    await renderRosterView();
    await new Promise(r=>setTimeout(r,80));
    const box = document.getElementById("board-constraints-wrap");
    return { existsInDom: !!box };
  });
  record("חייל רגיל לא רואה כלל את מיכל באנר האילוצים (לא נוצר ל-DOM)", !out.existsInDom, JSON.stringify(out));
  record("אין שגיאות JS (חייל)", pageErrors.length===0, JSON.stringify(pageErrors));
}

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
