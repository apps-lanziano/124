/* ============================================================
   בדיקת רגרסיה: כשל *סביבה* לא מדווח כתקלה באפליקציה
   ------------------------------------------------------------
   רקע (באג אמיתי, דוח 2026-08-23): שתי בדיקות האבטחה שמריצות את
   כללי Firestore האמיתיים על Firebase Emulator (firestore_rules_test,
   red_team_firestore_rules_test) נכשלו על ה-runner של GitHub עם
   "firebase-tools no longer supports Java version before 21" — כי
   ה-runner מגיע עם Java 17 כברירת מחדל. הכללים עצמם היו תקינים
   לגמרי, אבל הדוח היומי הציג שני ממצאים "🔴 חמור · בדיקה נכשלה"
   עם זבל של קודי צבע מהטרמינל, כלומר התראת שווא שנראית כמו פרצה.

   מה נבדק כאן:
   1. בלי JDK 21 — הבדיקות מדלגות בבירור (QA_SKIP) ויוצאות בקוד 0,
      במקום להיכשל.
   2. עם QA_REQUIRE_EMULATOR=1 (CI) — דילוג הוא כשל קשה, כדי שבדיקת
      אבטחה לא "תעבור" בשקט בלי לרוץ בפועל.
   3. פלט תהליך שנכנס לדוח מנוקה מקודי צבע של הטרמינל.

   הרצה:  node qa/suite/qa_env_skip_test.mjs
   ============================================================ */
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, chmodSync, existsSync } from "fs";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { stripAnsi } from "../lib/report_util.mjs";
import { javaMajorVersion, SKIP_MARKER, MIN_JAVA } from "../lib/java_check.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

let pass = 0, fail = 0;
function check(label, cond, extra = "") {
  if (cond) { pass++; console.log(`✅ ${label}`); }
  else { fail++; console.log(`❌ ${label}${extra ? " — " + extra : ""}`); }
}

/* --- java מזויף שמדווח על גרסה ישנה, כדי לדמות את ה-runner --- */
function fakeJavaDir(versionLine) {
  const dir = mkdtempSync(join(tmpdir(), "fakejava-"));
  const bin = join(dir, "java");
  writeFileSync(bin, `#!/bin/sh\necho '${versionLine}' 1>&2\nexit 0\n`);
  chmodSync(bin, 0o755);
  return dir;
}

function runTestFile(file, env) {
  return spawnSync(process.execPath, [join(ROOT, "qa", "suite", file)], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env },
    timeout: 60000,
  });
}

const EMULATOR_TESTS = ["firestore_rules_test.mjs", "red_team_firestore_rules_test.mjs"];
const hasDeps = existsSync(join(ROOT, "node_modules", ".bin", "firebase"));

console.log("=== 1. זיהוי גרסת Java ===");
const oldJava = fakeJavaDir('openjdk version "17.0.9" 2023-10-17');
const res17 = spawnSync(process.execPath, ["-e",
  `import('${join(ROOT, "qa", "lib", "java_check.mjs").replace(/\\/g, "/")}')` +
  `.then(m=>console.log(String(m.javaMajorVersion())))`],
  { encoding: "utf8", env: { ...process.env, PATH: `${oldJava}:${process.env.PATH}` } });
check("java 17 מזוהה כ-17 (ולא כ'לא מותקן')", res17.stdout.trim() === "17", res17.stdout.trim());
check("MIN_JAVA הוא 21 (הדרישה של firebase-tools 15)", MIN_JAVA === 21, String(MIN_JAVA));
const realJava = javaMajorVersion();
check("javaMajorVersion מחזיר מספר או null בסביבה האמיתית",
  realJava === null || (Number.isInteger(realJava) && realJava > 0), String(realJava));

console.log("=== 2. בלי JDK 21: דילוג מסודר, לא כשל ===");
if (!hasDeps) {
  console.log("⏭️  node_modules חסר — מדלג על הרצת קבצי הבדיקה עצמם");
} else {
  for (const f of EMULATOR_TESTS) {
    const r = runTestFile(f, { PATH: `${oldJava}:${process.env.PATH}`, QA_REQUIRE_EMULATOR: "" });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    check(`${f}: יוצא בקוד 0 (דילוג, לא כשל)`, r.status === 0, `status=${r.status}`);
    check(`${f}: מסמן ${SKIP_MARKER} בפלט`, out.includes(`${SKIP_MARKER}:`), out.slice(0, 200));
    check(`${f}: לא מדפיס ❌ (שאותו הדוח סופר ככשל)`, !out.includes("❌"), out.slice(0, 200));
    check(`${f}: לא מריץ emulator בלי Java מתאימה`,
      !out.includes("emulators: Starting"), out.slice(0, 200));
  }

  console.log("=== 3. QA_REQUIRE_EMULATOR=1 (CI): דילוג הוא כשל קשה ===");
  for (const f of EMULATOR_TESTS) {
    const r = runTestFile(f, { PATH: `${oldJava}:${process.env.PATH}`, QA_REQUIRE_EMULATOR: "1" });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    check(`${f}: נכשל (קוד 1) כשהסביבה חייבת לתמוך ב-emulator`, r.status === 1, `status=${r.status}`);
    check(`${f}: לא מסמן דילוג במצב הזה`, !out.includes(`${SKIP_MARKER}:`), out.slice(0, 200));
  }
}

console.log("=== 4. פלט לדוח מנוקה מקודי צבע ===");
const ESC = String.fromCharCode(27);
const colored = `${ESC}[36m${ESC}[1mi  emulators:${ESC}[22m${ESC}[39m Shutting down emulators.`;
check("stripAnsi מסיר קודי צבע", stripAnsi(colored) === "i  emulators: Shutting down emulators.",
  JSON.stringify(stripAnsi(colored)));
check("stripAnsi לא הורס טקסט עברי רגיל",
  stripAnsi("בדיקה נכשלה: קובץ א") === "בדיקה נכשלה: קובץ א");
check("stripAnsi עמיד לקלט ריק/undefined", stripAnsi(undefined) === "" && stripAnsi(null) === "");

/* --- ההגנה עצמה: הדוח היומי חייב לדעת לזהות דילוג --- */
console.log("=== 5. הדוח היומי מסווג דילוג כהערה קלה, לא כ'בדיקה נכשלה' ===");
const runDaily = (await import("fs")).readFileSync(join(ROOT, "qa", "run_daily.mjs"), "utf8");
check("run_daily מזהה את סמן הדילוג", runDaily.includes("QA_SKIP"));
check("run_daily מדווח דילוג בחומרה נמוכה", /sev:"low"[\s\S]{0,200}לא רצה בסביבה/.test(runDaily));
check("run_daily מנקה קודי צבע לפני הדוח", runDaily.includes("stripAnsi"));

console.log("---------------------------------------------");
console.log(`עברו: ${pass} · נכשלו: ${fail}`);
if (fail > 0) { console.log("SOME TESTS FAILED"); process.exit(1); }
console.log("ALL TESTS PASSED");
