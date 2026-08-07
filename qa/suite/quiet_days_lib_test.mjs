/* "ימים שקטים" (שישי/שבת) — מדיניות טייסתית לא לשלוח תזכורות מתוזמנות
   שגרתיות בימים האלה. בודק את functions/lib/quiet_days.js בלבד —
   לוגיקה טהורה, בלי emulator. */
import { isQuietDay, QUIET_DAYS } from '../../functions/lib/quiet_days.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// תאריכים ידועים בשעון ישראל (חצות UTC = 03:00/02:00 בישראל, בטוח בתוך אותו יום)
const FRIDAY   = Date.UTC(2026, 7, 7, 10, 0);  // 7.8.2026 הוא יום שישי
const SATURDAY = Date.UTC(2026, 7, 8, 10, 0);  // 8.8.2026 הוא יום שבת
const SUNDAY   = Date.UTC(2026, 7, 9, 10, 0);  // 9.8.2026 הוא יום ראשון
const WEDNESDAY= Date.UTC(2026, 7, 5, 10, 0);  // 5.8.2026 הוא יום רביעי

record("יום שישי מזוהה כיום שקט", isQuietDay(FRIDAY)===true, String(isQuietDay(FRIDAY)));
record("יום שבת מזוהה כיום שקט", isQuietDay(SATURDAY)===true, String(isQuietDay(SATURDAY)));
record("יום ראשון אינו יום שקט", isQuietDay(SUNDAY)===false, String(isQuietDay(SUNDAY)));
record("יום רביעי אינו יום שקט", isQuietDay(WEDNESDAY)===false, String(isQuietDay(WEDNESDAY)));

// גבול טיימזון: 23:30 UTC בחמישי = כבר 02:30 שישי בישראל -> יום שקט
{
  const lateThursdayUtc = Date.UTC(2026, 7, 6, 23, 30); // 6.8.2026 (חמישי) 23:30 UTC
  record("23:30 UTC בחמישי כבר יום שישי בישראל -> יום שקט",
    isQuietDay(lateThursdayUtc)===true, String(isQuietDay(lateThursdayUtc)));
}

record("QUIET_DAYS מכיל בדיוק שישי ושבת, לא יותר", QUIET_DAYS.size===2 && QUIET_DAYS.has("שישי") && QUIET_DAYS.has("שבת"), [...QUIET_DAYS].join(","));

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
