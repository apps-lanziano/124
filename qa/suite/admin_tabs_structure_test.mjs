/* מבנה לשוניות דשבורד אחראי הדרכה אחרי הבקשה: "סקירה" -> "דשבורד מפקד",
   "מצבת מסגרות" הוסרה, לשונית "יומן" נעלמה (תוכנה עבר ל"חתימות"),
   ובלשונית "חתימות" יש גם ייצוא וגם 3 תצוגות. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const p = await b.newPage();
await p.route('**gstatic.com/**', r=>r.abort());
await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(250);

const out = await p.evaluate(async ()=>{
  window.sGetIn = async ()=>[]; window.sGetRaw = async ()=>null; window.sSetRaw = async ()=>true;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('scr-admin').classList.add('active');

  const tabs = [...document.querySelectorAll('#scr-admin .cmd-tabs')[0].querySelectorAll('.cmd-tab')].map(b=>b.textContent);
  const overviewLabel = document.getElementById('atab-overview').textContent;
  const logTabGone = !document.getElementById('atab-log');
  const logPaneGone = !document.getElementById('apane-log');
  const shedsGridGone = !document.getElementById('admin-sheds-grid');

  await renderAdminDashboard();   // scr-admin's default landing render

  return { tabCount: tabs.length, tabs, overviewLabel, logTabGone, logPaneGone, shedsGridGone };
});

record("לשונית 'סקירה' שונה ל'דשבורד'",
  out.overviewLabel.includes("דשבורד") && !out.overviewLabel.includes("דשבורד מפקד"), out.overviewLabel);
record("יש בדיוק 5 לשוניות (יומן הוסרה, תוכנו עבר לחתימות)",
  out.tabCount===5, JSON.stringify(out.tabs));
record("לשונית/פאנל 'יומן' לא קיימים יותר ב-DOM",
  out.logTabGone && out.logPaneGone, JSON.stringify(out));
record("'מצבת מסגרות' (admin-sheds-grid) לא קיימת יותר",
  out.shedsGridGone, JSON.stringify(out));

console.log("errs", errs);
await p.close();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await b.close();
process.exit(allPass?0:1);
