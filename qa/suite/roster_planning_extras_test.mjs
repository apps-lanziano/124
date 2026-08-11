/* תוספות לתכנון הלוח: (1) חוק "עשה שבת → לא לראשון" — צהוב בבנק האנשים
   של הלוח העתידי; (2) מונה שיבוץ "שובץ N/Q" ומקרא צבעים; (3) ארכיון
   לוחות שבועי (לפחות 6, עד 8) לטובת מעקב מ"ע תורנויות. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  window.confirm = ()=>true;

  // לוח נוכחי: מישהו עשה שבת (נכנס דרך מפתח משמרת הסופ"ש "חמישי")
  const cur = migrateRosterToV2(null);
  cur.days["חמישי"].lead = "חייל א סככה 1";
  await saveDutyRosterV2(cur, "current"); rosterCache = null;

  // בונים לוח עתידי — בבנק האנשים מי שעשה שבת מסומן צהוב
  await openRosterEditor(null, "next");
  rosterEdDay = "ראשון";
  openRosterPick("pf");
  const satRow = rosterPickRows.find(x=>x.name==="חייל א סככה 1");
  r.satFlag = !!(satRow && satRow.sat);
  r.legendHasSat = document.getElementById("roster-pick-legend").innerHTML.includes("עשה שבת");

  // מונה שיבוץ: חייל ששובץ פעם אחת בטיוטה => cnt=1
  rosterDraft.days["שני"].pf = [{name:"חייל ב סככה 1"}];
  renderRosterPickList();
  const cntRow = rosterPickRows.find(x=>x.name==="חייל ב סככה 1");
  r.cntShown = !!(cntRow && cntRow.cnt===1 && cntRow.quota>=2);
  r.legendHasCounts = /שובץ חלקית|השלים מכסה/.test(document.getElementById("roster-pick-legend").innerHTML);
  document.getElementById("roster-pick-modal").classList.remove("open");
  document.getElementById("duty-roster-modal").classList.remove("open");

  // ארכיון: שמירה ידנית, ללא כפילות לאותו שבוע, וצפייה
  await saveRosterArchive([]);
  await archiveNow();
  let arc = await getRosterArchive();
  r.arcSaved = arc.length===1 && !!arc[0].roster && !!arc[0].label && !!arc[0].key;
  await archiveNow();
  r.arcNoDup = (await getRosterArchive()).length===1;   // אותו שבוע — עודכן, לא שוכפל
  await openRosterArchive();
  r.arcModalOpen = document.getElementById("roster-archive-modal").classList.contains("open");
  viewArchivedRoster(0);
  r.arcView = document.getElementById("roster-full").classList.contains("open")
    && document.getElementById("roster-full-inner").innerHTML.includes("roster-grid");

  // תקרה: 8 לוחות ותיקים + שמירה חדשה => נשמרים לכל היותר 8
  const eight = [];
  for(let i=1;i<=8;i++) eight.push({key:"old"+i, label:"l"+i, savedAt:new Date().toISOString(), roster:cur});
  await saveRosterArchive(eight);
  await archiveNow();
  r.arcCapped = (await getRosterArchive()).length===8;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("עשה שבת → מסומן צהוב בבנק הלוח העתידי", out.satFlag, String(out.satFlag));
record("מקרא כולל \"עשה שבת\" בלוח עתידי", out.legendHasSat, String(out.legendHasSat));
record("מונה שיבוץ מציג כמה פעמים שובץ השבוע", out.cntShown, String(out.cntShown));
record("מקרא הצבעים מוצג", out.legendHasCounts, String(out.legendHasCounts));
record("ארכיון: הלוח הנוכחי נשמר", out.arcSaved, String(out.arcSaved));
record("ארכיון: אותו שבוע לא משוכפל", out.arcNoDup, String(out.arcNoDup));
record("ארכיון: המודל נפתח", out.arcModalOpen, String(out.arcModalOpen));
record("ארכיון: צפייה בלוח שמור מציגה טבלה", out.arcView, String(out.arcView));
record("ארכיון: נשמרים לכל היותר 8 לוחות (לפחות 6)", out.arcCapped, String(out.arcCapped));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
