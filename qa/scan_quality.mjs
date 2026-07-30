/* ============================================================
   סוכן 3 — שיפור, ייעול ושדרוג
   ------------------------------------------------------------
   מחפש הזדמנויות לשפר ביצועים, לצמצם סיכון ולנקות קוד — וכן
   שומר על תיקונים קריטיים שכבר בוצעו, כדי שלא יחזרו בדלת האחורית:
     · "כתיבה עיוורת" של רשימת הצוות (הבאג שמחק PIN-ים)
     · "כשל שמירה שקט שמוצג כהצלחה" (הבאג שהעלים קרא-וחתום)
   שתי הבדיקות האלה הן רגרסיה-שומרת: הן ייכשלו אם מישהו יוסיף
   בעתיד קוד שחוזר על אותה תבנית.
   ============================================================ */
import { readFileSync } from 'fs';

import { ROOT } from './lib/pw.mjs';   // שורש המאגר — נגזר, לא מקובע
const html = readFileSync(`${ROOT}/index.html`, 'utf8');
const findings = [];
function add(sev, title, detail, where="index.html"){ findings.push({sev, area:"שיפור", title, detail, where}); }
function lineOf(idx){ return html.slice(0, idx).split('\n').length; }

/* ---------- שמירה על התיקון: כתיבה עיוורת של רשימת הצוות ---------- */
{
  // כל כתיבה של המשתנה הגלובלי PERSONNEL היישר לאחסון היא בדיוק הבאג
  // שמחק PIN-ים. הדרך הבטוחה היחידה היא mutatePersonnel().
  const all = [...html.matchAll(/sSet(?:In)?\s*\([^)]*["']cfg_personnel["']\s*,\s*PERSONNEL\s*\)/g)];
  // נתיב הזריעה (רשימה ריקה -> זריעה ראשונית) אינו "דריסה": אין מה לדרוס.
  const bad = all.filter(m => !/PERSONNEL_SEED/.test(html.slice(Math.max(0,m.index-200), m.index+50)));
  if(bad.length){
    add("high", "חזרה של הבאג שמחק PIN-ים: כתיבה עיוורת של רשימת הצוות",
      `נמצאו ${bad.length} מקומות שכותבים את PERSONNEL שבזיכרון ישירות (שורות ${bad.map(b=>lineOf(b.index)).join(", ")}). ` +
      `זה דורס שינויים שמכשירים אחרים ביצעו — בדיוק מה שמחק PIN-ים לחיילים. יש להשתמש ב-mutatePersonnel().`);
  } else {
    add("info", "ההגנה על רשימת הצוות במקומה", "אין כתיבות עיוורות של PERSONNEL — כל השמירות עוברות דרך mutatePersonnel().");
  }
}

/* ---------- שמירה על התיקון: כשל שמירה שקט ---------- */
{
  // sSetSafe/sSetRaw/sSetIn שתוצאתם לא נבדקת בשום צורה, בתוך פונקציית שמירה
  // שאחריה מוצגת הודעת הצלחה — התבנית שהעלימה קרא-וחתום ולוח צוות.
  const alwaysTrue = /catch\s*\([^)]*\)\s*\{[^}]*return\s+true\s*;?\s*\}/g;
  const hits = [...html.matchAll(alwaysTrue)];
  if(hits.length){
    add("high", "חזרה של הבאג של 'כשל שקט = נראה כהצלחה'",
      `נמצאה פונקציה שמחזירה true בתוך catch (שורה ${lineOf(hits[0].index)}). ` +
      `משמעות: כשל אמיתי מדווח כהצלחה, והמשתמש חושב שהמידע נשמר.`);
  } else {
    add("info", "ההגנה על יושרת השמירה במקומה", "אין catch שמחזיר true — כשלי שמירה מדווחים כפי שהם.");
  }
}

/* ---------- ביצועים: קריאות רשת סדרתיות בתוך לולאה ---------- */
{
  // await בתוך for/forEach על פני מסגרות/אנשים = עשרות קריאות סדרתיות.
  // המרה ל-Promise.all מקצרת מסכים כבדים פי כמה.
  const re = /for\s*\(\s*const\s+\w+\s+of\s+(SHEDS|PERSONNEL|personnel|list|items)\b[^)]*\)\s*\{([\s\S]{0,600}?)\n\s{2,4}\}/g;
  let m; const slow = [];
  while((m = re.exec(html))){
    const body = m[2];
    const awaits = (body.match(/await\s+sGet|await\s+sSet/g) || []).length;
    if(awaits >= 2) slow.push({line: lineOf(m.index), awaits, over:m[1]});
  }
  if(slow.length){
    add("med", "קריאות אחסון סדרתיות בתוך לולאה — מאט מסכים",
      `${slow.length} לולאות עם קריאות סדרתיות (למשל שורה ${slow[0].line}: ${slow[0].awaits} קריאות לכל פריט ב-${slow[0].over}). ` +
      `המרה ל-Promise.all תקצר את זמן הטעינה משמעותית במסכים כלל-טייסתיים.`);
  }
}

