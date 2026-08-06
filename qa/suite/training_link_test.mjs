/* "אחראי הדרכה ומפקדי מסגרות יכולים להעלות קישור... כרגע לא רוצה קישור קבוע" —
   קישור (לא קובץ) לחומר הדרכה: אחראי הדרכה מפרסם לכל המסגרות (כמו פרסום
   קובץ), מפקד מסגרת רגילה מוסיף קישור מקומי לצוות שלו בלבד ויכול להסיר אותו
   בעצמו — לא כמו הקישור הקבוע ל-SharePoint שמוטמע בקוד. */
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

// 1. אחראי הדרכה מפרסם קישור -> מגיע לכל המסגרות, כולל למפקד הפרסום עצמו
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    window.sGet = async (k) => store[(currentShed?currentShed.id:"")+"_"+k] ?? null;
    window.sSet = async (k,v) => { store[(currentShed?currentShed.id:"")+"_"+k]=v; return true; };
    window.logAdminAction = async ()=>{};
    window.renderAdminTraining = ()=>{};
    window.renderTrainingView = ()=>{};
    isAdmin = true; currentShed = {id:"training", isTraining:true};
    document.getElementById("tl-title").value = "מצגת חדשה";
    document.getElementById("tl-url").value = "example.com/deck";  // בלי https:// בכוונה
    await saveTrainingLink();
    return {
      shed2: store["shed2_training_list"],
      adminList: store["admin_training"],
      modalOpen: document.getElementById("training-link-modal").classList.contains("open"),
    };
  });
  record("פרסום קישור ע\"י אחראי הדרכה מגיע לכל המסגרות (כולל סככה 2)",
    out.shed2 && out.shed2.some(t=>t.ftype==="link" && t.title==="מצגת חדשה"), JSON.stringify(out.shed2));
  record("URL בלי https:// מתוקן אוטומטית",
    out.shed2 && out.shed2[0].url==="https://example.com/deck", JSON.stringify(out.shed2 && out.shed2[0]));
  record("נכנס גם לרשימת האדמין (admin_training)",
    out.adminList && out.adminList.some(t=>t.ftype==="link"), JSON.stringify(out.adminList));
  record("המודל נסגר אחרי הצלחה", out.modalOpen===false, JSON.stringify(out.modalOpen));
  console.log("errs1",errs); await p.close();
}

// 2. מפקד סככה רגילה מוסיף קישור מקומי -> נכנס רק לסככה שלו, לא לאדמין ולא לסככות אחרות
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    window.sGet = async (k) => store[(currentShed?currentShed.id:"")+"_"+k] ?? null;
    window.sSet = async (k,v) => { store[(currentShed?currentShed.id:"")+"_"+k]=v; return true; };
    window.logAdminAction = async ()=>{};
    window.renderTrainingView = ()=>{};
    isAdmin = false; userRole = "מפקד"; user = "מפקד סככה 2"; currentShed = {id:"shed2", name:"סככה 2"};
    document.getElementById("tl-title").value = "קישור מקומי";
    document.getElementById("tl-url").value = "https://example.com/local";
    await saveTrainingLink();
    return {
      shed2: store["shed2_training_list"],
      shed3: store["shed3_training_list"],
      adminList: store["admin_training"],
    };
  });
  record("קישור מקומי נכנס רק לסככה של המפקד",
    out.shed2 && out.shed2.some(t=>t.title==="קישור מקומי"), JSON.stringify(out.shed2));
  record("קישור מקומי לא מגיע לסככה אחרת", !out.shed3, JSON.stringify(out.shed3));
  record("קישור מקומי לא נכנס לרשימת האדמין הכלל-טייסתית", !out.adminList, JSON.stringify(out.adminList));
  console.log("errs2",errs); await p.close();
}

// 3. מפקד יכול להסיר קישור מקומי שהוא עצמו הוסיף, אבל לא רואה כפתור מחיקה על חומר של אחראי ההדרכה
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.sGet = async ()=>[
      {id:"trainlink_1", title:"קישור של המפקד", ftype:"link", url:"https://x.com", by:"מפקד סככה 2", date:"1/1"},
      {id:"trainlink_2", title:"קישור של אחראי הדרכה", ftype:"link", url:"https://y.com", by:"אחראי הדרכה", date:"1/1"},
    ];
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-training').classList.add('active');
    isAdmin = false; userRole = "מפקד";
    await renderTrainingView();
    // שני הפריטים בלי שדה category -> נופלים לברירת המחדל "מצגות"
    const html = document.getElementById("training-view-list-presentations").innerHTML;
    return {
      hasDeleteForOwn: html.includes("removeLocalTrainingLink('trainlink_1')"),
      hasDeleteForAdmin: html.includes("removeLocalTrainingLink('trainlink_2')"),
    };
  });
  record("מפקד רואה כפתור מחיקה על קישור שהוא עצמו הוסיף",
    out.hasDeleteForOwn===true, JSON.stringify(out));
  record("מפקד לא רואה כפתור מחיקה על חומר שפורסם ע\"י אחראי ההדרכה",
    out.hasDeleteForAdmin===false, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. פתיחת פריט מסוג קישור פותחת חלון חדש ל-URL, בלי לנסות לקרוא קובץ (training_file_<id>)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.sGet = async (k)=>{
      if(k==="training_list") return [{id:"trainlink_1", title:"קישור", ftype:"link", url:"https://example.com/x"}];
      if(String(k).startsWith("training_file_")) throw new Error("לא היה אמור לנסות לקרוא קובץ לקישור!");
      return null;
    };
    let opened = null;
    window.open = (url)=>{ opened = url; return null; };
    await openTrainingItem("trainlink_1");
    return { opened };
  });
  record("פתיחת קישור: window.open נקרא עם ה-URL הנכון, בלי ניסיון לקרוא קובץ",
    out.opened==="https://example.com/x", JSON.stringify(out));
  console.log("errs4",errs); await p.close();
}

