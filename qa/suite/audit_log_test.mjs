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

// 1. logAdminAction writes + renderAdminLog merges correctly
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    user="טומי"; userRole="מפקד"; isOwner=false; isTechOfficer=false;
    await logAdminAction("פרסום קרא-וחתום לכל המסגרות", "תדריך בוקר");
    await new Promise(r=>setTimeout(r,10));
    await logAdminAction("מחיקת קרא-וחתום מכל המסגרות", "תדריך בוקר");
    await renderAdminLog();
    const html = document.getElementById("admin-log-list").innerHTML;
    return {
      hasPublish: html.includes("פרסום קרא-וחתום לכל המסגרות"),
      hasDelete: html.includes("מחיקת קרא-וחתום מכל המסגרות"),
      hasDetail: html.includes("תדריך בוקר"),
      hasBy: html.includes("טומי"),
      hasSquadronTag: html.includes("כלל הטייסת"),
      deleteBeforePublishInOrder: html.indexOf("מחיקת קרא-וחתום") < html.indexOf("פרסום קרא-וחתום"),
    };
  });
  record("logAdminAction + renderAdminLog: entries recorded with who/what/detail, newest first",
    out.hasPublish && out.hasDelete && out.hasDetail && out.hasBy && out.hasSquadronTag && out.deleteBeforePublishInOrder,
    JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. saveEvent (admin) logs only on success, not on failure
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    window.toast=()=>{}; window.closeAddEvent=()=>{}; window.renderAdminDashboard=async()=>{}; window.openWaPrompt=()=>{};
    isAdmin=true; window._adminPublish=true; user="טומי"; userRole="מפקד";
    evImgData="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    evFileMeta={type:"image",name:"n",mime:"image/png"};
    document.getElementById("ev-title").value="פריט חדש";
    await saveEvent();
    const logAfterSuccess = (store["admin_audit_log"]||[]).length;

    // כשל: sSetIn נכשל לחלוטין -> אסור שיירשם לוג
    window.sSetIn = async ()=>false;
    document.getElementById("ev-title").value="פריט שנכשל";
    await saveEvent();
    const logAfterFailure = (store["admin_audit_log"]||[]).length;
    return {logAfterSuccess, logAfterFailure};
  });
  record("saveEvent admin: logs on success, does NOT log on failure",
    out.logAfterSuccess===1 && out.logAfterFailure===1, JSON.stringify(out));
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
