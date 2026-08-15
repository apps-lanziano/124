/* שדה מקצוע: (1) כולל "נהג" ו"מטיס"; (2) זמין גם ליוזר "מחלקות" (dept)
   בשני הטפסים (עריכת משתמש-מנהל + ניהול צוות); (3) נשמר במחלקות;
   (4) נהג מוחרג מדו"ח החריגות (כמו מילואים). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  r.professionsHasDriverPilot = PROFESSIONS.includes("נהג") && PROFESSIONS.includes("מטיס");

  // (2) טופס עריכת משתמש (מנהל): מקצוע גלוי גם למחלקות
  document.getElementById("ue-shed").innerHTML = SHEDS.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");
  document.getElementById("ue-shed").value = "dept";
  ueSyncFields();
  r.ueProfVisibleDept = document.getElementById("ue-profession").style.display !== "none";
  r.ueDeptWrapVisible = document.getElementById("ue-dept-wrap").style.display !== "none";  // מחלקה עדיין מוצגת

  // (2) טופס ניהול צוות: מקצוע גלוי גם כשהמסגרת היא מחלקות
  currentShed = {id:"dept", name:"מחלקות", isDept:true};
  PERSONNEL = [];
  openTeamMgmt();
  const profSel = document.getElementById("tm-profession");
  r.tmProfVisibleDept = profSel.style.display !== "none";
  r.tmProfHasDriver = [...profSel.options].some(o=>o.value==="נהג");
  document.getElementById("team-modal").classList.remove("open");

  // (4) נהג מוחרג מדו"ח החריגות (גם profession="נהג" וגם "נהג מקצועי")
  const pf = new Set([]);
  const pool = [
    {name:"נהג רגיל", role:"חייל", profession:"נהג"},
    {name:"נהג מקצועי", role:"חייל", profession:"נהג מקצועי"},
    {name:"חייל פמס", role:"חייל"},
  ];
  const c = computeRosterCompliance(migrateRosterToV2(null), pf, pool);
  r.driverExcluded = !c.rows.some(x=>x.name==="נהג רגיל") && !c.gray.some(g=>g.name==="נהג רגיל")
    && !c.rows.some(x=>x.name==="נהג מקצועי") && !c.gray.some(g=>g.name==="נהג מקצועי");
  r.plainSoldierStillGray = c.gray.some(g=>g.name==="חייל פמס");  // חייל רגיל שלא שובץ עדיין אפור

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("מקצועות כוללים נהג + מטיס", out.professionsHasDriverPilot, String(out.professionsHasDriverPilot));
record("טופס-מנהל: מקצוע גלוי במחלקות", out.ueProfVisibleDept, String(out.ueProfVisibleDept));
record("טופס-מנהל: שדה מחלקה עדיין מוצג במחלקות", out.ueDeptWrapVisible, String(out.ueDeptWrapVisible));
record("ניהול צוות: מקצוע גלוי במחלקות", out.tmProfVisibleDept, String(out.tmProfVisibleDept));
record("ניהול צוות: 'נהג' ברשימת המקצועות", out.tmProfHasDriver, String(out.tmProfHasDriver));
record("נהג (שני הנוסחים) מוחרג מדו״ח החריגות", out.driverExcluded, String(out.driverExcluded));
record("חייל רגיל שלא שובץ עדיין אפור (לא הוחרג בטעות)", out.plainSoldierStillGray, String(out.plainSoldierStillGray));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
