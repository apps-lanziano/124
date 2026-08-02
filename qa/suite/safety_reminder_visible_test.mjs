/* "תזכורת למי שלא חתם" הייתה נגישה רק דרך מסלול חבוי: דשבורד המפקד ->
   לחיצה על שורת פריט -> מודל פרטי חתימה -> כפתור. עכשיו מוצג ישירות במסך
   "קרא וחתום" עצמו, לכל פריט שלא נחתם במלואו. תיקון נלווה: showSigDetail
   הסתמך על cmdEventsCache שמתמלא רק ע"י ביקור קודם בדשבורד — אם מפקד
   מגיע ישר למסך קרא-וחתום (בלי לעבור שם קודם) הכפתור היה נכשל בשקט. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

async function setup(role, personIndex=0){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  const out = await p.evaluate(async ({role, personIndex})=>{
    const store = {};
    window.storage = {
      async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
      async set(k,v){ store[k]=v; return true; },
      async delete(k){ delete store[k]; },
    };
    fbReady = false;
    const put = (k,v)=>{ store[k] = JSON.stringify(v); };
    put("shed2_cfg_personnel", [
      {name:"מפקד סככה 2", role:"מפקד", bday:"1995-01-01"},
      {name:"דני", role:"חייל", bday:"2003-01-01"},
      {name:"רון", role:"חייל", bday:"2003-01-01"},
    ]);
    // פריט 1: מפקד+דני חתמו, רון לא — לא הושלם
    // פריט 2: כולם חתמו — הושלם
    put("shed2_safety_events", [
      {id:"ev1", title:"מסמך פתוח", by:"מפקד", date:"1.1", ftype:"image", thumb:""},
      {id:"ev2", title:"מסמך סגור", by:"מפקד", date:"1.1", ftype:"image", thumb:""},
    ]);
    put("shed2_sigs_מפקד_סככה_2", {ev1:{date:"1.1"}, ev2:{date:"1.1"}});
    put("shed2_sigs_דני", {ev1:{date:"1.1"}, ev2:{date:"1.1"}});
    put("shed2_sigs_רון", {ev2:{date:"1.1"}});   // רון לא חתם על ev1

    window.initPush = async()=>{};
    const shed = {id:"shed2", name:"סככה 2"};
    await enterFrameworkAfterAuth(shed, role, "TEST");
    const people = PERSONNEL.filter(p=>p.role===role);
    const person = people[personIndex];
    Object.assign(person, await buildPinFields("1234"));
    document.getElementById("login-select").value = person.name;
    onLoginNameChange();
    document.getElementById("login-pin").value = "1234";
    await doLogin();
    // חשוב: לא מבקרים ב-scr-cmd בכלל — מדמה מפקד שמגיע ישר למסך קרא-וחתום,
    // כדי לוודא ש-cmdEventsCache הריק לא שובר את הכפתור.
    go("scr-safety", document.querySelector('[data-scr="scr-safety"]'));
    await new Promise(r=>setTimeout(r, 150));
    return { loggedIn: document.getElementById("login-overlay").style.display==="none" };
  }, {role, personIndex});
  return { p, errs, out };
}

// 1. מפקד: רואה תג "X/Y חתמו" וכפתור תזכורת רק על הפריט שלא הושלם
{
  const { p, errs, out } = await setup("מפקד");
  const cards = await p.evaluate(()=>{
    return [...document.querySelectorAll("#docs-list .doc-item")].map(el=>({
      title: el.querySelector("h3")?.textContent,
      pill: el.querySelector(".pill")?.textContent,
      hasReminderBtn: [...el.querySelectorAll("button")].some(b=>b.textContent.includes("תזכורת")),
    }));
  });
  const open = cards.find(c=>c.title==="מסמך פתוח");
  const closed = cards.find(c=>c.title==="מסמך סגור");
  record("מפקד רואה תג חתימות על פריט פתוח (2/3 חתמו) וכפתור תזכורת",
    out.loggedIn && open && open.pill.includes("2/3") && open.hasReminderBtn===true,
    JSON.stringify({open, cardsFound: cards.length}));
  record("פריט שהושלם במלואו (3/3) לא מציג כפתור תזכורת",
    closed && closed.pill.includes("3/3") && closed.hasReminderBtn===false,
    JSON.stringify(closed));
  console.log("errs-cmd", errs); await p.close();
}

// 2. לחיצה על כפתור התזכורת מגיע ישר מ-scr-safety (בלי ביקור קודם ב-scr-cmd)
//    פותחת בפועל את מודל פרטי החתימה — זה בדיוק המסלול שהיה נכשל בשקט
{
  const { p, errs } = await setup("מפקד");
  const out = await p.evaluate(async ()=>{
    const card = [...document.querySelectorAll("#docs-list .doc-item")]
      .find(el=>el.querySelector("h3")?.textContent==="מסמך פתוח");
    const btn = [...card.querySelectorAll("button")].find(b=>b.textContent.includes("תזכורת"));
    btn.click();
    await new Promise(r=>setTimeout(r, 150));
    return {
      modalOpen: document.getElementById("sigdetail-modal").classList.contains("open"),
      readerNotTriggered: currentDoc === null,
      subText: document.getElementById("sigdetail-sub").textContent,
    };
  });
  record("כפתור התזכורת פותח את מודל פרטי החתימה גם בלי ביקור קודם בדשבורד (cmdEventsCache ריק)",
    out.modalOpen && out.subText.includes("2/3"), JSON.stringify(out));
  record("הלחיצה על כפתור התזכורת לא הפעילה בטעות את פתיחת הקורא (stopPropagation)",
    out.readerNotTriggered, JSON.stringify(out));
  console.log("errs-click", errs); await p.close();
}

// 3. חייל רגיל לא רואה שום תג חתימות/כפתור תזכורת (זה מידע-מפקד בלבד)
{
  const { p, errs, out } = await setup("חייל", 0);
  const hasAnyPill = await p.evaluate(()=>!!document.querySelector("#docs-list .pill"));
  record("חייל רגיל לא רואה תגי חתימות/תזכורת של אחרים",
    out.loggedIn && hasAnyPill===false, String(hasAnyPill));
  console.log("errs-soldier", errs); await p.close();
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
