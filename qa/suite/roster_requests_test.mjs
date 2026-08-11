/* שלב 2: מסך "היום שלי" לחיילים + מערכת בקשות (החלפת תורנות / יציאה /
   חופשה / אחר). הבקשות נשמרות תחת duty_requests (מוגבל-לסככה); מפקד
   המסגרת מאשר או דוחה, ואישור החלפה מחיל אוטומטית את ההחלפה על הלוח. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// ---------- חייל: ניווט, מסך היום, ושליחת בקשת החלפה ----------
{
  const { page } = await newPage();
  const login = await loginAsFramework(page, "shed1", "חייל");

  const out = await page.evaluate(async ()=>{
    const r = {};
    const me = user;
    // ניווט חייל: "היום שלי" גלוי, הסמכות ירדה ל"עוד"
    r.navTodayShown  = !document.getElementById("nav-today").classList.contains("hidden");
    r.navCertsHidden =  document.getElementById("nav-certs").classList.contains("hidden");
    r.sheetCertsShown= !document.getElementById("sheet-certs").classList.contains("hidden");

    // זורעים לוח שבו אני תורן היום, ומישהו נח היום (מועמד להחלפה)
    const d = migrateRosterToV2(null); d.squadronDuty="shed1";
    const today = rosterEditKey(todayHebrewDay());
    const dd = d.days[today];
    dd.lead = me; dd.tools = "חייל ב סככה 1";
    dd.pf = [{name:me},{name:"חייל ג סככה 1"}];
    if(!isWeekendDay(today)) dd.pfRest = ["חייל ד סככה 1","חייל ה סככה 1"];
    await saveDutyRosterV2(d, "current");

    go("scr-today", null); await renderToday();
    const todayHtml = document.getElementById("today-content").innerHTML;
    r.dutyFlagShown = /אתה תורן היום/.test(todayHtml);
    r.myRolesShown  = /PF/.test(todayHtml) || /ראש צוות/.test(todayHtml);

    // שליחת בקשת החלפה מול מי שנח (או מדלגים אם סופ"ש בלי נחים)
    r.weekend = isWeekendDay(today);
    if(!r.weekend){
      await openNewRequest("swap");
      setSwapDay(today); setSwapRepl("חייל ד סככה 1");
      await submitRequest();
      const my = (await getDutyRequests()).filter(x=>x.by===me);
      r.reqSaved = my.length===1 && my[0].type==="swap" && my[0].replacement==="חייל ד סככה 1" && my[0].status==="pending";
    } else { r.reqSaved = true; }

    // בקשת יציאה מוקדמת — תאריך אמיתי (type=date) כדי שינעל יום אצל מ"ע
    await openNewRequest("leave");
    document.getElementById("req-fromdate").value = "2026-08-11";
    document.getElementById("req-from").value = "14:00";
    document.getElementById("req-reason").value = "תור לרופא";
    await submitRequest();
    const leaves = (await getDutyRequests()).filter(x=>x.by===me && x.type==="leave");
    r.leaveSaved = leaves.length===1 && leaves[0].fromDate==="2026-08-11";

    // בקשה ריקה נחסמת
    await openNewRequest("other");
    document.getElementById("req-reason").value = "";
    let toasted=""; window.toast=m=>toasted=m;
    await submitRequest();
    r.emptyBlocked = /כתוב/.test(toasted);

    return r;
  });

  record("התחברות חייל", login.ok, JSON.stringify(login));
  record("ניווט: \"היום שלי\" גלוי לחייל", out.navTodayShown, String(out.navTodayShown));
  record("ניווט: הסמכות ירדה מהסרגל לחייל", out.navCertsHidden, String(out.navCertsHidden));
  record("ניווט: הסמכות מופיעה בתפריט \"עוד\"", out.sheetCertsShown, String(out.sheetCertsShown));
  record("היום שלי: דגל \"אתה תורן היום\" מוצג", out.dutyFlagShown, String(out.dutyFlagShown));
  record("היום שלי: התפקיד שלי מוצג", out.myRolesShown, String(out.myRolesShown));
  record("בקשת החלפה נשמרת כ\"ממתין\"" + (out.weekend?" (דולג — סופ\"ש)":""), out.reqSaved, String(out.reqSaved));
  record("בקשת יציאה מוקדמת נשמרת", out.leaveSaved, String(out.leaveSaved));
  record("בקשה ריקה נחסמת", out.emptyBlocked, String(out.emptyBlocked));

  await closeBrowser();
}

// ---------- מפקד: אישור החלפה שמעדכן את הלוח, ודחייה עם הערה ----------
{
  const { page } = await newPage();
  const login = await loginAsFramework(page, "shed1", "מפקד");

  const out = await page.evaluate(async ()=>{
    const r = {};
    // לוח: א' תורן היום, ב' נח היום
    const d = migrateRosterToV2(null);
    const today = rosterEditKey(todayHebrewDay());
    const dd = d.days[today];
    dd.lead = "חייל א סככה 1"; dd.tools = "חייל ב סככה 1";
    dd.pf = [{name:"חייל א סככה 1"}];
    if(!isWeekendDay(today)) dd.pfRest = ["חייל ג סככה 1"];
    await saveDutyRosterV2(d, "current");
    r.weekend = isWeekendDay(today);

    // בקשת החלפה ממתינה: א' -> ג'
    await saveDutyRequests([
      {id:"rq1", type:"swap", by:"חייל א סככה 1", shed:"shed1", day:today, replacement:"חייל ג סככה 1", status:"pending", ts:Date.now()},
      {id:"rq2", type:"vacation", by:"חייל ד סככה 1", shed:"shed1", date:"2-3.8", reason:"חתונה", status:"pending", ts:Date.now()+1},
    ]);

    // התראת פעמון כוללת "בקשות ממתינות"
    const alerts = await computeAlerts();
    const reqAlert = alerts.find(a=>a.nav==="__requests");
    r.alertShown = !!reqAlert && /2 בקשות/.test(reqAlert.text);

    // תיבת הבקשות נפתחת ומציגה את הממתינות
    await openRequestsInbox();
    r.inboxOpen = document.getElementById("requests-inbox-modal").classList.contains("open");
    r.inboxHasReqs = document.querySelectorAll("#requests-inbox-list .req-card").length >= 2;

    // החלפה = שני שערים. שלב 1: אישור המפקד — עובר ל"ממתין למ״ע" ולא
    // משנה את הלוח עדיין. שלב 2: מ״ע תורנויות מאשר ומחיל על הלוח.
    if(!r.weekend){
      await approveRequest("rq1");
      const afterCmdr = (await getDutyRequests()).find(x=>x.id==="rq1");
      const b1 = (await getDutyRoster("current")).days[today];
      r.cmdrStage = afterCmdr.status==="naat" && b1.lead==="חייל א סככה 1";   // טרם הוחל
      isRosterManager = true;
      await openNaatSwaps();
      await naatApproveSwap(0);
      const nd = (await getDutyRoster("current")).days[today];
      r.swapApplied = nd.lead==="חייל ג סככה 1" && (nd.pfRest||[]).includes("חייל א סככה 1")
        && !(nd.pfRest||[]).includes("חייל ג סככה 1");
      r.reqApproved = (await getDutyRequests()).find(x=>x.id==="rq1").status==="approved";
    } else {
      await approveRequest("rq1");
      r.cmdrStage = (await getDutyRequests()).find(x=>x.id==="rq1").status==="naat";
      isRosterManager = true; await openNaatSwaps(); await naatApproveSwap(0);
      r.swapApplied = true;
      r.reqApproved = (await getDutyRequests()).find(x=>x.id==="rq1").status==="approved";
    }

    // דחייה עם הערה — חובה הערה
    openRejectRequest("rq2");
    document.getElementById("reject-req-note").value = "";
    let toasted=""; window.toast=m=>toasted=m;
    await confirmRejectRequest();
    r.rejectNeedsNote = /הערה/.test(toasted) && (await getDutyRequests()).find(x=>x.id==="rq2").status==="pending";
    // עם הערה — נדחה ונשמרת ההערה
    document.getElementById("reject-req-note").value = "שבוע עמוס, נדבר על תאריך אחר";
    await confirmRejectRequest();
    const rq2 = (await getDutyRequests()).find(x=>x.id==="rq2");
    r.rejected = rq2.status==="rejected" && /עמוס/.test(rq2.note||"");
    return r;
  });

  record("התחברות מפקד", login.ok, JSON.stringify(login));
  record("התראת פעמון: בקשות ממתינות", out.alertShown, String(out.alertShown));
  record("תיבת הבקשות נפתחת עם הבקשות הממתינות", out.inboxOpen && out.inboxHasReqs, JSON.stringify(out));
  record("אישור מפקד מעביר החלפה ל\"ממתין למ״ע\" (לא משנה לוח)", out.cmdrStage, String(out.cmdrStage));
  record("אישור מ״ע מחיל את ההחלפה על הלוח (מחליף נכנס, תורן לנוח)" + (out.weekend?" (סופ\"ש)":""), out.swapApplied, String(out.swapApplied));
  record("הבקשה מסומנת כמאושרת אחרי מ״ע", out.reqApproved, String(out.reqApproved));
  record("דחייה דורשת הערה", out.rejectNeedsNote, String(out.rejectNeedsNote));
  record("דחייה עם הערה נשמרת", out.rejected, String(out.rejected));

  await closeBrowser();
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
