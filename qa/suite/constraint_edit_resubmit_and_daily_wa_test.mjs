/* (1) מפקד עורך אילוץ שנדחה ע"י מ"ע — נשלח מחדש לאישור מ"ע (naat_c) אם עדיין
   מאוחר, או מאושר אם עבר לתאריך בשבוע הנוכחי; decidedBy הישן מנוקה.
   (2) "שלח לוח יומי בוואטסאפ" — בונה עמודה מסודרת של תפקידי היום. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  window.confirm = ()=>true;
  window.toast = ()=>{};

  // ---- (1) עריכת אילוץ שנדחה → אישור חוזר ----
  const nwFrom = nextWeekRangeIso().from;
  const locked = nextWeekEntryLocked();
  // אילוץ מפקד לשבוע הבא שמ"ע דחה
  await saveDutyRequests([
    {id:"e1", type:"vacation", by:"חייל א סככה 1", shed:"shed1", fromDate:nwFrom, toDate:nwFrom,
     status:"rejected", byCommander:true, cmdrBy:"מפקד", decidedBy:"מ״ע ישן", decidedTs:1, ts:1},
  ]);
  await openEditRequest("e1", true);
  setReqType("vacation");
  document.getElementById("req-fromdate").value = nwFrom;
  document.getElementById("req-todate").value = "";
  await submitRequest();
  const e1 = (await getDutyRequests()).find(x=>x.id==="e1");
  // אם עדיין מאוחר (חלון ננעל) → naat_c וממתין למ"ע; אחרת approved
  r.resubmitStatus = locked ? e1.status==="naat_c" : e1.status==="approved";
  r.oldDecideCleared = locked ? (e1.decidedBy===undefined) : (e1.decidedBy==="מפקד");
  r.stillCommander = e1.byCommander===true;

  // נכנס לתור אישור מ"ע כשמאוחר
  if(locked){
    const pend = await fetchConstraintsPendingNaat();
    r.queuedAgain = pend.some(x=>x.id==="e1");
  } else { r.queuedAgain = true; } // לא רלוונטי כשלא נעול

  // ---- (2) לוח יומי בוואטסאפ ----
  let waMsg = "";
  window.waShare = (t)=>{ waMsg = t; };
  const cur = migrateRosterToV2(null);
  cur.days["ראשון"].lead = "דני מפקד";
  cur.days["ראשון"].driver = "נהג יומי";
  cur.days["ראשון"].pf = [{name:"טייס א", course:false, reserve:false}];
  await saveDutyRosterV2(cur, "current");
  await shareDailyDutyWA("ראשון");
  r.waHasTitle = /לוח צוות תורן/.test(waMsg);
  r.waHasLead  = /ר״צ: דני מפקד/.test(waMsg);
  r.waHasDriver = /נהג: נהג יומי/.test(waMsg);
  r.waHasPf = /PF: טייס א/.test(waMsg);
  r.waColumn = waMsg.split("\n").length >= 4; // כותרת + מפריד + לפחות 2 שורות

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("עריכת אילוץ שנדחה → אישור חוזר (naat_c/approved)", out.resubmitStatus, String(out.resubmitStatus));
record("אישור מ״ע הישן נוקה בעריכה", out.oldDecideCleared, String(out.oldDecideCleared));
record("האילוץ הערוך נשאר byCommander", out.stillCommander, String(out.stillCommander));
record("אילוץ ערוך מאוחר חוזר לתור אישור מ״ע", out.queuedAgain, String(out.queuedAgain));
record("לוח יומי WA: כותרת", out.waHasTitle, String(out.waHasTitle));
record("לוח יומי WA: ר״צ בעמודה", out.waHasLead, String(out.waHasLead));
record("לוח יומי WA: נהג בעמודה", out.waHasDriver, String(out.waHasDriver));
record("לוח יומי WA: PF בעמודה", out.waHasPf, String(out.waHasPf));
record("לוח יומי WA: פורמט עמודה (שורות מרובות)", out.waColumn, String(out.waColumn));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
