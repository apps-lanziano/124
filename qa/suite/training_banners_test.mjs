/* מסך "חומרי הדרכה" עוצב מחדש כבאנרים (בהשראת מרכז ההדרכה של טייסת 320):
   שני באנרים גדולים (מצגות / הדרכות מצולמות) עם אייקון, מונה פריטים,
   ולחיצה פותחת/סוגרת את רשימת החומרים של אותה קטגוריה (אקורדיון).
   בדיקה התנהגותית דרך ה-harness (נתוני הדגמה: פריט הדרכה אחד ללא
   category => נספר תחת "מצגות"). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "חייל");

const out = await page.evaluate(async ()=>{
  go("scr-training", null);
  await renderTrainingView();
  const q = s => document.querySelector(s);
  const bannerP = document.getElementById("tb-presentations");
  const bannerR = document.getElementById("tb-recorded");
  const listP = document.getElementById("training-view-list-presentations");
  const countP = document.getElementById("tb-count-presentations");
  const countR = document.getElementById("tb-count-recorded");
  const hasIconP = !!(bannerP && bannerP.querySelector(".tb-badge svg"));
  const hasIconR = !!(bannerR && bannerR.querySelector(".tb-badge svg"));

  // מצב התחלתי: שני הבאנרים מקופלים
  const collapsedStart = listP && !listP.classList.contains("open");
  // לחיצה פותחת את הרשימה של מצגות
  toggleTrainingCat("presentations");
  const openedAfterClick = listP.classList.contains("open") && bannerP.classList.contains("open");
  // לחיצה נוספת סוגרת
  toggleTrainingCat("presentations");
  const closedAfterSecond = !listP.classList.contains("open");

  return {
    banners: !!bannerP && !!bannerR,
    hasIconP, hasIconR,
    countPtxt: countP ? countP.textContent.trim() : null,
    countRtxt: countR ? countR.textContent.trim() : null,
    collapsedStart, openedAfterClick, closedAfterSecond,
  };
});

record("התחברות הצליחה", login.ok, JSON.stringify(login));
record("שני הבאנרים קיימים (מצגות + הדרכות מצולמות)", out.banners, JSON.stringify(out));
record("לכל באנר יש אייקון SVG בתג", out.hasIconP && out.hasIconR, JSON.stringify(out));
record("מונה הפריטים מוצג בבאנרים (מצגות=1 מנתוני ההדגמה)",
  /1/.test(out.countPtxt||"") && /פריט/.test(out.countPtxt||"") && /0/.test(out.countRtxt||""),
  JSON.stringify(out));
record("ברירת מחדל: הבאנרים מקופלים (בוחר קטגוריה)", out.collapsedStart, JSON.stringify(out));
record("לחיצה על באנר פותחת את רשימת הקטגוריה", out.openedAfterClick, JSON.stringify(out));
record("לחיצה נוספת סוגרת את הרשימה", out.closedAfterSecond, JSON.stringify(out));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
