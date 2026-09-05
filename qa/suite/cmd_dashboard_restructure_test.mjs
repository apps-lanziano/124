/* דשבורד המפקד (scr-cmd) איבד את הלשוניות "חתימות" ו"מטלות" — נשארו רק
   מגמות, בלי סרגל לשוניות בכלל. התוכן שהיה שם עבר: חתימות -> מסך קרא
   וחתום (scr-safety), מטלות -> מסך מטלות בוקר (scr-morning). בדיקה שכל
   התוכן שהיה קיים בפועל עדיין נגיש, רק במקום אחר — לא נעלם. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

async function loginAsCommander(){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  await p.evaluate(async ()=>{
    const store = {};
    window.storage = {
      async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
      async set(k,v){ store[k]=v; return true; },
      async delete(k){ delete store[k]; },
    };
    fbReady = false;
    window.callVerifyPin = async function(shedId, name, pin){
      const people = (typeof PERSONNEL !== "undefined" && PERSONNEL) || [];
      const person = people.find(p => p.name === name);
      if(!person || !person.pinHash) return {ok:true};
      const h = await hashPin(pin, person.pinSalt, person.pinIter || PIN_ITERATIONS);
      return {ok: h === person.pinHash};
    };
    const put = (k,v)=>{ store[k] = JSON.stringify(v); };
    put("shed2_cfg_personnel", [
      {name:"מפקד סככה 2", role:"מפקד", bday:"1995-01-01"},
      {name:"דני", role:"חייל", bday:"2003-01-01"},
    ]);
    put("shed2_safety_events", [{id:"ev1", title:"מסמך", by:"מפקד", date:"1.1", ftype:"image", thumb:""}]);
    put("shed2_sigs_מפקד_סככה_2", {ev1:{date:"1.1"}});
    put("shed2_cfg_tasks", []);
    window.initPush = async()=>{};
    const shed = {id:"shed2", name:"סככה 2"};
    await enterFrameworkAfterAuth(shed, "מפקד", "TEST");
    const person = PERSONNEL.find(p=>p.role==="מפקד");
    Object.assign(person, await buildPinFields("1234"));
    document.getElementById("login-select").value = person.name;
    onLoginNameChange();
    document.getElementById("login-pin").value = "1234";
    await doLogin();
  });
  return {p, errs};
}

// 1. scr-cmd: אין יותר סרגל לשוניות, ותוכן מגמות מוצג ישירות
{
  const {p, errs} = await loginAsCommander();
  const out = await p.evaluate(async ()=>{
    go("scr-cmd", null);
    await new Promise(r=>setTimeout(r,150));
    return {
      hasTabBar: !!document.querySelector("#scr-cmd .cmd-tabs"),
      hasTrendsContent: document.getElementById("trends-content").innerHTML.trim().length > 0,
      oldSafetyPaneGone: !document.getElementById("pane-safety"),
      oldMorningPaneGone: !document.getElementById("pane-morning"),
    };
  });
  record("scr-cmd: סרגל הלשוניות הוסר לגמרי",
    out.hasTabBar===false, JSON.stringify(out));
  record("scr-cmd: תוכן מגמות מוצג ישירות, בלי מעטפת לשונית",
    out.hasTrendsContent===true, JSON.stringify(out));
  record("scr-cmd: הלשוניות/פאנלים הישנים (חתימות/מטלות) לא קיימים יותר ב-DOM",
    out.oldSafetyPaneGone && out.oldMorningPaneGone, JSON.stringify(out));
  console.log("errs1",errs); await p.close();
}

// 2. scr-safety: מפקד רואה את סיכום החתימות (שהיה בלשונית "חתימות") ישירות כאן
{
  const {p, errs} = await loginAsCommander();
  const out = await p.evaluate(async ()=>{
    go("scr-safety", null);
    await new Promise(r=>setTimeout(r,150));
    return {
      summaryVisible: !document.getElementById("safety-cmd-summary").classList.contains("hidden"),
      kpiEvents: document.getElementById("kpi-events").textContent,
      kpiFullsign: document.getElementById("kpi-fullsign").textContent,
      cmdReadsHasContent: document.getElementById("cmd-reads").innerHTML.includes("מפקד סככה 2"),
    };
  });
  record("scr-safety: סיכום החתימות (KPI + טבלת אנשי צוות) גלוי למפקד",
    out.summaryVisible && out.kpiEvents==="1" && out.cmdReadsHasContent, JSON.stringify(out));
  console.log("errs2",errs); await p.close();
}

// 3. scr-morning: באנר סטטוס תלת-מצבי מוצג (היה בלשונית "מטלות")
{
  const {p, errs} = await loginAsCommander();
  const out = await p.evaluate(async ()=>{
    MORNING_TASKS = [{id:"t1", title:"בדיקה 1", desc:"תיאור"}, {id:"t2", title:"בדיקה 2", desc:"תיאור"}];
    go("scr-morning", null);
    await new Promise(r=>setTimeout(r,150));
    const noneBanner = document.getElementById("morning-alert").innerHTML;
    return { hasNoneBanner: noneBanner.includes("מטלות הבוקר טרם בוצעו") };
  });
  record("scr-morning: באנר 'טרם בוצעו' מוצג כשאין מטלות שהושלמו",
    out.hasNoneBanner, JSON.stringify(out));
  console.log("errs3",errs); await p.close();
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
