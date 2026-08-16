/* ============================================================
   אגף אבטחה · שומרי תיקונים קריטיים
   ------------------------------------------------------------
   שלוש הבדיקות האלה עברו לכאן מאגף האיכות: הן לא קוסמטיקה —
   הן שומרות על תיקוני נכונות/אבטחה קריטיים שכבר נכשלו בעבר
   בייצור, כדי שלא יחזרו בדלת האחורית:
     · "כתיבה עיוורת" של רשימת הצוות (הבאג שמחק PIN-ים)
     · "כשל שמירה שקט שמוצג כהצלחה" (הבאג שהעלים קרא-וחתום)
     · "דגל חד-פעמי בלי הגנה מפני כשל קריאה חולף" (הבאג שדרס נתוני
       סככה 2 — ראו migrateLegacyShed2, commit 4ec3d73)
   הן רגרסיה-שומרת: ייכשלו אם מישהו יוסיף בעתיד קוד שחוזר על
   אותה תבנית.
   ============================================================ */
import { readFileSync } from 'fs';
import { ROOT } from '../../lib/repo-root.mjs';

const html = readFileSync(`${ROOT}/index.html`, 'utf8');
function lineOf(idx){ return html.slice(0, idx).split('\n').length; }

function scan(){
  const findings = [];
  const add = (sev, title, detail) => findings.push({sev, area:"שומרי תיקונים", title, detail, where:"index.html"});

  /* ---------- כתיבה עיוורת של רשימת הצוות ---------- */
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

  /* ---------- כשל שמירה שקט ---------- */
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

  /* ---------- דגל חד-פעמי בלי הגנה מפני כשל קריאה חולף ---------- */
  {
    // דגל "כבר בוצע" (מיגרציה/זריעה חד-פעמית) שנקרא פעם אחת בלי retry ובלי
    // בדיקת fbReadFailed חשוף לכשל רשת/מרוץ טוקן רגעי: הפונקציה תפרש את זה
    // כ"עוד לא בוצע" ותרוץ שוב — בדיוק הבאג שדרס נתונים חיים בסככה 2
    // (migrateLegacyShed2, commit 4ec3d73). כדי לאתר כל מופע במדויק, מוצאים
    // את גוף כל פונקציה בפועל (התאמת סוגריים מודעת למחרוזות/הערות), לא רק
    // "עד הפונקציה הבאה" — אחרת יתקבלו טווחים שגויים שבולעים כמה פונקציות יחד.
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

  return findings;
}

const agent = {
  id: 'security/regression-guards',
  name: 'שומרי תיקונים קריטיים',
  kind: 'static',
  domain: 'security',
  privacy: 'public',
  async run(){
    const findings = scan();
    const bySev = s => findings.filter(f=>f.sev===s).length;
    return { summary:{ high:bySev("high"), med:bySev("med"), info:bySev("info") }, findings };
  }
};
export default agent;

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await agent.run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.findings.some(f=>f.sev==="high") ? 1 : 0);
}
