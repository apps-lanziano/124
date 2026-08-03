/* בקשות מ״ע אחזקה: (3) סטטוס "בטיפול" שמשתיק התראות פג-תוקף, (4) שינוי שם
   "רכבי אחזקה" -> "רכבי צ'", (5) תצוגה ראשית: מס' רישוי אזרחי+צבאי יחד +
   תאריך טיפול חודשי; בהרחבה: טסט/טיפול שנתי/קוד דלק/קוד רכב.
   בקשת המשך: (D) תיקון באג תצוגה חתוכה בכרטיס רכב (פס עליון עם שם ארוך +
   pill רחב ללא הגבלה) — pill מוגבל ברוחב עם title, וכותרת הכרטיס מיושרת
   ל-flex-start. (E) בהרחבה, כל שורת בדיקה כוללת גם תיאור יחסי וגם תאריך/
   יעד מוחלט (למשל "טסט בעוד חודש, 21.9.2026"). */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const p = await b.newPage();
await p.route('**gstatic.com/**', r=>r.abort());
await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(250);

// 1. רכב "בטיפול" -> pill ניטרלי "בטיפול", לא אדום/צהוב, למרות תאריכים שפגו
{
  const out = await p.evaluate(()=>{
    const v = { name:"רכב בדיקה", number:"111-22-333", militaryNumber:"9876543", inService:true,
      testDate:"2000-01-01", monthlyService:"2000-01-01", annualService:"2000-01-01" };
    const status = vehicleStatusDetailed(v, ["nextService","monthlyService","annualService","testDate","kmService"]);
    const short = vehicleShortLabel(status);
    const html = vehicleCardHtml(v, "", ["nextService","monthlyService","annualService","testDate","kmService"]);
    return { cls: short.cls, txt: short.txt, issuesCount: status.issues.length, htmlHasRed: html.includes("🔴"), htmlHasInService: html.includes("בטיפול") };
  });
  record("רכב 'בטיפול': pill ניטרלי (n) עם טקסט 'בטיפול', לא r/y",
    out.cls==="n" && out.txt==="בטיפול", JSON.stringify(out));
  record("רכב 'בטיפול': אין אף בעיה אדומה מוצגת למרות תאריכים שעברו",
    out.issuesCount===0 && !out.htmlHasRed, JSON.stringify(out));
  record("רכב 'בטיפול': הכרטיס עצמו מציג 'בטיפול'", out.htmlHasInService, JSON.stringify(out));
  console.log("errs1",errs);
}

// 2. רכב רגיל (לא בטיפול) עם תאריך שעבר -> עדיין מוצג כרגיל (רגרסיה)
{
  const out = await p.evaluate(()=>{
    const v = { name:"רכב רגיל", number:"111-22-333", testDate:"2000-01-01" };
    const status = vehicleStatusDetailed(v, ["testDate"]);
    return { cls: status.cls, hasRed: status.tag.includes("🔴") };
  });
  record("רכב רגיל (לא בטיפול): עדיין מציג אדום כשהתאריך עבר — לא נשבר",
    out.cls==="r" && out.hasRed, JSON.stringify(out));
}

// 3. תצוגה ראשית: מס' רישוי אזרחי וצבאי מוצגים שניהם יחד (לא רק אחד)
{
  const out = await p.evaluate(()=>{
    const v = { name:"רכב", number:"111-22-333", militaryNumber:"9876543" };
    const html = vehicleCardHtml(v, "", ["nextService"]);
    return { html };
  });
  record("תצוגה ראשית: מס' רישוי אזרחי וצבאי מוצגים שניהם יחד",
    out.html.includes("111-22-333") && out.html.includes("9876543"), out.html.slice(0,400));
}

// 4. תצוגה ראשית: תאריך טיפול חודשי מוצג בכותרת המכווצת (לא רק בהרחבה)
{
  const out = await p.evaluate(()=>{
    const soon = new Date(Date.now()+5*86400000).toISOString().slice(0,10);
    const v = { name:"רכב", number:"111", monthlyService: soon };
    const html = vehicleCardHtml(v, "", ["monthlyService"]);
    // הכותרת המכווצת היא לפני ה-cert-sum-detail
    const headHtml = html.split('cert-sum-detail')[0];
    return { hasMonthlyInHead: headHtml.includes("טיפול חודשי") };
  });
  record("תאריך טיפול חודשי מופיע בתצוגה הראשית (המכווצת), לא רק בהרחבה",
    out.hasMonthlyInHead, JSON.stringify(out));
}

