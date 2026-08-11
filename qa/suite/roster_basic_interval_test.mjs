/* תורנות בסיסית לטווח ימים: מ"ע תורנויות משבץ אותו חייל+סוג לכמה ימים
   ברצף בבת אחת, במקום יום-יום. הימים מחוץ לטווח לא נוגעים. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  await openRosterEditor(null, "current");
  rosterEdDay = "ראשון";

  openBasicInterval();
  r.modalOpen = document.getElementById("basic-interval-modal").classList.contains("open");
  const name = "חייל א סככה 1";
  document.getElementById("bi-name").value = name;
  document.getElementById("bi-type").value = "מטבח";
  document.getElementById("bi-from").value = "רביעי";
  document.getElementById("bi-to").value = "חמישי";
  applyBasicInterval();

  const has = (day) => (rosterDraft.days[day].basic||[]).some(b=>b.name===name && b.type==="מטבח");
  r.wed = has("רביעי");
  r.wknd = has("חמישי");           // מייצג את משמרת סופ"ש
  r.notMon = !has("שני");          // מחוץ לטווח
  r.notSun = !has("ראשון");        // מחוץ לטווח
  r.tagged = (rosterDraft.days["רביעי"].basic||[]).some(b=>b.name===name && b.iv);

  // שיבוץ חוזר של אותו טווח לא מכפיל
  document.getElementById("basic-interval-modal").classList.remove("open");
  openBasicInterval();
  document.getElementById("bi-name").value = name;
  document.getElementById("bi-type").value = "מטבח";
  document.getElementById("bi-from").value = "רביעי";
  document.getElementById("bi-to").value = "חמישי";
  applyBasicInterval();
  r.noDup = (rosterDraft.days["רביעי"].basic||[]).filter(b=>b.name===name && b.type==="מטבח").length === 1;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("חלון הטווח נפתח", out.modalOpen, String(out.modalOpen));
record("שובץ ביום רביעי (תחילת הטווח)", out.wed, String(out.wed));
record("שובץ במשמרת סופ\"ש (סוף הטווח)", out.wknd, String(out.wknd));
record("לא שובץ ביום שני (מחוץ לטווח)", out.notMon, String(out.notMon));
record("לא שובץ ביום ראשון (מחוץ לטווח)", out.notSun, String(out.notSun));
record("כל שיבוץ מתויג במזהה טווח", out.tagged, String(out.tagged));
record("שיבוץ חוזר של אותו טווח אינו מכפיל", out.noDup, String(out.noDup));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
