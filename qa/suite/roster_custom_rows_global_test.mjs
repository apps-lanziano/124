/* 🔴 הבאג הראשי מאחורי "יוזרים רואים חצי לוח".

   לוח הצוות (`board_roster`) הוא מסמך **גלובלי אחד** לכל הטייסת, וכולל
   את השיבוץ בפועל של שורות מותאמות-אישית תחת `custom_<id>`. אבל הגדרות
   השורות עצמן (`{id,label,afterKey}`) נשמרו דרך `sGet`/`sSet` שמוסיפים
   תחילית סככה — `shed2_roster_custom_rows`. התוצאה: **השמות** היו גלויים
   לכולם, אבל **ההגדרות** רק למי שנמצא בסככה של מ״ע התורנויות שיצר אותן.
   לכל השאר `rosterCustomRows` חזר ריק, השורות לא רונדרו בכלל, והלוח
   נראה חצי — בלי קשר ל-disabledRows, לגרסת הקוד או לתזמון.

   זה גם ההסבר המדויק ל"כניסה עם יוזר תקין ואז חזרה מסדרת": הכניסה
   כמשתמש מהסככה של המ״ע טענה את ההגדרות לזיכרון, ו-logout לא ניקה
   אותן — אז הן נשארו זמינות ליוזר הבא באותה טעינת-עמוד.

   הבדיקה מוודאת: (1) ההגדרות גלובליות ונראות מכל סככה; (2) אימוץ
   חד-פעמי של הגדרות ישנות שנשמרו פר-סככה, כדי שלא ייעלמו למ״ע;
   (3) logout מנקה את הקאש בזיכרון. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // --- (1) מ״ע בסככה 1 מגדיר שורה. הלוח (גלובלי) מאויש בה. ---
  await saveRosterCustomRows([{id:"cr_pf_day", label:"PF יום בלבד", afterKey:"pf"}]);
  const board = migrateRosterToV2(null);
  board.days["ראשון"]["custom_cr_pf_day"] = ["אופיר מישאלי"];
  await saveDutyRosterV2(board, "current");

  // ההגדרה נשמרה למפתח **גלובלי**, לא למפתח פר-סככה
  r.savedToGlobalKey = Array.isArray(await sGetRaw("roster_custom_rows"));
  r.notSavedToShedKey = !(await sGetRaw("shed1_roster_custom_rows"));

  // --- הבדיקה הקריטית: משתמש בסככה אחרת רואה את השורה ואת השמות ---
  currentShed = SHEDS.find(s=>s.id==="shed3");
  rosterCustomRows = []; _rosterCustomRowsLoaded = false;   // כמו טעינה טרייה
  await loadRosterCustomRows();
  r.otherShedSeesDefinition = rosterCustomRows.some(c=>c.id==="cr_pf_day");
  const html = rosterBoardHtml(await getDutyRoster("current"), "", "wide");
  r.otherShedSeesRowAndNames = html.includes("PF יום בלבד") && html.includes("אופיר מישאלי");
  const cards = rosterCardsHtml(await getDutyRoster("current"), "ראשון");
  r.otherShedSeesInDayView = cards.includes("PF יום בלבד") && cards.includes("אופיר מישאלי");
  currentShed = SHEDS.find(s=>s.id==="shed1");

  // --- (2) אימוץ הגדרות ישנות שנשמרו פר-סככה (לא לאבד למ״ע את עבודתו) ---
  await sSetRaw("roster_custom_rows", []);                     // הגלובלי ריק
  await sSetRaw("shed2_roster_custom_rows", [{id:"cr_legacy_a", label:"מילואים יום בלבד", afterKey:"reserve"}]);
  await sSetRaw("shed4_roster_custom_rows", [{id:"cr_legacy_b", label:"PF יום ולילה", afterKey:"pf"}]);
  rosterCustomRows = []; _rosterCustomRowsLoaded = false;
  await loadRosterCustomRows();
  r.adoptedFromShed2 = rosterCustomRows.some(c=>c.id==="cr_legacy_a");
  r.adoptedFromShed4 = rosterCustomRows.some(c=>c.id==="cr_legacy_b");
  r.adoptionPersistedGlobally = ((await sGetRaw("roster_custom_rows"))||[]).length === 2;

  // אימוץ חוזר לא מכפיל ולא דורס
  rosterCustomRows = []; _rosterCustomRowsLoaded = false;
  await loadRosterCustomRows();
  r.adoptionIdempotent = rosterCustomRows.length === 2;

  // --- (3) logout מנקה את הקאש בזיכרון (אחרת נתונים "נדבקים" ליוזר הבא) ---
  logout();
  r.logoutClearsCache = rosterCustomRows.length === 0 && _rosterCustomRowsLoaded === false;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("ההגדרות נשמרות למפתח גלובלי", out.savedToGlobalKey, String(out.savedToGlobalKey));
record("ההגדרות לא נשמרות למפתח פר-סככה", out.notSavedToShedKey, String(out.notSavedToShedKey));
record("🔴 משתמש בסככה אחרת טוען את הגדרת השורה", out.otherShedSeesDefinition, String(out.otherShedSeesDefinition));
record("🔴 משתמש בסככה אחרת רואה את השורה והשמות בלוח השבועי", out.otherShedSeesRowAndNames, String(out.otherShedSeesRowAndNames));
record("🔴 משתמש בסככה אחרת רואה אותן גם בלוח היומי", out.otherShedSeesInDayView, String(out.otherShedSeesInDayView));
record("אימוץ הגדרות ישנות מסככה 2", out.adoptedFromShed2, String(out.adoptedFromShed2));
record("אימוץ הגדרות ישנות מסככה 4 (איחוד ממספר סככות)", out.adoptedFromShed4, String(out.adoptedFromShed4));
record("האימוץ נשמר למפתח הגלובלי", out.adoptionPersistedGlobally, String(out.adoptionPersistedGlobally));
record("אימוץ חוזר לא מכפיל שורות", out.adoptionIdempotent, String(out.adoptionIdempotent));
record("logout מנקה את קאש השורות בזיכרון", out.logoutClearsCache, String(out.logoutClearsCache));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
