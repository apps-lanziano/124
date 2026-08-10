/* אירוע אמת: רשימת הצוות של סככה 2 הוחלפה ברשימה "עירומה" (שמות בלבד,
   0 PIN, 0 מפקד) — כל ה-PINים ורישום המפקדים אבדו. רשת הביטחון
   (personnelBlankOutGuard) חוסמת כתיבה כזו: אי אפשר להחליף רשימה שיש בה
   PINים/מפקדים ברשימה גדולה שאין בה אף אחד מהם. עריכות רגילות (שמשאירות
   לפחות PIN/מפקד אחד) עוברות כרגיל. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  const KEY = "shed1_cfg_personnel";
  const healthy = [
    {name:"מפקד א", role:"מפקד", pinHash:"h1"},
    {name:"חייל ב", role:"חייל", pinHash:"h2"},
    {name:"חייל ג", role:"חייל", pinHash:"h3"},
    {name:"חייל ד", role:"חייל", pinHash:"h4"},
  ];

  // 1) המצב הבריא נשמר בהצלחה
  r.healthySaved = await sSetRaw(KEY, healthy);

  // 2) האירוע: החלפה ברשימה עירומה (שמות בלבד) — חייבת להיחסם
  const bare = ["דני","רון","משה","יוסי","עידו"].map(n=>({name:n, role:"חייל", bday:"2000-01-01"}));
  const blockedRet = await sSetRaw(KEY, bare);
  const afterBlock = await sGetRaw(KEY);
  r.blockReturnedFalse = blockedRet === false;
  r.dataPreserved = Array.isArray(afterBlock) && afterBlock.length===4 && afterBlock.every(p=>p.pinHash);

  // 3) עריכה רגילה: הוספת חייל חדש (בלי PIN) — הרשימה עדיין מכילה PINים => עוברת
  const edited = healthy.concat([{name:"חייל חדש", role:"חייל", bday:"2000-01-01"}]);
  r.normalEditOk = await sSetRaw(KEY, edited);
  const afterEdit = await sGetRaw(KEY);
  r.editApplied = Array.isArray(afterEdit) && afterEdit.length===5;

  // 4) איפוס PIN של אדם בודד (עדיין נשארים PINים אחרים) — עובר
  const oneReset = afterEdit.map(p=> p.name==="חייל ב" ? {name:p.name, role:p.role} : p);
  r.singleResetOk = await sSetRaw(KEY, oneReset);

  // 5) מסגרת שממילא בלי PIN/מפקד (סככה חדשה) — כתיבה עירומה מותרת (אין מה לאבד)
  const KEY2 = "shed7test_cfg_personnel";
  await sSetRaw(KEY2, []);
  r.freshShedOk = await sSetRaw(KEY2, bare);

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("מצב בריא נשמר", out.healthySaved === true, String(out.healthySaved));
record("כתיבה עירומה שמוחקת PIN/מפקדים נחסמה (return false)", out.blockReturnedFalse, String(out.blockReturnedFalse));
record("הנתונים הקיימים נשמרו ולא נמחקו", out.dataPreserved, String(out.dataPreserved));
record("עריכה רגילה (הוספת חייל) עוברת", out.normalEditOk === true && out.editApplied, JSON.stringify(out));
record("איפוס PIN בודד (נשארים PINים) עובר", out.singleResetOk === true, String(out.singleResetOk));
record("מסגרת חדשה בלי PIN/מפקד — כתיבה מותרת", out.freshShedOk === true, String(out.freshShedOk));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
