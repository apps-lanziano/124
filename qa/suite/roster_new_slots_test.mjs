/* משבצות חדשות בלוח הצוות: "מנהל" ו"מטיס" (אדם בודד), ושורת "PMS נחים"
   שמופיעה רק כשיש בה שיבוץ. וגם הסדר החדש של השורות. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  const base = migrateRosterToV2(null);
  base.days["ראשון"].manager = "מנהל א";
  base.days["ראשון"].pilot   = "מטיס א";
  base.days["ראשון"].lead    = "ראש א";

  // ללא PMS נחים — השורה לא אמורה להופיע
  const html1 = rosterBoardHtml(base, "", "wide");
  r.hasManagerRow = html1.includes(">מנהל<");
  r.hasPilotRow   = html1.includes(">מטיס<");
  r.pmsRestHidden = !html1.includes("PMS נחים");
  r.managerName   = html1.includes("מנהל א");
  r.pilotName     = html1.includes("מטיס א");

  // עם PMS נחים — השורה מופיעה
  const r2 = migrateRosterToV2(null);
  r2.days["ראשון"].pmsRest = ["נח א"];
  const html2 = rosterBoardHtml(r2, "", "wide");
  r.pmsRestShown = html2.includes("PMS נחים") && html2.includes("נח א");

  // סדר השורות: מנהל לפני ר״צ, מטיס בין מתגבר לנהג, נחים PF לפני PMS
  const idx = s => html1.indexOf(s);
  r.orderManagerFirst = idx(">מנהל<") < idx(">ר״צ<");
  r.orderPilot = idx(">מתגבר<") < idx(">מטיס<") && idx(">מטיס<") < idx(">נהג<");

  // migrate/emptyRosterDay כוללים את השדות החדשים
  const empty = emptyRosterDay(false);
  r.modelHasFields = ("manager" in empty) && ("pilot" in empty);

  // rosterDayAssigned כולל מנהל+מטיס (לצורך התראות/החלפות)
  const assigned = rosterDayAssigned(base.days["ראשון"]);
  r.assignedHasNew = assigned.includes("מנהל א") && assigned.includes("מטיס א");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("שורת 'מנהל' בלוח", out.hasManagerRow, String(out.hasManagerRow));
record("שורת 'מטיס' בלוח", out.hasPilotRow, String(out.hasPilotRow));
record("שם המנהל מוצג", out.managerName, String(out.managerName));
record("שם המטיס מוצג", out.pilotName, String(out.pilotName));
record("PMS נחים מוסתר כשאין שיבוץ", out.pmsRestHidden, String(out.pmsRestHidden));
record("PMS נחים מופיע כשיש שיבוץ", out.pmsRestShown, String(out.pmsRestShown));
record("סדר: מנהל לפני ר״צ", out.orderManagerFirst, String(out.orderManagerFirst));
record("סדר: מטיס בין מתגבר לנהג", out.orderPilot, String(out.orderPilot));
record("מודל הלוח כולל manager/pilot", out.modelHasFields, String(out.modelHasFields));
record("rosterDayAssigned כולל מנהל+מטיס", out.assignedHasNew, String(out.assignedHasNew));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
