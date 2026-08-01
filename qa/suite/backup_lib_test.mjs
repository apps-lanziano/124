/* גיבוי שבועי — בודק את functions/lib/backup.js עם אוסף מדומה, בלי
   Storage/Firestore אמיתיים. */
import { dumpCollection } from '../../functions/lib/backup.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

function makeFakeDb(docs){
  return {
    collection(name){
      return {
        async get(){
          const entries = Object.entries(docs);
          return {
            size: entries.length,
            forEach(cb){ entries.forEach(([id, data]) => cb({ id, data: () => data })); },
          };
        },
      };
    },
  };
}

// 1. מוציא את כל המסמכים כאובייקט, שמור לפי מזהה
{
  const db = makeFakeDb({
    "shed2_cfg_personnel": { v: [{name:"דני"}] },
    "shed2_safety_events": { v: [{id:"ev1", title:"x"}] },
    "admin_events": { v: [] },
  });
  const { docs, count } = await dumpCollection(db);
  record("כל המסמכים באוסף מיוצאים, לפי מזהה מדויק",
    count===3 && docs["shed2_cfg_personnel"] && docs["shed2_safety_events"] && ("admin_events" in docs),
    JSON.stringify(Object.keys(docs)));
  record("תוכן המסמך נשמר במלואו (לא רק שמות)",
    JSON.stringify(docs["shed2_cfg_personnel"]) === JSON.stringify({v:[{name:"דני"}]}),
    JSON.stringify(docs["shed2_cfg_personnel"]));
}

// 2. אוסף ריק — לא נכשל, סופר 0
{
  const db = makeFakeDb({});
  const { docs, count } = await dumpCollection(db);
  record("אוסף ריק מטופל בלי שגיאה", count===0 && Object.keys(docs).length===0, JSON.stringify({count, docs}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
