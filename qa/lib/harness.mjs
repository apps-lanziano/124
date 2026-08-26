/* ============================================================
   תשתית משותפת לסוכני הבדיקה — טייסת 124
   ------------------------------------------------------------
   מריצה את האפליקציה האמיתית בדפדפן אמיתי (Chromium), עם שכבת
   אחסון מדומה בזיכרון במקום Firebase. חשוב: המדמה מוזרק ברמה
   הנמוכה ביותר (window.storage) ולא ברמת sGet/sSet — כך שכל
   הלוגיקה של האפליקציה רצה באמת, ולא מוחלפת בבדיקה.
   ============================================================ */
import { launchBrowser, APP_URL as APP_URL_RESOLVED } from './pw.mjs';

export const APP_URL = APP_URL_RESOLVED;

export const SHED_LIST = [
  {id:"shed1", name:"סככה 1"}, {id:"shed2", name:"סככה 2"}, {id:"shed3", name:"סככה 3"},
  {id:"shed4", name:"סככה 4"}, {id:"shed5", name:"סככה 5"},
  {id:"dept", name:"מחלקות", isDept:true},
  {id:"maint", name:"מ״ע אחזקה", isMaint:true},
  {id:"training", name:"הדרכה", isTraining:true},
];

export const ALL_SCREENS = [
  "scr-safety","scr-morning","scr-duties","scr-calendar","scr-onboarding","scr-faults","scr-board",
  "scr-bdays","scr-people","scr-rollcall","scr-trainhub","scr-naatim","scr-certs","scr-medchecks",
  "scr-tools","scr-vehicles","scr-training","scr-cmd","scr-admin","scr-vehicle-officer",
  "scr-maint-dept","scr-binui-admin","scr-budget-officer","scr-users",
];

let browser = null;
export async function getBrowser(){
  if(!browser) browser = await launchBrowser();
  return browser;
}
export async function closeBrowser(){ if(browser){ await browser.close(); browser = null; } }

/* פותח עמוד נקי עם רשת חסומה ואיסוף שגיאות JS.
   כל שגיאת JS שנזרקת בזמן הריצה נאספת — זה הלב של הסריקה:
   מסך ש"נראה בסדר" אבל זורק שגיאה בקונסולה הוא באג שהמשתמש
   יחווה כנתונים חסרים או ככפתור שלא מגיב. */
export async function newPage(){
  const b = await getBrowser();
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  await p.route('**firebaseio.com/**', r=>r.abort());
  await p.route('**cloudflare.com/**', r=>r.abort());
  const pageErrors = [];
  const consoleErrors = [];
  p.on('pageerror', e => pageErrors.push(String(e.message)));
  p.on('console', m => { if(m.type()==='error') consoleErrors.push(m.text().slice(0,300)); });
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(300);
  await installMockStorage(p);
  return { page:p, pageErrors, consoleErrors };
}

/* שכבת אחסון בזיכרון + נתוני זריעה ריאליסטיים לכל המסגרות.
   fbReady=false מנתב את כל הקריאות/כתיבות ל-window.storage. */
