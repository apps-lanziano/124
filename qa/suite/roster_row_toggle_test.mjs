/* השבתה ידנית של שורה בלוח צוות תורן: הקשה על כותרת שורה בעורך (למשל
   "PF") מסתירה אותה מהלוח לגמרי — גם אם יש בה שיבוץ בפועל. הגדרה
   גלובלית: אותה השפעה גם על עריכת הלוח הנוכחי וגם על העתידי. וגם:
   כפתור "הוסף שורה מותאמת אישית ללוח" בתוך עורך הלוח עצמו. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // מ"ע התורנויות בפועל (ברירת המחדל ב-ROSTER_MANAGERS_DEFAULT) — כדי
  // ש-isRosterManager יהיה true (מפקד-הבדיקה הרגיל אינו ברשימה).
  user = "טל מלכה";
  await refreshAreaPermissions();

  // לוח עם PF מאויש בכל השבוע
  const draft = migrateRosterToV2(null);
  draft.days["ראשון"].pf = [{name:"חייל פ א"}];
  const htmlBefore = rosterBoardHtml(draft, "", "wide");
  r.pfShownBeforeToggle = htmlBefore.includes(">PF<") && htmlBefore.includes("חייל פ א");

  // השבתה ידנית — מוסתר מהלוח למרות שיש שיבוץ בפועל
  await saveRosterDisabledRows(["pf"]);
  const htmlAfter = rosterBoardHtml(draft, "", "wide");
  r.pfHiddenAfterDisable = !htmlAfter.includes(">PF<") && !htmlAfter.includes("חייל פ א");

  // הגדרה גלובלית — אותה השפעה גם על לוח עתידי (לא תלוי ב-slot)
  const draftNext = migrateRosterToV2(null);
  draftNext.days["שני"].pf = [{name:"חייל פ ב"}];
  const htmlNext = rosterBoardHtml(draftNext, "", "wide", "next");
  r.pfHiddenInFutureToo = !htmlNext.includes(">PF<");

  // הפעלה מחדש — חוזר להופיע
  await saveRosterDisabledRows([]);
  const htmlReenabled = rosterBoardHtml(draft, "", "wide");
  r.pfShownAfterReenable = htmlReenabled.includes(">PF<") && htmlReenabled.includes("חייל פ א");

  // עורך הלוח — כותרת השורה ניתנת להקשה, ומשקפת מצב הפעלה/השבתה
  rosterDraft = draft;
  rosterEditSlot = "current";
  rosterEdDay = "ראשון";
  await loadRosterCustomRows(); await loadRosterDisabledRows();
  renderRosterEditor();
  const toggle = [...document.querySelectorAll(".rblk-toggle")].find(el=>el.textContent.includes("PF") && !el.textContent.includes("PMS"));
  r.editorHasToggle = !!toggle;
  r.editorToggleOnByDefault = toggle && !toggle.classList.contains("off");

  // הקשה על הכותרת משביתה, ומעדכנת את התצוגה מיד (קוראים לפונקציה
  // ישירות עם await — אותה פונקציה שה-onclick מפעיל — כדי לוודא שהבדיקה
  // ממתינה לשרשרת האסינכרונית המלאה, לא רק לזמן קבוע).
  await toggleRosterRowDisabled("pf");
  const toggleAfter = [...document.querySelectorAll(".rblk-toggle")].find(el=>el.textContent.includes("PF") && !el.textContent.includes("PMS"));
  r.editorToggleOffAfterClick = toggleAfter && toggleAfter.classList.contains("off");
  r.disabledListUpdated = rosterDisabledRows.includes("pf");

  // הקשה נוספת מפעילה מחדש
  await toggleRosterRowDisabled("pf");
  r.disabledListClearedAfterSecondClick = !rosterDisabledRows.includes("pf");

  // כפתור להוספת שורה מותאמת-אישית מופיע בתוך עורך הלוח עצמו
  const addBtn = [...document.querySelectorAll("#roster-ed-body button")].find(b=>b.textContent.includes("הוסף שורה מותאמת אישית"));
  r.addCustomRowButtonInEditor = !!addBtn;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("PF מוצג לפני השבתה", out.pfShownBeforeToggle, String(out.pfShownBeforeToggle));
record("PF מוסתר אחרי השבתה ידנית — גם עם שיבוץ בפועל", out.pfHiddenAfterDisable, String(out.pfHiddenAfterDisable));
record("ההשבתה גלובלית — משפיעה גם על לוח עתידי", out.pfHiddenInFutureToo, String(out.pfHiddenInFutureToo));
record("PF חוזר להופיע אחרי הפעלה מחדש", out.pfShownAfterReenable, String(out.pfShownAfterReenable));
record("בעורך: כותרת PF ניתנת להקשה", out.editorHasToggle, String(out.editorHasToggle));
record("בעורך: ברירת המחדל — פעיל (לא מסומן 'off')", out.editorToggleOnByDefault, String(out.editorToggleOnByDefault));
record("הקשה על הכותרת מסמנת 'off' מיד", out.editorToggleOffAfterClick, String(out.editorToggleOffAfterClick));
record("הקשה מעדכנת את rosterDisabledRows", out.disabledListUpdated, String(out.disabledListUpdated));
record("הקשה שנייה מפעילה מחדש", out.disabledListClearedAfterSecondClick, String(out.disabledListClearedAfterSecondClick));
record("כפתור 'הוסף שורה מותאמת אישית' קיים בתוך עורך הלוח", out.addCustomRowButtonInEditor, String(out.addCustomRowButtonInEditor));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
