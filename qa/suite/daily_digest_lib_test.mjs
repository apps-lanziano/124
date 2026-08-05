/* תקציר יומי — בודק את functions/lib/daily_digest.js ישירות עם Firestore
   מדומה, בלי צורך ב-emulator. חשוב: בשונה מתזכורות נקודתיות, התקציר לא
   אמור לקרוא/לכתוב שום לוג cooldown משלו — רק להרכיב תמונת מצב נוכחית
   מתוך פונקציות הקריאה הקיימות. */
import { buildDailyDigests } from '../../functions/lib/daily_digest.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const DAY = 86400000;
const NOW = Date.now();
const oldEventId = (daysAgo) => `ev_${NOW - daysAgo*DAY}`;
const todayKey = new Date(NOW).toISOString().slice(0,10);
const inDays = (n) => { const d = new Date(NOW + n*DAY); return d.toISOString().slice(0,10); };

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

// --- סככה 2: הכול נקי, אין מה לדווח ---
// --- סככה 3: חתימה חסרה אחת + תקלה פתוחה אחת + הסמכה שפג תוקפה ---
const store = {
  "sq124/shed2_safety_events": [],
  "sq124/shed2_cfg_personnel": [{ name: "דני" }],
  "sq124/shed2_faults_list": [],
  "sq124/shed2_certs_list": [],

  "sq124/shed3_safety_events": [{ id: oldEventId(1), title: "מסמך" }],   // גיל יום אחד — מספיק, remindAfterDays:0
  "sq124/shed3_cfg_personnel": [{ name: "אורי" }],   // לא חתם — אין sigs doc
  "sq124/shed3_faults_list": [{ id: "f1", title: "תקלה", status: "פתוח" }, { id: "f2", title: "תקלה 2", status: "closed" }],
  "sq124/shed3_certs_list": [{ id: "c1", person: "אורי", name: "🟢 סף", expiry: inDays(2) }],
};

// 1. מסגרת נקייה לגמרי לא מקבלת תקציר
{
  const digests = await buildDailyDigests(makeFakeDb(store), { now: NOW, shedIds: ["shed2","shed3"] });
  const shed2 = digests.find(d=>d.shedId==="shed2");
  record("סככה נקייה (shed2) לא מופיעה בתקציר", !shed2, JSON.stringify(digests));
}

// 2. מסגרת עם בעיות מקבלת תקציר עם הספירות הנכונות
{
  const digests = await buildDailyDigests(makeFakeDb(store), { now: NOW, shedIds: ["shed2","shed3"] });
  const shed3 = digests.find(d=>d.shedId==="shed3");
  record("סככה 3: חתימה חסרה 1, תקלה פתוחה 1 (לא 2 — אחת סגורה), הסמכה פגה בקרוב 1",
    !!shed3 && shed3.unsignedCount===1 && shed3.openFaults===1 && shed3.certsSoon===1 && shed3.totalCount===3,
    JSON.stringify(shed3));
}

// 3. אין תלות בלוג cooldown — קריאה חוזרת לא "מדלגת" כאילו כבר טופל
{
  const db = makeFakeDb(store);
  const first = await buildDailyDigests(db, { now: NOW, shedIds: ["shed3"] });
  const second = await buildDailyDigests(db, { now: NOW + DAY, shedIds: ["shed3"] });
  record("קריאה שנייה (יום אחרי) עדיין מדווחת על אותה בעיה — אין cooldown לתקציר",
    first.length===1 && second.length===1 && second[0].totalCount===first[0].totalCount,
    JSON.stringify({first, second}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
