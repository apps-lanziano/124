/* בקשה (2026-08-23): "התראה על שינוי לוח צוות תורן רק לחייל שמתווסף/יורד
   ולמפקד שלו". בודק את functions/lib/roster_changes.js — הדיף שקובע *מי*
   בכלל מקבל את ההתראה ומה כתוב בה. ההצלבה מול הנתונים החיים (שם→מסגרת לפי
   cfg_personnel, שם→מכשיר לפי push_tokens) יושבת ב-functions/index.js
   ונבדקת ב-scheduled_functions_wiring_test.mjs (בדיקת חיווט), כי
   firebase-admin לא מותקן בסביבת הבדיקה. */
import { diffRosterWeek, personalChangeBody, commanderChangeBody, dayAssignments } from '../../functions/lib/roster_changes.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const bodies = (map) => Object.fromEntries([...map].map(([n,c]) => [n, personalChangeBody(c)]));

// 1. חייל שנוסף לשורה — רק הוא במפה, ושאר המשובצים באותו יום לא
{
  const before = {days:{ראשון:{lead:"דני", pf:[{name:"יוסי"}]}}};
  const after  = {days:{ראשון:{lead:"דני", pf:[{name:"יוסי"},{name:"רון"}]}}};
  const d = diffRosterWeek(before, after);
  record("חייל שנוסף ל-PF: רק הוא מקבל התראה, מי שלא זז לא נכנס לרשימה",
    d.size===1 && d.has("רון") && personalChangeBody(d.get("רון"))==="נוסף: PF (ראשון)",
    JSON.stringify(bodies(d)));
}

// 2. חייל שירד מהשורה
{
  const before = {days:{שני:{pms:["יוסי","רון"]}}};
  const after  = {days:{שני:{pms:["יוסי"]}}};
  const d = diffRosterWeek(before, after);
  record("חייל שירד מ-PMS: מופיע כ'ירד', עם שם השורה והיום",
    d.size===1 && personalChangeBody(d.get("רון"))==="ירד: PMS (שני)", JSON.stringify(bodies(d)));
}

// 3. מעבר בין משבצות באותו יום — נספר גם כירידה וגם כתוספת, לאותו חייל
{
  const before = {days:{שלישי:{driver:"רון", pf:[]}}};
  const after  = {days:{שלישי:{driver:"", pf:[{name:"רון"}]}}};
  const d = diffRosterWeek(before, after);
  record("חייל שהוזז מנהג ל-PF באותו יום: התראה אחת שמראה גם מה ירד וגם מה נוסף",
    d.size===1 && personalChangeBody(d.get("רון"))==="נוסף: PF (שלישי) · ירד: נהג (שלישי)",
    JSON.stringify(bodies(d)));
}

// 4. ⛔ duty/rest הם שדות *נגזרים* (saveDutyRosterV2 בונה אותם מהשאר) —
// אסור שייספרו, אחרת כל שינוי יופיע פעמיים ויוצג כשיבוץ שלא קיים בלוח
{
  const before = {days:{ראשון:{pf:[], duty:[], rest:[]}}};
  const after  = {days:{ראשון:{pf:[{name:"רון"}], duty:["רון"], rest:[]}}};
  const d = diffRosterWeek(before, after);
  record("שדות נגזרים (duty/rest) לא נספרים — שיבוץ אחד מפיק שורה אחת בהתראה",
    d.size===1 && personalChangeBody(d.get("רון"))==="נוסף: PF (ראשון)", JSON.stringify(bodies(d)));
}

// 5. משמרת סופ״ש (חמישי+שישי+שבת) נשמרת כשלושה ימים אך מתארת משמרת רצופה
// אחת — מכווצת לטווח אחד כדי שההתראה לא תיראה כשלושה שיבוצים נפרדים
{
  const empty = {pf:[]};
  const staffed = {pf:[{name:"רון"}]};
  const before = {days:{חמישי:empty, שישי:empty, שבת:empty}};
  const after  = {days:{חמישי:staffed, שישי:staffed, שבת:staffed}};
  const d = diffRosterWeek(before, after);
  record("שיבוץ למשמרת סופ״ש שלמה מוצג כטווח אחד (חמישי–שבת), לא כשלושה ימים",
    personalChangeBody(d.get("רון"))==="נוסף: PF (חמישי–שבת)", JSON.stringify(bodies(d)));
}

