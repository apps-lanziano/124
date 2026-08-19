/* "שבוע הבא" הוא תכנון פרטי של מ״ע תורנויות עד ללחיצה על "פרסם לוח
   צוות": לפני פרסום שאר היוזרים רואים רק שעבר+נוכחי ולא ניתן לנווט
   ל"הבא". אחרי פרסום (roster.published) הוא גלוי לכולם כ"שבוע הבא" —
   אבל הפרסום עצמו לא מקדם אותו ללוח הנוכחי ולא נוגע בו; הקידום הוא
   פעולה נפרדת ומפורשת (restoreWeekToCurrent, ר' roster_restore_test). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  window.confirm = ()=>true; window.toast = ()=>{};
  // לוח כלשהו קיים לשלושת השבועות; "הבא" עדיין לא פורסם (published:false כברירת מחדל)
  const mk = lead => { const x = migrateRosterToV2(null); x.days["ראשון"].lead = lead; return x; };
  await saveDutyRosterV2(mk("נוכחי"), "current");
  await saveDutyRosterV2(mk("הבא"), "next");
  await saveDutyRosterV2(mk("שעבר"), "prev");

  // --- לא-מ״ע, לפני פרסום: אין "שבוע הבא" ---
  isRosterManager = false; rosterView = "board"; boardWeekSlot = "next";
  rosterCache = null;
  await renderRosterView();
  r.resetFromNext = boardWeekSlot === "current";     // הוחזר מ"הבא" לנוכחי
  const html = document.getElementById("roster-view").innerHTML;
  r.noNextTab = !html.includes("שבוע הבא");
  await setBoardWeek("next"); r.setNextBlocked = boardWeekSlot === "current";
  boardWeekSlot = "current"; await rosterWeekShift(1); r.swipeCantReachNext = boardWeekSlot !== "next";

  // --- מ״ע תורנויות: כן רואה "שבוע הבא" גם לפני פרסום ---
  isRosterManager = true; rosterCache = null;
  await renderRosterView();
  r.mgrHasNext = document.getElementById("roster-view").innerHTML.includes("שבוע הבא");

  // --- פרסום: מסמן published, לא נוגע ב-current, לא מרוקן את "הבא" ---
  await openRosterEditor(null, "next");
  rosterDraft.days["ראשון"].lead = "טיוטה חדשה";
  await publishFutureRoster();
  const cur = await getDutyRoster("current");
  const nxt = await getDutyRoster("next");
  r.currentUntouchedByPublish = cur.days["ראשון"].lead === "נוכחי";
  r.nextHasPublishedDraft = nxt.days["ראשון"].lead === "טיוטה חדשה";
  r.nextMarkedPublished = nxt.published === true;

  // --- אחרי הפרסום: גם לא-מ״ע רואה את "שבוע הבא" ---
  isRosterManager = false; rosterCache = null; boardWeekSlot = "current";
  await renderRosterView();
  const html2 = document.getElementById("roster-view").innerHTML;
  r.nonMgrSeesNextTabAfterPublish = html2.includes("שבוע הבא");
  await setBoardWeek("next");
  r.nonMgrCanOpenNextAfterPublish = boardWeekSlot === "next";
  const html3 = document.getElementById("roster-view").innerHTML;
  r.nonMgrSeesPublishedContent = html3.includes("טיוטה חדשה");
  // אבל עדיין לא רואה את באנר הקידום ("קבע כלוח נוכחי") — זה נשאר למ״ע בלבד
  r.nonMgrNoRestoreBanner = !html3.includes("קבע את הלוח הזה");

  isRosterManager = true;
  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("לא-מ״ע לפני פרסום: 'הבא' מוחזר לנוכחי ברינדור", out.resetFromNext, String(out.resetFromNext));
record("לא-מ״ע לפני פרסום: אין לשונית 'שבוע הבא'", out.noNextTab, String(out.noNextTab));
record("לא-מ״ע לפני פרסום: setBoardWeek('next') חסום", out.setNextBlocked, String(out.setNextBlocked));
record("לא-מ״ע לפני פרסום: החלקה לא מגיעה ל'הבא'", out.swipeCantReachNext, String(out.swipeCantReachNext));
record("מ״ע תורנויות: כן רואה 'שבוע הבא' גם לפני פרסום", out.mgrHasNext, String(out.mgrHasNext));
record("פרסום: לא נוגע בלוח הנוכחי", out.currentUntouchedByPublish, String(out.currentUntouchedByPublish));
record("פרסום: הטיוטה נשארת ב'שבוע הבא'", out.nextHasPublishedDraft, String(out.nextHasPublishedDraft));
record("פרסום: הלוח מסומן published", out.nextMarkedPublished, String(out.nextMarkedPublished));
record("אחרי פרסום: גם לא-מ״ע רואה לשונית 'שבוע הבא'", out.nonMgrSeesNextTabAfterPublish, String(out.nonMgrSeesNextTabAfterPublish));
record("אחרי פרסום: לא-מ״ע יכול לנווט ל'שבוע הבא'", out.nonMgrCanOpenNextAfterPublish, String(out.nonMgrCanOpenNextAfterPublish));
record("אחרי פרסום: לא-מ״ע רואה את התוכן שפורסם", out.nonMgrSeesPublishedContent, String(out.nonMgrSeesPublishedContent));
record("לא-מ״ע לא רואה את באנר 'קבע כלוח נוכחי'", out.nonMgrNoRestoreBanner, String(out.nonMgrNoRestoreBanner));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
