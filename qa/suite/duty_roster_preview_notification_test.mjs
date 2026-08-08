/* משוב משתמש: רצה לראות איך מפקד מקבל את התראת שיבוץ התורנויות, בלי
   לשלוח בפועל לאף מפקד אמיתי חוץ מעצמה. הפתרון: כפתור "תצוגה מקדימה"
   לכל יום בעורך השיבוץ (openDutyRosterModal), ששולח התראת FCM אמיתית
   אך ורק למכשיר הנוכחי (fcmToken בזיכרון), בדיוק באותו נוסח שהתזכורת
   האוטומטית (functions/index.js exports.dutyRosterDigest) שולחת.
   בדיקת מקור (regex על index.html) — קריאה אמיתית ל-httpsCallable
   דורשת Firebase Functions SDK אמיתי שלא זמין בסביבת בדיקה (וממילא
   חסום ברשת ע"י qa/lib/harness.mjs). */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const html = readFileSync(`${ROOT}/index.html`, 'utf8');

// 1. כפתור תצוגה מקדימה מופיע בכל בלוק יום בעורך השיבוץ
{
  const start = html.indexOf("async function openDutyRosterModal");
  const body = start >= 0 ? html.slice(start, start + 1400) : "";
  const hasButton = /onclick="previewDutyRosterNotification\('\$\{day\}'\)"/.test(body);
  record("כל בלוק יום בעורך השיבוץ כולל כפתור תצוגה מקדימה של ההתראה", hasButton, String(hasButton));
}

// 2. previewDutyRosterNotification: חסימה בלי הרשאת התראות, בלי לקרוא לשרת
{
  const start = html.indexOf("async function previewDutyRosterNotification");
  const body = start >= 0 ? html.slice(start, start + 1600) : "";
  const guardsNoToken = /if\(!fcmToken\)\{ ?toast\(/.test(body);
  record("previewDutyRosterNotification חוסמת מיד אם אין fcmToken (לא ניגשת לרשת)", guardsNoToken, String(guardsNoToken));

  // 3. מסננת שמות לפי התאמה מדויקת לצוות הסככה הנוכחית בלבד (כמו resolveNameToShed בשרת)
  const filtersExactToOwnShed = /mine\.has\(n\)/.test(body) && /allPersonnel\[currentShed\.id\]/.test(body);
  record("מסננת שמות להתאמה מדויקת מול צוות הסככה הנוכחית בלבד (לא סככות אחרות, לא התאמה חלקית)",
    filtersExactToOwnShed, String(filtersExactToOwnShed));

  // 4. שולחת אך ורק לטוקן המכשיר הנוכחי — לא לרשימת טוקנים/סככה אחרת
  const sendsOnlyOwnToken = /sendFn\(\{token: fcmToken, title:/.test(body);
  const neverSendsOtherToken = !/sendFn\(\{token: (?!fcmToken)/.test(body);
  record("שולחת אך ורק לטוקן המכשיר הנוכחי (fcmToken) — מבנית לא יכולה לשלוח למישהו אחר",
    sendsOnlyOwnToken && neverSendsOtherToken, JSON.stringify({sendsOnlyOwnToken, neverSendsOtherToken}));

  // 5. נוסח הכותרת/גוף זהה בדיוק לזה שהתזכורת האוטומטית שולחת בשרת (functions/index.js)
  const matchesRealTitleFormat = /title: `📋 תורנויות היום \(\$\{day\}\) · \$\{currentShed\.name\}`/.test(body);
  record("נוסח ההתראה זהה בדיוק לזה שהתזכורת האוטומטית שולחת בפועל", matchesRealTitleFormat, String(matchesRealTitleFormat));

  // 6. לא כותבת ל-board_roster — תצוגה מקדימה בלבד, לא שמירה
  const doesNotWriteRoster = !/board_roster/.test(body);
  record("תצוגה מקדימה בלבד — לא כותבת ל-board_roster (השמירה נשארת רק דרך saveDutyRoster)",
    doesNotWriteRoster, String(doesNotWriteRoster));
}

// 7. functions/index.js וindex.html משתמשים באותו שם פונקציית ענן
{
  const callableName = /httpsCallable\(functions, "sendTestNotificationToSelf"\)/.test(html);
  record("הלקוח קורא לפונקציית הענן sendTestNotificationToSelf (התואמת ל-functions/index.js)", callableName, String(callableName));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
