/* מסך התורנויות — שלוש התצוגות (לוח / יום / רק אני) והרשאת העריכה.
   העריכה שמורה למ"ע תורנויות בלבד (roster_managers או נע"ת ייעודי);
   כל השאר רואים אך לא עורכים. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "חייל");

const out = await page.evaluate(async ()=>{
  const r = {};
  const me = user;

  // זורעים לוח שבו החייל המחובר משובץ ביום שני וגם בסופ"ש
  const draft = migrateRosterToV2(null);
  draft.squadronDuty = "shed1";
  const mon = draft.days["שני"];
  mon.lead = "חייל ב סככה 1"; mon.tools = "חייל ג סככה 1";
  mon.pf = [{name: me}, {name:"חייל ד סככה 1", course:true}];
  mon.pfRest = ["חייל ה סככה 1"];
  mon.reserve = ["מיל בדיקה"];
  mon.basic = [{name:"חייל ג סככה 1", type:"מטבח"}];
  mon.fixedAug = ["חייל ו סככה 1"];
  mon.pms = ["חייל ז סככה 1"];
  const thu = draft.days["חמישי"];
  thu.lead = me; thu.tools = "חייל ב סככה 1"; thu.pf = [{name:"חייל ב סככה 1"}];
  await saveDutyRosterV2(draft);

  go("scr-board", null);
  await renderBoard();

  // חייל רגיל — אין באנרי עריכה כלל
  r.editHiddenForSoldier = !document.querySelector(".roster-mgr-banners");
  r.isManager = isRosterManager;

  // תצוגת לוח
  setRosterView("board"); await renderRosterView();
  const boardHtml = document.getElementById("roster-view").innerHTML;
  r.hasGrid       = !!document.querySelector(".roster-grid");
  r.hasRoleRows   = ["ר״צ","מתגבר","כלים","PF","נחים","מילואים","PMS","תורנות"].every(x=>boardHtml.includes(x));
  // שורה קבוצתית ריקה בכל השבוע (PMS נחים לא שובץ בתרחיש הזה) — עדיין
  // מוצגת (הצגה נשלטת רק ע"י השבתה ידנית, לא ע"י שיבוץ בפועל)
  r.pmsRestShownEvenEmpty = boardHtml.includes("PMS נחים");
  r.hasReserveName= !!document.querySelector(".roster-grid .rc.res");
  r.hasSquadron   = boardHtml.includes("תורן טייסת");
  r.hasCourseChip = !!document.querySelector(".roster-grid .rc.course");
  r.hasMeChip     = !!document.querySelector(".roster-grid .rc.me");
  r.wkndNoRest    = boardHtml.includes("רצוף");
  /* כל השבוע במסמך אחד: כל שש העמודות (א׳–ד׳ + משמרת ה׳–ש׳) מוצגות
     יחד בלי גלילה לצדדים — ככה משתמשים בלוח בפועל היום. */
  r.colCount      = document.querySelectorAll(".roster-grid thead th").length;   // 1 תווית + 5 עמודות
  r.isFit         = !!document.querySelector(".roster-grid.fit");
  r.gridFitsWidth = (()=>{
    const t = document.querySelector(".roster-grid");
    const w = document.querySelector(".roster-grid-wrap");
    return t && w ? t.scrollWidth <= w.clientWidth + 1 : false;
  })();
  r.hasFullBtn    = !!document.querySelector(".roster-full-btn");
  // תאריך יומי בכותרת כל עמודה (למשל 17.8)
  r.headerDates   = [...document.querySelectorAll(".roster-grid thead th small")]
                      .filter(s=>/\d+\.\d+/.test(s.textContent)).length >= 5;

  // מסך מלא — כל הלוח בשמות מלאים, עם זום
  await openRosterFull();
  r.fullOpen      = document.getElementById("roster-full").classList.contains("open");
  const fullHtml  = document.getElementById("roster-full-inner").innerHTML;
  r.fullWide      = fullHtml.includes('roster-grid wide');
  r.fullFullNames = fullHtml.includes("חייל ד סככה 1");
  r.fullHasZoom   = !!document.getElementById("roster-full-ctrl");
  closeRosterFull();
  r.fullClosed    = !document.getElementById("roster-full").classList.contains("open");

  // תצוגת יום — שם מלא + מגבלת הזמינות כטקסט
  setRosterView("day","שני"); await renderRosterView();
  const dayHtml = document.getElementById("roster-view").innerHTML;
  r.dayFullName   = dayHtml.includes("חייל ד סככה 1");
  r.dayCourseText = dayHtml.includes("עד 20:00");
  r.dayRestWindow = dayHtml.includes("14:00-16:00");

  // סופ"ש — הסבר מפורש שזו משמרת רצופה
  setRosterView("day","חמישי"); await renderRosterView();
  const wkHtml = document.getElementById("roster-view").innerHTML;
  r.wkndExplained = wkHtml.includes("משמרת רצופה");

  // רק אני — הימים שבהם אני משובץ, עם התפקיד
  setRosterView("mine"); await renderRosterView();
  const mineHtml = document.getElementById("roster-view").innerHTML;
  r.mineHasMon = mineHtml.includes("ב׳");        // ימים כאותיות בכל לשונית
  r.mineHasWk  = mineHtml.includes("ה׳–ש׳");
  r.mineHasPf  = mineHtml.includes("PF");
  r.mineHasLead= mineHtml.includes("ר״צ");

  // הרשאה: עריכה חסומה לחייל רגיל
  let toasted = ""; window.toast = m=>toasted=m;
  await openRosterEditor();
  r.editBlocked = /רק מ״ע תורנויות/.test(toasted) &&
    !document.getElementById("duty-roster-modal").classList.contains("open");

  return r;
});

