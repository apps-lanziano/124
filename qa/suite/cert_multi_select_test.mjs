/* הוספת הסמכה — בחירה מרובה של חיילים: מודל "cert-modal" (openCertAdd/addCert)
   הוחלף מ-<select> יחיד ל-checklist מרובה-בחירה (cert-person-list), כדי שמפקד
   שרוצה להעניק אותה הסמכה לכמה חיילים בבת אחת לא יצטרך לפתוח את המודל שוב
   לכל חייל. הבדיקות כאן מוודאות: הרשימה מציגה את כל אנשי הצוות (למעט מילואים),
   לחיצה על שורה מסמנת/מבטלת בחירה, "בחר הכל / נקה" עובד, addCert() מוסיף
   את ההסמכה לכל מי שנבחר (לא רק לאחד), ומגבלות הסמכות-מפקדים/חיילים-בלבד
   עדיין מסננות את הרשימה כמו קודם. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // הסיד מכיל חייל לא-מילואים אחד בלבד בכל סככה — מוסיפים חייל שני בזיכרון
  // (בלי צורך לשמור לאחסון) כדי לבדוק בחירה מרובה אמיתית של שני אנשים.
  if(!PERSONNEL.some(p=>p.name==="חייל ג בדיקה")){
    PERSONNEL.push({name:"חייל ג בדיקה", role:"חייל", bday:"2004-01-01", joined: todayKey()});
  }

  openCertAdd();
  const rowsInitial = document.querySelectorAll("#cert-person-list .cert-pick-row").length;
  r.listShowsAllNonReserve = rowsInitial === PERSONNEL.filter(p=>!p.reserve).length;
  r.reserveExcludedFromList = !certAddPersonRows.some(p=>{
    const person = PERSONNEL.find(x=>x.name===p.name);
    return person && person.reserve;
  });

  // בחירת שני חיילים בלחיצה (לא select אחד)
  const soldiers = PERSONNEL.filter(p=>p.role==="חייל" && !p.reserve);
  r.hasTwoSoldiers = soldiers.length >= 2;
  const idxA = certAddPersonRows.findIndex(p=>p.name===soldiers[0].name);
  const idxB = certAddPersonRows.findIndex(p=>p.name===soldiers[1].name);
  toggleCertPersonAt(idxA);
  toggleCertPersonAt(idxB);
  r.twoSelectedAfterClicks = certAddSelected.size === 2 && certAddSelected.has(soldiers[0].name) && certAddSelected.has(soldiers[1].name);
  r.selectedRowsMarked = document.querySelectorAll("#cert-person-list .cert-pick-row.sel").length === 2;

  // לחיצה חוזרת מבטלת בחירה
  toggleCertPersonAt(idxA);
  r.clickAgainDeselects = !certAddSelected.has(soldiers[0].name) && certAddSelected.size===1;
  toggleCertPersonAt(idxA); // נבחר בחזרה לצורך הבדיקה הבאה

  // "בחר הכל / נקה"
  toggleAllCertPersons();
  r.selectAllSelectsEveryone = certAddSelected.size === certAddPersonRows.length && certAddPersonRows.length>0;
  toggleAllCertPersons();
  r.toggleAgainClearsAll = certAddSelected.size === 0;

  // הוספה בפועל לשני אנשים בבת אחת
  toggleCertPersonAt(idxA);
  toggleCertPersonAt(idxB);
  document.getElementById("cert-name").value = "🟢 בדיקת ריבוי";
  document.getElementById("cert-expiry").value = "";
  const certsBefore = (await getCerts()).length;
  await addCert();
  const certsAfter = await getCerts();
  r.bothPeopleGotTheCert = certsAfter.some(c=>c.person===soldiers[0].name && c.name==="🟢 בדיקת ריבוי")
                          && certsAfter.some(c=>c.person===soldiers[1].name && c.name==="🟢 בדיקת ריבוי");
  r.exactlyTwoNewCerts = certsAfter.length === certsBefore + 2;
  r.uniqueIdsPerPerson = new Set(certsAfter.filter(c=>c.name==="🟢 בדיקת ריבוי").map(c=>c.id)).size === 2;

  // סינון "הסמכות-מפקדים-בלבד" — מציג רק מפקדים ברשימה
  openCertAdd();
  setCertPersonRows("הסמכת נדחף", PERSONNEL);
  r.commanderOnlyFiltersList = certAddPersonRows.length>0 && certAddPersonRows.every(p=>{
    const person = PERSONNEL.find(x=>x.name===p.name);
    return person && person.role==="מפקד";
  });

  // ניסיון להוסיף בלי לבחור אף אחד → נכשל בעדינות, לא זורק שגיאה
  openCertAdd();
  document.getElementById("cert-name").value = "🟢 לא אמור להישמר";
  const certsBeforeEmpty = (await getCerts()).length;
  await addCert();
  const certsAfterEmpty = await getCerts();
  r.noSelectionMeansNoAdd = certsAfterEmpty.length === certsBeforeEmpty;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("הרשימה מציגה את כל אנשי הצוות (למעט מילואים)", out.listShowsAllNonReserve, String(out.listShowsAllNonReserve));
record("איש מילואים לא מופיע ברשימת הבחירה", out.reserveExcludedFromList, String(out.reserveExcludedFromList));
record("יש לפחות שני חיילים בסיד לבדיקה", out.hasTwoSoldiers, String(out.hasTwoSoldiers));
record("לחיצה על שתי שורות בוחרת את שתיהן (לא select יחיד)", out.twoSelectedAfterClicks, String(out.twoSelectedAfterClicks));
record("שורות נבחרות מסומנות ויזואלית (class sel)", out.selectedRowsMarked, String(out.selectedRowsMarked));
record("לחיצה חוזרת על שורה נבחרת מבטלת את הבחירה", out.clickAgainDeselects, String(out.clickAgainDeselects));
record("\"בחר הכל\" בוחר את כל הרשימה", out.selectAllSelectsEveryone, String(out.selectAllSelectsEveryone));
record("לחיצה נוספת מנקה את כל הבחירה", out.toggleAgainClearsAll, String(out.toggleAgainClearsAll));
record("🔒 התכונה המבוקשת: addCert() מוסיף לשני אנשים שנבחרו בבת אחת", out.bothPeopleGotTheCert, String(out.bothPeopleGotTheCert));
record("נוספו בדיוק 2 רשומות הסמכה (לא יותר/פחות)", out.exactlyTwoNewCerts, String(out.exactlyTwoNewCerts));
record("לכל רשומה יש id ייחודי (אין התנגשות בין הוספות באותה מילישנייה)", out.uniqueIdsPerPerson, String(out.uniqueIdsPerPerson));
record("הסמכת-מפקדים-בלבד עדיין מסננת את רשימת הבחירה למפקדים בלבד", out.commanderOnlyFiltersList, String(out.commanderOnlyFiltersList));
record("בלי בחירת אף חייל — addCert() לא מוסיף כלום", out.noSelectionMeansNoAdd, String(out.noSelectionMeansNoAdd));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
