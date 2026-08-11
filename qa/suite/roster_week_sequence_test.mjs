/* רצף שבועות: הלוח מציג שבוע שעבר / נוכחי / הבא (בורר + החלקה), ופרסום
   הלוח העתידי לא דורס — הנוכחי עובר ל"שבוע שעבר", הטיוטה הופכת ל"נוכחי",
   והעתידי מתאפס. רצף מלא נשמר. */
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
  setBoardWeek("next");
  r.nextShown = document.getElementById("roster-view").innerHTML.includes("עתידי") && boardWeekSlot==="next";
  // החלקה חזרה לנוכחי (ימינה = אחורה)
  rosterWeekShift(-1);
  r.swipedBack = boardWeekSlot==="current";

  // פרסום הלוח העתידי — רצף נשמר בלי לדרוס
  await openRosterEditor(null, "next");
  await publishFutureRoster();
  const nowCur = await getDutyRoster("current");
  const nowPrev = await getDutyRoster("prev");
  const nowNext = await getDutyRoster("next");
  r.promotedToCurrent = nowCur.days["ראשון"].lead === "עתידי א";
  r.oldMovedToPrev = nowPrev.days["ראשון"].lead === "נוכחי א";
  r.nextCleared = nowNext.days["ראשון"].lead === "";
  r.backToCurrentView = boardWeekSlot==="current";

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("בורר שבוע: שעבר / נוכחי / הבא", out.hasThreeWeeks, String(out.hasThreeWeeks));
record("ברירת מחדל — שבוע נוכחי", out.defaultCurrent, String(out.defaultCurrent));
record("מעבר ל\"שבוע הבא\" מציג את הטיוטה", out.nextShown, String(out.nextShown));
record("החלקה חזרה לנוכחי", out.swipedBack, String(out.swipedBack));
record("פרסום: הטיוטה הופכת ל\"נוכחי\"", out.promotedToCurrent, String(out.promotedToCurrent));
record("פרסום: הנוכחי הקודם עבר ל\"שבוע שעבר\" (לא נדרס)", out.oldMovedToPrev, String(out.oldMovedToPrev));
record("פרסום: העתידי התאפס לבניית השבוע הבא", out.nextCleared, String(out.nextCleared));
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
