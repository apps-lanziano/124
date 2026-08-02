/* דיווח: "קרא וחתום - X חתם ועכשיו נעלמה לו החתימה". חשד: sigs_<name> נשמר
   כאובייקט אחד עם כל החתימות של האדם (keyed by docId), ו-saveSignature/
   confirmRead עשו קריאה-ואז-כתיבה "רגילה" (בלי הגנה) — בדיוק כמו PERSONNEL
   לפני mutatePersonnel. חתימה על שני פריטים ברצף מהיר (למשל לפני שהכתיבה
   הראשונה הספיקה להסתיים בגלל רשת איטית) הייתה חושפת מירוץ: הכתיבה
   השנייה, שנקראה עם עותק ישן יותר, יכולה לדרוס/למחוק את הפריט שנחתם קודם.
   mutateSigs מוסיף נעילה בזיכרון לכל שם, כדי שכתיבות לאותו אדם יתבצעו
   בטור, כל אחת עם קריאה טרייה אחרי שהקודמת הסתיימה בפועל. */
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

// 1. שתי חתימות "חופפות" לאותו אדם, על שני פריטים שונים — עם רשת מלאכותית
//    איטית שגורמת לקריאה השנייה להתחיל לפני שהכתיבה הראשונה הסתיימה.
//    בלי הנעילה זה היה מוחק את החתימה הראשונה; איתה שתיהן שורדות.
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    const readDelays = {}; // מס' פעמים שנקרא -> כמה מ"ש לחכות
    window.sGet = async (k) => {
      const d = readDelays[k] || 0;
      if(d) await new Promise(r=>setTimeout(r, d));
      return store[k] !== undefined ? JSON.parse(JSON.stringify(store[k])) : null;
    };
    window.sSet = async (k,v) => { store[k]=v; return true; };
    fbReadFailed = false;

    const key = "sigs_test_person";
    // הקריאה הראשונה (עבור מסמך A) תעכב את עצמה ב-80ms אחרי שהיא כבר קראה
    // (מדמה רשת איטית) — הקריאה השנייה (מסמך B) מתחילה כמעט מיד אחריה.
    readDelays[key] = 80;

    const p1 = mutateSigs("test_person", reads=>{ reads["docA"] = {sig:"A"}; });
    await new Promise(r=>setTimeout(r,10));   // מדמה "כמעט חופף" — לא ממתין לסיום p1
    const p2 = mutateSigs("test_person", reads=>{ reads["docB"] = {sig:"B"}; });
    const [ok1, ok2] = await Promise.all([p1, p2]);

    return { ok1, ok2, final: store[key] };
  });
  record("שתי חתימות חופפות לאותו אדם — שתיהן מצליחות ונשמרות (הנעילה סידרה אותן בטור)",
    out.ok1===true && out.ok2===true && out.final && out.final.docA && out.final.docB,
    JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. כשל קריאה (fbReadFailed) -> mutateSigs לא כותב כלום, מחזיר false
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.sGet = async () => { fbReadFailed = true; return null; };
    let wrote = false;
    window.sSet = async () => { wrote = true; return true; };
    const ok = await mutateSigs("test_person2", reads=>{ reads["docX"] = {sig:"X"}; });
    return { ok, wrote };
  });
  record("כשל קריאה: mutateSigs מחזיר false ולא כותב כלום",
    out.ok===false && out.wrote===false, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. שני אנשים שונים לא חוסמים זה את זה (הנעילה היא per-key, לא גלובלית)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    const order = [];
    window.sGet = async (k) => {
      order.push("read:"+k);
      if(k==="sigs_person_a") await new Promise(r=>setTimeout(r,60));
      return store[k] ?? null;
    };
    window.sSet = async (k,v) => { order.push("write:"+k); store[k]=v; return true; };
    fbReadFailed = false;

    const start = Date.now();
    await Promise.all([
      mutateSigs("person_a", reads=>{ reads["d1"]={sig:"1"}; }),
      mutateSigs("person_b", reads=>{ reads["d2"]={sig:"2"}; }),
    ]);
    const elapsed = Date.now()-start;
    return { elapsed, storeA: store["sigs_person_a"], storeB: store["sigs_person_b"] };
  });
  record("מפתחות שונים (אנשים שונים) לא נחסמים זה על ידי זה — שניהם נכתבו נכון",
    out.storeA && out.storeA.d1 && out.storeB && out.storeB.d2, JSON.stringify(out));
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
