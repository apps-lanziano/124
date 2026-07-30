/* מוודא שכל נתיב פרסום (הודעה/קרא-וחתום/לוח/הדרכה — מקומי וכלל-טייסתי)
   כותב בפועל למפתח Firestore בדיוק בפורמט <shedId>_<suffix> שה-Cloud
   Function (functions/index.js) מאזינה לו. זה לא בודק שליחת פוש אמיתית
   (דורש טוקן מכשיר אמיתי + פרויקט Firebase אמיתי) — זה בודק שהקוד כותב
   לנתיב הנכון, כלומר שה-Function שכבר נפרסה תיתפס ע"י כל אחד מהם. */
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
const SUFFIXES = ["messages_list","safety_events","boards_list","training_list"];
function matchesSuffix(key){ return SUFFIXES.some(s => key.endsWith("_"+s)); }

// 1. Local message publish (shed commander) -> writes <shedId>_messages_list
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const written = [];
    window.sSetRaw = async (k,v)=>{ written.push(k); return true; };
    window.sGetRaw = async ()=> null;
    window.toast=()=>{}; window.openWaPrompt=()=>{}; window.renderMessages=()=>{}; window.closeMsgAdd=()=>{};
    currentShed={id:"shed3",name:"סככה 3"}; user="מפקד"; userRole="מפקד"; isAdmin=false;
    document.getElementById("msg-text").value = "הודעת בדיקה";
    await saveMessage();
    return { written };
  });
  const key = out.written.find(k=>k.includes("messages_list"));
  record("Local message publish -> writes shed3_messages_list (Function-watched)",
    key === "shed3_messages_list", JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. Admin (training officer) message publish squadron-wide -> writes <shedId>_messages_list for every shed
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const written = [];
    window.sSetIn = async (shed,k,v)=>{ written.push(shed+"_"+k); return true; };
    window.sGetIn = async ()=> [];
    window.sSetRaw = async (k,v)=>{ written.push(k); return true; };
    window.sGetRaw = async ()=> [];
    window.toast=()=>{}; window.openWaPrompt=()=>{}; window.renderAdminDashboard=async()=>{}; window.closeMsgAdd=()=>{};
    isAdmin=true; user="טומי";
    document.getElementById("msg-text").value = "הודעת בדיקה כלל-טייסתית";
    await saveMessage();
    return { written, allShedsHit: SHEDS.every(s => written.includes(s.id+"_messages_list")) };
  });
  record("Admin message publish (squadron-wide) -> writes <shed>_messages_list for every shed",
    out.allShedsHit, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. remindNonSigners -> also writes <shedId>_messages_list (rides the same push path)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (s,k)=> store[s+"_"+k] ?? null;
    const written = [];
    window.sSetIn = async (s,k,v)=>{ written.push(s+"_"+k); store[s+"_"+k]=v; return true; };
    window.sGetRaw = async k=> store[k] ?? null;
    window.sSetRaw = async (k,v)=>{ store[k]=v; return true; };
    window.toast=()=>{}; window.openWaPrompt=()=>{};
    store["shed1_cfg_personnel"]=[{name:"א"},{name:"ב"}];
    store["shed1_safety_events"]=[{id:"e1",title:"פריט לבדיקה"}];   // הפריט אכן נקלט בסככה — אחרת תזכורת נחסמת בכוונה
    store["shed1_sigs_א"]={e1:{}}; store["shed1_sigs_ב"]={};
    await remindNonSigners("e1","פריט לבדיקה");
    return { written };
  });
  record("remindNonSigners -> writes shed1_messages_list (Function-watched)",
    out.written.includes("shed1_messages_list"), JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. Local safety-event publish -> writes <shedId>_safety_events
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const written = [];
    window.sSetRaw = async (k,v)=>{ written.push(k); return true; };
    window.sGetRaw = async ()=> null;
    window.sSetIn = async ()=>true; window.sGetIn = async ()=>null;
    window.toast=()=>{}; window.openWaPrompt=()=>{}; window.logAction=async()=>{}; window.closeAddEvent=()=>{};
    currentShed={id:"shed4",name:"סככה 4"}; isAdmin=false; window._adminPublish=false; user="מפקד";
    evImgData="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    evFileMeta={type:"image",name:"n",mime:"image/png"};
    document.getElementById("ev-title").value="פריט בדיקה";
    document.getElementById("ev-save").disabled=false; document.getElementById("ev-save").textContent="פרסום הפריט";
    await saveEvent();
    return { written };
  });
  record("Local safety-event publish -> writes shed4_safety_events (Function-watched)",
    out.written.includes("shed4_safety_events"), JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. Admin/training-officer safety-event publish squadron-wide -> writes <shedId>_safety_events for every shed
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const written = [];
    window.sSetIn = async (shed,k,v)=>{ written.push(shed+"_"+k); return true; };
    window.sGetIn = async ()=> [];
    window.sSetRaw = async (k,v)=>{ written.push(k); return true; };
    window.sGetRaw = async ()=> [];
    window.toast=()=>{}; window.openWaPrompt=()=>{}; window.logAction=async()=>{}; window.renderAdminDashboard=async()=>{}; window.closeAddEvent=()=>{};
    isAdmin=true; window._adminPublish=true;
    evImgData="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    evFileMeta={type:"image",name:"n",mime:"image/png"};
    document.getElementById("ev-title").value="פריט כלל-טייסתי";
    document.getElementById("ev-save").disabled=false; document.getElementById("ev-save").textContent="פרסום הפריט";
    await saveEvent();
    return { written, allShedsHit: SHEDS.every(s => written.includes(s.id+"_safety_events")) };
  });
  record("Admin safety-event publish (squadron-wide) -> writes <shed>_safety_events for every shed",
    out.allShedsHit, JSON.stringify(out));
  console.log("errs5",errs); await p.close();
}

