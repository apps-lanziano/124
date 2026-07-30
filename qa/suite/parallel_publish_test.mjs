/* מוכיח שהפרסום הכלל-טייסתי באמת רץ במקביל ולא בטור.
   השיטה: מדמים אחסון איטי (20ms לפעולה) וסופרים כמה פעולות
   התחילו לפני שהראשונה הסתיימה. בטור — אחת בכל רגע. במקביל —
   כל 8 המסגרות יחד. בנוסף מוודאים שהתנהגות הכשל החלקי נשמרה. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
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

/* עוטף את שכבת האחסון בהשהיה ומודד מקביליות */
const INSTRUMENT = `
  window.__inflight = 0; window.__peak = 0;
  const store = {};
  const slow = async (fn)=>{
    window.__inflight++;
    window.__peak = Math.max(window.__peak, window.__inflight);
    await new Promise(r=>setTimeout(r, 20));
    const v = fn();
    window.__inflight--;
    return v;
  };
  window.sGetIn = (s,k)=> slow(()=> store[s+"_"+k] ?? null);
  window.sSetIn = (s,k,v)=> slow(()=> { store[s+"_"+k]=v; return true; });
  window.sGetRaw = (k)=> slow(()=> store[k] ?? null);
  window.sSetRaw = (k,v)=> slow(()=> { store[k]=v; return true; });
  window.sDelRaw = async()=>{};
  window.toast=()=>{}; window.openWaPrompt=()=>{}; window.logAdminAction=async()=>{};
  window.renderAdminEvents=()=>{}; window.renderAdminTraining=()=>{};
  window.renderAdminDashboard=async()=>{}; window.closeMsgAdd=()=>{}; window.renderMessages=()=>{};
`;

// 1. פרסום קרא-וחתום — כל המסגרות במקביל
{
  const {p, errs} = await page();
  const out = await p.evaluate(async (inst)=>{
    eval(inst);
    isAdmin = true; user = "בודק";
    const t0 = Date.now();
    const ok = await publishEventToAllSheds("e1","פריט",{type:"image",name:"n",mime:"image/png"},"data:x","thumb");
    return { ok, peak: window.__peak, ms: Date.now()-t0, sheds: SHEDS.length };
  }, INSTRUMENT);
  record("פרסום קרא-וחתום רץ במקביל לכל המסגרות",
    out.ok === true && out.peak >= out.sheds, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. פרסום הודעה — במקביל
{
  const {p, errs} = await page();
  const out = await p.evaluate(async (inst)=>{
    eval(inst);
    isAdmin = true; user = "בודק";
    document.getElementById("msg-text").value = "הודעת בדיקה";
    await saveMessage();
    return { peak: window.__peak, sheds: SHEDS.length };
  }, INSTRUMENT);
  record("פרסום הודעה רץ במקביל לכל המסגרות",
    out.peak >= out.sheds, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. פרסום חומר הדרכה — במקביל
{
  const {p, errs} = await page();
  const out = await p.evaluate(async (inst)=>{
    eval(inst);
    const ok = await publishTrainingToAllSheds("t1","מסמך.pdf","pdf","data:x",null);
    return { ok, peak: window.__peak, sheds: SHEDS.length };
  }, INSTRUMENT);
  record("פרסום חומר הדרכה רץ במקביל לכל המסגרות",
    out.ok === true && out.peak >= out.sheds, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. קריטי: כשל באחת המסגרות עדיין מזוהה גם במצב מקבילי
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (s,k)=> store[s+"_"+k] ?? null;
    window.sSetIn = async (s,k,v)=> { if(s==="shed3") return false; store[s+"_"+k]=v; return true; };
    window.sGetRaw = async k=> store[k] ?? null;
    window.sSetRaw = async (k,v)=> { store[k]=v; return true; };
    window.sDelRaw = async()=>{};
    const evOk = await publishEventToAllSheds("e1","פריט",{type:"image",name:"n",mime:"image/png"},"d","t");
    const trOk = await publishTrainingToAllSheds("t1","מסמך","pdf","d",null);
    return { evOk, trOk };
  });
  record("כשל במסגרת אחת מזוהה גם בריצה מקבילה (לא מדווח כהצלחה)",
    out.evOk === false && out.trOk === false, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. מחיקה כלל-טייסתית — כשל חלקי מזוהה
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = { admin_events:[{id:"e1",title:"פריט"}] };
    window.sGetRaw = async k=> store[k] ?? null;
    window.sSetRaw = async (k,v)=> { store[k]=v; return true; };
    window.sGetIn = async (s,k)=> store[s+"_"+k] ?? [];
    window.sSetIn = async (s,k,v)=> s!=="shed2";
    window.sDelRaw = async()=>{};
    window.confirm = ()=>true;
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.logAdminAction=async()=>{}; window.renderAdminEvents=()=>{};
    window._t=[];
    await deleteAdminEvent("e1");
    return { toasts: window._t };
  });
  record("מחיקה כלל-טייסתית: כשל חלקי מוצג כשגיאה ולא כהצלחה",
    out.toasts.some(t=>t.includes("נכשלה")), JSON.stringify(out));
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
