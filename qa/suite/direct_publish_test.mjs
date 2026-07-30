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

// 1. openAddEvent: training officer (isAdmin) goes straight to squadron-wide, no modal, no choice
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminEvent = ()=>{ window._admin=true; };
    window.openAddEventRaw = ()=>{ window._local=true; };
    currentShed={id:"training", isTraining:true}; userRole="מפקד"; isAdmin=true;
    window._admin=false; window._local=false;
    openAddEvent();
    const modalExists = !!document.getElementById("scope-choice-modal");
    return { modalExists, admin:window._admin, local:window._local };
  });
  record("openAddEvent: training officer -> straight to squadron-wide, modal gone entirely",
    !out.modalExists && out.admin===true && out.local===false, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. openAddEvent: regular shed commander unaffected -> straight to local
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminEvent = ()=>{ window._admin=true; };
    window.openAddEventRaw = ()=>{ window._local=true; };
    currentShed={id:"shed1"}; userRole="מפקד"; isAdmin=false;
    window._admin=false; window._local=false;
    openAddEvent();
    return { admin:window._admin, local:window._local };
  });
  record("openAddEvent: regular commander unaffected, straight to local",
    out.admin===false && out.local===true, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. triggerBoardUpload: isAdmin AND isBoardPublisher (via naatim) both go straight to squadron-wide
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminBoard = ()=>{ window._admin=true; };
    document.getElementById("board-input").click = ()=>{ window._local=true; };

    isAdmin=true; isBoardPublisher=false;
    window._admin=false; window._local=false;
    triggerBoardUpload();
    const asAdmin = { admin: window._admin, local: window._local };

    isAdmin=false; isBoardPublisher=true; userRole="חייל";
    window._admin=false; window._local=false;
    triggerBoardUpload();
    const asBoardPublisher = { admin: window._admin, local: window._local };

    isAdmin=false; isBoardPublisher=false; userRole="חייל";
    window._admin=false; window._local=false;
    triggerBoardUpload();
    const asPlainSoldier = { admin: window._admin, local: window._local };

    return { asAdmin, asBoardPublisher, asPlainSoldier, modalExists: !!document.getElementById("scope-choice-modal") };
  });
  record("triggerBoardUpload: isAdmin and isBoardPublisher both go straight squadron-wide, others go local, no modal",
    out.asAdmin.admin && !out.asAdmin.local &&
    out.asBoardPublisher.admin && !out.asBoardPublisher.local &&
    !out.asPlainSoldier.admin && out.asPlainSoldier.local &&
    !out.modalExists,
    JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. Naatim person picker now includes commanders (Tal Malka scenario)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    PERSONNEL = [{name:"טל מלכה", role:"מפקד"}, {name:"דניאל זאורוב", role:"מפקד"}, {name:"חייל רגיל", role:"חייל"}];
    populateNaatimPerson();
    const options = [...document.getElementById("naatim-person").options].map(o=>o.value);
    return { hasTal: options.includes("טל מלכה"), hasDaniel: options.includes("דניאל זאורוב"), hasSoldier: options.includes("חייל רגיל") };
  });
  record("populateNaatimPerson: commanders now selectable alongside soldiers",
    out.hasTal && out.hasDaniel && out.hasSoldier, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. End-to-end: Tal Malka (commander, no naatim needed) picks "לכלל המסגרות" from the scope-choice banners, WA+log work
//    (superseded design: naatim is no longer required for a commander to publish squadron-wide — see board_scope_choice_test.mjs)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (s,k)=> store[s+"_"+k] ?? null;
    window.sSetIn = async (s,k,v)=> { store[s+"_"+k]=v; return true; };
    window.sDelRaw = async ()=>{};
    window.sGetRaw = async k=> store[k] ?? null;
    window.sSetRaw = async (k,v)=> { store[k]=v; return true; };
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.openWaPrompt=()=>{window._wa=true;};
    window.renderBoard=()=>{};
    currentShed={id:"shed2",name:"סככה 2"}; user="טל מלכה"; userRole="מפקד"; isAdmin=false; isBoardPublisher=false;
    window._t=[]; window._wa=false;
    triggerBoardUpload();   // מפקד -> נפתח מודל הבחירה (שני באנרים)
    const modalOpen = document.getElementById("board-scope-modal").classList.contains("open");
    document.querySelectorAll('#board-scope-modal button.admin-card')[1].click(); // "לכלל המסגרות"
    const c=document.createElement('canvas'); c.width=30;c.height=30; c.getContext('2d').fillRect(0,0,30,30);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer(); dt.items.add(new File([blob],"x.png",{type:"image/png"}));
    document.getElementById('board-input').files=dt.files;
    onBoardFile({target:document.getElementById('board-input')});
    await new Promise(r=>setTimeout(r,350));
    return {
      modalOpen, toasts:window._t, wa:window._wa,
      shed1Has: !!store["shed1_boards_list"], shed5Has: !!store["shed5_boards_list"],
      adminLog: (store["admin_audit_log"]||[]).length,
    };
  });
  record("End-to-end: Tal Malka (plain commander, no naatim) — chooses squadron-wide via banners, WA+log both fire",
    out.modalOpen && out.toasts.some(t=>t.includes("פורסם לכל המסגרות")) && out.wa
      && out.shed1Has && out.shed5Has && out.adminLog===1,
    JSON.stringify(out));
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
