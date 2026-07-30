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

// 1. Regular commander (not admin, not naatim board-publisher) -> triggerBoardUpload opens the scope-choice modal, no auto-route
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminBoard = ()=>{ window._admin=true; };
    document.getElementById("board-input").click = ()=>{ window._local=true; };
    isAdmin=false; isBoardPublisher=false; userRole="מפקד"; currentShed={id:"shed2"};
    window._admin=false; window._local=false;
    triggerBoardUpload();
    const modalOpen = document.getElementById("board-scope-modal").classList.contains("open");
    return {admin:window._admin, local:window._local, modalOpen};
  });
  record("Regular commander: triggerBoardUpload opens scope-choice modal, no auto-route",
    out.admin===false && out.local===false && out.modalOpen===true, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. Choosing "למסגרת שלי בלבד" closes modal and goes local
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    document.getElementById("board-input").click = ()=>{ window._local=true; };
    isAdmin=false; isBoardPublisher=false; userRole="מפקד";
    window._local=false;
    openBoardScopeChoice();
    const openBefore = document.getElementById("board-scope-modal").classList.contains("open");
    document.querySelector('#board-scope-modal .a-ic').closest('button').click(); // first button = local
    const openAfter = document.getElementById("board-scope-modal").classList.contains("open");
    return {openBefore, openAfter, local:window._local};
  });
  record("Scope choice: 'למסגרת שלי בלבד' closes modal and triggers local file input",
    out.openBefore===true && out.openAfter===false && out.local===true, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. Choosing "לכלל המסגרות" closes modal and calls openAdminBoard (squadron-wide)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminBoard = ()=>{ window._admin=true; };
    isAdmin=false; isBoardPublisher=false; userRole="מפקד";
    window._admin=false;
    openBoardScopeChoice();
    const buttons = document.querySelectorAll('#board-scope-modal button.admin-card');
    buttons[1].click(); // second button = squadron-wide
    const openAfter = document.getElementById("board-scope-modal").classList.contains("open");
    return {admin:window._admin, openAfter};
  });
  record("Scope choice: 'לכלל המסגרות' closes modal and calls openAdminBoard",
    out.admin===true && out.openAfter===false, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. isAdmin still bypasses the modal entirely (unchanged, straight to squadron-wide)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminBoard = ()=>{ window._admin=true; };
    isAdmin=true; userRole="מפקד"; currentShed={id:"training",isTraining:true};
    window._admin=false;
    triggerBoardUpload();
    const modalOpen = document.getElementById("board-scope-modal").classList.contains("open");
    return {admin:window._admin, modalOpen};
  });
  record("Training officer (isAdmin): still bypasses modal, straight to squadron-wide",
    out.admin===true && out.modalOpen===false, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. Non-commander naatim board-publisher still bypasses the modal (unchanged)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminBoard = ()=>{ window._admin=true; };
    isAdmin=false; isBoardPublisher=true; userRole="חייל";
    window._admin=false;
    triggerBoardUpload();
    const modalOpen = document.getElementById("board-scope-modal").classList.contains("open");
    return {admin:window._admin, modalOpen};
  });
  record("Non-commander naatim board-publisher: still bypasses modal, straight to squadron-wide",
    out.admin===true && out.modalOpen===false, JSON.stringify(out));
  console.log("errs5",errs); await p.close();
}

// 6. Plain soldier without permission: unchanged, straight to local
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    document.getElementById("board-input").click = ()=>{ window._local=true; };
    isAdmin=false; isBoardPublisher=false; userRole="חייל";
    window._local=false;
    triggerBoardUpload();
    const modalOpen = document.getElementById("board-scope-modal").classList.contains("open");
    return {local:window._local, modalOpen};
  });
  record("Plain soldier (no permission): unchanged, straight to local, no modal",
    out.local===true && out.modalOpen===false, JSON.stringify(out));
  console.log("errs6",errs); await p.close();
}

// 7. Full end-to-end: a REGULAR commander (no naatim, no admin) uploads a real image and chooses squadron-wide -> reaches all sheds
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    window.sDelRaw = async ()=>{};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.toast = (m)=>{ window._t=window._t||[]; window._t.push(m); };
    window.openWaPrompt = ()=>{ window._wa=true; };
    window.renderBoard = ()=>{};
    isAdmin=false; isBoardPublisher=false; userRole="מפקד"; user="טל מלכה"; currentShed={id:"shed2",name:"סככה 2"};
    window._t=[]; window._wa=false;
    triggerBoardUpload();                 // opens the choice modal
    document.querySelectorAll('#board-scope-modal button.admin-card')[1].click(); // "לכלל המסגרות" -> sets _adminBoardPublish, clicks real board-input
    const c=document.createElement('canvas'); c.width=30;c.height=30; c.getContext('2d').fillRect(0,0,30,30);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer(); dt.items.add(new File([blob],"x.png",{type:"image/png"}));
    document.getElementById('board-input').files=dt.files;
    onBoardFile({target:document.getElementById('board-input')});
    await new Promise(r=>setTimeout(r,350));
    return {
      toasts: window._t, wa: window._wa,
      shed1Has: !!store["shed1_boards_list"], shed2Has: !!store["shed2_boards_list"], shed5Has: !!store["shed5_boards_list"],
      adminLog: (store["admin_audit_log"]||[]).length,
    };
  });
  record("End-to-end: regular commander (Tal Malka, shed2, no naatim) chooses squadron-wide, publishes to ALL sheds",
    out.toasts.some(t=>t.includes("פורסם לכל המסגרות")) && out.wa && out.shed1Has && out.shed2Has && out.shed5Has && out.adminLog===1,
    JSON.stringify(out));
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
