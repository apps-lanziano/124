/* מסך "תורנויות" (duty_table): הזנת טווח מתאריך–עד-תאריך, וסנכרון אוטומטי
   ללוח הצוות השבועי — כל תאריך בטווח שנופל בשבוע הנוכחי נכנס כתורנות
   בסיסית ליום המתאים. אידמפוטנטי: עריכה/מחיקה מתעדכנת נכון. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  const NAME = "חייל א סככה 1";
  await saveDutyRosterV2(migrateRosterToV2(null), "current");
  await sSet("duty_table", {});

  const monIso = rosterDayLockDates("שני","current")[0];
  const tueIso = rosterDayLockDates("שלישי","current")[0];

  // תורנות "שמירה" מיום שני עד שלישי — מסתנכרן ליומיים
  await saveDuty(NAME, "duty", "שמירה");
  await saveDuty(NAME, "fromDate", monIso);
  await saveDuty(NAME, "toDate", tueIso);
  const b = await getDutyRoster("current");
  const has = (day) => (b.days[day].basic||[]).some(x=>x.name===NAME && x.type==="שמירה" && x.src==="table");
  r.syncedMon = has("שני");
  r.syncedTue = has("שלישי");
  r.notWed = !(b.days["רביעי"].basic||[]).some(x=>x.name===NAME);

  // צמצום הטווח ליום אחד — שלישי מוסר (אידמפוטנטי, לא נשאר "רפאים")
  await saveDuty(NAME, "toDate", monIso);
  const b2 = await getDutyRoster("current");
  r.tueRemoved = !(b2.days["שלישי"].basic||[]).some(x=>x.name===NAME);
  r.monKept = (b2.days["שני"].basic||[]).some(x=>x.name===NAME && x.src==="table");

  // תאריך מחוץ לשבוע הנוכחי — לא מסתנכרן (הלוח לא מכסה אותו)
  await saveDuty(NAME, "fromDate", "2027-01-04");
  await saveDuty(NAME, "toDate", "2027-01-04");
  const b3 = await getDutyRoster("current");
  r.outsideWeekNotSynced = ROSTER_EDIT_DAYS.every(d=>!(b3.days[d].basic||[]).some(x=>x.name===NAME && x.src==="table"));

  // ניקוי התורנות מסיר את כל השיבוצים שמקורם בטבלה
  await saveDuty(NAME, "fromDate", monIso); await saveDuty(NAME, "toDate", monIso);
  await saveDuty(NAME, "duty", "");
  const b4 = await getDutyRoster("current");
  r.clearedAll = ROSTER_EDIT_DAYS.every(d=>!(b4.days[d].basic||[]).some(x=>x.name===NAME && x.src==="table"));

  // יומן: תורנות בטווח מייצרת אירוע לכל יום בטווח
  await saveDuty(NAME, "duty", "מטבח"); await saveDuty(NAME, "fromDate", monIso); await saveDuty(NAME, "toDate", tueIso);
  const evs = await getCalendarEvents();
  r.calRange = evs.some(e=>e.type==="duty" && e.date===monIso) && evs.some(e=>e.type==="duty" && e.date===tueIso);

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("סנכרון ליום שני (תחילת הטווח)", out.syncedMon, String(out.syncedMon));
record("סנכרון ליום שלישי (סוף הטווח)", out.syncedTue, String(out.syncedTue));
record("לא מסתנכרן ליום מחוץ לטווח (רביעי)", out.notWed, String(out.notWed));
record("צמצום הטווח מסיר את היום שירד (אידמפוטנטי)", out.tueRemoved, String(out.tueRemoved));
record("היום שנשאר בטווח נשמר", out.monKept, String(out.monKept));
record("תאריך מחוץ לשבוע הנוכחי לא מסתנכרן", out.outsideWeekNotSynced, String(out.outsideWeekNotSynced));
record("ניקוי התורנות מסיר את כל השיבוצים מהטבלה", out.clearedAll, String(out.clearedAll));
record("יומן: אירוע לכל יום בטווח", out.calRange, String(out.calRange));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
