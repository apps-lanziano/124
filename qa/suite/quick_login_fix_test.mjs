/* "כניסה מהירה" (PIN בלבד, במכשיר זכור) הייתה מתחברת לחשבון Firebase Auth
   בפורמט ישן ("shed3.cmd@sq124.app") שמעולם לא נוצר בפועל — כל חשבון אמיתי
   נוצר בפורמט u<קוד>@ (authEmailFromCode), מאז שהכניסה עברה ל-CODE_LOGIN="server".
   התוצאה: signInAs נכשל תמיד, וכניסה מהירה נפלה בשקט חזרה ל"הזן קוד מסגרת".
   הבדיקה: quickLogin משתמש עכשיו ב-authEmailFromCode(dev.code), ומצליחה בפועל. */
import { launchBrowser, APP_URL, ROOT } from '../lib/pw.mjs';
import { readFileSync } from 'fs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. הקוד המת (frameworkAuthEmail) הוסר לגמרי — כדי שלא ייקרא שוב בטעות
{
  const html = readFileSync(`${ROOT}/index.html`, 'utf8');
  const hasDeadFn = /function frameworkAuthEmail/.test(html);
  const quickLoginBody = html.slice(html.indexOf("async function quickLogin"), html.indexOf("async function quickLogin")+1500);
  const usesRealScheme = /signInAs\(authEmailFromCode\(dev\.code\)/.test(quickLoginBody);
  record("quickLogin משתמש בסכמת האימות האמיתית (authEmailFromCode), לא בפורמט הישן",
    !hasDeadFn && usesRealScheme, JSON.stringify({hasDeadFn, usesRealScheme}));
}

// 2. הרצה מלאה: כניסה מהירה מצליחה בפועל ומתחברת עם החשבון הנכון
{
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);

  const out = await p.evaluate(async ()=>{
    const store = {};
    window.storage = {
      async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
      async set(k,v){ store[k]=v; return true; },
      async delete(k){ delete store[k]; },
    };
    fbReady = false;
    window.callVerifyPin = async function(shedId, name, pin){
      const people = (typeof PERSONNEL !== "undefined" && PERSONNEL) || [];
      const person = people.find(p => p.name === name);
      if(!person || !person.pinHash) return {ok:true};
      const h = await hashPin(pin, person.pinSalt, person.pinIter || PIN_ITERATIONS);
      return {ok: h === person.pinHash};
    };
    const put = (k,v)=>{ store[k] = JSON.stringify(v); };

    const pinFields = await buildPinFields("1234");
    put("shed2_cfg_personnel", [{name:"דני", role:"חייל", bday:"2000-01-01", ...pinFields}]);
    put("shed2_cfg_tasks", []);

    const calls = [];
    fbAuth = { _am: { signInWithEmailAndPassword: async (auth, email, password)=>{ calls.push({email, password}); } } };
    window.initPush = async()=>{};

    quickSelected = {shedId:"shed2", role:"חייל", name:"דני", code:"7788"};
    document.getElementById("quick-pin").value = "1234";
    await quickLogin();

    return {
      calls,
      loggedIn: document.getElementById("login-overlay").style.display === "none",
      currentUser: typeof user !== "undefined" ? user : null,
    };
  });

  record("כניסה מהירה מתחברת עם u<קוד>@ (החשבון שבאמת נוצר) ולא shed.role@",
    out.calls.length===1 && out.calls[0].email === "u7788@sq124.app" && out.calls[0].password === "sq124:7788",
    JSON.stringify(out.calls));
  record("כניסה מהירה מסתיימת בהצלחה בפועל (לא נופלת חזרה למסך קוד)",
    out.loggedIn === true, JSON.stringify(out));

  console.log("errs", errs);
  await p.close();
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
