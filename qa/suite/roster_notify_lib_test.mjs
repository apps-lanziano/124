/* בקשה: "ברגע שמפרסם לוח חדש לייצר התראה לכלל החיילים והמפקדים ׳פורסם
   לוח צוות חדש׳, ובעת ביצוע שינוי בלוח צוות ׳בוצע עדכון ללוח צוות תורן׳ —
   רק בדחיפה של מ״ע תורנויות". בודק את functions/lib/notify.js — לוגיקת
   ההחלטה עבור מסמכי הלוח הגלובליים (board_roster/board_roster_next, ראו
   rosterStorageKey ב-index.html), כולל השידור לכל המסגרות (BROADCAST_SHED,
   מטופל ב-functions/index.js/notifyOnPublish) והשער על pushedAt — שדה
   שמתעדכן רק בפעולה מפורשת (saveDutyRosterV2/manualPush), כדי שרוטציה
   שבועית אוטומטית שקטה (maybeRotateWeek) לא תישלח כהתראה בטעות. */
import { decide, classify, BROADCAST_SHED } from '../../functions/lib/notify.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. classify מזהה את שני מסמכי הלוח הגלובליים (בלי קידומת מסגרת)
{
  const cases = [
    ["board_roster", "roster_current"],
    ["board_roster_next", "roster_next"],
    ["board_roster_prev", null],   // ארכיון — לא מייצר התראה
  ];
  const ok = cases.every(([id, expect]) => classify(id) === expect);
  record("classify: board_roster→roster_current, board_roster_next→roster_next, board_roster_prev→null",
    ok, JSON.stringify(cases.map(([id])=>[id, classify(id)])));
}

// 2. יצירה ראשונה אי-פעם של הלוח הפעיל (before===undefined) — לא נחשבת "עדכון", לא שולחים
{
  const d = decide({ docId:"board_roster", before: undefined, after: {weekKey:"2026-08-16", pushedAt:"p1", days:{}} });
  record("board_roster: יצירה ראשונה (אין before בכלל) לא מייצרת התראה",
    d === null, JSON.stringify(d));
}

// 3. דחיפה מפורשת (pushedAt השתנה) ללוח הפעיל — שולח "עדכון" לכולם, לא רק למסגרת אחת
{
  const before = {weekKey:"2026-08-09", pushedAt:"p1", days:{ראשון:{lead:"דני"}}};
  const after  = {weekKey:"2026-08-16", pushedAt:"p2", days:{ראשון:{lead:"רון"}}};
  const d = decide({ docId:"board_roster", before, after });
  record("board_roster: pushedAt השתנה (דחיפה מפורשת) → roster_current, משודר לכל המסגרות (BROADCAST_SHED), לא מפקדים בלבד",
    d !== null && d.kind==="roster_current" && d.shedId===BROADCAST_SHED &&
    d.title==="בוצע עדכון ללוח צוות תורן" && d.commandersOnly===false,
    JSON.stringify(d));
}

// 3ב. רוטציה שבועית אוטומטית שקטה (maybeRotateWeek) — תוכן הימים משתנה
// לגמרי (שבוע חדש), אבל pushedAt נשמר בכוונה זהה לישן (ראו index.html) —
// אסור שתישלח התראה, זו לא "דחיפה" של מ״ע תורנויות
{
  const before = {weekKey:"2026-08-09", pushedAt:"p1", days:{ראשון:{lead:"דני"}}};
  const after  = {weekKey:"2026-08-16", pushedAt:"p1", days:{ראשון:{lead:"אחר לגמרי"}}};   // pushedAt זהה בכוונה
  const d = decide({ docId:"board_roster", before, after });
  record("board_roster: רוטציה אוטומטית (pushedAt זהה, למרות שהתוכן השתנה) לא מייצרת התראה",
    d === null, JSON.stringify(d));
}

