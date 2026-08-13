/* בניית הגרסה הממוזערת (build/build.mjs) חייבת להצליח, והפלט חייב להיטען
   ולפעול בלי שגיאות (build/verify-dist.mjs). תופס מקרה שבו עריכה עתידית
   שוברת את המזעור לפני שהוא מגיע לייצור. אם terser/clean-css לא מותקנים
   בסביבה — מדלג בבטחה (עובר), כדי לא להכשיל סוויטה בלי תלויות הבנייה. */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

let haveTools = true;
try{ await import("terser"); await import("clean-css"); }catch{ haveTools = false; }

if(!haveTools){
  record("תלויות בנייה (terser/clean-css) לא מותקנות — מדלג", true, "skip");
} else {
  const build = spawnSync("node", [join(ROOT,"build","build.mjs")], {encoding:"utf8"});
  record("build/build.mjs רץ בהצלחה", build.status===0, (build.stderr||build.stdout||"").slice(-300));
  record("dist/index.html נוצר", existsSync(join(ROOT,"dist","index.html")), "");
  const verify = spawnSync("node", [join(ROOT,"build","verify-dist.mjs")], {encoding:"utf8"});
  record("הגרסה הממוזערת נטענת ופועלת (verify-dist)", verify.status===0, (verify.stdout||verify.stderr||"").slice(-300));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
