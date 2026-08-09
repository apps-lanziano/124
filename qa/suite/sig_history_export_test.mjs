/* בקשת אחראי ההדרכה: תיעוד היסטורי של קרא-וחתום לסיקור (הייצוא הקודם
   כתמונה נכשל כי הוא נשען על html2canvas מ-CDN שנחסם ב-PWA). הפתרון:
   openSigHistory בונה טקסט פשוט — לכל נושא, מי ביצע (שמות + תאריך) לפי
   מסגרת — להצגה/העתקה/שמירה כקובץ טקסט, בלי שום תלות ברשת/CDN.
   בדיקה: לוגיקת buildSigHistoryText הטהורה + הרצה מלאה דרך ה-harness. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  // מסמנים שחייל אחד ביצע את הקרא-וחתום שנזרע (ev_seed_1) בסככה 1
  await sSetIn("shed1", "sigs_" + safeName("חייל א סככה 1"), { ev_seed_1: { date: "5.8.2026", read: true } });

  // 1) לוגיקה טהורה: מבנה נתונים מינימלי -> טקסט
  const pureData = {
    adminItems: [{ id:"x1", title:"נוהל בטיחות", date:"1.1.2026" }],
    perShed: [{
      shed:{id:"shed1", name:"סככה 1"},
      personnel:[{name:"דני"},{name:"רון"}],
      eventIds:new Set(["x1"]),
      sigsBy:{ "דני":{ x1:{date:"2.1.2026",read:true} }, "רון":{} },
    }],
  };
  const pureText = buildSigHistoryText(pureData, {at:"עכשיו", by:"אחראי הדרכה"});

  // 2) הרצה מלאה דרך openSigHistory (computeAdminSigLog אמיתי על נתוני ההדגמה)
  await openSigHistory();
  const modalOpen = document.getElementById("sig-history-modal").classList.contains("open");
  const fullText = document.getElementById("sig-history-text").value;

  return { pureText, fullText, modalOpen };
});

record("התחברות הצליחה", login.ok, JSON.stringify(login));
record("לוגיקה טהורה: הנושא מופיע בטקסט", out.pureText.includes("נוהל בטיחות"), out.pureText.slice(0,120));
record("לוגיקה טהורה: מי שביצע (דני) מופיע עם תאריך", out.pureText.includes("דני") && out.pureText.includes("2.1.2026"), out.pureText);
record("לוגיקה טהורה: מי שלא ביצע (רון) מופיע תחת \"טרם ביצעו\"", /טרם ביצעו:.*רון/.test(out.pureText), out.pureText);
record("המודל נפתח בהרצה מלאה", out.modalOpen, String(out.modalOpen));
record("הרצה מלאה: הנושא שנזרע מופיע", out.fullText.includes("תדריך בטיחות לדוגמה"), out.fullText.slice(0,200));
record("הרצה מלאה: מי שביצע (חייל א סככה 1) מופיע עם התאריך שסומן", out.fullText.includes("חייל א סככה 1") && out.fullText.includes("5.8.2026"), out.fullText.slice(0,400));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
