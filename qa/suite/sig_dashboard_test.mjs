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

// 1. logSigHistory writes correctly via confirmRead (הדרך היחידה החיה כיום —
//    חתימה מצוירת/saveSignature הוסרה, "אישור קריאה" מחליף אותה לגמרי)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGet = async k => store[k] ?? null;
    window.sSet = async (k,v) => { store[k]=v; return true; };
    window.logAction = async()=>{}; window.toast=()=>{};
    window.openReader = async()=>{}; window.renderDocs=()=>{};
    user = "דני כהן";
    currentDoc = {id:"e1", title:"תדריך בטיחות"};
    await confirmRead();
    user = "רון לוי";
    currentDoc = {id:"e2", title:"נוהל חירום"};
    await confirmRead();
    const hist = store["sig_history"];
    return { count: hist.length, first: hist[0], second: hist[1] };
  });
  record("logSigHistory: records read-confirm events in order (newest first), עם השם והכותרת הנכונים",
    out.count===2 && out.first.type==="read" && out.first.eventTitle==="נוהל חירום" && out.first.person==="רון לוי"
      && out.second.type==="read" && out.second.eventTitle==="תדריך בטיחות" && out.second.person==="דני כהן",
    JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. renderAdminSignatures: item-centric view keyed by admin_events (not raw per-shed safety_events) —
//    correctly distinguishes "not delivered to this shed" from "delivered but not everyone signed"
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (s,k)=> store[s+"_"+k] ?? null;
    window.sGetRaw = async k=> store[k] ?? null;
    // הפריט "e1" פורסם כלל-טייסתית (admin_events)
    store["admin_events"] = [{id:"e1", title:"פריט כלל-טייסתי", date:"1.1"}];
    // shed1: קיבל את הפריט, יש 2 חיילים, אחד חתם
    store["shed1_cfg_personnel"]=[{name:"דני"},{name:"רון"}];
    store["shed1_safety_events"]=[{id:"e1",title:"פריט כלל-טייסתי"}];
    store["shed1_sigs_דני"]={e1:{}}; store["shed1_sigs_רון"]={};
    // shed2: לא קיבל את הפריט בכלל (כשל הפצה) — אין e1 ב-safety_events שלו
    store["shed2_cfg_personnel"]=[{name:"איתי"}];
    store["shed2_safety_events"]=[];
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-admin').classList.add('active');
    await renderAdminSignatures();
    adminLogView('byItem');   // התצוגה "לפי קרא-וחתום" — המקבילה של admin-sig-items הישן
    const itemsHtml = document.getElementById("admin-log-list").innerHTML;
    const statsHtml = document.getElementById("admin-sig-stats").innerHTML;
    return {
      hasTitle: itemsHtml.includes("פריט כלל-טייסתי"),
      hasShed1Partial: itemsHtml.includes("1/2") && itemsHtml.includes("רון"),
      hasShed2Missing: itemsHtml.includes("לא נקלט במסגרת זו"),
      hasSyncWarning: statsHtml.includes("לא בכל המסגרות") || itemsHtml.includes("לא בכל המסגרות"),
      remindButtonCount: (itemsHtml.match(/remindNonSigners/g)||[]).length,
    };
  });
  record("renderAdminSignatures: item-centric, distinguishes 'not delivered' from 'not signed'",
    out.hasTitle && out.hasShed1Partial && out.hasShed2Missing && out.hasSyncWarning && out.remindButtonCount===1,
    JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. remindNonSigners: sends message only to sheds where the item was actually delivered AND has non-signers;
//    skips a shed entirely missing the item (sync gap, not a signature gap)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (s,k)=> store[s+"_"+k] ?? null;
    window.sSetIn = async (s,k,v)=> { store[s+"_"+k]=v; return true; };
    window.sGetRaw = async k=> store[k] ?? null;
    window.sSetRaw = async (k,v)=> { store[k]=v; return true; };
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.openWaPrompt=(kind,payload)=>{window._waKind=kind; window._waPayload=payload;};
    user="טומי"; userRole="מפקד"; isAdmin=true; isTechOfficer=false; isOwner=false;
    // shed1: הפריט קיים, רון טרם חתם.
    store["shed1_cfg_personnel"]=[{name:"דני"},{name:"רון"}];
    store["shed1_safety_events"]=[{id:"e1",title:"פריט"}];
    store["shed1_sigs_דני"]={e1:{}}; store["shed1_sigs_רון"]={};
    // shed2: כולם חתמו (לא אמור לקבל הודעה)
    store["shed2_cfg_personnel"]=[{name:"איתי"}];
    store["shed2_safety_events"]=[{id:"e1",title:"פריט"}];
    store["shed2_sigs_איתי"]={e1:{}};
    // shed3: הפריט מעולם לא נקלט שם (כשל הפצה) — אין למי לתזכר, לא כשל חתימה
    store["shed3_cfg_personnel"]=[{name:"עידן"}];
    store["shed3_safety_events"]=[];
    window._t=[];
    await remindNonSigners("e1","פריט לבדיקה");
    return {
      toasts: window._t,
      shed1Msg: (store["shed1_messages_list"]||[])[0],
      shed2Msg: store["shed2_messages_list"],
      shed3Msg: store["shed3_messages_list"],
      auditLog: (store["admin_audit_log"]||[]).length,
      waKind: window._waKind, waHasRon: (window._waPayload||"").includes("רון"), waHasShed3: (window._waPayload||"").includes("סככה 3"),
    };
  });
  record("remindNonSigners: messages only sheds with real non-signers, skips sync-gap shed, logged, WA offered",
    out.toasts.some(t=>t.includes("נשלחה")) && out.shed1Msg && out.shed1Msg.text.includes("רון") && out.shed1Msg.type==="urgent"
      && !out.shed2Msg && !out.shed3Msg && out.auditLog===1 && out.waKind==="remind" && out.waHasRon && !out.waHasShed3,
    JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. remindNonSigners: everyone already signed -> no-op with friendly toast, no messages sent
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (s,k)=> store[s+"_"+k] ?? null;
    window.sSetIn = async (s,k,v)=> { store[s+"_"+k]=v; return true; };
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    store["shed1_cfg_personnel"]=[{name:"דני"}];
    store["shed1_safety_events"]=[{id:"e1",title:"פריט הושלם"}];
    store["shed1_sigs_דני"]={e1:{}};
    window._t=[];
    await remindNonSigners("e1","פריט הושלם");
    return { toasts: window._t, shed1Msg: store["shed1_messages_list"] };
  });
  record("remindNonSigners: no-op when everyone already signed, no message sent",
    out.toasts.some(t=>t.includes("כולם חתמו")) && !out.shed1Msg, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
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
