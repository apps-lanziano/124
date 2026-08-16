/* ============================================================
   אגף איכות וביצועים · בריאות קוד
   ------------------------------------------------------------
   ניקיון בלבד — קוד מת, פונקציות ארוכות מדי, נגישות, סימוני
   TODO. שום ממצא כאן אינו נכונות/אבטחה (אלה עברו לאגף האבטחה,
   ר' security/regression-guards) — לכן חומרה מרבית כאן היא "low"
   ולא "high", כדי לא להשוות ניקיון קוד לכשל אמיתי.
   ============================================================ */
import { readFileSync } from 'fs';
import { ROOT } from '../../lib/repo-root.mjs';

const html = readFileSync(`${ROOT}/index.html`, 'utf8');
function lineOf(idx){ return html.slice(0, idx).split('\n').length; }

function scan(){
  const findings = [];
  const add = (sev, title, detail) => findings.push({sev, area:"בריאות קוד", title, detail, where:"index.html"});

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

  return findings;
}

const agent = {
  id: 'quality/code-health',
  name: 'בריאות קוד',
  kind: 'static',
  domain: 'quality',
  privacy: 'public',
  async run(){
    const findings = scan();
    const bySev = s => findings.filter(f=>f.sev===s).length;
    return { summary:{ low:bySev("low"), info:bySev("info") }, findings };
  }
};
export default agent;

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await agent.run();
  console.log(JSON.stringify(r, null, 2));
}
