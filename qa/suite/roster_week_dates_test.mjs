/* ⛔ התאריכים של לוח הצוות הם נתון על הלוח (`weekStart`) — לא היסק מ"היום".
   הבאג: כל תצוגת תאריך נגזרה מ"ראשון של השבוע הנוכחי + היסט הסלוט", ולכן
   לוח בארכיון הוצג עם התאריכים של השבוע שבו במקרה פתחו אותו, ולוח עתידי
   שקודם ל"נוכחי" באמצע שבוע קלנדרי הציג את תאריכי השבוע הישן — נתונים
   אמיתיים עם תאריכים שגויים.

   נבדק כאן:
   1. weekStart נשמר ונטען עם הלוח (migrate/save).
   2. בורר שבוע ב"בניית לוח עתידי" — כל תאריך נצמד לראשון (לוח = ראשון→שבת).
   3. הלוח מציג את התאריכים של weekStart, כולל קידום מוקדם ("שבוע הבא"
      שהפך לנוכחי לפני שהשבוע הקלנדרי התחלף).
   4. לוח "נוכחי" עם weekStart ישן (לא סובב) — מוצג עם תאריכי השבוע הנוכחי.
   5. ארכיון: התאריכים קפואים עם הלוח, כפתור "הצג לוח", ושחזור ל"שבוע שעבר".
   6. הרוטציה האוטומטית לא מקדמת לוח שנבנה לשבוע שטרם הגיע.
   7. מחיקת שורה מותאמת-אישית ישירות מעורך הלוח. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  user = "טל מלכה";                 // מ״ע תורנויות בפועל
  await refreshAreaPermissions();
  window.confirm = ()=>true;

  const thisSun = rosterWeekSundayIso("current");
  const nextSun = rosterWeekSundayIso("next");

  // --- 1. weekStart שורד שמירה/טעינה ---
  {
    const b = migrateRosterToV2(null);
    b.weekStart = "2026-09-02";      // יום רביעי — חייב להיצמד לראשון
    b.days["ראשון"].lead = "ר״צ א";
    await saveDutyRosterV2(b, "current");
    const back = await getDutyRoster("current");
    r.weekStartPersisted = back.weekStart === sundayIsoOf("2026-09-02");
    r.weekStartSnapsToSunday = back.weekStart === "2026-08-30";
  }

  // --- 2. בורר השבוע בעורך "בניית לוח עתידי" ---
  await openRosterEditor(null, "next");
  r.pickerOnlyInFuture = document.getElementById("roster-ed-week").innerHTML.includes("שבוע הלוח");
  r.futureDefaultsToNextWeek = rosterDraft.weekStart === nextSun;
  setRosterDraftWeek(isoAddDays(nextSun, 10));            // אמצע שבוע, שבועיים קדימה
  r.pickerSnapsToSunday = rosterDraft.weekStart === isoAddDays(nextSun, 7);
  shiftRosterDraftWeek(-1);
  r.shiftMovesOneWeek = rosterDraft.weekStart === nextSun;
  // התאריכים בעורך (טווח ימים לתורנות בסיסית) נגזרים מהשבוע שנבחר
  shiftRosterDraftWeek(1);
  const pickedSun = rosterDraft.weekStart;
  r.editorDatesFollowPick = rosterDayLockDates("ראשון", rosterEditWeekRef())[0] === pickedSun;
  // מחיקת כל הלוח לא מאבדת את השבוע שנבחר
  clearRosterDraft();
  r.clearKeepsWeek = rosterDraft.weekStart === pickedSun;
  document.getElementById("duty-roster-modal").classList.remove("open");

  // בעריכת "לוח נוכחי" אין בורר שבוע (הוא בהגדרה השבוע שרץ)
  await openRosterEditor(null, "current");
  r.noPickerInCurrent = !document.getElementById("roster-ed-week").innerHTML.includes("שבוע הלוח");
  document.getElementById("duty-roster-modal").classList.remove("open");

  const dOf = iso => fmtHeShort(iso);

  // --- 3. קידום מוקדם: לוח שנבנה לשבוע הבא והפך לנוכחי לפני מעבר השבוע ---
  {
    const b = migrateRosterToV2(null);
    b.weekStart = nextSun;
    b.days["ראשון"].lead = "ר״צ עתידי";
    const html = rosterBoardHtml(b, "", "wide", "current");
    r.promotedShowsRealDates = html.includes(dOf(nextSun)) && !html.includes(">"+dOf(thisSun)+"<");
    // גם בכרטיסי היום (לוח יומי)
    boardWeekSlot = "current";
    r.promotedCardsShowRealDates = rosterCardsHtml(b, "").includes(dOf(nextSun));
  }

  // --- 4. לוח נוכחי עם weekStart ישן (לא סובב) — תאריכי השבוע הנוכחי ---
  {
    const b = migrateRosterToV2(null);
    b.weekStart = isoAddDays(thisSun, -21);
    b.days["ראשון"].lead = "ר״צ ישן";
    const html = rosterBoardHtml(b, "", "wide", "current");
    r.staleCurrentShowsThisWeek = html.includes(dOf(thisSun)) && !html.includes(dOf(isoAddDays(thisSun,-21)));
  }

  // --- 5. ארכיון: תאריכים קפואים + הצגה + שחזור ל"שבוע שעבר" ---
  {
    // 5א. שמירה לארכיון של לוח שקודם מוקדם — נשמר תחת השבוע שהוא מתאר
    const promoted = migrateRosterToV2(null);
    promoted.weekStart = nextSun;
    promoted.days["ראשון"].lead = "ר״צ שקודם";
    await saveDutyRosterV2(promoted, "current");
    await saveRosterArchive([]);
    await archiveNow();
    const arc0 = await getRosterArchive();
    r.archiveKeyIsBoardWeek = arc0.length === 1 && arc0[0].key === nextSun;
    r.archiveLabelIsBoardWeek = arc0[0].label === weekRangeLabelOf(nextSun);
    r.archiveRosterCarriesWeek = arc0[0].roster.weekStart === nextSun;

    // 5ב. רשומה ישנה בארכיון (שבועיים אחורה) — כולל רשומת legacy בלי
    //     weekStart על הלוח, שהתאריכים שלה נגזרים ממפתח הרשומה.
    const oldSun = isoAddDays(thisSun, -14);
    const legacy = migrateRosterToV2(null);
    legacy.days["ראשון"].lead = "ר״צ מהארכיון";
    legacy.weekStart = "";                      // לוח שנשמר לפני שהשדה קיים
    await saveRosterArchive([{key: oldSun, label: weekRangeLabelOf(oldSun),
      savedAt: new Date().toISOString(), roster: legacy}]);

    await renderRosterArchiveList();
    const listHtml = document.getElementById("roster-archive-body").innerHTML;
    r.archiveHasViewButton = listHtml.includes("הצג לוח");
    r.archiveHasPrevButton = listHtml.includes("שבוע שעבר");
    r.archiveRowShowsRealRange = listHtml.includes(weekRangeLabelOf(oldSun));

    viewArchivedRoster(0);
    const fullHtml = document.getElementById("roster-full-inner").innerHTML;
    r.archiveViewShowsFrozenDates = fullHtml.includes(dOf(oldSun)) && !fullHtml.includes(dOf(thisSun));
    r.archiveViewTitleRange = document.getElementById("roster-full-title").textContent.includes(weekRangeLabelOf(oldSun));
    closeRosterFull();

    // "שבוע שעבר" נמחק → משחזרים מהארכיון בלי לגעת בלוח הנוכחי
    await saveDutyRosterV2(migrateRosterToV2(null), "prev");
    const liveCur = migrateRosterToV2(null); liveCur.days["שני"].lead = "הלוח שרץ";
    await saveDutyRosterV2(liveCur, "current");
    await restoreArchivedToPrev(0);
    const prev = await getDutyRoster("prev");
    r.restoredToPrev = prev.days["ראשון"].lead === "ר״צ מהארכיון";
    r.restoredPrevKeepsDates = prev.weekStart === oldSun;
    r.restoreToPrevKeepsCurrent = (await getDutyRoster("current")).days["שני"].lead === "הלוח שרץ";
  }

  // --- 6. הרוטציה לא מקדמת לוח שנבנה לשבוע שטרם הגיע ---
  {
    const cur = migrateRosterToV2(null); cur.days["ראשון"].lead = "נוכחי";
    const far = migrateRosterToV2(null);
    far.days["ראשון"].lead = "רחוק";
    far.weekStart = isoAddDays(thisSun, 14);      // שבועיים קדימה
    await saveDutyRosterV2(cur, "current"); await saveDutyRosterV2(far, "next");
    _rotateTried = false; await sSetRaw("board_rotated_week", "2000-01-02");
    await maybeRotateWeek();
    r.futureWeekNotPromotedEarly = (await getDutyRoster("current")).days["ראשון"].lead === "נוכחי";

    const due = migrateRosterToV2(null);
    due.days["ראשון"].lead = "הגיע תורו";
    due.weekStart = thisSun;
    await saveDutyRosterV2(due, "next");
    _rotateTried = false; await sSetRaw("board_rotated_week", "2000-01-02");
    await maybeRotateWeek();
    r.dueWeekStillRotates = (await getDutyRoster("current")).days["ראשון"].lead === "הגיע תורו";
  }

  // --- 7. מחיקת שורה מותאמת-אישית מתוך עורך הלוח ---
  {
    await saveRosterCustomRows([{id:"cr_test1", label:"PF יום בלבד", afterKey:"pf"}]);
    await openRosterEditor(null, "next");
    const edHtml = document.getElementById("roster-ed-body").innerHTML;
    r.editorHasDeleteForCustomRow = edHtml.includes("deleteRosterCustomRow('cr_test1')");
    await deleteRosterCustomRow("cr_test1");
    r.customRowDeletedFromEditor = !(rosterCustomRows||[]).some(c=>c.id==="cr_test1");
    document.getElementById("duty-roster-modal").classList.remove("open");
  }

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("weekStart נשמר ונטען עם הלוח", out.weekStartPersisted, String(out.weekStartPersisted));
record("weekStart נצמד לראשון (לוח = ראשון→שבת)", out.weekStartSnapsToSunday, String(out.weekStartSnapsToSunday));
record("בורר שבוע קיים ב'בניית לוח עתידי'", out.pickerOnlyInFuture, String(out.pickerOnlyInFuture));
record("לוח עתידי נפתח כברירת מחדל על השבוע הבא", out.futureDefaultsToNextWeek, String(out.futureDefaultsToNextWeek));
record("בחירת תאריך באמצע שבוע נצמדת לראשון", out.pickerSnapsToSunday, String(out.pickerSnapsToSunday));
record("חיצי ‹ › מזיזים שבוע שלם", out.shiftMovesOneWeek, String(out.shiftMovesOneWeek));
record("תאריכי העורך נגזרים מהשבוע שנבחר", out.editorDatesFollowPick, String(out.editorDatesFollowPick));
record("'מחק את כל הלוח' לא מאבד את השבוע שנבחר", out.clearKeepsWeek, String(out.clearKeepsWeek));
record("אין בורר שבוע בעריכת הלוח הנוכחי", out.noPickerInCurrent, String(out.noPickerInCurrent));
record("⛔ קידום מוקדם — הלוח מציג את התאריכים האמיתיים שלו", out.promotedShowsRealDates, String(out.promotedShowsRealDates));
record("⛔ קידום מוקדם — גם ב'לוח יומי'", out.promotedCardsShowRealDates, String(out.promotedCardsShowRealDates));
record("לוח נוכחי שלא סובב מוצג עם תאריכי השבוע הנוכחי", out.staleCurrentShowsThisWeek, String(out.staleCurrentShowsThisWeek));
record("ארכיון: המפתח לפי שבוע הלוח, לא לפי 'היום'", out.archiveKeyIsBoardWeek, String(out.archiveKeyIsBoardWeek));
record("ארכיון: התווית לפי שבוע הלוח", out.archiveLabelIsBoardWeek, String(out.archiveLabelIsBoardWeek));
record("ארכיון: הלוח השמור נושא את התאריכים שלו", out.archiveRosterCarriesWeek, String(out.archiveRosterCarriesWeek));
record("ארכיון: כפתור 'הצג לוח'", out.archiveHasViewButton, String(out.archiveHasViewButton));
record("ארכיון: כפתור שחזור ל'שבוע שעבר'", out.archiveHasPrevButton, String(out.archiveHasPrevButton));
record("ארכיון: השורה מציגה את טווח התאריכים האמיתי", out.archiveRowShowsRealRange, String(out.archiveRowShowsRealRange));
record("⛔ ארכיון: התאריכים בלוח קפואים (לא של השבוע הנוכחי)", out.archiveViewShowsFrozenDates, String(out.archiveViewShowsFrozenDates));
record("ארכיון: כותרת הצפייה מציגה את טווח השבוע", out.archiveViewTitleRange, String(out.archiveViewTitleRange));
record("שחזור מהארכיון ל'שבוע שעבר' עובד", out.restoredToPrev, String(out.restoredToPrev));
record("שחזור ל'שבוע שעבר' משמר את התאריכים", out.restoredPrevKeepsDates, String(out.restoredPrevKeepsDates));
record("שחזור ל'שבוע שעבר' לא נוגע בלוח הנוכחי", out.restoreToPrevKeepsCurrent, String(out.restoreToPrevKeepsCurrent));
record("רוטציה לא מקדמת לוח לשבוע שטרם הגיע", out.futureWeekNotPromotedEarly, String(out.futureWeekNotPromotedEarly));
record("רוטציה כן מקדמת לוח שהשבוע שלו הגיע", out.dueWeekStillRotates, String(out.dueWeekStillRotates));
record("עורך הלוח: כפתור מחיקה לשורה מותאמת-אישית", out.editorHasDeleteForCustomRow, String(out.editorHasDeleteForCustomRow));
record("עורך הלוח: המחיקה מסירה את השורה בפועל", out.customRowDeletedFromEditor, String(out.customRowDeletedFromEditor));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