/* ---------- גודל הקובץ ---------- */
{
  const kb = Math.round(Buffer.byteLength(html)/1024);
  const lines = html.split('\n').length;
  const sev = kb > 900 ? "med" : "info";
  add(sev, "גודל האפליקציה",
    `${kb} KB, ${lines.toLocaleString('he-IL')} שורות בקובץ יחיד. ` +
    (kb > 900
      ? "מעל 900KB — כל טעינה ראשונה מורידה את הכל. שווה לשקול פיצול ה-CSS/JS לקבצים נפרדים שנשמרים במטמון בנפרד."
      : "סביר לקובץ יחיד. מעקב בלבד."));
}

/* ---------- קוד מת ---------- */
{
  const declared = [...html.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
  const dead = [];
  for(const name of new Set(declared)){
    // ספירת אזכורים מחוץ להגדרה עצמה (כולל onclick= בתוך HTML)
    const uses = (html.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
    if(uses <= 1) dead.push(name);
  }
  if(dead.length){
    add("low", "פונקציות שלא נקראות מאף מקום",
      `${dead.length} פונקציות: ${dead.slice(0,8).join(", ")}${dead.length>8?"…":""}. ` +
      `מועמדות למחיקה — פחות קוד, פחות מקום לטעות.`);
  }
}

/* ---------- נגישות ---------- */
{
  const imgs = [...html.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)];
  if(imgs.length) add("low","תמונות ללא alt", `${imgs.length} תגיות img בלי alt — פוגע בקוראי מסך.`);
  const inputs = [...html.matchAll(/<input\b(?![^>]*(?:aria-label|placeholder|id=))[^>]*>/g)];
  if(inputs.length) add("low","שדות קלט ללא תיאור", `${inputs.length} שדות בלי aria-label/placeholder/id.`);
}

/* ---------- סימוני עבודה שנשארו ---------- */
{
  const todos = [...html.matchAll(/\/\/\s*(TODO|FIXME|HACK|XXX)\b[^\n]{0,90}/gi)];
  if(todos.length) add("low","סימוני TODO/FIXME בקוד",
    `${todos.length} מופעים. לדוגמה שורה ${lineOf(todos[0].index)}: ${todos[0][0].trim().slice(0,80)}`);
}

/* ---------- פונקציות ארוכות מדי ---------- */
{
  const re = /(?:^|\n)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  let m; const long = [];
  while((m = re.exec(html))){
    // מדידה גסה: עד הפונקציה הבאה
    const start = m.index;
    const next = html.indexOf("\nfunction ", start+10);
    const nextAsync = html.indexOf("\nasync function ", start+10);
    const end = Math.min(next<0?Infinity:next, nextAsync<0?Infinity:nextAsync);
    const len = (end===Infinity ? html.length : end) - start;
    const nl = html.slice(start, start+len).split('\n').length;
    if(nl > 120) long.push({name:m[1], lines:nl, at:lineOf(start)});
  }
  if(long.length){
    long.sort((a,b)=>b.lines-a.lines);
    add("low","פונקציות ארוכות מאוד",
      `${long.length} פונקציות מעל 120 שורות. הארוכות: ` +
      long.slice(0,3).map(f=>`${f.name} (${f.lines} שורות, שורה ${f.at})`).join(", ") +
      `. פיצול יקל על תחזוקה ויקטין סיכון לבאגים.`);
  }
}

export async function run(){
  const bySev = s => findings.filter(f=>f.sev===s).length;
  return {
    name: "שיפור וייעול",
    summary: { high:bySev("high"), med:bySev("med"), low:bySev("low"), info:bySev("info") },
    findings,
  };
}

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await run();
  console.log(JSON.stringify(r, null, 2));
}
