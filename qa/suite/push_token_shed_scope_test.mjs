/* באג: מכשיר שנכנס אי-פעם למסגרת מסוימת (כולל "כניסה בתור" של מנהל-על)
   נשאר רשום לתמיד ברשימת ה-push tokens של אותה מסגרת, גם אחרי שעבר
   למסגרת אחרת — כי savePushToken רק *הוסיף* למסגרת הנוכחית ולא ניקה
   רישומים ישנים. בפועל: מפקד סככה שהשתמש פעם ב"כניסה בתור" כדי לבדוק
   מסגרת אחרת המשיך לקבל התראות (למשל "לוח צוות חדש") מאותה מסגרת
   לתמיד. תוקן בשני מקומות: (1) savePushToken מנקה את אותו טוקן מכל
   שאר המסגרות לפני הרישום, כך שההיסטוריה מתנקה מעצמה בכניסה הבאה;
   (2) doLogin לא נוגע בטוקן ה-push בכלל בזמן "כניסה בתור" (impersonating),
   כי זו צפייה זמנית לתמיכה, לא חברות אמיתית במסגרת. */
import { newPage, loginAsSuperAdmin, closeBrowser } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
await loginAsSuperAdmin(page, "shed1");

// --- 1. savePushToken מנקה את אותו טוקן ממסגרות אחרות ---
const cleanupResult = await page.evaluate(async () => {
  const FAKE_TOKEN = "fake-device-token-xyz";
  // מדמים היסטוריה: אותו מכשיר כבר רשום תחת training ו-maint מ"כניסות בתור" קודמות
  await sSetIn("training", "push_tokens_training", null); // no-op, נשמר ל-sSetRaw למטה
  await sSetRaw("push_tokens_training", { [FAKE_TOKEN]: { name: "מישהו", role: "מפקד", ts: 1 } });
  await sSetRaw("push_tokens_maint", { [FAKE_TOKEN]: { name: "מישהו", role: "מפקד", ts: 1 } });
  await sSetRaw("push_tokens_shed1", {});

  currentShed = SHEDS.find(s => s.id === "shed1");
  enteredRole = "מפקד";
  user = "אלעד לנציאנו";
  await savePushToken(FAKE_TOKEN);

  const shed1Map = await sGetRaw("push_tokens_shed1");
  const trainingMap = await sGetRaw("push_tokens_training");
  const maintMap = await sGetRaw("push_tokens_maint");
  return { shed1Map, trainingMap, maintMap, hasInShed1: !!(shed1Map && shed1Map[FAKE_TOKEN]) };
});
record("הטוקן נרשם תחת המסגרת הנוכחית (shed1)",
  cleanupResult.hasInShed1, JSON.stringify(cleanupResult.shed1Map));
record("הטוקן הוסר ממסגרת הדרכה שבה היה רשום מכניסה קודמת",
  !cleanupResult.trainingMap || !cleanupResult.trainingMap["fake-device-token-xyz"], JSON.stringify(cleanupResult.trainingMap));
record("הטוקן הוסר ממסגרת מ״ע אחזקה שבה היה רשום מכניסה קודמת",
  !cleanupResult.maintMap || !cleanupResult.maintMap["fake-device-token-xyz"], JSON.stringify(cleanupResult.maintMap));

// --- 2. "כניסה בתור" לא נוגעת בטוקן ה-push בכלל ---
const impersonateResult = await page.evaluate(async () => {
  let ensureBadgeCalls = 0;
  const originalEnsureBadge = ensureBadgePermission;
  ensureBadgePermission = async () => { ensureBadgeCalls++; };
  try {
    const list = await sGetIn("shed1", "cfg_personnel");
    const target = list.find(p => p.role === "חייל" && p.name !== "אלעד לנציאנו");
    Object.assign(target, await buildPinFields("9999"));
    await sSetIn("shed1", "cfg_personnel", list);

    await impersonateUser("shed1", target.name);
    const callsDuringImpersonation = ensureBadgeCalls;

    await exitImpersonation();
    const callsAfterExit = ensureBadgeCalls;

    return { callsDuringImpersonation, callsAfterExit };
  } finally {
    ensureBadgePermission = originalEnsureBadge;
  }
});
record("בזמן כניסה-בתור לא נקראת בקשת הרשאת ה-push כלל",
  impersonateResult.callsDuringImpersonation === 0, JSON.stringify(impersonateResult));
record("אחרי חזרה מכניסה-בתור לזהות האמיתית, בקשת ה-push חוזרת לרוץ כרגיל",
  impersonateResult.callsAfterExit === 1, JSON.stringify(impersonateResult));

record("אין שגיאות JS", pageErrors.length === 0, JSON.stringify(pageErrors));

console.log("\n=== SUMMARY ===");
let allPass = true;
for (const r of results) {
  console.log((r.pass ? "✅" : "❌"), r.name, "-", r.detail);
  if (!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await closeBrowser();
process.exit(allPass ? 0 : 1);
