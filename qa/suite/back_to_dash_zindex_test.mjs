/* משוב משתמש (חוזר): הכפתור האדום הצף "לדשבורד" ריחף מעל חלונות, תפריט
   "עוד", הקורא ותצוגת הלוח, וחסם אותם — לחיצה עליו לא סגרה את השכבה
   ("לא עושה כלום"). השורש: z-index של #back-to-dash היה 60, גבוה מכל
   שכבות-העל. התיקון: להוריד אותו מתחת לכל שכבת-על ומעל המסך/הסרגל בלבד.
   בדיקת מקור: מוודאת את סדר ה-z-index הנכון כדי שהבאג לא יחזור. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const css = readFileSync(`${ROOT}/index.html`, 'utf8');

/* מחלץ את ערך ה-z-index של הסלקטור הראשון שתואם (מהבלוק שלו) */
function zIndexOf(selector){
  // בורח מתווים מיוחדים בסלקטור לצורך regex
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(esc + "\\s*\\{[^}]*?z-index:\\s*(\\d+)", "s");
  const m = re.exec(css);
  return m ? Number(m[1]) : null;
}

const zBack   = zIndexOf("#back-to-dash");
const zNav    = zIndexOf("nav");
const zModal  = zIndexOf(".modal-bg");
const zSheet  = zIndexOf(".sheet-bg");
const zReader = zIndexOf("#doc-reader");
const zBoard  = zIndexOf("#board-viewer");

record("נמצאו כל ערכי ה-z-index הנדרשים",
  [zBack,zNav,zModal,zSheet,zReader,zBoard].every(v=>typeof v==="number"),
  JSON.stringify({zBack,zNav,zModal,zSheet,zReader,zBoard}));

record("הכפתור מעל הסרגל התחתון (nav) — כדי שיישאר נגיש מעל המסך הרגיל",
  zBack > zNav, JSON.stringify({zBack, zNav}));

record("הכפתור מתחת לחלונות (.modal-bg) — לא מרחף מעליהם",
  zBack < zModal, JSON.stringify({zBack, zModal}));

record('הכפתור מתחת לתפריט "עוד" (.sheet-bg) — לא מרחף מעליו',
  zBack < zSheet, JSON.stringify({zBack, zSheet}));

record("הכפתור מתחת לקורא הקרא-וחתום (#doc-reader) — לא חוסם את כפתור האישור",
  zBack < zReader, JSON.stringify({zBack, zReader}));

record("הכפתור מתחת לתצוגת לוח הצוות (#board-viewer)",
  zBack < zBoard, JSON.stringify({zBack, zBoard}));

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
