/* "שבוע הבא" הוא תכנון פרטי של מ״ע תורנויות: שאר היוזרים רואים רק
   שעבר+נוכחי, לא ניתן לנווט ל"הבא", ופרסום מרוקן את "שבוע הבא". */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  window.confirm = ()=>true; window.toast = ()=>{};
  // לוח כלשהו קיים לשלושת השבועות
  const mk = lead => { const x = migrateRosterToV2(null); x.days["ראשון"].lead = lead; return x; };
  await saveDutyRosterV2(mk("נוכחי"), "current");
  await saveDutyRosterV2(mk("הבא"), "next");
  await saveDutyRosterV2(mk("שעבר"), "prev");

  // --- לא-מ״ע: אין "שבוע הבא" ---
  isRosterManager = false; rosterView = "board"; boardWeekSlot = "next";
  rosterCache = null;
  await renderRosterView();
  r.resetFromNext = boardWeekSlot === "current";     // הוחזר מ"הבא" לנוכחי
  const html = document.getElementById("roster-view").innerHTML;
  r.noNextTab = !html.includes("שבוע הבא");
  setBoardWeek("next"); r.setNextBlocked = boardWeekSlot === "current";
  boardWeekSlot = "current"; rosterWeekShift(1); r.swipeCantReachNext = boardWeekSlot !== "next";

  // --- מ״ע תורנויות: כן רואה "שבוע הבא" ---
  isRosterManager = true; rosterCache = null;
  await renderRosterView();
  r.mgrHasNext = document.getElementById("roster-view").innerHTML.includes("שבוע הבא");

  // --- פרסום מרוקן את "שבוע הבא" ---
  await openRosterEditor(null, "next");
  rosterDraft.days["ראשון"].lead = "טיוטה חדשה";
  await publishFutureRoster();
  const cur = await getDutyRoster("current");
  const nxt = await getDutyRoster("next");
  r.publishedToCurrent = cur.days["ראשון"].lead === "טיוטה חדשה";
  r.nextClearedAfterPublish = WEEK_DAYS_HE.every(d=>rosterDayCount(nxt.days[d])===0);

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("לא-מ״ע: 'הבא' מוחזר לנוכחי ברינדור", out.resetFromNext, String(out.resetFromNext));
record("לא-מ״ע: אין לשונית 'שבוע הבא'", out.noNextTab, String(out.noNextTab));
record("לא-מ״ע: setBoardWeek('next') חסום", out.setNextBlocked, String(out.setNextBlocked));
record("לא-מ״ע: החלקה לא מגיעה ל'הבא'", out.swipeCantReachNext, String(out.swipeCantReachNext));
record("מ״ע תורנויות: כן רואה 'שבוע הבא'", out.mgrHasNext, String(out.mgrHasNext));
record("פרסום: הטיוטה הפכה ללוח הנוכחי", out.publishedToCurrent, String(out.publishedToCurrent));
record("פרסום: 'שבוע הבא' התרוקן", out.nextClearedAfterPublish, String(out.nextClearedAfterPublish));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
