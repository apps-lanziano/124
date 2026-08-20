/* ⛔ המשכיות לוחות: העברת לוח בין סלוטים לא מאבדת נתונים.

   באג אמיתי שדווח ("דרסת את הלוח שרץ השבוע — אין המשכיות"): פיצול
   הסופ"ש (`managerWknd`/`fixedAugWknd` על יום "חמישי") הוא עזר-עריכה
   שקיים **רק** בטיוטת העורך, ו-`saveDutyRosterV2` גזר ממנו תמיד את
   מנהל+מתגבר של שישי/שבת. לכן כל שמירה של לוח שנקרא מהאחסון ולא עבר
   בעורך — קרי כל *העברה* בין סלוטים — מחקה את משמרת הסופ"ש לריק:

     · restoreWeekToCurrent  ("הבא"→"נוכחי", והנוכחי→"שעבר")
     · maybeRotateWeek       (רוטציה שבועית אוטומטית)
     · restoreArchivedToCurrent (שחזור מארכיון)
     · כתיבות-רקע: זריעת/ריפוי שורות מותאמות-אישית

   הבדיקה מוודאת שהעברה משמרת את הלוח **במלואו**, ושעריכת סופ"ש דרך
   העורך (המסלול היחיד שכן אמור לפצל) ממשיכה לעבוד. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true; window.confirm = ()=>true; window.toast = ()=>{};

  const mkFull = tag => {
    const b = migrateRosterToV2(null);
    b.days["ראשון"].lead   = tag+"-ראשון";
    b.days["חמישי"].manager = tag+"-מנהל-חמישי";
    b.days["שישי"].manager  = tag+"-מנהל-סופש";
    b.days["שבת"].manager   = tag+"-מנהל-סופש";
    b.days["שישי"].fixedAug = [tag+"-מתגבר-סופש"];
    b.days["שבת"].fixedAug  = [tag+"-מתגבר-סופש"];
    return b;
  };

  // --- שמירה+קריאה בסיסית לא מאבדת את הסופ"ש ---
  await saveDutyRosterV2(mkFull("A"), "current");
  let c = await getDutyRoster("current");
  r.saveKeepsWkndManager = c.days["שישי"].manager === "A-מנהל-סופש" && c.days["שבת"].manager === "A-מנהל-סופש";
  r.saveKeepsWkndFixedAug = (c.days["שישי"].fixedAug||[]).includes("A-מתגבר-סופש");
  r.saveKeepsThuManager = c.days["חמישי"].manager === "A-מנהל-חמישי";

  // --- העברה: "הבא"→"נוכחי", והנוכחי→"שעבר" — שניהם במלואם ---
  await saveDutyRosterV2(mkFull("PREV"), "prev");
  await saveDutyRosterV2(mkFull("CUR"),  "current");
  await saveDutyRosterV2(mkFull("NEXT"), "next");
  await restoreWeekToCurrent("next");
  const P = await getDutyRoster("prev"), C = await getDutyRoster("current"), N = await getDutyRoster("next");

  r.oldCurrentMovedToPrev = P.days["ראשון"].lead === "CUR-ראשון";
  r.prevKeptItsWeekend    = P.days["שישי"].manager === "CUR-מנהל-סופש" &&
                            (P.days["שבת"].fixedAug||[]).includes("CUR-מתגבר-סופש");
  r.newCurrentIsNext      = C.days["ראשון"].lead === "NEXT-ראשון";
  r.newCurrentKeptWeekend = C.days["שישי"].manager === "NEXT-מנהל-סופש" &&
                            (C.days["שבת"].fixedAug||[]).includes("NEXT-מתגבר-סופש");
  r.prevIsNotCurrent      = P.days["ראשון"].lead !== C.days["ראשון"].lead;
  r.nextEmptiedAfterMove  = N.days["ראשון"].lead === "";

  // --- רוטציה שבועית אוטומטית משמרת גם היא את הסופ"ש ---
  _rotateTried = false;
  await sSetRaw("board_rotated_week", "2000-01-02");
  await saveDutyRosterV2(mkFull("ROTCUR"),  "current");
  await saveDutyRosterV2(mkFull("ROTNEXT"), "next");
  await maybeRotateWeek();
  const RC = await getDutyRoster("current"), RP = await getDutyRoster("prev");
  r.rotateKeptWeekendOnCurrent = RC.days["שישי"].manager === "ROTNEXT-מנהל-סופש";
  r.rotateKeptWeekendOnPrev    = RP.days["שישי"].manager === "ROTCUR-מנהל-סופש";

  // --- כתיבת-רקע (ריפוי שורות מותאמות-אישית) לא מוחקת את הסופ"ש ---
  rosterCustomRows = [{id:"cr_bg", label:"PF יום בלבד", afterKey:"pf"}];
  await saveRosterCustomRows(rosterCustomRows);
  const bg = mkFull("BG"); await saveDutyRosterV2(bg, "current");
  const bgNext = mkFull("BGN"); bgNext.days["ראשון"]["custom_cr_bg"] = ["פלוני"];
  await saveDutyRosterV2(bgNext, "next");
  await healLegacyLeakedCustomRows();
  const afterHeal = await getDutyRoster("current");
  r.backgroundWriteKeptWeekend = afterHeal.days["שישי"].manager === "BG-מנהל-סופש" &&
                                 (afterHeal.days["שבת"].fixedAug||[]).includes("BG-מתגבר-סופש");

  // --- מסלול העורך (הפיצול האמיתי) ממשיך לעבוד כרגיל ---
  await saveDutyRosterV2(mkFull("ED"), "current");
  await openRosterEditor(null, "current");
  r.editorLoadedSplit = rosterDraft.days["חמישי"].managerWknd === "ED-מנהל-סופש";
  rosterDraft.days["חמישי"].manager     = "עורך-חמישי";
  rosterDraft.days["חמישי"].managerWknd = "עורך-סופש";
  rosterDraft.days["חמישי"].fixedAugWknd = ["עורך-מתגבר-סופש"];
  await saveDutyRosterV2(rosterDraft, "current");
  const E = await getDutyRoster("current");
  r.editorSplitThu  = E.days["חמישי"].manager === "עורך-חמישי";
  r.editorSplitWknd = E.days["שישי"].manager === "עורך-סופש" && E.days["שבת"].manager === "עורך-סופש";
  r.editorSplitAug  = (E.days["שבת"].fixedAug||[]).includes("עורך-מתגבר-סופש");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("שמירה+קריאה משמרת מנהל סופ״ש", out.saveKeepsWkndManager, String(out.saveKeepsWkndManager));
record("שמירה+קריאה משמרת מתגבר סופ״ש", out.saveKeepsWkndFixedAug, String(out.saveKeepsWkndFixedAug));
record("שמירה+קריאה משמרת מנהל יום ה׳", out.saveKeepsThuManager, String(out.saveKeepsThuManager));
record("העברה: הלוח שרץ עבר ל'שבוע שעבר'", out.oldCurrentMovedToPrev, String(out.oldCurrentMovedToPrev));
record("⛔ 'שבוע שעבר' שמר את משמרת הסופ״ש שלו (המשכיות)", out.prevKeptItsWeekend, String(out.prevKeptItsWeekend));
record("העברה: הלוח החדש הוא זה של 'שבוע הבא'", out.newCurrentIsNext, String(out.newCurrentIsNext));
record("⛔ הלוח הנוכחי החדש שמר את משמרת הסופ״ש שלו", out.newCurrentKeptWeekend, String(out.newCurrentKeptWeekend));
record("'שבוע שעבר' אינו זהה ל'נוכחי'", out.prevIsNotCurrent, String(out.prevIsNotCurrent));
record("'שבוע הבא' התרוקן אחרי ההעברה", out.nextEmptiedAfterMove, String(out.nextEmptiedAfterMove));
record("⛔ רוטציה שבועית משמרת סופ״ש בלוח הנוכחי", out.rotateKeptWeekendOnCurrent, String(out.rotateKeptWeekendOnCurrent));
record("⛔ רוטציה שבועית משמרת סופ״ש בלוח שעבר", out.rotateKeptWeekendOnPrev, String(out.rotateKeptWeekendOnPrev));
record("⛔ כתיבת-רקע (ריפוי שורות) לא מוחקת את הסופ״ש", out.backgroundWriteKeptWeekend, String(out.backgroundWriteKeptWeekend));
record("העורך טוען את עזר פיצול הסופ״ש", out.editorLoadedSplit, String(out.editorLoadedSplit));
record("עריכה: מנהל יום ה׳ נשמר נכון", out.editorSplitThu, String(out.editorSplitThu));
record("עריכה: מנהל שישי–שבת נשמר נכון (הפיצול עובד)", out.editorSplitWknd, String(out.editorSplitWknd));
record("עריכה: מתגבר שישי–שבת נשמר נכון", out.editorSplitAug, String(out.editorSplitAug));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
