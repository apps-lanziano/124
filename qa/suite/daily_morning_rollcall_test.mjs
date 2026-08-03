/* מ״ע אחזקה בקשה 1: מסדר בוקר יומי — מ״ע אחזקה מסמן נוכחות/חיסור לכל
   חיילי הטייסת (לא מפקדים, לא מילואים), שולח דיווח למפקדי הסככות (רק
   להם, לא לכל הצוות), מפקד רואה מסך משלו, והמסך מתאפס אוטומטית ב-7:00
   (לא בחצות). כולל גם בדיקת רגרסיה ל-vehicleStatus שנמצאה תקולה תוך כדי
   (לא ידע להשתיק "בטיפול"). מסך "מסדר בוקר" הוא מסך עצמאי (scr-morning-
   rollcall + nav-morningcheck) ולא עוד לשונית בתוך מסך הרכבים. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

async function page(){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  return {p, errs};
}

// 1. rollcallDayKey: לפני 7:00 עדיין "אתמול", מ-7:00 ואילך "היום"
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    const before7 = new Date(2026,0,15, 6,59,0).getTime();   // 15/1 06:59
    const at7 = new Date(2026,0,15, 7,0,0).getTime();         // 15/1 07:00
    const noon = new Date(2026,0,15, 12,0,0).getTime();
    return {
      before7: rollcallDayKey(before7),   // אמור להיות עדיין 14/1 (היום הקודם)
      at7: rollcallDayKey(at7),           // אמור להיות כבר 15/1
      noon: rollcallDayKey(noon),
    };
  });
  record("לפני 7:00 (06:59) — עדיין 'יום המסדר' הקודם", out.before7==="2026-01-14", JSON.stringify(out));
  record("בדיוק 7:00 ואילך — כבר יום המסדר החדש", out.at7==="2026-01-15" && out.noon==="2026-01-15", JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 1ב. הרשימה כוללת רק חיילים — לא מפקדים ולא אנשי מילואים
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => k==="cfg_personnel" ? (store[shed+"_pers"]||[]) : null;
    store["shed1_pers"] = [
      {name:"דני", role:"חייל"},
      {name:"רון", role:"מפקד"},
      {name:"עמית", role:"חייל", reserve:true},
    ];

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-morning-rollcall').classList.add('active');
    await renderMorningRollcall();
    return document.getElementById("mc-list").innerHTML;
  });
  record("מסדר בוקר: מציג חייל רגיל", out.includes("דני"), out.slice(0,300));
  record("מסדר בוקר: לא מציג מפקד", !out.includes("רון"), out.slice(0,300));
  record("מסדר בוקר: לא מציג איש מילואים", !out.includes("עמית"), out.slice(0,300));
  console.log("errs1b",errs); await p.close();
}

// 2. סימון נוכחות/חיסור: לחיצה קובעת סטטוס, לחיצה חוזרת מבטלת
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => k==="cfg_personnel" ? (store[shed+"_pers"]||[]) : null;
    store["shed1_pers"] = [{name:"דני", role:"חייל"}];

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-morning-rollcall').classList.add('active');
    await renderMorningRollcall();

    await setMorningRollcallMark("shed1","דני","present");
    const afterPresent = {...mcCache.marks};
    await setMorningRollcallMark("shed1","דני","present");   // לחיצה חוזרת -> ביטול
    const afterToggleOff = {...mcCache.marks};
    await setMorningRollcallMark("shed1","דני","absent");
    const afterAbsent = {...mcCache.marks};
    return { afterPresent, afterToggleOff, afterAbsent };
  });
  record("סימון 'נוכח' שומר את הסטטוס", out.afterPresent["shed1::דני"]==="present", JSON.stringify(out.afterPresent));
  record("לחיצה חוזרת על אותו סטטוס מבטלת את הסימון", !("shed1::דני" in out.afterToggleOff), JSON.stringify(out.afterToggleOff));
  record("סימון 'נעדר' אחרי ביטול עובד כרגיל", out.afterAbsent["shed1::דני"]==="absent", JSON.stringify(out.afterAbsent));
  console.log("errs2",errs); await p.close();
}

// 3. KPI וסינון-חיפוש בתצוגת מ״ע אחזקה
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => k==="cfg_personnel" ? (store[shed+"_pers"]||[]) : null;
    store["shed1_pers"] = [{name:"דני", role:"חייל"}, {name:"רון", role:"חייל"}];
    store["shed2_pers"] = [{name:"עידן", role:"חייל"}];
    store["daily_rollcall_"+rollcallDayKey()] = {"shed1::דני":"present", "shed2::עידן":"absent"};

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-morning-rollcall').classList.add('active');
    await renderMorningRollcall();
    const kpisAll = document.getElementById("mc-kpis").innerHTML;

    document.getElementById("mc-search").value = "רון";
    renderMorningRollcallList();
    const listFiltered = document.getElementById("mc-list").innerHTML;

    return { kpisAll, listHasRon: listFiltered.includes("רון"), listHasDani: listFiltered.includes("דני") };
  });
  record("KPI: 1 נוכח, 1 נעדר, 1 טרם סומן (3 סה\"כ)",
    out.kpisAll.includes(">1<") , out.kpisAll);
  record("חיפוש-שם מסנן את הרשימה בלי לגעת ברשת (מ-mcCache)",
    out.listHasRon && !out.listHasDani, JSON.stringify({listHasRon:out.listHasRon, listHasDani:out.listHasDani}));
  console.log("errs3",errs); await p.close();
}

// 4. שליחת דיווח: כותבת לכל סככה בנפרד עם ספירות/רשימת נעדרים נכונה
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => {
      if(k==="cfg_personnel") return store[shed+"_pers"]||[];
      return null;
    };
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    window.logAdminAction = async()=>{};
    window.toast = (m)=>{ window._t=window._t||[]; window._t.push(m); };
    store["shed1_pers"] = [{name:"דני", role:"חייל"}, {name:"רון", role:"חייל"}];
    store["shed2_pers"] = [{name:"עידן", role:"חייל"}];

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-morning-rollcall').classList.add('active');
    await renderMorningRollcall();
    await setMorningRollcallMark("shed1","דני","present");
    await setMorningRollcallMark("shed1","רון","absent");
    await setMorningRollcallMark("shed2","עידן","present");

    window._t = [];
    await sendMorningRollcallReport();

    return {
      shed1Report: store["shed1_daily_rollcall_report"],
      shed2Report: store["shed2_daily_rollcall_report"],
      toasts: window._t,
    };
  });
  record("דיווח סככה 1: 1 נוכח, 1 נעדר (רון), הרשימה כוללת את רון",
    out.shed1Report && out.shed1Report.presentCount===1 && out.shed1Report.absentCount===1 &&
    out.shed1Report.absentNames.includes("רון"), JSON.stringify(out.shed1Report));
  record("דיווח סככה 2: 1 נוכח, 0 נעדרים",
    out.shed2Report && out.shed2Report.presentCount===1 && out.shed2Report.absentCount===0, JSON.stringify(out.shed2Report));
  record("טוסט הצלחה מוצג", out.toasts.some(t=>t.includes("נשלח")), JSON.stringify(out.toasts));
  console.log("errs4",errs); await p.close();
}

// 5. שליחה כושלת בחלק מהמסגרות -> טוסט שגיאה, לא "נשלח בהצלחה" שקרי
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => k==="cfg_personnel" ? (store[shed+"_pers"]||[]) : null;
    window.sSetIn = async (shed)=> shed!=="shed3";   // סככה 3 נכשלת
    window.toast = (m)=>{ window._t=window._t||[]; window._t.push(m); };
    SHEDS.forEach(s=>{ store[s.id+"_pers"] = [{name:"איש-"+s.id, role:"חייל"}]; });

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-morning-rollcall').classList.add('active');
    await renderMorningRollcall();
    window._t = [];
    await sendMorningRollcallReport();
    return { toasts: window._t };
  });
  record("כשל חלקי בשליחה: טוסט שגיאה, לא הודעת הצלחה שקרית",
    out.toasts.some(t=>t.includes("נכשלה")) && !out.toasts.some(t=>t.includes("נשלח")), JSON.stringify(out.toasts));
  console.log("errs5",errs); await p.close();
}

// 6. מסך המפקד: מציג דיווח מ"היום" (יום המסדר הנוכחי), מסתיר דיווח ישן
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sGet = async (k) => store[(currentShed?currentShed.id:"")+"_"+k] ?? null;
    currentShed = {id:"shed1", name:"סככה 1"};
    store["shed1_daily_rollcall_report"] = {dayKey: rollcallDayKey(), sentAt: Date.now(), presentCount:5, absentCount:2, totalCount:7, absentNames:["רון","עידן"]};
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-cmd').classList.add('active');
    await renderMorningRollcallReport();
    const shownToday = { hidden: document.getElementById("mc-report-wrap").classList.contains("hidden"), html: document.getElementById("mc-report-content").innerHTML };

    store["shed1_daily_rollcall_report"] = {dayKey:"2000-01-01", sentAt: Date.now(), presentCount:1, absentCount:0, totalCount:1, absentNames:[]};
    await renderMorningRollcallReport();
    const hiddenForOld = document.getElementById("mc-report-wrap").classList.contains("hidden");

    return { shownToday, hiddenForOld };
  });
  record("מסך המפקד: דיווח מהיום מוצג, כולל שמות הנעדרים",
    !out.shownToday.hidden && out.shownToday.html.includes("רון") && out.shownToday.html.includes("עידן"), JSON.stringify(out.shownToday));
  record("מסך המפקד: דיווח מיום קודם (dayKey ישן) מוסתר אוטומטית",
    out.hiddenForOld===true, JSON.stringify(out.hiddenForOld));
  console.log("errs6",errs); await p.close();
}

// 7. vehicleStatus (בשונה מ-vehicleStatusDetailed) — תוקן כדי לא להתעלם מ"בטיפול" בדשבורד מ״ע אחזקה
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    const v = { name:"רכב", testDate:"2000-01-01", inService:true };
    return vehicleStatus(v);
  });
  record("vehicleStatus: רכב 'בטיפול' לא מוצג כאדום גם בפונקציית הסטטוס הישנה (דשבורד מ״ע אחזקה)",
    out.cls==="n" && out.tag==="בטיפול", JSON.stringify(out));
  console.log("errs7",errs); await p.close();
}

// 8. מסך "מסדר בוקר" הוא מסך עצמאי — לא לשונית בתוך מסך הרכבים
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>({
    hasOwnScreen: !!document.getElementById("scr-morning-rollcall"),
    hasOwnNavBtn: !!document.getElementById("nav-morningcheck"),
    tabRemovedFromVehicles: !document.getElementById("votab-morningcheck") && !document.getElementById("vopane-morningcheck"),
  }));
  record("קיים מסך עצמאי scr-morning-rollcall וכפתור ניווט משלו", out.hasOwnScreen && out.hasOwnNavBtn, JSON.stringify(out));
  record("הלשונית הוסרה ממסך הרכבים (votab/vopane-morningcheck לא קיימים יותר)", out.tabRemovedFromVehicles, JSON.stringify(out));
  console.log("errs8",errs); await p.close();
}

// 9. דשבורד מ״ע אחזקה: התראות דומות (למשל כמה רישיונות מאותו סוג) מרוכזות
//    לבאנר יחיד ולא שורה נפרדת לכל פריט, וכולל גם נתוני חומרים/כלים
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (shed,k) => k==="vehicles_list" ? [] : null;
    window.sGetRaw = async k => {
      if(k==="maint_materials_list") return [{id:"m1",name:"שמן",status:"ממתין להזמנה"}];
      if(k==="maint_motor_tools_list") return [];
      if(k && k.startsWith("daily_rollcall_")) return {};
      return null;
    };
    // 5 רישיונות מסוג "פ.ת" שפג תוקפם — אמורים להתמזג לבאנר אחד, לא 5 שורות
    window.getVoLicenses = async () => Array.from({length:5}, (_,i)=>({id:"l"+i, person:"איש-"+i, type:"פ.ת", expiry:"2000-01-01"}));
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-vo-overview').classList.add('active');
    await renderVoOverview();
    return document.getElementById("vo-overview-content").innerHTML;
  });
  const occurrences = (out.match(/רישיונות פ\.ת/g) || []).length;
  record("5 רישיונות מאותו סוג מוצגים כבאנר מרוכז אחד (לא 5 שורות נפרדות)", occurrences===1 && out.includes("5 רישיונות פ.ת"), "occurrences="+occurrences);
  record("הדשבורד כולל גם נתוני הזמנות חומרים (לא רק רכבים/רישיונות)", out.includes("הזמנות חומרים"), out.includes("הזמנות חומרים") ? "found" : "missing");
  console.log("errs9",errs); await p.close();
}

// 10. פעמון ההתראות: מפקד מסגרת מקבל התראה על נעדרים במסדר בוקר של היום —
//     עד עכשיו הדרך היחידה לגלות הייתה להיכנס לדשבורד ולראות את הבאנר
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    currentShed = { id:"shed1", name:"סככה 1" };
    isAdmin = false;
    PERSONNEL = [];
    window.getEvents = async () => [];
    window.getFaults = async () => [];

    // א. דיווח של היום עם נעדרים -> מופיעה התראה
    window.sGet = async (k) => k==="daily_rollcall_report"
      ? {dayKey: rollcallDayKey(), sentAt: Date.now(), presentCount:5, absentCount:2, totalCount:7, absentNames:["רון","עידן"]}
      : null;
    const withAbsentees = await computeAlerts();

    // ב. דיווח של היום בלי נעדרים -> אין התראה
    window.sGet = async (k) => k==="daily_rollcall_report"
      ? {dayKey: rollcallDayKey(), sentAt: Date.now(), presentCount:7, absentCount:0, totalCount:7, absentNames:[]}
      : null;
    const noAbsentees = await computeAlerts();

    // ג. דיווח מיום קודם (dayKey ישן) -> לא רלוונטי, גם אם יש בו נעדרים
    window.sGet = async (k) => k==="daily_rollcall_report"
      ? {dayKey:"2000-01-01", sentAt: Date.now(), presentCount:1, absentCount:5, totalCount:6, absentNames:["א"]}
      : null;
    const staleReport = await computeAlerts();

    return {
      withAbsentees: withAbsentees.map(a=>a.text),
      noAbsentees: noAbsentees.map(a=>a.text),
      staleReport: staleReport.map(a=>a.text),
    };
  });
  record("דיווח היום עם נעדרים -> מופיעה התראה עם מספר הנעדרים",
    out.withAbsentees.some(t=>t.includes("מסדר בוקר") && t.includes("2")), JSON.stringify(out.withAbsentees));
  record("דיווח היום בלי נעדרים -> אין התראת מסדר בוקר",
    !out.noAbsentees.some(t=>t.includes("מסדר בוקר")), JSON.stringify(out.noAbsentees));
  record("דיווח מיום קודם (dayKey ישן) -> לא מייצר התראה למרות נעדרים",
    !out.staleReport.some(t=>t.includes("מסדר בוקר")), JSON.stringify(out.staleReport));
  console.log("errs10",errs); await p.close();
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await b.close();
process.exit(allPass?0:1);
