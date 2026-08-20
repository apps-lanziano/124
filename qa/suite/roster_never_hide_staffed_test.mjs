/* ⛔ כלל-הברזל של לוח הצוות: **שיבוץ בפועל לעולם לא נעלם מהמסך.**

   הבדיקה הזו משחזרת את תרחיש ה-production המדויק שדווח שוב ושוב
   ("יוזרים רואים חצי לוח"), על כל הווריאציות שלו, ומוודאת שאף אחת מהן
   לא יכולה להסתיר שם של חייל ששובץ — לא משנה מה כתוב ב-disabledRows.

   הרקע: לפני התיקון, `disabledRows` הסתיר שורה "בשום מצב, גם עם שיבוץ
   בפועל". סדרת תיקונים ניסתה לוודא ש-disabledRows יהיה *נכון* בכל רגע
   (זריעה בעת יצירת שורה, ריפוי רטרואקטיבי, רוטציה שבועית) — וכל אחד
   מהם השאיר עוד פינה שבה ערך שגוי הסתיר נתונים אמיתיים. הפתרון: הופכים
   את הנתונים למקור-האמת העליון. השבתה = העדפה תצוגתית לשורות ריקות
   בלבד. כך המחלקה הזו של באגים בלתי-אפשרית מבנית, בלי תלות בשום
   מנגנון תחזוקה. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // --- שחזור מדויק של הלוח מהצילומים: מ״ע בנה את "שבוע הבא" עם שורות
  // מותאמות-אישית ("PF יום בלבד" וכו') במקום השדות הסטנדרטיים, והשדות
  // הסטנדרטיים הושבתו. במקביל, השורות המותאמות-אישית עצמן סומנו בטעות
  // מושבתות על אותו לוח (זריעה/ריפוי שרצו ברגע לא נכון) — וכך נעלמו
  // *גם* השורות הסטנדרטיות *וגם* המותאמות: לוח חצי. ---
  rosterCustomRows = [
    {id:"cr_pf_day",   label:"PF יום בלבד",       afterKey:"__start__"},
    {id:"cr_pf_night", label:"PF יום ולילה",      afterKey:"cr_pf_day"},
    {id:"cr_res_day",  label:"מילואים יום בלבד",  afterKey:"cr_pf_night"},
  ];
  await saveRosterCustomRows(rosterCustomRows);

  const board = migrateRosterToV2(null);
  board.days["ראשון"]["custom_cr_pf_day"]   = ["אופיר מ.", "ליאור כ."];
  board.days["שני"]["custom_cr_pf_night"]   = ["רוני ט."];
  board.days["שלישי"]["custom_cr_res_day"]  = ["גל ב."];
  board.days["ראשון"].pf                    = [{name:"עדי ש."}];   // גם שדה סטנדרטי מאויש
  // הכי גרוע שיכול לקרות: *הכל* מסומן מושבת, כולל שורות שבאמת מאוישות
  board.disabledRows = ["pf","pfRest","pms","pmsRest","reserve","basic","fixedAug",
                        "cr_pf_day","cr_pf_night","cr_res_day"];

  const html = rosterBoardHtml(board, "", "wide");
  r.customPfDayShown   = html.includes("PF יום בלבד") && html.includes("אופיר מ.") && html.includes("ליאור כ.");
  r.customPfNightShown = html.includes("PF יום ולילה") && html.includes("רוני ט.");
  r.customResDayShown  = html.includes("מילואים יום בלבד") && html.includes("גל ב.");
  r.standardPfShown    = html.includes(">PF<") && html.includes("עדי ש.");
  // שורות שבאמת ריקות + מושבתות — כן מוסתרות (זו מטרת המתג, לא באג)
  r.trulyEmptyStillHidden = !html.includes("PMS נחים") && !html.includes(">מילואים<");

  // --- אותו לוח בתצוגה המוקטנת (fit) — אותה ערובה בדיוק ---
  const htmlFit = rosterBoardHtml(board, "", undefined);
  r.sameGuaranteeInFitMode = htmlFit.includes("PF יום בלבד") && htmlFit.includes("PF יום ולילה");

  // --- מתגבר: שיבוץ שקיים רק במשמרת שישי–שבת (friDay) גם הוא "שיבוץ בפועל" ---
  const wk = migrateRosterToV2(null);
  wk.days["שישי"].fixedAug = ["סיגל ל."];
  wk.disabledRows = ["fixedAug"];
  r.weekendOnlyFixedAugShown = rosterBoardHtml(wk, "", "wide").includes(">מתגבר<");

  // --- ערובה מקיפה: לכל שדה-רשימה בנפרד, שיבוץ בודד + השבתה = עדיין מוצג ---
  const fields = [
    {key:"pf",      label:">PF<",        set:d=>{ d.pf = [{name:"בדיקה פ"}]; },      name:"בדיקה פ"},
    {key:"pfRest",  label:"נחים PF",     set:d=>{ d.pfRest = ["בדיקה נ"]; },         name:"בדיקה נ"},
    {key:"pms",     label:">PMS<",       set:d=>{ d.pms = ["בדיקה מ"]; },            name:"בדיקה מ"},
    {key:"pmsRest", label:"PMS נחים",    set:d=>{ d.pmsRest = ["בדיקה מנ"]; },       name:"בדיקה מנ"},
    {key:"reserve", label:">מילואים<",   set:d=>{ d.reserve = ["בדיקה ר"]; },        name:"בדיקה ר"},
    {key:"basic",   label:">תורנות<",    set:d=>{ d.basic = [{name:"בדיקה ת"}]; },   name:"בדיקה ת"},
  ];
  const lost = [];
  for(const f of fields){
    const b = migrateRosterToV2(null);
    f.set(b.days["שני"]);
    b.disabledRows = [f.key];
    const h = rosterBoardHtml(b, "", "wide");
    if(!h.includes(f.label) || !h.includes(f.name)) lost.push(f.key);
  }
  r.noFieldCanLoseData = lost.length === 0;
  r.lostFields = lost.join(",");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("⛔ שורה מותאמת 'PF יום בלבד' מאוישת — מוצגת למרות השבתה", out.customPfDayShown, String(out.customPfDayShown));
record("⛔ שורה מותאמת 'PF יום ולילה' מאוישת — מוצגת למרות השבתה", out.customPfNightShown, String(out.customPfNightShown));
record("⛔ שורה מותאמת 'מילואים יום בלבד' מאוישת — מוצגת למרות השבתה", out.customResDayShown, String(out.customResDayShown));
record("⛔ שדה סטנדרטי PF מאויש — מוצג למרות השבתה", out.standardPfShown, String(out.standardPfShown));
record("שורות שבאמת ריקות + מושבתות — עדיין מוסתרות (מטרת המתג נשמרת)", out.trulyEmptyStillHidden, String(out.trulyEmptyStillHidden));
record("אותה ערובה גם בתצוגה המוקטנת (fit)", out.sameGuaranteeInFitMode, String(out.sameGuaranteeInFitMode));
record("מתגבר במשמרת שישי–שבת בלבד — נחשב שיבוץ ומוצג", out.weekendOnlyFixedAugShown, String(out.weekendOnlyFixedAugShown));
record("⛔ אף שדה-רשימה לא יכול לאבד נתונים בגלל השבתה", out.noFieldCanLoseData, out.lostFields ? ("אבדו: "+out.lostFields) : "כולם מוצגים");

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
