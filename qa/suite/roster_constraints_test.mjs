/* אילוצים (לוח אילוצים): חייל מזין קורס/חופש/אפטר → מפקד מאשר → האילוץ
   הופך לנעילה אצל מ"ע תורנויות (🔒 ביום המתאים) וגם לאירוע ביומן.
   מפקד יכול להזין אילוץ בשם חייל — מאושר מיידית. סוגים שאינם תאריכיים
   (אחר/החלפה) אינם נועלים. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  const soldier = "חייל א סככה 1";
  // תאריכי-הבלוק של יום שני ושל משמרת סופ"ש (חמישי) בשבוע הנוכחי
  const monDate = rosterDayLockDates("שני","current")[0];
  const friDate = rosterDayLockDates("חמישי","current")[1];   // שישי

  // 1) אילוץ חופש מאושר ליום שני
  await saveDutyRequests([
    {id:"c1", type:"vacation", by:soldier, shed:"shed1", fromDate:monDate, toDate:monDate, status:"approved", ts:Date.now()},
    {id:"c2", type:"other",    by:"חייל ב סככה 1", shed:"shed1", reason:"משהו", status:"approved", ts:Date.now()+1},
    {id:"c3", type:"after",    by:"חייל ג סככה 1", shed:"shed1", fromDate:friDate, toDate:friDate, status:"approved", ts:Date.now()+2},
    {id:"c4", type:"vacation", by:"חייל ד סככה 1", shed:"shed1", fromDate:monDate, toDate:monDate, status:"pending", ts:Date.now()+3},
    {id:"c5", type:"course",   by:"חייל ה סככה 1", shed:"shed1", fromDate:monDate, toDate:monDate, status:"approved", ts:Date.now()+4},
  ]);

  const map = await fetchApprovedConstraintsByName();
  r.mapHasSoldier   = Array.isArray(map[soldier]) && map[soldier].length===1;
  r.mapExcludesOther = !map["חייל ב סככה 1"];       // "אחר" אינו אילוץ נועל
  r.mapExcludesPending = !map["חייל ד סככה 1"];     // ממתין — לא נועל

  // 2) נעילה: שני נעול, שלישי לא
  r.lockMon = !!constraintLockFor(soldier, "שני", "current", map);
  r.lockTue = !constraintLockFor(soldier, "שלישי", "current", map);
  // אפטר בשישי נועל את מפתח משמרת סופ"ש ("חמישי")
  r.lockWknd = !!constraintLockFor("חייל ג סככה 1", "חמישי", "current", map);
  // תווית הנעילה כוללת את סוג האילוץ
  const lbl = constraintLockFor(soldier, "שני", "current", map);
  r.lockLabel = !!lbl && /חופשה/.test(lbl.label);
  r.hardNotSoft = !!lbl && lbl.soft===false;
  // קורס = אילוץ "רך": זמין לצוות תורן עד 21:00, בלי נח — לא נעילה מלאה
  const courseLbl = constraintLockFor("חייל ה סככה 1", "שני", "current", map);
  r.courseSoft = !!courseLbl && courseLbl.soft===true && /21:00/.test(courseLbl.label) && /ללא נח/.test(courseLbl.label);
  r.courseNotHardLock = !CONSTRAINT_LOCK_TYPES.includes("course") && CONSTRAINT_DATED_TYPES.includes("course");

  // 3) העורך טוען אילוצים ומסמן 🔒 ברשימת הבחירה (מ"ע תורנויות)
  isRosterManager = true;
  await openRosterEditor(null, "current");
  rosterEdDay = "שני";
  openRosterPick("pf");
  const locked = rosterPickRows.find(x=>x.name===soldier);
  r.pickShowsLock = !!(locked && locked.lock);
  document.getElementById("roster-pick-modal").classList.remove("open");
  document.getElementById("duty-roster-modal").classList.remove("open");

  // 4) היומן כולל את האילוץ המאושר ביום המתאים
  const events = await getCalendarEvents();
  r.calHasConstraint = events.some(e=>e.type==="constraint" && e.date===monDate && e.label.includes(soldier));

  // 5) מפקד מזין אילוץ בשם חייל — מאושר מיידית
  openCommanderConstraint();
  reqOnBehalf = "חייל ה סככה 1";
  setReqType("after");
  document.getElementById("req-fromdate").value = monDate;
  await submitRequest();
  const behalf = (await getDutyRequests()).find(x=>x.by==="חייל ה סככה 1" && x.type==="after");
  r.behalfApproved = !!behalf && behalf.status==="approved" && behalf.byCommander===true && behalf.fromDate===monDate;

  // 6) מפקד עורך אילוץ מאושר — משנה תאריך ושומר על הסטטוס
  window.confirm = ()=>true;
  const tueDate = rosterDayLockDates("שלישי","current")[0];
  await saveDutyRequests((await getDutyRequests()).concat([
    {id:"e1", type:"vacation", by:soldier, shed:"shed1", fromDate:monDate, toDate:monDate, status:"approved", ts:Date.now()+9}
  ]));
  await openEditRequest("e1", true);
  document.getElementById("req-fromdate").value = tueDate;
  document.getElementById("req-todate").value = "";
  await submitRequest();
  const e1 = (await getDutyRequests()).find(x=>x.id==="e1");
  r.editKeepsStatus = !!e1 && e1.fromDate===tueDate && e1.status==="approved";

  // 7) מפקד מוחק אילוץ
  await deleteRequest("e1");
  r.deleted = !(await getDutyRequests()).some(x=>x.id==="e1");

  // 8) חלון ההזנה לחייל: עקבי מול נעילת ג' 10:00
  const nw = nextWeekRangeIso();
  r.deadlineConsistent = soldierEntryBlocked(nw.from) === nextWeekEntryLocked();
  r.currentWeekAllowed = soldierEntryBlocked(monDate) === false;   // השבוע הנוכחי לא נחסם

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("אילוץ מאושר נכנס למפת הנעילות", out.mapHasSoldier, String(out.mapHasSoldier));
record("סוג \"אחר\" אינו נועל", out.mapExcludesOther, String(out.mapExcludesOther));
record("אילוץ ממתין (לא מאושר) אינו נועל", out.mapExcludesPending, String(out.mapExcludesPending));
record("נעילה חלה על היום הנכון (שני) ולא על אחר (שלישי)", out.lockMon && out.lockTue, JSON.stringify({mon:out.lockMon,tue:out.lockTue}));
record("אפטר בשישי נועל את משמרת סופ\"ש", out.lockWknd, String(out.lockWknd));
record("תווית הנעילה כוללת את סוג האילוץ", out.lockLabel, String(out.lockLabel));
record("חופש = נעילה מלאה (soft=false)", out.hardNotSoft, String(out.hardNotSoft));
record("קורס = אילוץ רך: זמין עד 21:00, ללא נח", out.courseSoft, String(out.courseSoft));
record("קורס אינו נעילה מלאה אך כן אילוץ תאריכי", out.courseNotHardLock, String(out.courseNotHardLock));
record("רשימת הבחירה בעורך מציגה 🔒 לחייל נעול", out.pickShowsLock, String(out.pickShowsLock));
record("האילוץ המאושר מופיע ביומן המסגרת", out.calHasConstraint, String(out.calHasConstraint));
record("מפקד מזין אילוץ בשם חייל — מאושר מיידית", out.behalfApproved, String(out.behalfApproved));
record("מפקד עורך אילוץ מאושר — משנה תאריך ושומר סטטוס", out.editKeepsStatus, String(out.editKeepsStatus));
record("מפקד מוחק אילוץ", out.deleted, String(out.deleted));
record("חלון ההזנה עקבי מול נעילת ג׳ 10:00", out.deadlineConsistent, String(out.deadlineConsistent));
record("השבוע הנוכחי אינו נחסם לחייל", out.currentWeekAllowed, String(out.currentWeekAllowed));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
