/* ============================================================
   סוכן 3 — שיפור, ייעול ושדרוג
   ------------------------------------------------------------
   מחפש הזדמנויות לשפר ביצועים, לצמצם סיכון ולנקות קוד — וכן
   שומר על תיקונים קריטיים שכבר בוצעו, כדי שלא יחזרו בדלת האחורית:
     · "כתיבה עיוורת" של רשימת הצוות (הבאג שמחק PIN-ים)
     · "כשל שמירה שקט שמוצג כהצלחה" (הבאג שהעלים קרא-וחתום)
     · "דגל חד-פעמי בלי הגנה מפני כשל קריאה חולף" (הבאג שדרס נתוני סככה 2 —
       ראו migrateLegacyShed2, commit 4ec3d73)
   שלוש הבדיקות האלה הן רגרסיה-שומרת: הן ייכשלו אם מישהו יוסיף
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

/* ---------- שמירה על התיקון: דגל חד-פעמי בלי הגנה מפני כשל קריאה חולף ---------- */
{
  // דגל "כבר בוצע" (מיגרציה/זריעה חד-פעמית) שנקרא פעם אחת בלי retry ובלי
  // בדיקת fbReadFailed חשוף לכשל רשת/מרוץ טוקן רגעי: הפונקציה תפרש את זה
  // כ"עוד לא בוצע" ותרוץ שוב — בדיוק הבאג שדרס נתונים חיים בסככה 2
  // (migrateLegacyShed2, commit 4ec3d73). כדי לאתר כל מופע במדויק, מוצאים
  // את גוף כל פונקציה בפועל (התאמת סוגריים מודעת למחרוזות/הערות), לא רק
  // "עד הפונקציה הבאה" כמו בבדיקת "פונקציות ארוכות" — אחרת יתקבלו טווחים
  // שגויים שבולעים כמה פונקציות יחד.
  function findMatchingBrace(src, openIdx){
    let depth = 0;
    for(let i=openIdx; i<src.length; i++){
      const c = src[i];
      if(c === '/' && src[i+1] === '/'){ const nl = src.indexOf('\n', i); i = (nl<0 ? src.length : nl); continue; }
      if(c === '/' && src[i+1] === '*'){ const endc = src.indexOf('*/', i+2); i = (endc<0 ? src.length : endc+1); continue; }
      if(c === '"' || c === "'"){
        const quote = c; i++;
        while(i<src.length && src[i] !== quote){ if(src[i]==='\\') i++; i++; }
        continue;
      }
      if(c === '`'){
        i++; let tdepth = 0;
        while(i<src.length){
          if(src[i]==='\\'){ i++; }
          else if(src[i]==='`' && tdepth===0){ break; }
          else if(src[i]==='$' && src[i+1]==='{'){ tdepth++; i++; }
          else if(src[i]==='}' && tdepth>0){ tdepth--; }
          i++;
        }
        continue;
      }
      if(c === '{') depth++;
      else if(c === '}'){ depth--; if(depth===0) return i; }
    }
    return -1;
  }
  const funcRe = /(?:^|\n)(async\s+function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*)\{/g;
  let m; const risky = [];
  while((m = funcRe.exec(html))){
    const name = m[2];
    const openBrace = m.index + m[1].length;
    const closeBrace = findMatchingBrace(html, openBrace);
    if(closeBrace<0) continue;
    const body = html.slice(openBrace+1, closeBrace);
    // דגל חד-פעמי: קריאת sGetRaw שמיד נבדקת כתנאי יציאה מוקדמת ("if(דגל) return")
    const hasFlagGuard = /await\s+sGetRaw\([^)]*\)\s*;?\s*\n?\s*if\s*\([^)]*\)\s*return|if\s*\(\s*!?\(?\s*await\s+sGetRaw\(/.test(body);
    if(!hasFlagGuard) continue;
    if(/fbReadFailed|onceFlagDone\(/.test(body)) continue;   // כבר מוגן (ישירות או דרך ההלפר)
    risky.push({name, at: lineOf(m.index)});
  }
  if(risky.length){
    add("high", "דגל חד-פעמי (מיגרציה/זריעה) בלי הגנה מפני כשל קריאה חולף",
      `${risky.length} פונקציות בודקות דגל "כבר בוצע" בלי ניסיון חוזר/בדיקת fbReadFailed: ` +
      risky.slice(0,10).map(r=>`${r.name} (שורה ${r.at})`).join(", ") + (risky.length>10?"…":"") +
      `. כשל רשת רגעי בדיוק ברגע הבדיקה יגרום לפונקציה לחשוב שהיא רצה לראשונה ולהריץ מיגרציה/זריעה שוב — ` +
      `סיכון לדריסה או להחייאת נתונים ישנים/מחוקים (ראו migrateLegacyShed2, commit 4ec3d73 — שם זה קרה בפועל).`);
  } else {
    add("info", "דגלי מיגרציה/זריעה חד-פעמיים מוגנים מפני כשל קריאה חולף",
      "כל הפונקציות שבודקות דגל \"כבר בוצע\" מתייחסות ל-fbReadFailed לפני שהן מחליטות לרוץ מחדש.");
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
