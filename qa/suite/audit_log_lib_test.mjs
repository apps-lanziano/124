/* בקשת המשתמש: "יומן ביקורת שרת-צד לפעולות רגישות (הוספה/מחיקה של
   משתמש, שינוי הרשאות, שינוי תפקיד, שינוי פרטי כוח אדם, פעולות מנהל) —
   שלא ניתן לזייף/למחוק מהלקוח". functions/lib/audit_log.js הוא הלוגיקה
   הטהורה (דיף לפני/אחרי) שהטריגר auditSensitiveWrites (functions/index.js)
   מריץ על כל כתיבה ל-sq124/{docId} שמזוהה כרגישה — נבדקת כאן בלי
   emulator, כמו lib/notify.js. */
import {isSensitiveDocId, buildAuditEntries, diffPersonnel, diffAuthProfile, diffOwnerLog, describeProfile} from '../../functions/lib/audit_log.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. isSensitiveDocId מזהה בדיוק את שלושת סוגי המסמכים הרגישים, ולא כל דבר אחר
{
  const cases = [
    ["shed3_cfg_personnel", true],
    ["dept_cfg_personnel", true],
    ["authprofile_abc123", true],
    ["owner_log", true],
    ["board_roster", false],
    ["admin_messages", false],       // admin_* מכוסה כבר ע"י Firestore rules, לא ע"י היומן הזה
    ["shed3_cfg_tasks", false],
  ];
  const ok = cases.every(([id, expect]) => isSensitiveDocId(id) === expect);
  record("isSensitiveDocId: מזהה cfg_personnel/authprofile_/owner_log בלבד",
    ok, JSON.stringify(cases.map(([id]) => [id, isSensitiveDocId(id)])));
}

// 2. הוספת איש צוות חדש
{
  const before = [{name:"דני", role:"חייל"}];
  const after  = [{name:"דני", role:"חייל"}, {name:"רון", role:"חייל"}];
  const entries = diffPersonnel(before, after);
  record("diffPersonnel: הוספת איש צוות מזוהה",
    entries.length===1 && entries[0].action==="הוספת איש צוות" && entries[0].target==="רון",
    JSON.stringify(entries));
}

// 3. הסרת איש צוות
{
  const before = [{name:"דני", role:"חייל"}, {name:"רון", role:"חייל"}];
  const after  = [{name:"דני", role:"חייל"}];
  const entries = diffPersonnel(before, after);
  record("diffPersonnel: הסרת איש צוות מזוהה",
    entries.length===1 && entries[0].action==="הסרת איש צוות" && entries[0].target==="רון",
    JSON.stringify(entries));
}

// 4. שינוי תפקיד (הכי קריטי — שינוי הרשאות) מזוהה עם ערך ישן וחדש
{
  const before = [{name:"דני", role:"חייל"}];
  const after  = [{name:"דני", role:"מפקד"}];
  const entries = diffPersonnel(before, after);
  record("diffPersonnel: שינוי תפקיד (חייל→מפקד) מזוהה עם ערכים",
    entries.length===1 && entries[0].action==="עדכון פרטי איש צוות" &&
    entries[0].detail.includes("חייל") && entries[0].detail.includes("מפקד"),
    JSON.stringify(entries));
}

// 5. הגדרת/איפוס PIN מזוהה, בלי לחשוף את הגיבוב עצמו בפרטי היומן
{
  const before = [{name:"דני", role:"חייל"}];
  const after  = [{name:"דני", role:"חייל", pinHash:"abcd1234"}];
  const entries = diffPersonnel(before, after);
  record("diffPersonnel: הגדרת PIN מזוהה בלי לחשוף את הגיבוב",
    entries.length===1 && entries[0].detail.includes("PIN") && !entries[0].detail.includes("abcd1234"),
    JSON.stringify(entries));
}