async function installMockStorage(p){
  await p.evaluate(({sheds})=>{
    const store = {};
    window.__store = store;
    window.storage = {
      async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
      async set(k,v){ store[k]=v; },
      async delete(k){ delete store[k]; },
    };
    fbReady = false;
    const put = (k,v)=>{ store[k] = JSON.stringify(v); };

    const today = new Date().toISOString().slice(0,10);
    for(const s of sheds){
      put(s.id+"_cfg_personnel", [
        {name:"מפקד "+s.name, role:"מפקד", bday:"1995-03-10"},
        {name:"חייל א "+s.name, role:"חייל", bday:"2003-06-01", joined:today},
        {name:"חייל ב "+s.name, role:"חייל", bday:"2002-11-20", joined:today, reserve:true, refresh:today},
      ]);
      put(s.id+"_safety_events", [{id:"ev_seed_1", title:"תדריך בטיחות לדוגמה", by:"מפקד", date:"1.1.2026", ftype:"image", thumb:""}]);
      put(s.id+"_messages_list", [{id:"msg_seed_1", text:"הודעת בדיקה", type:"normal", by:"מפקד", date:"1.1.2026"}]);
      put(s.id+"_boards_list", [{id:"board_seed_1", label:"לוח שבועי לדוגמה", thumb:"", by:"מפקד", date:"1.1.2026"}]);
      put(s.id+"_training_list", [{id:"tr_seed_1", title:"חומר הדרכה לדוגמה", ftype:"pdf", fname:"a.pdf"}]);
      put(s.id+"_certs_list", [{id:"c1", person:"חייל א "+s.name, name:"🟢 סף", expiry:"2027-01-01"}]);
      put(s.id+"_faults_list", [{id:"f_seed_1", title:"תקלה לדוגמה", by:"חייל", status:"פתוח", date:"1.1"}]);
      put(s.id+"_tools_list", [{id:"t1", name:"מפתח שוודי", qty:2}]);
      put(s.id+"_vehicles_list", [{id:"v1", name:"רכב לדוגמה", number:"11-111-11", testDate:"2027-01-01"}]);
      put(s.id+"_naatim_list", [{id:"n1", area:"חדר כלים", person:"חייל א "+s.name}]);
      put(s.id+"_sigs_"+("חייל א "+s.name).replace(/[^\wא-ת]/g,"_"), {});
    }
    put("admin_events", [{id:"ev_seed_1", title:"תדריך בטיחות לדוגמה", ftype:"image", date:"1.1.2026"}]);
    put("admin_training", [{id:"tr_seed_1", title:"חומר הדרכה לדוגמה", ftype:"pdf"}]);
    put("binui_faults_list", [{id:"bf1", title:"תקלת בינוי לדוגמה", by:"מפקד", shedId:"shed1", status:"פתוח", date:"1.1"}]);
    put("vo_licenses_list", []);
    put("admin_audit_log", []);
  }, {sheds: SHED_LIST});
}

/* התחברות אמיתית דרך המסלול של האפליקציה עצמה (enterFrameworkAfterAuth
   -> בחירת שם -> שער PIN -> doLogin). לא מדלגים על שום שלב הרשאות —
   זו בדיוק החוויה של המשתמש האמיתי. */
export async function loginAsFramework(page, shedId, role, personIndex=0){
  const shed = SHED_LIST.find(s=>s.id===shedId);
  return page.evaluate(async ({shed, role, personIndex})=>{
    const errors = [];
    try{
      window.initPush = async()=>{};
      await enterFrameworkAfterAuth(shed, role, "TEST");
      const people = PERSONNEL.filter(p=>p.role===role);
      const person = people[personIndex] || people[0];
      if(!person) return {ok:false, why:"לא נמצא משתמש מתאים במסגרת", errors};
      // הגדרת PIN אמיתי דרך פונקציות האפליקציה, כדי שהאימות ירוץ באמת
      // חייב לעבור דרך buildPinFields — הגדרת pinHash בלי שדה האלגוריתם
      // גורמת ל-verifyPin לבדוק מול הפורמט הישן והכניסה נכשלת.
      Object.assign(person, await buildPinFields("1234"));
      const sel = document.getElementById("login-select");
      sel.value = person.name;
      onLoginNameChange();
      document.getElementById("login-pin").value = "1234";
      await doLogin();
      const loggedIn = document.getElementById("login-overlay").style.display === "none";
      return {ok:loggedIn, who:person.name, role, errors};
    }catch(e){ return {ok:false, why:String(e && e.message), errors}; }
  }, {shed, role, personIndex});
}

