/* תזכורת אוטומטית על הסמכות שפגו/עומדות לפוג — בודק את
   functions/lib/cert_expiry_reminders.js עם Firestore מדומה (ראו
   reminders_lib_test.mjs להסבר על התבנית — firebase-admin לא מותקן כאן). */
import { findExpiringCerts, daysUntil } from '../../functions/lib/cert_expiry_reminders.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const DAY = 86400000;
const NOW = Date.now();
const dateOffset = (days) => new Date(NOW + days*DAY).toISOString().slice(0,10);

function makeFakeDb(store){
  return {
    doc(path){
      return { async get(){ const v = store[path]; return { exists: v !== undefined, data: () => ({ v }) }; } };
    },
  };
}

const store = {
  // סככה 2: הסמכה שפג תוקפה (לפני 5 ימים) + הסמכה שעומדת לפוג בעוד 10 ימים + הסמכה רחוקה (לא רלוונטית)
  "sq124/shed2_certs_list": [
    { id:"c1", person:"דני", name:"PF", expiry: dateOffset(-5) },
    { id:"c2", person:"רון", name:"שלב 7", expiry: dateOffset(10) },
    { id:"c3", person:"עידן", name:"PF", expiry: dateOffset(60) },   // רחוק מדי — לא רלוונטי
    { id:"c4", person:"משה", name:"PF", expiry:"" },                  // בלי תפוגה — מדולג
  ],
  // סככה 3: אין הסמכות רלוונטיות בכלל
  "sq124/shed3_certs_list": [
    { id:"c5", person:"אורי", name:"PF", expiry: dateOffset(90) },
  ],
};

// 1. תרחיש בסיסי
{
  const db = makeFakeDb(store);
  const { toSend } = await findExpiringCerts(db, { now: NOW, shedIds:["shed2","shed3"] });
  const shed2 = toSend.find(x=>x.shedId==="shed2");
  const shed3 = toSend.find(x=>x.shedId==="shed3");
  record("סככה 2: 2 הסמכות רלוונטיות (פג תוקף + עומדת לפוג), הרחוקה/הריקה מדולגות",
    !!shed2 && shed2.items.length===2, JSON.stringify(shed2));
  record("סככה 2: ההסמכה שפג תוקפה מסומנת עם daysLeft שלילי",
    shed2.items.some(i=>i.person==="דני" && i.daysLeft<0), JSON.stringify(shed2 && shed2.items));
  record("סככה 3: אין הסמכות בטווח — לא נכללת", !shed3, JSON.stringify(shed3));
}

// 2. Cooldown — הסמכה שכבר הוזכרה לאחרונה לא נשלחת שוב, אחרי שהתקופה עברה — כן
{
  const db = makeFakeDb(store);
  const recentLog = {}; recentLog["shed2|c1"] = NOW - 1*DAY;
  store["sq124/_cert_reminder_log"] = recentLog;
  const r1 = await findExpiringCerts(db, { now: NOW, cooldownDays: 7, shedIds:["shed2"] });
  const shed2r1 = r1.toSend.find(x=>x.shedId==="shed2");
  record("תוך cooldown: ההסמכה שכבר הוזכרה לא נכללת שוב, אבל השנייה כן",
    shed2r1 && shed2r1.items.length===1 && shed2r1.items[0].person==="רון", JSON.stringify(shed2r1));

  const olderLog = {}; olderLog["shed2|c1"] = NOW - 8*DAY;
  store["sq124/_cert_reminder_log"] = olderLog;
  const r2 = await findExpiringCerts(db, { now: NOW, cooldownDays: 7, shedIds:["shed2"] });
  const shed2r2 = r2.toSend.find(x=>x.shedId==="shed2");
  record("אחרי שה-cooldown חלף: ההסמכה חוזרת להישלח",
    shed2r2 && shed2r2.items.length===2, JSON.stringify(shed2r2));
  delete store["sq124/_cert_reminder_log"];
}

// 3. daysUntil — עקביות
{
  const d = daysUntil(dateOffset(10), NOW);
  record("daysUntil מחשב נכון ימים עד תפוגה", d===10, String(d));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
