/* לוח הצוות המובנה (v2) — מחליף את שתי הרשימות השטוחות (duty/rest)
   במבנה שמשקף את גיליון ה-Excel האמיתי: ר״צ, ל/ ר״צ, מתגבר, נהג,
   פקיד כלים, PF (עם "בקורס"/"מילואים"), נחים, PMS, תורנות בסיסית,
   ותורן טייסת שבועי. חמישי–שבת הם משמרת רצופה אחת בלי נחים.

   הבדיקה מכסה: מיגרציה מהמבנה הישן, גזירת duty/rest לתאימות עם
   ההתראה היומית בשרת, שכפול משמרת סוף השבוע, וחסימת פרסום כשחסרה
   משבצת חובה. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // 1) מיגרציה: מבנה ישן (duty/rest שטוחים) -> v2
  const legacy = { weekKey:"1.1.2026", days:{ "ראשון":{duty:["דני","רון"], rest:["משה"]} } };
  const mig = migrateRosterToV2(legacy);
  r.migVersion   = mig.v;
  r.migPf        = mig.days["ראשון"].pf.map(p=>p.name);
  r.migRest      = mig.days["ראשון"].pfRest;
  r.migWkndNull  = mig.days["שישי"].pfRest;      // סופ"ש -> null, לא []
  r.migRestWin   = mig.restWindow;

  // 2) שמירה: גזירת duty/rest + שכפול משמרת סוף השבוע
  const draft = migrateRosterToV2(null);
  draft.squadronDuty = "shed2";
  const mon = draft.days["שני"];
  mon.lead = "חייל א סככה 1";
  mon.tools = "חייל ב סככה 1";
  mon.fixedAug = ["חייל ג סככה 1"];
  mon.pf = [{name:"חייל א סככה 1"}, {name:"חייל ד סככה 1", course:true}];
  mon.pfRest = ["חייל ה סככה 1"];
  mon.basic = [{name:"חייל ג סככה 1", type:"רס״ר"}];
  const thu = draft.days["חמישי"];
  thu.lead = "חייל ב סככה 1"; thu.tools = "חייל ג סככה 1";
  thu.pf = [{name:"חייל א סככה 1"}];

  await saveDutyRosterV2(draft);
  const saved = await getDutyRoster();
  const sMon = saved.days["שני"];
  r.dutyDerived   = sMon.duty;                   // איחוד כל המשובצים, בלי כפילות
  r.restDerived   = sMon.rest;
  r.leadKept      = sMon.lead;
  r.courseKept    = !!(sMon.pf.find(p=>p.name==="חייל ד סככה 1")||{}).course;
  r.squadronKept  = saved.squadronDuty;
  // סופ"ש: אותו תוכן בשלושת הימים, ובכולם אין נחים
  r.satLead       = saved.days["שבת"].lead;
  r.friPf         = saved.days["שישי"].pf.map(p=>p.name);
  r.wkndRestNull  = [saved.days["חמישי"].pfRest, saved.days["שישי"].pfRest, saved.days["שבת"].pfRest];

  // 3) שם שמשובץ בשתי משבצות נספר פעם אחת (פקיד כלים שהוא גם ב-PF — תקין)
  const dual = migrateRosterToV2(null).days["ראשון"];
  dual.lead = "א"; dual.tools = "ב"; dual.pf = [{name:"ב"},{name:"ג"}];
  r.dualAssigned = rosterDayAssigned(dual);

  // 4) פרסום חסום כשחסרה משבצת חובה (פקיד כלים)
  rosterDraft = migrateRosterToV2(null);
  rosterDraft.days["שלישי"].lead = "חייל ה סככה 1";        // ערך ייחודי שטרם נשמר
  rosterDraft.days["שלישי"].pf = [{name:"חייל ב סככה 1"}]; // יש שיבוץ אבל אין tools
  rosterEdDay = "שלישי";
  let toasted = ""; window.toast = m => toasted = m;
  await publishRoster();
  r.blockedToast = toasted;
  const afterBlocked = await getDutyRoster();
  r.blockedNotSaved = afterBlocked.days["שלישי"].lead !== "חייל ה סככה 1";

  return r;
});

record("התחברות הצליחה", login.ok, JSON.stringify(login));
record("מיגרציה: מזוהה כ-v2", out.migVersion === 2, String(out.migVersion));
record("מיגרציה: duty הישן הפך לגוף ה-PF", JSON.stringify(out.migPf) === JSON.stringify(["דני","רון"]), JSON.stringify(out.migPf));
record("מיגרציה: rest הישן נשמר כנחים", JSON.stringify(out.migRest) === JSON.stringify(["משה"]), JSON.stringify(out.migRest));
record("מיגרציה: סופ\"ש מקבל null (אין נחים) ולא רשימה ריקה", out.migWkndNull === null, JSON.stringify(out.migWkndNull));
record("מיגרציה: חלון נחים ברירת מחדל", out.migRestWin === "14:00-16:00", out.migRestWin);
/* א' משובץ גם כר״צ וגם ב-PF, ג' גם כמתגבר וגם בתורנות — לכן 4 שמות
   ייחודיים ולא 6. זה בדיוק מה שההתראה היומית צריכה: רשימת אנשים, לא
   רשימת שיבוצים. */
record("שמירה: duty נגזר כאיחוד כל המשובצים, בלי כפילויות",
  out.dutyDerived.length === 4 && out.dutyDerived.includes("חייל ד סככה 1") && new Set(out.dutyDerived).size === out.dutyDerived.length,
  JSON.stringify(out.dutyDerived));
record("שמירה: rest נגזר מהנחים", JSON.stringify(out.restDerived) === JSON.stringify(["חייל ה סככה 1"]), JSON.stringify(out.restDerived));
record("שמירה: משבצות התפקיד נשמרות", out.leadKept === "חייל א סככה 1", out.leadKept);
record("שמירה: סימון \"בקורס\" נשמר", out.courseKept, String(out.courseKept));
record("שמירה: תורן טייסת שבועי נשמר", out.squadronKept === "shed2", out.squadronKept);
record("סופ\"ש: אותו צוות בחמישי, שישי ושבת",
  out.satLead === "חייל ב סככה 1" && JSON.stringify(out.friPf) === JSON.stringify(["חייל א סככה 1"]),
  `${out.satLead} · ${JSON.stringify(out.friPf)}`);
record("סופ\"ש: אין נחים בשלושת הימים", out.wkndRestNull.every(x=>x===null), JSON.stringify(out.wkndRestNull));
record("שיבוץ כפול נספר פעם אחת (פקיד כלים שגם ב-PF)",
  JSON.stringify(out.dualAssigned) === JSON.stringify(["א","ב","ג"]), JSON.stringify(out.dualAssigned));
record("פרסום נחסם כשחסר פקיד כלים", /חסר/.test(out.blockedToast||""), out.blockedToast);
record("פרסום חסום באמת לא נשמר", out.blockedNotSaved, String(out.blockedNotSaved));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
