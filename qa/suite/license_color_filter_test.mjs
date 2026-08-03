/* מ״ע אחזקה בקשות 6+7: מעקב רישיונות (דומה להסמכות המקצועיות), צבע לכל
   רישיון/הסמכה, וסינון לפי שם/סככה/הסמכה. הצבע לא מוטבע במחרוזת ה-type
   השמורה (בניגוד ל-CERT_BANK_DEFAULT) — כדי לא לפצל רישיונות קיימים
   מרישיונות חדשים מאותו סוג ב-vo_licenses_list. */
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

// 1. לכל פריט במאגר הקבוע יש צבע (לא ברירת המחדל הגנרית)
{
  const out = await p.evaluate(()=>{
    return LICENSE_BANK_DEFAULT.map(t=>({t, emoji:licenseTypeEmoji(t)}));
  });
  record("לכל רישיון/הסמכה במאגר הקבוע יש צבע ספציפי (לא 🪪 הגנרי)",
    out.every(x=>x.emoji!=="🪪"), JSON.stringify(out));
}

// 2. סוג שלא במאגר מקבל את ברירת המחדל הגנרית, לא קורס
{
  const out = await p.evaluate(()=> licenseTypeEmoji("סוג מומצא לבדיקה"));
  record("סוג לא מוכר מקבל אימוג'י ברירת מחדל גנרי", out==="🪪", out);
}

// 3. הצבע לא מוטבע במחרוזת ה-type השמורה — רישיון שכבר קיים בלי קידומת ממשיך לעבוד
{
  const out = await p.evaluate(async ()=>{
    window.sGetRaw = async ()=>[
      {id:"l1", shedId:"shed1", person:"דני", type:"רישיון B", expiry:""},   // ישן, בלי קידומת
    ];
    window.sSetRaw = async ()=>true;
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('scr-vehicle-officer').classList.add('active');
    document.getElementById('vopane-licenses').classList.add('active');
    await renderVoLicenses();
    const html = document.getElementById("vo-licenses-list").innerHTML;
    return { html, hasGroupHeader: html.includes("רישיון B"), hasColorInHeader: html.includes("🟢") };
  });
  record("רישיון ישן (type בלי קידומת אימוג'י) מוצג ומקבל את הצבע הנכון בכותרת הקבוצה",
    out.hasGroupHeader && out.hasColorInHeader, out.html.slice(0,300));
  console.log("errs1",errs);
}

// 4. סינון לפי סוג רישיון/הסמכה: קיים ב-DOM, מתמלא מהנתונים בפועל, ומסנן נכון
{
  const out = await p.evaluate(async ()=>{
    window.sGetRaw = async ()=>[
      {id:"l1", shedId:"shed1", person:"דני", type:"רישיון B", expiry:""},
      {id:"l2", shedId:"shed2", person:"רון", type:"מלגזה", expiry:""},
    ];
    window.sSetRaw = async ()=>true;
    document.getElementById("vo-license-search").value = "";
    document.getElementById("vo-license-status-filter").value = "all";
    document.getElementById("vo-license-shed-filter").innerHTML = '<option value="all">הכל</option>';
    document.getElementById("vo-license-type-filter").innerHTML = '<option value="all">הכל</option>';
    await renderVoLicenses();
    const typeSel = document.getElementById("vo-license-type-filter");
    const options = [...typeSel.options].map(o=>o.value);

    typeSel.value = "מלגזה";
    await renderVoLicenses();
    const htmlFiltered = document.getElementById("vo-licenses-list").innerHTML;
    return { options, htmlFiltered, hasDani: htmlFiltered.includes("דני"), hasRon: htmlFiltered.includes("רון") };
  });
  record("סינון-לפי-סוג: הדרופדאון מתמלא מהנתונים בפועל (all + שני הסוגים)",
    out.options.includes("all") && out.options.includes("מלגזה") && out.options.includes("רישיון B"),
    JSON.stringify(out.options));
  record("סינון-לפי-סוג: בחירת 'מלגזה' מציגה רק את רון, לא את דני",
    out.hasRon && !out.hasDani, JSON.stringify({hasDani:out.hasDani, hasRon:out.hasRon}));
  console.log("errs2",errs);
}

// 5. סינון לפי שם וסככה עדיין עובד (רגרסיה — כבר היה קיים)
{
  const out = await p.evaluate(async ()=>{
    window.sGetRaw = async ()=>[
      {id:"l1", shedId:"shed1", person:"דני", type:"רישיון B", expiry:""},
      {id:"l2", shedId:"shed2", person:"רון", type:"רישיון B", expiry:""},
    ];
    window.sSetRaw = async ()=>true;
    document.getElementById("vo-license-search").value = "דני";
    document.getElementById("vo-license-status-filter").value = "all";
    document.getElementById("vo-license-shed-filter").innerHTML = '<option value="all">הכל</option><option value="shed1">סככה 1</option><option value="shed2">סככה 2</option>';
    document.getElementById("vo-license-shed-filter").value = "all";
    document.getElementById("vo-license-type-filter").innerHTML = '<option value="all">הכל</option>';
    await renderVoLicenses();
    const byName = document.getElementById("vo-licenses-list").innerHTML;
    document.getElementById("vo-license-search").value = "";
    document.getElementById("vo-license-shed-filter").value = "shed2";
    await renderVoLicenses();
    const byShed = document.getElementById("vo-licenses-list").innerHTML;
    return {
      byNameHasDani: byName.includes("דני"), byNameHasRon: byName.includes("רון"),
      byShedHasDani: byShed.includes("דני"), byShedHasRon: byShed.includes("רון"),
    };
  });
  record("סינון לפי שם: מציג רק את דני", out.byNameHasDani && !out.byNameHasRon, JSON.stringify(out));
  record("סינון לפי סככה: מציג רק את רון (סככה 2)", out.byShedHasRon && !out.byShedHasDani, JSON.stringify(out));
  console.log("errs3",errs);
}

// 6. licenseBankOptions: הערך (value) נשאר המחרוזת המקורית בלי קידומת — רק הטקסט המוצג צבעוני
{
  const out = await p.evaluate(()=>{
    const html = licenseBankOptions();
    const div = document.createElement("div"); div.innerHTML = html;
    const opt = [...div.querySelectorAll("option")].find(o=>o.textContent.includes("רישיון B"));
    return { value: opt ? opt.value : null, text: opt ? opt.textContent : null };
  });
  record("בורר המאגר: הערך הנשמר הוא 'רישיון B' נקי (בלי אימוג'י), הטקסט המוצג צבעוני",
    out.value==="רישיון B" && out.text.includes("🟢"), JSON.stringify(out));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await p.close();
await b.close();
process.exit(allPass?0:1);
