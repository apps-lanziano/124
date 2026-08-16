/* "להוריד לחלוטין לוח צוות שבועי/תורניות/כשירויות חיילים" — לפי הבהרה
   מפורשת של המשתמש, זה חל *רק* על יוזר אחראי הדרכה (מפקד מסגרת "הדרכה"),
   לא על מפקדי סככות רגילות ולא על מ״ע אחזקה. בודק גם שהנראות מתאפסת
   נכון כשמשתמש אחר נכנס אחר כך באותה טעינת-דף (toggle, לא add). */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const p = await b.newPage();
await p.route('**gstatic.com/**', r=>r.abort());
await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(250);

async function loginAsShedCommander(shedId, shedName, extra={}){
  return p.evaluate(async ({shedId, shedName, extra})=>{
    const store = {};
    window.storage = {
      async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
      async set(k,v){ store[k]=v; return true; },
      async delete(k){ delete store[k]; },
    };
    fbReady = false;
    const put = (k,v)=>{ store[k] = JSON.stringify(v); };
    put(`${shedId}_cfg_personnel`, [{name:"מפקד "+shedName, role:"מפקד", bday:"1995-01-01"}]);
    put(`${shedId}_cfg_tasks`, []);
    window.initPush = async()=>{};
    const shed = {id:shedId, name:shedName, ...extra};
    await enterFrameworkAfterAuth(shed, "מפקד", "TEST");
    const person = PERSONNEL.find(p=>p.role==="מפקד");
    Object.assign(person, await buildPinFields("1234"));
    document.getElementById("login-select").value = person.name;
    onLoginNameChange();
    document.getElementById("login-pin").value = "1234";
    await doLogin();
    const hidden = id => document.getElementById(id).classList.contains("hidden");
    // "כשירות חיילים" חיה בשתי נקודות כניסה לפי התפקיד: לשונית בסרגל
    // אצל מפקד סככה, ופריט בתפריט "עוד" אצל השאר. הבדיקה כאן היא על
    // *נגישות* — מוסתר = שתי נקודות הכניסה סגורות.
    return {
      boardHidden: hidden("nav-board"),
      dutiesHidden: hidden("sheet-duties"),
      medchecksHidden: hidden("sheet-medchecks") && hidden("nav-medchecks"),
    };
  }, {shedId, shedName, extra});
}

// 1. אחראי הדרכה (מפקד "הדרכה"): שלושתם מוסתרים
{
  const out = await loginAsShedCommander("training", "הדרכה", {isTraining:true});
  record("אחראי הדרכה: לוח שבועי/תורניות/כשירויות חיילים מוסתרים",
    out.boardHidden && out.dutiesHidden && out.medchecksHidden, JSON.stringify(out));
}

// 2. מפקד סככה רגילה, מיד אחרי אחראי הדרכה באותה טעינת-דף: הנראות חוזרת (לא נשארת חבויה)
{
  const out = await loginAsShedCommander("shed2", "סככה 2");
  record("מפקד סככה רגילה אחרי אחראי הדרכה: הנראות מתאפסת (toggle, לא add)",
    !out.boardHidden && !out.dutiesHidden && !out.medchecksHidden, JSON.stringify(out));
}

// 3. מ״ע אחזקה: לא מושפע — נשארים גלויים (הבקשה הייתה רק על אחראי הדרכה)
{
  const out = await loginAsShedCommander("maint", "מ״ע אחזקה", {isMaint:true});
  record("מ״ע אחזקה: לוח שבועי/תורניות/כשירויות חיילים נשארים גלויים (לא הושפע)",
    !out.boardHidden && !out.dutiesHidden && !out.medchecksHidden, JSON.stringify(out));
}

// 4. שוב אחראי הדרכה, אחרי מ״ע אחזקה: שוב מוסתרים
{
  const out = await loginAsShedCommander("training", "הדרכה", {isTraining:true});
  record("אחראי הדרכה שוב (אחרי מ״ע אחזקה): שוב מוסתרים כראוי",
    out.boardHidden && out.dutiesHidden && out.medchecksHidden, JSON.stringify(out));
}

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
