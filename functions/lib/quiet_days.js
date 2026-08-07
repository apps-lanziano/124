/* ============================================================
   "ימים שקטים" — שישי ושבת: החלטת מדיניות טייסתית (לא אישית) לא
   לשלוח שום תזכורת/סקירה שגרתית ומתוזמנת בימים האלה. חל רק על
   התזכורות המתוזמנות (onSchedule) — לא על התראות בזמן אמת
   (notifyOnPublish: הודעה חדשה, קרא-וחתום, נכס וכו'), כי אלה עשויות
   להיות דחופות/מבצעיות ולא שגרת ניהול שאפשר לדחות לאחר השבת.
   משתמש באותה לוגיקת חישוב-יום בטיימזון ישראל כמו lib/duty_roster_digest
   (Intl.DateTimeFormat, לא new Date().getDay() שתלוי בטיימזון השרת). */
const { todayHebrewDayName } = require("./duty_roster_digest");

const QUIET_DAYS = new Set(["שישי", "שבת"]);

function isQuietDay(now, timeZone = "Asia/Jerusalem") {
  const day = todayHebrewDayName(now, timeZone);
  return QUIET_DAYS.has(day);
}

module.exports = { isQuietDay, QUIET_DAYS };
