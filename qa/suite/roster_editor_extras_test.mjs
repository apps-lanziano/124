/* תוספות לעורך מ"ע: (1) ספירת פעילויות רק א׳–ד׳ (חמישי=סופ"ש לא נספר),
   (2) בחירה מרובה בבנק האנשים (סימון כמה ואז אישור), (3) תצוגה מקדימה
   של הטיוטה כמו הלוח השבועי לפני פרסום. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  await saveDutyRosterV2(migrateRosterToV2(null), "current");
  await openRosterEditor(null, "current");

  // ספירה א׳–ד׳ בלבד: שני ימי חול + חמישי (סופ"ש) → נספרים רק 2
  rosterDraft.days["ראשון"].pf = [{name:"חייל א סככה 1"}];
  rosterDraft.days["שני"].pf   = [{name:"חייל א סככה 1"}];
  rosterDraft.days["חמישי"].pf = [{name:"חייל א סככה 1"}];
  rosterEdDay = "שלישי";
  openRosterPick("pf");
  const row = rosterPickRows.find(x=>x.name==="חייל א סככה 1");
  r.countSunWed = !!row && row.cnt===2;         // חמישי לא נספר

  // בחירה מרובה
  r.multiMode = rosterPickMulti===true;
  const pick = (nm)=>{ const i=rosterPickRows.findIndex(x=>x.name===nm); rosterPickChoose(i); };
  pick("חייל ב סככה 1"); pick("חייל א סככה 2");
  r.selTwo = rosterPickSel.size===2;
  confirmRosterPick();
  r.bothAdded = rosterDraft.days["שלישי"].pf.filter(p=>["חייל ב סככה 1","חייל א סככה 2"].includes(p.name)).length===2;
  r.modalClosed = !document.getElementById("roster-pick-modal").classList.contains("open");

  // משבצת יחידנית (ר״צ) נשארת בחירה בודדת
  openRosterPick("lead");
  r.singleMode = rosterPickMulti===false;
  const li = rosterPickRows.findIndex(x=>x.name==="חייל ב סככה 2");
  rosterPickChoose(li);
  r.singleAdded = rosterDraft.days["שלישי"].lead==="חייל ב סככה 2"
    && !document.getElementById("roster-pick-modal").classList.contains("open");

  // תצוגה מקדימה — כמו הלוח השבועי (טבלה) במסך מלא
  previewRosterDraft();
  r.previewOpen = document.getElementById("roster-full").classList.contains("open")
    && document.getElementById("roster-full-inner").innerHTML.includes("roster-grid");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("ספירת פעילויות רק א׳–ד׳ (חמישי לא נספר)", out.countSunWed, String(out.countSunWed));
record("משבצת רשימה נפתחת במצב בחירה מרובה", out.multiMode, String(out.multiMode));
record("סימון שני שמות לפני אישור", out.selTwo, String(out.selTwo));
record("אישור משבץ את כל המסומנים בבת אחת", out.bothAdded, String(out.bothAdded));
record("החלון נסגר אחרי אישור", out.modalClosed, String(out.modalClosed));
record("משבצת יחידנית (ר״צ) נשארת בחירה בודדת", out.singleMode, String(out.singleMode));
record("בחירה בודדת משבצת מיד וסוגרת", out.singleAdded, String(out.singleAdded));
record("תצוגה מקדימה מציגה את הלוח כטבלה", out.previewOpen, String(out.previewOpen));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
