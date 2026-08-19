/* משוב משתמש (חוזר): הכפתור האדום "לדשבורד" היה FAB עגול שצף מעל תוכן
   המסך (position:absolute + bottom/inset-inline-start), וחפף פריטי רשימה
   אחרונים במסכים כמו חדר כלים. התיקון: הכפתור עבר לגור בתוך ה-header
   הקבוע (מחוץ ל-main הגלילי) יחד עם פעמון ההתראות, בזרימת מסמך רגילה —
   ולכן לעולם לא יכול לרחף מעל תוכן, סרגל ניווט, או שכבות-על (חלונות,
   תפריט "עוד", הקורא, תצוגת הלוח), שכולן position:absolute + inset:0
   שמכסה את כל #app כולל ה-header.
   בדיקת מקור: מוודאת שהכפתור יושב בתוך ה-header ולא צף עצמאית עם
   position:absolute/fixed משלו, כדי שהבאג המקורי (חפיפה עם תוכן) לא יחזור. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const html = readFileSync(`${ROOT}/index.html`, 'utf8');

const headerMatch = /<header>([\s\S]*?)<\/header>/.exec(html);
const headerHtml = headerMatch ? headerMatch[1] : "";

record('הכפתור #back-to-dash ממוקם בתוך ה-header (לא צף מעל main)',
  headerHtml.includes('id="back-to-dash"'),
  headerHtml.includes('id="back-to-dash"') ? "found in header" : "not found in header");

record('הכפתור נמצא בתוך .hdr-actions יחד עם פעמון ההתראות',
  /<div class="hdr-actions">[\s\S]*?id="back-to-dash"[\s\S]*?alert-bell[\s\S]*?<\/div>/.test(headerHtml),
  "hdr-actions wraps back-to-dash + alert-bell");

function cssBlockOf(selector){
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(esc + "\\s*\\{([^}]*)\\}", "s");
  const m = re.exec(html);
  return m ? m[1] : null;
}

const backCss = cssBlockOf("#back-to-dash");
record("נמצא בלוק CSS עבור #back-to-dash", !!backCss, backCss ?? "missing");

record("הכפתור אינו position:absolute/fixed (לא יכול לרחף מעל תוכן/שכבות-על)",
  !!backCss && !/position\s*:\s*(absolute|fixed)/.test(backCss),
  backCss ?? "missing");

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
