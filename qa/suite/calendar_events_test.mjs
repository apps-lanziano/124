/* יומן מאוחד: הזנת אירוע ידני (כמו יומן גוגל) שנפרס על טווח תאריכים,
   מחיקתו, והוספת אילוץ/זימון מתוך היומן עם התאריך הנבחר. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  await saveManualEvents([]);

  // אירוע ידני לטווח של יומיים
  calSelectedDate = "2026-08-20";
  openCalEvent();
  document.getElementById("cal-ev-name").value = "ביקורת מפקד גדוד";
  document.getElementById("cal-ev-from").value = "2026-08-20";
  document.getElementById("cal-ev-to").value = "2026-08-21";
  await saveCalEvent();
  const man = await getManualEvents();
  r.saved = man.length===1 && man[0].title==="ביקורת מפקד גדוד" && man[0].toDate==="2026-08-21";

  const evs = await getCalendarEvents();
  r.onDay1 = evs.some(e=>e.type==="manual" && e.date==="2026-08-20" && e.label==="ביקורת מפקד גדוד");
  r.onDay2 = evs.some(e=>e.type==="manual" && e.date==="2026-08-21");
  r.notDay3 = !evs.some(e=>e.type==="manual" && e.date==="2026-08-22");

  // מחיקה
  window.confirm = ()=>true;
  await deleteCalEvent(man[0].id);
  r.deleted = (await getManualEvents()).length===0;

  // אילוץ/זימון מהיומן (מפקד) — פותח טופס בשם חייל עם התאריך הנבחר.
  // תאריך "היום" ולא קבוע-קשיח: תאריך עתידי קבוע חוצה בסופו של דבר לתוך
  // חלון "שבוע הבא" (נעילת ג' 10:00) ואז מפקד-בשם-חייל דורש גם אישור מ"ע
  // ולא מאושר מיד — "היום" תמיד בשבוע הנוכחי, שלא כפוף לנעילה הזו.
  const targetDate = todayKey();
  calSelectedDate = targetDate;
  openCalConstraint();
  r.constraintOpened = document.getElementById("request-modal").classList.contains("open")
    && reqDraftFromDate===targetDate && reqDraftType==="vacation" && !!reqOnBehalf;

  // שליחה → אילוץ מאושר מיידית שמסתנכרן למ"ע (נעילה בעורך כלל המסגרות)
  const who = reqOnBehalf;
  document.getElementById("req-fromdate").value = targetDate;
  document.getElementById("req-todate").value = "";
  await submitRequest();
  const c = (await getDutyRequests()).find(x=>x.by===who && x.type==="vacation" && x.fromDate===targetDate);
  r.constraintApproved = !!c && c.status==="approved" && c.byCommander===true;
  const map = await fetchApprovedConstraintsByName();
  r.constraintSynced = Array.isArray(map[who]) && map[who].some(x=>x.fromDate===targetDate);

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("אירוע ידני נשמר עם טווח תאריכים", out.saved, String(out.saved));
record("האירוע מופיע ביום הראשון בטווח", out.onDay1, String(out.onDay1));
record("האירוע מופיע גם ביום השני בטווח", out.onDay2, String(out.onDay2));
record("האירוע אינו מופיע מחוץ לטווח", out.notDay3, String(out.notDay3));
record("מחיקת אירוע ידני", out.deleted, String(out.deleted));
record("הוספת אילוץ/זימון מהיומן פותחת טופס עם התאריך הנבחר", out.constraintOpened, String(out.constraintOpened));
record("אילוץ מהיומן נשמר כמאושר (בשם חייל)", out.constraintApproved, String(out.constraintApproved));
record("אילוץ מהיומן מסתנכרן למ״ע (מפת הנעילות)", out.constraintSynced, String(out.constraintSynced));

await closeBrowser();

// ---------- חייל: אין כפתור אילוץ/זימון ביומן ----------
{
  const { page } = await newPage();
  const login = await loginAsFramework(page, "shed1", "חייל");
  const out2 = await page.evaluate(async ()=>{
    const r = {};
    go("scr-calendar", null); await renderCalendarPage();
    r.noConstraintBtn = !document.getElementById("cal-actions").innerHTML.includes("אילוץ");
    r.noEventBtn = !document.getElementById("cal-actions").innerHTML.includes("אירוע ליומן");
    let toasted=""; window.toast=m=>toasted=m;
    openCalConstraint();
    r.blocked = /רק מפקד/.test(toasted) && !document.getElementById("request-modal").classList.contains("open");
    return r;
  });
  record("חייל: אין כפתור אילוץ/זימון ביומן", out2.noConstraintBtn, String(out2.noConstraintBtn));
  record("חייל: אין כפתור אירוע ליומן", out2.noEventBtn, String(out2.noEventBtn));
  record("חייל: ניסיון להזין אילוץ נחסם", out2.blocked, String(out2.blocked));
  await closeBrowser();
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
