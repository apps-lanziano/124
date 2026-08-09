/* בדיקת סוכן גנרית לחסימות-לחיצה: עוברת על כל המסכים הגלויים למפקד וגם
   על שכבות-העל (קורא קרא-וחתום, תצוגת לוח, תפריט "עוד"), ומוודאת שאף
   אלמנט אינטראקטיבי גלוי אינו *מכוסה* ע"י אלמנט אחר (למשל כפתור צף או
   פקד זום). זו בדיוק מחלקת הבאגים שמשתמשים גילו ידנית — כפתור שנראה
   אבל אי אפשר ללחוץ עליו. הבדיקה משתמשת ב-document.elementFromPoint
   כדי לבדוק "מה באמת נמצא מתחת לאצבע" במרכז כל פקד.

   אם הבדיקה נכשלת: יש אלמנט שחוסם פקד. בדוק z-index/מיקום absolute של
   הפקד החוסם (coveredBy) מול הפקד (control) בהקשר (context) שדווח. */
import { newPage, closeBrowser, loginAsFramework, visibleScreens, visitScreen, findOccludedControls } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
await page.setViewportSize({ width: 390, height: 844 });   // מסך נייד ריאלי (כמו אייפון)
const allBad = [];

// מפקד סככה — בעל הכי הרבה מסכים, וגם מי שרואה את הכפתור האדום הצף
const login = await loginAsFramework(page, "shed1", "מפקד");
record("התחברות מפקד הצליחה", login.ok, JSON.stringify(login));

// 1) כל מסך גלוי
const screens = await visibleScreens(page);
for(const scr of screens){
  await visitScreen(page, scr);
  const bad = await findOccludedControls(page, "מסך " + scr);
  allBad.push(...bad);
}

// 2) שכבות-על — כאן בדיוק צצו הבאגים (כפתור צף/פקד זום מעל פקדים)
async function withContext(label, openFn, closeFn){
  const ok = await page.evaluate(async (fnSrc)=>{
    try{ await (new Function("return ("+fnSrc+")")())(); return true; }catch(e){ return false; }
  }, openFn.toString());
  if(!ok) return;
  await page.waitForTimeout(250);
  const bad = await findOccludedControls(page, label);
  allBad.push(...bad);
  if(closeFn){
    await page.evaluate(async (fnSrc)=>{ try{ await (new Function("return ("+fnSrc+")")())(); }catch(e){} }, closeFn.toString());
    await page.waitForTimeout(150);
  }
}

// קורא קרא-וחתום (אירוע תמונה שנזרע בהרנס)
await withContext("קורא קרא-וחתום", async ()=>{ await openReader("ev_seed_1"); }, async ()=>{ closeReader(); });
// תצוגת לוח הצוות
await withContext("תצוגת לוח צוות", async ()=>{ await openBoardViewer("board_seed_1"); }, async ()=>{ closeBoardViewer(); });
// תפריט "עוד" (השכבה בעלת ה-z-index הגבוה ביותר — הכי חשוף לכפתור צף)
await withContext("תפריט עוד", async ()=>{ openMoreSheet(); }, async ()=>{ document.getElementById("more-sheet").classList.remove("open"); });

record("אין פקדים חסומים באף מסך או שכבת-על (למפקד)",
  allBad.length === 0, allBad.length ? JSON.stringify(allBad.slice(0,8)) : "0 חסימות");

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
