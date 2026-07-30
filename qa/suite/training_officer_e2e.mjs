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

// 1. Training officer publishes safety event squadron-wide directly (one click, no modal)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (s,k)=> store[s+"_"+k] ?? null;
    window.sSetIn = async (s,k,v)=> { store[s+"_"+k]=v; return true; };
    window.sGetRaw = async k=> store[k] ?? null;
    window.sSetRaw = async (k,v)=> { store[k]=v; return true; };
    window.toast = (m)=>{ window._t=window._t||[]; window._t.push(m); };
    window.openWaPrompt = ()=>{ window._wa=true; };
    window.renderAdminDashboard = async()=>{};
    currentShed = {id:"training", isTraining:true, name:"הדרכה"};
    userRole="מפקד"; isAdmin=true; user="טומי לופוביץ";
    window._t=[]; window._wa=false;
    // לחיצה אמיתית על "+ פריט" -> ישר לפרסום כלל-טייסתי, בלי מודל בחירה
    openAddEvent();
    const modalGone = !document.getElementById("scope-choice-modal");
    // ev-title/file נדרשים לפני saveEvent
    document.getElementById("ev-title").value = "תדריך בוקר יולי";
    evImgData="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    evFileMeta={type:"image",name:"n.png",mime:"image/png"};
    await saveEvent();
    return {
      modalGone,
      toasts: window._t, wa: window._wa,
      shed1Has: (store["shed1_safety_events"]||[]).length,
      deptHas: (store["dept_safety_events"]||[]).length,
      adminEventsHas: (store["admin_events"]||[]).length,
      auditLog: (store["admin_audit_log"]||[]).length,
    };
  });
  record("Training officer: safety event, one click, no modal, reaches ALL sheds, WA shown, logged",
    out.modalGone && out.toasts.some(t=>t.includes("פורסם לכל המסגרות")) && out.wa
      && out.shed1Has===1 && out.deptHas===1 && out.adminEventsHas===1 && out.auditLog===1,
    JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. Training officer publishes training material squadron-wide (non-image file path)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (s,k)=> store[s+"_"+k] ?? null;
    window.sSetIn = async (s,k,v)=> { store[s+"_"+k]=v; return true; };
    window.sGetRaw = async k=> store[k] ?? null;
    window.sSetRaw = async (k,v)=> { store[k]=v; return true; };
    window.toast = (m)=>{ window._t=window._t||[]; window._t.push(m); };
    window.renderAdminTraining = ()=>{};
    window._t=[];
    // מדמה קובץ PDF קטן (לא תמונה) ע"י קריאה ישירה לפונקציית הפרסום עצמה (onTrainingFile עוטף FileReader אמיתי)
    const ok = await publishTrainingToAllSheds("t1", "נוהל בטיחות.pdf", "pdf", "data:application/pdf;base64,JVBERi0x", null);
    return {
      ok,
      shed1Has: (store["shed1_training_list"]||[]).length,
      dept: (store["dept_training_list"]||[]).length,
      adminHas: (store["admin_training"]||[]).length,
    };
  });
  record("Training officer: training material publish writes to all sheds + admin list",
    out.ok && out.shed1Has===1 && out.dept===1 && out.adminHas===1, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
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
