/* "רוצה לייצר קישור לאתר המצגות האזרחי (SharePoint)" — המשתמש בחר במפורש
   באפשרות "כפתור/קישור פשוט לאתר" (לא ייבוא/API). בודק שהקישור קיים גם
   במסך חומרי ההדרכה של החיילים וגם בלשונית "הדרכה" של אחראי ההדרכה,
   נפתח בטאב חדש, ולא חושף את window.opener (noopener). */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const p = await b.newPage();
await p.route('**gstatic.com/**', r=>r.abort());
await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(250);

const out = await p.evaluate(async ()=>{
  const links = [...document.querySelectorAll('a[href*="tikshuv.sharepoint.com"]')];
  return links.map(a => ({
    parentId: a.closest('.screen, .admin-pane')?.id || null,
    href: a.getAttribute('href'),
    target: a.getAttribute('target'),
    rel: a.getAttribute('rel'),
  }));
});

record("יש בדיוק 2 קישורים לאתר ה-SharePoint (מסך חיילים + לשונית אחראי הדרכה)",
  out.length===2, JSON.stringify(out));
record("קישור אחד נמצא במסך 'חומרי הדרכה' של החיילים (scr-training)",
  out.some(l=>l.parentId==="scr-training"), JSON.stringify(out));
record("קישור אחד נמצא בלשונית 'הדרכה' של אחראי ההדרכה (apane-training)",
  out.some(l=>l.parentId==="apane-training"), JSON.stringify(out));
record("כל הקישורים נפתחים בטאב חדש עם rel=noopener noreferrer (לא חושפים window.opener)",
  out.every(l=>l.target==="_blank" && l.rel==="noopener noreferrer"), JSON.stringify(out));
record("כתובת ה-URL מדויקת בשני המקומות",
  out.every(l=>l.href==="https://tikshuv.sharepoint.com/sites/AU_09-124/"), JSON.stringify(out));

console.log("errs", errs);
await p.close();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await b.close();
process.exit(allPass?0:1);
