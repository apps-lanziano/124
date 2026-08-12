/* (1) ספירת שיבוצים: משמרת סופ"ש לא נספרת, תורנות בסיסית לא נספרת,
   ושיבוץ תוך כדי תורנות בסיסית לא נספר.
   (2) חיפוש חייל בלוח (מ"ע): רישום ידני/מהבנק, לחיצה מבליטה מיקומים. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  window.confirm = ()=>true;
  window.toast = ()=>{};

  // ---- (1) ספירת שיבוצים ----
  // חייל א: ראשון (PF) + שלישי (PF) → 2. גם רשום בחמישי (סופ"ש) → לא נספר.
  // חייל א גם בתורנות בסיסית ביום שני, וגם PF באותו יום → אותו יום לא נספר.
  await saveDutyRosterV2(migrateRosterToV2(null), "current");
  await openRosterEditor(null, "current");
  const A = "חייל א סככה 1";
  rosterDraft.days["ראשון"].pf   = [{name:A}];
  rosterDraft.days["שלישי"].pf   = [{name:A}];
  rosterDraft.days["חמישי"].pf   = [{name:A}];             // סופ"ש — לא נספר
  rosterDraft.days["שני"].basic  = [{name:A, type:"ניקיון"}];
  rosterDraft.days["שני"].pf     = [{name:A}];             // תוך כדי בסיסית — לא נספר

  // rosterDayActivityNames: בסיסית לא נכללת, ומי שבבסיסית לא נכלל כלל
  r.activityNoBasic = !rosterDayActivityNames(rosterDraft.days["שני"]).includes(A);
  r.activityHasPf   = rosterDayActivityNames(rosterDraft.days["ראשון"]).includes(A);

  // הספירה בבנק: א׳(1)+ג׳(1) = 2 בלבד (ה׳ ושני לא נספרים)
  rosterEdDay = "רביעי";
  openRosterPick("pf");
  const row = rosterPickRows.find(x=>x.name===A);
  r.count2 = !!row && row.cnt===2;
  document.getElementById("roster-pick-modal").classList.remove("open");

  // ---- (2) חיפוש חייל בלוח ----
  const roster = migrateRosterToV2(null);
  roster.days["ראשון"].lead = A;
  roster.days["שני"].driver = A;
  roster.days["שלישי"].pf   = [{name:A, course:false, reserve:false}];
  await saveDutyRosterV2(roster, "current");
  rosterCache = null;
  boardWeekSlot = "current"; rosterView = "board";
  await renderRosterView();

  // תיבת החיפוש קיימת למ"ע
  r.searchBox = !!document.getElementById("roster-search-inp");
  // הבנק נטען
  r.bankLoaded = Array.isArray(rosterSearchBank) && rosterSearchBank.some(x=>x.name===A);

  // סינון לפי הקלדה
  document.getElementById("roster-search-inp").value = "חייל א";
  rosterSearchInput();
  r.filtered = rosterSearchRows.some(x=>x.name===A);

  // בחירה מהתוצאות מבליטה את המיקומים
  const idx = rosterSearchRows.findIndex(x=>x.name===A);
  rosterSearchPick(idx);
  const grid = document.querySelector("#roster-view .roster-grid");
  r.gridDimmed = grid.classList.contains("hl-on");
  const hl = grid.querySelectorAll(".rc.rc-hl");
  // A מופיע ב-3 מיקומים (ר״צ ראשון, נהג שני, PF שלישי)
  r.hlCount = hl.length===3;
  r.hlRightName = [...hl].every(el=>el.getAttribute("data-rn")===A);
  r.noteShown = /3 מיקומים/.test(document.getElementById("roster-search-note").textContent);

  // ניקוי מסיר את ההדגשה
  clearRosterSearch();
  r.cleared = !grid.classList.contains("hl-on") && grid.querySelectorAll(".rc.rc-hl").length===0;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("תורנות בסיסית + שיבוץ תוך כדי בסיסית לא נספרים ליום", out.activityNoBasic, String(out.activityNoBasic));
record("שיבוץ רגיל (PF) כן נספר", out.activityHasPf, String(out.activityHasPf));
record("ספירה: סופ״ש ובסיסית לא נספרים (2 בלבד)", out.count2, String(out.count2));
record("מ״ע: תיבת חיפוש מעל הלוח", out.searchBox, String(out.searchBox));
record("מאגר חיילים (בנק) נטען לחיפוש", out.bankLoaded, String(out.bankLoaded));
record("סינון לפי הקלדה ידנית", out.filtered, String(out.filtered));
record("בחירת חייל מדגישה את הלוח", out.gridDimmed, String(out.gridDimmed));
record("כל 3 המיקומים של החייל מודגשים", out.hlCount, String(out.hlCount));
record("ההדגשה על השם הנכון", out.hlRightName, String(out.hlRightName));
record("חיווי מספר המיקומים מוצג", out.noteShown, String(out.noteShown));
record("ניקוי מסיר את ההדגשה", out.cleared, String(out.cleared));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
