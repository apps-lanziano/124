/* לאחר שהבאנר "בקשות לאישור" הרחב + "הזן אילוץ בשם חייל" הוסרו מהדשבורד
   (scr-cmd, cmd-constraints-wrap בוטל), ה"רענון הכללי" של renderCommanderConstraints
   אחרי שמירה/מחיקה של אילוץ (submitRequest/deleteRequest) חייב עדיין
   לרענן את היעד היחיד שנשאר — board-constraints-wrap במסך התורנויות —
   ולא להישאר תקוע על מזהה DOM ("cmd-constraints-wrap") שכבר לא קיים.
   בודק: מפקד במסך התורנויות מוחק אילוץ ממתין, והתג מתעדכן מיד — בלי
   לנווט מחדש למסך (שהיה מרענן ממילא ומסתיר את הבאג). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");
const out = await page.evaluate(async ()=>{
  window.confirm = () => true;
  await sSet("duty_requests", [{id:"pend1", status:"pending", type:"vacation", name:"חייל א סככה 1"}]);

  go("scr-board", document.getElementById("nav-board"));
  await renderRosterView();
  await new Promise(r=>setTimeout(r,80));
  const before = document.getElementById("board-constraints-wrap").innerHTML;

  await deleteRequest("pend1");
  await new Promise(r=>setTimeout(r,80));
  const after = document.getElementById("board-constraints-wrap").innerHTML;

  return { before, after };
});
record("board-constraints-wrap הראה \"1\" ממתין לפני המחיקה", out.before.includes(">1<"), JSON.stringify(out));
record("board-constraints-wrap מתעדכן ל\"אין בקשות ממתינות\" מיד אחרי המחיקה, בלי ניווט מחדש", /אין בקשות ממתינות/.test(out.after), JSON.stringify(out));
record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
