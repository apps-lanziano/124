/* מ״ע אחזקה בקשה 1: דיווח מסדר בוקר נשלח כ-push רק למפקדי הסככה (לא לכל
   הצוות, בשונה משאר סוגי ההתראה) — בודק את functions/lib/notify.js. */
import { decide, classify } from '../../functions/lib/notify.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. סיווג docId
{
  const cases = [
    ["shed2_daily_rollcall_report", "morning_rollcall"],
    ["training_daily_rollcall_report", "morning_rollcall"],
    ["shed2_messages_list", "message"],   // רגרסיה — לא מתבלבל עם סוגים אחרים
  ];
  const ok = cases.every(([id, expect]) => classify(id) === expect);
  record("classify: מזהה 'morning_rollcall' רק לפי הסיומת הנכונה", ok, JSON.stringify(cases.map(([id])=>[id, classify(id)])));
}

// 2. דיווח חדש (אין before בכלל) -> שולח, עם גוף ההודעה הנכון וdisplay commandersOnly
{
  const after = {dayKey:"2026-08-03", sentAt:1000, presentCount:5, absentCount:2, totalCount:7, absentNames:["רון","עידן"]};
  const d = decide({docId:"shed2_daily_rollcall_report", before: undefined, after});
  record("דיווח ראשון: שולח עם כותרת/גוף נכונים ו-commandersOnly=true",
    d !== null && d.kind==="morning_rollcall" && d.shedId==="shed2" &&
    d.title.includes("מסדר בוקר") && d.body==="5 נוכחים, 2 נעדרים" && d.commandersOnly===true && d.count===2,
    JSON.stringify(d));
}

// 3. אותו דיווח בדיוק (sentAt זהה) -> לא שולח שוב (מונע כפילות מכתיבה לא-קשורה למסמך)
{
  const report = {dayKey:"2026-08-03", sentAt:1000, presentCount:5, absentCount:2, totalCount:7, absentNames:[]};
  const d = decide({docId:"shed2_daily_rollcall_report", before:report, after:report});
  record("אותו sentAt בדיוק (אין דיווח חדש בפועל) -> לא שולח", d===null, JSON.stringify(d));
}

// 4. דיווח חדש שמחליף דיווח קודם (sentAt שונה) -> שולח שוב, על הנתונים העדכניים
{
  const before = {dayKey:"2026-08-02", sentAt:500, presentCount:1, absentCount:0, totalCount:1, absentNames:[]};
  const after = {dayKey:"2026-08-03", sentAt:1000, presentCount:3, absentCount:1, totalCount:4, absentNames:["דני"]};
  const d = decide({docId:"shed2_daily_rollcall_report", before, after});
  record("דיווח חדש (sentAt שונה) מחליף דיווח קודם -> שולח על הנתונים העדכניים",
    d !== null && d.body==="3 נוכחים, 1 נעדרים", JSON.stringify(d));
}

// 5. שמונה המסגרות — כל אחת מקבלת החלטה עצמאית עם שם המסגרת הנכון
{
  const SHEDS = ["shed1","shed2","shed3","shed4","shed5","dept","maint","training"];
  const after = {dayKey:"2026-08-03", sentAt:1000, presentCount:1, absentCount:0, totalCount:1, absentNames:[]};
  const decisions = SHEDS.map(id => decide({docId:`${id}_daily_rollcall_report`, before:undefined, after}));
  const allOk = decisions.every((d,i) => d && d.shedId===SHEDS[i] && d.commandersOnly===true);
  record("כל 8 המסגרות מקבלות החלטת שליחה עצמאית עם commandersOnly", allOk, JSON.stringify(decisions.map(d=>d&&d.shedId)));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
