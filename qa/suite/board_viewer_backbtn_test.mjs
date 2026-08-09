/* משוב משתמש: הכפתור האדום הצף "לדשבורד" (#back-to-dash) מרחף מעל תצוגת
   תמונת לוח הצוות ולחיצה עליו לא סוגרת אותה — "נראה שלא עושה כלום".
   התיקון: מסתירים אותו כל עוד תצוגת התמונה פתוחה, ומחזירים בסגירה.
   בדיקה התנהגותית אמיתית דרך ה-harness (פותח את התצוגה בפועל). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();

// מפקד סככה — יש לו דשבורד, ולכן #back-to-dash רלוונטי עבורו
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const bd = document.getElementById("back-to-dash");
  // מוודאים מצב התחלתי: הכפתור יכול להיות מוצג (מפקד לא במסך הדשבורד)
  // פותחים את מסך הלוח ואז את תצוגת התמונה של הלוח הזרוע בהרנס
  go("scr-board", document.querySelector('[data-scr="scr-board"]'));
  await openBoardViewer("board_seed_1");
  const viewerOpen = document.getElementById("board-viewer").classList.contains("open");
  const hiddenWhileOpen = bd ? bd.style.display === "none" : null;
  // סוגרים ומוודאים שהשליטה חוזרת ל-class (אין יותר display:none מוטבע)
  closeBoardViewer();
  const restoredAfterClose = bd ? bd.style.display !== "none" : null;
  const viewerClosed = !document.getElementById("board-viewer").classList.contains("open");
  return { viewerOpen, hiddenWhileOpen, restoredAfterClose, viewerClosed };
});

record("התחברות מפקד הצליחה", login.ok, JSON.stringify(login));
record("תצוגת תמונת הלוח נפתחה בפועל", out.viewerOpen, JSON.stringify(out));
record("הכפתור האדום מוסתר כל עוד תצוגת התמונה פתוחה", out.hiddenWhileOpen===true, JSON.stringify(out));
record("בסגירת התצוגה השליטה על הכפתור חוזרת (אין display:none מוטבע)", out.restoredAfterClose===true, JSON.stringify(out));
record("התצוגה נסגרה בפועל", out.viewerClosed, JSON.stringify(out));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
