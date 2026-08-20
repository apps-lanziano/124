/* בקשה: "מטלות בוקר - אחרי סימון ביצוע לנעול (שאי אפשר להסיר את הסימון
   לאותו יום)". בודק את toggleTask() ב-index.html: סימון ראשון מצליח,
   ניסיון שני (לבטל) נחסם — הרשומה נשארת ב-sGet, וההצגה בלוח נשארת "בוצע". */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "חייל");

const out = await page.evaluate(async ()=>{
  const r = {};
  user = "חייל א סככה 1"; userRole = "חייל";
  const toasts = [];
  window.toast = (m)=>toasts.push(m);

  const taskId = MORNING_TASKS[0].id;
  const key = "team_morning_"+todayKey();
  await sSet(key, {});   // מתחיל מריק, לא תלוי בסדר הרצה

  await toggleTask(taskId);
  const afterFirst = (await sGet(key)) || {};
  r.firstMarkedDone = !!afterFirst[taskId];
  r.firstBy = afterFirst[taskId] && afterFirst[taskId].by;

  toasts.length = 0;
  await toggleTask(taskId);   // ניסיון לבטל — אמור להיחסם
  const afterSecond = (await sGet(key)) || {};
  r.stillDoneAfterSecondClick = !!afterSecond[taskId];
  r.sameRecordUnchanged = JSON.stringify(afterFirst[taskId]) === JSON.stringify(afterSecond[taskId]);
  r.lockToast = toasts.some(t=>t.includes("לא ניתן לבטל") || t.includes("כבר סומנה"));

  await renderTasks();
  const html = document.getElementById("tasks-list").innerHTML;
  r.rowStillShowsDone = html.includes("בוצע ע\"י");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("סימון ראשון מצליח ונשמר", out.firstMarkedDone && !!out.firstBy, JSON.stringify(out));
record("ניסיון שני (ביטול) נחסם — הרשומה נשארת מסומנת", out.stillDoneAfterSecondClick, String(out.stillDoneAfterSecondClick));
record("הרשומה לא השתנתה בניסיון השני (אין דריסה/מחיקה)", out.sameRecordUnchanged, String(out.sameRecordUnchanged));
record("טוסט מסביר שהמטלה נעולה", out.lockToast, String(out.lockToast));
record("הלוח ממשיך להציג את המטלה כ'בוצע'", out.rowStillShowsDone, String(out.rowStillShowsDone));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
