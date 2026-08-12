/* (1) אילוץ שמפקד מזין אחרי חלון ההזנה (ג' 10:00) לשבוע הבא דורש אישור
   מ"ע (status=naat_c), עם תור אישור. (2) מעבר שבוע אוטומטי: הלוח העתידי
   הופך לנוכחי כשעברנו לשבוע חדש, בלי לדרוס כשאין לוח עתידי. */
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

  // ---- (1) אילוץ מפקד מאוחר → naat_c ----
  // ניתוב עקבי מול חלון ההזנה (ג' 10:00) לתאריך בשבוע הבא
  const nwFrom = nextWeekRangeIso().from;
  const locked = nextWeekEntryLocked();
  openCommanderConstraint();
  const who = reqOnBehalf;
  setReqType("vacation");
  document.getElementById("req-fromdate").value = nwFrom;
  document.getElementById("req-todate").value = "";
  await submitRequest();
  const req = (await getDutyRequests()).find(x=>x.by===who && x.fromDate===nwFrom);
  r.routing = !!req && (locked ? req.status==="naat_c" : req.status==="approved");
  r.byCommander = !!req && req.byCommander===true;

  // אילוץ בשבוע הנוכחי — תמיד מאושר מיד (לא חסום)
  openCommanderConstraint();
  const who2 = reqOnBehalf;
  setReqType("vacation");
  const monIso = rosterDayLockDates("שני","current")[0];
  document.getElementById("req-fromdate").value = monIso;
  document.getElementById("req-todate").value = "";
  await submitRequest();
  const req2 = (await getDutyRequests()).find(x=>x.by===who2 && x.fromDate===monIso);
  r.currentWeekApproved = !!req2 && req2.status==="approved";

  // תור אישור מ"ע לאילוצים מאוחרים
  await saveDutyRequests([
    {id:"c9", type:"vacation", by:"חייל א סככה 1", shed:"shed1", fromDate:nwFrom, toDate:nwFrom, status:"naat_c", byCommander:true, cmdrBy:"מפקד", ts:9},
  ]);
  const pend = await fetchConstraintsPendingNaat();
  r.queued = pend.some(x=>x.id==="c9");
  r.total = (await naatPendingTotal()) >= 1;
  await renderNaatSwaps();
  const idx = naatConstraintRows.findIndex(x=>x.id==="c9");
  await naatApproveConstraint(idx);
  r.approvedByNaat = (await getDutyRequests()).find(x=>x.id==="c9").status==="approved";

  // ---- (2) מעבר שבוע אוטומטי ----
  _rotateTried = false;
  await sSetRaw("board_rotated_week", "2000-01-02");            // סימון ישן → עברנו שבוע
  const cur = migrateRosterToV2(null); cur.days["ראשון"].lead = "ישן";
  const nxt = migrateRosterToV2(null); nxt.days["ראשון"].lead = "חדש";
  await saveDutyRosterV2(cur, "current"); await saveDutyRosterV2(nxt, "next");
  await maybeRotateWeek();
  r.rotated = (await getDutyRoster("current")).days["ראשון"].lead === "חדש";
  r.oldToPrev = (await getDutyRoster("prev")).days["ראשון"].lead === "ישן";
  r.nextCleared = (await getDutyRoster("next")).days["ראשון"].lead === "";
  r.marked = (await sGetRaw("board_rotated_week")) === isoOfDate(thisWeekSunday());

  // אין לוח עתידי → לא דורסים את הנוכחי לריק
  _rotateTried = false;
  await sSetRaw("board_rotated_week", "2000-01-02");
  await saveDutyRosterV2(migrateRosterToV2(null), "next");      // ריק
  const keep = migrateRosterToV2(null); keep.days["שני"].lead = "נשאר";
  await saveDutyRosterV2(keep, "current");
  await maybeRotateWeek();
  r.emptyNextKeepsCurrent = (await getDutyRoster("current")).days["שני"].lead === "נשאר";

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("אילוץ מפקד מאוחר מנותב לפי חלון ההזנה (naat_c/approved)", out.routing, String(out.routing));
record("אילוץ מפקד מסומן byCommander", out.byCommander, String(out.byCommander));
record("אילוץ לשבוע הנוכחי מאושר מיד", out.currentWeekApproved, String(out.currentWeekApproved));
record("אילוץ מאוחר נכנס לתור אישור מ״ע", out.queued, String(out.queued));
record("מונה אישורי מ״ע כולל אילוצים", out.total, String(out.total));
record("מ״ע מאשר אילוץ מאוחר → approved", out.approvedByNaat, String(out.approvedByNaat));
record("מעבר שבוע: העתידי הפך לנוכחי", out.rotated, String(out.rotated));
record("מעבר שבוע: הנוכחי הקודם עבר ל'שבוע שעבר'", out.oldToPrev, String(out.oldToPrev));
record("מעבר שבוע: העתידי התפנה", out.nextCleared, String(out.nextCleared));
record("מעבר שבוע: סומן שהשבוע טופל", out.marked, String(out.marked));
record("אין לוח עתידי → הנוכחי לא נדרס לריק", out.emptyNextKeepsCurrent, String(out.emptyNextKeepsCurrent));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
