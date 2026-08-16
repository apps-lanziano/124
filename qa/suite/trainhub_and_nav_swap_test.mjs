/* בקשת משתמש (צמצום תפריט "עוד" למפקד):
   (1) "סגירת יום" הוסר לגמרי — מסך, פריט תפריט וכפתור הניהול.
   (2) עולם ההדרכה מאוחד למסך-שער "הדרכה": הסמכות + קליטת חייל חדש +
       חומרי הדרכה. השער מחליף את "הסמכות" בבאנר התחתון.
   (3) בבאנר התחתון הוחלפו "רכבים" ו"כשירות חיילים": כשירות עלתה
       ללשונית, רכבים ירדו לתפריט "עוד" (ההרשאה עצמה לא השתנתה).
   (4) חייל לא מושפע — אצלו הכל נשאר במקום. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page, pageErrors } = await newPage();
const hidden = id => page.evaluate(i=>{
  const el = document.getElementById(i);
  return el ? el.classList.contains("hidden") : "MISSING";
}, id);

// ===== 1. סגירת יום הוסרה לגמרי =====
{
  const gone = await page.evaluate(()=>({
    screen: !document.getElementById("scr-closeday"),
    sheet:  !document.getElementById("sheet-closeday"),
    btn:    !document.getElementById("close-mgmt-btn"),
    modal:  !document.getElementById("closemgmt-modal"),
    fn:     typeof window.renderCloseDay === "undefined",
  }));
  record("סגירת יום: המסך הוסר", gone.screen, String(gone.screen));
  record("סגירת יום: הפריט בתפריט הוסר", gone.sheet, String(gone.sheet));
  record("סגירת יום: כפתור הניהול הוסר", gone.btn, String(gone.btn));
  record("סגירת יום: המודל הוסר", gone.modal, String(gone.modal));
  record("סגירת יום: הפונקציות הוסרו", gone.fn, String(gone.fn));
}

// ===== 2. מפקד סככה — שער הדרכה + החלפת לשוניות =====
{
  const r = await loginAsFramework(page, "shed1", "מפקד");
  record("התחברות מפקד", r.ok, JSON.stringify(r));

  record("מפקד: לשונית \"הדרכה\" גלויה", (await hidden("nav-trainhub"))===false, String(await hidden("nav-trainhub")));
  record("מפקד: \"הסמכות\" ירדה מהבאנר", (await hidden("nav-certs"))===true, String(await hidden("nav-certs")));
  record("מפקד: \"כשירות חיילים\" עלתה לבאנר", (await hidden("nav-medchecks"))===false, String(await hidden("nav-medchecks")));
  record("מפקד: \"רכבים\" ירדו מהבאנר", (await hidden("nav-vehicles"))===true, String(await hidden("nav-vehicles")));
  record("מפקד: \"רכבים\" זמינים בתפריט \"עוד\"", (await hidden("more-vehicles-item"))===false, String(await hidden("more-vehicles-item")));
  record("מפקד: \"כשירות חיילים\" ירדה מ\"עוד\" (לא כפול)", (await hidden("sheet-medchecks"))===true, String(await hidden("sheet-medchecks")));
  record("מפקד: \"חומרי הדרכה\" ירדו מ\"עוד\" (עברו לשער)", (await hidden("sheet-training"))===true, String(await hidden("sheet-training")));
  record("מפקד: \"קליטת חייל חדש\" ירדה מ\"עוד\" (עברה לשער)", (await hidden("sheet-onboarding"))===true, String(await hidden("sheet-onboarding")));

  // מסך ההדרכה — פריסת מיקוד: שורת צ'יפים + רשימת טיפול
  const hub = await page.evaluate(async ()=>{
    go("scr-trainhub", null);
    await new Promise(r=>setTimeout(r,400));
    const box = document.getElementById("trainhub-list");
    const html = box ? box.innerHTML : "";
    return {
      open: document.getElementById("scr-trainhub").classList.contains("active"),
      chips: box ? box.querySelectorAll(".th-chip").length : 0,
      hasCerts: /scr-certs/.test(html),
      hasOnb:   /scr-onboarding/.test(html),
      hasTrain: /scr-training/.test(html),
      // או שיש רשימת טיפול, או שיש מצב "הכל תקין" — לעולם לא ריק
      hasBody:  /th-card/.test(html) || /th-clear/.test(html),
    };
  });
  record("מסך הדרכה: המסך נפתח", hub.open, String(hub.open));
  record("מסך הדרכה: שלושה צ'יפים בראש", hub.chips===3, String(hub.chips));
  record("מסך הדרכה: מנתב להסמכות", hub.hasCerts, String(hub.hasCerts));
  record("מסך הדרכה: מנתב לקליטת חייל חדש", hub.hasOnb, String(hub.hasOnb));
  record("מסך הדרכה: מנתב לחומרי הדרכה", hub.hasTrain, String(hub.hasTrain));
  record("מסך הדרכה: תוכן מתחת לצ'יפים (רשימה או \"הכל תקין\")", hub.hasBody, String(hub.hasBody));

  // רשימת הטיפול מזהה בפועל הסמכה שפג תוקפה — לא רק מרנדרת מבנה ריק
  const live = await page.evaluate(async ()=>{
    const certs = await getCerts();
    certs.push({id:"th_exp", person:PERSONNEL.find(p=>p.role==="חייל").name,
                name:"🟢 סף", expiry:"2020-01-01"});          // פג מזמן
    await sSet("certs_list", certs);
    await renderTrainHub();
    const html = document.getElementById("trainhub-list").innerHTML;
    return {
      flagged: /פג לפני/.test(html),
      urgent:  /th-pill r/.test(html),
      chipHot: /th-chip hot/.test(html),
      sectioned: /דורש טיפול/.test(html),
    };
  });
  record("רשימת טיפול: הסמכה שפגה מזוהה", live.flagged, String(live.flagged));
  record("רשימת טיפול: מסומנת כדחופה (אדום)", live.urgent, String(live.urgent));
  record("רשימת טיפול: הצ'יפ מסומן כבוער", live.chipHot, String(live.chipHot));
  record("רשימת טיפול: כותרת \"דורש טיפול\" מוצגת", live.sectioned, String(live.sectioned));

  // ניווט בפועל מהמסך למסך ההסמכות
  const nav = await page.evaluate(async ()=>{
    go("scr-certs", null);
    await new Promise(r=>setTimeout(r,250));
    return document.getElementById("scr-certs").classList.contains("active");
  });
  record("מסך הדרכה: ניווט להסמכות עובד", nav, String(nav));
}

// ===== 3. חייל — לא מושפע =====
{
  const r = await loginAsFramework(page, "shed1", "חייל");
  record("התחברות חייל", r.ok, JSON.stringify(r));
  record("חייל: אין לו לשונית \"הדרכה\"", (await hidden("nav-trainhub"))===true, String(await hidden("nav-trainhub")));
  record("חייל: \"הסמכות\" נשארה ב\"עוד\"", (await hidden("sheet-certs"))===false, String(await hidden("sheet-certs")));
  record("חייל: \"כשירות חיילים\" נשארה ב\"עוד\"", (await hidden("sheet-medchecks"))===false, String(await hidden("sheet-medchecks")));
  record("חייל: \"חומרי הדרכה\" נשאר לשונית בבאנר", (await hidden("nav-training"))===false, String(await hidden("nav-training")));
}

// ===== 4. אין שגיאות JS =====
record("אין שגיאות JS בריצה", pageErrors.length===0, pageErrors.join(" | ") || "נקי");

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
