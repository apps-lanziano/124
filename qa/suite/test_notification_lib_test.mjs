/* התראת-בדיקה (functions/lib/test_notification.js) — לוגיקת האימות
   הטהורה. השליחה בפועל (getMessaging().send) לא נבדקת כאן — היא בקוד
   דק בפונקציית ה-onCall עצמה (ראו test_notification_wiring_test.mjs). */
import { validateTestNotificationRequest } from '../../functions/lib/test_notification.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. בקשה תקינה מלאה
{
  const r = validateTestNotificationRequest({token: "tok123", title: "כותרת", body: "גוף ההודעה"});
  record("בקשה תקינה עם token+title+body מאושרת", r.ok && r.token==="tok123" && r.title==="כותרת" && r.body==="גוף ההודעה", JSON.stringify(r));
}

// 2. body חסר — מתמלא כמחרוזת ריקה, לא נכשל
{
  const r = validateTestNotificationRequest({token: "tok123", title: "כותרת"});
  record("body חסר לא נכשל — מתמלא כמחרוזת ריקה", r.ok && r.body==="", JSON.stringify(r));
}

// 3. token חסר — נכשל
{
  const r = validateTestNotificationRequest({title: "כותרת"});
  record("token חסר נכשל עם הודעת שגיאה ברורה", r.ok===false && !!r.error, JSON.stringify(r));
}

// 4. title חסר/ריק — נכשל
{
  const a = validateTestNotificationRequest({token: "tok123"});
  const b = validateTestNotificationRequest({token: "tok123", title: "   "});
  record("title חסר נכשל", a.ok===false && !!a.error, JSON.stringify(a));
  record("title שמכיל רק רווחים נכשל", b.ok===false && !!b.error, JSON.stringify(b));
}

// 5. קלט לא תקין (undefined/מחרוזות ריקות/סוגים לא נכונים) לא זורק חריגה
{
  const a = validateTestNotificationRequest(undefined);
  const b = validateTestNotificationRequest({token: 42, title: "כותרת"});
  record("undefined לא זורק חריגה, מוחזר ok:false", a.ok===false, JSON.stringify(a));
  record("token שאינו מחרוזת נכשל", b.ok===false, JSON.stringify(b));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
