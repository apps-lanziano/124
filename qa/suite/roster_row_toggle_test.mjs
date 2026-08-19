/* השבתה ידנית של שורה בלוח צוות תורן: הקשה על כותרת שורה בעורך (למשל
   "PF") מסתירה אותה מהלוח לגמרי — גם אם יש בה שיבוץ בפועל. קריטי:
   הגדרה זו חייבת להיות מקומית ללוח הנערך בלבד (שדה roster.disabledRows,
   כמו restWindow/squadronDuty) — לא גלובלית. באג שתוקן: השבתה בעריכת
   לוח נוכחי הייתה "דולפת" לשבוע הבא ולארכיון. הבדיקות כאן מוודאות
   שהשבתה בשבוע אחד לא משפיעה על שבועות/ארכיון אחרים, ושהיא רק טיוטה
   עד שמירה/פרסום (כמו כל שדה אחר בעורך). וגם: כפתור "הוסף שורה מותאמת
   אישית ללוח" בתוך עורך הלוח עצמו. */
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

  // לוח עם PF מאויש בכל השבוע, ו-PF מושבת ידנית עליו בלבד (שדה מקומי)
  const draft = migrateRosterToV2(null);
  draft.days["ראשון"].pf = [{name:"חייל פ א"}];
  const htmlBefore = rosterBoardHtml(draft, "", "wide");
  r.pfShownBeforeToggle = htmlBefore.includes(">PF<") && htmlBefore.includes("חייל פ א");

  draft.disabledRows = ["pf"];
  const htmlAfter = rosterBoardHtml(draft, "", "wide");
  r.pfHiddenAfterDisable = !htmlAfter.includes(">PF<") && !htmlAfter.includes("חייל פ א");

  // *** הבדיקה הקריטית נגד הבאג: לוח אחר (לא זה עם disabledRows) לא מושפע ***
  const otherDraft = migrateRosterToV2(null);
  otherDraft.days["שני"].pf = [{name:"חייל פ ב"}];
  const htmlOther = rosterBoardHtml(otherDraft, "", "wide");
  r.otherRosterUnaffected = htmlOther.includes(">PF<") && htmlOther.includes("חייל פ ב");

  // הפעלה מחדש (מסירים מהמערך) — חוזר להופיע באותו לוח
  draft.disabledRows = [];
  const htmlReenabled = rosterBoardHtml(draft, "", "wide");
  r.pfShownAfterReenable = htmlReenabled.includes(">PF<") && htmlReenabled.includes("חייל פ א");

  // migrateRosterToV2/saveDutyRosterV2 משמרים disabledRows דרך שמירה וקריאה חוזרת
  const withDisabled = migrateRosterToV2(null);
  withDisabled.disabledRows = ["pf","pms"];
  await saveDutyRosterV2(withDisabled, "current");
  const reread = await getDutyRoster("current");
  r.persistedThroughSaveAndReread = Array.isArray(reread.disabledRows) &&
    reread.disabledRows.includes("pf") && reread.disabledRows.includes("pms");

  // *** הבדיקה הקריטית נגד הבאג: הארכיון קפוא — לא מושפע משינויים
  // מאוחרים יותר בהשבתות של הלוח הנוכחי החי ***
  const archiveSrc = migrateRosterToV2(null);
  archiveSrc.days["ראשון"].pf = [{name:"פ בארכיון"}];
  archiveSrc.disabledRows = [];   // בזמן הארכוב — PF פעיל ומוצג
  const arc = [{key:"test-archive-key", label:"שבוע בדיקה", savedAt:new Date().toISOString(), roster: archiveSrc}];
  await saveRosterArchive(arc);
  // אחרי הארכוב, משביתים PF בלוח הנוכחי החי — לא אמור לגעת בעותק בארכיון
  await saveDutyRosterV2((()=>{ const d=migrateRosterToV2(null); d.disabledRows=["pf"]; return d; })(), "current");
  const archived = (await getRosterArchive())[0];
  const archivedHtml = rosterBoardHtml(migrateRosterToV2(archived.roster), "", "wide");
  r.archiveUnaffectedByLaterCurrentChanges = archivedHtml.includes(">PF<") && archivedHtml.includes("פ בארכיון");

  // *** הבדיקה הקריטית נגד הבאג: השבתה בלוח הנוכחי לא דולפת ללוח הבא ***
  await saveDutyRosterV2(migrateRosterToV2(null), "next"); // מוודאים ש"הבא" מתחיל נקי
  const nextRoster = await getDutyRoster("next");
  r.nextWeekNotAffectedByCurrent = !(nextRoster.disabledRows||[]).includes("pf");

  // עורך הלוח — כותרת השורה כוללת כפתור נראה-לעין (לא רק טקסט לחיץ),
  // שמשקף מצב הפעלה/השבתה של rosterDraft הנוכחי בלבד.
  rosterDraft = draft;
  draft.disabledRows = [];
  rosterEditSlot = "current";
  rosterEdDay = "ראשון";
  await loadRosterCustomRows();
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
  // שהמשתמש עושה: מוצא את הלחצן וממש לוחץ עליו. ללא await — הפונקציה
  // כבר אינה אסינכרונית (מוטציה על הטיוטה בזיכרון בלבד, בלי רשת).
  btn1.click();
  const block2 = findPfBlock();
  const btn2 = block2 && block2.querySelector(".rblk-toggle-btn");
  r.editorToggleOffAfterClick = btn2 && btn2.classList.contains("off");
  r.draftMutatedNotGlobal = rosterDraft.disabledRows.includes("pf");

  // הקשה נוספת מפעילה מחדש
  btn2.click();
  r.disabledListClearedAfterSecondClick = !rosterDraft.disabledRows.includes("pf");

  // *** ההשבתה היא רק טיוטה — לא נשמרת עד "שמור"/"פרסם" ***
  await saveDutyRosterV2(migrateRosterToV2(null), "current"); // מאפסים ל"נוכחי" נקי לפני הבדיקה
  rosterDraft.disabledRows = ["pf"];
  renderRosterEditor();
  const savedCurrentBeforePublish = await getDutyRoster("current");
  r.notPersistedBeforeSave = !(savedCurrentBeforePublish.disabledRows||[]).includes("pf");

  // כפתור להוספת שורה מותאמת-אישית מופיע בתוך עורך הלוח עצמו
  const addBtn = [...document.querySelectorAll("#roster-ed-body button")].find(b=>b.textContent.includes("הוסף שורה מותאמת אישית"));
  r.addCustomRowButtonInEditor = !!addBtn;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("PF מוצג לפני השבתה", out.pfShownBeforeToggle, String(out.pfShownBeforeToggle));
