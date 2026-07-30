import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const results = [];

async function page(){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  return {p, errs};
}
function record(name, pass, detail){ results.push({name, pass, detail}); }

// ===== 1. WA-prompt gating: board local (success/fail) =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.logAction=async()=>{}; window.renderBoard=()=>{}; window.renderAdminDashboard=async()=>{};
    window.openWaPrompt=()=>{window._wa=true;};
    currentShed={id:"shed1",name:"סככה 1"}; user="cmd"; userRole="מפקד"; isAdmin=false;
    window.fbReady=false; window.storage={set:async()=>{throw new Error("down");},get:async()=>null};
    window._wa=false; window._t=[];
    const c=document.createElement('canvas'); c.width=30;c.height=30; c.getContext('2d').fillRect(0,0,30,30);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer(); dt.items.add(new File([blob],"x.png",{type:"image/png"}));
    document.getElementById('board-input').files=dt.files;
    onBoardFile({target:document.getElementById('board-input')});
    await new Promise(r=>setTimeout(r,350));
    return {wa:window._wa, toasts:window._t};
  });
  record("WA gating: board local upload fails silently -> no WA, error toast",
    out.wa===false && out.toasts.some(t=>t.includes("נכשלה")), JSON.stringify(out));
  console.log("errs1", errs);
  await p.close();
}

// ===== 2. WA-prompt gating: board admin (squadron-wide) partial failure =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.logAction=async()=>{}; window.renderAdminDashboard=async()=>{};
    window.openWaPrompt=()=>{window._wa=true;};
    window.sGetIn=async()=>[]; window.sDelRaw=async()=>{};
    window.sSetIn=async(shedId)=> shedId!=="shed3";  // shed3 fails
    isAdmin=true; window._adminBoardPublish=true;
    window._wa=false; window._t=[];
    const c=document.createElement('canvas'); c.width=30;c.height=30; c.getContext('2d').fillRect(0,0,30,30);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer(); dt.items.add(new File([blob],"x.png",{type:"image/png"}));
    document.getElementById('board-input').files=dt.files;
    onBoardFile({target:document.getElementById('board-input')});
    await new Promise(r=>setTimeout(r,350));
    return {wa:window._wa, toasts:window._t};
  });
  record("WA gating: board admin publish partial-fails -> no WA, error toast",
    out.wa===false && out.toasts.some(t=>t.includes("נכשלה")), JSON.stringify(out));
  console.log("errs2", errs);
  await p.close();
}

// ===== 3. WA-prompt gating: safety event admin success =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.logAction=async()=>{}; window.renderAdminDashboard=async()=>{}; window.closeAddEvent=()=>{};
    window.openWaPrompt=()=>{window._wa=true;};
    window.sGetRaw=async()=>[]; window.sSetRaw=async()=>true;
    window.sGetIn=async()=>[]; window.sSetIn=async()=>true;
    isAdmin=true; window._adminPublish=true;
    evImgData="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="; evFileMeta={type:"image",name:"n",mime:"image/png"};
    document.getElementById("ev-title").value="פריט בדיקה";
    document.getElementById("ev-save").disabled=false; document.getElementById("ev-save").textContent="פרסום הפריט";
    window._wa=false; window._t=[];
    await saveEvent();
    return {wa:window._wa, toasts:window._t};
  });
  record("WA gating: safety event admin publish success -> WA shown",
    out.wa===true, JSON.stringify(out));
  console.log("errs3", errs);
  await p.close();
}

// ===== 4. Direct publish (no scope-choice modal): regular cmdr local, training cmdr straight squadron-wide =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminEvent=()=>{window._admin=true;};
    window.openAddEventRaw=()=>{window._local=true;};
    const modalGone = !document.getElementById("scope-choice-modal");
    currentShed={id:"shed1",name:"סככה 1"}; userRole="מפקד"; isAdmin=false;
    window._admin=false; window._local=false;
    openAddEvent();
    const regularOk = window._local && !window._admin;
    currentShed={id:"training",isTraining:true};
    isAdmin=true;
    window._admin=false; window._local=false;
    openAddEvent();
    const trainingAllWorks = window._admin && !window._local;
    return {modalGone, regularOk, trainingAllWorks};
  });
  record("Direct publish: modal removed, regular cmdr unaffected, training cmdr straight squadron-wide",
    out.modalGone && out.regularOk && out.trainingAllWorks, JSON.stringify(out));
  console.log("errs4", errs);
  await p.close();
}

