/* משוב משתמש (כל המסגרות): לא ניתן ללחוץ על "אישור קריאה" בקרא-וחתום.
   הסיבה: פקד הזום של התמונה (.doc-zoom-ctrl) היה ממוקם absolute יחסית
   ל-#doc-reader כולו (כי ל-.reader-body אין הורה ממוקם), ולכן נצמד
   לתחתית המסך *מעל* כפתור "אישור קריאה" וחסם אותו. התיקון: עוטפים את
   אזור התמונה ב-.doc-zoom-frame (position:relative) כך שהפקד צף מעל
   התמונה ולא מעל הכפתור. בדיקה התנהגותית אמיתית דרך ה-harness. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "חייל");

const out = await page.evaluate(async ()=>{
  await openReader("ev_seed_1");   // אירוע קרא-וחתום מסוג תמונה שנזרע ב-harness
  const readerOpen = document.getElementById("doc-reader").classList.contains("open");
  const btn = document.getElementById("reader-confirm");
  const ctrl = document.querySelector(".doc-zoom-ctrl");
  const bd = document.getElementById("back-to-dash");

  const cs = btn ? getComputedStyle(btn) : null;
  const btnVisible = !!btn && cs.display !== "none" && !btn.disabled && btn.offsetParent !== null;

  const rectsOverlap = (a, b)=>{
    if(!a || !b) return false;
    return !(a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left);
  };
  const btnRect = btn ? btn.getBoundingClientRect() : null;
  const ctrlRect = ctrl ? ctrl.getBoundingClientRect() : null;
  const overlap = rectsOverlap(btnRect, ctrlRect);

  // הבדיקה המכרעת: מה נמצא בפועל בנקודת המרכז של כפתור האישור?
  let topAtCenter = null;
  if(btnRect){
    const el = document.elementFromPoint((btnRect.left+btnRect.right)/2, (btnRect.top+btnRect.bottom)/2);
    topAtCenter = el ? (el.id || el.className || el.tagName) : null;
    // האם ה-hit הוא הכפתור עצמו או צאצא שלו
    topAtCenter = (el === btn || (el && btn.contains(el))) ? "reader-confirm" : topAtCenter;
  }
  const bdHidden = bd ? bd.style.display === "none" : null;
  return { readerOpen, btnVisible, overlap, topAtCenter, bdHidden };
});

record("התחברות חייל הצליחה", login.ok, JSON.stringify(login));
record("קורא הקרא-וחתום נפתח", out.readerOpen, JSON.stringify(out));
record("כפתור \"אישור קריאה\" מוצג, פעיל ולחיץ", out.btnVisible, JSON.stringify(out));
record("פקד הזום כבר לא חופף לכפתור האישור", out.overlap === false, JSON.stringify(out));
record("במרכז כפתור האישור נמצא הכפתור עצמו (לא פקד הזום שמעליו)", out.topAtCenter === "reader-confirm", JSON.stringify(out));
record("הכפתור האדום הצף מוסתר כל עוד הקורא פתוח", out.bdHidden === true, JSON.stringify(out));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
