/* תצוגת "כרטיסים" בלוח הצוות: כרטיס לכל יום, השם שלי מודגש, היום בולט,
   פיצול סופ"ש (מנהל/מתגבר), וברירת מחדל לחיילים. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  const me = "חייל א סככה 1";
  user = me;   // ה-class "me" נגזר מהמשתמש הגלובלי
  const roster = migrateRosterToV2(null);
  roster.days["ראשון"].lead = me;
  roster.days["שני"].pf = [{name:me, course:false, reserve:false}];
  roster.days["חמישי"].manager = "מנהל חמישי";
  roster.days["שישי"].manager = "מנהל שישבת";
  const html = rosterCardsHtml(roster, "ראשון");

  r.fiveCards = (html.match(/class="rcd /g)||html.match(/class="rcd"/g)||[]).length>=1 && (html.match(/rcd-h/g)||[]).length===5;
  r.myNameHighlighted = /rc me">חייל א סככה 1/.test(html);   // השם שלי עם class "me"
  r.todayBadge = html.includes("rcd-now");
  r.weekendSplit = html.includes("מנהל חמישי") && html.includes("מנהל שישבת") && html.includes("ו׳–ש׳");
  r.hasRoles = html.includes("ר״צ") && html.includes("PF");

  // ברירת מחדל לפי תפקיד: חייל → כרטיסים
  _rosterViewInit = false; rosterView = "board";
  user = me; userRole = "חייל"; isRosterManager = false;
  await saveDutyRosterV2(roster, "current"); rosterCache = null;
  boardWeekSlot = "current";
  await renderRosterView();
  r.soldierDefaultCards = rosterView === "cards";
  r.cardsRendered = document.getElementById("roster-view").innerHTML.includes("rcd-h");
  // לשונית "כרטיסים" קיימת בבורר
  r.hasCardsTab = document.getElementById("roster-view").innerHTML.includes(">כרטיסים<");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("כרטיס לכל יום (5)", out.fiveCards, String(out.fiveCards));
record("השם שלי מודגש בכרטיס", out.myNameHighlighted, String(out.myNameHighlighted));
record("תגית 'היום' על היום הנוכחי", out.todayBadge, String(out.todayBadge));
record("פיצול סופ״ש (מנהל ה׳ מול ו׳–ש׳)", out.weekendSplit, String(out.weekendSplit));
record("תפקידים מוצגים בכרטיס", out.hasRoles, String(out.hasRoles));
record("חייל: ברירת מחדל = כרטיסים", out.soldierDefaultCards, String(out.soldierDefaultCards));
record("תצוגת הכרטיסים מרונדרת בפועל", out.cardsRendered, String(out.cardsRendered));
record("לשונית 'כרטיסים' בבורר התצוגות", out.hasCardsTab, String(out.hasCardsTab));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
