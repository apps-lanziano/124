import { launchBrowser } from '../lib/pw.mjs';
const b = await launchBrowser();
const p = await b.newPage();
await p.setViewportSize({ width:390, height:800 });
await p.route('**gstatic.com/**', r=>r.abort()); await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(400);
const out = await p.evaluate(async ()=>{
  const o={};
  const modalBgs = document.querySelectorAll('.modal-bg');
  o.totalModals = modalBgs.length;
  const withX = document.querySelectorAll('.modal-bg > .modal > .modal-x');
  o.modalsWithX = withX.length;
  // בדיקת פתיחה+סגירה על שני חלונות שונים
  const test = (id) => {
    const bg = document.getElementById(id);
    bg.classList.add('open');
    const x = bg.querySelector('.modal-x');
    const before = bg.classList.contains('open');
    x.click();
    const after = bg.classList.contains('open');
    return { before, after };
  };
  o.teamModal = test('team-modal');
  o.sigModal = test('sig-modal');
  o.addModal = test('add-modal');
  o.naatimModal = test('naatim-modal');
  // וידוא שלא נוסף X כפול בהרצה חוזרת
  ensureModalCloseButtons();
  o.stillOneX = document.querySelectorAll('#team-modal .modal-x').length;
  // וידוא שכותרת ה-h3 לא נחתכת/מתנגשת עם ה-X (בדיקת חפיפה גיאומטרית)
  const modal = document.getElementById('team-modal').querySelector('.modal');
  document.getElementById('team-modal').classList.add('open');
  await new Promise(r=>requestAnimationFrame(r));
  const h3 = modal.querySelector('h3').getBoundingClientRect();
  const x = modal.querySelector('.modal-x').getBoundingClientRect();
  const overlap = !(h3.right < x.left || h3.left > x.right || h3.bottom < x.top || h3.top > x.bottom);
  o.h3OverlapsX = overlap;
  return o;
});
console.log("ERRORS:", JSON.stringify(errs));
console.log(JSON.stringify(out,null,2));
await b.close();