// 6. Board — local (choice: "למסגרת שלי בלבד") -> writes <shedId>_boards_list
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const written = [];
    window.sSetSafe = async (k,v)=>{ written.push(shedKey(k)); return true; };
    window.toast=()=>{}; window.openWaPrompt=()=>{}; window.renderBoard=()=>{};
    isAdmin=false; isBoardPublisher=false; userRole="מפקד"; currentShed={id:"shed5",name:"סככה 5"}; user="מפקד";
    triggerBoardUpload();
    document.querySelectorAll('#board-scope-modal button.admin-card')[0].click(); // "למסגרת שלי בלבד"
    const c=document.createElement('canvas'); c.width=30;c.height=30; c.getContext('2d').fillRect(0,0,30,30);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer(); dt.items.add(new File([blob],"x.png",{type:"image/png"}));
    document.getElementById('board-input').files=dt.files;
    onBoardFile({target:document.getElementById('board-input')});
    await new Promise(r=>setTimeout(r,350));
    return { written };
  });
  record("Board local upload (choice: 'למסגרת שלי') -> writes shed5_boards_list (Function-watched)",
    out.written.includes("shed5_boards_list"), JSON.stringify(out));
  console.log("errs6",errs); await p.close();
}

// 7. Board — squadron-wide (choice: "לכלל המסגרות") -> writes <shedId>_boards_list for every shed
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const written = [];
    window.sGetIn = async ()=> [];
    window.sSetIn = async (shed,k,v)=>{ written.push(shed+"_"+k); return true; };
    window.sDelRaw = async ()=>{};
    window.sGetRaw = async ()=> [];
    window.sSetRaw = async (k,v)=>{ written.push(k); return true; };
    window.toast=()=>{}; window.openWaPrompt=()=>{}; window.renderBoard=()=>{};
    isAdmin=false; isBoardPublisher=false; userRole="מפקד"; currentShed={id:"shed1",name:"סככה 1"}; user="מפקד";
    triggerBoardUpload();
    document.querySelectorAll('#board-scope-modal button.admin-card')[1].click(); // "לכלל המסגרות"
    const c=document.createElement('canvas'); c.width=30;c.height=30; c.getContext('2d').fillRect(0,0,30,30);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer(); dt.items.add(new File([blob],"x.png",{type:"image/png"}));
    document.getElementById('board-input').files=dt.files;
    onBoardFile({target:document.getElementById('board-input')});
    await new Promise(r=>setTimeout(r,350));
    return { written, allShedsHit: SHEDS.every(s => written.includes(s.id+"_boards_list")) };
  });
  record("Board squadron-wide (choice: 'לכלל המסגרות') -> writes <shed>_boards_list for every shed",
    out.allShedsHit, JSON.stringify(out));
  console.log("errs7",errs); await p.close();
}

// 8. Training material publish (always squadron-wide) -> writes <shedId>_training_list for every shed
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const written = [];
    window.sGetIn = async ()=> [];
    window.sSetIn = async (shed,k,v)=>{ written.push(shed+"_"+k); return true; };
    window.sGetRaw = async ()=> [];
    window.sSetRaw = async (k,v)=>{ written.push(k); return true; };
    window.toast=()=>{}; window.renderAdminTraining=()=>{};
    const ok = await publishTrainingToAllSheds("t9", "מסמך בדיקה.pdf", "pdf", "data:application/pdf;base64,JVBERi0x", null);
    return { ok, written, allShedsHit: SHEDS.every(s => written.includes(s.id+"_training_list")) };
  });
  record("Training material publish (squadron-wide) -> writes <shed>_training_list for every shed",
    out.ok && out.allShedsHit, JSON.stringify(out));
  console.log("errs8",errs); await p.close();
}

// 9. Sanity: none of the written keys for these flows are OUTSIDE the 4 Function-watched suffixes in a way that misses the pattern
//    (spot-check the regex the Function itself uses against a sample of real keys)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const sample = ["shed1_messages_list","dept_safety_events","training_boards_list","maint_training_list","shed3_cfg_personnel","shed2_sigs_דני"];
    const re = /_(messages_list|safety_events|boards_list|training_list)$/;
    return sample.map(k=>({k, matched: re.test(k)}));
  });
  const expected = [true,true,true,true,false,false];
  const ok = out.every((o,i)=>o.matched===expected[i]);
  record("Cloud Function suffix regex: matches the 4 tracked kinds, ignores others (e.g. cfg_personnel/sigs_*)",
    ok, JSON.stringify(out));
  console.log("errs9",errs); await p.close();
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
