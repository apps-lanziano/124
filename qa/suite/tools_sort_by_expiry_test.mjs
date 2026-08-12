/* מסך כלים: הצגת הכלים לפי התוקף המתקרב — הכי דחוף (פג/קרוב) קודם,
   וכלים בתיקון/בלי תאריך תוקף יורדים לתחתית הרשימה. */
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
  window.storage = {
    async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
    async set(k,v){ store[k]=v; return true; },
    async delete(k){ delete store[k]; },
  };
  fbReady = false;
  window.confirm = ()=>true; window.toast = ()=>{};
  currentShed = {id:"shed1", name:"סככה 1"}; user="מפקד"; userRole="מפקד"; isAdmin=false;
  isToolsResp = false;

  const iso = days => new Date(Date.now()+days*86400000).toISOString().slice(0,10);
  // סדר הכנסה מעורבב בכוונה — כדי לוודא שהמיון עובד, לא סדר ההכנסה
  const tools = [
    {id:"far",   name:"רחוק",      serial:"3", expiry:iso(100)},
    {id:"noexp", name:"בלי תוקף",  serial:"5"},
    {id:"exp",   name:"פג",        serial:"1", expiry:"2020-01-01"},
    {id:"repair",name:"בתיקון",    serial:"4", expiry:"2019-01-01", inRepair:true},
    {id:"soon",  name:"קרוב",      serial:"2", expiry:iso(5)},
  ];
  await sSet("tools_list", tools);
  await renderToolsPage();

  const order = [...document.querySelectorAll("#tools-page-list .cert-sum-name b")].map(e=>e.textContent);
  return { order };
});

record("מיון לפי תוקף מתקרב: פג → קרוב → רחוק",
  out.order[0]==="פג" && out.order[1]==="קרוב" && out.order[2]==="רחוק",
  JSON.stringify(out.order));
record("כלים בתיקון/בלי תוקף בתחתית הרשימה",
  out.order.slice(3).includes("בתיקון") && out.order.slice(3).includes("בלי תוקף"),
  JSON.stringify(out.order));

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
