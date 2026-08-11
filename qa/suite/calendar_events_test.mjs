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

  // אילוץ/זימון מהיומן (מפקד) — פותח טופס בשם חייל עם התאריך הנבחר
  calSelectedDate = "2026-08-25";
  openCalConstraint();
  r.constraintOpened = document.getElementById("request-modal").classList.contains("open")
    && reqDraftFromDate==="2026-08-25" && reqDraftType==="vacation" && !!reqOnBehalf;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("אירוע ידני נשמר עם טווח תאריכים", out.saved, String(out.saved));
record("האירוע מופיע ביום הראשון בטווח", out.onDay1, String(out.onDay1));
record("האירוע מופיע גם ביום השני בטווח", out.onDay2, String(out.onDay2));
record("האירוע אינו מופיע מחוץ לטווח", out.notDay3, String(out.notDay3));
record("מחיקת אירוע ידני", out.deleted, String(out.deleted));
record("הוספת אילוץ/זימון מהיומן פותחת טופס עם התאריך הנבחר", out.constraintOpened, String(out.constraintOpened));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
