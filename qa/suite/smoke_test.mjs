import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.setViewportSize({ width:390, height:800 });
await p.route('**gstatic.com/**', r=>r.abort()); await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(400);
const out = await p.evaluate(async ()=>{
  const store={};
  window.sGet=async k=>store[k]??null; window.sSet=async(k,v)=>{store[k]=v;};
  window.sGetRaw=async k=>store[k]??null; window.sSetRaw=async(k,v)=>{store[k]=v;};
  window.sGetIn=async(s,k)=>store[s+'_'+k]??null; window.sSetIn=async(s,k,v)=>{store[s+'_'+k]=v;};
  window.getNaatim=async()=>[]; window.getEvents=async()=>[]; window.getFaults=async()=>[];
  window.getCerts=async()=>[]; window.getTools=async()=>[]; window.getVehicles=async()=>[]; window.getNaatim=async()=>[];
  currentShed={id:"shed1",name:"סככה 1"}; user="בודק"; userRole="מפקד";
  PERSONNEL=[{name:"בודק",role:"מפקד"},{name:"חייל א",role:"חייל"}];
  const results={};
  try{ await renderTrends(); results.renderTrends="ok"; }catch(e){ results.renderTrends="ERR:"+e.message; }
  try{ await renderMedChecks(); results.renderMedChecks="ok"; }catch(e){ results.renderMedChecks="ERR:"+e.message; }
  try{ await renderVoOverview(); results.renderVoOverview="ok"; }catch(e){ results.renderVoOverview="ERR:"+e.message; }
  try{ await renderVoVehicles(); results.renderVoVehicles="ok"; }catch(e){ results.renderVoVehicles="ERR:"+e.message; }
  try{ await renderBoOverview(); results.renderBoOverview="ok"; }catch(e){ results.renderBoOverview="ERR:"+e.message; }
  try{ await renderBinuiFaultsAdmin(); results.renderBinuiFaultsAdmin="ok"; }catch(e){ results.renderBinuiFaultsAdmin="ERR:"+e.message; }
  try{ go("scr-duties", null); results.goDuties="ok"; }catch(e){ results.goDuties="ERR:"+e.message; }
  ensureModalCloseButtons();
  results.modalXCount = document.querySelectorAll('.modal-x').length;
  return results;
});
console.log("ERRORS:", JSON.stringify(errs));
console.log(JSON.stringify(out,null,2));
await b.close();
