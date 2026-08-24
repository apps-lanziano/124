/* לכידת מסך מלא של דשבורד המפקד (scr-cmd) עם כל הפיצ'רים החיים,
   דרך ה-QA harness (אפליקציה אמיתית + דאטה מדומה). */
import { newPage, loginAsFramework, visitScreen, closeBrowser, getBrowser } from './lib/harness.mjs';
import { launchBrowser } from './lib/pw.mjs';
import { writeFileSync } from 'fs';

const OUT = process.argv[2] || '/tmp/scr-cmd.png';
const SCREEN = process.argv[3] || 'scr-cmd';

// דפדפן ברזולוציית מובייל חדה
const browser = await launchBrowser();
const page = await browser.newPage({ viewport:{ width:430, height:932 }, deviceScaleFactor:2 });
await page.route('**gstatic.com/**', r=>r.abort());
await page.route('**googleapis.com/**', r=>r.abort());
await page.route('**firebaseio.com/**', r=>r.abort());
await page.route('**cloudflare.com/**', r=>r.abort());

import { APP_URL } from './lib/pw.mjs';
await page.goto(APP_URL, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(300);

// הזרקת אחסון מדומה + זריעת דאטה (זהה ל-harness.installMockStorage)
const { SHED_LIST } = await import('./lib/harness.mjs');
await page.evaluate(({sheds})=>{
  const store = {}; window.__store = store;
  window.storage = { async get(k){ return store[k]!==undefined?{value:store[k]}:null; }, async set(k,v){ store[k]=v; }, async delete(k){ delete store[k]; } };
  fbReady = false;
  const put=(k,v)=>{ store[k]=JSON.stringify(v); };
  const today = new Date().toISOString().slice(0,10);
  for(const s of sheds){
    put(s.id+"_cfg_personnel",[
      {name:"מפקד "+s.name,role:"מפקד",bday:"1995-03-10"},
      {name:"חייל א "+s.name,role:"חייל",bday:"2003-06-01",joined:today},
      {name:"חייל ב "+s.name,role:"חייל",bday:"2002-11-20",joined:today,reserve:true,refresh:today},
    ]);
    put(s.id+"_safety_events",[{id:"ev1",title:"תדריך בטיחות לדוגמה",by:"מפקד",date:"1.1.2026",ftype:"image",thumb:""}]);
    put(s.id+"_messages_list",[{id:"m1",text:"הודעת בדיקה",type:"normal",by:"מפקד",date:"1.1.2026"}]);
    put(s.id+"_boards_list",[{id:"b1",label:"לוח שבועי לדוגמה",thumb:"",by:"מפקד",date:"1.1.2026"}]);
    put(s.id+"_training_list",[{id:"tr1",title:"חומר הדרכה לדוגמה",ftype:"pdf",fname:"a.pdf"}]);
    put(s.id+"_certs_list",[{id:"c1",person:"חייל א "+s.name,name:"🟢 סף",expiry:"2027-01-01"}]);
    put(s.id+"_faults_list",[{id:"f1",title:"תקלה לדוגמה",by:"חייל",status:"פתוח",date:"1.1"}]);
    put(s.id+"_tools_list",[{id:"t1",name:"מפתח שוודי",qty:2}]);
    put(s.id+"_vehicles_list",[{id:"v1",name:"רכב לדוגמה",number:"11-111-11",testDate:"2027-01-01"}]);
    put(s.id+"_naatim_list",[{id:"n1",area:"חדר כלים",person:"חייל א "+s.name}]);
  }
  put("admin_events",[{id:"ev1",title:"תדריך בטיחות לדוגמה",ftype:"image",date:"1.1.2026"}]);
  put("admin_training",[{id:"tr1",title:"חומר הדרכה לדוגמה",ftype:"pdf"}]);
  put("vo_licenses_list",[]); put("admin_audit_log",[]);
}, {sheds: SHED_LIST});

// התחברות כמפקד
const login = await page.evaluate(async ({shed})=>{
  try{
    window.initPush = async()=>{};
    await enterFrameworkAfterAuth(shed, "מפקד", "TEST");
    const person = PERSONNEL.find(p=>p.role==="מפקד");
    Object.assign(person, await buildPinFields("1234"));
    const sel=document.getElementById("login-select"); sel.value=person.name; onLoginNameChange();
    document.getElementById("login-pin").value="1234";
    await doLogin();
    return { ok: document.getElementById("login-overlay").style.display==="none", who:person.name };
  }catch(e){ return {ok:false, why:String(e&&e.message)}; }
}, { shed: SHED_LIST.find(s=>s.id==="shed1") });

if(!login.ok){ console.log("LOGIN FAILED", JSON.stringify(login)); await browser.close(); process.exit(1); }

// ניווט למסך + זמן רינדור
await page.evaluate((id)=>go(id,null), SCREEN);
await page.waitForTimeout(900);

// לכידת המסך המלא (כולל תוכן שגולל) — משחררים את מגבלת הגובה של ה-shell
await page.evaluate((id)=>{
  const app=document.getElementById("app"); if(app){ app.style.height="auto"; app.style.overflow="visible"; }
  document.documentElement.style.height="auto"; document.body.style.height="auto";
  const scr=document.getElementById(id); if(scr){ scr.style.minHeight="auto"; }
}, SCREEN);
await page.waitForTimeout(300);

const el = await page.$('#'+SCREEN);
const buf = await el.screenshot();
writeFileSync(OUT, buf);
const box = await el.boundingBox();
console.log("OK", login.who, OUT, JSON.stringify(box));
await browser.close();