// 3ג. before בלי pushedAt בכלל (מסמך legacy מלפני הוספת השדה) + after עם pushedAt חדש — עדיין נחשב שינוי אמיתי
{
  const before = {weekKey:"2026-08-09", days:{ראשון:{lead:"דני"}}};   // אין pushedAt (legacy)
  const after  = {weekKey:"2026-08-16", pushedAt:"p1", days:{ראשון:{lead:"רון"}}};
  const d = decide({ docId:"board_roster", before, after });
  record("board_roster: before ללא pushedAt (legacy) + after עם pushedAt חדש → עדיין נחשב דחיפה מפורשת",
    d !== null && d.kind==="roster_current", JSON.stringify(d));
}

// 3ד. after בלי pushedAt בכלל (לא אמור לקרות בפועל, אבל שער-בטיחות) — לא שולח
{
  const before = {weekKey:"2026-08-09", pushedAt:"p1", days:{}};
  const after  = {weekKey:"2026-08-16", days:{}};   // אין pushedAt
  const d = decide({ docId:"board_roster", before, after });
  record("board_roster: after ללא pushedAt כלל — שער בטיחות, לא שולח",
    d === null, JSON.stringify(d));
}

// 4. לוח השבוע הבא כטיוטה (עדיין לא published) — אין למי להודיע, מ״ע תורנויות בלבד רואה אותו
{
  const d = decide({ docId:"board_roster_next", before: undefined, after: {weekKey:"2026-08-23", published:false, pushedAt:"p1", days:{}} });
  record("board_roster_next: טיוטה לא-מפורסמת (published:false) לא מייצרת התראה",
    d === null, JSON.stringify(d));
}

// 5. מעבר published: false→true (הפרסום הראשון) — "פורסם לוח צוות חדש", לכולם
{
  const before = {weekKey:"2026-08-23", published:false, pushedAt:"p1", days:{}};
  const after  = {weekKey:"2026-08-23", published:true, pushedAt:"p2", days:{}};
  const d = decide({ docId:"board_roster_next", before, after });
  record("board_roster_next: מעבר false→true (פרסום ראשון) → roster_publish, 'פורסם לוח צוות חדש', לכל המסגרות",
    d !== null && d.kind==="roster_publish" && d.shedId===BROADCAST_SHED &&
    d.title==="פורסם לוח צוות חדש" && d.commandersOnly===false,
    JSON.stringify(d));
}

// 5ב. אין before בכלל (מסמך next נוצר ישירות עם published:true) — עדיין נחשב פרסום ראשון
{
  const d = decide({ docId:"board_roster_next", before: undefined, after: {weekKey:"2026-08-23", published:true, pushedAt:"p1", days:{}} });
  record("board_roster_next: נוצר ישירות עם published:true (אין before) → roster_publish",
    d !== null && d.kind==="roster_publish", JSON.stringify(d));
}

// 6. דחיפה נוספת ללוח הבא שכבר פורסם קודם (published: true→true, pushedAt השתנה) — "עדכון", לא "פרסום חדש"
{
  const before = {weekKey:"2026-08-23", published:true, pushedAt:"p1", days:{ראשון:{lead:"דני"}}};
  const after  = {weekKey:"2026-08-23", published:true, pushedAt:"p2", days:{ראשון:{lead:"רון"}}};
  const d = decide({ docId:"board_roster_next", before, after });
  record("board_roster_next: דחיפה נוספת אחרי שכבר פורסם (pushedAt השתנה) → roster_current ('עדכון'), לא roster_publish",
    d !== null && d.kind==="roster_current" && d.title==="בוצע עדכון ללוח צוות תורן",
    JSON.stringify(d));
}

// 6ב. כתיבה ל-next שכבר published, בלי ש-pushedAt השתנה — לא שולח (שער אותו עיקרון כמו 3ב)
{
  const before = {weekKey:"2026-08-23", published:true, pushedAt:"p1", days:{ראשון:{lead:"דני"}}};
  const after  = {weekKey:"2026-08-23", published:true, pushedAt:"p1", days:{ראשון:{lead:"רון"}}};
  const d = decide({ docId:"board_roster_next", before, after });
  record("board_roster_next: published כבר true, pushedAt לא השתנה — לא מייצרת התראה",
    d === null, JSON.stringify(d));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
