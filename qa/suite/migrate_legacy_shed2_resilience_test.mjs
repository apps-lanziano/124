/* דיווח: "קיבלתי התראה על הודעה של ערב סגור בסככה 2 למרות שאף אחד לא הזין
   אותה". שורש הבעיה: migrateLegacyShed2() בדק את דגל "כבר היגרתי" עם קריאה
   בודדת שאין לה שום הגנה מפני כשל קריאה חולף (מרוץ טוקן/רשת) — בדיוק כמו
   ש-loadRuntimeLists כבר מתעד שקורה ל-cfg_personmel. כשל כזה גורם לפונקציה
   לחשוב "עוד לא היגרתי" ולהריץ מיגרציה שוב, שדורסת ללא תנאי את shed2_messages_list
   (וגם צוות/משימות/קרא-וחתום/לוחות/תקלות/תורנויות) בנתונים ישנים מהמפתחות
   הלא-מקודמים של v14 — כולל הודעות שכבר נמחקו מזמן. שני תיקונים: ניסיון חוזר
   + עצירה בטוחה על כשל מתמשך בבדיקת הדגל, והגנה נוספת שכל מפתח נכתב רק אם
   היעד עדיין ריק. */
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

// 1. כשל מתמשך בבדיקת הדגל -> עוצר בלי לגעת בשום נתון (לא דורס את ההודעות החיות)
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {
      "cfg_personnel": [{name:"ישן"}],
      "messages_list": [{id:"m_old", text:"ערב סגור"}],   // תוכן ישן ומחוק-בפועל
      "shed2_messages_list": [{id:"m_new", text:"הודעה נוכחית"}],   // תוכן חי בסככה 2 היום
    };
    window.sGetRaw = async (k) => {
      if(k==="shed2_migrated"){ fbReadFailed = true; return null; }   // כשל קריאה מתמשך על הדגל עצמו
      return store[k] ?? null;
    };
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    await migrateLegacyShed2();
    return { shed2Messages: store["shed2_messages_list"], migratedFlagWritten: "shed2_migrated" in store };
  });
  record("כשל מתמשך בדגל: לא נכתב שום דבר, ההודעות החיות של סככה 2 נשארות בדיוק כמו שהיו",
    JSON.stringify(out.shed2Messages)===JSON.stringify([{id:"m_new", text:"הודעה נוכחית"}]),
    JSON.stringify(out.shed2Messages));
  record("כשל מתמשך בדגל: לא מסמן את הדגל כ'הושלם' (כדי שינסה שוב בפעם הבאה)",
    out.migratedFlagWritten===false, JSON.stringify(out.migratedFlagWritten));
  console.log("errs1",errs); await p.close();
}

// 2. כשל חולף (2 נסיונות נכשלים, ה-3 מצליח ומחזיר true) -> מדלג על המיגרציה כרגיל, בלי לדרוס כלום
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = { "shed2_messages_list": [{id:"m_new", text:"הודעה נוכחית"}] };
    let attempts = 0;
    window.sGetRaw = async (k) => {
      if(k==="shed2_migrated"){
        attempts++;
        if(attempts<3){ fbReadFailed = true; return null; }
        fbReadFailed = false; return true;
      }
      fbReadFailed = false;
      return store[k] ?? null;
    };
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    await migrateLegacyShed2();
    return { attempts, shed2Messages: store["shed2_messages_list"] };
  });
  record("כשל חולף שהתגבר עליו הניסיון החוזר -> 3 ניסיונות, מזהה שכבר היגר, לא דורס",
    out.attempts===3 && JSON.stringify(out.shed2Messages)===JSON.stringify([{id:"m_new", text:"הודעה נוכחית"}]),
    JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. מיגרציה ראשונה אמיתית (הדגל באמת לא קיים, ואין עדיין נתונים בסככה 2) -> ההתנהגות המקורית נשמרת
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {
      "cfg_personnel": [{name:"ישן"}],
      "messages_list": [{id:"m_old", text:"הודעת יסוד"}],
      "safety_events": [], "boards_list": [], "faults_list": [],
      "cfg_tasks": [{id:"t1"}], "duty_table": {},
    };
    window.sGetRaw = async (k) => { fbReadFailed = false; return store[k] ?? null; };
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    await migrateLegacyShed2();
    return { shed2Messages: store["shed2_messages_list"], flag: store["shed2_migrated"] };
  });
  record("מיגרציה ראשונה אמיתית: מעתיקה כרגיל כשאין עדיין נתונים בסככה 2",
    out.shed2Messages && out.shed2Messages.some(m=>m.text==="הודעת יסוד") && out.flag===true,
    JSON.stringify(out));
  console.log("errs3",errs); await p.close();
}

// 4. הגנה נוספת (defense-in-depth): גם אם הדגל נעדר בטעות אבל ליעד כבר יש נתונים אמיתיים — לא נדרס
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const store = {
      "cfg_personnel": [{name:"ישן"}],
      "messages_list": [{id:"m_old", text:"ערב סגור"}],   // תוכן ישן
      "shed2_messages_list": [{id:"m_new", text:"הודעה חיה שנשמרה השבוע"}],   // כבר יש תוכן חי ביעד
      // שאר המפתחות ריקים בכוונה — כדי לוודא שההגנה פר-מפתח, לא גורפת
    };
    window.sGetRaw = async (k) => { fbReadFailed = false; return store[k] ?? null; };
    window.sSetRaw = async (k,v) => { store[k]=v; return true; };
    await migrateLegacyShed2();   // הדגל לא קיים כלל -> "מיגרציה ראשונה" מבחינת הפונקציה
    return { shed2Messages: store["shed2_messages_list"] };
  });
  record("הגנה פר-מפתח: יעד עם תוכן קיים לא נדרס גם כשהמיגרציה 'חושבת' שזו הפעם הראשונה",
    JSON.stringify(out.shed2Messages)===JSON.stringify([{id:"m_new", text:"הודעה חיה שנשמרה השבוע"}]),
    JSON.stringify(out.shed2Messages));
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
