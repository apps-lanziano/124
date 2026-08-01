/* כניסה עם Face ID / טביעת אצבע (WebAuthn, "גרסה קלה") — ללא אימות חתימה
   מול שרת, בדיוק כמו ה-PIN הקיים: הצלחת navigator.credentials.get() היא
   ההוכחה, כי היא לא יכולה להסתיים בלי שהמכשיר פתח את המפתח בביומטריה. */
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
  return {p, errs};
}

// 1. זיהוי תמיכה — עם/בלי platform authenticator
{
  const {p, errs} = await freshPage();
  const out = await p.evaluate(async ()=>{
    const withSupport = await (async()=>{
      window.PublicKeyCredential = function(){};
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async()=>true;
      return await biometricAvailable();
    })();
    delete window.PublicKeyCredential;
    const withoutSupport = await biometricAvailable();
    return {withSupport, withoutSupport};
  });
  record("זיהוי תמיכה ביומטרית: true כשקיים platform authenticator, false כשלא",
    out.withSupport===true && out.withoutSupport===false, JSON.stringify(out));
  console.log("errs1", errs); await p.close();
}

// 2. קידוד/פענוח base64url של מזהה האישור — round-trip
{
  const {p, errs} = await freshPage();
  const out = await p.evaluate(()=>{
    const raw = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const enc = b64uEncode(raw);
    const dec = b64uDecode(enc);
    const same = new Uint8Array(raw).length === new Uint8Array(dec).length
      && [...new Uint8Array(raw)].every((b,i)=>b===new Uint8Array(dec)[i]);
    const urlSafe = !/[+/=]/.test(enc);
    return {same, urlSafe};
  });
  record("b64uEncode/b64uDecode: round-trip תקין וללא תווים לא-בטוחים ל-URL",
    out.same && out.urlSafe, JSON.stringify(out));
  console.log("errs2", errs); await p.close();
}

// 3. רישום מפתח ביומטרי — נשמר על רשומת המכשיר הנכונה
{
  const {p, errs} = await freshPage();
  const out = await p.evaluate(async ()=>{
    localStorage.setItem("sq124_devices", JSON.stringify([{shedId:"shed2", role:"חייל", name:"דני", code:"7788"}]));
    const rawId = crypto.getRandomValues(new Uint8Array(16)).buffer;
    Object.defineProperty(navigator, 'credentials', { value: {
      create: async()=>({ rawId }),
      get: async()=>{ throw new Error("not used here"); },
    }, configurable:true });
    const ok = await enrollBiometric({shedId:"shed2", name:"דני"});
    const saved = getDeviceUsers().find(u=>u.name==="דני");
    return { ok, faceId: saved && saved.faceId, expected: b64uEncode(rawId) };
  });
  record("enrollBiometric: מצליח ושומר את מזהה האישור על רשומת המכשיר",
    out.ok===true && out.faceId === out.expected, JSON.stringify(out));
  console.log("errs3", errs); await p.close();
}

// 4. כניסה מהירה עם Face ID — מסלול מלא, בלי הקלדת PIN
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
    const pinFields = await buildPinFields("1234");
    put("shed2_cfg_personnel", [{name:"דני", role:"חייל", bday:"2000-01-01", ...pinFields}]);
    put("shed2_cfg_tasks", []);

    const signInCalls = [];
    fbAuth = { _am: { signInWithEmailAndPassword: async (auth, email, password)=>{ signInCalls.push({email, password}); } } };
    window.initPush = async()=>{};

    const rawId = crypto.getRandomValues(new Uint8Array(16)).buffer;
    quickSelected = {shedId:"shed2", role:"חייל", name:"דני", code:"7788", faceId:b64uEncode(rawId)};
    Object.defineProperty(navigator, 'credentials', { value: {
      create: async()=>({ rawId }),
      get: async()=>({ id:"x" }),   // הצלחה = "המכשיר פתח בביומטריה"
    }, configurable:true });

    document.getElementById("quick-pin").value = "";  // מכוון: לא מקלידים PIN בכלל
    await quickLoginBiometric();

    return {
      signInCalls,
      loggedIn: document.getElementById("login-overlay").style.display === "none",
      currentUser: typeof user !== "undefined" ? user : null,
      flagConsumed: biometricUnlockOK === false,
    };
  });

  record("כניסה עם Face ID מתחברת לחשבון הנכון בלי הקלדת PIN",
    out.signInCalls.length===1 && out.signInCalls[0].email==="u7788@sq124.app",
    JSON.stringify(out.signInCalls));
  record("כניסה עם Face ID מסתיימת בכניסה מלאה בפועל",
    out.loggedIn===true && out.currentUser==="דני", JSON.stringify(out));
  record("דגל המעקף מתאפס מיד אחרי שימוש — לא דולף לכניסה הבאה",
    out.flagConsumed===true, JSON.stringify(out));

  console.log("errs4", errs); await p.close();
}

// 5. Face ID נדחה/נכשל — נופל בחזרה, לא נכנס בלי PIN
{
  const {p, errs} = await freshPage();
  const out = await p.evaluate(async ()=>{
    quickSelected = {shedId:"shed2", role:"חייל", name:"דני", code:"7788", faceId:"abc"};
    Object.defineProperty(navigator, 'credentials', { value: {
      get: async()=>{ throw new Error("NotAllowedError"); },   // המשתמש ביטל/נכשל
    }, configurable:true });
    await quickLoginBiometric();
    return { loggedIn: document.getElementById("login-overlay").style.display === "none" };
  });
  record("ביטול/כשל ב-Face ID לא מכניס לאפליקציה בלי PIN",
    out.loggedIn===false, JSON.stringify(out));
  console.log("errs5", errs); await p.close();
}

// 6. הבאג שדווח: addDeviceUser לא ימחק faceId/faceIdDeclined בכניסה הבאה.
//    זה בדיוק מה שקרה בפועל — doLogin קורא ל-addDeviceUser בכל כניסה מוצלחת
//    (לא רק בפעם הראשונה), וההחלפה המלאה מחקה את הרישום ביומטרי כל פעם.
{
  const {p, errs} = await freshPage();
  const out = await p.evaluate(async ()=>{
    localStorage.setItem("sq124_devices", JSON.stringify([
      {shedId:"shed2", role:"חייל", name:"דני", code:"7788", faceId:"already-enrolled"},
      {shedId:"shed3", role:"חייל", name:"רון", code:"9999", faceIdDeclined:true},
    ]));
    // מדמה בדיוק את מה ש-doLogin עושה בסוף כל כניסה מוצלחת
    addDeviceUser({shedId:"shed2", role:"חייל", code:"7788", name:"דני"});
    addDeviceUser({shedId:"shed3", role:"חייל", code:"9999", name:"רון"});
    const users = getDeviceUsers();
    return {
      daniFaceId: users.find(u=>u.name==="דני")?.faceId,
      ronDeclined: users.find(u=>u.name==="רון")?.faceIdDeclined,
    };
  });
  record("כניסה חוזרת לא מוחקת רישום Face ID קיים",
    out.daniFaceId === "already-enrolled", JSON.stringify(out));
  record("כניסה חוזרת לא מוחקת סימון 'נדחה' — לא חוזר לשאול שוב",
    out.ronDeclined === true, JSON.stringify(out));
  console.log("errs6", errs); await p.close();
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