record("התחברות חייל הצליחה", login.ok, JSON.stringify(login));
record("חייל רגיל אינו מ״ע תורנויות", out.isManager === false, String(out.isManager));
record("באנרי העריכה מוסתרים לחייל רגיל", out.editHiddenForSoldier, String(out.editHiddenForSoldier));
record("תצוגת לוח: הטבלה מוצגת", out.hasGrid, String(out.hasGrid));
record("תצוגת לוח: כל שורות התפקידים מהגיליון קיימות (כולל מילואים)", out.hasRoleRows, String(out.hasRoleRows));
record("תצוגת לוח: שורה קבוצתית לא-מאוישת בכל השבוע עדיין מוצגת (PMS נחים)", out.pmsRestShownEvenEmpty, String(out.pmsRestShownEvenEmpty));
record("תצוגת לוח: שם מילואים מוצג בשורה", out.hasReserveName, String(out.hasReserveName));
record("תצוגת לוח: תורן טייסת שבועי מוצג", out.hasSquadron, String(out.hasSquadron));
record("תצוגת לוח: חייל בקורס מסומן", out.hasCourseChip, String(out.hasCourseChip));
record("תצוגת לוח: השם שלי מודגש", out.hasMeChip, String(out.hasMeChip));
record("תצוגת לוח: סופ\"ש מסומן כמשמרת רצופה (בלי נחים)", out.wkndNoRest, String(out.wkndNoRest));
record("תצוגת לוח: כל שש עמודות השבוע מוצגות יחד", out.colCount === 6, String(out.colCount));
record("תצוגת לוח: הלוח נכנס לרוחב המסך בלי גלילה לצדדים",
  out.isFit && out.gridFitsWidth, `fit=${out.isFit} fits=${out.gridFitsWidth}`);
record("תצוגת לוח: יש כפתור מסך מלא", out.hasFullBtn, String(out.hasFullBtn));
record("תצוגת לוח: תאריך יומי בכותרת כל עמודה", out.headerDates, String(out.headerDates));
record("מסך מלא: נפתח עם הלוח בשמות מלאים", out.fullOpen && out.fullWide && out.fullFullNames,
  JSON.stringify({open:out.fullOpen, wide:out.fullWide, names:out.fullFullNames}));
record("מסך מלא: פקדי זום קיימים", out.fullHasZoom, String(out.fullHasZoom));
record("מסך מלא: נסגר בכפתור החזרה", out.fullClosed, String(out.fullClosed));
record("תצוגת יום: שם מלא (לא מקוצר)", out.dayFullName, String(out.dayFullName));
record("תצוגת יום: מגבלת הקורס כטקסט \"עד 20:00\"", out.dayCourseText, String(out.dayCourseText));
record("תצוגת יום: חלון הנחים מוצג", out.dayRestWindow, String(out.dayRestWindow));
record("תצוגת יום: סופ\"ש מוסבר כמשמרת רצופה", out.wkndExplained, String(out.wkndExplained));
record("רק אני: מציג את ימי השיבוץ שלי", out.mineHasMon && out.mineHasWk, JSON.stringify(out));
record("רק אני: מציג את התפקיד (PF / ר״צ)", out.mineHasPf && out.mineHasLead, JSON.stringify(out));
record("עריכה חסומה למי שאינו מ״ע תורנויות", out.editBlocked, String(out.editBlocked));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
