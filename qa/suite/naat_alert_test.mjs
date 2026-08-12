/* התראה למ"ע תורנויות על החלפות שממתינות לאישורו — בפעמון ההתראות,
   וניווט ממנה לתיבת ההחלפות. גם למ"ע שאינו מפקד הפעמון מציג את זה. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  // החלפה שהמפקד אישר וממתינה למ"ע (status=naat)
  await saveDutyRequests([
    {id:"n1", type:"swap", status:"naat", by:"חייל א סככה 1", shed:"shed1",
     day:"ראשון", replacement:"חייל ב סככה 1", replDay:"שני", replShed:"shed1", cmdrBy:"מפקד", ts:1},
  ]);

  // מ"ע תורנויות (מפקד) — הפעמון כולל את התראת ההחלפות
  isRosterManager = true;
  const alerts = await computeAlerts();
  const a = alerts.find(x=>x.nav==="__naatswaps");
  r.mgrAlert = !!a && /1 פריטים ממתינים/.test(a.text);

  // ניווט מההתראה פותח את תיבת ההחלפות (goFromAlert מנתב ל-openNaatSwaps)
  await openNaatSwaps();
  r.opensInbox = document.getElementById("naat-swaps-modal").classList.contains("open");
  document.getElementById("naat-swaps-modal").classList.remove("open");

  // מ"ע שאינו מפקד — הפעמון מציג רק את התראת ההחלפות (בלי התראות ניהול)
  userRole = "חייל";
  const soldierAlerts = await computeAlerts();
  r.soldierMgrOnly = soldierAlerts.length===1 && soldierAlerts[0].nav==="__naatswaps";

  // הפעמון גלוי למ"ע גם כשאינו מפקד
  await updateAlertBell(soldierAlerts);
  r.bellVisible = document.getElementById("alert-bell").style.display !== "none";

  // כשאין החלפות ממתינות — אין התראה
  await saveDutyRequests([]);
  userRole = "מפקד";
  const none = (await computeAlerts()).find(x=>x.nav==="__naatswaps");
  r.noneWhenEmpty = !none;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("מ״ע (מפקד): התראת החלפות בפעמון", out.mgrAlert, String(out.mgrAlert));
record("ניווט מההתראה פותח את תיבת ההחלפות", out.opensInbox, String(out.opensInbox));
record("מ״ע שאינו מפקד: הפעמון מציג רק את התראת ההחלפות", out.soldierMgrOnly, String(out.soldierMgrOnly));
record("הפעמון גלוי למ״ע גם כשאינו מפקד", out.bellVisible, String(out.bellVisible));
record("אין החלפות ממתינות → אין התראה", out.noneWhenEmpty, String(out.noneWhenEmpty));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
