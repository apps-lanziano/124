/* התראה על הפעלת נכס — חייבת להגיע רק למסגרת שהפעילה אותו.
   עד התיקון: שרת ההתראות לא האזין למפתח של הנכס כלל, ולא הייתה
   שום אינדיקציה באפליקציה. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
import { readFileSync } from 'fs';
import { ROOT } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
async function page(){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  return {p, errs};
}
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. הפעלת נכס כותבת למפתח שהוא מסגרתי — הבסיס לכך שההתראה לא תדלוף
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const written = [];
    window.sSetRaw = async (k,v)=>{ written.push(k); return true; };
    window.sGetRaw = async ()=> null;
    window.confirm = ()=>true;
    window.renderRollcallPage = ()=>{}; window.openWaPrompt=()=>{}; window.toast=()=>{};
    currentShed = {id:"shed2", name:"סככה 2"}; user="מפקד"; userRole="מפקד"; PERSONNEL=[];
    await activateRollcall();
    return { written };
  });
  const activeKey = out.written.find(k=>k.includes("rollcall_active"));
  record("הפעלת נכס נשמרת תחת מפתח של המסגרת בלבד",
    activeKey === "shed2_rollcall_active", JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. שרת ההתראות מזהה את הנכס ושולח רק במעבר כבוי->פעיל
{
  const fn = readFileSync(`${ROOT}/functions/index.js`, 'utf8');
  const watches   = /rollcall_active/.test(fn);
  const onlyOnRise = /after === true && before !== true/.test(fn);
  const hasTitle  = /rollcall:\s*"🚨 נכס/.test(fn);
  const derivesShed = /docId\.slice\(0, docId\.indexOf\("_rollcall_active"\)\)/.test(fn);
  record("שרת ההתראות: מאזין לנכס, שולח רק בהפעלה, וגוזר את המסגרת מהמפתח",
    watches && onlyOnRise && hasTitle && derivesShed,
    JSON.stringify({watches, onlyOnRise, hasTitle, derivesShed}));
}

// 3. באדג' בניווט: מופיע כשיש נכס פעיל שהמשתמש לא סימן, ונעלם אחרי שסימן
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k=> store[k] ?? null;
    window.sSetRaw = async (k,v)=>{ store[k]=v; return true; };
    window.getEvents = async()=>[];
    window.updateAppBadge = async()=>{};
    currentShed = {id:"shed2", name:"סככה 2"}; user="דני"; userRole="חייל";
    PERSONNEL=[{name:"דני",role:"חייל"}]; MORNING_TASKS=[];

    store["shed2_rollcall_active"] = true;
    store["shed2_rollcall_checkins"] = {};
    await updateBadges();
    const shown = !document.getElementById("badge-rollcall").classList.contains("hidden");

    store["shed2_rollcall_checkins"] = {"דני":{at:"now"}};
    await updateBadges();
    const hiddenAfterCheckIn = document.getElementById("badge-rollcall").classList.contains("hidden");

    store["shed2_rollcall_active"] = false;
    store["shed2_rollcall_checkins"] = {};
    await updateBadges();
    const hiddenWhenInactive = document.getElementById("badge-rollcall").classList.contains("hidden");

    return { shown, hiddenAfterCheckIn, hiddenWhenInactive };
  });
  record("באדג' בניווט: מופיע בנכס פעיל, נעלם אחרי סימון נוכחות ובסיום הנכס",
    out.shown && out.hiddenAfterCheckIn && out.hiddenWhenInactive, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. הבאדג' מסגרתי: נכס בסככה 2 לא מופיע אצל מי שנמצא בסככה 3
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = { "shed2_rollcall_active": true, "shed2_rollcall_checkins": {} };
    window.sGetRaw = async k=> store[k] ?? null;
    window.sSetRaw = async (k,v)=>{ store[k]=v; return true; };
    window.getEvents = async()=>[]; window.updateAppBadge = async()=>{};
    // אותו נכס פעיל בסככה 2 — אבל המשתמש נמצא בסככה 3
    currentShed = {id:"shed3", name:"סככה 3"}; user="רון"; userRole="חייל";
    PERSONNEL=[{name:"רון",role:"חייל"}]; MORNING_TASKS=[];
    await updateBadges();
    return { leaked: !document.getElementById("badge-rollcall").classList.contains("hidden") };
  });
  record("נכס של סככה 2 לא מופיע לאנשי סככה 3",
    out.leaked === false, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. פעמון המפקד: מציג כמה טרם סימנו, ורק במסגרת שלו
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = { "shed2_rollcall_active": true, "shed2_rollcall_checkins": {"דני":{}} };
    window.sGetRaw = async k=> store[k] ?? null;
    window.getEvents = async()=>[]; window.getFaults = async()=>[]; window.getCerts = async()=>[];
    currentShed = {id:"shed2", name:"סככה 2"}; user="מפקד"; userRole="מפקד"; isAdmin=false;
    PERSONNEL=[{name:"דני",role:"חייל"},{name:"רון",role:"חייל"},{name:"עידן",role:"חייל"}];
    MORNING_TASKS=[];
    const alerts = await computeAlerts();
    const rc = alerts.find(a=>a.icon==="🛡️");
    return { found: !!rc, text: rc && rc.text, level: rc && rc.level };
  });
  record("פעמון המפקד: התראת נכס עם מספר מי שטרם סימן",
    out.found && /2 טרם/.test(out.text) && out.level==="high", JSON.stringify(out));
  console.log("errs5",errs); await p.close();
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await b.close();
process.exit(allPass?0:1);
