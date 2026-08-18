/* מערכת אייקונים v2: החלפת אימוג'י ב-SVG, שיוך למשפחת צבע, מצב active
   מלא/ריק בסרגל, וכיבוי מלא ע"י הדגל ICONS_V2. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(()=>{
  const r = {};
  r.flagOn      = (typeof ICONS_V2 !== "undefined") && ICONS_V2 === true;
  r.bodyClass   = document.body.classList.contains("icons-v2");
  r.spriteBuilt = document.querySelectorAll("#ic-sprite symbol").length > 40;

  const holders = [...document.querySelectorAll(".ic,.s-ic")];
  r.swapped   = holders.filter(e => e.getAttribute("data-icv")).length;
  // לא נשאר אף אימוג'י שהמפה מכירה אך לא הוחלף
  r.noLeftover = holders.every(e => e.getAttribute("data-icv") || !/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}]/u.test(e.textContent||""));
  // בכל מחזיק בדיוק SVG אחד גלוי — מונע הצגה כפולה של קו+מילוי
  r.oneVisible = holders.filter(e => e.getAttribute("data-icv"))
    .every(e => [...e.querySelectorAll("svg")].filter(s => getComputedStyle(s).display !== "none").length === 1);
  // כל אייקון שהוחלף קיבל מחלקת משפחה
  r.familyTagged = holders.filter(e => e.getAttribute("data-icv"))
    .every(e => /\bi-(cmd|task|alert|logi|info|people|none)\b/.test(e.className));

  // סרגל תחתון: לא-פעיל = קו, פעיל = מילוי (או קו מעובה לסמלים פתוחים)
  const nav = document.getElementById("nav-board");
  document.querySelectorAll("nav .nav-btn").forEach(b => b.classList.remove("active"));
  nav.classList.remove("hidden");
  const ic = nav.querySelector(".ic");
  r.idleOutline = getComputedStyle(ic.querySelector(".ico-o")).display !== "none";
  nav.classList.add("active");
  const f = ic.querySelector(".ico-f");
  r.activeFilled = f ? getComputedStyle(f).display !== "none"
                     : getComputedStyle(ic.querySelector(".ico-o")).strokeWidth === "2.5px";
  // הפעיל נצבע בגוון המשפחה ולא באפור הלא-פעיל
  const idleInk = getComputedStyle(document.documentElement).getPropertyValue("--ic-idle").trim();
  r.activeColored = getComputedStyle(ic).color !== idleInk;

  // הסרת האריח הצבעוני מרשימת "עוד"
  const sIc = document.querySelector(".sheet-item .s-ic");
  r.noTile = sIc ? getComputedStyle(sIc).backgroundImage === "none"
                   && ["rgba(0, 0, 0, 0)","transparent"].includes(getComputedStyle(sIc).backgroundColor)
                 : false;
  return r;
});

record("הדגל ICONS_V2 דלוק", out.flagOn, String(out.flagOn));
record("body קיבל icons-v2", out.bodyClass, String(out.bodyClass));
record("sprite נבנה (>40 סמלים)", out.spriteBuilt, String(out.spriteBuilt));
record("אימוג'ים הוחלפו ב-SVG", out.swapped > 20, `${out.swapped} הוחלפו`);
record("לא נשאר אימוג'י מוכר ללא החלפה", out.noLeftover, String(out.noLeftover));
record("SVG אחד גלוי בכל אייקון", out.oneVisible, String(out.oneVisible));
record("כל אייקון שויך למשפחת צבע", out.familyTagged, String(out.familyTagged));
record("סרגל: לא-פעיל = קו", out.idleOutline, String(out.idleOutline));
record("סרגל: פעיל = מילוי/קו מעובה", out.activeFilled, String(out.activeFilled));
record("סרגל: הפעיל נצבע בגוון המשפחה", out.activeColored, String(out.activeColored));
record("רשימת 'עוד' בלי אריח צבעוני", out.noTile, String(out.noTile));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
