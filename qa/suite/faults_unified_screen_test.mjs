/* מסך תקלות מאוחד: "תקלות בינוי" (scr-binui-faults, מסך נפרד) התמזג לתוך
   "תקלות" (scr-faults) כלשונית קטגוריה, לבקשת המשתמש לצמצם מסכים חבויים.
   בדיקות נגד רגרסיה:
   - מפקד סככה רגילה רואה שתי לשוניות (ציוד/בינוי), ברירת מחדל "ציוד",
     וכל לשונית מציגה את הנתונים הנכונים מהמקור הנכון (faults_list לפי
     סככה מול binui_faults_list הגלובלי) בתוך אותו #faults-list.
   - כפתור "+ תקלה" פותח את המודל הנכון לפי הלשונית הפעילה.
   - חייל (לא מפקד) לא רואה את לשונית "בינוי" בכלל — בדיוק כמו שלא ראה
     בעבר את more-binui-item (מפקד בלבד).
   - מסגרת תפקידית (מ״ע אחזקה/הדרכה) מקבלת רק "בינוי", בלי לשוניות —
     בדיוק כמו שלפני האיחוד לא הייתה לה גישה כלל למסך תקלות ציוד
     (nav-faults/more-faults-item הוסתרו לה, ר' applyLoginUiForRole). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "מפקד");
  const out = await page.evaluate(async ()=>{
    go("scr-faults", document.getElementById("nav-faults"));
    await new Promise(r=>setTimeout(r,50));
    const r = {};
    const tabsBox = document.getElementById("faults-cat-tabs");
    r.tabsVisible = !tabsBox.classList.contains("hidden");
    r.equipActiveByDefault = faultCategory === "equip";
    r.equipListShowsSeed = document.getElementById("faults-list").innerHTML.includes("תקלה לדוגמה");
    r.addBtnOpensEquipModal = document.getElementById("add-fault-btn").onclick === openAddFault;

    setFaultCategory("binui");
    await new Promise(r=>setTimeout(r,50));
    r.binuiListShowsSeed = document.getElementById("faults-list").innerHTML.includes("תקלת בינוי לדוגמה");
    r.addBtnOpensBinuiModal = document.getElementById("add-fault-btn").onclick === openAddBinuiFault;
    r.filterRowClearedForBinui = document.getElementById("faults-filter").innerHTML === "";
    return r;
  });
  record("מפקד סככה רואה לשוניות ציוד/בינוי, ברירת מחדל ציוד", out.tabsVisible && out.equipActiveByDefault, JSON.stringify(out));
  record("לשונית ציוד מציגה תקלת ציוד (faults_list)", out.equipListShowsSeed, JSON.stringify(out));
  record("כפתור + תקלה בלשונית ציוד פותח את מודל הציוד", out.addBtnOpensEquipModal, JSON.stringify(out));
  record("לשונית בינוי מציגה תקלת בינוי (binui_faults_list)", out.binuiListShowsSeed, JSON.stringify(out));
  record("כפתור + תקלה בלשונית בינוי פותח את מודל הבינוי", out.addBtnOpensBinuiModal, JSON.stringify(out));
  record("שורת פילטר פתוח/סגור מתנקה בלשונית בינוי", out.filterRowClearedForBinui, JSON.stringify(out));
  record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));
}

{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "חייל");
  const out = await page.evaluate(async ()=>{
    faultCategory = "equip";
    go("scr-faults", document.getElementById("nav-faults"));
    await new Promise(r=>setTimeout(r,50));
    return {
      tabsHidden: document.getElementById("faults-cat-tabs").classList.contains("hidden"),
      category: faultCategory,
    };
  });
  record("חייל לא רואה את לשונית בינוי (נשאר על ציוד בלבד)", out.tabsHidden && out.category==="equip", JSON.stringify(out));
  record("אין שגיאות JS (חייל)", pageErrors.length===0, JSON.stringify(pageErrors));
}

for(const shedId of ["maint","training"]){
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, shedId, "מפקד");
  const out = await page.evaluate(async ()=>{
    faultCategory = "equip";   // מדמה ניווט קודם — חייב להידרס בחזרה ל"בינוי" עבור מסגרת תפקידית
    go("scr-faults", document.getElementById("more-faults-item") || document.getElementById("nav-faults"));
    renderFaults();
    await new Promise(r=>setTimeout(r,50));
    return {
      tabsHidden: document.getElementById("faults-cat-tabs").classList.contains("hidden"),
      category: faultCategory,
    };
  });
  record(`מסגרת תפקידית (${shedId}) מקבלת רק בינוי, בלי לשוניות`, out.tabsHidden && out.category==="binui", JSON.stringify(out));
  record(`אין שגיאות JS (${shedId})`, pageErrors.length===0, JSON.stringify(pageErrors));
}

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
