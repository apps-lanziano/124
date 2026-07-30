import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const p = await b.newPage();
await p.setViewportSize({ width:390, height:800 });
await p.route('**gstatic.com/**', r=>r.abort()); await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(400);
await p.evaluate(async ()=>{
  const store={};
  window.sGetRaw=async k=>store[k]??null; window.sSetRaw=async(k,v)=>{store[k]=v;};
  window.getBoAllocations=async()=>[]; window.getBoExpenses=async()=>[];
  isBudgetOfficer=true; userRole="מפקד"; currentShed=null; document.getElementById('login-overlay').style.display='none';
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('scr-budget-officer').classList.add('active');
  await renderBoOverview();
});
await p.waitForTimeout(200);

// לחיצה אמיתית (לא קריאת JS ישירה) — בודקת חפיפות/z-index/pointer-events אמיתיים
const expBtn = p.locator('.bo-qa-btn', { hasText: 'הוצאה חדשה' });
await expBtn.click();
await p.waitForTimeout(200);
const expOpen = await p.evaluate(()=>document.getElementById('bo-expense-modal').classList.contains('open'));
await p.evaluate(()=>document.getElementById('bo-expense-modal').classList.remove('open'));

const allocBtn = p.locator('.bo-qa-btn', { hasText: 'הקצאה חדשה' });
await allocBtn.click();
await p.waitForTimeout(200);
const allocOpen = await p.evaluate(()=>document.getElementById('bo-allocation-modal').classList.contains('open'));

console.log("ERRORS:", JSON.stringify(errs));
console.log(JSON.stringify({ expOpen, allocOpen }));
await b.close();
