/* onceFlagDone() — ההלפר המשותף לבדיקת דגל "כבר בוצע" (מיגרציה/זריעה
   חד-פעמית), עמיד למרוץ טוקן/כשל רשת חולף. משמש כעת ב-20 מקומות שונים
   באפליקציה (migrateLegacyShed2 ועוד 19). בודק את ההלפר עצמו במפורש,
   ובנוסף כמה מהפונקציות שרותמות אותו (מדגם מייצג, לא כולן). */
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

// 1. הדגל באמת קיים (true) -> done:true, failed:false
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.sGetRaw = async () => true;
    return await onceFlagDone("some_flag");
  });
  record("דגל קיים (true) -> {done:true, failed:false}", out.done===true && out.failed===false, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. הדגל באמת לא קיים (null, בלי כשל) -> done:false, failed:false, בלי ניסיון חוזר מיותר
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    let calls = 0;
    window.sGetRaw = async () => { calls++; fbReadFailed = false; return null; };
    const r = await onceFlagDone("some_flag");
    return { ...r, calls };
  });
  record("דגל לא קיים באמת (null, בלי כשל) -> {done:false, failed:false}, קריאה אחת בלבד",
    out.done===false && out.failed===false && out.calls===1, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. כשל חולף (2 נכשלים, 3-י מצליח) -> מתגבר, done נכון, בלי failed
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    let calls = 0;
    window.sGetRaw = async () => {
      calls++;
      if(calls<3){ fbReadFailed = true; return null; }
      fbReadFailed = false; return true;
    };
    const r = await onceFlagDone("some_flag");
    return { ...r, calls };
  });
  record("כשל חולף (2 נסיונות) -> הניסיון השלישי מצליח, done:true, failed:false, 3 קריאות",
    out.done===true && out.failed===false && out.calls===3, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. כשל מתמשך (3 נסיונות נכשלים) -> failed:true, done:false
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    let calls = 0;
    window.sGetRaw = async () => { calls++; fbReadFailed = true; return null; };
    const r = await onceFlagDone("some_flag");
    return { ...r, calls };
  });
  record("כשל מתמשך -> failed:true, done:false, בדיוק 3 נסיונות (לא רץ לנצח)",
    out.failed===true && out.done===false && out.calls===3, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. מדגם: migrateNameFixes/ensureDeptOfficers/seedShed2Certs לא כותבים כלום בכשל מתמשך
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.sGetRaw = async () => { fbReadFailed = true; return null; };
    let wrote = false;
    window.sSetRaw = async () => { wrote = true; return true; };
    window.sGetIn = async () => [];
    window.sSetIn = async () => { wrote = true; return true; };
    PERSONNEL = [{name:"בדיקה", role:"חייל"}];
    await migrateNameFixes();
    const wroteAfterNameFixes = wrote;
    await ensureDeptOfficers();
    const wroteAfterDeptOfficers = wrote;
    await seedShed2Certs();
    const wroteAfterSeedShed2 = wrote;
    return { wroteAfterNameFixes, wroteAfterDeptOfficers, wroteAfterSeedShed2 };
  });
  record("מדגם: 3 פונקציות שונות שנעטפו ב-onceFlagDone לא כותבות כלום כשהבדיקה נכשלת באופן מתמשך",
    !out.wroteAfterNameFixes && !out.wroteAfterDeptOfficers && !out.wroteAfterSeedShed2, JSON.stringify(out));
  console.log("errs5",errs); await p.close();
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
