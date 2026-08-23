/* ============================================================
   כלי עזר משותפים לבניית ממצאים בדוח — טייסת 124
   ------------------------------------------------------------
   הדוח היומי נקרא ע"י מפקד, לא ע"י מתכנת (ר' run_daily.mjs).
   כל detail שמקורו בחריגה (catch) חייב לעבור דרך summarizeError,
   אחרת יומני קריסה גולמיים של תהליך הדפדפן (Chromium/dbus/SSL,
   "Browser logs:" וכו') דולפים ישירות לדוח הציבורי.
   ============================================================ */

/* קודי צבע של הטרמינל (ANSI) - כלים כמו firebase-tools צובעים את הפלט,
   וכשהפלט הזה נכנס לדוח ה-Markdown הצבעים הופכים לזבל קריא-לאדם מסוג
   "[36m[1mi  emulators:". מנקים תמיד לפני שמכניסים פלט תהליך לדוח. */
const ANSI_RE = new RegExp(
  "[\\u001B\\u009B][\\[\\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PR-TZcf-ntqry=><]",
  "g",
);

export function stripAnsi(s){
  return String(s || "").replace(ANSI_RE, "");
}

export function summarizeError(e, max = 280){
  let msg = stripAnsi(String((e && e.message) || e || ""));
  // Playwright מצרף ליומן הקריסה של הדפדפן להודעת השגיאה עצמה כשהתהליך
  // קורס — כל מה שאחרי הסמנים האלה הוא יומן תהליך, לא תיאור התקלה.
  const cutMarkers = ["Browser logs:", "Call log:", "\n<launching>"];
  for(const marker of cutMarkers){
    const i = msg.indexOf(marker);
    if(i >= 0) msg = msg.slice(0, i).trim();
  }
  msg = msg.split("\n")[0].trim();
  if(!msg) msg = "כשל טכני בהרצת הבדיקה";
  return msg.length > max ? msg.slice(0, max) + "…" : msg;
}
