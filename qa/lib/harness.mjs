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
  "scr-safety","scr-morning","scr-duties","scr-faults","scr-binui-faults","scr-board",
  "scr-bdays","scr-rollcall","scr-closeday","scr-naatim","scr-certs","scr-medchecks",
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
      const salt = genSalt();
      person.pinHash = await hashPin("1234", salt); person.pinSalt = salt;
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

export async function loginAsSpecial(page, kind){
  return page.evaluate(async ({kind})=>{
    try{
      window.initPush = async()=>{};
      if(kind==="owner"){ enteredRole="מנהל מערכת"; isOwner=true; currentShed=null; await ownerLogin(); }
      else if(kind==="tech"){ enteredRole="קצין טכני"; isTechOfficer=true; currentShed=null; await techOfficerLogin(); }
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
