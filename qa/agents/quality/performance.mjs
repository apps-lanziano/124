/* ============================================================
   אגף איכות וביצועים · ביצועים
   ------------------------------------------------------------
   קריאות אחסון סדרתיות בתוך לולאה (מסכים כבדים) וגודל הקובץ.
   ============================================================ */
import { readFileSync } from 'fs';
import { ROOT } from '../../lib/repo-root.mjs';

const html = readFileSync(`${ROOT}/index.html`, 'utf8');
function lineOf(idx){ return html.slice(0, idx).split('\n').length; }

function scan(){
  const findings = [];
  const add = (sev, title, detail) => findings.push({sev, area:"ביצועים", title, detail, where:"index.html"});

  /* ---------- קריאות רשת סדרתיות בתוך לולאה ---------- */
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

  return findings;
}

const agent = {
  id: 'quality/performance',
  name: 'ביצועים',
  kind: 'static',
  domain: 'quality',
  privacy: 'public',
  async run(){
    const findings = scan();
    const bySev = s => findings.filter(f=>f.sev===s).length;
    return { summary:{ med:bySev("med"), info:bySev("info") }, findings };
  }
};
export default agent;

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await agent.run();
  console.log(JSON.stringify(r, null, 2));
}
