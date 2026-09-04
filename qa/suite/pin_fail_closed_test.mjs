/* PIN Fail-Closed — כשה-Cloud Function לא זמינה, הכניסה נחסמת.
   אין fallback לאימות מקומי. מוודא שהתיקון של fail-open לא חוזר. */
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

// 1. callVerifyPin returns serverDown:true (not fallback:true) when CF unavailable
{
  const {p} = await page();
  const res = await p.evaluate(async ()=>{
    // AUTH_MODE is const="scoped", fbAuth is null by default → serverDown path
    const r = await callVerifyPin("shed1", "test", "123456");
    return r;
  });
  record("callVerifyPin returns serverDown when CF unavailable",
    res.serverDown === true && res.fallback === undefined,
    JSON.stringify(res));
}

// 2. verifyPin denies when CF returns serverDown
{
  const {p} = await page();
  const res = await p.evaluate(async ()=>{
    window._origCallVerifyPin = window.callVerifyPin;
    window.callVerifyPin = async ()=> ({ok:false, serverDown:true});
    currentShed = {id:"shed1"};
    const person = {name:"דני", pinHash:"abc", pinSalt:"s", pinAlgo:"pbkdf2"};
    const ok = await verifyPin(person, "123456");
    window.callVerifyPin = window._origCallVerifyPin;
    return ok;
  });
  record("verifyPin DENIES when server is down (fail-closed)", res === false, String(res));
}

// 3. verifyMasterPin denies when CF returns serverDown
{
  const {p} = await page();
  const res = await p.evaluate(async ()=>{
    window._origCallVerifyPin = window.callVerifyPin;
    window.callVerifyPin = async ()=> ({ok:false, serverDown:true});
    currentShed = {id:"shed1"};
    const ok = await verifyMasterPin("123456");
    window.callVerifyPin = window._origCallVerifyPin;
    return ok;
  });
  record("verifyMasterPin DENIES when server is down (fail-closed)", res === false, String(res));
}

// 4. localVerifyPin function does not exist anymore
{
  const {p} = await page();
  const exists = await p.evaluate(()=> typeof window.localVerifyPin === "function");
  record("localVerifyPin function removed", exists === false, String(exists));
}

// 5. localVerifyMasterPin function does not exist anymore
{
  const {p} = await page();
  const exists = await p.evaluate(()=> typeof window.localVerifyMasterPin === "function");
  record("localVerifyMasterPin function removed", exists === false, String(exists));
}

// 6. No "fallback:true" string in callVerifyPin source
{
  const {p} = await page();
  const hasFallback = await p.evaluate(()=>{
    const src = callVerifyPin.toString();
    return src.includes("fallback:true") || src.includes("fallback: true");
  });
  record("callVerifyPin source has no fallback:true", hasFallback === false, String(hasFallback));
}

// 7. verifyPin source has no localVerifyPin reference
{
  const {p} = await page();
  const hasLocal = await p.evaluate(()=>{
    const src = verifyPin.toString();
    return src.includes("localVerifyPin");
  });
  record("verifyPin source has no localVerifyPin reference", hasLocal === false, String(hasLocal));
}

await b.close();
const passed = results.filter(r=>r.pass).length;
const failed = results.filter(r=>!r.pass).length;
console.log(`\n${'='.repeat(50)}`);
for(const r of results) console.log(`${r.pass?'✅':'❌'} ${r.name}${r.detail?' — '+r.detail:''}`);
console.log(`\n${passed}/${results.length} passed${failed?' — '+failed+' FAILED':''}`);
process.exit(failed ? 1 : 0);
