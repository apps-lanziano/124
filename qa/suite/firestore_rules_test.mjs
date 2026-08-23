/* ============================================================
   בדיקות אוטומטיות ל-Firestore Security Rules — Firebase Emulator
   ------------------------------------------------------------
   בשונה משאר qa/suite (שרצות מול Firestore מדומה בזיכרון, ר'
   qa/lib/harness.mjs), הבדיקה הזו מריצה את ה-*חוקים האמיתיים* מתוך
   firestore.rules על Firestore Emulator אמיתי (firebase-tools + Java).
   המטרה: לוודא שתוקף חיצוני (בלי חשבון מאושר) לא יכול לקרוא/לכתוב/
   למחוק/לרשום (list) שום דבר, ושהרשאות authorized/role לא ניתנות
   לזיוף מהלקוח — ושרגרסיה עתידית בקובץ הכללים תיתפס אוטומטית.

   הרצה עצמאית:  node qa/suite/firestore_rules_test.mjs
   (הקובץ מפעיל את עצמו מחדש דרך `firebase emulators:exec`, כדי
   שה-emulator יעלה ויירד אוטומטית — בלי תהליכי Java יתומים.)
   ============================================================ */
import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { ensureJava21OrSkip } from "../lib/java_check.mjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PROJECT_ID = "demo-sq124-rules-test";

/* ---------- שכבה חיצונית: להעלות emulator ולהריץ את עצמנו מחדש בפנים ---------- */
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  const firebaseBin = join(ROOT, "node_modules", ".bin", "firebase");
  if (!existsSync(firebaseBin)) {
    console.error("❌ firebase-tools לא מותקן (node_modules/.bin/firebase חסר). הרץ: npm install");
    process.exit(1);
  }
  // ה-emulator רץ על Java; firebase-tools 15 דורש JDK 21+. בלי הבדיקה
  // הזו כשל *סביבה* היה מדווח בדוח היומי כ"🔴 חמור · בדיקה נכשלה",
  // כאילו יש רגרסיה בכללי האבטחה. ר' qa/lib/java_check.mjs.
  ensureJava21OrSkip("firestore_rules_test.mjs");
  const selfPath = fileURLToPath(import.meta.url);
  const res = spawnSync(
    firebaseBin,
    ["emulators:exec", "--only", "firestore", "--project", PROJECT_ID, `node "${selfPath}"`],
    { cwd: ROOT, stdio: "inherit", env: process.env },
  );
  process.exit(res.status === null ? 1 : res.status);
}

/* ---------- שכבה פנימית: רצה בתוך emulators:exec, מול emulator אמיתי ---------- */
const { initializeTestEnvironment, assertFails, assertSucceeds } = await import("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } = await import("firebase/firestore");

const rules = readFileSync(join(ROOT, "firestore.rules"), "utf8");
const [host, portStr] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const port = Number(portStr);

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules, host, port },
});

let pass = 0, fail = 0;
async function check(label, fn) {
  try {
    await fn();
    pass++;
    console.log(`✅ ${label}`);
  } catch (e) {
    fail++;
    console.log(`❌ ${label} — ${e && e.message || e}`);
  }
}

/* --- הקשרי-משתמש --- */
// לא מאומת בכלל (בלי session Firebase של שום סוג)
const anon = testEnv.unauthenticatedContext();
// מאומת (יש uid), אבל בלי claim authorized — בדיוק המצב של Firebase
// Anonymous Auth שמופעל אוטומטית בטעינת כל דף, לפני הקלדת קוד (ר'
// ההערה בראש firestore.rules — זו הייתה הפרצה שגרסה 3 סוגרת).
const authedNoClaim = testEnv.authenticatedContext("attacker-uid", {});
// claim מזויף-בעצם: token בלי authorized=true בכלל, גם אם יש role
// (מדמה ניסיון תקיפה שמנסה להתחזות ל-role בלי לעבור את markAuthorized)
const tamperedRoleOnly = testEnv.authenticatedContext("tamper-uid", { role: "מפקד" });
// authorized:false מפורש — Firestore token תמיד boolean אמיתי, לא מחרוזת/1
const explicitFalse = testEnv.authenticatedContext("false-uid", { authorized: false });
// authorized אמיתי, role רגיל (מוענק ע"י markAuthorized בצד השרת בלבד)
const soldier = testEnv.authenticatedContext("soldier-uid", { authorized: true, role: "חייל" });
// authorized אמיתי, role מפקד
const commander = testEnv.authenticatedContext("cmd-uid", { authorized: true, role: "מפקד" });

const NORMAL_DOC = "shed1_cfg_personnel";
const SENSITIVE_DOCS = ["admin_settings", "authprofile_abc123", "ai_quota_someuid"];
const GLOBAL_DOC = "board_roster";

// לזרוע מסמכים לבדיקות get/update/delete — עוקף rules (Admin SDK של ה-emulator)
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await db.doc(`sq124/${NORMAL_DOC}`).set({ v: { seed: true } });
  await db.doc(`sq124/${GLOBAL_DOC}`).set({ v: { seed: true } });
  for (const d of SENSITIVE_DOCS) await db.doc(`sq124/${d}`).set({ v: { seed: true } });
  await db.doc("other_collection/x").set({ v: 1 });
});

