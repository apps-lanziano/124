/* שורות מותאמות-אישית בלוח צוות תורן: הוספה ידנית ע"י מ"ע תורנויות,
   כולל קביעת מיקום בלוח, ושמירה/קריאה מהאחסון בלי איבוד הנתונים
   (migrateRosterToV2 חייב לשמר שדות custom_<id>). הצגה נשלטת רק ע"י
   ההשבתה הידנית (disabledRows) — שורה ריקה עדיין מוצגת (ר' באג אמיתי:
   הסתרה אוטומטית-לפי-נתונים גרמה ללוח "חצי" למשתמשים שהעבירו שיבוץ
   משדה סטנדרטי לשורה מותאמת-אישית). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // הגדרת שתי שורות מותאמות-אישית: אחת בתחילת הלוח, אחת אחרי "מטיס"
  const rows = [
    {id:"cr_kitchen", label:"רכב תורן", afterKey:"pilot"},
    {id:"cr_first",   label:"תדריך בוקר", afterKey:"__start__"},
  ];
  await saveRosterCustomRows(rows);
  r.savedLoaded = rosterCustomRows.length === 2;

  // שורה ריקה (אין שיבוץ באף יום) — עדיין מוצגת בלוח (עם תאים ריקים);
  // הצגה נשלטת רק ע"י ההשבתה הידנית, לא ע"י כמות השיבוץ בפועל
  const empty = migrateRosterToV2(null);
  empty.days["ראשון"].pilot = "מטיס א";
  const htmlEmpty = rosterBoardHtml(empty, "", "wide");
  r.emptyCustomShown = htmlEmpty.includes("רכב תורן") && htmlEmpty.includes("תדריך בוקר");

  // שיבוץ שם בשורה המותאמת-אישית — מוצגת עם השם, ובמיקום הנכון
  const draft = migrateRosterToV2(null);
  draft.days["ראשון"].pilot = "מטיס א";
  draft.days["ראשון"]["custom_cr_kitchen"] = ["נהג תורן א"];
  draft.days["שני"]["custom_cr_first"] = ["קצין תורן א"];
  const html = rosterBoardHtml(draft, "", "wide");
  r.customShown = html.includes("רכב תורן") && html.includes("נהג תורן א");
  r.customShown2 = html.includes("תדריך בוקר") && html.includes("קצין תורן א");
  const idx = s => html.indexOf(s);
  r.afterPilotPos = idx(">מטיס<") < idx("רכב תורן") && idx("רכב תורן") < idx(">נהג<");
  r.startPos = idx("תדריך בוקר") < idx(">מנהל<");

  // migrateRosterToV2 משמר custom_<id> אחרי שמירה וקריאה חוזרת (לא נמחק)
  const ok = await saveDutyRosterV2(draft);
  const reread = await getDutyRoster();
  r.saved = ok !== false;
  r.persistedAfterReread = Array.isArray(reread.days["ראשון"]["custom_cr_kitchen"]) &&
    reread.days["ראשון"]["custom_cr_kitchen"].includes("נהג תורן א");

  // עריכת שורה קיימת (שינוי תווית ומיקום) דרך טופס הניהול
  rosterCustomRowEditId = "cr_kitchen";
  document.getElementById("roster-customrows-modal") // ודא שהמודל קיים ב-DOM לפני רינדור טופס
    ?.classList.add("open");
  renderRosterCustomRowsMgr();
  document.getElementById("roster-customrow-label").value = "רכב תורן מעודכן";
  document.getElementById("roster-customrow-anchor").value = "__start__";
  await saveRosterCustomRowForm();
  r.editedLabel = rosterCustomRows.find(c=>c.id==="cr_kitchen").label === "רכב תורן מעודכן";
  r.editedAnchor = rosterCustomRows.find(c=>c.id==="cr_kitchen").afterKey === "__start__";

  // מחיקת שורה — נעלמת מרשימת ההגדרות
  window.confirm = ()=>true;
  await deleteRosterCustomRow("cr_first");
  r.deleted = rosterCustomRows.length === 1;

  // *** באג אמיתי שדווח: שורה חדשה שנוצרת תוך כדי בניית "שבוע הבא"
  // הופיעה ריקה גם ב"שבוע נוכחי" (ובשבוע שעבר) — כי ברירת המחדל של
  // disabledRows היא "לא מושבת = מוצג". מ-saveRosterCustomRowForm
  // חייבת להשבית את השורה החדשה מראש בכל שבוע קיים אחר, ולא לגעת
  // בשבוע שבו היא נוצרה בפועל. ***
  await saveDutyRosterV2(migrateRosterToV2(null), "current");
  await saveDutyRosterV2(migrateRosterToV2(null), "next");
  await saveDutyRosterV2(migrateRosterToV2(null), "prev");
  rosterEditSlot = "next";
  rosterCustomRows = [...rosterCustomRows, {id:"cr_new_test", label:"שורה חדשה בבנייה", afterKey:"__start__"}];
  await seedNewCustomRowDisabledElsewhere("cr_new_test");
  const curAfterSeed = await getDutyRoster("current");
  const nextAfterSeed = await getDutyRoster("next");
  const prevAfterSeed = await getDutyRoster("prev");
  r.seededDisabledOnCurrent = (curAfterSeed.disabledRows||[]).includes("cr_new_test");
  r.seededDisabledOnPrev = (prevAfterSeed.disabledRows||[]).includes("cr_new_test");
  r.notDisabledOnEditingSlot = !(nextAfterSeed.disabledRows||[]).includes("cr_new_test");
  // הלוח בפועל: לא מוצגת ריקה ב"נוכחי", אבל כן מוצגת (מופעלת כברירת מחדל) ב"הבא"
  r.newRowHiddenOnCurrentBoard = !rosterBoardHtml(curAfterSeed, "", "wide").includes("שורה חדשה בבנייה");
  r.newRowShownOnEditingBoard = rosterBoardHtml(nextAfterSeed, "", "wide").includes("שורה חדשה בבנייה");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("הגדרות שורות מותאמות-אישית נשמרות ונטענות", out.savedLoaded, String(out.savedLoaded));
record("שורה מותאמת-אישית ריקה כל השבוע עדיין מוצגת (הצגה = לפי המתג בלבד)", out.emptyCustomShown, String(out.emptyCustomShown));
record("שורה מותאמת-אישית מוצגת עם שיבוץ בפועל", out.customShown, String(out.customShown));
record("שורה שנייה (מיקום שונה) מוצגת עם שיבוץ", out.customShown2, String(out.customShown2));
record("מיקום: שורה שעוגנה אחרי 'מטיס' מופיעה שם", out.afterPilotPos, String(out.afterPilotPos));
record("מיקום: שורה שעוגנה בתחילת הלוח מופיעה ראשונה", out.startPos, String(out.startPos));
record("שמירת הלוח הצליחה", out.saved, String(out.saved));
record("שדה custom_<id> נשמר ולא נמחק אחרי קריאה חוזרת (migrateRosterToV2)", out.persistedAfterReread, String(out.persistedAfterReread));
record("עריכת שורה קיימת מעדכנת תווית", out.editedLabel, String(out.editedLabel));
record("עריכת שורה קיימת מעדכנת מיקום", out.editedAnchor, String(out.editedAnchor));
record("מחיקת שורה מסירה אותה מההגדרות", out.deleted, String(out.deleted));
record("🔒 באג נגד רגרסיה: שורה חדשה מושבתת מראש בשבוע נוכחי", out.seededDisabledOnCurrent, String(out.seededDisabledOnCurrent));
record("🔒 באג נגד רגרסיה: שורה חדשה מושבתת מראש בשבוע שעבר", out.seededDisabledOnPrev, String(out.seededDisabledOnPrev));
record("שורה חדשה נשארת מופעלת בשבוע שבו נוצרה", out.notDisabledOnEditingSlot, String(out.notDisabledOnEditingSlot));
record("שורה חדשה לא מופיעה ריקה בלוח השבוע הנוכחי", out.newRowHiddenOnCurrentBoard, String(out.newRowHiddenOnCurrentBoard));
record("שורה חדשה כן מופיעה בלוח השבוע שבו נוצרה", out.newRowShownOnEditingBoard, String(out.newRowShownOnEditingBoard));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
