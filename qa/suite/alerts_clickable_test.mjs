/* משתמשים דיווחו: לוחצים על באנר בפעמון ההתראות — ולא קורה כלום. השורות
   היו div סטטי בלי onclick. עכשיו לכל התראה יש יעד ניווט (nav) והקשה
   מעבירה למסך שבו מטפלים בה בפועל.
   הבדיקה מוודאת: (1) כל התראה שמחושבת נושאת יעד ניווט קיים, (2) השורה
   מסומנת כלחיצה ומציגה חץ, (3) הקשה בפועל סוגרת את החלון ומחליפה מסך. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  // מייצרים מצב עם התראות אמיתיות: תקלה ישנה + הסמכה שפגה + מטלות בוקר פתוחות
  const old = Date.now() - 9*86400000;
  await sSet("faults_list", [{ id:"f_"+old, title:"תקלה ישנה לבדיקה", status:"open" }]);
  await sSet("certs_list", [{ person:"חייל א סככה 1", name:"הסמכה שפגה", expiry:"2020-01-01" }]);

  const alerts = await computeAlerts();
  const missingNav = alerts.filter(a=>!a.nav);
  const badTarget  = alerts.filter(a=>a.nav && !document.getElementById(a.nav));

  await openAlerts();
  const modalOpen = document.getElementById("alerts-modal").classList.contains("open");
  const rows = Array.from(document.querySelectorAll("#alerts-body .alert-row"));
  const tappable = rows.filter(r=>r.classList.contains("tappable"));
  const withArrow = tappable.filter(r=>r.querySelector(".al-go"));

  // הקשה אמיתית על ההתראה הראשונה — צריכה לסגור את החלון ולהחליף מסך
  const before = document.querySelector(".screen.active")?.id;
  tappable[0]?.click();
  const after = document.querySelector(".screen.active")?.id;
  const closedAfterClick = !document.getElementById("alerts-modal").classList.contains("open");

  return {
    total: alerts.length,
    missingNav: missingNav.map(a=>a.text),
    badTarget: badTarget.map(a=>a.nav),
    modalOpen, rowCount: rows.length,
    tappableCount: tappable.length, arrowCount: withArrow.length,
    before, after, closedAfterClick,
    navTargets: [...new Set(alerts.map(a=>a.nav))],
  };
});

record("התחברות מפקד הצליחה", login.ok, JSON.stringify(login));
record("נוצרו התראות לבדיקה", out.total > 0, JSON.stringify(out));
record("לכל התראה יש יעד ניווט (nav)", out.missingNav.length === 0, JSON.stringify(out.missingNav));
record("כל יעדי הניווט הם מסכים קיימים", out.badTarget.length === 0, JSON.stringify(out.badTarget) + " · " + JSON.stringify(out.navTargets));
record("כל שורות ההתראה מסומנות כלחיצות", out.rowCount > 0 && out.tappableCount === out.rowCount, JSON.stringify(out));
record("לכל שורה לחיצה מוצג חץ (רמז ויזואלי)", out.arrowCount === out.tappableCount, JSON.stringify(out));
record("הקשה על באנר מנווטת למסך אחר", !!out.after && out.after !== out.before, `${out.before} → ${out.after}`);
record("הקשה סוגרת את חלון ההתראות", out.closedAfterClick, JSON.stringify(out));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
