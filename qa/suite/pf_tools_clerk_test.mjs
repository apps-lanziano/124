/* פקיד כלים לא אמור להיות מוסמך PF — יש לו רק הסמכת חדר כלים.
   ensurePfBackfill (באקפיל חד-פעמי) לא בדק את זה בעבר, כך שפקידי כלים
   קיימים יכלו לקבל רשומת PF ריקה בטעות. הבדיקה: הבאקפיל לא יוצר PF
   לפקיד כלים, וניקוי חד-פעמי מסיר רשומות ישנות שכבר נוצרו, בכל המסגרות. */
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

// 1. ensurePfBackfill: לא יוצר PF לפקיד כלים, אבל כן יוצר לחייל רגיל
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    store["shed2_cfg_personnel"] = [
      {name:"דני", role:"חייל"},
      {name:"רון", role:"חייל", profession:"פקיד כלים"},
    ];
    store["shed2_certs_list"] = [];
    await ensurePfBackfill();
    const certs = store["shed2_certs_list"];
    return {
      daniHasPf: certs.some(c=>c.person==="דני" && c.name==="PF"),
      ronHasPf: certs.some(c=>c.person==="רון" && c.name==="PF"),
    };
  });
  record("ensurePfBackfill: חייל רגיל מקבל PF, פקיד כלים לא",
    out.daniHasPf===true && out.ronHasPf===false, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. cleanupPfForToolsClerk: מסיר רשומת PF שכבר נוצרה בטעות לפקיד כלים, בכמה מסגרות
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };

    store["shed2_cfg_personnel"] = [{name:"רון", role:"חייל", profession:"פקיד כלים"}, {name:"דני", role:"חייל"}];
    store["shed2_certs_list"] = [
      {id:"c1", person:"רון", name:"PF", expiry:""},     // רשומה שגויה שנוצרה בטעות
      {id:"c2", person:"דני", name:"PF", expiry:""},      // תקינה — נשארת
    ];
    store["shed4_cfg_personnel"] = [{name:"עידן", role:"חייל", profession:"פקיד כלים"}];
    store["shed4_certs_list"] = [{id:"c3", person:"עידן", name:"PF", expiry:""}];

    await cleanupPfForToolsClerk();

    return {
      shed2: store["shed2_certs_list"],
      shed4: store["shed4_certs_list"],
    };
  });
  record("ניקוי: PF שגוי של פקיד כלים בסככה 2 הוסר, PF תקין של חייל רגיל נשאר",
    out.shed2.length===1 && out.shed2[0].person==="דני", JSON.stringify(out.shed2));
  record("ניקוי: אותו דבר בסככה אחרת (סככה 4) — לא רק במסגרת אחת",
    out.shed4.length===0, JSON.stringify(out.shed4));
  console.log("errs2",errs); await p.close();
}

// 3. pfStatus/stage7Status: התנהגות קיימת נשמרת (רגרסיה) — פקיד כלים תמיד null
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    const clerk = {name:"רון", profession:"פקיד כלים", joined:"2000-01-01"};
    const soldier = {name:"דני", joined:"2000-01-01"};
    return {
      clerkPf: pfStatus(clerk, []),
      soldierPf: pfStatus(soldier, []) !== null,
      clerkStage7: stage7Status(clerk, [{person:"רון", name:"שלב 7"}]),
    };
  });
  record("pfStatus/stage7Status: פקיד כלים תמיד null (ללא שינוי בהתנהגות)",
    out.clerkPf===null && out.soldierPf===true && out.clerkStage7===null, JSON.stringify(out));
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
