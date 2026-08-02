/* אותה תבנית באג בדיוק כמו migrateLegacyShed2 (ראו migrate_legacy_shed2_resilience_test.mjs):
   ensureConvertedFrameworksSeed בדק את דגל "נהגים כבר הועברו" בקריאה בודדת
   בלי הגנה מפני כשל קריאה חולף. אמנם המיזוג שם אדיטיבי (בודק שם קיים לפני
   הוספה), אבל כשל חולף עדיין יכול "להחיות" נהג שהוסר בכוונה מהצוות, אם
   vo_personnel הישן עדיין מכיל אותו. בודק שכשל מתמשך לא מוסיף כלום. */
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

// 1. כשל מתמשך בבדיקת הדגל -> לא מחיה נהג שהוסר בכוונה מהצוות
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {
      "maint_cfg_personnel": [{name:"מפקד מ״ע אחזקה", role:"מפקד"}],   // הנהג הוסר בכוונה בעבר
      "vo_personnel": [{name:"נהג ותיק שהוסר", role:"חייל"}],           // עדיין ברשימה הישנה
    };
    window.sGetRaw = async (k) => {
      if(k==="maint_drivers_migrated_v1"){ fbReadFailed = true; return null; }
      fbReadFailed = false;
      return store[k] ?? null;
    };
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    await ensureConvertedFrameworksSeed("maint");
    return { team: store["maint_cfg_personnel"] };
  });
  record("כשל מתמשך בדגל: הנהג שהוסר בכוונה לא חוזר לצוות",
    out.team.length===1 && !out.team.some(p=>p.name==="נהג ותיק שהוסר"), JSON.stringify(out.team));
  console.log("errs1",errs); await p.close();
}

// 2. מיגרציה ראשונה אמיתית (הדגל באמת לא קיים) -> ההתנהגות המקורית נשמרת, הנהג מתווסף
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {
      "maint_cfg_personnel": [{name:"מפקד מ״ע אחזקה", role:"מפקד"}],
      "vo_personnel": [{name:"נהג חדש", role:"חייל"}],
    };
    window.sGetRaw = async (k) => { fbReadFailed = false; return store[k] ?? null; };
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    await ensureConvertedFrameworksSeed("maint");
    return { team: store["maint_cfg_personnel"], flag: store["maint_drivers_migrated_v1"] };
  });
  record("מיגרציה ראשונה אמיתית: הנהג מתווסף כרגיל, הדגל מסומן",
    out.team.some(p=>p.name==="נהג חדש") && out.flag===true, JSON.stringify(out));
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
