import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.setViewportSize({ width:360, height:800 });
await p.route('**gstatic.com/**', r=>r.abort()); await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(300);
const out = await p.evaluate(async ()=>{
  const o={};
  const today = new Date();
  const iso = d => new Date(Date.now()+d*864e5).toISOString().slice(0,10);
  // רכב תקין
  const vOk = {id:"v1", name:"רכב תקין", number:"111-11-111", nextService:iso(200), testDate:iso(200), km:5000, kmService:50000, vehicleCode:"123", fuelCode:"456"};
  // רכב עם בעיה בודדת (טסט פג)
  const vOneIssue = {id:"v2", name:"רכב טסט פג", number:"222-22-222", nextService:iso(200), testDate:iso(-5)};
  // רכב עם כמה בעיות
  const vMulti = {id:"v3", name:"רכב בעיות", number:"333-33-333", nextService:iso(-10), testDate:iso(3), kmService:1000, km:2000};

  const checks=["nextService","monthlyService","annualService","testDate","kmService"];
  [vOk, vOneIssue, vMulti].forEach(v=>{
    const st = vehicleStatusDetailed(v, checks);
    v._short = vehicleShortLabel(st);
  });
  o.okLabel = vOk._short;
  o.oneIssueLabel = vOneIssue._short;
  o.multiLabel = vMulti._short;

  const html = vehicleCardHtml(vOk, '<button class="cert-chip-edit">✏️</button><button class="cert-chip-del">✕</button>', checks);
  document.getElementById('scr-faults').innerHTML = html;   // מסך זמני לבדיקת רינדור בלבד
  document.getElementById('scr-faults').classList.add('active');
  await new Promise(r=>requestAnimationFrame(r));
  const head = document.querySelector('.cert-sum-head');
  const r = head.getBoundingClientRect();
  o.headHeight = Math.round(r.height);
  o.headOverflowsViewport = r.right > 360 || r.left < 0;
  o.pillText = document.querySelector('.cert-sum-head .pill').textContent;
  // פתיחה
  document.querySelector('.cert-sum-card').click();
  await new Promise(r=>setTimeout(r,450));
  const detail = document.querySelector('.cert-sum-detail-inner');
  o.detailVisible = getComputedStyle(document.querySelector('.cert-sum-detail')).maxHeight !== '0px';
  o.detailText = detail.textContent.replace(/\s+/g,' ').trim();
  return o;
});
console.log("ERRORS:", JSON.stringify(errs));
console.log(JSON.stringify(out,null,2));
await b.close();
