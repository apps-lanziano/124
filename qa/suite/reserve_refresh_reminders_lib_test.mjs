/* תזכורת אוטומטית על אנשי מילואים שלא רועננו זמן רב — בודק את
   functions/lib/reserve_refresh_reminders.js עם Firestore מדומה (ראו
   reminders_lib_test.mjs להסבר על התבנית). */
import { findOverdueReserves, daysSince } from '../../functions/lib/reserve_refresh_reminders.js';

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
  // סככה 2: איש מילואים ישן מדי (200 יום) + אחד טרי (30 יום) + חייל רגיל (לא רלוונטי) + מילואים בלי refresh
  "sq124/shed2_cfg_personnel": [
    { name:"רזרביסט ישן", role:"חייל", reserve:true, refresh: dateOffset(-200) },
    { name:"רזרביסט טרי", role:"חייל", reserve:true, refresh: dateOffset(-30) },
    { name:"דני", role:"חייל" },
    { name:"בלי תאריך", role:"חייל", reserve:true },
  ],
  // סככה 3: אין אנשי מילואים בכלל
  "sq124/shed3_cfg_personnel": [{ name:"אורי", role:"חייל" }],
};

// 1. תרחיש בסיסי
{
  const db = makeFakeDb(store);
  const { toSend } = await findOverdueReserves(db, { now: NOW, shedIds:["shed2","shed3"] });
  const shed2 = toSend.find(x=>x.shedId==="shed2");
  const shed3 = toSend.find(x=>x.shedId==="shed3");
  record("סככה 2: רק הרזרביסט הישן נכלל (הטרי בטווח, החייל הרגיל לא רלוונטי, בלי תאריך מדולג)",
    !!shed2 && shed2.items.length===1 && shed2.items[0].person==="רזרביסט ישן", JSON.stringify(shed2));
  record("סככה 3: אין אנשי מילואים — לא נכללת", !shed3, JSON.stringify(shed3));
}

// 2. Cooldown
{
  const db = makeFakeDb(store);
  const recentLog = {}; recentLog["shed2|רזרביסט ישן"] = NOW - 1*DAY;
  store["sq124/_reserve_reminder_log"] = recentLog;
  const r1 = await findOverdueReserves(db, { now: NOW, cooldownDays: 14, shedIds:["shed2"] });
  record("תוך cooldown: לא נשלחת תזכורת כפולה", r1.toSend.length===0, JSON.stringify(r1.toSend));

  const olderLog = {}; olderLog["shed2|רזרביסט ישן"] = NOW - 15*DAY;
  store["sq124/_reserve_reminder_log"] = olderLog;
  const r2 = await findOverdueReserves(db, { now: NOW, cooldownDays: 14, shedIds:["shed2"] });
  record("אחרי שה-cooldown חלף: התזכורת חוזרת להישלח", r2.toSend.length===1, JSON.stringify(r2.toSend));
  delete store["sq124/_reserve_reminder_log"];
}

// 3. daysSince — עקביות
{
  const d = daysSince(dateOffset(-200), NOW);
  record("daysSince מחשב נכון ימים מאז הרענון האחרון", d===200, String(d));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
