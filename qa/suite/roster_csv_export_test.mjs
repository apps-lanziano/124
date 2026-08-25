/* ייצוא לוח צוות ל-CSV — כפתור "⬇️" בכותרת "מסך מלא" (לא בלוח השבועי
   הרגיל, ששם השמות מקוצרים ל-shortName ולא מתאימים לרשומה רשמית).
   buildRosterCsvFromTable קורא ישירות מהטבלה שכבר מרונדרת ב-DOM — לא בונה
   מחדש את לוגיקת ה-shown/disabledRows — כך שה-CSV תמיד תואם בדיוק את מה
   שמוצג על המסך, כולל שורות מותאמות-אישית ותאים עם כמה שמות (chips). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // מ"ע התורנויות בפועל (ברירת המחדל ב-ROSTER_MANAGERS_DEFAULT) — כדי
  // ש-isRosterManager יהיה true (מפקד-הבדיקה הרגיל אינו ברשימה).
  user = "טל מלכה";
  await refreshAreaPermissions();

  const draft = migrateRosterToV2(null);
  const mon = draft.days["שני"];
  mon.lead = "חייל ב סככה 1"; mon.tools = "חייל ג, עם פסיק";
  mon.pf = [{name:"חייל א סככה 1"}, {name:"חייל ד סככה 1", course:true}];
  mon.reserve = ["מיל בדיקה"];
  await saveDutyRosterV2(draft);

  go("scr-board", null);
  await renderBoard();
  setRosterView("board"); await renderRosterView();
  await openRosterFull();

  r.hasExportBtn = !!document.querySelector('#roster-full button[onclick="exportRosterBoardCsv()"]');

  const table = document.querySelector("#roster-full-inner .roster-grid");
  const csv = buildRosterCsvFromTable(table);
  r.csv = csv;
  r.hasBom = csv.charCodeAt(0) === 0xFEFF;
  r.hasLeadName = csv.includes("חייל ב סככה 1");
  r.hasPfNames = csv.includes("חייל א סככה 1") && csv.includes("חייל ד סככה 1");
  r.pfJoinedWithPipe = /חייל א סככה 1.*\|.*חייל ד סככה 1/.test(csv);
  r.hasReserve = csv.includes("מיל בדיקה");
  // שם עם פסיק — חייב לצאת מגורש (quoted) כדי לא לשבור את מבנה ה-CSV
  r.commaNameQuoted = csv.includes('"חייל ג, עם פסיק"');
  r.rowCount = csv.split("\n").length;
  const headerCols = table.querySelectorAll("thead th").length;
  r.headerColsMatchCsv = csv.split("\n")[0].split(",").length === headerCols;

  return r;
});

record("כפתור ייצוא CSV מוצג בתצוגת לוח שבועי", out.hasExportBtn === true, out.hasExportBtn);
record("ה-CSV מתחיל ב-BOM (עברית תיפתח נכון ב-Excel)", out.hasBom === true, out.hasBom);
record("שם ר״צ מופיע ב-CSV", out.hasLeadName === true, out.hasLeadName);
record("שמות PF (כמה שמות באותו תא) מופיעים ב-CSV", out.hasPfNames === true, out.hasPfNames);
record("כמה שמות באותו תא מאוחדים ב-|", out.pfJoinedWithPipe === true, out.pfJoinedWithPipe);
record("שם מילואים מופיע ב-CSV", out.hasReserve === true, out.hasReserve);
record("שם עם פסיק יוצא מגורש (לא שובר את מבנה ה-CSV)", out.commaNameQuoted === true, out.commaNameQuoted);
record("מספר העמודות בשורת הכותרת תואם למספר עמודות הטבלה", out.headerColsMatchCsv === true, `${out.rowCount} rows`);

await closeBrowser();

console.log("=== SUMMARY ===");
let allPass = true;
for(const t of results){
  console.log(`${t.pass ? "✅" : "❌"} ${t.name}${t.pass ? "" : " - " + JSON.stringify(t.detail)}`);
  if(!t.pass) allPass = false;
}
if(!allPass){ console.log("\n=== FULL CSV ===\n" + out.csv); }
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass ? 0 : 1);
