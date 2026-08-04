/* בדיקת הרחבה: תיקון פערי התראה — עד עכשיו דיווח תקלה רגילה (faults_list,
   כל חייל יכול לדווח) לא הפעיל שום התראה כלל, ותקלת בינוי (binui_faults_list,
   מסמך גלובלי ללא קידומת מסגרת) הסתמכה רק על תזכורת ידנית בוואטסאפ
   (openWaPrompt('binui', …) ב-index.html). שתיהן מגיעות עכשיו כפוש אמיתי,
   בדיוק כמו קרא-וחתום/הודעה/לוח/הדרכה, אבל commandersOnly (רק למפקד),
   בדיוק כמו מסדר בוקר. */
import { decide, classify } from '../../functions/lib/notify.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. סיווג docId — תקלה רגילה לפי קידומת מסגרת, תקלת בינוי כמסמך גלובלי יחיד
{
  const cases = [
    ["shed2_faults_list", "fault"],
    ["training_faults_list", "fault"],
    ["binui_faults_list", "binui_fault"],   // גלובלי — לא "fault" רגיל, למרות שגם מסתיים ב-_faults_list
    ["shed2_messages_list", "message"],     // רגרסיה — לא מתבלבל עם סוגים אחרים
  ];
  const ok = cases.every(([id, expect]) => classify(id) === expect);
  record("classify: מבחין בין תקלה רגילה (עם קידומת מסגרת) לתקלת בינוי (גלובלי)",
    ok, JSON.stringify(cases.map(([id])=>[id, classify(id)])));
}

// 2. תקלה רגילה חדשה בסככה -> שולח למפקד הסככה בלבד, עם כותרת/גוף נכונים
{
  const before = [];
  const after = [{id:"fault_1", title:"מזגן לא עובד", by:"דני", status:"open"}];
  const d = decide({docId:"shed3_faults_list", before, after});
  record("תקלה רגילה חדשה: שולח עם כותרת/גוף נכונים ו-commandersOnly=true",
    d !== null && d.kind==="fault" && d.shedId==="shed3" &&
    d.title==="🔧 תקלה חדשה · סככה 3" && d.body==="מזגן לא עובד" && d.commandersOnly===true,
    JSON.stringify(d));
}

// 3. תקלה קיימת שרק משתנה סטטוס (לא פריט חדש) -> לא שולח שוב
{
  const before = [{id:"fault_1", title:"מזגן לא עובד", status:"open"}];
  const after = [{id:"fault_1", title:"מזגן לא עובד", status:"closed"}];
  const d = decide({docId:"shed3_faults_list", before, after});
  record("שינוי סטטוס בתקלה קיימת (לא תקלה חדשה) -> לא שולח התראה",
    d === null, JSON.stringify(d));
}

// 4. תקלת בינוי חדשה (מסגרת כלשהי מדווחת) -> שולח תמיד ל-מ״ע אחזקה (shedId="maint"),
//    בגוף ההודעה מצוין מאיזו מסגרת הגיע הדיווח
{
  const before = [];
  const after = [{id:"binui_1", title:"סדק בקיר", by:"רון", shedId:"shed2", shedName:"סככה 2", status:"פתוח"}];
  const d = decide({docId:"binui_faults_list", before, after});
  record("תקלת בינוי חדשה: שולח ל-מ״ע אחזקה (shedId=maint) עם commandersOnly=true",
    d !== null && d.kind==="binui_fault" && d.shedId==="maint" && d.commandersOnly===true,
    JSON.stringify(d));
  record("גוף ההודעה כולל את שם המסגרת המדווחת ואת כותרת התקלה",
    d && d.body==="סככה 2: סדק בקיר", d && d.body);
}

// 5. תקלת בינוי מדווחת ע"י מחלקה (dept) עם שם מורכב (מסגרת · מחלקה) -> מוצג כמו שהוא
{
  const before = [];
  const after = [{id:"binui_2", title:"דלת שבורה", by:"עומר", shedId:"dept", shedName:"מחלקות · לוגיסטיקה", status:"פתוח"}];
  const d = decide({docId:"binui_faults_list", before, after});
  record("תקלת בינוי ממחלקה: שם המסגרת/מחלקה המלא מוצג בגוף ההודעה",
    d && d.body==="מחלקות · לוגיסטיקה: דלת שבורה", d && d.body);
}

// 6. כמה תקלות בינוי מכמה מסגרות שונות בכתיבה אחת -> עדיין מזהה ומטפל (לפי הפריט הראשון)
{
  const before = [{id:"binui_1", title:"ישן", shedId:"shed1", shedName:"סככה 1"}];
  const after = [
    {id:"binui_2", title:"חדש", shedId:"shed4", shedName:"סככה 4"},
    {id:"binui_1", title:"ישן", shedId:"shed1", shedName:"סככה 1"},
  ];
  const d = decide({docId:"binui_faults_list", before, after});
  record("תקלת בינוי: מזהה נכון פריט חדש יחיד מתוך רשימה עם גם פריטים ישנים",
    d && d.kind==="binui_fault" && d.body.includes("חדש") && d.count===1, JSON.stringify(d));
}

// 7. מסמך faults_list ריק (כל התקלות נמחקו) -> לא שולח (אין פריטים חדשים)
{
  const before = [{id:"fault_1", title:"טופל", status:"closed"}];
  const after = [];
  const d = decide({docId:"shed1_faults_list", before, after});
  record("מחיקת כל התקלות (מערך התרוקן) -> לא שולח התראה", d === null, JSON.stringify(d));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
