/* "עריכת מטלות בוקר" — הוסרה כפריט נפרד בתפריט "עוד"; במקומה כפתור
   "✏️ ערוך" בתוך מסך "מטלות בוקר" עצמו (scr-morning), פותח אותו מודל
   עריכה (task-modal/openTaskMgmt) בלי שינוי בלוגיקת העריכה עצמה.
   גם: quickAddTeamMember() (מ"יצירת פעולה" בדשבורד) פותח את ניהול
   הצוות ישר על טופס ההוספה, בלי לחיצה נוספת. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");
const out = await page.evaluate(async ()=>{
  const r = {};
  r.moreTasksItemGone = !document.getElementById("more-tasks-item");
  go("scr-morning", document.getElementById("nav-morning"));
  await new Promise(res=>setTimeout(res,80));
  const editBtn = document.getElementById("morning-edit-btn");
  r.editBtnVisible = editBtn && !editBtn.classList.contains("hidden");
  editBtn.click();
  await new Promise(res=>setTimeout(res,80));
  r.taskModalOpen = document.getElementById("task-modal").classList.contains("open");
  document.getElementById("task-modal").classList.remove("open");

  quickAddTeamMember();
  await new Promise(res=>setTimeout(res,80));
  r.teamPageOpen = document.getElementById("team-page").classList.contains("open");
  r.addFormVisible = document.getElementById("tm-add-form").style.display !== "none";
  document.getElementById("team-page").classList.remove("open");

  return r;
});
record("פריט \"עריכת מטלות בוקר\" הוסר לגמרי מ\"עוד\"", out.moreTasksItemGone, JSON.stringify(out));
record("כפתור \"✏️ ערוך\" גלוי במסך מטלות בוקר למפקד", out.editBtnVisible, JSON.stringify(out));
record("הכפתור פותח את מודל עריכת המטלות הקיים", out.taskModalOpen, JSON.stringify(out));
record("quickAddTeamMember פותח את ניהול הצוות", out.teamPageOpen, JSON.stringify(out));
record("...ישר על טופס ההוספה (לא רשימת הצוות)", out.addFormVisible, JSON.stringify(out));
record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));

{
  const { page: page2, pageErrors: errs2 } = await newPage();
  await loginAsFramework(page2, "shed1", "חייל");
  const out2 = await page2.evaluate(async ()=>{
    go("scr-morning", document.getElementById("nav-morning"));
    await new Promise(res=>setTimeout(res,80));
    const editBtn = document.getElementById("morning-edit-btn");
    return { editBtnHidden: editBtn.classList.contains("hidden") };
  });
  record("חייל לא רואה את כפתור העריכה במסך מטלות בוקר", out2.editBtnHidden, JSON.stringify(out2));
  record("אין שגיאות JS (חייל)", errs2.length===0, JSON.stringify(errs2));
}

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
