/* רצף שבועות: הלוח מציג שבוע שעבר / נוכחי / הבא (בורר + החלקה). פרסום
   הלוח העתידי מסמן אותו published (גלוי לכולם כ"שבוע הבא") בלי לגעת
   כלל בלוח הנוכחי/שעבר — הקידום ללוח נוכחי הוא פעולה נפרדת ומפורשת
   (restoreWeekToCurrent, ר' roster_restore_test), לא חלק מהפרסום. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  window.confirm = ()=>true;

  // מצב התחלתי: נוכחי עם תוכן, עתידי (טיוטה) עם תוכן אחר
  const cur = migrateRosterToV2(null); cur.days["ראשון"].lead = "נוכחי א";
  const nxt = migrateRosterToV2(null); nxt.days["ראשון"].lead = "עתידי א";
  await saveDutyRosterV2(cur, "current");
  await saveDutyRosterV2(nxt, "next");
  await saveDutyRosterV2(migrateRosterToV2(null), "prev");

  // בורר השבוע — שלוש אפשרויות, ברירת מחדל "נוכחי"
  go("scr-board", null); await renderBoard();
  await renderRosterView();
  const selHtml = document.querySelector(".roster-weeksel").innerHTML;
  r.hasThreeWeeks = /שבוע שעבר/.test(selHtml) && /נוכחי/.test(selHtml) && /שבוע הבא/.test(selHtml);
  r.defaultCurrent = boardWeekSlot==="current";

  // מעבר ל"שבוע הבא" מציג את הטיוטה
  await setBoardWeek("next");
  r.nextShown = document.getElementById("roster-view").innerHTML.includes("עתידי") && boardWeekSlot==="next";
  // החלקה חזרה לנוכחי (ימינה = אחורה)
  await rosterWeekShift(-1);
  r.swipedBack = boardWeekSlot==="current";

  // פרסום הלוח העתידי — מסמן published, לא נוגע בנוכחי/שעבר, לא מתרוקן
  await openRosterEditor(null, "next");
  await publishFutureRoster();
  const nowCur = await getDutyRoster("current");
  const nowPrev = await getDutyRoster("prev");
  const nowNext = await getDutyRoster("next");
  r.currentUntouched = nowCur.days["ראשון"].lead === "נוכחי א";
  r.prevUntouched = nowPrev.days["ראשון"].lead === "";
  r.nextStillHasDraft = nowNext.days["ראשון"].lead === "עתידי א";
  r.nextMarkedPublished = nowNext.published === true;
  r.backToCurrentView = boardWeekSlot==="current";

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("בורר שבוע: שעבר / נוכחי / הבא", out.hasThreeWeeks, String(out.hasThreeWeeks));
record("ברירת מחדל — שבוע נוכחי", out.defaultCurrent, String(out.defaultCurrent));
record("מעבר ל\"שבוע הבא\" מציג את הטיוטה", out.nextShown, String(out.nextShown));
record("החלקה חזרה לנוכחי", out.swipedBack, String(out.swipedBack));
record("פרסום: לא נוגע בלוח הנוכחי", out.currentUntouched, String(out.currentUntouched));
record("פרסום: לא נוגע ב\"שבוע שעבר\"", out.prevUntouched, String(out.prevUntouched));
record("פרסום: הטיוטה נשארת ב\"שבוע הבא\"", out.nextStillHasDraft, String(out.nextStillHasDraft));
record("פרסום: הלוח מסומן published", out.nextMarkedPublished, String(out.nextMarkedPublished));
record("אחרי פרסום חוזרים לתצוגת \"נוכחי\"", out.backToCurrentView, String(out.backToCurrentView));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
