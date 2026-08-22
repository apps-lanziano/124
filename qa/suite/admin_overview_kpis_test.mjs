/* "בדשבורד תן לי מדדים ויזואליים" — טאב הדשבורד של אחראי ההדרכה (apane-overview)
   מציג עכשיו KPI-ים כלל-טייסתיים: סה"כ אנשי צוות, קרא-וחתום פעילים, אחוז חתימה
   כללי, חתימות ממתינות, ואנשי מילואים. */
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
  const store = {};
  window.sGetRaw = async k => store[k] ?? null;
  window.sSetRaw = async (k,v) => { store[k]=v; return true; };
  window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
  window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };

  // שני פריטי קרא-וחתום פעילים
  store["admin_events"] = [{id:"ev1", title:"א"}, {id:"ev2", title:"ב"}];

  // shed1: 2 אנשי צוות, שניהם מוגדרים לשני הפריטים, אחד חתם על שניהם, השני על אחד בלבד
  store["shed1_cfg_personnel"] = [{name:"דני", role:"חייל"}, {name:"רון", role:"מפקד"}];
  store["shed1_safety_events"] = [{id:"ev1"}, {id:"ev2"}];
  store["shed1_sigs_דני"] = {ev1:true, ev2:true};
  store["shed1_sigs_רון"] = {ev1:true};

  // shed2: איש צוות אחד + איש מילואים אחד, בלי אף חתימה
  store["shed2_cfg_personnel"] = [{name:"עידן", role:"חייל"}, {name:"רזרביסט", role:"חייל", reserve:true, refresh:"2026-01-01"}];
  store["shed2_safety_events"] = [{id:"ev1"}];
  store["shed2_sigs_עידן"] = {};
  store["shed2_sigs_רזרביסט"] = {};

  // שאר הסככות ריקות
  ["shed3","shed4","shed5","dept","maint","training"].forEach(s=>{
    store[s+"_cfg_personnel"]=[]; store[s+"_safety_events"]=[];
  });

  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('scr-admin').classList.add('active');
  await renderAdminOverviewKpis();

  const val = id => document.getElementById(id).textContent;
  return {
    personnel: val("akpi-personnel"),
    items: val("akpi-items"),
    signrate: val("akpi-signrate"),
    missing: val("akpi-missing"),
    reserves: val("akpi-reserves"),
  };
});

// חישוב צפוי (מילואים לא נספרים במעקב קרא-וחתום — סעיף 6):
// shed1 - relevant=2 items, personnel=2 (אין מילואים) -> maxC=4, gotC=3 (דני:2, רון:1)
// shed2 - relevant=1 item (ev1 בלבד), personnel=1 (עידן בלבד; רזרביסט מוחרג) -> maxC=1, gotC=0
// סה"כ מעקב: maxC=5, gotC=3 -> 60% ; missing=2
// אבל "סה״כ אנשי צוות" הוא ספירת ראשים כללית וכולל מילואים -> personnel=4
record("סה״כ אנשי צוות מכל המסגרות (כולל מילואים)", out.personnel==="4", JSON.stringify(out));
record("קרא-וחתום פעילים", out.items==="2", JSON.stringify(out));
record("אחוז חתימה כללי — בלי מילואים (סעיף 6)", out.signrate==="60%", JSON.stringify(out));
record("חתימות ממתינות — בלי מילואים (סעיף 6)", out.missing==="2", JSON.stringify(out));
record("אנשי מילואים נספרים בנפרד", out.reserves==="1", JSON.stringify(out));

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
