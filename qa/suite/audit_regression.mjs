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
function baseMocks(){
  window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
  window.logAction=async()=>{};
  window.renderDocs=()=>{}; window.openReader=async()=>{};
  window.renderMessages=()=>{}; window.renderMsgExisting=()=>{};
  window.renderFaults=()=>{}; window.renderBinuiFaults=()=>{};
  window.renderAdminEvents=()=>{}; window.renderAdminTraining=()=>{};
  window.openWaPrompt=()=>{window._wa=true;};
  window._t=[]; window._wa=false;
}

// ===== 2. confirmRead: success / failure =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.logAction=async()=>{}; window.openReader=async()=>{}; window.renderDocs=()=>{};
    window.sGet=async()=>({}); window.sSet=async()=>true;
    currentDoc={id:"e1",title:"פריט"}; user="חייל בדיקה";
    window._t=[]; await confirmRead();
    const successToast = window._t.some(t=>t.includes("אישור הקריאה נקלט"));
    window.sSet=async()=>false;
    window._t=[]; await confirmRead();
    const failToast = window._t.some(t=>t.includes("⚠️")&&t.includes("לא נקלט"));
    return {successToast, failToast};
  });
  record("confirmRead: success/failure both handled honestly", out.successToast && out.failToast, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// ===== 3. saveMessage: admin partial-fail / local fail =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.openWaPrompt=()=>{window._wa=true;}; window.renderMsgExisting=()=>{}; window.renderMessages=()=>{};
    window.logAction=async()=>{};
    document.getElementById("msg-text").value="הודעת בדיקה";
    // מנהל, כשל בסככה אחת
    isAdmin=true; msgType="info"; user="admin";
    window.sGetIn=async()=>[]; window.sSetIn=async(shedId)=> shedId!=="shed2";
    window.sGetRaw=async()=>[]; window.sSetRaw=async()=>true;
    window._t=[]; window._wa=false;
    await saveMessage();
    const adminFail = { toasts:[...window._t], wa:window._wa };

    // מקומי, כשל
    isAdmin=false; currentShed={id:"shed1"}; userRole="מפקד";
    window.sGet=async()=>[]; window.sSet=async()=>false;
    document.getElementById("msg-text").value="הודעה 2";
    window._t=[]; window._wa=false;
    await saveMessage();
    const localFail = { toasts:[...window._t], wa:window._wa };
    return {adminFail, localFail};
  });
  const adminOk = !out.adminFail.wa && out.adminFail.toasts.some(t=>t.includes("⚠️"));
  const localOk = !out.localFail.wa && out.localFail.toasts.some(t=>t.includes("⚠️"));
  record("saveMessage: admin partial-fail and local fail both block WA + show error",
    adminOk && localOk, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// ===== 4. publishTrainingToAllSheds: partial fail =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.sGetRaw=async()=>[]; window.sSetRaw=async()=>true;
    window.sGetIn=async()=>[]; window.sSetIn=async(shedId)=> shedId!=="shed3";
    const ok1 = await publishTrainingToAllSheds("t1","title","other","data",null);
    window.sSetIn=async()=>true;
    const ok2 = await publishTrainingToAllSheds("t2","title","other","data",null);
    return {partialFail: ok1, allOk: ok2};
  });
  record("publishTrainingToAllSheds: honest aggregate success", out.partialFail===false && out.allOk===true, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// ===== 5. saveFault: image fail blocks save =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.logAction=async()=>{}; window.renderFaults=()=>{}; window.closeAddFault=()=>{};
    window.getFaults=async()=>[];
    document.getElementById("fault-title").value="תקלה";
    faultImgData="data:image/jpeg;base64,xx";
    window.sSetSafe=async()=>false;   // הצילום נכשל
    window.sSet=async()=>true;
    window._t=[];
    await saveFault();
    return {toasts:window._t};
  });
  record("saveFault: image upload failure blocks the whole save with clear error",
    out.toasts.some(t=>t.includes("⚠️")&&t.includes("תמונה")), JSON.stringify(out));
  console.log("errs5",errs); await p.close();
}

// ===== 6. saveBinuiFault: image fail blocks save =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.renderBinuiFaults=()=>{}; window.closeAddBinuiFault=()=>{}; window.openWaPrompt=()=>{window._wa=true;};
    window.getBinuiFaults=async()=>[];
    currentShed={id:"shed1",name:"סככה 1"};
    document.getElementById("binui-fault-title").value="תקלת בינוי";
    binuiFaultImgData="data:image/jpeg;base64,xx";
    window.sSetRaw=async()=>false;
    window._t=[]; window._wa=false;
    await saveBinuiFault();
    return {toasts:window._t, wa:window._wa};
  });
  record("saveBinuiFault: image upload failure blocks save, no WA prompt",
    out.toasts.some(t=>t.includes("⚠️")) && !out.wa, JSON.stringify(out));
  console.log("errs6",errs); await p.close();
}

// ===== 7. deleteMessage / deleteAdminEvent / deleteTraining: partial fail =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.confirm=()=>true;
    window.renderMessages=()=>{}; window.renderAdminEvents=()=>{}; window.renderAdminTraining=()=>{};
    window.sGetIn=async()=>[]; window.sSetIn=async(shedId)=> shedId!=="shed4";
    window.sGetRaw=async()=>[]; window.sSetRaw=async()=>true; window.sDelRaw=async()=>{};
    window.getAdminEventsList=async()=>[]; window.getTrainingList=async()=>[];
    isAdmin=true;
    window._t=[]; await deleteMessage("m1");
    const msgFail = window._t.some(t=>t.includes("⚠️"));
    window._t=[]; await deleteAdminEvent("e1");
    const evFail = window._t.some(t=>t.includes("⚠️"));
    window._t=[]; await deleteTraining("t1");
    const trFail = window._t.some(t=>t.includes("⚠️"));
    return {msgFail, evFail, trFail};
  });
  record("Delete operations (message/event/training): partial fail surfaces error, not fake success",
    out.msgFail && out.evFail && out.trFail, JSON.stringify(out));
  console.log("errs7",errs); await p.close();
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
