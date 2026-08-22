/* שער-העל של ensureAllShedsSeed: מאיץ גם את הכניסה הראשונה במכשיר —
   כשהשער סגור (seeds_done_<ver>_<shed>), הבלוק החד-פעמי (~15 קריאות
   טוריות) מדולג אחרי קריאת דגל אחת בלבד, אך ריפוי-עצמי
   (selfHealShedCertsAndRoster) רץ *תמיד* (לא חד-פעמי). בודק:
   (1) שער פתוח → הבלוק רץ פעם אחת והשער נסגר;
   (2) שער סגור → הבלוק לא רץ, אבל הריפוי-עצמי כן;
   (3) כשל רשת חולף בבלוק → השער לא נסגר (ננסה שוב בכניסה הבאה). */
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

/* תשתית משותפת: מדמה sGetRaw/sSetRaw/sGetIn/sSetIn בזיכרון, סופר קריאות
   דגלים, ומרסק את שרשרת הזריעה ל-stubs (חוץ מהשער והריפוי-העצמי האמיתיים)
   כדי לבודד את לוגיקת השער. */
const SETUP = (opts)=>`
  (async()=>{
    const o = ${JSON.stringify(opts||{})};
    const store = {};
    try{ for(const k in localStorage){} localStorage.clear(); }catch(e){}
    let flagReads = 0;
    window.sGetRaw = async (k)=>{
      if(/_v[0-9]|_seeded_|_done_|seed|migrat|backfill|cleanup|fix|synced|licenses|drivers|holders|officers|reassigned/i.test(k)){ flagReads++; }
      if(o.failFlags){ fbReadFailed = true; return null; }
      fbReadFailed = false; return store[k] ?? null;
    };
    window.sSetRaw = async (k,v)=>{ store[k]=v; return true; };
    window.sGetIn = async (s,k)=>store[s+"_"+k] ?? null;
    window.sSetIn = async (s,k,v)=>{ store[s+"_"+k]=v; return true; };
    // עוקבים אחרי ריצת הבלוק החד-פעמי ואחרי ריפוי-עצמי
    let ranOneTime = false, ranSelfHeal = 0;
    const realOneTime = runShedOneTimeSeeds;
    runShedOneTimeSeeds = async (s)=>{ ranOneTime = true; /* לא מריצים את הבלוק הכבד האמיתי */ };
    selfHealShedCertsAndRoster = async (s)=>{ ranSelfHeal++; };
    if(o.gateClosed){ store["seeds_done_"+SEED_MANIFEST_VER+"_shed1"] = true; }
    await ensureAllShedsSeed("shed1");
    return { ranOneTime, ranSelfHeal, flagReads,
             gateSet: store["seeds_done_"+SEED_MANIFEST_VER+"_shed1"]===true };
  })()
`;

// 1. שער פתוח (כניסה ראשונה אי-פעם): הבלוק רץ, הריפוי רץ, השער נסגר
{
  const {p, errs} = await page();
  const out = await p.evaluate(SETUP({}));
  record("שער פתוח: הבלוק החד-פעמי רץ, ריפוי-עצמי רץ, השער נסגר",
    out.ranOneTime===true && out.ranSelfHeal===1 && out.gateSet===true, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. שער סגור (כניסה חוזרת): הבלוק *לא* רץ, אבל ריפוי-עצמי כן, קריאת דגל אחת בלבד
{
  const {p, errs} = await page();
  const out = await p.evaluate(SETUP({gateClosed:true}));
  record("שער סגור: הבלוק מדולג, ריפוי-עצמי רץ, קריאת-דגל אחת בלבד",
    out.ranOneTime===false && out.ranSelfHeal===1 && out.flagReads===1, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. כשל רשת חולף בקריאת השער: הבלוק מנסה לרוץ אך השער לא נסגר (יינתן ניסיון חוזר)
{
  const {p, errs} = await page();
  const out = await p.evaluate(SETUP({failFlags:true}));
  record("כשל רשת חולף: השער לא נסגר (לא נועל בלוק שלא הושלם), ריפוי-עצמי עדיין רץ",
    out.gateSet!==true && out.ranSelfHeal===1, JSON.stringify(out));
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
