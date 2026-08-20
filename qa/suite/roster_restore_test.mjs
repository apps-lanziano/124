/* קביעת "לוח נוכחי" (restoreWeekToCurrent) — אותה לוגיקה בשני הכיוונים
   (שבוע הבא/שבוע שעבר → נוכחי): הלוח הנוכחי הקודם עובר תמיד ל"שבוע שעבר"
   (לא נמחק), וכש-slot="next" גם מתרוקן "שבוע הבא" לגמרי אחרי ההעברה —
   אין סיבה לכפל לוחות. שחזור מהארכיון (restoreArchivedToCurrent) נשאר
   בהתנהגותו המקורית — לא חלק מהשינוי הזה. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  window.confirm = ()=>true;

  // ===== תרחיש 1: "שבוע הבא" → נוכחי (המקרה העיקרי מהבקשה) =====
  const curA = migrateRosterToV2(null); curA.days["ראשון"].lead = "רץ עכשיו";
  const nextA = migrateRosterToV2(null); nextA.days["ראשון"].lead = "שבוע הבא";
  const prevA = migrateRosterToV2(null); prevA.days["ראשון"].lead = "ישן מאוד";
  await saveDutyRosterV2(curA, "current");
  await saveDutyRosterV2(nextA, "next", true);   // published כדי לוודא שגם זה מתאפס
  await saveDutyRosterV2(prevA, "prev");

  boardWeekSlot = "next";
  await restoreWeekToCurrent("next");
  const cur1 = await getDutyRoster("current");
  const nxt1 = await getDutyRoster("next");
  const prv1 = await getDutyRoster("prev");
  r.a_currentBecameNext = cur1.days["ראשון"].lead === "שבוע הבא";
  r.a_oldCurrentMovedToPrev = prv1.days["ראשון"].lead === "רץ עכשיו";
  r.a_nextWiped = nxt1.days["ראשון"].lead === "" && nxt1.published === false;
  r.a_backToCurrentView = boardWeekSlot === "current";

  // ===== תרחיש 2: "שבוע שעבר" → נוכחי (אותו טיפול, כיוון הפוך) =====
  const curB = migrateRosterToV2(null); curB.days["ראשון"].lead = "השבוע הנוכחי";
  const nextB = migrateRosterToV2(null); nextB.days["ראשון"].lead = "טיוטת הבא — לא אמורה להיפגע";
  const prevB = migrateRosterToV2(null); prevB.days["ראשון"].lead = "שבוע אמיתי";
  await saveDutyRosterV2(curB, "current");
  await saveDutyRosterV2(nextB, "next");
  await saveDutyRosterV2(prevB, "prev");

  boardWeekSlot = "prev";
  await restoreWeekToCurrent("prev");
  const cur2 = await getDutyRoster("current");
  const nxt2 = await getDutyRoster("next");
  const prv2 = await getDutyRoster("prev");
  r.b_currentBecamePrev = cur2.days["ראשון"].lead === "שבוע אמיתי";
  r.b_oldCurrentMovedToPrevSlot = prv2.days["ראשון"].lead === "השבוע הנוכחי";
  r.b_nextUntouched = nxt2.days["ראשון"].lead === "טיוטת הבא — לא אמורה להיפגע";
  r.b_backToCurrentView = boardWeekSlot === "current";

  // ===== שחזור מהארכיון (restoreArchivedToCurrent) — לא חלק מהשינוי, נשאר כפי שהיה =====
  const arch = migrateRosterToV2(null); arch.days["שני"].lead = "מהארכיון";
  const nextC = migrateRosterToV2(null); nextC.days["ראשון"].lead = "טיוטת הבא — ארכיון";
  await saveDutyRosterV2(nextC, "next");
  await saveRosterArchive([{key:"k1", label:"1.1–7.1", savedAt:new Date().toISOString(), roster:arch}]);
  await renderRosterArchiveList();
  await restoreArchivedToCurrent(0);
  const cur3 = await getDutyRoster("current");
  const nxt3 = await getDutyRoster("next");
  r.archiveRestored = cur3.days["שני"].lead === "מהארכיון";
  r.archiveNextUntouched = nxt3.days["ראשון"].lead === "טיוטת הבא — ארכיון";

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));

record("[שבוע הבא→נוכחי] הלוח הנוכחי הופך לתוכן 'שבוע הבא'", out.a_currentBecameNext, String(out.a_currentBecameNext));
record("[שבוע הבא→נוכחי] הלוח הנוכחי הקודם עבר ל'שבוע שעבר'", out.a_oldCurrentMovedToPrev, String(out.a_oldCurrentMovedToPrev));
record("[שבוע הבא→נוכחי] 'שבוע הבא' התרוקן לגמרי (אין כפל לוחות)", out.a_nextWiped, String(out.a_nextWiped));
record("[שבוע הבא→נוכחי] אחרי הפעולה חוזרים לתצוגת 'נוכחי'", out.a_backToCurrentView, String(out.a_backToCurrentView));

record("[שבוע שעבר→נוכחי] הלוח הנוכחי הופך לתוכן 'שבוע שעבר'", out.b_currentBecamePrev, String(out.b_currentBecamePrev));
record("[שבוע שעבר→נוכחי] הלוח הנוכחי הקודם עבר לסלוט 'שבוע שעבר'", out.b_oldCurrentMovedToPrevSlot, String(out.b_oldCurrentMovedToPrevSlot));
record("[שבוע שעבר→נוכחי] 'שבוע הבא' לא נגע בו כלל", out.b_nextUntouched, String(out.b_nextUntouched));
record("[שבוע שעבר→נוכחי] אחרי הפעולה חוזרים לתצוגת 'נוכחי'", out.b_backToCurrentView, String(out.b_backToCurrentView));

record("שחזור מהארכיון → נוכחי (התנהגות מקורית, ללא שינוי)", out.archiveRestored, String(out.archiveRestored));
record("שחזור מהארכיון לא נוגע ב'שבוע הבא' (התנהגות מקורית)", out.archiveNextUntouched, String(out.archiveNextUntouched));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