/* מנהל-על: מוסיף (אם חסר) אדם בשם SUPER_ADMIN_NAME לצוות המסגרת, ונכנס
   כמפקד רגיל בשמו — ההרשאה הנוספת (ניהול משתמשים) אמורה להתעורר
   אוטומטית ב-doLogin לפי התאמת השם, לא דרך מסלול כניסה נפרד. */
export async function loginAsSuperAdmin(page, shedId="shed1"){
  const shed = SHED_LIST.find(s=>s.id===shedId);
  return page.evaluate(async ({shed})=>{
    try{
      let list = (await sGetIn(shed.id, "cfg_personnel")) || [];
      if(!list.some(p=>p.name===SUPER_ADMIN_NAME)){
        list = [...list, {name:SUPER_ADMIN_NAME, role:"מפקד", bday:"1990-01-01"}];
        await sSetIn(shed.id, "cfg_personnel", list);
      }
      window.initPush = async()=>{};
      await enterFrameworkAfterAuth(shed, "מפקד", "TEST");
      const person = PERSONNEL.find(p=>p.name===SUPER_ADMIN_NAME);
      if(!person) return {ok:false, why:"לא נמצא אחרי הוספה לצוות"};
      Object.assign(person, await buildPinFields("1234"));
      const sel = document.getElementById("login-select");
      sel.value = person.name;
      onLoginNameChange();
      document.getElementById("login-pin").value = "1234";
      await doLogin();
      const loggedIn = document.getElementById("login-overlay").style.display === "none";
      return {ok:loggedIn, who:person.name};
    }catch(e){ return {ok:false, why:String(e && e.message)}; }
  }, {shed});
}

/* "owner" (מנהל מערכת, כניסה נפרדת עם קוד ייעודי) הוסר — ההרשאה עברה
   לזהות אישית (SUPER_ADMIN_NAME) דרך הכניסה הרגילה, ראו loginAsFramework
   + הגדרת PERSONNEL[].name===SUPER_ADMIN_NAME בבדיקות רלוונטיות. */
export async function loginAsSpecial(page, kind){
  return page.evaluate(async ({kind})=>{
    try{
      window.initPush = async()=>{};
      if(kind==="tech"){ enteredRole="קצין טכני"; isTechOfficer=true; currentShed=null; await techOfficerLogin(); }
      else if(kind==="budget"){ enteredRole="אחראי תקציבים"; isBudgetOfficer=true; currentShed=null; await budgetOfficerLogin(); }
      else return {ok:false, why:"סוג לא מוכר"};
      const loggedIn = document.getElementById("login-overlay").style.display === "none";
      return {ok:loggedIn, who:kind};
    }catch(e){ return {ok:false, why:String(e && e.message)}; }
  }, {kind});
}

/* אילו מסכים גלויים בפועל למשתמש הזה (לפי סרגל הניווט) */
export async function visibleScreens(page){
  return page.evaluate(()=>{
    const out = [];
    document.querySelectorAll("nav .nav-btn").forEach(b=>{
      if(!b.classList.contains("hidden") && b.dataset.scr) out.push(b.dataset.scr);
    });
    return out;
  });
}

/* סורק חסימות-לחיצה: עבור הקונטיינר הפעיל (שכבת-על פתוחה אם יש, אחרת
   המסך הפעיל), מוודא שכל אלמנט אינטראקטיבי גלוי הוא באמת האלמנט
   העליון בנקודת המרכז שלו (document.elementFromPoint). אם אלמנט אחר
   מכסה אותו — המשתמש לא יכול ללחוץ עליו, וזה בדיוק סוג הבאג שמשתמשים
   גילו ידנית (כפתור צף שחוסם, פקד זום מעל "אישור קריאה"). מחזיר רשימת
   פקדים חסומים (ריק = תקין). מסנן אלמנטים מוסתרים/זעירים/מחוץ למסך
   וקינון לגיטימי (אלמנט מכוסה ע"י צאצא/הורה של עצמו). */