// ===== 5. Modal-X universal close button =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const total = document.querySelectorAll('.modal-bg').length;
    const withX = document.querySelectorAll('.modal-bg > .modal > .modal-x').length;
    return {total, withX};
  });
  record("Modal-X: every modal has exactly one close button", out.total===out.withX && out.total>0, JSON.stringify(out));
  console.log("errs5", errs);
  await p.close();
}

// ===== 6. Omer / med-checks permission =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.sGet=async()=>({}); window.sSet=async()=>{};
    PERSONNEL=[{name:"עומר שאול",role:"חייל"}];
    currentShed={id:"shed1"};
    window.getNaatim=async()=>[{area:"כשירות חיילים",person:"עומר שאול"}];
    user="עומר שאול"; userRole="חייל";
    await refreshAreaPermissions();
    return {hearing:isHearingResp, range:isRangeResp};
  });
  record("Omer naatim permission still grants both tabs", out.hearing && out.range, JSON.stringify(out));
  console.log("errs6", errs);
  await p.close();
}

// ===== 7. Binui fault delete permissions =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store={"binui_faults_list":[{id:"f1",title:"t",by:"x",shedId:"shed1",dept:null,status:"פתוח",date:"1/1"}]};
    window.sGetRaw=async k=>store[k]??null; window.sSetRaw=async(k,v)=>{store[k]=v;};
    window.sDelRaw=async()=>{}; window.toast=()=>{}; window.confirm=()=>true;
    isVehicleOfficer=false; isTechOfficer=true; userRole="מפקד"; currentShed=null;
    await openBinuiFaultDetail("f1");
    const techOk = document.getElementById('binuifaultdetail-body').innerHTML.includes("מחק תקלה");
    isVehicleOfficer=false; isTechOfficer=false; currentShed={id:"shed1"};
    await openBinuiFaultDetail("f1");
    const ownShedOk = document.getElementById('binuifaultdetail-body').innerHTML.includes("מחק תקלה");
    return {techOk, ownShedOk};
  });
  record("Binui: tech officer + own-shed commander can delete", out.techOk && out.ownShedOk, JSON.stringify(out));
  console.log("errs7", errs);
  await p.close();
}

// ===== 8. Vehicle card compact rendering =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const v = {id:"v1", name:"רכב", number:"111", testDate: new Date(Date.now()-5*864e5).toISOString().slice(0,10)};
    const st = vehicleStatusDetailed(v, ["testDate"]);
    const short = vehicleShortLabel(st);
    return short;
  });
  record("Vehicle card: short label strips emoji/parens correctly", out.cls==="r" && out.txt==="טסט: עבר המועד", JSON.stringify(out));
  console.log("errs8", errs);
  await p.close();
}

// ===== 9. Admin overview: safety-report button/function removed, shed cards no longer show duplicate sig% =====
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.sGetIn=async()=>[]; window.sSetIn=async()=>true;
    const noBtn = !document.querySelector('[onclick="openAdminSafetyReport()"]');
    const fnGone = typeof window.openAdminSafetyReport === "undefined";
    await renderAdminDashboard();
    const gridHtml = document.getElementById("admin-sheds-grid").innerHTML;
    const noSigPctStat = !gridHtml.includes(">חתימות<");
    return { noBtn, fnGone, noSigPctStat };
  });
  record("Admin overview decluttered: no redundant safety-report button/fn, no duplicate sig% on shed cards",
    out.noBtn && out.fnGone && out.noSigPctStat, JSON.stringify(out));
  console.log("errs9", errs);
  await p.close();
}

// ===== 10. Nav height clipping =====
{
  const {p, errs} = await page();
  await p.setViewportSize({width:412,height:915});
  const out = await p.evaluate(async ()=>{
    const nav=document.querySelector('nav'), main=document.getElementById('main');
    nav.style.paddingBottom = "56px";  // מדמה סרגל מחוות גדול
    syncNavHeight();
    return { padBottom: getComputedStyle(main).paddingBottom, navH: Math.round(nav.getBoundingClientRect().height) };
  });
  const padNum = parseFloat(out.padBottom);
  record("Nav height: content padding tracks real nav height", padNum >= out.navH, JSON.stringify(out));
  console.log("errs10", errs);
  await p.close();
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
