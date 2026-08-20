/* שורות מותאמות-אישית חייבות להופיע גם ב"לוח יומי" (כרטיסי יום) וב"רק
   אני" — לא רק ב"לוח שבועי".

   הבאג שדווח: אחרי "קבע את הלוח הזה כלוח נוכחי", תצוגת "לוח יומי" נראתה
   כאילו לא התעדכנה — הכרטיסים הציגו רק מנהל/ר״צ/מתגבר/מטיס/נהג/כלים.
   הסיבה: מ״ע תורנויות בנה את הלוח עם שורות מותאמות-אישית ("PF יום
   בלבד"/"PF יום ולילה"/"מילואים יום בלבד") במקום שדות PF/מילואים
   הסטנדרטיים, ותצוגת היום לא רינדרה שורות כאלה בכלל — כך שכל השיבוץ
   הזה פשוט לא היה קיים על המסך, והכרטיס נראה חלקי/ישן.

   זו אותה ערובה של הלוח השבועי (ר' roster_never_hide_staffed_test):
   שיבוץ בפועל לעולם לא נעלם — בכל התצוגות, לא רק באחת. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "חייל");

const out = await page.evaluate(async ()=>{
  const r = {};
  const me = user;

  rosterCustomRows = [
    {id:"cr_pf_day", label:"PF יום בלבד", afterKey:"pf"},
    {id:"cr_res_day", label:"מילואים יום בלבד", afterKey:"reserve"},
  ];
  await saveRosterCustomRows(rosterCustomRows);

  const board = migrateRosterToV2(null);
  board.days["ראשון"].manager = "טל מלכה";
  board.days["ראשון"]["custom_cr_pf_day"]  = ["אופיר מישאלי", me];
  board.days["שני"]["custom_cr_res_day"]   = ["גל בלכנר"];

  // --- לוח יומי: השורות המותאמות מרונדרות עם השמות ---
  const cards = rosterCardsHtml(board, "ראשון");
  r.customRowLabelInDayView = cards.includes("PF יום בלבד");
  r.customRowNamesInDayView = cards.includes("אופיר מישאלי");
  r.secondCustomRowInDayView = cards.includes("מילואים יום בלבד") && cards.includes("גל בלכנר");

  // --- חיווי "אתה תורן" עובד גם על שיבוץ בשורה מותאמת-אישית ---
  r.meHintFromCustomRow = cards.includes("אתה תורן");

  // --- מיקום: השורה עוגנה אחרי "PF" ולכן מופיעה שם, לא בסוף הכרטיס ---
  r.customRowOrderRespected = cards.indexOf("PF יום בלבד") < cards.indexOf("מילואים יום בלבד");

  // --- שדות סטנדרטיים ממשיכים לעבוד בדיוק כמו קודם (בלי רגרסיה) ---
  const std = migrateRosterToV2(null);
  std.days["ראשון"].manager = "טל מלכה";
  std.days["ראשון"].pf = [{name:"עדי שיס"}];
  std.days["ראשון"].pms = ["רוני טל"];
  std.days["ראשון"].reserve = ["יובל גליל"];
  std.days["ראשון"].basic = [{name:"שחר ממן", type:"מטבח"}];
  std.days["ראשון"].pfRest = ["יואב אבני"];
  const stdCards = rosterCardsHtml(std, "ראשון");
  r.standardRowsIntact = ["מנהל","טל מלכה","PF","עדי שיס","PMS","רוני טל",
                          "מילואים","יובל גליל","תורנות","שחר ממן","יואב אבני"]
                          .every(x=>stdCards.includes(x));

  // --- "רק אני": חייל ששובץ רק בשורה מותאמת-אישית רואה את עצמו ---
  rosterView = "mine";
  const mine = rosterMineHtml(board, "ראשון");
  r.customRowInMineView = mine.includes("PF יום בלבד");
  r.mineNotEmptyForCustomOnly = !mine.includes("אינך משובץ השבוע");

  // --- rosterMyRoles מחזיר את השורה המותאמת כתפקיד ---
  r.myRolesIncludesCustom = rosterMyRoles(board.days["ראשון"], me).includes("PF יום בלבד");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("לוח יומי: תווית השורה המותאמת-אישית מוצגת", out.customRowLabelInDayView, String(out.customRowLabelInDayView));
record("לוח יומי: השמות שבשורה המותאמת-אישית מוצגים", out.customRowNamesInDayView, String(out.customRowNamesInDayView));
record("לוח יומי: שורה מותאמת שנייה (יום אחר) מוצגת", out.secondCustomRowInDayView, String(out.secondCustomRowInDayView));
record("לוח יומי: חיווי 'אתה תורן' עובד גם משורה מותאמת-אישית", out.meHintFromCustomRow, String(out.meHintFromCustomRow));
record("לוח יומי: מיקום השורות לפי אותו סדר של הלוח השבועי", out.customRowOrderRespected, String(out.customRowOrderRespected));
record("לוח יומי: כל השדות הסטנדרטיים ממשיכים לעבוד (בלי רגרסיה)", out.standardRowsIntact, String(out.standardRowsIntact));
record("רק אני: שיבוץ בשורה מותאמת-אישית מופיע", out.customRowInMineView, String(out.customRowInMineView));
record("רק אני: לא מוצג 'אינך משובץ' כששובצתי בשורה מותאמת בלבד", out.mineNotEmptyForCustomOnly, String(out.mineNotEmptyForCustomOnly));
record("rosterMyRoles כולל שורות מותאמות-אישית", out.myRolesIncludesCustom, String(out.myRolesIncludesCustom));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
