/* ============================================================
   מפעיל הסוכנים — דוח יומי, טייסת 124
   ------------------------------------------------------------
   נקודת הכניסה היחידה. אחריות: תזמור (orchestrator) + בניית
   דוח (report) + מגמות בין ריצות (lib/state) + כתיבת קבצים.
   מי בודק מה מוגדר במקום אחד: qa/registry.mjs.

   הרצה:  node qa/run_daily.mjs
   פלט:   qa/reports/YYYY-MM-DD.md  (+ הדפסה למסך)
   קוד יציאה: 1 אם יש ממצא חמור, 0 אחרת.
   ============================================================ */
import { writeFileSync, mkdirSync } from 'fs';
import { closeBrowser } from './lib/harness.mjs';
import { ROOT } from './lib/pw.mjs';
import { runAllAgents } from './orchestrator.mjs';
import { buildPublicReport, buildPersonalAddendum } from './report.mjs';
import { annotateTrend } from './lib/state.mjs';

const t0 = Date.now();
const stamp = new Date().toISOString().slice(0,10);

const sections = await runAllAgents();
await closeBrowser();

/* מגמות: מסמן כל ממצא ציבורי כ-🆕 חדש / ↔ ממשיך, ומעדכן qa/reports/state.json.
   רק ממצאים ציבוריים נכנסים למעקב — לעולם לא נתוני הטייסת החיים (ר' lib/state.mjs). */
const resolved = annotateTrend(sections, stamp);

const { md, push, high } = buildPublicReport(sections, { resolvedCount: resolved.length });

mkdirSync(`${ROOT}/qa/reports`, {recursive:true});
writeFileSync(`${ROOT}/qa/reports/${stamp}.md`, md, 'utf8');
writeFileSync(`${ROOT}/qa/reports/latest.md`, md, 'utf8');

/* הדוח האישי = דוח הקוד + פרק הנתונים החיים. ⚠️ פרטיות — המאגר ציבורי:
   הפרק הזה נגזר לפי section.privacy==="personal" (ר' report.mjs), ולכן
   הוא היחיד שמכיל פרטי טייסת — ולכן לעולם לא נכנס לדוח הציבורי למעלה. */
const { addendum, highFindings: liveHigh, skipped: liveSkipped } = buildPersonalAddendum(sections);
const personal = md + addendum;
writeFileSync(`${ROOT}/qa/reports/latest_personal.md`, personal, 'utf8');

const allHigh = [...high, ...liveHigh];
const pushText = liveHigh.length
  ? `⚠️ אפליקציית טייסת 124 — ${allHigh.length} ${allHigh.length===1?'תקלה':'תקלות'}\n` +
    allHigh.slice(0,3).map((f,i)=>`${i+1}. ${f.title}`).join('\n') + `\nהפירוט בדוח המצורף.`
  : push;
writeFileSync(`${ROOT}/qa/reports/latest_push.txt`, pushText, 'utf8');

console.log(personal);

/* שורת אבחון בטוחה ללוג. הלוג של מאגר ציבורי גלוי לכולם, ולכן
   מדווחים כאן רק על מצב החיבור וכמות הממצאים — בלי שום פרט על
   הטייסת עצמה (לא שמות מסגרות, לא מספרים, לא כותרות). */
const dataSection = sections.find(s=>s.domain==='data');
if(dataSection){
  const state = liveSkipped ? "לא הוגדר מפתח"
    : dataSection.findings.some(f=>f.title.includes("החיבור ל-Firebase נכשל")) ? "החיבור נכשל"
    : "התחבר בהצלחה";
  console.error(`[נתונים חיים: ${state} · ${liveHigh.length} ממצאים חמורים]`);
}
console.error(`[דוח נשמר · ${Math.round((Date.now()-t0)/1000)} שניות]`);
process.exit(allHigh.length ? 1 : 0);
