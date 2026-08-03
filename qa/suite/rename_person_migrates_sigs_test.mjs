/* באג: "דניאל זאורוב ביצע חתימה ושוב מופיע שלא ביצע" — שורש הבעיה:
   renamePersonEverywhere (רץ כששם חייל נערך/מתוקן בניהול צוות) העתיק את
   ההיסטוריה ב-certs_list/naatim_list/admin_reserves_list, אבל *לא* את
   sigs_<שם> (חתימות/אישורי קריאה על קרא-וחתום) ולא את medchecks (כשירות
   שמיעה/מטווח) — שניהם שמורים לפי השם עצמו. אחרי תיקון שם (למשל איות),
   כל היסטוריית החתימות של האדם נשארת "תקועה" תחת השם הישן, וכל מסך
   שבודק סטטוס לפי השם החדש רואה מסמך ריק — נראה כאילו לא חתם, למרות
   שבפועל כן חתם. */
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

// 1. שינוי שם (איות) מעביר את היסטוריית החתימות לשם החדש, ומרוקן את הישן
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGet = async k => store[shedKey(k)] ?? null;
    window.sSet = async (k,v) => { store[shedKey(k)]=v; return true; };
    currentShed = {id:"shed1", name:"סככה 1"};
    const oldName = "דניאל זאורב", newName = "דניאל זאורוב";
    store[shedKey("sigs_"+safeName(oldName))] = { ev1: {date:"1.1.2026", read:true} };

    await renamePersonEverywhere(oldName, newName);

    return {
      newSigs: store[shedKey("sigs_"+safeName(newName))],
      oldSigs: store[shedKey("sigs_"+safeName(oldName))],
    };
  });
  record("החתימה הקיימת (ev1) עברה לשם החדש", out.newSigs && out.newSigs.ev1 && out.newSigs.ev1.read===true, JSON.stringify(out));
  record("מסמך השם הישן רוקן (לא נשאר עותק כפול)", out.oldSigs && Object.keys(out.oldSigs).length===0, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. מיזוג: אם גם לשם החדש כבר יש חתימות (למשל משם שכבר שונה בעבר), שני
//    הצדדים נשמרים — לא נדרס אף פריט
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGet = async k => store[shedKey(k)] ?? null;
    window.sSet = async (k,v) => { store[shedKey(k)]=v; return true; };
    currentShed = {id:"shed1", name:"סככה 1"};
    const oldName = "רון א", newName = "רון אברהם";
    store[shedKey("sigs_"+safeName(oldName))] = { ev1: {date:"1.1.2026", read:true} };
    store[shedKey("sigs_"+safeName(newName))] = { ev2: {date:"2.1.2026", read:true} };

    await renamePersonEverywhere(oldName, newName);

    return { merged: store[shedKey("sigs_"+safeName(newName))] };
  });
  record("שתי החתימות (ev1 מהשם הישן, ev2 מהשם החדש) קיימות אחרי המיזוג",
    out.merged && out.merged.ev1 && out.merged.ev2, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. כשירות חיילים (medchecks) עוברת אף היא לשם החדש, באותו אופן
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGet = async k => store[shedKey(k)] ?? null;
    window.sSet = async (k,v) => { store[shedKey(k)]=v; return true; };
    currentShed = {id:"shed1", name:"סככה 1"};
    const oldName = "דני כהן", newName = "דניאל כהן";
    store[shedKey("medchecks")] = { [safeName(oldName)]: {hearing:"2026-01-01"} };

    await renamePersonEverywhere(oldName, newName);

    const medData = store[shedKey("medchecks")];
    return { newRecord: medData[safeName(newName)], oldRecordGone: !(safeName(oldName) in medData) };
  });
  record("רשומת הכשירות עברה למפתח השם החדש, והמפתח הישן נעלם",
    out.newRecord && out.newRecord.hearing==="2026-01-01" && out.oldRecordGone, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. אין שינוי בשם בפועל (למשל רק תיקון role/bday) -> אין קריאה/כתיבה מיותרת,
//    ואין קריסה
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    let sigWrites = 0;
    window.sGet = async k => (k==="certs_list"||k==="naatim_list") ? [] : {};
    window.sSet = async () => { sigWrites++; return true; };
    window.sGetRaw = async () => [];
    window.sSetRaw = async () => true;
    currentShed = {id:"shed1", name:"סככה 1"};
    let threw = false, errMsg = "";
    try{ await renamePersonEverywhere("אותו שם", "אותו שם"); } catch(e){ threw = true; errMsg = String(e && e.message); }
    return { threw, sigWrites, errMsg };
  });
  record("שם זהה (ללא שינוי אמיתי): לא זורק שגיאה", !out.threw, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
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
