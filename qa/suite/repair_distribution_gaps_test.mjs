/* תיקון פערי הפצה — קרא-וחתום/הדרכה שפורסמו לכולם אבל בכשל חד-פעמי
   לא הגיעו לכל המסגרות. הבדיקה: הפונקציה מוסיפה רק את מה שחסר, מעתיקה
   גם את קובץ המצורף (לא רק את הכותרת), ולא נוגעת במסגרות שכבר יש להן
   את הפריט (כדי לא לאבד חתימות קיימות). */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { p, errs } = await (async()=>{
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  return {p, errs};
})();

const out = await p.evaluate(async ()=>{
  const store = {};
  window.storage = {
    async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
    async set(k,v){ store[k]=v; return true; },
    async delete(k){ delete store[k]; },
  };
  fbReady = false;
  window.confirm = ()=>true;
  window.toast = ()=>{};
  window.logAdminAction = async()=>{};
  window.renderAdminEvents = async()=>{};
  window.renderAdminTraining = async()=>{};
  const put = (k,v)=>{ store[k] = JSON.stringify(v); };

  // קרא-וחתום: פורסם לכולם, אבל shed2/shed4 "פספסו" את הכתיבה בזמנו
  put("admin_events", [{id:"ev1", title:"מסמך קריטי", ftype:"image", date:"1.1"}]);
  for(const s of ["shed1","shed3","shed5","dept","maint","training"]){
    put(s+"_safety_events", [{id:"ev1", title:"מסמך קריטי", ftype:"image", date:"1.1"}]);
    put(s+"_safety_ev_ev1", "data:image/png;base64,AAAA");
  }
  put("shed2_safety_events", []);
  put("shed4_safety_events", [{id:"other", title:"פריט אחר", ftype:"image", date:"1.1"}]);
  // חתימה קיימת במסגרת שכבר יש לה את הפריט — לוודא שלא נמחקת
  put("shed1_sigs_דני", { ev1: { date:"1.1", read:true } });

  // חומר הדרכה: shed3 חסר
  put("admin_training", [{id:"tr1", title:"מצגת בטיחות", ftype:"pdf"}]);
  put("admin_training_file_tr1", "data:application/pdf;base64,BBBB");
  for(const s of ["shed1","shed2","shed4","shed5","dept","maint","training"]){
    put(s+"_training_list", [{id:"tr1", title:"מצגת בטיחות", ftype:"pdf"}]);
    put(s+"_training_file_tr1", "data:application/pdf;base64,BBBB");
  }
  put("shed3_training_list", []);

  await repairDistributionGaps();

  return {
    shed2Events: JSON.parse(store["shed2_safety_events"]),
    shed2File: JSON.parse(store["shed2_safety_ev_ev1"] ?? "null"),
    shed4Events: JSON.parse(store["shed4_safety_events"]),
    shed4File: JSON.parse(store["shed4_safety_ev_ev1"] ?? "null"),
    shed1EventsUnchanged: JSON.parse(store["shed1_safety_events"]),
    shed1SigIntact: JSON.parse(store["shed1_sigs_דני"]),
    shed3Training: JSON.parse(store["shed3_training_list"]),
    shed3TrainingFile: JSON.parse(store["shed3_training_file_tr1"] ?? "null"),
  };
});

record("סככה 2 (רשימה ריקה): הפריט נוסף עם הכותרת הנכונה",
  out.shed2Events.length===1 && out.shed2Events[0].id==="ev1" && out.shed2Events[0].title==="מסמך קריטי",
  JSON.stringify(out.shed2Events));
record("סככה 2: קובץ המצורף הועתק בפועל, לא רק המטא-דאטה",
  out.shed2File === "data:image/png;base64,AAAA", String(out.shed2File));
record("סככה 4 (יש לה כבר פריט אחר): הפריט החסר נוסף בלי למחוק את הקיים",
  out.shed4Events.length===2 && out.shed4Events.some(e=>e.id==="ev1") && out.shed4Events.some(e=>e.id==="other"),
  JSON.stringify(out.shed4Events));
record("סככה 4: קובץ המצורף הועתק",
  out.shed4File === "data:image/png;base64,AAAA", String(out.shed4File));
record("סככה 1 (כבר הייתה לה את הפריט): הרשימה לא שוכפלה",
  out.shed1EventsUnchanged.length===1, JSON.stringify(out.shed1EventsUnchanged));
record("חתימה קיימת במסגרת שלא נגעו בה נשארה שלמה",
  out.shed1SigIntact && out.shed1SigIntact.ev1 && out.shed1SigIntact.ev1.read===true,
  JSON.stringify(out.shed1SigIntact));
record("חומר הדרכה: סככה 3 קיבלה את הפריט והקובץ שחסרו לה",
  out.shed3Training.length===1 && out.shed3Training[0].id==="tr1" && out.shed3TrainingFile==="data:application/pdf;base64,BBBB",
  JSON.stringify({list:out.shed3Training, file:out.shed3TrainingFile}));

console.log("errs", errs);
await p.close();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await b.close();
process.exit(allPass?0:1);
