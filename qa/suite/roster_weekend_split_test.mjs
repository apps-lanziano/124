/* פיצול תפקידים בסופ"ש: מנהל ומתגבר מתחלפים — חמישי (משמרת א׳) מול
   שישי+שבת (משמרת ב׳). נשמר נכון לכל יום, ומוצג מפוצל בלוח. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;

  // בונים טיוטה: יום העריכה "חמישי" מחזיק את שני חלקי המשמרת
  const draft = migrateRosterToV2(null);
  draft.days["חמישי"].manager     = "מנהל חמישי";
  draft.days["חמישי"].managerWknd = "מנהל שישבת";
  draft.days["חמישי"].fixedAug     = ["מתגבר חמישי"];
  draft.days["חמישי"].fixedAugWknd = ["מתגבר שישבת"];
  await saveDutyRosterV2(draft, "current");

  // אחרי שמירה — כל יום מחזיק את הערך הנכון שלו
  const saved = await getDutyRoster("current");
  r.thuManager = saved.days["חמישי"].manager === "מנהל חמישי";
  r.friManager = saved.days["שישי"].manager === "מנהל שישבת";
  r.satManager = saved.days["שבת"].manager  === "מנהל שישבת";
  r.thuAug = (saved.days["חמישי"].fixedAug||[]).includes("מתגבר חמישי");
  r.friAug = (saved.days["שישי"].fixedAug||[]).includes("מתגבר שישבת");
  // שדות העזר לא נושאים ערך על ימי שישי/שבת (הערך הועבר ל-manager עצמו)
  r.noHelperFields = saved.days["שישי"].managerWknd==="" && (saved.days["שבת"].fixedAugWknd||[]).length===0;

  // הלוח מציג את שני החלקים בעמודת ה׳–ש׳ עם תגיות
  const html = rosterBoardHtml(saved, "", "wide");
  r.boardShowsBoth = html.includes("מנהל חמישי") && html.includes("מנהל שישבת")
    && html.includes("ה׳") && html.includes("ו׳–ש׳");

  // כשהערך זהה לשני החלקים — מוצג פעם אחת (בלי כפילות תגיות)
  const same = migrateRosterToV2(null);
  same.days["חמישי"].manager = "אותו מנהל";
  same.days["חמישי"].managerWknd = "אותו מנהל";
  await saveDutyRosterV2(same, "current");
  const savedSame = await getDutyRoster("current");
  const htmlSame = rosterBoardHtml(savedSame, "", "wide");
  // ערך זהה → בלי תגיות פיצול (ה׳ / ו׳–ש׳) בשורת המנהל, וחייל מופיע פעם אחת
  r.sameShownOnce = htmlSame.includes("אותו מנהל") && !htmlSame.includes("ו׳–ש׳");

  // שחזור עזר-העריכה: אחרי טעינה מחדש, יום "חמישי" מרכיב את חלק שישי–שבת
  const reload = await getDutyRoster("current");
  const thu = reload.days["חמישי"], fri = reload.days["שישי"]||{};
  thu.managerWknd = fri.manager || "";
  r.editorReconstruct = thu.managerWknd === "אותו מנהל";

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("מנהל חמישי נשמר ליום חמישי", out.thuManager, String(out.thuManager));
record("מנהל שישי–שבת נשמר ליום שישי", out.friManager, String(out.friManager));
record("מנהל שישי–שבת נשמר ליום שבת", out.satManager, String(out.satManager));
record("מתגבר חמישי נשמר נכון", out.thuAug, String(out.thuAug));
record("מתגבר שישי–שבת נשמר נכון", out.friAug, String(out.friAug));
record("שדות העזר (Wknd) לא נשמרים כשדה ליום", out.noHelperFields, String(out.noHelperFields));
record("הלוח מציג את שני חלקי הסופ״ש עם תגיות", out.boardShowsBoth, String(out.boardShowsBoth));
record("ערך זהה בשני החלקים → מוצג פעם אחת", out.sameShownOnce, String(out.sameShownOnce));
record("שחזור עזר-העריכה מיום שישי", out.editorReconstruct, String(out.editorReconstruct));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
