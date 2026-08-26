/* מסך "אנשים" (scr-people) — איחוד עבור מפקד סככה/מחלקה רגילה של ארבע
   כניסות שהיו "מתחבאות" בתפריט "עוד": ניהול צוות, ימי הולדת, כשירות
   חיילים, ובתוספת כרטיסי חייל+חיפוש ואנשי מילואים (חדשים במסך הזה).
   רלוונטי בדיוק לאותה אוכלוסייה שמקבלת את שער ההדרכה (hasTrainHub) —
   לא למחלקות/מ״ע אחזקה/הדרכה, ששם הפריטים נשארים איפה שהיו. */
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
    const searchHtml = document.getElementById("people-search-results").innerHTML;
    const reservesHtml = document.getElementById("people-reserves-list").innerHTML;
    const bdaysHtml = document.getElementById("people-bdays-list").innerHTML;
    const screenHtml = document.getElementById("scr-people").innerHTML;
    // סינון חיפוש
    const inp = document.getElementById("people-search");
    inp.value = "חייל א";
    renderPeopleSearch();
    const filtered = document.getElementById("people-search-results").innerHTML;
    inp.value = "";
    renderPeopleSearch();
    return {
      nav,
      screenActive: document.getElementById("scr-people").classList.contains("active"),
      searchShowsAll: searchHtml.includes("מפקד סככה 1") && searchHtml.includes("חייל א סככה 1") && searchHtml.includes("חייל ב סככה 1"),
      reservesShowsReserve: reservesHtml.includes("חייל ב סככה 1") && !reservesHtml.includes("חייל א סככה 1"),
      bdaysShowsPeople: bdaysHtml.includes("חייל א סככה 1"),
      hasTeamMgmtCard: screenHtml.includes("openTeamMgmt()") && screenHtml.includes("ניהול צוות"),
      hasMedchecksCard: screenHtml.includes("go('scr-medchecks',null)"),
      filteredToOne: filtered.includes("חייל א סככה 1") && !filtered.includes("חייל ב סככה 1") && !filtered.includes("מפקד סככה 1"),
    };
  });
  record("מפקד סככה רגילה: לשונית \"אנשים\" גלויה", out.nav.peopleVisible, JSON.stringify(out.nav));
  record("\"ניהול צוות\" ירד מ\"עוד\" (עבר למסך אנשים)", out.nav.teamItemHidden, JSON.stringify(out.nav));
  record("\"ימי הולדת\" ירד מ\"עוד\" (עבר למסך אנשים)", out.nav.bdaysItemHidden, JSON.stringify(out.nav));
  record("\"כשירות חיילים\" ירד מ\"עוד\" (עבר למסך אנשים)", out.nav.medchecksSheetHidden, JSON.stringify(out.nav));
  record("המסך נפתח בלחיצה על הלשונית", out.screenActive, JSON.stringify(out));
  record("כרטיסי חייל: מציג את כל אנשי הצוות כברירת מחדל", out.searchShowsAll, JSON.stringify(out));
  record("אנשי מילואים: מציג רק את מי שמסומן כמילואים", out.reservesShowsReserve, JSON.stringify(out));
  record("ימי הולדת: מציג את אנשי הצוות", out.bdaysShowsPeople, JSON.stringify(out));
  record("קיים כפתור \"ניהול צוות\"", out.hasTeamMgmtCard, JSON.stringify(out));
  record("קיים כפתור \"כשירות חיילים\"", out.hasMedchecksCard, JSON.stringify(out));
  record("חיפוש מסנן לפי שם", out.filteredToOne, JSON.stringify(out));
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
