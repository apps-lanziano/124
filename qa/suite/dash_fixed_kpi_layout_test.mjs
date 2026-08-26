/* "מדדים במבט אחד" — הפיצ'ר של התאמה אישית (⚙️ ניהול באנרים,
   dash_banners_pref) הוסר לגמרי לבקשת המשתמש: כל מפקד רואה תמיד את כל
   הבאנרים הישימים למסגרת שלו, בסדר קבוע אחיד — בקשות ממתינות, מטלות
   בוקר, תקלות, כשירות חיילים, כלים בחדר, רכבים. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");
const out = await page.evaluate(async ()=>{
  // מדמה מפקד שהיה לו פילטר שמור מהפיצ'ר הישן — לא אמור להשפיע יותר
  await sSet("dash_banners_pref", ["faults"]);
  go("scr-cmd", document.getElementById("nav-cmd"));
  await renderTrends();
  await new Promise(r=>setTimeout(r,80));
  const html = document.getElementById("trends-content").innerHTML;
  const labels = [...html.matchAll(/<div class="cd-kl">([^<]+)<\/div>/g)].map(m=>m[1]);
  return {
    labels,
    hasBannersBtn: html.includes("openDashBannersModal") || />\s*באנרים\s*</.test(html),
    hasFullScreenHint: html.includes("לחיצה = מסך מלא"),
    modalGone: !document.getElementById("dash-banners-modal"),
    fnsGone: typeof window.openDashBannersModal === "undefined" && typeof window.toggleDashBannerPref === "undefined",
  };
});
record("שישה הבאנרים מוצגים תמיד, בסדר הקבוע המבוקש", JSON.stringify(out.labels)===JSON.stringify(["בקשות ממתינות","מטלות בוקר","תקלות","כשירות חיילים","כלים בחדר","רכבים"]), JSON.stringify(out));
record("פילטר שמור מהפיצ'ר הישן (dash_banners_pref) לא משפיע יותר", out.labels.length===6, JSON.stringify(out));
record("כפתור \"⚙️ ניהול באנרים\" הוסר", !out.hasBannersBtn, JSON.stringify(out));
record("הבאדג' \"לחיצה = מסך מלא\" מוצג במקומו לכולם", out.hasFullScreenHint, JSON.stringify(out));
record("מודל ניהול הבאנרים הוסר מה-DOM", out.modalGone, JSON.stringify(out));
record("פונקציות ניהול הבאנרים הוסרו מהקוד", out.fnsGone, JSON.stringify(out));
record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));

await closeBrowser();

const fails = results.filter(r=>!r.pass);
for(const r of results) console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
if(fails.length){ console.log(`\n${fails.length}/${results.length} נכשלו`); process.exit(1); }
console.log(`\nכל ${results.length} הבדיקות עברו`);
