/* תזכורת אוטומטית על חתימות שלא נסגרו — בודק את functions/lib/reminders.js
   ישירות עם Firestore מדומה, בלי צורך ב-emulator (firebase-admin לא מותקן
   בסביבת הבדיקה הזו בכלל — זו בדיוק הסיבה שהלוגיקה הופרדה לקובץ טהור). */
import { findUnsignedReminders, eventAgeDays, safeName } from '../../functions/lib/reminders.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const DAY = 86400000;
const NOW = Date.now();
const oldEventId = (daysAgo) => `ev_${NOW - daysAgo*DAY}`;

function makeFakeDb(store){
  return {
    doc(path){
      return {
        async get(){
          const v = store[path];
          return { exists: v !== undefined, data: () => ({ v }) };
        },
      };
    },
  };
}

// --- נתוני בסיס: 3 מסגרות עם תרחישים שונים ---
const store = {
  // סככה 2: פריט בן 5 ימים, 2 מתוך 3 לא חתמו — אמור להישלח
  "sq124/shed2_safety_events": [{ id: oldEventId(5), title: "מסמך קריטי" }],
  "sq124/shed2_cfg_personnel": [{ name: "דני" }, { name: "רון" }, { name: "עידן" }],
  "sq124/shed2_sigs_דני": { [oldEventId(5)]: { date: "x" } },   // חתם
  // רון ועידן — לא חתמו (אין מסמך / לא קיים במאגר)

  // סככה 3: פריט חדש (יום אחד) — יותר מדי מוקדם, לא אמור להישלח
  "sq124/shed3_safety_events": [{ id: oldEventId(1), title: "פריט טרי" }],
  "sq124/shed3_cfg_personnel": [{ name: "אורי" }],

  // סככה 4: פריט ותיק, אבל כולם חתמו — לא אמור להישלח
  "sq124/shed4_safety_events": [{ id: oldEventId(7), title: "מסמך סגור" }],
  "sq124/shed4_cfg_personnel": [{ name: "משה" }],
  "sq124/shed4_sigs_משה": { [oldEventId(7)]: { date: "x" } },

  // סככה 5: פריט ותיק עם חייל משוחרר שלא חתם — לא אמור להיספר כ"חסר"
  "sq124/shed5_safety_events": [{ id: oldEventId(7), title: "מסמך" }],
  "sq124/shed5_cfg_personnel": [{ name: "שוחרר", release: "2020-01-01" }],
};

// 1. תרחיש בסיסי — סככה 2 נשלחת, 3 ו-4 לא
{
  const db = makeFakeDb(store);
  const { toSend } = await findUnsignedReminders(db, { now: NOW, shedIds: ["shed2","shed3","shed4","shed5"] });
  const shed2 = toSend.find(x=>x.shedId==="shed2");
  const shed3 = toSend.find(x=>x.shedId==="shed3");
  const shed4 = toSend.find(x=>x.shedId==="shed4");
  const shed5 = toSend.find(x=>x.shedId==="shed5");
  record("סככה 2: פריט ותיק עם חתימות חסרות נכלל, עם ספירה נכונה",
    !!shed2 && shed2.missing===2, JSON.stringify(shed2));
  record("סככה 3: פריט טרי מדי (יום אחד) לא נכלל",
    !shed3, JSON.stringify(shed3));
  record("סככה 4: כולם חתמו — לא נכלל",
    !shed4, JSON.stringify(shed4));
  record("סככה 5: חייל משוחרר לא נספר כ'חסר' — אין מי שדורש תזכורת",
    !shed5, JSON.stringify(shed5));
}

// 2. Cooldown — פריט שכבר קיבל תזכורת לאחרונה לא נשלח שוב; אחרי שהתקופה עברה — כן
{
  const db = makeFakeDb(store);
  const recentLog = {}; recentLog["shed2|"+oldEventId(5)] = NOW - 1*DAY;   // תוזכר אתמול
  store["sq124/_reminder_log"] = recentLog;
  const r1 = await findUnsignedReminders(db, { now: NOW, cooldownDays: 3, shedIds:["shed2"] });
  record("תוך תקופת ה-cooldown — לא נשלחת תזכורת כפולה",
    r1.toSend.length === 0, JSON.stringify(r1.toSend));

  const olderLog = {}; olderLog["shed2|"+oldEventId(5)] = NOW - 4*DAY;   // לפני 4 ימים
  store["sq124/_reminder_log"] = olderLog;
  const r2 = await findUnsignedReminders(db, { now: NOW, cooldownDays: 3, shedIds:["shed2"] });
  record("אחרי שה-cooldown חלף — התזכורת חוזרת להישלח",
    r2.toSend.length === 1, JSON.stringify(r2.toSend));
  delete store["sq124/_reminder_log"];
}

// 3. eventAgeDays / safeName — עקביות עם האפליקציה
{
  const age = eventAgeDays(`ev_${NOW - 5*DAY}`, NOW);
  record("eventAgeDays מחשב נכון ימים מאז יצירת הפריט", age===5, String(age));
  record("safeName תואם לתבנית הקיימת באפליקציה (רווחים/סימנים -> _)",
    safeName("דני כהן") === "דני_כהן", safeName("דני כהן"));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
