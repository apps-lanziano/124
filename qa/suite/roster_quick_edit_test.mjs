/* עריכה מהירה נקודתית מהלוח השבועי (לחיצה ארוכה על תא שלד) —
   openRosterQuickEdit/saveRosterQuickEdit. מכסה: סימון תאי-שלד (מנהל/
   ר״צ/ל-ר״צ/מטיס/נהג/כלים) בעמודות יום בודד בלבד כשמצב עריכה מהירה
   פעיל (isRosterManager + "לוח נוכחי" + תצוגה מוקטנת), ולעולם לא על
   עמודת "חמישי" הממוזגת (שני ערכים ארוזים בה) ולא כש-isRosterManager
   הוא false או שהשבוע המוצג אינו "נוכחי". וגם: השמירה בפועל כותבת
   לשדה הבודד בלוח הנוכחי, עם manualPush (pushedAt משתנה) בדיוק כמו
   עריכת לוח רגילה, כדי שהתראת roster_change תמשיך לעבוד כרגיל. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // מ״ע תורנויות בפועל — כדי ש-isRosterManager יהיה true
  user = "טל מלכה";
  await refreshAreaPermissions();

  const draft = migrateRosterToV2(null);
  draft.days["ראשון"].lead = "חייל א סככה 1";

  // 1) isRosterManager + לוח נוכחי + תצוגה מוקטנת -> תאי שלד מסומנים לעריכה מהירה
  const htmlOn = rosterBoardHtml(draft, "", "board", "current");
  r.rotatingDayHasQuickEdit = /data-qf="lead" data-qd="ראשון"/.test(htmlOn);
  // עמודת "חמישי" הממוזגת — לעולם לא מסומנת (שני ערכים ארוזים בתא אחד)
  r.thuColumnNeverQuickEdit = !/data-qf="manager" data-qd="חמישי"/.test(htmlOn);
  // שדה-רשימה (PF) — לא מסומן לעריכה מהירה (רק תאי שלד חד-ערכיים)
  r.listFieldNeverQuickEdit = !/data-qf="pf"/.test(htmlOn);

  // 2) לא מ״ע תורנויות -> אין סימון בכלל
  const savedUser = user;
  user = "מפקד סככה 1";
  await refreshAreaPermissions();
  const htmlNotMgr = rosterBoardHtml(draft, "", "board", "current");
  r.noQuickEditForNonManager = !htmlNotMgr.includes("data-qf=");
  user = savedUser; await refreshAreaPermissions();

  // 3) "שבוע הבא"/"שבוע שעבר" -> אין סימון (רק לוח נוכחי)
  const htmlNext = rosterBoardHtml(draft, "", "board", "next");
  r.noQuickEditOnNextWeek = !htmlNext.includes("data-qf=");

  // 4) "מסך מלא" (wide) -> אין סימון (עריכה מהירה מיועדת למובייל, לא לתצוגת מסך מלא)
  const htmlWide = rosterBoardHtml(draft, "", "wide", "current");
  r.noQuickEditOnWideMode = !htmlWide.includes("data-qf=");

  // 5) שמירה בפועל: פותחים עריכה מהירה על תא אמיתי (מנהל, יום שני),
  //    ומוודאים שהיא נכתבת ללוח הנוכחי בלבד עם manualPush
  await saveDutyRosterV2(migrateRosterToV2(null), "current");
  const before = await getDutyRoster("current");
  const beforePushedAt = before.pushedAt;

  const fakeTd = document.createElement("td");
  fakeTd.setAttribute("data-qf", "manager");
  fakeTd.setAttribute("data-qd", "שני");
  await openRosterQuickEdit(fakeTd);
  r.modalOpened = document.getElementById("roster-quick-modal").classList.contains("open");
  document.getElementById("rq-name-inp").value = "חייל חדש";
  await saveRosterQuickEdit();
  r.modalClosedAfterSave = !document.getElementById("roster-quick-modal").classList.contains("open");

  const after = await getDutyRoster("current");
  r.fieldSavedOnCorrectDay = after.days["שני"].manager === "חייל חדש";
  r.otherDaysUntouched = after.days["ראשון"].manager === "";
  r.pushedAtChanged = after.pushedAt !== beforePushedAt;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("יום סיבוב רגיל מסומן לעריכה מהירה (data-qf/data-qd)", out.rotatingDayHasQuickEdit, out.rotatingDayHasQuickEdit);
record("⛔ עמודת 'חמישי' הממוזגת לעולם לא מסומנת", out.thuColumnNeverQuickEdit, out.thuColumnNeverQuickEdit);
record("שדה-רשימה (PF) לא מסומן לעריכה מהירה", out.listFieldNeverQuickEdit, out.listFieldNeverQuickEdit);
record("מי שאינו מ״ע תורנויות לא רואה סימון עריכה מהירה", out.noQuickEditForNonManager, out.noQuickEditForNonManager);
record("אין עריכה מהירה על 'שבוע הבא'", out.noQuickEditOnNextWeek, out.noQuickEditOnNextWeek);
record("אין עריכה מהירה במצב 'מסך מלא'", out.noQuickEditOnWideMode, out.noQuickEditOnWideMode);
record("המודל נפתח בלחיצה", out.modalOpened, out.modalOpened);
record("המודל נסגר אחרי שמירה", out.modalClosedAfterSave, out.modalClosedAfterSave);
record("השדה נשמר ביום הנכון", out.fieldSavedOnCorrectDay, out.fieldSavedOnCorrectDay);
record("ימים אחרים לא נגעו", out.otherDaysUntouched, out.otherDaysUntouched);
record("pushedAt השתנה (manualPush — תואם התראת roster_change)", out.pushedAtChanged, out.pushedAtChanged);

console.log("\n=== SUMMARY ===");
results.forEach(x=>console.log((x.pass?"✅":"❌"), x.name, "-", x.detail));
const failed = results.filter(x=>!x.pass);
if(failed.length){ console.log(`\n${failed.length} FAILED`); process.exitCode = 1; }
else console.log("\nALL TESTS PASSED");

await closeBrowser();
