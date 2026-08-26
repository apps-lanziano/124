/* מסך "אנשים" (scr-people) — איחוד עבור מפקד סככה/מחלקה רגילה של ארבע
   כניסות שהיו "מתחבאות" בתפריט "עוד": ניהול צוות, ימי הולדת, כשירות
   חיילים, ובתוספת כרטיסי חייל+חיפוש. רלוונטי בדיוק לאותה אוכלוסייה
   שמקבלת את שער ההדרכה (hasTrainHub) — לא למחלקות/מ״ע אחזקה/הדרכה,
   ששם הפריטים נשארים איפה שהיו.

   2026-08-27: רשימת "ימי הולדת" הנפרדת הוסרה — ימי ההולדת משולבים
   בכרטיס החייל עצמו (שורת התצוגה + כרטיסיית החייל המלאה). נוספו שלוש
   לשוניות קטגוריה בראש הרשימה — סדיר/קבע/מילואים — לפי p.reserve/role,
   בלי חפיפה. באנר החיפוש עצמו יושב ישירות מתחת לכותרת "אנשים". */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "מפקד");
  const out = await page.evaluate(async ()=>{
    const hidden = id => document.getElementById(id).classList.contains("hidden");
    const nav = {
      peopleVisible: !hidden("nav-people"),
      teamItemHidden: hidden("more-team-item"),
      bdaysItemHidden: hidden("more-bdays-item"),
      medchecksSheetHidden: hidden("sheet-medchecks"),
    };
    go("scr-people", document.getElementById("nav-people"));
    await new Promise(r=>setTimeout(r,120));
    const screenHtml = document.getElementById("scr-people").innerHTML;
    const r = { nav };
    r.screenActive = document.getElementById("scr-people").classList.contains("active");
    r.noSeparateBdaysList = !document.getElementById("people-bdays-list") && !document.getElementById("people-reserves-list");
    r.searchRightAfterTitle = /<h2>אנשים[\s\S]*?<\/div>\s*<\/div>\s*<input[^>]*id="people-search"/.test(screenHtml.replace(/\n/g,''));
    r.hasCatTabs = !!document.getElementById("people-cat-tabs");
    r.defaultCategory = peopleCategory;

    // ברירת מחדל (סדיר) — חיילים רגילים בלבד, לא מפקד ולא מילואים
    let html = document.getElementById("people-search-results").innerHTML;
    r.regularShowsSoldier = html.includes("חייל א סככה 1");
    r.regularHidesCommander = !html.includes("מפקד סככה 1");
    r.regularHidesReserve = !html.includes("חייל ב סככה 1");   // חייל ב = מילואים בזריעה

    // ימי הולדת משולבים בכרטיס עצמו (שורת ה-sub)
    r.cardShowsBday = html.includes("🎂");

    // לשונית "קבע" — מפקדים בלבד
    setPeopleCategory("career");
    html = document.getElementById("people-search-results").innerHTML;
    r.careerShowsCommander = html.includes("מפקד סככה 1");
    r.careerHidesSoldier = !html.includes("חייל א סככה 1");

    // לשונית "מילואים" — כולל תאריך רענון (לא רק תגית)
    setPeopleCategory("reserve");
    html = document.getElementById("people-search-results").innerHTML;
    r.reserveShowsReserve = html.includes("חייל ב סככה 1") && html.includes("רענון");
    r.reserveHidesOthers = !html.includes("חייל א סככה 1") && !html.includes("מפקד סככה 1");

    // חזרה לברירת מחדל + כפתורי ניהול
    setPeopleCategory("regular");
    r.hasTeamMgmtCard = screenHtml.includes("openTeamMgmt()") && screenHtml.includes("ניהול צוות");
    r.hasMedchecksCard = screenHtml.includes("go('scr-medchecks',null)");
    // סדר: לשוניות → ניהול צוות/כשירות חיילים → רשימת הכרטיסים (לא ההפך)
    r.mgmtBeforeList = screenHtml.indexOf("people-cat-tabs") < screenHtml.indexOf("openTeamMgmt()")
      && screenHtml.indexOf("openTeamMgmt()") < screenHtml.indexOf("people-search-results");

    // חיפוש מסנן בתוך הקטגוריה הפעילה
    const inp = document.getElementById("people-search");
    inp.value = "חייל א";
    renderPeopleSearch();
    r.filteredToOne = document.getElementById("people-search-results").innerHTML.includes("חייל א סככה 1");
    inp.value = "";
    renderPeopleSearch();
    return r;
  });
  record("מפקד סככה רגילה: לשונית \"אנשים\" גלויה", out.nav.peopleVisible, JSON.stringify(out.nav));
  record("\"ניהול צוות\" ירד מ\"עוד\" (עבר למסך אנשים)", out.nav.teamItemHidden, JSON.stringify(out.nav));
  record("\"ימי הולדת\" ירד מ\"עוד\" (עבר למסך אנשים)", out.nav.bdaysItemHidden, JSON.stringify(out.nav));
  record("\"כשירות חיילים\" ירד מ\"עוד\" (עבר למסך אנשים)", out.nav.medchecksSheetHidden, JSON.stringify(out.nav));
  record("המסך נפתח בלחיצה על הלשונית", out.screenActive, JSON.stringify(out));
  record("רשימת \"ימי הולדת\"/\"אנשי מילואים\" הנפרדות הוסרו לגמרי", out.noSeparateBdaysList, JSON.stringify(out));
  record("באנר החיפוש יושב ישירות מתחת לכותרת \"אנשים\"", out.searchRightAfterTitle, JSON.stringify(out));
  record("קיימות לשוניות קטגוריה (סדיר/קבע/מילואים), ברירת מחדל \"סדיר\"", out.hasCatTabs && out.defaultCategory==="regular", JSON.stringify(out));
  record("לשונית \"סדיר\" מציגה חייל רגיל, לא מפקד ולא מילואים", out.regularShowsSoldier && out.regularHidesCommander && out.regularHidesReserve, JSON.stringify(out));
  record("ימי הולדת משולבים בכרטיס (בלי רשימה נפרדת)", out.cardShowsBday, JSON.stringify(out));
  record("לשונית \"קבע\" מציגה מפקדים בלבד", out.careerShowsCommander && out.careerHidesSoldier, JSON.stringify(out));
  record("לשונית \"מילואים\" מציגה אנשי מילואים + תאריך רענון, בלי אחרים", out.reserveShowsReserve && out.reserveHidesOthers, JSON.stringify(out));
  record("קיים כפתור \"ניהול צוות\"", out.hasTeamMgmtCard, JSON.stringify(out));
  record("קיים כפתור \"כשירות חיילים\"", out.hasMedchecksCard, JSON.stringify(out));
  record("סדר במסך: לשוניות → ניהול/כשירות → רשימת כרטיסים", out.mgmtBeforeList, JSON.stringify(out));
  record("חיפוש מסנן לפי שם בתוך הקטגוריה הפעילה", out.filteredToOne, JSON.stringify(out));
  record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));
}

