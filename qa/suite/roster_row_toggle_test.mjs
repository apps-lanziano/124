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

  // עורך הלוח — כותרת השורה כוללת כפתור נראה-לעין (לא רק טקסט לחיץ),
  // שמשקף מצב הפעלה/השבתה. מאתרים את הבלוק לפי הכותרת "PF" (לא PMS),
  // ואת הכפתור בתוכו.
  rosterDraft = draft;
  rosterEditSlot = "current";
  rosterEdDay = "ראשון";
  await loadRosterCustomRows(); await loadRosterDisabledRows();
  renderRosterEditor();
  const findPfBlock = () => [...document.querySelectorAll(".rblk-h")].find(el=>
    el.querySelector(".rblk-toggle-lbl") && el.textContent.includes("PF") && !el.textContent.includes("PMS"));
  const block1 = findPfBlock();
  const btn1 = block1 && block1.querySelector(".rblk-toggle-btn");
  r.editorHasToggle = !!btn1;
  r.editorToggleOnByDefault = btn1 && !btn1.classList.contains("off");
  // הכפתור הוא אלמנט <button> אמיתי עם גבול נראה — לא רק טקסט לחיץ בלתי מובחן
  r.editorToggleIsRealButtonTag = btn1 && btn1.tagName === "BUTTON";
  const cs1 = btn1 && getComputedStyle(btn1);
  r.editorToggleLooksLikeButton = !!(cs1 && parseFloat(cs1.borderWidth) > 0);

  // הקשה בפועל על הכפתור (לא רק קריאה לפונקציה) — מדמה בדיוק את מה
  // שהמשתמש עושה: מוצא את הלחצן וממש לוחץ עליו.
  btn1.click();
  await new Promise(res=>setTimeout(res, 60));
  const block2 = findPfBlock();
  const btn2 = block2 && block2.querySelector(".rblk-toggle-btn");
  r.editorToggleOffAfterClick = btn2 && btn2.classList.contains("off");
  r.disabledListUpdated = rosterDisabledRows.includes("pf");

  // הקשה נוספת מפעילה מחדש
  btn2.click();
  await new Promise(res=>setTimeout(res, 60));
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
record("בעורך: כפתור השבתה קיים ליד כותרת PF", out.editorHasToggle, String(out.editorHasToggle));
record("הכפתור הוא אלמנט <button> אמיתי", out.editorToggleIsRealButtonTag, String(out.editorToggleIsRealButtonTag));
record("הכפתור נראה כמו כפתור (עם גבול) — לא רק טקסט", out.editorToggleLooksLikeButton, String(out.editorToggleLooksLikeButton));
record("בעורך: ברירת המחדל — פעיל (לא מסומן 'off')", out.editorToggleOnByDefault, String(out.editorToggleOnByDefault));
record("לחיצה בפועל על הכפתור מסמנת 'off' מיד", out.editorToggleOffAfterClick, String(out.editorToggleOffAfterClick));
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