export async function findOccludedControls(page, contextLabel){
  return page.evaluate((label)=>{
    const overlay = document.querySelector('#doc-reader.open, #board-viewer.open, .modal-bg.open, .sheet-bg.open');
    const container = overlay || document.querySelector('.screen.active') || document.body;
    const vw = window.innerWidth, vh = window.innerHeight;
    const sel = 'button, a[href], [role="button"], .m-btn, .admin-card, .banner, .confirm-btn';
    const bad = [];
    for(const el of container.querySelectorAll(sel)){
      if(el.disabled) continue;
      const cs = getComputedStyle(el);
      if(cs.display==='none' || cs.visibility==='hidden' || Number(cs.opacity)===0 || cs.pointerEvents==='none') continue;
      const r = el.getBoundingClientRect();
      if(r.width < 8 || r.height < 8) continue;               // מכווץ/מוסתר
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      if(cx < 0 || cy < 0 || cx > vw || cy > vh) continue;     // גלל מחוץ למסך — לא נבדק
      // דלג על אלמנטים שנחתכים ע"י אב עם overflow (אקורדיון/פאנל מקופל
      // עם max-height:0) — יש להם מיקום ב-DOM אך אינם נראים/לחיצים בפועל,
      // ולכן elementFromPoint יחזיר את מה שמעליהם ויפליל אותם בטעות.
      let clipped = false;
      for(let anc = el.parentElement; anc && anc !== document.body; anc = anc.parentElement){
        const acs = getComputedStyle(anc);
        if(acs.overflow !== 'visible' || acs.overflowY !== 'visible' || acs.overflowX !== 'visible'){
          const ar = anc.getBoundingClientRect();
          if(cx < ar.left-1 || cx > ar.right+1 || cy < ar.top-1 || cy > ar.bottom+1){ clipped = true; break; }
        }
      }
      if(clipped) continue;
      const hit = document.elementFromPoint(cx, cy);
      if(!hit) continue;
      if(el === hit || el.contains(hit) || hit.contains(el)) continue;   // קינון לגיטימי
      if(hit.closest && hit.closest('button, a[href], [role="button"]') === el) continue;
      // כיסוי ע"י "כרום" קבוע (סרגל ניווט תחתון, או כפתור "לדשבורד" שיושב
      // כיום בתוך ה-header הקבוע) — אינו באג לחיצה אמיתי כי הוא מחוץ לאזור
      // הגלילה של התוכן. אבל בשכבת-על (שלא נגללת) כל כיסוי הוא באג ולכן נשמר.
      const coveredByChrome = hit.closest && (hit.closest("nav") || (!overlay && hit.closest("#back-to-dash")));
      if(coveredByChrome) continue;
      bad.push({
        context: label || "",
        control: ((el.id ? "#"+el.id : "") + " " + (el.textContent||"").trim().slice(0,32)).trim() || el.className,
        coveredBy: (hit.id ? "#"+hit.id : (hit.className && typeof hit.className==="string" ? "."+hit.className.split(" ")[0] : hit.tagName)),
      });
    }
    return bad;
  }, contextLabel);
}

/* מנווט למסך ומחזיר האם הוא נטען והציג תוכן */
export async function visitScreen(page, screenId){
  return page.evaluate(async (id)=>{
    try{
      go(id, null);
      await new Promise(r=>setTimeout(r, 220));
      const el = document.getElementById(id);
      if(!el) return {ok:false, why:"המסך לא קיים ב-DOM"};
      if(!el.classList.contains("active")) return {ok:false, why:"המסך לא הפך לפעיל"};
      const text = (el.innerText||"").trim();
      const spinnerStuck = /טוען…/.test(text) && text.length < 40;
      return {ok:true, chars:text.length, empty:text.length<10, spinnerStuck};
    }catch(e){ return {ok:false, why:String(e && e.message)}; }
  }, screenId);
}
