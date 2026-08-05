/* שיבוץ תורנויות שבועי — בודק את functions/lib/duty_roster_digest.js
   ישירות עם Firestore מדומה, בלי צורך ב-emulator. */
import { buildDutyRosterDigests, todayHebrewDayName, resolveNameToShed } from '../../functions/lib/duty_roster_digest.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

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

// --- 1. אזור זמן: יום השבוע נגזר משעון ישראל, לא משעון השרת (UTC) ---
{
  // 2026-08-08 הוא שבת. ב-23:30 UTC (=02:30 בישראל, כבר יום ראשון) — היום בישראל כבר "ראשון", לא "שבת"
  const lateUtcSaturday = Date.UTC(2026, 7, 8, 23, 30); // 8 באוגוסט 2026, 23:30 UTC
  const dayName = todayHebrewDayName(lateUtcSaturday);
  record("יום השבוע מחושב לפי שעון ישראל (לא UTC) — 23:30 UTC בשבת כבר יום ראשון בישראל",
    dayName === "ראשון", `dayName=${dayName}`);
}

// --- 2. resolveNameToShed: התאמה יחידה / אפס / כפולה ---
{
  const map = { shed1: [{name:"דני"}], shed2: [{name:"רותם"}], shed3: [{name:"דני"}] };
  const unique = resolveNameToShed("רותם", map);
  const notFound = resolveNameToShed("לא קיים", map);
  const duplicate = resolveNameToShed("דני", map); // קיים גם בשד1 וגם בשד3 — לא ניתן לזהות בוודאות
  record("שם ייחודי מזוהה לסככה הנכונה", unique==="shed2", String(unique));
  record("שם שלא קיים באף סככה מוחזר null", notFound===null, String(notFound));
  record("שם כפול בשתי סככות מוחזר null (לא מנחשים)", duplicate===null, String(duplicate));
}

// --- 3. buildDutyRosterDigests: תרחיש מלא ---
const NOW = Date.UTC(2026, 7, 5, 6, 0); // יום רביעי בבוקר, שעון ישראל
{
  const store = {
    "sq124/shed2_cfg_personnel": [{name:"משה כהן"}, {name:"דוד לוי"}],
    "sq124/shed3_cfg_personnel": [{name:"יוסי מזרחי"}],
    "sq124/board_roster": {
      weekKey: "2026-W32",
      days: {
        "רביעי": { duty: ["משה כהן", "דוד לוי"], rest: ["יוסי מזרחי"] },
      },
    },
  };
  const { dayName, digests, unmatched } = await buildDutyRosterDigests(makeFakeDb(store), { now: NOW, shedIds: ["shed2","shed3"] });
  record("היום מזוהה נכון (רביעי)", dayName==="רביעי", dayName);
  const shed2 = digests.find(d=>d.shedId==="shed2");
  const shed3 = digests.find(d=>d.shedId==="shed3");
  record("סככה 2 מקבלת רק את החיילים שלה בצוות התורן", !!shed2 && shed2.duty.length===2 && shed2.rest.length===0, JSON.stringify(shed2));
  record("סככה 3 מקבלת רק את החייל שלה ב'נח'", !!shed3 && shed3.rest.length===1 && shed3.duty.length===0, JSON.stringify(shed3));
  record("אין שמות לא מזוהים כשכולם קיימים ברשימות הצוות", unmatched.length===0, JSON.stringify(unmatched));
}

// --- 4. שם לא מזוהה מדולג ומדווח בנפרד, לא נכנס לאף סככה ---
{
  const store = {
    "sq124/shed2_cfg_personnel": [{name:"משה כהן"}],
    "sq124/board_roster": {
      weekKey: "2026-W32",
      days: { "רביעי": { duty: ["משה כהן", "שם שלא קיים"], rest: [] } },
    },
  };
  const { digests, unmatched } = await buildDutyRosterDigests(makeFakeDb(store), { now: NOW, shedIds: ["shed2"] });
  const shed2 = digests.find(d=>d.shedId==="shed2");
  record("שם לא מזוהה לא נכלל באף תקציר סככה", !!shed2 && shed2.duty.length===1 && shed2.duty[0]==="משה כהן", JSON.stringify(shed2));
  record("שם לא מזוהה מדווח ברשימת unmatched", unmatched.includes("שם שלא קיים"), JSON.stringify(unmatched));
}

// --- 5. אין מסמך board_roster בכלל — אין תקציר, אין קריסה ---
{
  const { dayName, digests, unmatched } = await buildDutyRosterDigests(makeFakeDb({}), { now: NOW, shedIds: ["shed2"] });
  record("בלי board_roster בכלל — אין תקצירים ואין שגיאה", digests.length===0 && unmatched.length===0 && dayName==="רביעי", JSON.stringify({dayName, digests, unmatched}));
}

// --- 6. יש roster אבל היום הספציפי ריק (למשל שיבוץ הוזן רק לחלק מהימים) ---
{
  const store = {
    "sq124/shed2_cfg_personnel": [{name:"משה כהן"}],
    "sq124/board_roster": { weekKey:"2026-W32", days: { "ראשון": { duty:["משה כהן"], rest:[] } } },
  };
  const { digests } = await buildDutyRosterDigests(makeFakeDb(store), { now: NOW, shedIds: ["shed2"] }); // NOW=רביעי, אין שיבוץ לרביעי
  record("יום שלא הוזן לו שיבוץ לא מייצר תקציר", digests.length===0, JSON.stringify(digests));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
