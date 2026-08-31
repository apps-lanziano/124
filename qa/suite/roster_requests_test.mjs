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

    // החלפה ראש-בראש: אני תורן ביום א', המחליף תורן ביום ב' — בוחרים את
    // שני הימים ומחליפים ביניהם. לוח דטרמיניסטי כדי לא להיות תלוי ב"היום".
    const ds = migrateRosterToV2(null); ds.squadronDuty="shed1";
    ds.days["ראשון"].lead = me;
    ds.days["שני"].lead = "חייל ד סככה 1";
    await saveDutyRosterV2(ds, "current"); rosterCache = null;
    await openNewRequest("swap");
    setSwapDay("ראשון"); setSwapRepl("חייל ד סככה 1","shed1"); setSwapReplDay("שני");
    await submitRequest();
    const my = (await getDutyRequests()).filter(x=>x.by===me && x.type==="swap");
    r.reqSaved = my.length===1 && my[0].replacement==="חייל ד סככה 1"
      && my[0].day==="ראשון" && my[0].replDay==="שני" && my[0].status==="pending";

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
  record("בקשת החלפה ראש-בראש נשמרת (שני הימים)", out.reqSaved, String(out.reqSaved));
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
    // לוח ראש-בראש: א' תורן ביום ראשון, ג' תורן ביום שני
    const d = migrateRosterToV2(null);
    d.days["ראשון"].lead = "חייל א סככה 1";
    d.days["שני"].lead = "חייל ג סככה 1";
    await saveDutyRosterV2(d, "current");

    // בקשת החלפה ראש-בראש (א' ראשון ⇄ ג' שני) + חופשה
    await saveDutyRequests([
      {id:"rq1", type:"swap", by:"חייל א סככה 1", shed:"shed1", day:"ראשון", replacement:"חייל ג סככה 1", replDay:"שני", replShed:"shed1", status:"pending", ts:Date.now()},
      {id:"rq2", type:"vacation", by:"חייל ד סככה 1", shed:"shed1", fromDate:"2026-08-20", toDate:"2026-08-20", reason:"חתונה", status:"pending", ts:Date.now()+1},
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
    // משנה את הלוח. שלב 2: מ״ע תורנויות מאשר ומחיל ראש-בראש.
    await approveRequest("rq1");
    const afterCmdr = (await getDutyRequests()).find(x=>x.id==="rq1");
    const b1 = await getDutyRoster("current");
    r.cmdrStage = afterCmdr.status==="naat" && b1.days["ראשון"].lead==="חייל א סככה 1";   // טרם הוחל
    isRosterManager = true;
    await openNaatSwaps();
    await naatApproveSwap(0);
    const nd = await getDutyRoster("current");
    r.swapApplied = nd.days["ראשון"].lead==="חייל ג סככה 1" && nd.days["שני"].lead==="חייל א סככה 1";
    r.reqApproved = (await getDutyRequests()).find(x=>x.id==="rq1").status==="approved";

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

    // החלפה בין-מסגרתית — דורשת אישור שני המפקדים לפני מ״ע
    await saveDutyRequests((await getDutyRequests()).concat([
      {id:"rqx", type:"swap", by:"חייל א סככה 1", shed:"shed1", day:"ראשון",
       replacement:"מחליף סככה 2", replDay:"שני", replShed:"shed2", status:"pending", ts:Date.now()+5}
    ]));
    await approveRequest("rqx");   // מפקד סככה 1 → ממתין למסגרת השנייה
    r.xPendingB = (await getDutyRequests()).find(x=>x.id==="rqx").status==="pending_b";
    // מפקד סככה 2 רואה את הבקשה ומאשר
    const saveShed = currentShed;
    currentShed = SHEDS.find(s=>s.id==="shed2") || saveShed;
    const forB = await fetchSwapsForShedB();
    r.xVisibleToB = forB.some(x=>x.id==="rqx");
    await approveSwapShedB("rqx","shed1");
    currentShed = saveShed;
    r.xNaat = (await getDutyRequests()).find(x=>x.id==="rqx").status==="naat";
    return r;
  });

  record("התחברות מפקד", login.ok, JSON.stringify(login));
  record("התראת פעמון: בקשות ממתינות", out.alertShown, String(out.alertShown));
  record("תיבת הבקשות נפתחת עם הבקשות הממתינות", out.inboxOpen && out.inboxHasReqs, JSON.stringify(out));
  record("אישור מפקד מעביר החלפה ל\"ממתין למ״ע\" (לא משנה לוח)", out.cmdrStage, String(out.cmdrStage));
  record("אישור מ״ע מחיל ראש-בראש על הלוח (שני הימים מתחלפים)", out.swapApplied, String(out.swapApplied));
  record("הבקשה מסומנת כמאושרת אחרי מ״ע", out.reqApproved, String(out.reqApproved));
  record("דחייה דורשת הערה", out.rejectNeedsNote, String(out.rejectNeedsNote));
  record("דחייה עם הערה נשמרת", out.rejected, String(out.rejected));
  record("החלפה בין-מסגרתית: אישור מפקד א׳ → ממתין למסגרת השנייה", out.xPendingB, String(out.xPendingB));
  record("החלפה בין-מסגרתית: נראית למפקד המסגרת השנייה", out.xVisibleToB, String(out.xVisibleToB));
  record("החלפה בין-מסגרתית: אישור מפקד ב׳ → ממתין למ״ע", out.xNaat, String(out.xNaat));

  await closeBrowser();
}

// ---------- ⛔ אילוץ מאושר ועתידי לא נדחק מ"בקשות לאישור" אחרי 10 החלטות חדשות ----------
{
  const { page } = await newPage();
  const login = await loginAsFramework(page, "shed1", "מפקד");

  const out = await page.evaluate(async ()=>{
    const r = {};
    // אילוץ ותיק שכבר אושר, לתאריך עתידי — כמו חופשת מילואים שנשלחה
    // מראש. אחריו 10 בקשות חדשות יותר (גם מאושרות) — ה-ts שלהן גבוה יותר.
    const old = {id:"rq-old", type:"vacation", by:"חייל מילואים", shed:"shed1",
      fromDate:"2099-01-03", toDate:"2099-01-05", reason:"מילואים", status:"approved", ts:1};
    const filler = Array.from({length:10}, (_,i)=>({
      id:"rq-f"+i, type:"leave", by:"חייל א סככה 1", shed:"shed1",
      fromDate:"2020-01-0"+((i%9)+1), toDate:"2020-01-0"+((i%9)+1), reason:"ישן",
      status: i%2 ? "approved" : "rejected", ts: 100+i}));
    await saveDutyRequests([old, ...filler]);

    await openRequestsInbox();
    r.oldConstraintVisible = document.getElementById("requests-inbox-list").innerHTML.includes("חייל מילואים");
    r.canDelete = /deleteRequest\('rq-old'\)/.test(document.getElementById("requests-inbox-list").innerHTML);
    return r;
  });

  record("התחברות מפקד", login.ok, JSON.stringify(login));
  record("⛔ אילוץ מאושר עתידי מוצג ב\"בקשות לאישור\" גם מעבר ל-10 האחרונות", out.oldConstraintVisible, String(out.oldConstraintVisible));
  record("אפשר למחוק אותו מהתיבה", out.canDelete, String(out.canDelete));

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
