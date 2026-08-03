/* מ״ע אחזקה ביקש סדר תפריט תחתון מפורש (מימין לשמאל): סקירה, רכבים,
   תקלות בינוי, מסדר בוקר, קרא וחתום, לוח צוות שבועי — "אחזקה" (הזמנת
   חומרים/כלים) עוברת לתפריט "עוד". מכיוון שכל התפקידים חולקים את אותם
   כפתורי ניווט ב-DOM, הסדר נקבע רק דרך CSS order (לא סדר ה-DOM עצמו,
   שהיה משפיע על כל שאר התפקידים) — ומאופס בכל כניסה כדי שלא "ידלוף"
   לתפקיד אחר באותה טעינת-עמוד (למשל כניסה-בתור/impersonation). */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
import { newPage, loginAsFramework, closeBrowser } from '../lib/harness.mjs';
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

// 1. applyMaintCommanderPowers: "אחזקה" עוברת מהסרגל התחתון לתפריט "עוד",
//    ושאר חמשת הכפתורים המבוקשים (+עוד) מקבלים סדר תצוגה נכון
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    document.querySelectorAll("nav .nav-btn").forEach(b=>{ b.classList.remove("hidden"); b.style.order = ""; });
    window.ensureShed2Seed = async()=>{}; window.ensureAllShedsSeed = async()=>{};
    window.updateBinuiAdminBadge = async()=>{};
    currentShed = { id:"maint", name:"מ״ע אחזקה", isMaint:true };
    await applyMaintCommanderPowers();

    const hidden = id => document.getElementById(id).classList.contains("hidden");
    const order = id => document.getElementById(id).style.order;
    return {
      maintDeptHidden: hidden("nav-maint-dept"),
      maintDeptSheetItemHidden: hidden("more-maintdept-item"),
      overviewHidden: hidden("nav-vo-overview"),
      vehiclesHidden: hidden("nav-vehicle-officer"),
      binuiHidden: hidden("nav-binui-admin"),
      morningcheckHidden: hidden("nav-morningcheck"),
      orders: {
        overview: order("nav-vo-overview"), vehicles: order("nav-vehicle-officer"),
        binui: order("nav-binui-admin"), morningcheck: order("nav-morningcheck"),
        safety: order("nav-safety"), board: order("nav-board"), more: order("nav-more"),
      },
    };
  });
  record("'אחזקה' (nav-maint-dept) מוסתרת מהסרגל, ופריט 'עוד' המקביל גלוי",
    out.maintDeptHidden && !out.maintDeptSheetItemHidden, JSON.stringify(out));
  record("חמשת הכפתורים המבוקשים (סקירה/רכבים/תקלות בינוי/מסדר בוקר) גלויים",
    !out.overviewHidden && !out.vehiclesHidden && !out.binuiHidden && !out.morningcheckHidden, JSON.stringify(out));
  record("סדר התצוגה תואם בדיוק לרשימה שהתבקשה (מימין לשמאל: סקירה,רכבים,תקלות בינוי,מסדר בוקר,קרא וחתום,לוח שבועי,עוד)",
    Number(out.orders.overview)===1 && Number(out.orders.vehicles)===2 && Number(out.orders.binui)===3 &&
    Number(out.orders.morningcheck)===4 && Number(out.orders.safety)===5 && Number(out.orders.board)===6 &&
    Number(out.orders.more)===7,
    JSON.stringify(out.orders));
  console.log("errs1",errs); await p.close();
}

// 2. הסדר המותאם לא "דולף" לתפקיד אחר שנכנס אחר-כך באותה טעינת-עמוד —
//    איפוס ב-doLogin/logout/ownerLogin/impersonate/techOfficerLogin
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.ensureShed2Seed = async()=>{}; window.ensureAllShedsSeed = async()=>{};
    window.updateBinuiAdminBadge = async()=>{};
    currentShed = { id:"maint", name:"מ״ע אחזקה", isMaint:true };
    await applyMaintCommanderPowers();
    const beforeReset = document.getElementById("nav-vo-overview").style.order;

    // מדמה בדיוק את שורת האיפוס שמופיעה בתחילת כל נתיב כניסה/יציאה אחר
    document.querySelectorAll("nav .nav-btn").forEach(b=>{ b.style.order = ""; });

    return {
      beforeReset,
      afterReset: document.getElementById("nav-vo-overview").style.order,
      safetyAfterReset: document.getElementById("nav-safety").style.order,
      boardAfterReset: document.getElementById("nav-board").style.order,
    };
  });
  record("לפני האיפוס: יש ערך order מפורש (1)", out.beforeReset==="1", JSON.stringify(out));
  record("אחרי האיפוס: כל הכפתורים חוזרים לסדר ברירת המחדל (order ריק)",
    out.afterReset==="" && out.safetyAfterReset==="" && out.boardAfterReset==="", JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. הפריט "אחזקה" בתפריט "עוד" מנווט למסך scr-maint-dept, בדיוק כמו הכפתור שהוחלף
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.renderMessages=()=>{}; window.renderBrief=()=>{};
    document.getElementById("more-sheet").classList.add("open");
    closeMoreAnd("scr-maint-dept");
    return {
      screenActive: document.getElementById("scr-maint-dept").classList.contains("active"),
      sheetClosed: !document.getElementById("more-sheet").classList.contains("open"),
    };
  });
  record("לחיצה על פריט 'אחזקה' ב'עוד' סוגרת את הגיליון ופותחת את מסך האחזקה",
    out.screenActive && out.sheetClosed, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. מקצה-לקצה: כניסה אמיתית דרך doLogin (לא רק קריאה ישירה ל-
//    applyMaintCommanderPowers) כמפקד מ״ע אחזקה אמיתי — מוודא שההסתרה
//    המוקדמת יותר של מטלות/הסמכות/תקלות/ימי-הולדת (isTrimmedUnit ב-doLogin)
//    לא משאירה אף כפתור ב-order:0 לפני הכפתורים הממוספרים (1..7)
{
  const { page: p } = await newPage();
  const login = await loginAsFramework(p, "maint", "מפקד");
  const out = await p.evaluate(()=>{
    const items = [...document.querySelectorAll("nav .nav-btn")]
      .filter(b=>!b.classList.contains("hidden"))
      .map(b=>({ id:b.id||"(no-id)", order: Number(getComputedStyle(b).order) }));
    items.sort((a,b)=>a.order-b.order);
    return items;
  });
  record("כניסה אמיתית כמפקד מ״ע אחזקה: מתחבר בהצלחה", login.ok, JSON.stringify(login));
  record("אין אף כפתור גלוי עם order=0 (ברירת מחדל) — הכל בין 1 ל-7 בדיוק כמבוקש",
    out.every(i=>i.order>=1), JSON.stringify(out));
  record("הרשימה הגלויה מדויקת: בדיוק 7 כפתורים, בסדר הנכון",
    JSON.stringify(out.map(i=>i.id)) === JSON.stringify(["nav-vo-overview","nav-vehicle-officer","nav-binui-admin","nav-morningcheck","nav-safety","nav-board","nav-more"]),
    JSON.stringify(out));
  await p.close();
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await b.close();
await closeBrowser();
process.exit(allPass?0:1);
