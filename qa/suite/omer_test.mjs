import { launchBrowser } from '../lib/pw.mjs';
const b = await launchBrowser();
const p = await b.newPage();
await p.route('**gstatic.com/**', r=>r.abort()); await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(300);
const out = await p.evaluate(async ()=>{
  const store={}; window.sGet=async k=>store[k]??null; window.sSet=async(k,v)=>{store[k]=v;};
  window.logAction=async()=>{}; window.toast=()=>{};
  const o={};
  currentShed={id:"shed1",name:"סככה 1"};
  PERSONNEL=[{name:"עומר שאול",role:"חייל"},{name:"חייל אחר",role:"חייל"}];
  let naatim=[];
  window.getNaatim=async()=>naatim;

  // 1) עומר כנע"ת "כשירות חיילים" -> שתי הלשוניות
  naatim=[{area:"כשירות חיילים",person:"עומר שאול"}];
  user="עומר שאול"; userRole="חייל"; await refreshAreaPermissions();
  o.omer_both = {hearing:isHearingResp, range:isRangeResp};
  medTab="hearing"; o.omer_canEditHearing = medCanEdit("hearing");
  medTab="range";   o.omer_canEditRange   = medCanEdit("range");
  // הכרטיסים ניתנים ללחיצה
  store["medchecks"]={}; medTab="hearing"; await renderMedChecks();
  o.cardsClickable = document.querySelector('#medchecks-list .med-card').getAttribute('onclick')!==null;
  // שמירה בפועל
  await openMedEdit("חייל אחר");
  o.modalOpened = document.getElementById('med-modal').classList.contains('open');
  document.getElementById('med-done').value="2026-07-28"; medAutoExpiry();
  await saveMedCheck();
  o.saved = JSON.stringify(store["medchecks"]);

  // 2) חייל אחר ללא נע"ת -> אין הרשאה
  user="חייל אחר"; userRole="חייל"; await refreshAreaPermissions();
  o.other = {hearing:isHearingResp, range:isRangeResp};

  // 3) שיבוץ חלקי: רק "מטווחים"
  naatim=[{area:"מטווחים",person:"עומר שאול"}];
  user="עומר שאול"; await refreshAreaPermissions();
  o.omer_rangeOnly = {hearing:isHearingResp, range:isRangeResp};

  // 4) שם שגוי -> אין הרשאה (ולכן הרשימה הנפתחת חשובה)
  naatim=[{area:"כשירות חייל",person:"עומר שאול"}];
  await refreshAreaPermissions();
  o.typo = {hearing:isHearingResp, range:isRangeResp};
  return o;
});
console.log("ERRORS:", JSON.stringify(errs));
console.log(JSON.stringify(out,null,2));
await b.close();