// 6. שינוי לא-רלוונטי (למשל customFields/refresh) לא מייצר רעש ביומן
{
  const before = [{name:"דני", role:"חייל", customFields:{x:"1"}, refresh:"2026-01-01"}];
  const after  = [{name:"דני", role:"חייל", customFields:{x:"2"}, refresh:"2026-02-01"}];
  const entries = diffPersonnel(before, after);
  record("diffPersonnel: שינוי customFields/refresh בלבד לא מייצר רשומה",
    entries.length===0, JSON.stringify(entries));
}

// 7. שום שינוי בפועל — אין רשומות (שמירה חוזרת של אותה רשימה)
{
  const list = [{name:"דני", role:"חייל"}];
  const entries = diffPersonnel(list, JSON.parse(JSON.stringify(list)));
  record("diffPersonnel: אין שינוי בפועל → אין רשומות",
    entries.length===0, JSON.stringify(entries));
}

// 8. authprofile — הקצאת קוד כניסה חדש (יצירה, before===undefined)
{
  const entries = diffAuthProfile("authprofile_x", undefined, {kind:"framework", shedId:"shed3", role:"מפקד"});
  record("diffAuthProfile: הקצאת קוד חדש מזוהה",
    entries.length===1 && entries[0].action==="הקצאת קוד כניסה" && entries[0].detail.includes("מפקד"),
    JSON.stringify(entries));
}

// 9. authprofile — ביטול קוד (מחיקה, after===undefined)
{
  const entries = diffAuthProfile("authprofile_x", {kind:"tech"}, undefined);
  record("diffAuthProfile: ביטול קוד מזוהה",
    entries.length===1 && entries[0].action==="ביטול קוד כניסה" && entries[0].detail===describeProfile({kind:"tech"}),
    JSON.stringify(entries));
}

// 10. authprofile — ללא שינוי בפועל
{
  const prof = {kind:"framework", shedId:"shed3", role:"חייל"};
  const entries = diffAuthProfile("authprofile_x", prof, JSON.parse(JSON.stringify(prof)));
  record("diffAuthProfile: אין שינוי → אין רשומות", entries.length===0, JSON.stringify(entries));
}

// 11. owner_log — תוספת חדשה בראש (unshift) מזוהה, כולל "מי" מתוך הרשומה עצמה
{
  const before = [{text:"פעולה ישנה", by:"א'"}];
  const after  = [{text:"הוסיף משתמש \"רון\" לסככה 3", by:"אור דבח"}, {text:"פעולה ישנה", by:"א'"}];
  const entries = diffOwnerLog(before, after);
  record("diffOwnerLog: תוספת חדשה מזוהה עם 'מי' מהרשומה",
    entries.length===1 && entries[0].by==="אור דבח" && entries[0].detail.includes("רון"),
    JSON.stringify(entries));
}

// 12. owner_log — קיצור המערך (slice) בלי תוספת לא מייצר רשומות
{
  const before = [{text:"א", by:"x"}, {text:"ב", by:"y"}, {text:"ג", by:"z"}];
  const after  = before.slice(0,2);
  const entries = diffOwnerLog(before, after);
  record("diffOwnerLog: קיצור המערך בלי תוספת → אין רשומות",
    entries.length===0, JSON.stringify(entries));
}

// 13. buildAuditEntries מנתב לפי docId (מבחן אינטגרציה קליל של הקובץ כולו)
{
  const a = buildAuditEntries("shed2_cfg_personnel", [], [{name:"נועה", role:"חייל"}]);
  const b = buildAuditEntries("authprofile_yyy", undefined, {kind:"owner"});
  const c = buildAuditEntries("owner_log", [], [{text:"t", by:"b"}]);
  const d = buildAuditEntries("board_roster", {a:1}, {a:2});
  record("buildAuditEntries: מנתב נכון לכל סוג מסמך, ומחזיר [] למסמך לא-רגיש",
    a.length===1 && b.length===1 && c.length===1 && d.length===0,
    JSON.stringify({a,b,c,d}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
