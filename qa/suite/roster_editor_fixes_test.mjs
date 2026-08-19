/* חמישה תיקונים/שיפורים בעורך לוח צוות תורן:
   1. בניית לוח עתידי תמיד מתחילה מיום ראשון (לא "היום").
   2. אופציה למחוק את כל הלוח (טיוטה) בלחיצה אחת.
   3. שורת "כלים" ממוקמת בלוח בין "PMS נחים" ל"מילואים".
   4. באנר "תצוגה מקדימה של ההתראה" הוסר לגמרי מהעורך.
   5. "⤢ מסך מלא" מכבד את השבוע המוצג בפועל (boardWeekSlot) — לא תמיד
      נוכחי, כדי שצפייה ב"שבוע הבא" ולחיצה על מסך מלא לא תציג בטעות
      את הלוח הנוכחי. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// --- בדיקת מקור: באנר ההתראה הוסר לגמרי (לא רק הכפתור, גם הפונקציה) ---
{
  const html = readFileSync(`${ROOT}/index.html`, 'utf8');
  const noFunction = !html.includes("function previewDutyRosterNotification");
  const noButton = !html.includes("שלח לי תצוגה מקדימה של ההתראה");
  record("previewDutyRosterNotification הוסרה לגמרי מהקוד", noFunction, String(noFunction));
  record("כפתור 'תצוגה מקדימה של ההתראה' הוסר מהעורך", noButton, String(noButton));
}

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  user = "טל מלכה";   // מ״ע תורנויות בפועל — כדי ש-isRosterManager יהיה true
  await refreshAreaPermissions();

  // 1) בניית לוח עתידי — יום ראשון כברירת מחדל
  await openRosterEditor(null, "next");
  r.futureStartsOnSunday = rosterEdDay === "ראשון";
  document.getElementById("duty-roster-modal").classList.remove("open");

  // עריכת לוח נוכחי — עדיין ברירת המחדל היא "היום" (התנהגות קיימת, לא נגעו בה)
  await openRosterEditor(null, "current");
  r.currentStartsOnToday = rosterEdDay === rosterEditKey(todayHebrewDay());

  // 2) מחיקת כל הלוח — מאפסת את הטיוטה, שומרת weekKey
  rosterDraft.days["ראשון"].lead = "מישהו";
  rosterDraft.days["ראשון"].tools = "מישהו אחר";
  rosterDraft.days["ראשון"].pf = [{name:"פ א"}];
  rosterDraft.weekKey = "test-week-key";
  window.confirm = ()=>true;
  clearRosterDraft();
  r.clearedLead = !rosterDraft.days["ראשון"].lead;
  r.clearedTools = !rosterDraft.days["ראשון"].tools;
  r.clearedPf = rosterDraft.days["ראשון"].pf.length === 0;
  r.weekKeyPreserved = rosterDraft.weekKey === "test-week-key";
  // הכפתור עצמו מופיע בעורך (בבלוק השבועי)
  r.clearButtonExists = document.getElementById("roster-ed-week").innerHTML.includes("מחק את כל הלוח");
  document.getElementById("duty-roster-modal").classList.remove("open");

  // 3) מיקום שורת "כלים" בלוח — בין PMS נחים למילואים
  const draft = migrateRosterToV2(null);
  draft.days["ראשון"].tools = "כלים א";
  draft.days["ראשון"].pmsRest = ["נח פמס"];
  draft.days["ראשון"].reserve = ["מיל א"];
  const boardHtml = rosterBoardHtml(draft, "", "wide");
  const idx = s => boardHtml.indexOf(s);
  r.toolsAfterPmsRest = idx("PMS נחים") >= 0 && idx(">כלים<") > idx("PMS נחים");
  r.toolsBeforeReserve = idx(">כלים<") >= 0 && idx(">מילואים<") > idx(">כלים<");

  // 5) "⤢ מסך מלא" מכבד את boardWeekSlot — לא רק "נוכחי"
  const curDraft = migrateRosterToV2(null);
  curDraft.weekNumber = 10;
  curDraft.days["ראשון"].lead = "ראש נוכחי";
  await saveDutyRosterV2(curDraft, "current");
  const nextDraft = migrateRosterToV2(null);
  nextDraft.weekNumber = 11;
  nextDraft.days["ראשון"].lead = "ראש עתידי";
  await saveDutyRosterV2(nextDraft, "next");
  rosterCache = null;
  boardWeekSlot = "next";
  await openRosterFull();
  const fullHtml = document.getElementById("roster-full-inner").innerHTML;
  r.fullScreenShowsNextWeek = fullHtml.includes("ראש עתידי") && !fullHtml.includes("ראש נוכחי");
  r.fullScreenTitleMarksNext = document.getElementById("roster-full-title").textContent.includes("שבוע הבא");
  closeRosterFull();
  boardWeekSlot = "current";

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("בניית לוח עתידי מתחילה מיום ראשון", out.futureStartsOnSunday, String(out.futureStartsOnSunday));
record("עריכת לוח נוכחי עדיין מתחילה מ'היום' (לא השתנה)", out.currentStartsOnToday, String(out.currentStartsOnToday));
record("מחיקת הלוח מאפסת ר״צ", out.clearedLead, String(out.clearedLead));
record("מחיקת הלוח מאפסת פקיד כלים", out.clearedTools, String(out.clearedTools));
record("מחיקת הלוח מאפסת PF", out.clearedPf, String(out.clearedPf));
record("מחיקת הלוח שומרת על weekKey", out.weekKeyPreserved, String(out.weekKeyPreserved));
record("כפתור 'מחק את כל הלוח' קיים בעורך", out.clearButtonExists, String(out.clearButtonExists));
record("שורת 'כלים' בלוח אחרי 'PMS נחים'", out.toolsAfterPmsRest, String(out.toolsAfterPmsRest));
record("שורת 'כלים' בלוח לפני 'מילואים'", out.toolsBeforeReserve, String(out.toolsBeforeReserve));
record("'מסך מלא' מציג את שבוע הבא כשזה מה שנצפה (לא נוכחי)", out.fullScreenShowsNextWeek, String(out.fullScreenShowsNextWeek));
record("כותרת 'מסך מלא' מציינת 'שבוע הבא'", out.fullScreenTitleMarksNext, String(out.fullScreenTitleMarksNext));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
