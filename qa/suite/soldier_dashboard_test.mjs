/* דשבורד חייל ("היום שלי"): דגל ראשי (תורן/נח/הבאה/פנוי), מחוון "השבוע שלי",
   מונה תורנויות, פעולות מהירות, סטטוס אילוצים, והעדכון האחרון. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  user = "חייל א סככה 1"; userRole = "חייל";
  window.toast = ()=>{};

  // לוח שבועי: החייל תורן ביום שאינו היום, כדי לבדוק "התורנות הבאה"
  const roster = migrateRosterToV2(null);
  const DAYS = ["ראשון","שני","שלישי","רביעי","חמישי"];
  const todayKeyDay = rosterEditKey(todayHebrewDay());
  // תורן היום + עוד יום כלשהו (2 תורנויות השבוע)
  roster.days[todayKeyDay].lead = user;
  const other = DAYS.find(d=>d!==todayKeyDay);
  roster.days[other].pf = [{name:user}];
  await saveDutyRosterV2(roster, "current");
  rosterCache = null;

  // אילוצים בסטטוסים שונים
  await saveDutyRequests([
    {id:"a1", by:user, shed:"shed1", type:"vacation", status:"approved", ts:1},
    {id:"a2", by:user, shed:"shed1", type:"after", status:"pending", ts:2},
    {id:"a3", by:user, shed:"shed1", type:"leave", status:"rejected", ts:3},
  ]);
  // הודעה אחרונה
  await sSet("messages_list", [{id:"m1", text:"תרגיל מחר ב-06:00", type:"normal", ts:9}]);

  await renderToday();
  const html = document.getElementById("today-content").innerHTML;
  r.hasWeekStrip = html.includes("my-week");
  r.hasQuickActions = html.includes("הזן אילוץ") && html.includes("בקש החלפה");
  r.hasNextDuty = /התורנות הבאה שלך|אתה תורן היום/.test(html);   // תורן היום או הבאה
  r.hasConstraintStats = html.includes("ממתינים") && html.includes("אושרו") && html.includes("נדחו");
  r.constraintCounts = /<b>1<\/b><span>ממתינים/.test(html) && /<b>1<\/b><span>אושרו/.test(html) && /<b>1<\/b><span>נדחו/.test(html);
  r.hasLatestMsg = html.includes("תרגיל מחר");
  r.dutyCountShown = /2 תורנויות שלך השבוע/.test(html) || html.includes("mw-dot duty");

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("מחוון 'השבוע שלי'", out.hasWeekStrip, String(out.hasWeekStrip));
record("פעולות מהירות (אילוץ/החלפה)", out.hasQuickActions, String(out.hasQuickActions));
record("דגל תורנות (היום/הבאה)", out.hasNextDuty, String(out.hasNextDuty));
record("סטטוס אילוצים (ממתין/אושר/נדחה)", out.hasConstraintStats, String(out.hasConstraintStats));
record("ספירות סטטוס נכונות (1/1/1)", out.constraintCounts, String(out.constraintCounts));
record("העדכון האחרון (הודעה)", out.hasLatestMsg, String(out.hasLatestMsg));
record("תורנויות השבוע מסומנות", out.dutyCountShown, String(out.dutyCountShown));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
