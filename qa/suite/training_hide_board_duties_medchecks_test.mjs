/* "כשירויות חיילים" מוסתר לאחראי הדרכה (מפקד מסגרת "הדרכה") — לא למפקדי
   סככות ולא למ״ע אחזקה. תורנויות (nav-board) + סעיף התורנויות ב"עוד"
   הוחזרו למ״ע הדרכה לבקשת המשתמש (7.2) — לכן הם גלויים לו כמו בסככה.
   בודק גם שהנראות מתאפסת נכון כשמשתמש אחר נכנס אחר כך (toggle, לא add). */
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
    // "כשירות חיילים" חיה בכמה נקודות כניסה לפי התפקיד: לשונית בסרגל
    // (nav-medchecks, ישן), פריט בתפריט "עוד" (sheet-medchecks) אצל
    // מי שלא קיבל את המסך המאוחד "אנשים", או דרך "אנשים" (nav-people)
    // אצל מפקד סככה רגילה — ר' consolidation ל-scr-people. הבדיקה כאן
    // היא על *נגישות* — מוסתר = כל נקודות הכניסה סגורות.
    return {
      boardHidden: hidden("nav-board"),
      dutiesHidden: hidden("nav-board"),   // התורנות הבסיסית אוחדה לתוך מסך התורנויות (nav-board); אין יותר פריט 'תורנויות' נפרד ב'עוד'
      medchecksHidden: hidden("sheet-medchecks") && hidden("nav-medchecks") && hidden("nav-people"),
    };
  }, {shedId, shedName, extra});
}

// 1. מ״ע הדרכה: תורנויות (לוח) גלויות (7.2), כשירויות חיילים מוסתר
{
  const out = await loginAsShedCommander("training", "הדרכה", {isTraining:true});
  record("מ״ע הדרכה: תורנויות גלויות (7.2), כשירות חיילים מוסתר",
    !out.boardHidden && !out.dutiesHidden && out.medchecksHidden, JSON.stringify(out));
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

// 4. שוב מ״ע הדרכה, אחרי מ״ע אחזקה: תורנויות גלויות, כשירות חיילים מוסתר
{
  const out = await loginAsShedCommander("training", "הדרכה", {isTraining:true});
  record("מ״ע הדרכה שוב (אחרי מ״ע אחזקה): תורנויות גלויות, כשירות חיילים מוסתר",
    !out.boardHidden && !out.dutiesHidden && out.medchecksHidden, JSON.stringify(out));
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
