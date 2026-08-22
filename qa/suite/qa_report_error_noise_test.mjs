/* רגרסיה על qa/lib/report_util.mjs — מונע חזרה של הבאג האמיתי שקרה
   ב-qa/reports/latest.md (2026-08-22): קריסת דפדפן ב-xss_probe.mjs
   דלפה כ-~150 שורות של יומן קריסה גולמי (dbus/SSL/פקודת ההרצה של
   Chromium) לתוך detail של ממצא בדוח היומי, שאמור להיות קריא למפקד
   לא-טכני. summarizeError() חייבת לקצץ בדיוק את הדפוס הזה. */
import { summarizeError } from '../lib/report_util.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. שחזור מדויק של ה-detail הגולמי שדלף בפועל לדוח
{
  const raw = "browser.newPage: Target page, context or browser has been closed\n" +
    "Browser logs:\n\n<launching> /opt/pw-browsers/chromium --disable-field-trial-config " +
    "--headless --no-sandbox\n<launched> pid=2925\n" +
    "[pid=2925][err] ERROR:dbus/bus.cc:408] Failed to connect to the bus\n".repeat(50);
  const out = summarizeError(new Error(raw));
  record("יומן קריסה גולמי מקוצץ למשפט קצר אחד",
    out === "browser.newPage: Target page, context or browser has been closed",
    JSON.stringify(out));
  record("האורך אחרי הקיצוץ קטן משמעותית מהמקור",
    out.length < 200 && raw.length > 3000,
    `before=${raw.length} after=${out.length}`);
}

// 2. הודעת שגיאה רגילה וקצרה עוברת בלי שינוי מהותי
{
  const out = summarizeError(new Error("קובץ לא נמצא"));
  record("הודעה רגילה לא נפגעת", out === "קובץ לא נמצא", JSON.stringify(out));
}

// 3. הגנה גם על גבול אורך גנרי (בלי סמן ידוע), לא רק על "Browser logs:"
{
  const longMsg = "שגיאה: " + "x".repeat(1000);
  const out = summarizeError(new Error(longMsg));
  record("הודעה ארוכה בלי סמן ידוע עדיין מוגבלת באורך", out.length <= 281, `length=${out.length}`);
}

// 4. חריגה בלי message (למשל זריקת מחרוזת) לא קורסת ומחזירה טקסט שימושי
{
  const out = summarizeError("קריסה כמחרוזת גולמית");
  record("חריגה שאינה Error מטופלת בלי קריסה", out === "קריסה כמחרוזת גולמית", JSON.stringify(out));
  const out2 = summarizeError(undefined);
  record("קלט ריק לא קורס ומחזיר פולבק", out2 === "כשל טכני בהרצת הבדיקה", JSON.stringify(out2));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
