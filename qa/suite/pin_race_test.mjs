/* משחזר את התקלה שדווחה: PIN-ים של חיילים שנעלמו.
   השורש — "דריסת עדכון": כל מכשיר מחזיק עותק שלם של רשימת הצוות בזיכרון,
   וכתיבה של העותק הזה במלואו מוחקת שינויים שמכשירים אחרים ביצעו בינתיים.
   הבדיקות מדמות שני מכשירים עם עותקים נפרדים, ומוודאות שאף אחד מהם
   לא מוחק את ה-PIN של השני. */
import { launchBrowser } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
async function page(){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  return {p, errs};
}
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. שני חיילים מגדירים PIN במקביל, כל אחד עם עותק זיכרון משלו -> שני ה-PIN שורדים
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    // "השרת": מסמך יחיד של רשימת הצוות
    const server = { "shed2_cfg_personnel": [{name:"דני",role:"חייל"},{name:"רון",role:"חייל"},{name:"עידן",role:"חייל"}] };
    window.sGetRaw = async k => server[k] ? JSON.parse(JSON.stringify(server[k])) : null;
    window.sSetRaw = async (k,v) => { server[k] = JSON.parse(JSON.stringify(v)); return true; };
    currentShed = {id:"shed2", name:"סככה 2"};

    // מכשיר א' של דני: טוען עותק
    PERSONNEL = await sGet("cfg_personnel");
    const danisCopy = PERSONNEL;
    // מכשיר ב' של רון: טוען עותק משלו, באותו רגע (לפני שדני שמר)
    const ronsCopy = await sGet("cfg_personnel");

    // דני מגדיר PIN (מהעותק שלו)
    PERSONNEL = danisCopy;
    await mutatePersonnel(list=>{ const m=list.find(x=>x.name==="דני"); m.pinHash="HASH_DANI"; m.pinSalt="s1"; });

    // רון מגדיר PIN — מהעותק הישן שלו, שבו לדני עדיין אין PIN
    PERSONNEL = ronsCopy;
    await mutatePersonnel(list=>{ const m=list.find(x=>x.name==="רון"); m.pinHash="HASH_RON"; m.pinSalt="s2"; });

    const final = server["shed2_cfg_personnel"];
    return {
      daniHasPin: !!(final.find(x=>x.name==="דני")||{}).pinHash,
      ronHasPin:  !!(final.find(x=>x.name==="רון")||{}).pinHash,
      count: final.length,
    };
  });
  record("שני חיילים מגדירים PIN במקביל — שני ה-PIN שורדים (אין דריסה)",
    out.daniHasPin && out.ronHasPin && out.count===3, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. התרחיש הקריטי: מפקד עם עותק ישן שומר שינוי בניהול הצוות אחרי שחיילים הגדירו PIN
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const server = { "shed2_cfg_personnel": [{name:"דני",role:"חייל"},{name:"רון",role:"חייל"}] };
    window.sGetRaw = async k => server[k] ? JSON.parse(JSON.stringify(server[k])) : null;
    window.sSetRaw = async (k,v) => { server[k] = JSON.parse(JSON.stringify(v)); return true; };
    window.toast=(m)=>{window._t=window._t||[];window._t.push(m);};
    window.renderTeamMgmt=()=>{}; window.populateLogin=()=>{}; window.renderBdays=()=>{};
    window.cancelEditMember=()=>{}; window.tmShowForm=()=>{}; window.getCerts=async()=>[];
    window.renamePersonEverywhere=async()=>{};
    currentShed = {id:"shed2", name:"סככה 2"};

    // 08:00 — המפקד נכנס, עותק הצוות נטען לזיכרון שלו (לאף אחד אין PIN)
    PERSONNEL = await sGet("cfg_personnel");
    const commandersStaleCopy = PERSONNEL;

    // 08:05-08:30 — שני החיילים מגדירים PIN מהטלפונים שלהם (ישירות בשרת)
    server["shed2_cfg_personnel"].find(x=>x.name==="דני").pinHash = "HASH_DANI";
    server["shed2_cfg_personnel"].find(x=>x.name==="רון").pinHash = "HASH_RON";

    // 09:00 — המפקד מוסיף איש צוות חדש, עדיין עם העותק הישן מ-08:00
    PERSONNEL = commandersStaleCopy;
    editMemberIdx = -1;
    document.getElementById("tm-name").value = "חייל חדש";
    document.getElementById("tm-role").value = "חייל";
    document.getElementById("tm-bday").value = "2000-01-01";
    document.getElementById("tm-pin").value = "";
    document.getElementById("tm-pin-remove").checked = false;
    await saveTeamMember();

    const final = server["shed2_cfg_personnel"];
    return {
      daniPinSurvived: (final.find(x=>x.name==="דני")||{}).pinHash === "HASH_DANI",
      ronPinSurvived:  (final.find(x=>x.name==="רון")||{}).pinHash === "HASH_RON",
      newMemberAdded:  final.some(x=>x.name==="חייל חדש"),
      names: final.map(x=>x.name),
    };
  });
  record("מפקד שומר שינוי עם עותק ישן — ה-PIN של החיילים שורד, והשינוי שלו נשמר",
    out.daniPinSurvived && out.ronPinSurvived && out.newMemberAdded, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. עריכת איש צוות ע"י מפקד עם עותק ישן — לא מוחקת PIN של אחרים
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const server = { "shed2_cfg_personnel": [{name:"דני",role:"חייל",bday:"2000-01-01"},{name:"רון",role:"חייל",bday:"2000-01-01"}] };
    window.sGetRaw = async k => server[k] ? JSON.parse(JSON.stringify(server[k])) : null;
    window.sSetRaw = async (k,v) => { server[k] = JSON.parse(JSON.stringify(v)); return true; };
    window.toast=()=>{}; window.renderTeamMgmt=()=>{}; window.populateLogin=()=>{}; window.renderBdays=()=>{};
    window.cancelEditMember=()=>{}; window.tmShowForm=()=>{}; window.getCerts=async()=>[];
    window.renamePersonEverywhere=async()=>{};
    currentShed = {id:"shed2", name:"סככה 2"};

    PERSONNEL = await sGet("cfg_personnel");        // עותק ישן של המפקד
    server["shed2_cfg_personnel"].find(x=>x.name==="רון").pinHash = "HASH_RON";   // רון הגדיר PIN בינתיים

    editMemberIdx = 0;                               // המפקד עורך את דני
    document.getElementById("tm-name").value = "דני כהן";
    document.getElementById("tm-role").value = "חייל";
    document.getElementById("tm-bday").value = "1999-05-05";
    document.getElementById("tm-pin").value = "";
    document.getElementById("tm-pin-remove").checked = false;
    await saveTeamMember();

    const final = server["shed2_cfg_personnel"];
    return {
      ronPinSurvived: (final.find(x=>x.name==="רון")||{}).pinHash === "HASH_RON",
      daniRenamed: final.some(x=>x.name==="דני כהן"),
      daniBday: (final.find(x=>x.name==="דני כהן")||{}).bday,
    };
  });
  record("עריכת איש צוות עם עותק ישן — PIN של אחרים שורד, והעריכה נשמרת",
    out.ronPinSurvived && out.daniRenamed && out.daniBday==="1999-05-05", JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. הסרת איש צוות עם עותק ישן — לא מוחקת PIN של אחרים
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const server = { "shed2_cfg_personnel": [{name:"דני",role:"חייל"},{name:"רון",role:"חייל"}] };
    window.sGetRaw = async k => server[k] ? JSON.parse(JSON.stringify(server[k])) : null;
    window.sSetRaw = async (k,v) => { server[k] = JSON.parse(JSON.stringify(v)); return true; };
    window.confirm = ()=>true; window.toast=()=>{};
    window.renderTeamMgmt=()=>{}; window.populateLogin=()=>{}; window.renderBdays=()=>{};
    window.cancelEditMember=()=>{}; window.removePersonCerts=async()=>{};
    currentShed = {id:"shed2", name:"סככה 2"};

    PERSONNEL = await sGet("cfg_personnel");
    server["shed2_cfg_personnel"].find(x=>x.name==="רון").pinHash = "HASH_RON";
    await removeTeamMember(0);   // מסיר את דני

    const final = server["shed2_cfg_personnel"];
    return {
      ronPinSurvived: (final.find(x=>x.name==="רון")||{}).pinHash === "HASH_RON",
      daniRemoved: !final.some(x=>x.name==="דני"),
    };
  });
  record("הסרת איש צוות עם עותק ישן — PIN של אחרים שורד",
    out.ronPinSurvived && out.daniRemoved, JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. כשל קריאה (רשת) — לא כותבים בכלל, במקום לדרוס בעיוורון
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const server = { "shed2_cfg_personnel": [{name:"דני",role:"חייל",pinHash:"HASH_DANI"}] };
    window.sGetRaw = async k => { fbReadFailed = true; return null; };   // קריאה נכשלת
    let wrote = false;
    window.sSetRaw = async (k,v) => { wrote = true; server[k]=v; return true; };
    currentShed = {id:"shed2", name:"סככה 2"};
    PERSONNEL = [{name:"דני",role:"חייל"}];   // עותק ישן בלי PIN
    const ok = await mutatePersonnel(list=>{ list.push({name:"חדש",role:"חייל"}); });
    return { ok, wrote, daniStillHasPin: !!server["shed2_cfg_personnel"][0].pinHash };
  });
  record("כשל קריאה — הכתיבה נחסמת, הנתונים בשרת נשארים שלמים",
    out.ok===false && out.wrote===false && out.daniStillHasPin, JSON.stringify(out));
  console.log("errs5",errs); await p.close();
}

