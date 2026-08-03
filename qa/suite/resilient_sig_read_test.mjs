/* באג: "דניאל זאורוב ביצע חתימה ושוב מופיע שלא ביצע". אחרי שנשלל תיקון שם
   כסיבה, האבחון השני: sGetRaw לא מנסה שוב אחרי כשל רשת חד-פעמי — קריאה
   שנכשלת פעם אחת מתוך פיזור מקבילי גדול (Promise.all על כל אנשי הצוות,
   כמו במסך "מי חתם") מציגה את האדם הספציפי הזה כ"לא חתם", אף שבפועל הוא
   כן חתם וזו רק תקלת רשת רגעית. sGetSigs/sGetSigsIn מנסות שוב עד 3 פעמים
   לפני שהן בכל זאת נכנעות, בדיוק כמו onceFlagDone לדגלי מיגרציה. */
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

// 1. כשל רשת חולף בקריאה הראשונה, הצלחה בשנייה -> מחזיר את הנתון האמיתי,
//    לא "{}" (שהיה נראה כמו "לא חתם")
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    let calls = 0;
    window.sGet = async () => {
      calls++;
      if(calls===1){ fbReadFailed = true; return null; }   // תקלת רשת חד-פעמית
      return { ev1: {date:"1.1.2026", read:true} };          // בפועל האדם חתם
    };
    const result = await sGetSigs("דניאל זאורוב");
    return { result, calls };
  });
  record("קריאה ראשונה נכשלת, שנייה מצליחה -> מחזיר את החתימה האמיתית ולא ריק",
    out.result && out.result.ev1 && out.result.ev1.read===true && out.calls===2, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. כשל עקבי ואמיתי (לא חולף) -> אחרי 3 נסיונות עדיין נכנע ל-{} (לא תקוע לנצח)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    let calls = 0;
    window.sGet = async () => { calls++; fbReadFailed = true; return null; };
    const start = Date.now();
    const result = await sGetSigs("מישהו");
    return { result, calls, elapsed: Date.now()-start };
  });
  record("כשל עקבי: מוותר אחרי 3 נסיונות (לא לולאה אינסופית), מחזיר {} ולא נתקע",
    out.calls===3 && Object.keys(out.result).length===0, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. הצלחה כבר בנסיון הראשון -> אין נסיון חוזר מיותר (לא מבזבז זמן סתם)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    let calls = 0;
    window.sGet = async () => { calls++; return { ev1:{read:true} }; };
    const result = await sGetSigs("מישהו");
    return { result, calls };
  });
  record("הצלחה מיידית -> קריאה אחת בלבד, בלי נסיון חוזר מיותר",
    out.calls===1 && out.result.ev1, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. "לא חתם על כלום באמת" (הצלחה עם מסמך ריק) -> לא מתפרש כ"כשל רשת" ולא מנסה שוב סתם
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    let calls = 0;
    window.sGet = async () => { calls++; return null; };   // מסמך לא קיים בכלל = לא חתם על שום דבר, לא כשל
    const result = await sGetSigs("חדש בצוות");
    return { result, calls };
  });
  record("מסמך ריק אמיתי (אין נתונים, לא כשל) -> קריאה אחת, מחזיר {}",
    out.calls===1 && Object.keys(out.result).length===0, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. sGetSigsIn (הגרסה החוצה-מסגרות, לפי מזהה סככה) עובדת באותו אופן
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    let calls = 0;
    window.sGetIn = async (shedId, key) => {
      calls++;
      if(calls===1){ fbReadFailed = true; return null; }
      return { ev1: {read:true} };
    };
    const result = await sGetSigsIn("shed2", "רון");
    return { result, calls };
  });
  record("sGetSigsIn: כשל חולף בסככה אחרת מתאושש באותו אופן",
    out.result && out.result.ev1 && out.calls===2, JSON.stringify(out));
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
