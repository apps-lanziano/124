/* markAuthorized (Custom Claims — סוגר את פרצת הקריאה האנונימית שתועדה
   ב-SECURITY.md): בודק את shouldAuthorize, לוגיקת ההחלטה הטהורה שקובעת
   האם מותר להצמיד את תגית authorized:true לחשבון. חייבת להחזיר true
   רק לכניסה אמיתית עם קוד (email/password) — לעולם לא לאימות אנונימי,
   אחרת הפונקציה הזו עצמה תהפוך לפרצה חדשה. */
import { shouldAuthorize } from '../../functions/lib/authorize.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. כניסה אמיתית עם קוד (email/password) -> מאושר
{
  const auth = { uid: "u1", token: { firebase: { sign_in_provider: "password" } } };
  record("sign_in_provider='password' -> shouldAuthorize=true", shouldAuthorize(auth)===true, JSON.stringify(auth));
}

// 2. אימות אנונימי -> לא מאושר (זה בדיוק הפרצה שהפונקציה נועדה לסגור)
{
  const auth = { uid: "u2", token: { firebase: { sign_in_provider: "anonymous" } } };
  record("sign_in_provider='anonymous' -> shouldAuthorize=false", shouldAuthorize(auth)===false, JSON.stringify(auth));
}

// 3. ספקים אחרים (למשל google.com, אילו יתווספו בעתיד) -> לא מאושר, רק password מפורש
{
  const auth = { uid: "u3", token: { firebase: { sign_in_provider: "google.com" } } };
  record("ספק אחר כלשהו -> shouldAuthorize=false (רק password מאושר במפורש)", shouldAuthorize(auth)===false, JSON.stringify(auth));
}

// 4. קלט חסר/פגום -> false ולא זריקת שגיאה (הגנה מפני מבנה טוקן לא צפוי)
{
  record("auth=null -> false, לא זורק", shouldAuthorize(null)===false, "null");
  record("auth={} -> false, לא זורק", shouldAuthorize({})===false, "{}");
  record("token.firebase חסר -> false, לא זורק", shouldAuthorize({uid:"u4", token:{}})===false, "{token:{}}");
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
