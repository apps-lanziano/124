/* לוח אילוצים מרוכז למ"ע: מרכז את כל האילוצים התאריכיים מכל המסגרות,
   מקובץ לפי חייל. אילוצים שאינם תאריכיים או שכבר עברו — אינם מוצגים. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  const future = "2027-03-10";
  await saveDutyRequests([
    {id:"a1", type:"vacation", by:"חייל א סככה 1", shed:"shed1", fromDate:future, toDate:future, status:"approved", ts:1},
    {id:"a2", type:"course",   by:"חייל ב סככה 1", shed:"shed1", fromDate:future, toDate:future, status:"pending",  ts:2},
    {id:"a3", type:"other",    by:"חייל א סככה 1", shed:"shed1", reason:"x", status:"approved", ts:3},        // לא תאריכי
    {id:"a4", type:"vacation", by:"חייל א סככה 1", shed:"shed1", fromDate:"2020-01-01", toDate:"2020-01-01", status:"approved", ts:4}, // עבר
  ]);

  await openConstraintsBoard();
  r.modalOpen = document.getElementById("constraints-board-modal").classList.contains("open");
  r.count = _cnsRows.length;                       // רק a1,a2
  r.hasDated = _cnsRows.some(c=>c.id==="a1") && _cnsRows.some(c=>c.id==="a2");
  r.noOther = !_cnsRows.some(c=>c.id==="a3");       // "אחר" לא תאריכי
  r.noPast = !_cnsRows.some(c=>c.id==="a4");        // עבר

  const body = document.getElementById("cns-board-body").innerHTML;
  r.showsBothNames = body.includes("חייל א סככה 1") && body.includes("חייל ב סככה 1");
  r.showsPending = body.includes("ממתין");
  r.sub = document.getElementById("cns-board-sub").textContent.includes("2 אנשים");

  // סינון לפי שם
  document.getElementById("cns-board-search").value = "חייל ב";
  renderConstraintsBoard();
  const body2 = document.getElementById("cns-board-body").innerHTML;
  r.filtered = body2.includes("חייל ב סככה 1") && !body2.includes("חייל א סככה 1");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("הלוח המרוכז נפתח", out.modalOpen, String(out.modalOpen));
record("מוצגים רק אילוצים תאריכיים פעילים (2)", out.count===2 && out.hasDated, JSON.stringify({count:out.count,hasDated:out.hasDated}));
record("אילוץ \"אחר\" (לא תאריכי) לא מוצג", out.noOther, String(out.noOther));
record("אילוץ שעבר לא מוצג", out.noPast, String(out.noPast));
record("מוצגים שמות שני החיילים", out.showsBothNames, String(out.showsBothNames));
record("אילוץ ממתין מסומן", out.showsPending, String(out.showsPending));
record("כותרת מציגה מספר אנשים", out.sub, String(out.sub));
record("סינון לפי שם עובד", out.filtered, String(out.filtered));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
