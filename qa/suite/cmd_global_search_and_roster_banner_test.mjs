/* (1) באנר חיפוש חייל מעל "לוח שבועי" — מוצג לכל מפקד, לא רק למ"ע
       תורנויות, ולא מוצג לחייל. הבנק נטען וההדגשה עובדת גם ללא מ"ע.
   (2) באנר החיפוש בדשבורד המפקד הוא חיפוש כללי — חיילים, כלים, רכבים,
       הסמכות, נע"תים ותקלות — עם צ'יפי קטגוריה, ולא חיפוש חיילים בלבד. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  window.confirm = ()=>true;
  window.toast = ()=>{};
  const A = "חייל א סככה 1";

  // ---- (1) באנר חיפוש חייל בלוח ----
  const roster = migrateRosterToV2(null);
  roster.days["ראשון"].lead   = A;
  roster.days["שני"].driver   = A;
  roster.days["שלישי"].pf     = [{name:A, course:false, reserve:false}];
  isRosterManager = true;                       // כתיבת הלוח דורשת הרשאה
  await saveDutyRosterV2(roster, "current");

  // מפקד שאינו מ"ע תורנויות — הבאנר חייב להופיע
  isRosterManager = false;
  userRole = "מפקד";
  rosterCache = null; rosterSearchBank = null; rosterSearchName = "";
  boardWeekSlot = "current"; rosterView = "board";
  await renderRosterView();
  r.cmdSeesSearch = !!document.getElementById("roster-search-inp");
  r.cmdBankLoaded = Array.isArray(rosterSearchBank) && rosterSearchBank.some(x=>x.name===A);
  // ...וההדגשה עובדת בפועל
  document.getElementById("roster-search-inp").value = "חייל א";
  rosterSearchInput();
  const idx = rosterSearchRows.findIndex(x=>x.name===A);
  rosterSearchPick(idx);
  const grid = document.querySelector("#roster-view .roster-grid");
  r.cmdHl = grid.classList.contains("hl-on") && grid.querySelectorAll(".rc.rc-hl").length===3;
  clearRosterSearch();

  // ...אבל לא בתצוגת "לוח יומי"/"רק אני"
  rosterView = "day"; await renderRosterView();
  r.noSearchInDayView = !document.getElementById("roster-search-inp");
  rosterView = "board";

  // חייל רגיל — אין באנר חיפוש
  userRole = "חייל";
  isRosterManager = false;
  await renderRosterView();
  r.soldierNoSearch = !document.getElementById("roster-search-inp");

  // מעבר זהות מנקה שם מודגש שנשאר מהזהות הקודמת
  rosterSearchName = "פלוני"; _rosterViewSeenAs = "מישהו אחר";
  await renderRosterView();
  r.identityResetsSearch = rosterSearchName === "";

  userRole = "מפקד";

  // ---- (2) חיפוש כללי בדשבורד המפקד ----
  const inp = document.getElementById("cmd-global-search");
  const box = document.getElementById("cmd-global-results");
  const cats = document.getElementById("cmd-global-cats");
  r.inputExists = !!inp && !!box && !!cats;
  r.oldSoldierInputGone = !document.getElementById("cmd-soldier-search");

  const search = async v => { inp.value = v; await renderCmdGlobalSearch(); return box.innerHTML; };

  r.emptyHint = (await search("")).includes("הקלד כדי לחפש");
  r.catsHiddenWhenEmpty = cats.style.display === "none";

  const tool = await search("מפתח שוודי");
  r.findsTool = tool.includes("מפתח שוודי") && tool.includes("כלים");

  const veh = await search("11-111-11");
  r.findsVehicle = veh.includes("רכב לדוגמה") && veh.includes("רכבים");

  const cert = await search("סף");
  r.findsCert = cert.includes("הסמכות");

  const naat = await search("חדר כלים");
  r.findsNaat = naat.includes('נע"תים');

  const fault = await search("תקלה לדוגמה");
  r.findsFault = fault.includes("תקלות") && fault.includes("תקלה לדוגמה");

  const person = await search(A);
  r.findsPerson = person.includes("חיילים") && person.includes(A);
  r.personOpensEdit = person.includes("startEditMember(");

  // שאילתה שנוגעת בכמה קטגוריות — הצ'יפים מוצגים ומסננים
  const multi = await search("חייל א");
  r.catsShown = cats.style.display !== "none" && cats.innerHTML.includes("הכל");
  const hitsAll = (multi.match(/class="mgmt-row"/g)||[]).length;
  setCmdSearchCat("people"); await renderCmdGlobalSearch();
  const onlyPeople = box.innerHTML;
  r.chipFilters = !onlyPeople.includes('נע"תים · ') && (onlyPeople.match(/class="mgmt-row"/g)||[]).length <= hitsAll;
  setCmdSearchCat("all"); await renderCmdGlobalSearch();

  r.noResults = (await search("זזזזזזז")).includes("לא נמצאו תוצאות");

  // מקור שבור לא מרוקן את כל התוצאות
  const origTools = window.getTools;
  window.getTools = async ()=>{ throw new Error("boom"); };
  const resilient = await search("רכב לדוגמה");
  window.getTools = origTools;
  r.brokenSourceResilient = resilient.includes("רכב לדוגמה");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("מפקד (לא מ״ע) רואה באנר חיפוש חייל בלוח", out.cmdSeesSearch, String(out.cmdSeesSearch));
record("בנק השמות נטען גם למפקד רגיל", out.cmdBankLoaded, String(out.cmdBankLoaded));
record("ההדגשה בלוח עובדת למפקד רגיל (3 מיקומים)", out.cmdHl, String(out.cmdHl));
record("אין באנר חיפוש בתצוגת 'לוח יומי'", out.noSearchInDayView, String(out.noSearchInDayView));
record("חייל לא רואה באנר חיפוש", out.soldierNoSearch, String(out.soldierNoSearch));
record("מעבר זהות מנקה את שם החיפוש", out.identityResetsSearch, String(out.identityResetsSearch));
record("דשבורד מפקד: תיבת חיפוש כללי קיימת", out.inputExists, String(out.inputExists));
record("תיבת 'חיפוש חיילים' הישנה הוסרה", out.oldSoldierInputGone, String(out.oldSoldierInputGone));
record("ריק → רמז, בלי צ'יפים", out.emptyHint && out.catsHiddenWhenEmpty, JSON.stringify([out.emptyHint,out.catsHiddenWhenEmpty]));
record("חיפוש מוצא כלי", out.findsTool, String(out.findsTool));
record("חיפוש מוצא רכב לפי מספר", out.findsVehicle, String(out.findsVehicle));
record("חיפוש מוצא הסמכה", out.findsCert, String(out.findsCert));
record("חיפוש מוצא נע״ת", out.findsNaat, String(out.findsNaat));
record("חיפוש מוצא תקלה", out.findsFault, String(out.findsFault));
record("חיפוש מוצא חייל", out.findsPerson, String(out.findsPerson));
record("לחיצה על חייל פותחת את עריכתו", out.personOpensEdit, String(out.personOpensEdit));
record("צ'יפי קטגוריה מוצגים", out.catsShown, String(out.catsShown));
record("צ'יפ קטגוריה מסנן את התוצאות", out.chipFilters, String(out.chipFilters));
record("אין תוצאות → הודעה ברורה", out.noResults, String(out.noResults));
record("מקור שבור לא מרוקן את החיפוש", out.brokenSourceResilient, String(out.brokenSourceResilient));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
