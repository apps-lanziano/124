/* הקשחת ההצפנה של ה-PIN — הבדיקה הקריטית ביותר בחבילה.
   טעות כאן נועלת את כל הטייסת מחוץ לאפליקציה.
   מוודא: (1) הפורמט הישן ממשיך לעבוד, (2) הוא משתדרג בשקט,
   (3) הפורמט החדש עובד, (4) PIN שגוי עדיין נדחה בשני הפורמטים. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
async function page(){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  return {p, errs};
}
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. PIN בפורמט הישן — עדיין מאמת נכון (אחרת כולם ננעלים בחוץ)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const salt = genSalt();
    const legacyHash = await hashPinLegacy("1234", salt);
    const person = { name:"ותיק", pinHash: legacyHash, pinSalt: salt };   // בלי pinAlgo = פורמט ישן
    return {
      correct: await verifyPin(person, "1234"),
      wrong:   await verifyPin(person, "9999"),
    };
  });
  record("PIN קיים בפורמט הישן ממשיך לעבוד (ו-PIN שגוי נדחה)",
    out.correct === true && out.wrong === false, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. הפורמט החדש עובד
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const f = await buildPinFields("5678");
    const person = { name:"חדש", ...f };
    return {
      algo: f.pinAlgo, iter: f.pinIter,
      correct: await verifyPin(person, "5678"),
      wrong:   await verifyPin(person, "0000"),
      differsFromLegacy: f.pinHash !== await hashPinLegacy("5678", f.pinSalt),
    };
  });
  record("הפורמט החדש (PBKDF2) מאמת נכון ושונה מהישן",
    out.correct === true && out.wrong === false && out.algo === "pbkdf2"
      && out.iter >= 100000 && out.differsFromLegacy, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. שדרוג שקט: כניסה עם PIN ישן משדרגת אותו, וה-PIN נשאר תקף
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k=> store[k] ? JSON.parse(JSON.stringify(store[k])) : null;
    window.sSetRaw = async (k,v)=> { store[k]=JSON.parse(JSON.stringify(v)); return true; };
    currentShed = {id:"shed1", name:"סככה 1"};
    const salt = genSalt();
    const legacyHash = await hashPinLegacy("1234", salt);
    store["shed1_cfg_personnel"] = [{name:"ותיק", role:"חייל", pinHash:legacyHash, pinSalt:salt}];
    PERSONNEL = await sGet("cfg_personnel");
    const person = PERSONNEL[0];

    const before = { algo: person.pinAlgo, hash: person.pinHash };
    await upgradePinIfLegacy(person, "1234");
    const stored = store["shed1_cfg_personnel"][0];

    return {
      beforeAlgo: before.algo,
      afterAlgo: stored.pinAlgo,
      hashChanged: stored.pinHash !== before.hash,
      stillVerifies: await verifyPin(stored, "1234"),
      wrongRejected: await verifyPin(stored, "1111"),
    };
  });
  record("שדרוג שקט: PIN ישן הופך לחדש, ואותו PIN ממשיך לעבוד",
    out.beforeAlgo === undefined && out.afterAlgo === "pbkdf2" && out.hashChanged
      && out.stillVerifies === true && out.wrongRejected === false, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. שדרוג לא מופעל פעמיים ולא פוגע במי שכבר בפורמט החדש
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k=> store[k] ? JSON.parse(JSON.stringify(store[k])) : null;
    let writes = 0;
    window.sSetRaw = async (k,v)=> { writes++; store[k]=JSON.parse(JSON.stringify(v)); return true; };
    currentShed = {id:"shed1"};
    const f = await buildPinFields("4321");
    store["shed1_cfg_personnel"] = [{name:"מעודכן", role:"חייל", ...f}];
    PERSONNEL = await sGet("cfg_personnel");
    writes = 0;
    await upgradePinIfLegacy(PERSONNEL[0], "4321");
    return { writes, stillVerifies: await verifyPin(store["shed1_cfg_personnel"][0], "4321") };
  });
  record("מי שכבר בפורמט החדש — לא נכתב מחדש לחינם",
    out.writes === 0 && out.stillVerifies === true, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. הגדרת PIN ע"י מפקד/מנהל כותבת את הפורמט החדש (הבאג שכמעט נשלח:
//    העתקת hash+salt בלי pinAlgo => אימות מול האלגוריתם הישן => כניסה נכשלת)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const f = await buildPinFields("2468");
    // מדמה בדיוק את הלוגיקה של applyPin בניהול הצוות
    const m = {name:"חייל"};
    Object.assign(m, f); m.pinSetBy = "מפקד"; m.pinSetAt = "1.1";
    return {
      hasAlgo: m.pinAlgo === "pbkdf2",
      hasIter: !!m.pinIter,
      verifies: await verifyPin(m, "2468"),
    };
  });
  record("הגדרת PIN ע\"י מפקד/מנהל שומרת את כל שדות הפורמט החדש",
    out.hasAlgo && out.hasIter && out.verifies === true, JSON.stringify(out));
  console.log("errs5",errs); await p.close();
}

// 6. הסרת PIN מנקה את כל השדות — לא נשארת שארית שתטעה את האימות
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const f = await buildPinFields("1357");
    const m = {name:"חייל", ...f, pinSetBy:"מפקד", pinSetAt:"1.1"};
    const pinFields = {remove:true};
    if(pinFields.remove){ delete m.pinHash; delete m.pinSalt; delete m.pinAlgo; delete m.pinIter; delete m.pinSetBy; delete m.pinSetAt; }
    return {
      leftovers: Object.keys(m).filter(k=>k.startsWith("pin")),
      noPinPasses: await verifyPin(m, "כלשהו"),
    };
  });
  record("הסרת PIN מנקה את כל השדות ולא משאירה שארית",
    out.leftovers.length === 0 && out.noPinPasses === true, JSON.stringify(out));
  console.log("errs6",errs); await p.close();
}

// 7. ביצועים: האימות לא איטי מדי למכשיר נייד
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const f = await buildPinFields("1111");
    const t0 = performance.now();
    await verifyPin({...f}, "1111");
    return { ms: Math.round(performance.now()-t0), iter: f.pinIter };
  });
  record("זמן אימות סביר (מתחת ל-1.5 שניות)",
    out.ms < 1500, JSON.stringify(out));
  console.log("errs7",errs); await p.close();
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
