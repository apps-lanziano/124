/* הזמנת ציוד חודשית — בדיקות:
   - קטלוג מוצרים מוצג עם מחירים (3 קטגוריות)
   - quantity stepper עובד (+/-)
   - חסימת חריגה מ-300₪
   - שליחת הזמנה (draft → submitted)
   - הזמנה שנשלחה = קריאה בלבד
   - לשונית אדמין מציגה הזמנות מכל הסככות
   - סימון חוסרים + סימון כסופק
   - הרשאות: isSuppliesResp נדרש, מ״ע אחזקה רואה אדמין
   - sheet-supplies מוסתר ל-maint/training units */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// --- בדיקה 1: קטלוג מוצרים מוצג עם 3 קטגוריות ---
{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "מפקד");
  const out = await page.evaluate(async ()=>{
    go("scr-supplies");
    await new Promise(r=>setTimeout(r,100));
    const r = {};
    r.catalogVisible = document.getElementById("sup-catalog").innerHTML.length > 0;
    r.catTabs = document.getElementById("sup-cat-tabs").innerHTML;
    r.hasNikui = r.catTabs.includes("ניקוי");
    r.hasKtiva = r.catTabs.includes("כתיבה");
    r.hasHadPaami = r.catTabs.includes("חד פעמי");
    r.itemCount = document.querySelectorAll(".sup-item").length;
    r.hasPrices = document.querySelector(".sup-item-price") !== null;
    r.hasStepper = document.querySelector(".sup-stepper") !== null;
    return r;
  });
  record("קטלוג מוצרים מוצג עם 3 לשוניות קטגוריה", out.catalogVisible && out.hasNikui && out.hasKtiva && out.hasHadPaami, JSON.stringify(out));
  record("פריטים מוצגים עם מחירים ו-stepper", out.itemCount > 0 && out.hasPrices && out.hasStepper, JSON.stringify(out));
  record("אין שגיאות JS (קטלוג)", pageErrors.length===0, JSON.stringify(pageErrors));
}

// --- בדיקה 2: quantity stepper + חסימת תקציב ---
{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "מפקד");
  const out = await page.evaluate(async ()=>{
    go("scr-supplies");
    await new Promise(r=>setTimeout(r,100));
    const r = {};
    // הוספת פריט
    updateSupplyQty("n1", 1);
    r.afterAdd = supDraft.items.find(x=>x.id==="n1")?.qty;
    // הוספת עוד
    updateSupplyQty("n1", 1);
    r.afterAdd2 = supDraft.items.find(x=>x.id==="n1")?.qty;
    // הורדה
    updateSupplyQty("n1", -1);
    r.afterRemove = supDraft.items.find(x=>x.id==="n1")?.qty;
    // הורדה לאפס
    updateSupplyQty("n1", -1);
    r.afterZero = supDraft.items.find(x=>x.id==="n1");
    // חסימת תקציב — ניסיון להוסיף פריט יקר מעל 300
    updateSupplyQty("d1", 1); // 83.20
    updateSupplyQty("d1", 1); // 166.40
    updateSupplyQty("d1", 1); // 249.60
    updateSupplyQty("d1", 1); // 332.80 > 300 — צריך להיחסם
    r.budgetBlocked = supplyTotal(supDraft.items) <= SUPPLIES_BUDGET_LIMIT;
    r.total = supplyTotal(supDraft.items);
    return r;
  });
  record("stepper מוסיף ומוריד כמות", out.afterAdd===1 && out.afterAdd2===2 && out.afterRemove===1, JSON.stringify(out));
  record("הורדה לאפס מסירה את הפריט", out.afterZero===undefined, JSON.stringify(out));
  record("חריגה מ-300₪ נחסמת", out.budgetBlocked && out.total <= 300, JSON.stringify(out));
  record("אין שגיאות JS (stepper)", pageErrors.length===0, JSON.stringify(pageErrors));
}

// --- בדיקה 3: שליחת הזמנה + קריאה בלבד ---
{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "מפקד");
  const out = await page.evaluate(async ()=>{
    go("scr-supplies");
    await new Promise(r=>setTimeout(r,100));
    // הוספת פריט
    updateSupplyQty("k12", 3);
    const r = {};
    r.statusBefore = supDraft.status;
    // שליחה (מדלגים על confirm)
    window._origConfirm = window.confirm;
    window.confirm = () => true;
    await submitSuppliesOrder();
    window.confirm = window._origConfirm;
    r.statusAfter = supDraft.status;
    r.submittedBy = supDraft.submittedBy;
    r.submitBtnHidden = document.getElementById("sup-submit-btn").style.display === "none";
    // בדיקה שאין steppers (קריאה בלבד)
    r.noSteppers = document.querySelectorAll(".sup-stepper").length === 0;
    return r;
  });
  record("הזמנה עוברת מ-draft ל-submitted", out.statusBefore==="draft" && out.statusAfter==="submitted", JSON.stringify(out));
  record("כפתור שליחה נעלם אחרי שליחה", out.submitBtnHidden, JSON.stringify(out));
  record("הזמנה שנשלחה = קריאה בלבד (ללא stepper)", out.noSteppers, JSON.stringify(out));
  record("אין שגיאות JS (שליחה)", pageErrors.length===0, JSON.stringify(pageErrors));
}