// אוכלוסיות אחרות — לא מושפעות, נשארות בדיוק כמו קודם
for(const [shedId, extra, label] of [
  ["dept", {isDept:true}, "מחלקות"],
  ["maint", {isMaint:true}, "מ״ע אחזקה"],
  ["training", {isTraining:true}, "הדרכה"],
]){
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, shedId, "מפקד");
  const out = await page.evaluate(()=>({
    peopleHidden: document.getElementById("nav-people").classList.contains("hidden"),
  }));
  record(`${label}: לשונית "אנשים" נשארת מוסתרת (לא מושפעת)`, out.peopleHidden, JSON.stringify(out));
  record(`אין שגיאות JS (${label})`, pageErrors.length===0, JSON.stringify(pageErrors));
}

{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "חייל");
  const out = await page.evaluate(()=>({
    peopleHidden: document.getElementById("nav-people").classList.contains("hidden"),
    medchecksSheetVisible: !document.getElementById("sheet-medchecks").classList.contains("hidden"),
  }));
  record("חייל: לשונית \"אנשים\" מוסתרת (מסך מפקד בלבד)", out.peopleHidden, JSON.stringify(out));
  record("חייל: \"כשירות חיילים\" נשארה נגישה כרגיל ב\"עוד\"", out.medchecksSheetVisible, JSON.stringify(out));
  record("אין שגיאות JS (חייל)", pageErrors.length===0, JSON.stringify(pageErrors));
}

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
