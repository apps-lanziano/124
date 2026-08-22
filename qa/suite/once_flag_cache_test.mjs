/* רגרסיה ל"נתקע על טוען זמן רב אחרי הקוד/PIN": כל כניסה הריצה ~15-20
   קריאות רשת *טוריות* דרך onceFlagDone רק כדי לוודא דגלי מיגרציה/זריעה
   חד-פעמיים שכבר בוצעו מזמן (כל אחת round-trip עם timeout 9ש'). דגל כזה
   בלתי-הפיך (נכתב פעם אחת ל-true ולעולם לא חוזר), ולכן onceFlagDone מטמן
   מקומית (localStorage) את מצב "בוצע" ומדלג על הרשת בכניסות הבאות.
   בודק: (1) קריאה שנייה לדגל שבוצע לא נוגעת ברשת; (2) דגל שטרם בוצע לא
   מטומן — ממשיך לקרוא מהרשת; (3) כשל קריאה לא מטומן. */
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

// 1. דגל שבוצע: קריאה ראשונה נוגעת ברשת ומטמנת; שנייה מדלגת על הרשת לגמרי
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const KEY = "qa_cache_flag_done_v1";
    try{ localStorage.removeItem("once_"+KEY); }catch(e){}
    let reads = 0;
    window.sGetRaw = async (k)=>{ fbReadFailed = false; if(k===KEY){ reads++; return true; } return null; };
    const first = await onceFlagDone(KEY);
    const readsAfterFirst = reads;
    const second = await onceFlagDone(KEY);
    const readsAfterSecond = reads;
    return { first, second, readsAfterFirst, readsAfterSecond,
             cached: (()=>{ try{ return localStorage.getItem("once_"+KEY); }catch(e){ return null; } })() };
  });
  record("דגל שבוצע: קריאה שנייה לא נוגעת ברשת (מטמון localStorage)",
    out.first.done===true && out.second.done===true &&
    out.readsAfterFirst===1 && out.readsAfterSecond===1 && out.cached==="1",
    JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. דגל שטרם בוצע: לא מטומן — כל קריאה ממשיכה לפנות לרשת (כדי שמיגרציה שממתינה תרוץ)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const KEY = "qa_cache_flag_pending_v1";
    try{ localStorage.removeItem("once_"+KEY); }catch(e){}
    let reads = 0;
    window.sGetRaw = async (k)=>{ fbReadFailed = false; if(k===KEY){ reads++; return null; } return null; };
    const first = await onceFlagDone(KEY);
    const second = await onceFlagDone(KEY);
    return { first, second, reads,
             cached: (()=>{ try{ return localStorage.getItem("once_"+KEY); }catch(e){ return null; } })() };
  });
  record("דגל שטרם בוצע: לא מטומן, כל קריאה פונה לרשת",
    out.first.done===false && out.second.done===false && out.reads===2 && out.cached===null,
    JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. כשל קריאה מתמשך: מוחזר failed, לא מטומן (ננסה שוב בכניסה הבאה)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const KEY = "qa_cache_flag_fail_v1";
    try{ localStorage.removeItem("once_"+KEY); }catch(e){}
    window.sGetRaw = async (k)=>{ if(k===KEY){ fbReadFailed = true; return null; } fbReadFailed=false; return null; };
    const res = await onceFlagDone(KEY);
    return { res, cached: (()=>{ try{ return localStorage.getItem("once_"+KEY); }catch(e){ return null; } })() };
  });
  record("כשל קריאה: failed=true, לא מטומן",
    out.res.failed===true && out.res.done===false && out.cached===null, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
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