// --- בדיקה 4: הרשאות — חייל ללא נע"ת לא רואה ---
{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "חייל");
  const out = await page.evaluate(async ()=>{
    const r = {};
    r.sheetSuppliesHidden = document.getElementById("sheet-supplies").classList.contains("hidden");
    r.isSuppliesResp = isSuppliesResp;
    return r;
  });
  record("חייל ללא נע\"ת לא רואה sheet-supplies", out.sheetSuppliesHidden && !out.isSuppliesResp, JSON.stringify(out));
  record("אין שגיאות JS (חייל)", pageErrors.length===0, JSON.stringify(pageErrors));
}

// --- בדיקה 5: מפקד רואה ---
{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "shed1", "מפקד");
  const out = await page.evaluate(async ()=>{
    const r = {};
    r.sheetSuppliesVisible = !document.getElementById("sheet-supplies").classList.contains("hidden");
    r.isSuppliesResp = isSuppliesResp;
    return r;
  });
  record("מפקד רואה sheet-supplies", out.sheetSuppliesVisible && out.isSuppliesResp, JSON.stringify(out));
}

// --- בדיקה 6: maint/training units לא רואים ---
{
  const { page: p1, pageErrors: e1 } = await newPage();
  await loginAsFramework(p1, "maint", "מפקד");
  const out1 = await p1.evaluate(async ()=>{
    return { hidden: document.getElementById("sheet-supplies").classList.contains("hidden") };
  });
  record("מ״ע אחזקה לא רואה sheet-supplies", out1.hidden, JSON.stringify(out1));
  record("אין שגיאות JS (maint)", e1.length===0, JSON.stringify(e1));

  const { page: p2, pageErrors: e2 } = await newPage();
  await loginAsFramework(p2, "training", "מפקד");
  const out2 = await p2.evaluate(async ()=>{
    return { hidden: document.getElementById("sheet-supplies").classList.contains("hidden") };
  });
  record("מסגרת הדרכה לא רואה sheet-supplies", out2.hidden, JSON.stringify(out2));
  record("אין שגיאות JS (training)", e2.length===0, JSON.stringify(e2));
}

// --- בדיקה 7: לשונית אדמין במ״ע אחזקה ---
{
  const { page, pageErrors } = await newPage();
  await loginAsFramework(page, "maint", "מפקד");
  const out = await page.evaluate(async ()=>{
    go("scr-maint-dept");
    await new Promise(r=>setTimeout(r,100));
    const r = {};
    r.suppliesTabExists = !!document.getElementById("mdtab-supplies");
    // לחיצה על לשונית
    mdTab("supplies");
    await new Promise(r=>setTimeout(r,100));
    r.suppliesPaneActive = document.getElementById("mdpane-supplies").classList.contains("active");
    r.monthLabel = document.getElementById("maint-sup-month").textContent;
    return r;
  });
  record("לשונית הזמנות ציוד קיימת במ״ע אחזקה", out.suppliesTabExists, JSON.stringify(out));
  record("לשונית נפתחת ומציגה תוכן", out.suppliesPaneActive && out.monthLabel.length > 0, JSON.stringify(out));
  record("אין שגיאות JS (אדמין)", pageErrors.length===0, JSON.stringify(pageErrors));
}

// --- בדיקה 8: סימון חוסרים + סופק (מ״ע אחזקה) ---
{
  const { page: p2, pageErrors: e2 } = await newPage();
  await loginAsFramework(p2, "maint", "מפקד");
  const out = await p2.evaluate(async ()=>{
    // זריעת הזמנה ישירות ל-storage (כל עמוד בבדיקות מבודד)
    const now = new Date();
    const mk = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0");
    await storage.set("shed1_supplies_order_"+mk, JSON.stringify({
      items:[{id:"n1",qty:2},{id:"k12",qty:5}],
      status:"submitted",
      submittedAt:now.toISOString(),
      submittedBy:"מפקד סככה 1"
    }));
    go("scr-maint-dept");
    await new Promise(r=>setTimeout(r,100));
    mdTab("supplies");
    await new Promise(r=>setTimeout(r,300));
    const r = {};
    const list = document.getElementById("maint-sup-list").innerHTML;
    r.showsShed1 = list.includes("סככה 1");
    r.showsSubmitted = list.includes("נשלח");
    // סימון כסופק
    window._origConfirm = window.confirm;
    window.confirm = () => true;
    await markSupplyDelivered("shed1", mk, false);
    window.confirm = window._origConfirm;
    await new Promise(r=>setTimeout(r,300));
    const list2 = document.getElementById("maint-sup-list").innerHTML;
    r.showsDelivered = list2.includes("סופק");
    return r;
  });
  record("אדמין רואה הזמנת shed1", out.showsShed1 && out.showsSubmitted, JSON.stringify(out));
  record("סימון כסופק עובד", out.showsDelivered, JSON.stringify(out));
  record("אין שגיאות JS (חוסרים/סופק)", e2.length===0, JSON.stringify(e2));
}

// --- בדיקה 9: SW cache name מסונכרן ---
{
  const { execSync } = await import("child_process");
  let syncOk = false;
  try { execSync("node scripts/sw-cache-name.mjs --check", { cwd: process.cwd() }); syncOk = true; } catch(e){ syncOk = false; }
  record("SW cache name מסונכרן", syncOk, syncOk ? "OK" : "CACHE_NAME לא מעודכן");
}

await closeBrowser();

// --- סיכום ---
let fail = 0;
for(const r of results){
  const icon = r.pass ? "✅" : "❌";
  console.log(`${icon} ${r.name} - ${r.detail || ""}`);
  if(!r.pass) fail++;
}
console.log(fail ? `\n${fail} בדיקות נכשלו` : `\nכל ${results.length} הבדיקות עברו`);
process.exit(fail ? 1 : 0);
