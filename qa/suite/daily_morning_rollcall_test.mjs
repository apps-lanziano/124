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

// 2. סימון סטטוס (5 אפשרויות): לחיצה קובעת סטטוס, לחיצה חוזרת מבטלת
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
    await setMorningRollcallMark("shed1","דני","duty");     // סטטוס חדש: תורנות
    const afterDuty = {...mcCache.marks};
    await setMorningRollcallMark("shed1","דני","absent");
    const afterAbsent = {...mcCache.marks};
    return { afterPresent, afterToggleOff, afterDuty, afterAbsent };
  });
  record("סימון 'נוכח' שומר את הסטטוס", out.afterPresent["shed1::דני"]==="present", JSON.stringify(out.afterPresent));
  record("לחיצה חוזרת על אותו סטטוס מבטלת את הסימון", !("shed1::דני" in out.afterToggleOff), JSON.stringify(out.afterToggleOff));
  record("סימון 'תורנות' (אחד מ-5 הסטטוסים החדשים) עובד", out.afterDuty["shed1::דני"]==="duty", JSON.stringify(out.afterDuty));
  record("מעבר ל'נעדר' אחרי תורנות עובד כרגיל", out.afterAbsent["shed1::דני"]==="absent", JSON.stringify(out.afterAbsent));
  console.log("errs2",errs); await p.close();
}

// 3. 5 כפתורי סטטוס מוצגים לכל אדם, KPI ל-6 קטגוריות, וסינון-חיפוש
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
    const kpiBoxCount = document.querySelectorAll("#mc-kpis .kpi").length;
    const daniButtons = [...document.querySelectorAll(".mc-status-row .pill")].map(b=>b.textContent.trim());

    document.getElementById("mc-search").value = "רון";
    renderMorningRollcallList();
    const listFiltered = document.getElementById("mc-list").innerHTML;

    return { kpisAll, kpiBoxCount, daniButtons, listHasRon: listFiltered.includes("רון"), listHasDani: listFiltered.includes("דני") };
  });
  record("KPI: 6 תיבות (5 סטטוסים + טרם סומנו)", out.kpiBoxCount===6, "count="+out.kpiBoxCount);
  record("KPI כולל את כל 5 התוויות + 'טרם סומנו'",
    ["נוכח","תורנות","אפטר","צוות תורן","חסר","טרם סומנו"].every(l=>out.kpisAll.includes(l)), out.kpisAll);
  record("כל אדם מקבל 5 כפתורי סימון (אחד לכל סטטוס)",
    out.daniButtons.length>=5 && out.daniButtons.some(t=>t.includes("נוכח")) && out.daniButtons.some(t=>t.includes("תורנות"))
    && out.daniButtons.some(t=>t.includes("אפטר")) && out.daniButtons.some(t=>t.includes("צוות תורן")) && out.daniButtons.some(t=>t.includes("חסר")),
    JSON.stringify(out.daniButtons));
  record("חיפוש-שם מסנן את הרשימה בלי לגעת ברשת (מ-mcCache)",
    out.listHasRon && !out.listHasDani, JSON.stringify({listHasRon:out.listHasRon, listHasDani:out.listHasDani}));
  console.log("errs3",errs); await p.close();
}

// 4. שליחת דיווח: כותבת לכל סככה בנפרד עם ספירות/שמות נכונים לכל אחד מ-5
//    הסטטוסים, וגם דלי "unmarked" נפרד למי שכלל לא סומן (התיקון לבאג
//    שהיה מסיק "נוכח" בטעות על מי שפשוט טרם סומן)
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
    store["shed1_pers"] = [{name:"דני", role:"חייל"}, {name:"רון", role:"חייל"}, {name:"עומר", role:"חייל"}];
    store["shed2_pers"] = [{name:"עידן", role:"חייל"}];

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-morning-rollcall').classList.add('active');
    await renderMorningRollcall();
    await setMorningRollcallMark("shed1","דני","present");
    await setMorningRollcallMark("shed1","רון","duty");
    // עומר לא מסומן בכלל -> אמור ליפול ל"unmarked", לא "present"
    await setMorningRollcallMark("shed2","עידן","present");

    window._t = [];
    await sendMorningRollcallReport();

    return {
      shed1Report: store["shed1_daily_rollcall_report"],
      shed2Report: store["shed2_daily_rollcall_report"],
      toasts: window._t,
    };
  });
  record("דיווח סככה 1: counts נכונים (1 נוכח, 1 תורנות, 1 unmarked)",
    out.shed1Report && out.shed1Report.counts.present===1 && out.shed1Report.counts.duty===1 && out.shed1Report.counts.unmarked===1,
    JSON.stringify(out.shed1Report && out.shed1Report.counts));
  record("namesByStatus: עומר (לא סומן) נמצא בדלי unmarked, לא בדלי present",
    out.shed1Report && out.shed1Report.namesByStatus.unmarked.includes("עומר") && !out.shed1Report.namesByStatus.present.includes("עומר"),
    JSON.stringify(out.shed1Report && out.shed1Report.namesByStatus));
  record("שדות תאימות (absentCount/absentNames) עדיין קיימים לצורך פעמון ההתראות",
    out.shed1Report && out.shed1Report.absentCount===0 && Array.isArray(out.shed1Report.absentNames), JSON.stringify(out.shed1Report));
  record("דיווח סככה 2: 1 נוכח, אין unmarked",
    out.shed2Report && out.shed2Report.counts.present===1 && out.shed2Report.counts.unmarked===0, JSON.stringify(out.shed2Report && out.shed2Report.counts));
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