// 5. ולידציה: כותרת/קישור חסרים או לא תקינים נחסמים עם טוסט, לא נשמר כלום
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.toast = (m)=>{ window._t = window._t||[]; window._t.push(m); };
    window.sSetRaw = async ()=>{ throw new Error("לא היה אמור לשמור!"); };
    window.sSetIn = async ()=>{ throw new Error("לא היה אמור לשמור!"); };
    isAdmin = false; userRole = "מפקד"; currentShed = {id:"shed2"};
    document.getElementById("tl-title").value = "";
    document.getElementById("tl-url").value = "https://x.com";
    window._t = [];
    await saveTrainingLink();
    const noTitleErr = window._t.some(t=>t.includes("כותרת"));

    document.getElementById("tl-title").value = "כותרת";
    document.getElementById("tl-url").value = "https://[::1";   // IPv6 סוגר חסר — new URL() דוחה את זה גם בכרום
    window._t = [];
    await saveTrainingLink();
    const badUrlErr = window._t.some(t=>t.includes("לא תקין"));
    return { noTitleErr, badUrlErr };
  });
  record("בלי כותרת: טוסט שגיאה, לא נשמר", out.noTitleErr===true, JSON.stringify(out));
  record("URL לא תקין: טוסט שגיאה, לא נשמר", out.badUrlErr===true, JSON.stringify(out));
  console.log("errs5",errs); await p.close();
}

// 6. שתי קטגוריות (מצגות/הדרכות מצולמות): כל אחת נשמרת ומוצגת בקונטיינר שלה בלבד
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {};
    window.sGetRaw = async k => store[k] ?? null;
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    window.sGetIn = async (shed,k) => store[shed+"_"+k] ?? null;
    window.sSetIn = async (shed,k,v) => { store[shed+"_"+k]=v; return true; };
    window.sGet = async (k) => store[(currentShed?currentShed.id:"")+"_"+k] ?? null;
    window.sSet = async (k,v) => { store[(currentShed?currentShed.id:"")+"_"+k]=v; return true; };
    window.logAdminAction = async ()=>{};
    window.renderAdminTraining = ()=>{};
    window.renderTrainingView = ()=>{};
    isAdmin = true; currentShed = {id:"training", isTraining:true};

    openTrainingLinkAdd("recorded");
    const labelAfterOpen = document.getElementById("tl-category-label").textContent;
    document.getElementById("tl-title").value = "הדרכה מצולמת ראשונה";
    document.getElementById("tl-url").value = "https://example.com/rec1";
    await saveTrainingLink();

    openTrainingLinkAdd(); // בלי פרמטר -> ברירת מחדל "מצגות"
    document.getElementById("tl-title").value = "מצגת שנייה";
    document.getElementById("tl-url").value = "https://example.com/deck2";
    await saveTrainingLink();

    const list = store["admin_training"];
    return {
      labelAfterOpen,
      recordedItem: list.find(t=>t.title==="הדרכה מצולמת ראשונה"),
      presentationItem: list.find(t=>t.title==="מצגת שנייה"),
    };
  });
  record("openTrainingLinkAdd('recorded') מציג תווית הקטגוריה הנכונה",
    out.labelAfterOpen.includes("הדרכות מצולמות"), JSON.stringify(out.labelAfterOpen));
  record("קישור שנוסף עם קטגוריית 'recorded' נשמר עם category=recorded",
    out.recordedItem && out.recordedItem.category==="recorded", JSON.stringify(out.recordedItem));
  record("קישור שנוסף בלי קטגוריה (ברירת מחדל) נשמר כ-presentations",
    out.presentationItem && out.presentationItem.category==="presentations", JSON.stringify(out.presentationItem));
  console.log("errs6",errs); await p.close();
}

// 7. renderTrainingView/renderAdminTraining ממיינים כל פריט לקונטיינר הנכון לפי קטגוריה
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    window.sGet = async (k)=> k==="training_list" ? [
      {id:"t1", title:"מצגת ישנה (בלי category)", ftype:"link", url:"https://a.com", by:"אחראי הדרכה", date:"1/1"},
      {id:"t2", title:"סרטון הדרכה", ftype:"link", url:"https://b.com", category:"recorded", by:"אחראי הדרכה", date:"1/1"},
    ] : null;
    window.getTrainingList = async ()=> await window.sGet("training_list");
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-training').classList.add('active');
    isAdmin = false; userRole = "מפקד";
    await renderTrainingView();
    return {
      presentationsHtml: document.getElementById("training-view-list-presentations").innerHTML,
      recordedHtml: document.getElementById("training-view-list-recorded").innerHTML,
    };
  });
  record("פריט ישן בלי category מוצג תחת 'מצגות'",
    out.presentationsHtml.includes("מצגת ישנה"), JSON.stringify(out.presentationsHtml.slice(0,200)));
  record("פריט עם category=recorded לא מוצג תחת 'מצגות'",
    !out.presentationsHtml.includes("סרטון הדרכה"), JSON.stringify(out.presentationsHtml.slice(0,200)));
  record("פריט עם category=recorded מוצג תחת 'הדרכות מצולמות'",
    out.recordedHtml.includes("סרטון הדרכה"), JSON.stringify(out.recordedHtml.slice(0,200)));
  console.log("errs7",errs); await p.close();
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
