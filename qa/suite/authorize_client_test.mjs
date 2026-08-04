/* Custom Claims (שלב הכנה, לפני שינוי כללי ה-Firestore): בודק שהלקוח
   קורא ל-markSessionAuthorized בדיוק במקום הנכון בתוך checkCode —
   אחרי signInAs מוצלח, לפני קריאת מסמך הפרופיל (שיידרש לתגית ברגע
   שהכללים ישודרגו). לא נוגע ב-Cloud Function האמיתית או ב-Firestore —
   רק מוודא את סדר הקריאות בצד הלקוח. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

async function page(){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  return {p, errs};
}

// 1. כניסה מוצלחת: markSessionAuthorized נקרא אחרי signInAs ולפני קריאת הפרופיל
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const calls = [];
    fbAuth = {_am:{}}; // כדי ש-checkCode לא ייתקע ב"החיבור עדיין נטען"
    window.signInAs = async () => { calls.push("signInAs"); return true; };
    window.markSessionAuthorized = async () => { calls.push("markSessionAuthorized"); };
    window.sGetRaw = async () => { calls.push("sGetRaw(profile)"); return {kind:"owner"}; };
    window.routeByAuthProfile = async () => { calls.push("routeByAuthProfile"); };
    window.registerLoginFail = () => { calls.push("registerLoginFail"); };
    document.getElementById("login-code").value = "1234";
    await checkCode();
    return { calls };
  });
  record("סדר הקריאות: signInAs -> markSessionAuthorized -> קריאת פרופיל -> ניתוב",
    JSON.stringify(out.calls) === JSON.stringify(["signInAs","markSessionAuthorized","sGetRaw(profile)","routeByAuthProfile"]),
    JSON.stringify(out.calls));
  console.log("errs1",errs); await p.close();
}

// 2. כניסה כושלת (קוד שגוי): markSessionAuthorized לא נקרא בכלל
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const calls = [];
    fbAuth = {_am:{}};
    window.signInAs = async () => { calls.push("signInAs"); return false; };
    window.markSessionAuthorized = async () => { calls.push("markSessionAuthorized"); };
    window.registerLoginFail = () => { calls.push("registerLoginFail"); };
    document.getElementById("login-code").value = "0000";
    await checkCode();
    return { calls };
  });
  record("קוד שגוי: markSessionAuthorized לא נקרא (אין למה להצמיד תגית)",
    !out.calls.includes("markSessionAuthorized") && out.calls.includes("registerLoginFail"),
    JSON.stringify(out.calls));
  console.log("errs2",errs); await p.close();
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
