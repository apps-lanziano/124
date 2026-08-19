/* תיקון-עצמי רטרואקטיבי לשורות מותאמות-אישית שדלפו *לפני* שהזריעה
   (seedNewCustomRowDisabledElsewhere) נוספה: שורה שכבר נוצרה ויש לה
   שיבוץ בפועל בחלק מהשבועות (למשל "הבא", תוך כדי בניית לוח עתידי) אך
   לא בכל השבועות, מוסיפה מושבתת אוטומטית בשבועות שבהם היא ריקה —
   בלי שהמ״ע צריך ללחוץ ידנית על אף מתג. ר' healLegacyLeakedCustomRows,
   נקרא אוטומטית מ-renderRosterView בכל טעינת מסך התורנויות. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // שורה מותאמת-אישית "ותיקה" (נוצרה לפני שהזריעה החדשה קיימת) — יש לה
  // שיבוץ בפועל רק ב"הבא", ולא הושבתה במפורש באף שבוע (המצב שדווח בפועל)
  rosterCustomRows = [{id:"cr_legacy", label:"PF יום בלבד", afterKey:"__start__"}];
  await saveRosterCustomRows(rosterCustomRows);
  const cur = migrateRosterToV2(null);
  const nxt = migrateRosterToV2(null);
  nxt.days["ראשון"]["custom_cr_legacy"] = ["חייל פ א"];
  const prv = migrateRosterToV2(null);
  await saveDutyRosterV2(cur, "current");
  await saveDutyRosterV2(nxt, "next");
  await saveDutyRosterV2(prv, "prev");

  // לפני התיקון: השורה מוצגת ריקה גם ב"נוכחי" (בדיוק הבאג שדווח)
  const beforeHeal = rosterBoardHtml(await getDutyRoster("current"), "", "wide");
  r.leakedBeforeHeal = beforeHeal.includes("PF יום בלבד");

  // מריצים את הריפוי (בלי לעבור דרך renderRosterView המלא — קורא ישירות).
  // מאפסים את דגל "פעם אחת בסשן" — הכניסה עצמה (doLogin/renderRosterView
  // ברקע) כבר עלולה להריץ אותו לפני שהלוח שלנו בכלל נשמר.
  _legacyCustomRowHealDone = false;
  await healLegacyLeakedCustomRows();

  const curAfter = await getDutyRoster("current");
  const nxtAfter = await getDutyRoster("next");
  const prvAfter = await getDutyRoster("prev");
  r.disabledOnCurrentAfterHeal = (curAfter.disabledRows||[]).includes("cr_legacy");
  r.disabledOnPrevAfterHeal = (prvAfter.disabledRows||[]).includes("cr_legacy");
  r.stillEnabledOnNextAfterHeal = !(nxtAfter.disabledRows||[]).includes("cr_legacy");

  const htmlCurAfter = rosterBoardHtml(curAfter, "", "wide");
  const htmlNextAfter = rosterBoardHtml(nxtAfter, "", "wide");
  r.hiddenOnCurrentBoardAfterHeal = !htmlCurAfter.includes("PF יום בלבד");
  r.stillShownOnNextBoardAfterHeal = htmlNextAfter.includes("PF יום בלבד") && htmlNextAfter.includes("חייל פ א");

  // אידמפוטנטיות: ריצה שנייה לא משנה כלום ולא זורקת
  await healLegacyLeakedCustomRows();
  const curAfter2 = await getDutyRoster("current");
  r.idempotent = JSON.stringify((curAfter2.disabledRows||[]).sort()) === JSON.stringify((curAfter.disabledRows||[]).sort());

  // שורה שריקה **בכל** השבועות — לא נוגעים בה (אין איתות למה היא שייכת)
  rosterCustomRows = [...rosterCustomRows, {id:"cr_unused", label:"שורה שלא בשימוש", afterKey:"__start__"}];
  await saveRosterCustomRows(rosterCustomRows);
  _legacyCustomRowHealDone = false;
  await healLegacyLeakedCustomRows();
  const curAfter3 = await getDutyRoster("current");
  r.untouchedIfNeverUsedAnywhere = !(curAfter3.disabledRows||[]).includes("cr_unused");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("🔒 לפני הריפוי: השורה ה'ותיקה' דולפת ריקה ל'נוכחי' (הבאג שדווח)", out.leakedBeforeHeal, String(out.leakedBeforeHeal));
record("אחרי ריפוי: מושבתת אוטומטית ב'נוכחי'", out.disabledOnCurrentAfterHeal, String(out.disabledOnCurrentAfterHeal));
record("אחרי ריפוי: מושבתת אוטומטית ב'שעבר'", out.disabledOnPrevAfterHeal, String(out.disabledOnPrevAfterHeal));
record("אחרי ריפוי: נשארת מופעלת ב'הבא' (שם היא בשימוש בפועל)", out.stillEnabledOnNextAfterHeal, String(out.stillEnabledOnNextAfterHeal));
record("אחרי ריפוי: לא מוצגת בלוח 'נוכחי'", out.hiddenOnCurrentBoardAfterHeal, String(out.hiddenOnCurrentBoardAfterHeal));
record("אחרי ריפוי: עדיין מוצגת עם השם בלוח 'הבא'", out.stillShownOnNextBoardAfterHeal, String(out.stillShownOnNextBoardAfterHeal));
record("הריפוי אידמפוטנטי (ריצה שנייה לא משנה כלום)", out.idempotent, String(out.idempotent));
record("שורה שלא בשימוש בשום שבוע — לא נוגעים בה", out.untouchedIfNeverUsedAnywhere, String(out.untouchedIfNeverUsedAnywhere));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
