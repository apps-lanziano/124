/* לפני המעבר של אנשי מילואים לפורמט cfg_personnel per-shed (reserve:true), הם
   נשמרו ברשימה גלובלית אחת "admin_reserves_list". המעבר לא היגר את הנתונים
   הישנים, כך שאנשי מילואים שנוספו לפני המעבר (למשל בסככה 2) "נעלמו" מתצוגת
   אחראי ההדרכה — getReserves() כבר לא קורא מהמפתח הישן. migrateLegacyReservesList
   ממזגת אותם חד-פעמית פנימה לכל מסגרת. */
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

// 1. מיזוג: איש מילואים ישן בסככה 2 שלא היה בצוות בכלל -> נוסף עם reserve:true
//    ואיש מילואים ישן שכבר קיים בצוות (בלי reserve) -> מסומן reserve:true בלי לשכפל
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };

    store["admin_reserves_list"] = [
      {id:"res1", shedId:"shed2", person:"רזרביסט ישן", last:"2026-01-01"},
      {id:"res2", shedId:"shed2", person:"דני", last:"2026-02-01"},   // כבר בצוות, בלי reserve
      {id:"res3", shedId:"shedX", person:"לא קיים", last:"2026-01-01"}, // מסגרת שלא קיימת — מתעלמים
    ];
    store["shed2_cfg_personnel"] = [
      {name:"דני", role:"חייל", bday:"2000-01-01"},
      {name:"רון", role:"מפקד", bday:"1990-01-01"},
    ];

    await migrateLegacyReservesList();

    return {
      shed2: store["shed2_cfg_personnel"],
      migratedFlag: store["legacy_reserves_migrated_v1"],
      reserves: await getReserves(),
    };
  });
  const shed2 = out.shed2;
  record("מיזוג: איש מילואים ישן שלא היה בצוות נוסף עם reserve:true",
    shed2.some(p=>p.name==="רזרביסט ישן" && p.reserve===true && p.refresh==="2026-01-01"), JSON.stringify(shed2));
  record("מיזוג: איש שכבר בצוות מסומן reserve:true בלי לשכפל רשומה",
    shed2.filter(p=>p.name==="דני").length===1 && shed2.find(p=>p.name==="דני").reserve===true, JSON.stringify(shed2));
  record("מיזוג: מפקד קיים (רון) לא נפגע",
    shed2.some(p=>p.name==="רון" && p.role==="מפקד" && !p.reserve), JSON.stringify(shed2));
  record("מיזוג: מסגרת לא-קיימת (shedX) לא גורמת לשגיאה, פשוט מדולגת",
    !shed2.some(p=>p.name==="לא קיים"), JSON.stringify(shed2));
  record("דגל חד-פעמי נשמר", out.migratedFlag===true, JSON.stringify(out.migratedFlag));
  record("getReserves() אחרי המיזוג מוצא את שני אנשי המילואים של סככה 2",
    out.reserves.filter(r=>r.shedId==="shed2").length===2 &&
    out.reserves.some(r=>r.person==="רזרביסט ישן") && out.reserves.some(r=>r.person==="דני"),
    JSON.stringify(out.reserves));
  console.log("errs1",errs); await p.close();
}

// 2. אידמפוטנטיות: הרצה שנייה אחרי שהדגל כבר סומן — לא עושה כלום, גם אם admin_reserves_list השתנה בינתיים
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };

    store["legacy_reserves_migrated_v1"] = true;
    store["admin_reserves_list"] = [{id:"res9", shedId:"shed2", person:"אחרי הדגל", last:"2026-01-01"}];
    store["shed2_cfg_personnel"] = [{name:"דני", role:"חייל", bday:"2000-01-01"}];

    await migrateLegacyReservesList();
    return { shed2: store["shed2_cfg_personnel"] };
  });
  record("אידמפוטנטיות: אחרי שהדגל כבר סומן, הרצה נוספת לא נוגעת בצוות",
    out.shed2.length===1 && !out.shed2.some(p=>p.name==="אחרי הדגל"), JSON.stringify(out.shed2));
  console.log("errs2",errs); await p.close();
}

// 3. אין נתונים ישנים בכלל — לא קורס, מסמן את הדגל ולא משנה כלום
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    store["shed2_cfg_personnel"] = [{name:"דני", role:"חייל", bday:"2000-01-01"}];
    await migrateLegacyReservesList();
    return { shed2: store["shed2_cfg_personnel"], flag: store["legacy_reserves_migrated_v1"] };
  });
  record("אין admin_reserves_list ישן: לא קורס, מסמן דגל, לא משנה צוות",
    out.flag===true && out.shed2.length===1, JSON.stringify(out));
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
