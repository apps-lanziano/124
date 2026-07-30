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

// 1. נע"ת "לוח צוות שבועי" מעניקה isBoardPublisher לחייל רגיל (לא מפקד)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.getNaatim = async()=>[{area:"לוח צוות שבועי", person:"טל מלכה"}];
    currentShed = {id:"shed1", name:"סככה 1"}; isAdmin=false;
    user="טל מלכה"; userRole="חייל";
    await refreshAreaPermissions();
    const o1 = { isBoardPublisher, canManage: userRole==="מפקד"||isBoardPublisher };

    // חייל אחר בלי נע"ת
    window.getNaatim = async()=>[];
    user="חייל אחר"; userRole="חייל";
    await refreshAreaPermissions();
    const o2 = { isBoardPublisher };
    return {tal:o1, other:o2};
  });
  record("Naatim 'לוח צוות שבועי' grants isBoardPublisher to a non-commander soldier; others unaffected",
    out.tal.isBoardPublisher===true && out.tal.canManage===true && out.other.isBoardPublisher===false,
    JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. renderBoard: upload button visible to board-publisher, hidden to plain soldier
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.getBoards = async()=>[];
    isBoardPublisher = true; userRole="חייל"; isAdmin=false;
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-board').classList.add('active');
    await renderBoard();
    const hasBtnAsPublisher = !!document.querySelector('.board-add-btn');

    isBoardPublisher = false;
    await renderBoard();
    const hasBtnAsPlainSoldier = !!document.querySelector('.board-add-btn');
    return {hasBtnAsPublisher, hasBtnAsPlainSoldier};
  });
  record("renderBoard: upload button shown to board-publisher soldier, hidden otherwise",
    out.hasBtnAsPublisher===true && out.hasBtnAsPlainSoldier===false, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. triggerBoardUpload: board-publisher (non-commander) goes straight to squadron-wide, no choice
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminBoard = ()=>{ window._admin=true; };
    isBoardPublisher = true; userRole="חייל"; currentShed={id:"shed1"};
    window._admin=false;
    triggerBoardUpload();
    return {adminCalled: window._admin};
  });
  record("triggerBoardUpload: non-commander board-publisher goes straight to squadron-wide",
    out.adminCalled===true, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. plain soldier (no permission) goes straight local
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.openAdminBoard = ()=>{ window._admin=true; };
    document.getElementById("board-input").click = ()=>{ window._local=true; };
    isBoardPublisher = false; userRole="חייל"; currentShed={id:"shed1"};
    window._admin=false; window._local=false;
    triggerBoardUpload();
    return {local:window._local, admin:window._admin};
  });
  record("triggerBoardUpload: soldier without permission goes straight local",
    out.local===true && out.admin===false, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. Full end-to-end: non-admin board-publisher uploads a real image squadron-wide successfully
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
    isBoardPublisher = true; isAdmin=false; userRole="חייל"; user="טל מלכה";
    window._adminBoardPublish = true;   // כאילו נבחר "לכל הטייסת" בבחירת ההיקף
    window._t=[]; window._wa=false;
    const c=document.createElement('canvas'); c.width=30;c.height=30; c.getContext('2d').fillRect(0,0,30,30);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer(); dt.items.add(new File([blob],"x.png",{type:"image/png"}));
    document.getElementById('board-input').files=dt.files;
    onBoardFile({target:document.getElementById('board-input')});
    await new Promise(r=>setTimeout(r,350));
    return {
      toasts: window._t, wa: window._wa,
      shed1Has: !!store["shed1_boards_list"], shed5Has: !!store["shed5_boards_list"],
      adminLog: (store["admin_audit_log"]||[]).length,
    };
  });
  record("End-to-end: non-admin board-publisher (Tal Malka) publishes squadron-wide successfully, logged, WA shown",
    out.toasts.some(t=>t.includes("פורסם לכל המסגרות")) && out.wa && out.shed1Has && out.shed5Has && out.adminLog===1,
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