// 6. הגדרת PIN בהתחברות (doLogin) — נשמרת בפועל דרך המיזוג
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const server = { "shed2_cfg_personnel": [{name:"דני",role:"חייל"},{name:"רון",role:"חייל",pinHash:"HASH_RON",pinSalt:"s"}] };
    window.sGetRaw = async k => server[k] ? JSON.parse(JSON.stringify(server[k])) : null;
    window.sSetRaw = async (k,v) => { server[k] = JSON.parse(JSON.stringify(v)); return true; };
    currentShed = {id:"shed2", name:"סככה 2"};
    PERSONNEL = [{name:"דני",role:"חייל"},{name:"רון",role:"חייל"}];   // עותק ישן: לרון עדיין אין PIN
    const person = PERSONNEL[0];
    const salt = genSalt();
    const newHash = await hashPin("1234", salt);
    const saved = await mutatePersonnel(list=>{
      const m = list.find(x=>x.name===person.name);
      if(!m) return false;
      m.pinHash=newHash; m.pinSalt=salt; m.pinSetBy=person.name+" (עצמי)"; m.pinSetAt="1.1";
    });
    const final = server["shed2_cfg_personnel"];
    return {
      saved,
      daniHasPin: !!(final.find(x=>x.name==="דני")||{}).pinHash,
      ronPinSurvived: (final.find(x=>x.name==="רון")||{}).pinHash === "HASH_RON",
    };
  });
  record("הגדרת PIN בהתחברות — נשמרת, ולא דורסת PIN קיים של חייל אחר",
    out.saved && out.daniHasPin && out.ronPinSurvived, JSON.stringify(out));
  console.log("errs6",errs); await p.close();
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
