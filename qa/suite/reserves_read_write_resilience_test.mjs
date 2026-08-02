/* דיווח: "עדיין אין אנשי מילואים באחראי הדרכה למרות שיש אנשי מילואים בסככה 2" —
   נשאר גם אחרי מיזוג הנתונים הישנים. חשד: כשל קריאה חולף (מרוץ טוקן/רשת) על
   אחת המסגרות גורם למסך "אין מילואים" מטעה בלי שום הודעת שגיאה, וכתיבה כושלת
   מהאדמין (+ הוספת איש מילואים) מציגה "נוסף ✓" גם כשלא נשמר בפועל. שני התיקונים:
   1) getReserves() מנסה שוב לכל מסגרת שנכשלה, ומסמן reservesReadFailed אם עדיין
      נכשל בסוף — renderReserves מציג הודעת שגיאה ייעודית, לא "אין מילואים".
   2) saveReserve/removeReserve בודקים את ערך ההחזרה של הכתיבה ולא סוגרים את
      המודל/מציגים "✓" אם הכתיבה נכשלה בפועל. */
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

// 1. כשל חולף (2 נסיונות נכשלים, השלישי מצליח) -> getReserves עדיין מוצא את המילואים, בלי reservesReadFailed
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = { "shed2_cfg_personnel": [{name:"רזרביסט", role:"חייל", reserve:true, refresh:"2026-01-01"}] };
    let shed2Attempts = 0;
    window.sGetIn = async (shed,key) => {
      if(shed==="shed2" && key==="cfg_personnel"){
        shed2Attempts++;
        if(shed2Attempts < 3){ fbReadFailed = true; return null; }
      }
      fbReadFailed = false;
      return store[shed+"_"+key] ?? null;
    };
    const list = await getReserves();
    return { list, attempts: shed2Attempts, reservesReadFailed };
  });
  record("כשל חולף (2 נסיונות) -> ניסיון שלישי מצליח, הרזרביסט נמצא",
    out.list.some(r=>r.shedId==="shed2" && r.person==="רזרביסט") && out.attempts===3, JSON.stringify(out));
  record("כשל חולף שהתגבר עליו הניסיון החוזר -> reservesReadFailed=false",
    out.reservesReadFailed===false, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. כשל מתמשך (כל 3 הנסיונות נכשלים) -> reservesReadFailed=true, renderReserves מציג הודעת שגיאה ולא "אין מילואים"
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetIn = async (shed,key) => {
      if(shed==="shed2" && key==="cfg_personnel"){ fbReadFailed = true; return null; }
      fbReadFailed = false;
      return store[shed+"_"+key] ?? null;
    };
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-admin').classList.add('active');
    await renderReserves();
    return {
      reservesReadFailed,
      html: document.getElementById("admin-reserves-list").innerHTML,
    };
  });
  record("כשל מתמשך -> reservesReadFailed=true", out.reservesReadFailed===true, JSON.stringify(out.reservesReadFailed));
  record("renderReserves מציג הודעת שגיאה ולא 'אין עדיין אנשי מילואים' מטעה",
    out.html.includes("הטעינה נכשלה") && !out.html.includes("אין עדיין אנשי מילואים"), out.html);
  console.log("errs2",errs); await p.close();
}

// 3. כתיבה כושלת ב-saveReserve (הוספה חדשה) -> טוסט שגיאה, המודל לא נסגר, לא "נוסף ✓"
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast = (m)=>{ window._t = window._t||[]; window._t.push(m); };
    window.renderReserves = async ()=>{};
    window.sGetIn = async ()=>[];
    window.sSetIn = async ()=>false;   // כשל כתיבה
    document.getElementById("reserve-modal").classList.add("open");
    document.getElementById("reserve-shed").innerHTML = '<option value="shed2">סככה 2</option>';
    document.getElementById("reserve-shed").value = "shed2";
    document.getElementById("reserve-person-free").value = "רזרביסט חדש";
    document.getElementById("reserve-last").value = "2026-01-01";
    window._t = [];
    await saveReserve();
    return { toasts: window._t, modalOpen: document.getElementById("reserve-modal").classList.contains("open") };
  });
  record("כתיבה כושלת בהוספה: טוסט שגיאה, לא 'נוסף ✓'",
    out.toasts.some(t=>t.includes("נכשלה")) && !out.toasts.some(t=>t.includes("נוסף")), JSON.stringify(out.toasts));
  record("כתיבה כושלת בהוספה: המודל נשאר פתוח (לא נסגר בטעות כאילו הצליח)",
    out.modalOpen===true, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. כתיבה כושלת ב-removeReserve -> טוסט שגיאה, לא "הוסר מהצוות"
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast = (m)=>{ window._t = window._t||[]; window._t.push(m); };
    window.confirm = ()=>true;
    window.renderReserves = async ()=>{};
    window.sGetIn = async ()=>[{name:"רזרביסט", role:"חייל", reserve:true}];
    window.sSetIn = async ()=>false;   // כשל כתיבה
    window._t = [];
    await removeReserve("shed2::רזרביסט");
    return { toasts: window._t };
  });
  record("כתיבה כושלת בהסרה: טוסט שגיאה, לא 'הוסר מהצוות'",
    out.toasts.some(t=>t.includes("נכשלה")) && !out.toasts.some(t=>t.includes("הוסר")), JSON.stringify(out.toasts));
  console.log("errs4",errs); await p.close();
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
