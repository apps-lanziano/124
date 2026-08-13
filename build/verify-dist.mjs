/* שער בטיחות לגרסה הממוזערת: טוען את dist/index.html בדפדפן אמיתי,
   מוודא שאין שגיאות ריצה, שהפונקציות המרכזיות קיימות, ושלוגיקת ליבה
   עובדת בפועל. נכשל (exit 1) אם המזעור שבר משהו — כדי שהפריסה תיעצר. */
import { chromium } from "playwright";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist", "index.html");
if(!existsSync(DIST)){ console.error("❌ dist/index.html לא נמצא — הרץ קודם build/build.mjs"); process.exit(1); }

const LOCAL_CHROME = "/opt/pw-browsers/chromium";
const b = await chromium.launch(existsSync(LOCAL_CHROME) ? { executablePath: LOCAL_CHROME } : {});
const p = await b.newPage();
await p.route("**gstatic.com/**", r=>r.abort());
await p.route("**googleapis.com/**", r=>r.abort());
await p.route("**fonts.googleapis.com/**", r=>r.abort());
const errs = []; p.on("pageerror", e=>errs.push(e.message));

await p.goto(pathToFileURL(DIST).href, { waitUntil:"domcontentloaded", timeout:60000 });
const res = await p.evaluate(()=>{
  const need = ["rosterBoardHtml","computeRosterCompliance","submitRequest","renderVoLicenses",
    "shareDailyDutyWA","saveDutyRosterV2","migrateRosterToV2","toolStatus","renderRosterView"];
  const missing = need.filter(n=>typeof window[n]!=="function");
  let behaviorOk = false;
  try{
    const roster = migrateRosterToV2(null);
    roster.days["חמישי"].manager="א"; roster.days["שישי"].manager="ב";
    const html = rosterBoardHtml(roster, "", "wide");
    behaviorOk = html.includes("א") && html.includes("ב")
      && toolStatus({expiry:"2020-01-01"}).cls==="r";
  }catch(e){ behaviorOk = "ERR:"+e.message; }
  return { missing, behaviorOk };
});
await b.close();

let ok = true;
if(errs.length){ console.error("❌ שגיאות ריצה בגרסה הממוזערת:", errs.slice(0,5).join(" | ")); ok=false; }
if(res.missing.length){ console.error("❌ פונקציות חסרות:", res.missing.join(", ")); ok=false; }
if(res.behaviorOk !== true){ console.error("❌ בדיקת התנהגות נכשלה:", res.behaviorOk); ok=false; }
if(ok) console.log("✅ הגרסה הממוזערת נטענת ופועלת תקין");
process.exit(ok?0:1);