// 6. מסך המפקד: מציג דיווח מ"היום" (יום המסדר הנוכחי) עם כותרת "מסדר בוקר"
//    והתאריך הרלוונטי, מסתיר דיווח ישן
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sGet = async (k) => store[(currentShed?currentShed.id:"")+"_"+k] ?? null;
    currentShed = {id:"shed1", name:"סככה 1"};
    const sentAt = Date.now();
    store["shed1_daily_rollcall_report"] = {
      dayKey: rollcallDayKey(), sentAt,
      totalCount:7,
      counts:{present:3, duty:1, after:1, duty_team:0, absent:2, unmarked:0},
      namesByStatus:{present:["א","ב","ג"], duty:["ד"], after:["ה"], duty_team:[], absent:["רון","עידן"], unmarked:[]},
      absentCount:2, absentNames:["רון","עידן"],
    };
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-cmd').classList.add('active');
    await renderMorningRollcallReport();
    const wrap = document.getElementById("mc-report-wrap");
    const shownToday = { hidden: wrap.classList.contains("hidden"), html: document.getElementById("mc-report-content").innerHTML, title: wrap.querySelector(".cmd-section-title").textContent };

    store["shed1_daily_rollcall_report"] = {dayKey:"2000-01-01", sentAt: Date.now(), totalCount:1, counts:{present:1,duty:0,after:0,duty_team:0,absent:0,unmarked:0}, namesByStatus:{present:["א"],duty:[],after:[],duty_team:[],absent:[],unmarked:[]}, absentCount:0, absentNames:[]};
    await renderMorningRollcallReport();
    const hiddenForOld = document.getElementById("mc-report-wrap").classList.contains("hidden");

    return { shownToday, hiddenForOld };
  });
  record("מסך המפקד: הכותרת אומרת 'מסדר בוקר' וכוללת תאריך",
    out.shownToday.title.includes("מסדר בוקר") && /\d/.test(out.shownToday.title), out.shownToday.title);
  record("מסך המפקד: כלל המסגרות — מוצג רק באנר נעדרים עם מספר (לא פירוט 5 הקטגוריות)",
    !out.shownToday.hidden && out.shownToday.html.includes(">2<") && out.shownToday.html.includes("נעדרים")
    && !out.shownToday.html.includes("רון") && !out.shownToday.html.includes("תורנות"), JSON.stringify(out.shownToday));
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

// 11. כלל המסגרות: הכרטיס אצל המפקד מציג רק באנר "X נעדרים" עם מספר —
//     לא פירוט לכל 5 הסטטוסים. לחיצה על הבאנר פותחת פירוט של מי שלא
//     היה נוכח (רק מי שסומן "חסר" בפועל — לא תורנות/אפטר/צוות תורן,
//     שהן נוכחות מוסברת, ולא מי שכלל לא סומן)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    currentShed = { id:"shed1", name:"סככה 1" };
    window.sGet = async (k) => k==="daily_rollcall_report"
      ? {
          dayKey: rollcallDayKey(), sentAt: Date.now(), totalCount:5,
          counts:{present:1,duty:1,after:0,duty_team:0,absent:2,unmarked:1},
          namesByStatus:{present:["דני"],duty:["יוסי"],after:[],duty_team:[],absent:["רון","עומר"],unmarked:["שי"]},
          absentCount:2, absentNames:["רון","עומר"],
        }
      : null;

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-cmd').classList.add('active');
    await renderMorningRollcallReport();
    const cardHtml = document.getElementById("mc-report-content").innerHTML;
    const hasClickHandler = cardHtml.includes('onclick="openMorningRollcallDetail()"');

    await openMorningRollcallDetail();
    const modalOpen = document.getElementById("mc-detail-modal").classList.contains("open");
    const listHtml = document.getElementById("mc-detail-list").innerHTML;
    const subText = document.getElementById("mc-detail-sub").textContent;

    return { cardHtml, hasClickHandler, modalOpen, listHtml, subText };
  });
  record("הבאנר מציג רק את מספר הנעדרים (לא פירוט 5 הסטטוסים)",
    out.cardHtml.includes(">2<") && out.cardHtml.includes("נעדרים")
    && !out.cardHtml.includes("תורנות") && !out.cardHtml.includes("יוסי"), out.cardHtml);
  record("הבאנר עצמו ניתן ללחיצה (onclick לפתיחת הפירוט)", out.hasClickHandler, JSON.stringify({hasClickHandler:out.hasClickHandler}));
  record("לחיצה פותחת את המודל עם מספר הנעדרים בכותרת המשנה", out.modalOpen && out.subText.includes("2 נעדרים"), out.subText);
  record("הפירוט מציג את מי שסומן בפועל 'חסר' (רון, עומר)",
    out.listHtml.includes("רון") && out.listHtml.includes("עומר") && out.listHtml.includes("חסר"), out.listHtml.slice(0,300));
  record("הפירוט לא כולל מי שבתורנות (יוסי) או לא סומן (שי) — רק נעדרים בפועל",
    !out.listHtml.includes("יוסי") && !out.listHtml.includes("שי"), out.listHtml.slice(0,300));
  console.log("errs11",errs); await p.close();
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
