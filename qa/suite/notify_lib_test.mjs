/* דווח: "אחראי הדרכה פרסם הודעה אבל היא לא שלחה התראה". בודק את
   functions/lib/notify.js (לוגיקת ההחלטה של notifyOnPublish) מול הרצף
   המדויק של כתיבות ש-saveMessage() מבצע בפרסום כלל-טייסתי — פעם ראשונה
   ופעם שנייה (כשכבר יש הודעה קודמת ברשימה) — ומול תרחיש שקורא מסמן
   הודעה כנקראה (לא אמור לשלוח שוב). */
import { decide, classify } from '../../functions/lib/notify.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. סיווג docId — הודעה מזוהה נכון מכל מסגרת, כולל dept/maint/training
{
  const cases = [
    ["shed2_messages_list", "message"],
    ["dept_messages_list", "message"],
    ["maint_messages_list", "message"],
    ["training_messages_list", "message"],
    ["admin_messages", null],          // עותק המנהל — לא אמור לעורר שליחה בעצמו
    ["shed2_cfg_personnel", null],
  ];
  const ok = cases.every(([id, expect]) => classify(id) === expect);
  record("classify: מזהה 'message' רק לפי הסיומת הנכונה, בכל סוגי המסגרות",
    ok, JSON.stringify(cases.map(([id])=>[id, classify(id)])));
}

// 2. פרסום ראשון אי-פעם למסגרת (התיעוד לא קיים קודם) — חייב לשלוח
{
  const msgObj = {id:"msg_"+Date.now(), text:"הודעה כלל-טייסתית", type:"normal", by:"טומי", date:"1.1"};
  const d = decide({ docId:"shed2_messages_list", before: undefined, after: [msgObj] });
  record("פרסום ראשון למסגרת (אין 'before' בכלל): decide() מחזירה החלטה לשליחה",
    d !== null && d.kind==="message" && d.shedId==="shed2" && d.body===msgObj.text,
    JSON.stringify(d));
}

// 3. פרסום שני (יש כבר הודעה קודמת ברשימה) — עדיין חייב לשלוח, על הפריט החדש בלבד
{
  const older = {id:"msg_1000", text:"הודעה ישנה", by:"טומי", date:"1.1"};
  const newer = {id:"msg_2000", text:"הודעה חדשה", by:"טומי", date:"2.1"};
  const d = decide({ docId:"shed2_messages_list", before:[older], after:[newer, older] });
  record("פרסום שני (יש כבר הודעה אחת ברשימה): decide() משדרת רק על הפריט החדש",
    d !== null && d.body==="הודעה חדשה" && d.count===1, JSON.stringify(d));
}

// 4. סימון "נקרא" (מוטציה על אותו פריט, בלי id חדש) — לא אמור לשלוח שוב
{
  const msg = {id:"msg_3000", text:"הודעה", by:"טומי", date:"1.1"};
  const msgRead = {...msg, reads:{"דני":true}};
  const d = decide({ docId:"shed2_messages_list", before:[msg], after:[msgRead] });
  record("סימון הודעה כנקראה (אותו id, בלי פריט חדש) לא מייצר שליחה",
    d === null, JSON.stringify(d));
}

// 5. שמונה המסגרות — כל אחת מקבלת החלטת שליחה עצמאית לפרסום כלל-טייסתי
{
  const SHEDS = ["shed1","shed2","shed3","shed4","shed5","dept","maint","training"];
  const msgObj = {id:"msg_9999", text:"לכל הטייסת", by:"טומי", date:"1.1"};
  const decisions = SHEDS.map(id => decide({ docId:`${id}_messages_list`, before:[], after:[msgObj] }));
  const allSend = decisions.every(d => d !== null && d.kind==="message");
  const shedIds = decisions.map(d=>d.shedId);
  record("פרסום כלל-טייסתי: כל 8 המסגרות מקבלות החלטת שליחה עצמאית, עם shedId נכון לכל אחת",
    allSend && JSON.stringify(shedIds)===JSON.stringify(SHEDS),
    JSON.stringify(shedIds));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