// 6. מספר ימים לאותו תפקיד מקובצים יחד, לפי סדר השבוע
{
  const before = {days:{ראשון:{pf:[]}, שני:{pf:[]}, רביעי:{pf:[]}}};
  const after  = {days:{רביעי:{pf:[{name:"רון"}]}, ראשון:{pf:[{name:"רון"}]}, שני:{pf:[{name:"רון"}]}}};
  const d = diffRosterWeek(before, after);
  record("כמה ימים באותו תפקיד מקובצים לשורה אחת, בסדר ימי השבוע",
    personalChangeBody(d.get("רון"))==="נוסף: PF (ראשון, שני, רביעי)", JSON.stringify(bodies(d)));
}

// 7. שורה מותאמת-אישית — התווית שהמ״ע הגדיר, ולא מזהה גולמי
{
  const before = {days:{ראשון:{custom_a1:[]}}};
  const after  = {days:{ראשון:{custom_a1:["רון"]}}};
  const withLabel = diffRosterWeek(before, after, {customRowLabels:{a1:"PF יום ולילה"}});
  const noLabel = diffRosterWeek(before, after);
  record("שורה מותאמת-אישית: מוצגת בתווית שהוגדרה, ובלי הגדרות — בתווית גנרית ולא במזהה",
    personalChangeBody(withLabel.get("רון"))==="נוסף: PF יום ולילה (ראשון)" &&
    personalChangeBody(noLabel.get("רון"))==="נוסף: שיבוץ נוסף (ראשון)",
    JSON.stringify([bodies(withLabel), bodies(noLabel)]));
}

// 8. תורנות בסיסית ([{name,type}]) ומתגבר (מערך שמות) — גם הם שיבוץ לכל דבר
{
  const before = {days:{שני:{basic:[], fixedAug:[]}}};
  const after  = {days:{שני:{basic:[{name:"יוסי", type:"מטבח"}], fixedAug:["רון"]}}};
  const d = diffRosterWeek(before, after);
  record("תורנות בסיסית ומתגבר נספרים כשיבוץ (מבני הנתונים השונים שלהם נקראים נכון)",
    d.size===2 && personalChangeBody(d.get("יוסי"))==="נוסף: תורנות (שני)" &&
    personalChangeBody(d.get("רון"))==="נוסף: מתגבר (שני)", JSON.stringify(bodies(d)));
}

// 9. לוח זהה לחלוטין / שינוי מטא-דאטה בלבד — אף אחד לא מקבל התראה
{
  const days = {ראשון:{lead:"דני", pf:[{name:"יוסי"}]}};
  const d = diffRosterWeek({restWindow:"א", days}, {restWindow:"ב", disabledRows:["pms"], days});
  record("שמירה שלא שינתה אף שיבוץ (רק מטא-דאטה) — מפת השינויים ריקה, אין למי לשלוח",
    d.size===0, String(d.size));
}

// 10. שם שמשובץ בשתי משבצות באותו יום (פקיד כלים שהוא גם PF) — מצב תקין
{
  const a = dayAssignments({tools:"רון", pf:[{name:"רון"}]});
  record("שם בשתי משבצות באותו יום נקרא כשני תפקידים, לא כשגיאה",
    a.size===1 && a.get("רון").size===2, JSON.stringify([...a].map(([n,s])=>[n,[...s]])));
}

// 11. גוף ההתראה למפקד — יחיד מול רבים, וקיצור רשימה ארוכה
{
  const one = commanderChangeBody(["רון כהן"]);
  const many = commanderChangeBody(["א","ב","ג"]);
  const long = commanderChangeBody(["א","ב","ג","ד","ה","ו","ז","ח"]);
  record("גוף ההתראה למפקד: ניסוח ליחיד, ניסוח לרבים, וקיצור ל'ועוד N' ברשימה ארוכה",
    one==="רון כהן — עודכן בלוח הצוות התורן" &&
    many==="3 מאנשי הצוות שלך עודכנו בלוח: א, ב, ג" &&
    /^8 מאנשי הצוות שלך עודכנו בלוח: א, ב, ג, ד, ה, ו ועוד 2$/.test(long),
    JSON.stringify([one, many, long]));
}

// 12. גוף ההתראה האישית נחתך באורך סביר לפוש (לא נשלח טקסט אינסופי)
{
  const change = {added: Array.from({length:40}, (_,i)=>({day:"ראשון", label:"תפקיד"+i})), removed: []};
  const body = personalChangeBody(change);
  record("גוף ההתראה האישית מוגבל באורך ומסתיים ב-… כשהוא נחתך",
    body.length<=140 && body.endsWith("…"), String(body.length));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
