/* שחזור לוח: מ"ע יכול לקבוע את "שבוע שעבר" (או ארכיון) כ"לוח נוכחי" בלי
   לגעת ב"שבוע הבא" — שחזור בטוח מאובדן/דריסה. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  window.confirm = ()=>true;

  // מצב אחרי התקלה: prev = השבוע האמיתי, current = בטעות שבוע הבא, next = שבוע הבא
  const real = migrateRosterToV2(null); real.days["ראשון"].lead = "שבוע אמיתי";
  const nextW = migrateRosterToV2(null); nextW.days["ראשון"].lead = "שבוע הבא";
  await saveDutyRosterV2(real, "prev");
  await saveDutyRosterV2(nextW, "current");
  await saveDutyRosterV2(nextW, "next");

  // שחזור "שבוע שעבר" → נוכחי
  boardWeekSlot = "prev";
  await restoreWeekToCurrent("prev");
  const cur = await getDutyRoster("current");
  const nxt = await getDutyRoster("next");
  const prv = await getDutyRoster("prev");
  r.currentRestored = cur.days["ראשון"].lead === "שבוע אמיתי";
  r.nextUntouched   = nxt.days["ראשון"].lead === "שבוע הבא";
  r.prevUntouched   = prv.days["ראשון"].lead === "שבוע אמיתי";
  r.backToCurrentView = boardWeekSlot === "current";

  // שחזור מהארכיון
  const arch = migrateRosterToV2(null); arch.days["שני"].lead = "מהארכיון";
  await saveRosterArchive([{key:"k1", label:"1.1–7.1", savedAt:new Date().toISOString(), roster:arch}]);
  await renderRosterArchiveList();
  await restoreArchivedToCurrent(0);
  const cur2 = await getDutyRoster("current");
  const nxt2 = await getDutyRoster("next");
  r.archiveRestored = cur2.days["שני"].lead === "מהארכיון";
  r.nextStillUntouched = nxt2.days["ראשון"].lead === "שבוע הבא";

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("שחזור 'שבוע שעבר' → נוכחי", out.currentRestored, String(out.currentRestored));
record("'שבוע הבא' לא נגע בשחזור", out.nextUntouched, String(out.nextUntouched));
record("'שבוע שעבר' עצמו נשמר", out.prevUntouched, String(out.prevUntouched));
record("אחרי שחזור חוזרים לתצוגת 'נוכחי'", out.backToCurrentView, String(out.backToCurrentView));
record("שחזור מהארכיון → נוכחי", out.archiveRestored, String(out.archiveRestored));
record("'שבוע הבא' לא נגע בשחזור מארכיון", out.nextStillUntouched, String(out.nextStillUntouched));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
