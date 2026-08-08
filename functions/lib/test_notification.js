/* ============================================================
   התראת-בדיקה אמיתית (FCM) — אך ורק למכשיר של הקורא עצמו. נועדה למי
   שרוצה לראות בעצמו איך התראה אוטומטית (למשל dutyRosterDigest) באמת
   נראית על המכשיר שלו, בלי לגעת באף משתמש אחר.

   ה-token מגיע מהלקוח (fcmToken של המכשיר הנוכחי בלבד, לא חיפוש/רשימה
   בשרת לפי סככה/תפקיד) — מבנית, אין דרך לשלוח למישהו אחר עם הפונקציה
   הזו: הלקוח לא יכול לדעת/לקבל את הטוקן של מכשיר שאינו שלו.
   ============================================================ */

function validateTestNotificationRequest(data) {
  const token = data && data.token;
  const title = data && data.title;
  const body = data && data.body;
  if (!token || typeof token !== "string") {
    return {ok: false, error: "חסר טוקן התראה של המכשיר הנוכחי"};
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    return {ok: false, error: "חסרה כותרת להתראה"};
  }
  return {ok: true, token, title, body: typeof body === "string" ? body : ""};
}

module.exports = {validateTestNotificationRequest};
