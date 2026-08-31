/* הוספת הסמכה — בחירה מרובה של חיילים + בחירה מרובה של הסמכות:
   מודל "cert-modal" (openCertAdd/addCert) תומך בבחירה מרובה גם של חיילים
   (cert-person-list) וגם של הסמכות מהמאגר (cert-bank-list), כך שמפקד
   יכול להוסיף כמה הסמכות לכמה חיילים בלחיצה אחת. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  if(!PERSONNEL.some(p=>p.name==="חייל ג בדיקה")){
    PERSONNEL.push({name:"חייל ג בדיקה", role:"חייל", bday:"2004-01-01", joined: todayKey()});
  }

  // === חלק א: בחירה מרובה של חיילים ===
  openCertAdd();
  const rowsInitial = document.querySelectorAll("#cert-person-list .cert-pick-row").length;
  r.listShowsAllNonReserve = rowsInitial === PERSONNEL.filter(p=>!p.reserve).length;
  r.reserveExcludedFromList = !certAddPersonRows.some(p=>{
    const person = PERSONNEL.find(x=>x.name===p.name);
    return person && person.reserve;
  });

  const soldiers = PERSONNEL.filter(p=>p.role==="חייל" && !p.reserve);
  r.hasTwoSoldiers = soldiers.length >= 2;
  const idxA = certAddPersonRows.findIndex(p=>p.name===soldiers[0].name);
  const idxB = certAddPersonRows.findIndex(p=>p.name===soldiers[1].name);
  toggleCertPersonAt(idxA);
  toggleCertPersonAt(idxB);
  r.twoSelectedAfterClicks = certAddSelected.size === 2 && certAddSelected.has(soldiers[0].name) && certAddSelected.has(soldiers[1].name);
  r.selectedRowsMarked = document.querySelectorAll("#cert-person-list .cert-pick-row.sel").length === 2;

  toggleCertPersonAt(idxA);
  r.clickAgainDeselects = !certAddSelected.has(soldiers[0].name) && certAddSelected.size===1;
  toggleCertPersonAt(idxA);

  toggleAllCertPersons();
  r.selectAllSelectsEveryone = certAddSelected.size === certAddPersonRows.length && certAddPersonRows.length>0;
  toggleAllCertPersons();
  r.toggleAgainClearsAll = certAddSelected.size === 0;

  // הוספה בפועל לשני אנשים בבת אחת (הסמכה ידנית)
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

  // סינון "הסמכות-מפקדים-בלבד"
  openCertAdd();
  setCertPersonRows("הסמכת נדחף", PERSONNEL);
  r.commanderOnlyFiltersList = certAddPersonRows.length>0 && certAddPersonRows.every(p=>{
    const person = PERSONNEL.find(x=>x.name===p.name);
    return person && person.role==="מפקד";
  });

  // בלי בחירה → לא מוסיף
  openCertAdd();
  document.getElementById("cert-name").value = "🟢 לא אמור להישמר";
  const certsBeforeEmpty = (await getCerts()).length;
  await addCert();
  const certsAfterEmpty = await getCerts();
  r.noSelectionMeansNoAdd = certsAfterEmpty.length === certsBeforeEmpty;

  // === חלק ב: בחירה מרובה של הסמכות מהמאגר ===
  openCertAdd();
  r.certBankListExists = !!document.getElementById("cert-bank-list");
  r.certBankRowsLoaded = certAddBankRows.length === CERT_BANK_DEFAULT.length && certAddBankRows.length > 0;
  r.certBankStartsEmpty = certAddBankSelected.size === 0;

  // בחירת 2 הסמכות מהמאגר
  const certIdx0 = 0;
  const certIdx1 = 1;
  toggleCertBankAt(certIdx0);
  toggleCertBankAt(certIdx1);
  r.twoCertsSelected = certAddBankSelected.size === 2;
  r.certBankRowsMarked = document.querySelectorAll("#cert-bank-list .cert-pick-row.sel").length === 2;

  // ביטול בחירה
  toggleCertBankAt(certIdx0);
  r.certClickAgainDeselects = certAddBankSelected.size === 1 && !certAddBankSelected.has(certAddBankRows[certIdx0]);
  toggleCertBankAt(certIdx0);

  // "בחר הכל / נקה" להסמכות
  toggleAllCertBankItems();
  r.certSelectAll = certAddBankSelected.size === certAddBankRows.length;
  toggleAllCertBankItems();
  r.certToggleClearsAll = certAddBankSelected.size === 0;

  // 🔒 הפיצ'ר: 2 חיילים × 2 הסמכות = 4 רשומות
  openCertAdd();
  if(!PERSONNEL.some(p=>p.name==="חייל ג בדיקה")){
    PERSONNEL.push({name:"חייל ג בדיקה", role:"חייל", bday:"2004-01-01", joined: todayKey()});
  }
  setCertPersonRows("", PERSONNEL);
  const idxA2 = certAddPersonRows.findIndex(p=>p.name===soldiers[0].name);
  const idxB2 = certAddPersonRows.findIndex(p=>p.name===soldiers[1].name);
  toggleCertPersonAt(idxA2);
  toggleCertPersonAt(idxB2);
  toggleCertBankAt(0);
  toggleCertBankAt(1);
  const cert0 = certAddBankRows[0];
  const cert1 = certAddBankRows[1];
  document.getElementById("cert-expiry").value = "";
  const certsBefore4 = (await getCerts()).length;
  await addCert();
  const certsAfter4 = await getCerts();
  const newCerts4 = certsAfter4.slice(certsBefore4);
  r.fourNewCerts = newCerts4.length === 4;
  r.allCombinationsExist =
    newCerts4.some(c=>c.person===soldiers[0].name && c.name===cert0) &&
    newCerts4.some(c=>c.person===soldiers[0].name && c.name===cert1) &&
    newCerts4.some(c=>c.person===soldiers[1].name && c.name===cert0) &&
    newCerts4.some(c=>c.person===soldiers[1].name && c.name===cert1);
  r.allUniqueIds = new Set(newCerts4.map(c=>c.id)).size === 4;

  // בחירה מהמאגר דורסת הקלדה ידנית
  openCertAdd();
  toggleCertPersonAt(certAddPersonRows.findIndex(p=>p.name===soldiers[0].name));
  document.getElementById("cert-name").value = "הסמכה ידנית";
  toggleCertBankAt(0);
  const certsBefore5 = (await getCerts()).length;
  await addCert();
  const certsAfter5 = await getCerts();
  const newCert5 = certsAfter5.slice(certsBefore5);
  r.bankOverridesManual = newCert5.length === 1 && newCert5[0].name === certAddBankRows[0];

  // בלי בחירת הסמכה ובלי הקלדה → לא מוסיף
  openCertAdd();
  toggleCertPersonAt(certAddPersonRows.findIndex(p=>p.name===soldiers[0].name));
  document.getElementById("cert-name").value = "";
  const certsBeforeNone = (await getCerts()).length;
  await addCert();
  const certsAfterNone = await getCerts();
  r.noCertMeansNoAdd = certsAfterNone.length === certsBeforeNone;

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
record("addCert() מוסיף לשני אנשים שנבחרו בבת אחת", out.bothPeopleGotTheCert, String(out.bothPeopleGotTheCert));
record("נוספו בדיוק 2 רשומות הסמכה (לא יותר/פחות)", out.exactlyTwoNewCerts, String(out.exactlyTwoNewCerts));
record("לכל רשומה יש id ייחודי", out.uniqueIdsPerPerson, String(out.uniqueIdsPerPerson));
record("הסמכת-מפקדים-בלבד עדיין מסננת את רשימת הבחירה למפקדים בלבד", out.commanderOnlyFiltersList, String(out.commanderOnlyFiltersList));
record("בלי בחירת אף חייל — addCert() לא מוסיף כלום", out.noSelectionMeansNoAdd, String(out.noSelectionMeansNoAdd));
record("רשימת הסמכות מהמאגר קיימת", out.certBankListExists, String(out.certBankListExists));
record("רשימת ההסמכות טעונה מ-CERT_BANK_DEFAULT", out.certBankRowsLoaded, String(out.certBankRowsLoaded));
record("הבחירה מתחילה ריקה", out.certBankStartsEmpty, String(out.certBankStartsEmpty));
record("בחירת 2 הסמכות מהמאגר עובדת", out.twoCertsSelected, String(out.twoCertsSelected));
record("שורות הסמכות נבחרות מסומנות ויזואלית", out.certBankRowsMarked, String(out.certBankRowsMarked));
record("לחיצה חוזרת מבטלת בחירת הסמכה", out.certClickAgainDeselects, String(out.certClickAgainDeselects));
record("\"בחר הכל\" בהסמכות בוחר את כולן", out.certSelectAll, String(out.certSelectAll));
record("לחיצה נוספת מנקה את כל ההסמכות", out.certToggleClearsAll, String(out.certToggleClearsAll));
record("🔒 2 חיילים × 2 הסמכות = 4 רשומות חדשות", out.fourNewCerts, String(out.fourNewCerts));
record("🔒 כל 4 הצירופים (חייל×הסמכה) קיימים", out.allCombinationsExist, String(out.allCombinationsExist));
record("כל 4 הרשומות עם id ייחודי", out.allUniqueIds, String(out.allUniqueIds));
record("בחירה מהמאגר גוברת על הקלדה ידנית", out.bankOverridesManual, String(out.bankOverridesManual));
record("בלי הסמכה ובלי הקלדה — לא מוסיף כלום", out.noCertMeansNoAdd, String(out.noCertMeansNoAdd));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
