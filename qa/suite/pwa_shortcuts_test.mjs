/* קיצורי דרך ממסך הבית (PWA shortcuts) — לחיצה ארוכה על סמל האפליקציה
   מציעה קפיצה ישירה ל"סימון נוכחות" או "דיווח תקלה", בלי לעבור דרך
   הניווט הרגיל. בודק גם את manifest.json וגם את ההתנהגות בפועל. */
import { readFileSync } from 'fs';
import { launchBrowser, APP_URL, ROOT } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. manifest.json מוגדר נכון
{
  const manifest = JSON.parse(readFileSync(`${ROOT}/manifest.json`, 'utf8'));
  const sc = manifest.shortcuts;
  const ok = Array.isArray(sc) && sc.length===2
    && sc.some(s=>s.url==="./index.html?shortcut=rollcall")
    && sc.some(s=>s.url==="./index.html?shortcut=faults")
    && sc.every(s=>s.name && s.icons && s.icons.length);
  record("manifest.json מגדיר 2 קיצורי דרך תקינים (נכס + תקלה)", ok, JSON.stringify(sc));
}

async function loginWithShortcut(shortcut, role, personIndex=0){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const url = shortcut ? `${APP_URL}?shortcut=${shortcut}` : APP_URL;
  await p.goto(url, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);

  const out = await p.evaluate(async ({role, personIndex})=>{
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
    put("shed2_cfg_personnel", [
      {name:"מפקד סככה 2", role:"מפקד", bday:"1995-01-01"},
      {name:"חייל סככה 2", role:"חייל", bday:"2003-01-01"},
    ]);
    put("shed2_cfg_tasks", []);
    window.initPush = async()=>{};
    const shed = {id:"shed2", name:"סככה 2"};
    await enterFrameworkAfterAuth(shed, role, "TEST");
    const people = PERSONNEL.filter(p=>p.role===role);
    const person = people[personIndex];
    Object.assign(person, await buildPinFields("1234"));
    document.getElementById("login-select").value = person.name;
    onLoginNameChange();
    document.getElementById("login-pin").value = "1234";
    await doLogin();
    const activeScreen = document.querySelector("section.screen.active")?.id;
    return { activeScreen, searchAfter: location.search, loggedIn: document.getElementById("login-overlay").style.display==="none" };
  }, {role, personIndex});

  await p.close();
  return {out, errs};
}

// 2. קיצור "נכס" מוביל ישר למסך הנכס אחרי כניסה
{
  const {out, errs} = await loginWithShortcut("rollcall", "חייל");
  record("קיצור rollcall: הכניסה נוחתת ישר על scr-rollcall (לא על מסך ברירת המחדל)",
    out.loggedIn && out.activeScreen==="scr-rollcall", JSON.stringify(out));
  console.log("errs-rollcall", errs);
}

// 3. קיצור "תקלה" מוביל ישר למסך התקלות
{
  const {out, errs} = await loginWithShortcut("faults", "מפקד");
  record("קיצור faults: הכניסה נוחתת ישר על scr-faults",
    out.loggedIn && out.activeScreen==="scr-faults", JSON.stringify(out));
  console.log("errs-faults", errs);
}

// 4. בלי קיצור — ההתנהגות המקורית נשמרת (חייל -> בטיחות, מפקד -> קונסולה)
{
  const {out:soldierOut} = await loginWithShortcut(null, "חייל");
  const {out:cmdOut} = await loginWithShortcut(null, "מפקד");
  record("בלי קיצור: חייל נוחת על scr-today (\"היום שלי\") כמסך הפתיחה",
    soldierOut.activeScreen==="scr-today", JSON.stringify(soldierOut));
  record("בלי קיצור: מפקד נוחת על scr-cmd כרגיל (רגרסיה)",
    cmdOut.activeScreen==="scr-cmd", JSON.stringify(cmdOut));
}

// 5. פרמטר ה-shortcut מנוקה מה-URL בטעינה — רענון אחרי הכניסה לא יפעיל שוב
{
  const {out} = await loginWithShortcut("rollcall", "חייל");
  record("פרמטר ה-shortcut מנוקה מה-URL מיד בטעינה",
    out.searchAfter === "", JSON.stringify(out));
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
