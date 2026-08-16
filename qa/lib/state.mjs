/* ============================================================
   זיכרון בין ריצות — מגמות לממצאים
   ------------------------------------------------------------
   בלי זה, הדוח היומי הוא רשימה שחוזרת על עצמה: אותה "פונקציה
   ארוכה מדי" מופיעה שוב ושוב בלי שום אינדיקציה אם היא חדשה או
   נגררת כבר שבועות. כאן אנחנו מטביעים חתימה יציבה לכל ממצא
   ושומרים אותה ב-qa/reports/state.json (קובץ שנשמר במאגר, בדיוק
   כמו qa/reports/latest.md, כדי שהמצב יישרד בין ריצות ה-Action).

   ⚠️ מעקב רק על ממצאים ציבוריים (agent.privacy==="public").
   ממצאי "נתונים חיים" (Firebase אמיתי) לעולם לא נכנסים לקובץ
   הזה — הוא נשמר במאגר הציבורי, ואסור שיכיל רמז על נתוני הטייסת.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { ROOT } from './repo-root.mjs';

const STATE_PATH = `${ROOT}/qa/reports/state.json`;

function fingerprint(agentId, finding){
  return createHash('sha1').update(`${agentId}|${finding.title}`).digest('hex').slice(0,12);
}

function loadState(){
  if(!existsSync(STATE_PATH)) return {};
  try{ return JSON.parse(readFileSync(STATE_PATH, 'utf8')); }
  catch{ return {}; }
}

function saveState(state){
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function daysSince(iso){
  const then = Date.parse(iso);
  if(Number.isNaN(then)) return 0;
  return Math.max(0, Math.round((Date.now() - then) / 86400000));
}

/* מסמנת כל ממצא ציבורי (לא info) כ-new/continuing, כותבת state.json
   מעודכן, ומחזירה רשימת ממצאים שהיו אתמול ונעלמו היום (=כנראה נפתרו). */
export function annotateTrend(sections, todayISO){
  const prevState = loadState();
  const nextState = {};

  for(const s of sections){
    if(s.privacy !== 'public') continue;
    for(const f of s.findings){
      if(f.sev === 'info') continue;
      const fp = fingerprint(s.id, f);
      const prev = prevState[fp];
      const since = prev ? prev.since : todayISO;
      f.trend = prev ? 'continuing' : 'new';
      f.trendDays = daysSince(since);
      nextState[fp] = { since, last: todayISO, title: f.title, agent: s.id };
    }
  }

  const resolved = Object.keys(prevState)
    .filter(fp => !(fp in nextState))
    .map(fp => prevState[fp]);

  saveState(nextState);
  return resolved;
}
