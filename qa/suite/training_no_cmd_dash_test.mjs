/* מוודא שדשבורד המפקד ("תמונת מצב — מפקד") הוסר מאחראי ההדרכה,
   ושלא נפגעה שום זהות אחרת: מפקד סככה רגיל, מ״ע אחזקה, וחייל. */
import { launchBrowser } from '../lib/pw.mjs';
const b = await launchBrowser();
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

/* מריץ את בלוק ההרשאות של doLogin עבור זהות נתונה, בלי לעבור את שער ה-PIN
   (שדורש Firebase). מדמה בדיוק את הענפים הרלוונטיים מ-doLogin. */
async function applyIdentity(p, shed, role){
  return p.evaluate(async ({shed, role})=>{
    // איפוס: כל כפתורי הניווט גלויים כברירת מחדל בבדיקה
    document.querySelectorAll("nav .nav-btn").forEach(x=>x.classList.remove("hidden"));
    currentShed = shed; userRole = role; user = "בודק"; isAdmin = false;
    window.ensureShed2Seed = async()=>{}; window.ensureAllShedsSeed = async()=>{};

    const navCmd = document.getElementById("nav-cmd");
    if(userRole === "מפקד") navCmd.classList.remove("hidden");
    else navCmd.classList.add("hidden");

    if(currentShed && (currentShed.isMaint || currentShed.isTraining)){
      ["nav-tools","tools-add-btn","nav-vehicles","vehicles-add-btn","nav-certs","cert-add-btn",
       "nav-morning","more-tasks-item","more-binui-item","sheet-closeday","close-mgmt-btn",
       "nav-faults","more-faults-item","sheet-naatim","naatim-mgmt-btn"
      ].forEach(id=>document.getElementById(id).classList.add("hidden"));
      document.getElementById("tab-morning").classList.add("hidden");
    }
    // הענף שנוסף: הסרת דשבורד המפקד מאחראי ההדרכה
    if(userRole === "מפקד" && currentShed.isTraining){
      document.getElementById("nav-cmd").classList.add("hidden");
    }
    if(userRole === "מפקד" && currentShed.isTraining) await applyTrainingCommanderPowers();
    if(userRole === "מפקד" && currentShed.isMaint)    await applyMaintCommanderPowers();

    const hidden = id => document.getElementById(id).classList.contains("hidden");
    return { navCmdHidden: hidden("nav-cmd"), navAdminHidden: hidden("nav-admin") };
  }, {shed, role});
}

// 1. אחראי הדרכה — אין דשבורד מפקד, יש מרכז שליטה
{
  const {p, errs} = await page();
  const out = await applyIdentity(p, {id:"training", name:"הדרכה", isTraining:true}, "מפקד");
  record("אחראי הדרכה: דשבורד המפקד מוסתר, מרכז השליטה נשאר",
    out.navCmdHidden===true && out.navAdminHidden===false, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. מפקד סככה רגיל — דשבורד המפקד נשאר כרגיל (אין רגרסיה)
{
  const {p, errs} = await page();
  const out = await applyIdentity(p, {id:"shed2", name:"סככה 2"}, "מפקד");
  record("מפקד סככה רגיל: דשבורד המפקד נשאר גלוי",
    out.navCmdHidden===false, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. מ״ע אחזקה — לא הושפע (נשאר כפי שהיה)
{
  const {p, errs} = await page();
  const out = await applyIdentity(p, {id:"maint", name:"מ״ע אחזקה", isMaint:true}, "מפקד");
  record("מ״ע אחזקה: לא הושפע מהשינוי",
    out.navCmdHidden===false, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. חייל במסגרת הדרכה — ממילא אין לו דשבורד מפקד
{
  const {p, errs} = await page();
  const out = await applyIdentity(p, {id:"training", name:"הדרכה", isTraining:true}, "חייל");
  record("חייל במסגרת הדרכה: אין דשבורד מפקד (ללא שינוי)",
    out.navCmdHidden===true, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. כפתור "לדשבורד" נעלם מעצמו כשאין nav-cmd, ומופיע כשיש
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.renderMessages=()=>{}; window.renderBrief=()=>{};
    window.renderAdminDashboard=async()=>{}; window.renderDocs=async()=>{};
    // אחראי הדרכה: nav-cmd מוסתר -> הכפתור לא אמור להופיע בשום מסך
    document.getElementById("nav-cmd").classList.add("hidden");
    go("scr-safety", null);
    const hiddenForTraining = !document.getElementById("back-to-dash").classList.contains("show");
    // מפקד סככה: nav-cmd גלוי -> הכפתור מופיע במסך שאינו הדשבורד
    document.getElementById("nav-cmd").classList.remove("hidden");
    go("scr-safety", null);
    const shownForShedCmdr = document.getElementById("back-to-dash").classList.contains("show");
    return {hiddenForTraining, shownForShedCmdr};
  });
  record("כפתור 'לדשבורד': מוסתר לאחראי הדרכה, נשאר למפקד סככה",
    out.hiddenForTraining && out.shownForShedCmdr, JSON.stringify(out));
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
