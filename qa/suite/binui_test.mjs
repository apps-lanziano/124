import { launchBrowser } from '../lib/pw.mjs';
const b = await launchBrowser();
const p = await b.newPage();
await p.route('**gstatic.com/**', r=>r.abort()); await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(300);
const out = await p.evaluate(async ()=>{
  const store={"binui_faults_list":[{id:"f1",title:"תקלה בסככה 1",by:"מפקד 1",shedId:"shed1",dept:null,status:"פתוח",date:"01/01"}]};
  window.sGetRaw=async k=>store[k]??null; window.sSetRaw=async(k,v)=>{store[k]=v;};
  window.sDelRaw=async()=>{}; window.toast=()=>{};
  window.confirm=()=>true;
  const o={};

  const bodyHas = s => document.getElementById('binuifaultdetail-body').innerHTML.includes(s);

  // A: שחר שושן (isVehicleOfficer)
  isVehicleOfficer=true; isTechOfficer=false; userRole="מפקד"; currentShed=null;
  await openBinuiFaultDetail("f1");
  o.A_shahar = { hasStatus: bodyHas('סטטוס'), hasDelete: bodyHas('מחק תקלה') };

  // B: קצין טכני (isTechOfficer בלבד)
  isVehicleOfficer=false; isTechOfficer=true; currentShed=null;
  await openBinuiFaultDetail("f1");
  o.B_techOfficer = { hasStatus: bodyHas('סטטוס'), hasDelete: bodyHas('מחק תקלה') };

  // C: מפקד הסככה שדיווחה (shed1) — לא ניהול, אבל כן מחיקה עצמית
  isVehicleOfficer=false; isTechOfficer=false; userRole="מפקד";
  currentShed={id:"shed1",name:"סככה 1"};
  await openBinuiFaultDetail("f1");
  o.C_ownShedCommander = { hasStatus: bodyHas('סטטוס'), hasDelete: bodyHas('מחק תקלה') };

  // D: מפקד ממסגרת אחרת (shed2) — אין מחיקה
  currentShed={id:"shed2",name:"סככה 2"};
  await openBinuiFaultDetail("f1");
  o.D_otherShedCommander = { hasStatus: bodyHas('סטטוס'), hasDelete: bodyHas('מחק תקלה') };

  // E: חייל רגיל בסככה שדיווחה — אין מחיקה
  userRole="חייל"; currentShed={id:"shed1",name:"סככה 1"};
  await openBinuiFaultDetail("f1");
  o.E_soldier = { hasStatus: bodyHas('סטטוס'), hasDelete: bodyHas('מחק תקלה') };

  // מחיקה בפועל ע"י מפקד הסככה (תרחיש C)
  userRole="מפקד"; currentShed={id:"shed1",name:"סככה 1"};
  window.renderBinuiFaultsAdmin=async()=>{}; // אין box אצל מפקד סככה
  await deleteBinuiFault("f1");
  o.afterDelete = store["binui_faults_list"];

  return o;
});
console.log("ERRORS:", JSON.stringify(errs));
console.log(JSON.stringify(out,null,2));
await b.close();