record("PF מוסתר אחרי השבתה ידנית — גם עם שיבוץ בפועל", out.pfHiddenAfterDisable, String(out.pfHiddenAfterDisable));
record("🔒 באג נגד רגרסיה: לוח אחר לא מושפע מהשבתה בלוח הזה", out.otherRosterUnaffected, String(out.otherRosterUnaffected));
record("PF חוזר להופיע אחרי הפעלה מחדש", out.pfShownAfterReenable, String(out.pfShownAfterReenable));
record("disabledRows נשמר וניתן לקריאה חוזרת (migrate/save)", out.persistedThroughSaveAndReread, String(out.persistedThroughSaveAndReread));
record("🔒 באג נגד רגרסיה: הארכיון קפוא — לא מושפע מהשבתה מאוחרת יותר בנוכחי", out.archiveUnaffectedByLaterCurrentChanges, String(out.archiveUnaffectedByLaterCurrentChanges));
record("🔒 באג נגד רגרסיה: השבתה בלוח נוכחי לא דולפת ל'שבוע הבא'", out.nextWeekNotAffectedByCurrent, String(out.nextWeekNotAffectedByCurrent));
record("בעורך: כפתור השבתה קיים ליד כותרת PF", out.editorHasToggle, String(out.editorHasToggle));
record("הכפתור הוא אלמנט <button> אמיתי", out.editorToggleIsRealButtonTag, String(out.editorToggleIsRealButtonTag));
record("הכפתור נראה כמו כפתור (עם גבול) — לא רק טקסט", out.editorToggleLooksLikeButton, String(out.editorToggleLooksLikeButton));
record("בעורך: ברירת המחדל — פעיל (לא מסומן 'off')", out.editorToggleOnByDefault, String(out.editorToggleOnByDefault));
record("לחיצה בפועל על הכפתור מסמנת 'off' מיד", out.editorToggleOffAfterClick, String(out.editorToggleOffAfterClick));
record("הקשה מעדכנת את rosterDraft.disabledRows (לא הגדרה גלובלית)", out.draftMutatedNotGlobal, String(out.draftMutatedNotGlobal));
record("הקשה שנייה מפעילה מחדש", out.disabledListClearedAfterSecondClick, String(out.disabledListClearedAfterSecondClick));
record("🔒 באג נגד רגרסיה: השבתה בעורך היא טיוטה בלבד עד שמירה/פרסום", out.notPersistedBeforeSave, String(out.notPersistedBeforeSave));
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
