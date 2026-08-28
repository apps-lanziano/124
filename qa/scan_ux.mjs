/* ============================================================
   סוכן 5 — UX ומוצר
   ------------------------------------------------------------
   מחפש באופן אקטיבי הזדמנויות שיפור בחוויית המשתמש — לא תקינות
   קוד (זה scan_quality.mjs) ולא רעיונות אנושיים (זה
   improvement_ideas.mjs), אלא דפוסים שאפשר לזהות אוטומטית מתוך
   הקוד עצמו ומעידים על חוויית משתמש חסרה:
     · פעולה הרסנית (מחיקה) בלי אישור מהמשתמש
     · פעולת שמירה/פרסום בלי שום משוב (toast) להצלחה/כישלון
     · כפתור אייקון-בלבד בלי תיאור טקסטואלי — לא ברור מה הוא עושה
   כל בדיקה כאן שומרת גם על תיקונים שכבר בוצעו, כדי שאותה בעיה לא
   תחזור בשקט דרך פונקציה חדשה.
   ============================================================ */
import { readFileSync } from 'fs';

import { ROOT } from './lib/pw.mjs';   // שורש המאגר — נגזר, לא מקובע
const html = readFileSync(`${ROOT}/index.html`, 'utf8');
const findings = [];
function add(sev, title, detail, where="index.html"){ findings.push({sev, area:"UX ומוצר", title, detail, where}); }
function lineOf(idx){ return html.slice(0, idx).split('\n').length; }

/* מוצא את הסוגר המתאים ל-{ שנפתח ב-openIdx, מודע למחרוזות/הערות/template
   literals — כדי לתחום גוף פונקציה במדויק (זהה בעיקרון ל-scan_quality.mjs). */
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

/* כל פונקציות המערכת עם גוף מדויק (שם -> {start, body}), לשימוש חוזר
   בכל הבדיקות למטה במקום למצוא כל אחת בנפרד. */
function allFunctionBodies(){
  const re = /(?:^|\n)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  const out = [];
  let m;
  while((m = re.exec(html))){
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = findMatchingBrace(html, openBrace);
    if(closeBrace<0) continue;
    out.push({ name: m[1], at: m.index, body: html.slice(openBrace+1, closeBrace) });
  }
  return out;
}
const FUNCS = allFunctionBodies();