// 5. בהרחבה: טסט, טיפול שנתי, קוד דלק, קוד רכב — כל הפרטים קיימים
{
  const out = await p.evaluate(()=>{
    const v = { name:"רכב", number:"111", testDate:"2030-01-01", annualService:"2030-01-01", fuelCode:"D7", vehicleCode:"VC9" };
    const html = vehicleCardHtml(v, "", ["testDate","annualService"]);
    return {
      hasTest: html.includes("טסט"),
      hasAnnual: html.includes("טיפול שנתי"),
      hasFuelCode: html.includes("D7"),
      hasVehicleCode: html.includes("VC9"),
    };
  });
  record("בהרחבה: טסט/טיפול שנתי/קוד דלק/קוד רכב כולם מופיעים",
    out.hasTest && out.hasAnnual && out.hasFuelCode && out.hasVehicleCode, JSON.stringify(out));
}

// 6. שינוי שם: "רכבי אחזקה"/"רכב אחזקה" לא מופיע יותר באפליקציה — הוחלף ל"רכבי צ'"
{
  const out = await p.evaluate(()=>{
    return {
      addBtnLabel: document.querySelector('[onclick="openMaintVehicleAdd()"]')?.textContent || "",
      modalTitleEl: !!document.getElementById("maint-vehicle-title"),
    };
  });
  record("כפתור הוספת רכב צ' משתמש בשם החדש", out.addBtnLabel.includes("צ'") && !out.addBtnLabel.includes("אחזקה"), out.addBtnLabel);
}

// 7. יש checkbox "בטיפול" בשלושת טפסי הרכב (vo/maint/leasing) ונשמר נכון דרך שדות הטופס
{
  const out = await p.evaluate(()=>{
    const ids = ["vo-vehicle-in-service","maint-vehicle-in-service","leasing-vehicle-in-service"];
    const exist = ids.every(id=>!!document.getElementById(id));
    const inFields = VO_VEHICLE_FIELDS.some(f=>f[0]==="inService") &&
                      MAINT_VEHICLE_FIELDS.some(f=>f[0]==="inService") &&
                      LEASING_VEHICLE_FIELDS.some(f=>f[0]==="inService");
    return { exist, inFields };
  });
  record("צ'קבוקס 'בטיפול' קיים בשלושת הטפסים ורשום בשלושת מערכי השדות",
    out.exist && out.inFields, JSON.stringify(out));
}

// 8. saveMaintVehicle שומר את הצ'קבוקס inService=true נכון
{
  const out = await p.evaluate(async ()=>{
    const store = { "admin_maint_vehicles": [] };
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.toast = ()=>{}; window.renderMaintVehicles = ()=>{};
    document.getElementById("maint-vehicle-name").value = "רכב צ' לדוגמה";
    document.getElementById("maint-vehicle-number").value = "";
    document.getElementById("maint-vehicle-military-number").value = "";
    document.getElementById("maint-vehicle-company").value = "";
    document.getElementById("maint-vehicle-code").value = "";
    document.getElementById("maint-vehicle-fuel-code").value = "";
    document.getElementById("maint-vehicle-next-service").value = "";
    document.getElementById("maint-vehicle-test").value = "";
    document.getElementById("maint-vehicle-km").value = "";
    document.getElementById("maint-vehicle-km-service").value = "";
    document.getElementById("maint-vehicle-monthly-service").value = "";
    document.getElementById("maint-vehicle-annual-service").value = "";
    document.getElementById("maint-vehicle-winter").value = "";
    document.getElementById("maint-vehicle-notes").value = "";
    document.getElementById("maint-vehicle-in-service").checked = true;
    maintVehicleEditId = null;
    await saveMaintVehicle();
    return { saved: store["admin_maint_vehicles"] };
  });
  record("saveMaintVehicle שומר inService:true כשהצ'קבוקס מסומן",
    out.saved.length===1 && out.saved[0].inService===true, JSON.stringify(out.saved));
  console.log("errs8",errs);
}

