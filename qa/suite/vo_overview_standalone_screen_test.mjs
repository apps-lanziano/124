/* בקשת המשך למ״ע אחזקה: לשונית "סקירה" הוצאה ממסך "רכבים" והפכה למסך/כפתור
   ניווט עצמאי (scr-vo-overview + nav-vo-overview), בדיוק כמו שנעשה קודם
   למסדר הבוקר. בנוסף, "עמוד מפקד" (scr-cmd) מוסר לגמרי למ״ע אחזקה, וכל מה
   שהיה שם (מגמות, דיווח מסדר בוקר אחרון, פעולות ניהול) עבר למסך הסקירה. */
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

// 1. הלשונית "סקירה" הוצאה לגמרי ממסך הרכבים; ברירת המחדל שם היא "תפעוליים"
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>({
    votabOverviewGone: !document.getElementById("votab-overview") && !document.getElementById("vopane-overview"),
    hasOwnScreen: !!document.getElementById("scr-vo-overview"),
    hasOwnNavBtn: !!document.getElementById("nav-vo-overview"),
    vehiclesTabIsDefaultActive: document.getElementById("votab-vehicles").classList.contains("active") &&
                                 document.getElementById("vopane-vehicles").classList.contains("active"),
  }));
  record("votab/vopane-overview כבר לא קיימים בתוך מסך הרכבים", out.votabOverviewGone, JSON.stringify(out));
  record("קיים מסך עצמאי scr-vo-overview וכפתור ניווט משלו", out.hasOwnScreen && out.hasOwnNavBtn, JSON.stringify(out));
  record("ברירת המחדל במסך הרכבים היא הלשונית 'תפעוליים'", out.vehiclesTabIsDefaultActive, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. voOverviewGo מנווט בין מסכים כשצריך (רכבים/רישיונות עוברים למסך "רכבים",
//    תקלות בינוי למסך שלו, כשירויות חיילים למסך שלו, מסדר בוקר למסך שלו) —
//    לא רק מחליף לשונית באותו מסך. "materials"/"tools" (הזמנת חומרים/כלים
//    מוטוריים) הוסרו מהסקירה — הוחלפו ב"faults"/"med" (2026-08).
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.renderVoVehicles = ()=>{ window._called = (window._called||[]).concat("vehicles"); };
    window.renderVoLicenses = ()=>{ window._called = (window._called||[]).concat("licenses"); };
    window.renderBinuiFaultsAdmin = async ()=>{};
    window.renderMedChecks = async ()=>{};
    window.renderMorningRollcall = async ()=>{};
    window.renderMessages = ()=>{}; window.renderBrief = ()=>{};
    voOverviewGo("vehicles");
    const afterVehicles = document.getElementById("scr-vehicle-officer").classList.contains("active");
    voOverviewGo("faults");
    const afterFaults = document.getElementById("scr-binui-admin").classList.contains("active");
    voOverviewGo("med");
    const afterMed = document.getElementById("scr-medchecks").classList.contains("active");
    voOverviewGo("morningcheck");
    const afterMorning = document.getElementById("scr-morning-rollcall").classList.contains("active");
    return { afterVehicles, afterFaults, afterMed, afterMorning };
  });
  record("voOverviewGo('vehicles') עובר למסך הרכבים", out.afterVehicles, JSON.stringify(out));
  record("voOverviewGo('faults') עובר למסך תקלות בינוי", out.afterFaults, JSON.stringify(out));
  record("voOverviewGo('med') עובר למסך כשירות חיילים", out.afterMed, JSON.stringify(out));
  record("voOverviewGo('morningcheck') עובר למסך מסדר הבוקר", out.afterMorning, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. מסך הסקירה: כניסה אליו מרנדרת את הדשבורד הכלל-טייסתי (כולל "תמונת
//    מצב" עם תקלות בינוי/כשירויות חיילים במקום הזמנת חומרים/כלים מוטוריים)
//    וגם את דיווח מסדר הבוקר האחרון. "מיקוד יומי"/"מדדים במבט אחד"
//    (renderTrends) ו"תדריך בוקר"/"לוח הודעות" הוסרו לגמרי מהמסך (2026-08,
//    בקשת המשתמש) — נשאר רק "קישור הדרכה".
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    currentShed = { id:"maint", name:"מ״ע אחזקה", isMaint:true };
    PERSONNEL = [{name:"דני", role:"חייל"}];
    window.sGetIn = async (shed,k) => k==="vehicles_list" ? [] : null;
    window.sGetRaw = async k => (k && k.startsWith("daily_rollcall_")) ? {} : (k==="binui_faults_list" ? [] : null);
    window.sGet = async (k) => {
      if(k==="daily_rollcall_report") return {dayKey: rollcallDayKey(), sentAt: Date.now(), presentCount:3, absentCount:1, totalCount:4, absentNames:["עידן"]};
      if(k==="duty_requests") return [];
      return {};
    };
    window.getVoLicenses = async () => [];
    window.getEvents = async () => []; window.getFaults = async () => []; window.getCerts = async () => [];
    window.getTools = async () => []; window.getVehicles = async () => [];
    window.getNaatim = async () => [];

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-vo-overview').classList.add('active');
    await renderVoOverview();
    await renderMorningRollcallReport("vo-mc-report-wrap","vo-mc-report-content");

    return {
      overviewHasContent: document.getElementById("vo-overview-content").innerHTML.length > 100,
      boardShowsFaultsAndMed: document.getElementById("vo-overview-content").innerHTML.includes("תקלות בינוי") &&
                               document.getElementById("vo-overview-content").innerHTML.includes("כשירויות חיילים"),
      boardHidesOldBanners: !document.getElementById("vo-overview-content").innerHTML.includes("הזמנות חומרים") &&
                             !document.getElementById("vo-overview-content").innerHTML.includes("כלים מוטוריים"),
      noTrendsSection: !document.getElementById("vo-trends-content"),
      mcReportShown: !document.getElementById("vo-mc-report-wrap").classList.contains("hidden") &&
                     document.getElementById("vo-mc-report-content").innerHTML.includes("נעדרים"),
      hasTrainingLinkOnly: !!document.querySelector('#scr-vo-overview [onclick="openTrainingLinkAdd()"]') &&
                            !document.querySelector('#scr-vo-overview [onclick="openBriefMgmt()"]') &&
                            !document.querySelector('#scr-vo-overview [onclick="openMsgMgmt()"]'),
    };
  });
  record("מסך הסקירה מציג את דשבורד הרכבים/רישיונות הכלל-טייסתי", out.overviewHasContent, JSON.stringify(out));
  record("'תמונת מצב' מציגה תקלות בינוי וכשירויות חיילים", out.boardShowsFaultsAndMed, JSON.stringify(out));
  record("'תמונת מצב' כבר לא מציגה הזמנות חומרים/כלים מוטוריים", out.boardHidesOldBanners, JSON.stringify(out));
  record("אין יותר סעיף 'מיקוד יומי'/'מדדים במבט אחד' (vo-trends-content הוסר)", out.noTrendsSection, JSON.stringify(out));
  record("מסך הסקירה מציג את דיווח מסדר הבוקר האחרון (שהיה ב'עמוד מפקד')", out.mcReportShown, JSON.stringify(out));
  record("ניהול כולל רק 'קישור הדרכה' — תדריך בוקר/לוח הודעות הוסרו", out.hasTrainingLinkOnly, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
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
