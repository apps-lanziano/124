/* באג: "כניסה בתור" (impersonateUser) הפעילה את מנגנון "זכירת מכשיר"
   הרגיל של doLogin, שרושם ל-localStorage {shedId,role,code,name} —
   אבל lastEnteredCode בזמן הכניסה-בתור הוא הקוד של מנהל-העל, לא של מי
   שנכנסים בתורו. כך המכשיר הנוכחי "זוכר" את מי שבתורו נכנסו, משויך
   בטעות לקוד הכניסה של מנהל-העל — מה שבמקרה הטוב מבלבל ובמקרה הרע
   שובר את ה"כניסה המהירה" הבאה. תוקן עם suppressDeviceRemember, חד-פעמי
   סביב doLogin() גם ב-impersonateUser וגם ב-exitImpersonation. */
import { newPage, loginAsSuperAdmin, closeBrowser } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
await loginAsSuperAdmin(page, "shed1");
await page.evaluate(() => go("scr-users", null));

const before = await page.evaluate(() => getDeviceUsers());
record("לפני כניסה-בתור: המכשיר זוכר רק את מנהל-העל עצמו (מהכניסה הרגילה שלו)",
  Array.isArray(before) && before.length===1 && before[0].name==="אלעד לנציאנו", JSON.stringify(before));

const result = await page.evaluate(async () => {
  const list = await sGetIn("shed1", "cfg_personnel");
  const target = list.find(p=>p.role==="חייל" && p.name!=="אלעד לנציאנו");
  Object.assign(target, await buildPinFields("9999"));
  await sSetIn("shed1", "cfg_personnel", list);

  await impersonateUser("shed1", target.name);
  const afterImpersonate = getDeviceUsers();

  await exitImpersonation();
  const afterExit = getDeviceUsers();

  return { targetName: target.name, afterImpersonate, afterExit, selfUser: user, selfIsSuperAdmin: isSuperAdmin };
});

record("אחרי כניסה-בתור: לא נוסף רישום שגוי בשם מי שנכנסו בתורו (עם קוד מנהל-העל)",
  Array.isArray(result.afterImpersonate) && result.afterImpersonate.length===1 && !result.afterImpersonate.some(d=>d.name===result.targetName),
  JSON.stringify(result.afterImpersonate));
record("אחרי יציאה מהכניסה-בתור: עדיין רק הרישום המקורי של מנהל-העל, וחוזרים לזהותו",
  Array.isArray(result.afterExit) && result.afterExit.length===1 && result.afterExit[0].name==="אלעד לנציאנו" && result.selfUser==="אלעד לנציאנו" && result.selfIsSuperAdmin===true,
  JSON.stringify(result));

record("אין שגיאות JS", pageErrors.length===0, JSON.stringify(pageErrors));

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await closeBrowser();
process.exit(allPass?0:1);
