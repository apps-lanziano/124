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

/* יומן התיעוד שונה מיומן פעולות כללי לכזה שעוקב אחרי ביצוע קרא-וחתום
   בלבד (לפי בקשה מפורשת), עם 3 תצוגות: לפי שם/סככה/פריט + ייצוא PDF.
   בדיקה זו מחליפה את הבדיקה הישנה של יומן-הפעולות הכללי. */
// 1. renderAdminLog: שלוש התצוגות מציגות נכון פריט פורסם + חתימה חלקית
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    const put = (k,v)=>{ store[k]=v; };
    put("admin_events", [{id:"ev1", title:"תדריך בוקר", ftype:"image", date:"1.1"}]);
    put("shed2_cfg_personnel", [{name:"דני"},{name:"רון"}]);
    put("shed2_safety_events", [{id:"ev1", title:"תדריך בוקר"}]);
    put("shed2_sigs_דני", {ev1:{date:"1.1"}});   // דני חתם, רון לא
    put("shed3_cfg_personnel", [{name:"משה"}]);
    put("shed3_safety_events", []);              // הפריט לא הגיע לסככה 3 בכלל

    await renderAdminSignatures();
    const byName = document.getElementById("admin-log-list").innerHTML;
    adminLogView("byShed");
    const byShed = document.getElementById("admin-log-list").innerHTML;
    adminLogView("byItem");
    const byItem = document.getElementById("admin-log-list").innerHTML;
    return {
      byNameShowsSigned: /דני[\s\S]{0,250}חתם על הכל/.test(byName),
      byNameShowsMissing: /רון[\s\S]{0,250}לא חתם/.test(byName),
      byShedShowsGap: byShed.includes("סככה 2") && byShed.includes("50%"),
      byItemShowsSyncGap: byItem.includes("לא בכל המסגרות") && byItem.includes("לא נקלט במסגרת זו"),
      byItemShowsTitle: byItem.includes("תדריך בוקר"),
    };
  });
  record("יומן תיעוד — 'לפי שם': מציג מי חתם ומי לא, לפי סככה",
    out.byNameShowsSigned && out.byNameShowsMissing, JSON.stringify(out));
  record("יומן תיעוד — 'לפי סככה': מציג אחוז השלמה לכל מסגרת",
    out.byShedShowsGap, JSON.stringify(out));
  record("יומן תיעוד — 'לפי קרא-וחתום': מזהה פריט שלא הגיע לכל המסגרות",
    out.byItemShowsSyncGap && out.byItemShowsTitle, JSON.stringify(out));
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
