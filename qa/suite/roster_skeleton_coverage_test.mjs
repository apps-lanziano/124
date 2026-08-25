/* כיסוי משבצות שלד (מנהל/ר״צ/ל-ר״צ/מתגבר/מטיס/נהג/כלים) בפאנל "בדיקת
   חוקים" של עורך הלוח — שאלה שונה מ-computeRosterCompliance (שבודקת מכסת
   תורנויות לאדם): האם המשבצת עצמה מאוישת בכלל על פני א׳–ד׳. פונקציה
   טהורה נפרדת (computeRosterSkeletonCoverage) שלא נוגעת בלוגיקת
   computeRosterCompliance הקיימת. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // --- בדיקת הפונקציה הטהורה ---
  const draft = migrateRosterToV2(null);
  // מנהל: מלא בכל 4 הימים
  ["ראשון","שני","שלישי","רביעי"].forEach(d=> draft.days[d].manager = "מפקד א");
  // ר"צ: מלא ב-3 מתוך 4 (חסר ברביעי)
  draft.days["ראשון"].lead = "ניר"; draft.days["שני"].lead = "ניר"; draft.days["שלישי"].lead = "ניר";
  // מתגבר: מלא ביום אחד בלבד (25%)
  draft.days["ראשון"].fixedAug = ["דור"];
  // מטיס/נהג/ל-ר״צ/כלים: לא שובצו כלל (0%)

  const cov = computeRosterSkeletonCoverage(draft);
  const byKey = {}; cov.forEach(x=>byKey[x.key]=x);

  r.managerFullOk = byKey.manager.level === "ok" && byKey.manager.pct === 100 && byKey.manager.missing.length === 0;
  r.leadWarn = byKey.lead.level === "warn" && byKey.lead.pct === 75 && byKey.lead.missing.length === 1 && byKey.lead.missing[0] === "רביעי";
  r.fixedAugBad = byKey.fixedAug.level === "bad" && byKey.fixedAug.filled === 1;
  r.pilotBad = byKey.pilot.level === "bad" && byKey.pilot.filled === 0 && byKey.pilot.missing.length === 4;
  // סופ"ש (חמישי) לא נספר — כמו ב-computeRosterCompliance
  draft.days["חמישי"].pilot = "טייס א";
  const cov2 = computeRosterSkeletonCoverage(draft);
  r.weekendNotCounted = cov2.find(x=>x.key==="pilot").filled === 0;

  // --- בדיקת ה-UI בעורך הלוח ---
  rosterDraft = draft;
  rosterEditSlot = "current";
  rosterEdDay = "ראשון";
  await loadRosterCustomRows();
  renderRosterEditor();
  rosterComplianceOpen = true;
  renderRosterCompliance();
  const body = document.getElementById("roster-ed-compliance").innerHTML;
  r.panelShowsSkelHeader = body.includes("משבצות שלד");
  r.panelShowsLeadGap = body.includes("ר״צ") && body.includes("ד׳");   // DAY_LETTER["רביעי"] === "ד׳"
  r.panelShowsPilotGap = body.includes("מטיס");
  const chipsBar = document.querySelector(".rcmp-bar").textContent;
  r.barShowsSkelChip = chipsBar.includes("משבצות שלד ריקות");

  return r;
});

record("מנהל מלא ב-4/4 → ok, 100%, בלי חסרים", out.managerFullOk, out.managerFullOk);
record("ר״צ מלא ב-3/4 → warn, 75%, חסר ברביעי", out.leadWarn, out.leadWarn);
record("מתגבר (שדה רשימה) מלא ביום אחד → bad", out.fixedAugBad, out.fixedAugBad);
record("מטיס לא שובץ כלל → bad, 4 ימים חסרים", out.pilotBad, out.pilotBad);
record("שיבוץ בסופ״ש (חמישי) לא נספר לכיסוי", out.weekendNotCounted, out.weekendNotCounted);
record("הפאנל בעורך מציג את כותרת כיסוי השלד", out.panelShowsSkelHeader, out.panelShowsSkelHeader);
record("הפאנל מציג את הפער בר״צ (כולל היום החסר)", out.panelShowsLeadGap, out.panelShowsLeadGap);
record("הפאנל מציג את הפער במטיס", out.panelShowsPilotGap, out.panelShowsPilotGap);
record("צ'יפ 'משבצות שלד ריקות' מוצג בשורת הכותרת המצומצמת", out.barShowsSkelChip, out.barShowsSkelChip);

await closeBrowser();

console.log("=== SUMMARY ===");
let allPass = true;
for(const t of results){
  console.log(`${t.pass ? "✅" : "❌"} ${t.name}${t.pass ? "" : " - " + JSON.stringify(t.detail)}`);
  if(!t.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass ? 0 : 1);