console.log("=== 1. תוקף אנונימי-לגמרי (בלי session Firebase כלל) ===");
await check("אנונימי: get DENY", () => assertFails(getDoc(doc(anon.firestore(), "sq124", NORMAL_DOC))));
await check("אנונימי: create DENY", () => assertFails(setDoc(doc(anon.firestore(), "sq124", "new_doc_1"), { v: 1 })));
await check("אנונימי: update DENY", () => assertFails(setDoc(doc(anon.firestore(), "sq124", NORMAL_DOC), { v: { hacked: true } }, { merge: true })));
await check("אנונימי: delete DENY", () => assertFails(deleteDoc(doc(anon.firestore(), "sq124", NORMAL_DOC))));
await check("אנונימי: list/query DENY", () => assertFails(getDocs(collection(anon.firestore(), "sq124"))));
await check("אנונימי: get מסמך רגיש DENY", () => assertFails(getDoc(doc(anon.firestore(), "sq124", SENSITIVE_DOCS[0]))));

console.log("=== 2. מאומת (Anonymous Auth) אך לא authorized — בדיוק פרצת ה-F12 שנסגרה ===");
await check("לא-authorized: get DENY", () => assertFails(getDoc(doc(authedNoClaim.firestore(), "sq124", NORMAL_DOC))));
await check("לא-authorized: write DENY", () => assertFails(setDoc(doc(authedNoClaim.firestore(), "sq124", "new_doc_2"), { v: 1 })));
await check("לא-authorized: delete DENY", () => assertFails(deleteDoc(doc(authedNoClaim.firestore(), "sq124", NORMAL_DOC))));
await check("לא-authorized: list DENY", () => assertFails(getDocs(collection(authedNoClaim.firestore(), "sq124"))));
await check("authorized=false מפורש: get DENY", () => assertFails(getDoc(doc(explicitFalse.firestore(), "sq124", NORMAL_DOC))));
await check("role בלי authorized: get DENY (role לבד לא מספיק)", () => assertFails(getDoc(doc(tamperedRoleOnly.firestore(), "sq124", NORMAL_DOC))));
await check("role בלי authorized: כתיבת מסמך רגיש DENY", () => assertFails(setDoc(doc(tamperedRoleOnly.firestore(), "sq124", SENSITIVE_DOCS[0]), { v: { hacked: true } })));

console.log("=== 3. authorized רגיל (חייל) — גישה רגילה, לא הרשאות מפקד ===");
await check("חייל: get מסמך רגיל ALLOW", () => assertSucceeds(getDoc(doc(soldier.firestore(), "sq124", NORMAL_DOC))));
await check("חייל: כתיבת מסמך רגיל ALLOW", () => assertSucceeds(setDoc(doc(soldier.firestore(), "sq124", NORMAL_DOC), { v: { seed: true, edited: true } })));
await check("חייל: list DENY (גם למאומת-מורשה)", () => assertFails(getDocs(collection(soldier.firestore(), "sq124"))));
await check("חייל: כתיבת מסמך רגיש DENY (admin_)", () => assertFails(setDoc(doc(soldier.firestore(), "sq124", SENSITIVE_DOCS[0]), { v: { hacked: true } })));
await check("חייל: מחיקת מסמך רגיש DENY (authprofile_)", () => assertFails(deleteDoc(doc(soldier.firestore(), "sq124", SENSITIVE_DOCS[1]))));
await check("חייל: יצירת מסמך רגיש חדש DENY (ai_quota_)", () => assertFails(setDoc(doc(soldier.firestore(), "sq124", "ai_quota_newuid"), { v: { count: 0 } })));

console.log("=== 4. authorized מפקד — הרשאות admin ===");
await check("מפקד: כתיבת מסמך רגיש ALLOW (admin_)", () => assertSucceeds(setDoc(doc(commander.firestore(), "sq124", SENSITIVE_DOCS[0]), { v: { updated: true } })));
await check("מפקד: מחיקת מסמך רגיש ALLOW (ai_quota_)", () => assertSucceeds(deleteDoc(doc(commander.firestore(), "sq124", SENSITIVE_DOCS[2]))));
await check("מפקד: list עדיין DENY (גם למפקד)", () => assertFails(getDocs(collection(commander.firestore(), "sq124"))));

console.log("=== 5. cross-resource — כל אוסף אחר חסום לגמרי, כולל למפקד ===");
await check("אוסף אחר: מפקד get DENY", () => assertFails(getDoc(doc(commander.firestore(), "other_collection", "x"))));
await check("אוסף אחר: מפקד write DENY", () => assertFails(setDoc(doc(commander.firestore(), "other_collection", "y"), { v: 1 })));
await check("אוסף אחר: אנונימי get DENY", () => assertFails(getDoc(doc(anon.firestore(), "other_collection", "x"))));

await testEnv.cleanup();

console.log("---------------------------------------------");
console.log(`עברו: ${pass} · נכשלו: ${fail}`);
if (fail > 0) {
  console.log("SOME TESTS FAILED");
  process.exit(1);
}
console.log("ALL TESTS PASSED");
