/* בניית לוח עתידי: "שמור טיוטה" שומר וממשיך לערוך בלי לפרסם (פרטי, לא
   נוגע בלוח הפעיל), ו"פרסם לוח צוות" מסמן אותו published (גלוי לכולם
   כ"שבוע הבא") — בלי לקדם אותו ללוח הפעיל ובלי לגעת בו כלל. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  window.confirm = ()=>true;

  // מאפסים את שני הלוחות
  await saveDutyRosterV2(migrateRosterToV2(null), "current");
  await saveDutyRosterV2(migrateRosterToV2(null), "next");

  // עורך עתידי — שני כפתורים: "שמור טיוטה" גלוי, הראשי = "פרסם לוח צוות"
  await openRosterEditor(null, "next");
  r.saveDraftShown = !document.getElementById("roster-ed-savedraft").classList.contains("hidden");
  r.publishLabel = document.getElementById("roster-ed-publish").textContent.includes("פרסם לוח צוות");

  // עורכים ושומרים טיוטה — הלוח הפעיל לא משתנה, העורך נשאר פתוח
  rosterDraft.days["שני"].lead = "חייל א סככה 1";
  await saveRosterDraftNext();
  r.draftInNext   = (await getDutyRoster("next")).days["שני"].lead === "חייל א סככה 1";
  r.currentClean  = (await getDutyRoster("current")).days["שני"].lead === "";
  r.editorStaysOpen = document.getElementById("duty-roster-modal").classList.contains("open");

  // ממשיכים לערוך ואז מפרסמים — הטיוטה מסומנת published, נשארת ב"הבא",
  // והלוח הפעיל (current) לא נוגע בכלל
  rosterDraft.days["שלישי"].lead = "חייל ב סככה 1";
  await publishFutureRoster();
  const cur = await getDutyRoster("current");
  const nxt = await getDutyRoster("next");
  r.currentUntouchedByPublish = cur.days["שני"].lead === "" && cur.days["שלישי"].lead === "";
  r.publishedStaysInNext = nxt.days["שני"].lead === "חייל א סככה 1" && nxt.days["שלישי"].lead === "חייל ב סככה 1";
  r.nextMarkedPublished = nxt.published === true;
  r.editorClosed = !document.getElementById("duty-roster-modal").classList.contains("open");

  // בלוח הנוכחי אין כפתור "שמור טיוטה", והראשי = "שמור ופרסם"
  await openRosterEditor(null, "current");
  r.curNoDraftBtn = document.getElementById("roster-ed-savedraft").classList.contains("hidden");
  r.curPublishLabel = document.getElementById("roster-ed-publish").textContent.includes("שמור ופרסם");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("עתידי: כפתור \"שמור טיוטה\" גלוי", out.saveDraftShown, String(out.saveDraftShown));
record("עתידי: הכפתור הראשי = \"פרסם לוח צוות\"", out.publishLabel, String(out.publishLabel));
record("שמירת טיוטה נשמרת ללוח העתידי", out.draftInNext, String(out.draftInNext));
record("שמירת טיוטה לא נוגעת בלוח הפעיל", out.currentClean, String(out.currentClean));
record("העורך נשאר פתוח אחרי שמירת טיוטה", out.editorStaysOpen, String(out.editorStaysOpen));
record("פרסום: לא נוגע בלוח הפעיל", out.currentUntouchedByPublish, String(out.currentUntouchedByPublish));
record("פרסום: הטיוטה נשארת ב\"שבוע הבא\"", out.publishedStaysInNext, String(out.publishedStaysInNext));
record("פרסום: הלוח מסומן published", out.nextMarkedPublished, String(out.nextMarkedPublished));
record("העורך נסגר אחרי פרסום", out.editorClosed, String(out.editorClosed));
record("לוח נוכחי: אין כפתור \"שמור טיוטה\"", out.curNoDraftBtn, String(out.curNoDraftBtn));
record("לוח נוכחי: הכפתור הראשי = \"שמור ופרסם\"", out.curPublishLabel, String(out.curPublishLabel));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
