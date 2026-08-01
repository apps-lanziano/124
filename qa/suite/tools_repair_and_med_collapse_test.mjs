/* שני שיפורים שהתבקשו יחד:
   1. כלי בחדר-כלים שסומן "בתיקון" — לא נחשב פער, לא מתריע ולא מופיע במיקוד היום,
      גם אם תוקף הכיול שלו כבר פג.
   2. פערי שמיעה/מטווח לא נסגרים ברמה יומית (תיאום מרפאה לוקח זמן) — לכן מרוכזים
      בשורה אחת לכל סוג בדיקה במיקוד היום, במקום שורה נפרדת לכל חייל. */
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
  const store = {};
  window.storage = {
    async get(k){ return store[k]!==undefined ? {value:store[k]} : null; },
    async set(k,v){ store[k]=v; return true; },
    async delete(k){ delete store[k]; },
  };
  fbReady = false;
  window.confirm = ()=>true; window.toast = ()=>{};

  currentShed = {id:"shed1", name:"סככה 1"}; user="מפקד"; userRole="מפקד"; isAdmin=false;
  PERSONNEL = [
    {name:"דני", role:"חייל"}, {name:"רון", role:"חייל"}, {name:"עידן", role:"חייל"},
  ];
  MORNING_TASKS = [];

  const past = "2020-01-01"; // בעבר הרחוק — ודאי פג תוקף

  // --- כלי 1: תוקף פג, אבל מסומן "בתיקון" ---
  const tools = [
    {id:"t1", name:"מפתח מומנט", serial:"111", expiry:past, inRepair:true},
    {id:"t2", name:"מד לחץ", serial:"222", expiry:past, inRepair:false},
  ];
  const toolStatuses = tools.map(t=>toolStatus(t));
  await sSet("tools_list", tools);

  // --- שמיעה/מטווח: 3 חיילים עם פ.ת פג לבדיקת שמיעה, אחד עם מטווח בקרוב ---
  const medchecks = {
    "דני":   { hearing: {expiry: past} },
    "רון":   { hearing: {expiry: past} },
    "עידן":  { hearing: {expiry: past}, range: {expiry: new Date(Date.now()+5*86400000).toISOString().slice(0,10)} },
  };
  await sSet("medchecks", medchecks);

  const alertsBefore = await computeAlerts();

  await renderTrends();
  const focusHtml = document.getElementById("trends-content").innerHTML;
  const focusRows = [...document.querySelectorAll("#trends-content .cd-ev-txt b")].map(e=>e.textContent);

  return {
    toolStatuses,
    toolAlertPresent: alertsBefore.some(a=>a.text && a.text.includes("מד לחץ")),
    repairedToolAlertPresent: alertsBefore.some(a=>a.text && a.text.includes("מפתח מומנט")),
    focusRows,
    focusHasRepairedTool: focusRows.some(t=>t.includes("מפתח מומנט")),
    focusHasBrokenTool: focusRows.some(t=>t.includes("מד לחץ")),
    focusHasPerPersonHearing: focusRows.some(t=>t.includes("דני") || t.includes("רון")),
    focusHearingAggRow: focusRows.find(t=>t.includes("בדיקת שמיעה")),
  };
});

record("toolStatus: כלי בתיקון מקבל תג ניטרלי גם עם תוקף שפג",
  out.toolStatuses[0].cls==="n" && out.toolStatuses[0].tag.includes("בתיקון"),
  JSON.stringify(out.toolStatuses[0]));
record("toolStatus: כלי רגיל עם תוקף שפג עדיין מסומן אדום",
  out.toolStatuses[1].cls==="r", JSON.stringify(out.toolStatuses[1]));
record("פעמון התראות: כלי רגיל שפג תוקפו כן מתריע",
  out.toolAlertPresent, String(out.toolAlertPresent));
record("פעמון התראות: כלי שסומן בתיקון לא מתריע",
  !out.repairedToolAlertPresent, String(out.repairedToolAlertPresent));
record("מיקוד יומי: כלי שסומן בתיקון לא מופיע ברשימה",
  !out.focusHasRepairedTool, JSON.stringify(out.focusRows));
record("מיקוד יומי: כלי רגיל שפג תוקפו כן מופיע",
  out.focusHasBrokenTool, JSON.stringify(out.focusRows));
record("מיקוד יומי: אין שורה נפרדת לכל חייל עם פער שמיעה",
  !out.focusHasPerPersonHearing, JSON.stringify(out.focusRows));
record("מיקוד יומי: יש שורה אחת מרוכזת לבדיקת שמיעה עם מספר החיילים",
  !!out.focusHearingAggRow && /\d+\s*חיילים/.test(out.focusHearingAggRow),
  String(out.focusHearingAggRow));

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
