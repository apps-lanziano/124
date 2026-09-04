/* סיסמת-על (מנהל-על) הייתה נבדקת רק במסלול הכניסה המלא (verifyLoginPin),
   אבל מסך "כניסה מהירה" (PIN בלבד, במכשיר זכור) בודק ישירות מול ה-PIN
   האישי של האדם בלי לדעת על הסיסמה הגלובלית — כך שהזנת סיסמת-העל שם
   נדחתה כ"PIN שגוי". תוקן: quickLogin בודק גם verifyMasterPin, בדיוק
   כמו verifyLoginPin. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

async function freshPage(){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  // Mock callVerifyPin — simulate server-side PIN+master verification locally for tests
  await p.evaluate(()=>{
    window.callVerifyPin = async (shedId, name, pin)=>{
      // Master PIN check
      const raw = typeof storage!=="undefined" && storage && await storage.get("admin_master_pin");
      const masterRec = raw && raw.value ? (typeof raw.value==="string" ? JSON.parse(raw.value) : raw.value) : null;
      if(masterRec && masterRec.pinHash && masterRec.pinSalt){
        const mh = await hashPin(pin, masterRec.pinSalt, masterRec.pinIter||210000);
        if(mh === masterRec.pinHash) return {ok:true, master:true};
      }
      if(name === "__master__") return {ok:false};
      // Personal PIN
      const persRaw = typeof storage!=="undefined" && storage && await storage.get(shedId+"_cfg_personnel");
      const persList = persRaw && persRaw.value ? (typeof persRaw.value==="string" ? JSON.parse(persRaw.value) : persRaw.value) : [];
      const person = persList.find(x=>x.name===name);
      if(!person) return {ok:false};
      if(!person.pinHash) return {ok:true, noPin:true};
      let match = false;
      if(person.pinAlgo === "pbkdf2") match = (await hashPin(pin, person.pinSalt, person.pinIter)) === person.pinHash;
      else match = (await hashPinLegacy(pin, person.pinSalt)) === person.pinHash;
      return match ? {ok:true, legacy: person.pinAlgo !== "pbkdf2"} : {ok:false};
    };
  });
  return {p, errs};
}
function installMockStorage(store){
  return {
    async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
    async set(k,v){ store[k]=v; return true; },
    async delete(k){ delete store[k]; },
  };
}

// 1. quickLogin מקבל את סיסמת-העל, גם כשהיא שונה מה-PIN האישי של האדם
{
  const {p, errs} = await freshPage();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.storage = {
      async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
      async set(k,v){ store[k]=v; return true; },
      async delete(k){ delete store[k]; },
    };
    fbReady = false;
    const put = (k,v)=>{ store[k] = JSON.stringify(v); };

    const personPin = await buildPinFields("1234");
    put("shed2_cfg_personnel", [{name:"דני", role:"חייל", bday:"2000-01-01", ...personPin}]);
    const masterPin = await buildPinFields("9081");
    put("admin_master_pin", {pinHash:masterPin.pinHash, pinSalt:masterPin.pinSalt, pinAlgo:masterPin.pinAlgo, pinIter:masterPin.pinIter});

    fbAuth = { _am: { signInWithEmailAndPassword: async ()=>{} } };
    window.initPush = async()=>{};

    quickSelected = {shedId:"shed2", role:"חייל", name:"דני", code:"7788"};
    document.getElementById("quick-pin").value = "9081";   // סיסמת-העל — לא ה-PIN האישי (1234)
    await quickLogin();

    return { loggedIn: document.getElementById("login-overlay").style.display === "none", user };
  });
  record("כניסה מהירה מצליחה עם סיסמת-על, גם שאינה ה-PIN האישי של האדם",
    out.loggedIn===true && out.user==="דני", JSON.stringify(out));
  console.log("errs1", errs);
  await p.close();
}

// 2. קוד שגוי (לא ה-PIN האישי ולא סיסמת-העל) עדיין נדחה כרגיל
{
  const {p, errs} = await freshPage();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.storage = {
      async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
      async set(k,v){ store[k]=v; return true; },
      async delete(k){ delete store[k]; },
    };
    fbReady = false;
    const put = (k,v)=>{ store[k] = JSON.stringify(v); };

    const personPin = await buildPinFields("1234");
    put("shed2_cfg_personnel", [{name:"דני", role:"חייל", bday:"2000-01-01", ...personPin}]);
    const masterPin = await buildPinFields("9081");
    put("admin_master_pin", {pinHash:masterPin.pinHash, pinSalt:masterPin.pinSalt, pinAlgo:masterPin.pinAlgo, pinIter:masterPin.pinIter});

    fbAuth = { _am: { signInWithEmailAndPassword: async ()=>{} } };
    window.initPush = async()=>{};

    quickSelected = {shedId:"shed2", role:"חייל", name:"דני", code:"7788"};
    document.getElementById("quick-pin").value = "0000";
    await quickLogin();

    return { loggedIn: document.getElementById("login-overlay").style.display === "none" };
  });
  record("קוד שאינו ה-PIN האישי ואינו סיסמת-העל — נדחה כרגיל",
    out.loggedIn===false, JSON.stringify(out));
  console.log("errs2", errs);
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
