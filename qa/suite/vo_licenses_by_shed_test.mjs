/* מ״ע אחזקה — תצוגת רישיונות/הסמכות "לפי סככה": שמות מקובצים לפי מסגרת,
   כל שם נפתח בלחיצה ומציג את כל הרישיונות וההסמכות שלו (כמו הסמכות מקצועיות). */
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
  const past = "2020-01-01";
  const future = new Date(Date.now()+400*86400000).toISOString().slice(0,10);
  window.sGetRaw = async ()=>[
    {id:"l1", shedId:"shed1", person:"דני כהן", type:"רישיון C", expiry:future},
    {id:"l2", shedId:"shed1", person:"דני כהן", type:"מלגזה",   expiry:past},   // פג — הופך את דני לדחוף
    {id:"l3", shedId:"shed1", person:"רון לוי", type:"רישיון B", expiry:future},
    {id:"l4", shedId:"shed2", person:"עידן בר", type:"טרקטור",  expiry:future},
  ];
  window.sSetRaw = async ()=>true;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('scr-vehicle-officer').classList.add('active');
  document.getElementById('vopane-licenses').classList.add('active');
  // איפוס סינונים
  document.getElementById("vo-license-search").value = "";
  document.getElementById("vo-license-status-filter").value = "all";
  document.getElementById("vo-license-shed-filter").innerHTML = '<option value="all">הכל</option>';
  document.getElementById("vo-license-type-filter").innerHTML = '<option value="all">הכל</option>';
  document.getElementById("vo-license-group").value = "shed";
  await renderVoLicenses();

  const box = document.getElementById("vo-licenses-list");
  const r = {};
  // כותרות סככה קיימות
  const heads = [...box.querySelectorAll(".cmd-section-title")].map(e=>e.textContent);
  r.shedHeaders = heads.some(h=>h.includes("סככה 1")) && heads.some(h=>h.includes("סככה 2"));
  // כל שם הוא כרטיס נפתח
  const cards = [...box.querySelectorAll(".cert-sum-card")];
  r.oneCardPerName = cards.length===3;   // דני, רון, עידן (דני מאוחד לכרטיס אחד)
  // דני מאוחד: שני הרישיונות שלו בתוך אותו כרטיס (בהרחבה)
  const daniCard = cards.find(c=>c.querySelector(".cert-sum-name b")?.textContent==="דני כהן");
  const daniChips = daniCard ? [...daniCard.querySelectorAll(".cert-chip-name")].map(e=>e.textContent) : [];
  r.daniHasBothLicenses = daniChips.some(t=>t.includes("רישיון C")) && daniChips.some(t=>t.includes("מלגזה"));
  // הפירוט מקופל כברירת מחדל, ולחיצה פותחת
  r.collapsedByDefault = daniCard && !daniCard.classList.contains("open");
  daniCard.click();
  r.opensOnClick = daniCard.classList.contains("open");
  // דני מסומן דחוף (יש לו פג תוקף) — הכותרת שלו כוללת "יש פג תוקף"
  r.daniUrgent = daniCard.querySelector(".cert-sum-name span")?.textContent.includes("יש פג תוקף");

  // מעבר לתצוגת "לפי סוג" עדיין עובד
  document.getElementById("vo-license-group").value = "type";
  await renderVoLicenses();
  const typeHeads = [...box.querySelectorAll(".cmd-section-title")].map(e=>e.textContent);
  r.typeModeWorks = typeHeads.some(h=>h.includes("רישיון C")) && typeHeads.some(h=>h.includes("מלגזה"));

  return r;
});

record("תצוגה לפי סככה: כותרות לכל מסגרת", out.shedHeaders, String(out.shedHeaders));
record("כל שם = כרטיס אחד (רישיונות מרובים מאוחדים)", out.oneCardPerName, String(out.oneCardPerName));
record("בהרחבה: כל הרישיונות/הסמכות של האדם", out.daniHasBothLicenses, String(out.daniHasBothLicenses));
record("הפירוט מקופל כברירת מחדל", out.collapsedByDefault, String(out.collapsedByDefault));
record("לחיצה על השם פותחת את הפירוט", out.opensOnClick, String(out.opensOnClick));
record("שם עם רישיון שפג — מסומן דחוף", out.daniUrgent, String(out.daniUrgent));
record("מעבר חזרה לתצוגה לפי סוג עדיין עובד", out.typeModeWorks, String(out.typeModeWorks));

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