/* ---------- פעולה הרסנית בלי אישור מהמשתמש ---------- */
{
  // כל פונקציה שהשם שלה מרמז על מחיקה (delete/remove/מחק) חייבת לבקש
  // אישור לפני שהיא פועלת — confirm(...) הוא הדפוס הקיים בכל הקוד
  // (45 מופעים). פונקציה כזו בלי confirm() משמעה: לחיצה אחת שלא ניתנת
  // לביטול, בלי שהמשתמש קיבל הזדמנות לחזור בו.
  const risky = FUNCS.filter(f =>
    /^(delete|remove)[A-Z]/.test(f.name) &&
    !/\bconfirm\s*\(/.test(f.body) &&
    // עטיפות דקות שמעבירות הלאה לפונקציה אחרת שכבר שואלת (restoreArchivedToSlot וכו')
    !/^(deleted?At|removedFrom)$/.test(f.name)
  );
  if(risky.length){
    add("med", "פעולת מחיקה בלי בקשת אישור מהמשתמש",
      `${risky.length} פונקציות ששמן מרמז על מחיקה, בלי confirm() בגוף שלהן: ` +
      risky.slice(0,10).map(r=>`${r.name} (שורה ${lineOf(r.at)})`).join(", ") + (risky.length>10?"…":"") +
      `. לחיצה אחת מוחקת נתונים בלי אפשרות להתחרט — כדאי לבדוק אם יש אישור בשכבה אחרת (למשל מודל ייעודי), ואם לא — להוסיף confirm() כמו בשאר פעולות המחיקה באפליקציה.`);
  } else {
    add("info", "כל פעולות המחיקה מבקשות אישור", "לא נמצאה פונקציית מחיקה בלי confirm() בגוף שלה.");
  }
}

/* ---------- שמירה/פרסום בלי שום משוב למשתמש ---------- */
{
  // פעולת שמירה/פרסום היא לרוב הרגע הכי חשוב למשתמש לדעת שהיא הצליחה —
  // או נכשלה. toast(...) הוא ערוץ המשוב הסטנדרטי בכל האפליקציה (344
  // מופעים). פונקציית save/update/publish בלי אף toast בגוף שלה עלולה
  // להשאיר משתמש לא בטוח אם השינוי שלו נקלט בכלל.
  // בכוונה רק save/publish, לא update* — יש מעט updateXxx באפליקציה
  // וכולם עדכוני תג/באדג' פנימיים ב-DOM, לא פעולת משתמש שדורשת משוב.
  const risky = FUNCS.filter(f =>
    /^(save|publish)[A-Z]/.test(f.name) &&
    !/\btoast\s*\(/.test(f.body) &&
    // פונקציות עזר פנימיות/דיפ בלי אינטראקציה ישירה של משתמש — לא רלוונטיות כאן
    !/^(saveDutyRosterV2|saveRosterCustomRowForm)$/.test(f.name)
  );
  if(risky.length){
    add("low", "פעולת שמירה/פרסום בלי הודעת משוב (toast) למשתמש",
      `${risky.length} פונקציות: ` +
      risky.slice(0,10).map(r=>`${r.name} (שורה ${lineOf(r.at)})`).join(", ") + (risky.length>10?"…":"") +
      `. ייתכן שהמשוב ניתן בדרך אחרת (רענון מסך, סגירת מודל) — כדאי לוודא שהמשתמש בכל זאת יודע אם השמירה הצליחה או נכשלה.`);
  }
}

/* ---------- כפתור אייקון-בלבד בלי תיאור טקסטואלי ---------- */
{
  // כפתור שכל התוכן שלו הוא סמלים/אימוג'ים בלי אף אות (עברית/לטינית),
  // ובלי title/aria-label — משתמש חדש לא יכול לדעת מה הוא עושה בלי
  // ללחוץ ולנסות. לא נבדק alt (זה img, לא button — כבר מכוסה ב-scan_quality).
  const btnRe = /<button\b([^>]*)>([^<]{1,6})<\/button>/g;
  let m; const bare = [];
  while((m = btnRe.exec(html))){
    const attrs = m[1], text = m[2].trim();
    if(!text) continue;
    if(/[A-Za-zא-ת]/.test(text)) continue;               // יש אות/מילה — מובן
    if(/\b(title|aria-label)\s*=/.test(attrs)) continue;  // כבר יש תיאור נגיש
    bare.push({ at: m.index, text });
  }
  if(bare.length){
    const uniq = [...new Map(bare.map(b=>[b.text,b])).values()];
    add("low", "כפתורי אייקון בלי תיאור נגיש (title/aria-label)",
      `${bare.length} כפתורים (${uniq.length} סוגי סמל) בלי title/aria-label, למשל "${uniq.slice(0,6).map(b=>b.text).join('", "')}". ` +
      `הוספת title="..." קצר עוזרת גם למשתמש חדש שמנחש מה הכפתור עושה, וגם לנגישות.`);
  } else {
    add("info", "לכפתורי האייקונים יש תיאור נגיש", "לא נמצאו כפתורי סמל-בלבד בלי title/aria-label.");
  }
}

export async function run(){
  const bySev = s => findings.filter(f=>f.sev===s).length;
  return {
    name: "UX ומוצר",
    summary: { high:bySev("high"), med:bySev("med"), low:bySev("low"), info:bySev("info") },
    findings,
  };
}

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await run();
  console.log(JSON.stringify(r, null, 2));
}