// 9. תיקון תצוגה חתוכה: כותרת הכרטיס לא ממורכזת אנכית כשלשם יש כמה שורות
//    (מונע "נבלעות"/חפיפה של השם והפעולות), והפילה עוברת שורה במקום להיחתך
{
  const out = await p.evaluate(()=>{
    const v = { name:"משאית תדלוק כבדה עם שם ארוך במיוחד לבדיקת גלישה", number:"111-222-33", militaryNumber:"9876543-פ",
      monthlyService: new Date(Date.now()+5*86400000).toISOString().slice(0,10) };
    const html = vehicleCardHtml(v, "", ["monthlyService"]);
    const pillMatch = html.match(/<span class="pill[^"]*" style="([^"]*)">([^<]*)<\/span>/);
    return {
      pillStyle: pillMatch ? pillMatch[1] : "",
      pillText: pillMatch ? pillMatch[2] : "",
      headHasFlexStart: /cert-sum-head" style="align-items:flex-start"/.test(html),
    };
  });
  record("pill הסטטוס עוטף טקסט ארוך (white-space:normal) במקום לחתוך אותו",
    out.pillStyle.includes("white-space:normal") && !out.pillStyle.includes("ellipsis"), JSON.stringify(out));
  record("הטקסט בפילה מוצג במלואו — לא נחתך עם '...'",
    !out.pillText.includes("…") && !out.pillText.endsWith(".."), JSON.stringify(out));
  record("כותרת הכרטיס מיושרת ל-flex-start (לא center) כדי לא לשבור שם רב-שורות",
    out.headHasFlexStart, JSON.stringify(out));
}

// 10. אותו תיקון, על מקרה קונקרטי שדווח כחתוך: "1 דורשים טיפול" לא נחתך ל-"1 דורשים טיפ.."
{
  const out = await p.evaluate(()=>{
    const v = { name:"רכב", number:"111", testDate:"2000-01-01" };   // בעיה אדומה אחת -> טקסט לא-קצר בפילה
    const html = vehicleCardHtml(v, "", ["testDate"]);
    const pillMatch = html.match(/<span class="pill[^"]*"[^>]*>([^<]*)<\/span>/);
    return { pillText: pillMatch ? pillMatch[1] : "" };
  });
  record("טקסט הפילה על רכב עם בעיה אדומה מוצג במלואו, לא נחתך",
    !out.pillText.endsWith("..") && !out.pillText.includes("…") && out.pillText.length>0, JSON.stringify(out));
}

// 11. בהרחבה: כל שורת בדיקה כוללת גם ניסוח יחסי וגם תאריך/יעד מוחלט
{
  const out = await p.evaluate(()=>{
    const future = new Date(); future.setMonth(future.getMonth()+1);
    const futureStr = future.toISOString().slice(0,10);
    const futureFmt = future.toLocaleDateString('he-IL');
    const v = { name:"רכב", number:"111", testDate: futureStr, km: 9000, kmService: 10000, hours: 480, hoursNext: 500 };
    const dateCheck = vehicleDateCheck(v.testDate, 45, "טסט");
    const kmCheck = vehicleKmCheck(v);
    const hoursCheck = vehicleHoursCheck(v);
    return {
      dateTag: dateCheck && dateCheck.tag, futureFmt,
      kmTag: kmCheck && kmCheck.tag,
      hoursTag: hoursCheck && hoursCheck.tag,
    };
  });
  record("בדיקת תאריך (טסט/טיפול): כוללת גם 'בעוד X ימים' וגם תאריך מוחלט",
    /בעוד \d+ ימים/.test(out.dateTag) && out.dateTag.includes(out.futureFmt), JSON.stringify(out));
  record("בדיקת ק\"מ: כוללת גם ספירה יחסית וגם יעד ק\"מ מוחלט",
    /ק"מ/.test(out.kmTag) && out.kmTag.includes("יעד:") && out.kmTag.includes("10,000"), JSON.stringify(out));
  record("בדיקת שעות מנוע: כוללת גם ספירה יחסית וגם יעד שעו\"מ מוחלט",
    /שעו"מ/.test(out.hoursTag) && out.hoursTag.includes("יעד:") && out.hoursTag.includes("500"), JSON.stringify(out));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await p.close();
await b.close();
process.exit(allPass?0:1);
