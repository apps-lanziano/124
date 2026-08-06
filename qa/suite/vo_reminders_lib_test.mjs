/* תזכורת אוטומטית — סקירת מ״ע אחזקה יומית (רכבים/טסטים/רישיונות/הזמנות
   חומרים/כלים מוטוריים). עד עכשיו תחומים אלה לא היה להם שום מנגנון תזכורת;
   בודק את functions/lib/vo_reminders.js — לוגיקה טהורה, בלי emulator. */
import { findVoIssues, vehicleNeedsAttention, daysUntil } from '../../functions/lib/vo_reminders.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

function fakeDb(docs){
  return {
    doc(path){
      return {
        async get(){
          const v = docs[path];
          return { exists: v !== undefined, data: () => ({ v }) };
        },
      };
    },
  };
}

// 1. vehicleNeedsAttention: רכב "בטיפול" משתיק הכל, גם עם תאריכים שעברו
{
  const v = { testDate:"2000-01-01", nextService:"2000-01-01", inService:true };
  record("רכב 'בטיפול' לא נחשב דורש תשומת לב", vehicleNeedsAttention(v, Date.now())===false, JSON.stringify(v));
}

// 2. vehicleNeedsAttention: טסט שעבר / קרוב לפקיעה -> כן
{
  const soon = new Date(); soon.setDate(soon.getDate()+10);
  const v = { testDate: soon.toISOString().slice(0,10) };
  record("טסט בעוד 10 ימים (מתחת לסף 30) -> דורש תשומת לב", vehicleNeedsAttention(v, Date.now())===true, JSON.stringify(v));
}

// 3. vehicleNeedsAttention: ק"מ קרוב ליעד -> כן
{
  const v = { km: 9600, kmService: 10000 };
  record("נשארו 400 ק\"מ (מתחת לחיץ 500) -> דורש תשומת לב", vehicleNeedsAttention(v, Date.now())===true, JSON.stringify(v));
}

// 4. vehicleNeedsAttention: הכל בתוקף -> לא
{
  const far = new Date(); far.setFullYear(far.getFullYear()+2);
  const v = { testDate: far.toISOString().slice(0,10), nextService: far.toISOString().slice(0,10), km:1000, kmService:50000 };
  record("כל התאריכים/ק\"מ רחוקים -> לא דורש תשומת לב", vehicleNeedsAttention(v, Date.now())===false, JSON.stringify(v));
}

// 5. findVoIssues: מסכם נכון על פני רכבים (מכמה מסגרות), רישיונות, חומרים, כלים
{
  const db = fakeDb({
    "sq124/shed1_vehicles_list": [{ name:"רכב1", testDate:"2000-01-01" }],       // דורש טיפול
    "sq124/shed2_vehicles_list": [{ name:"רכב2", inService:true, testDate:"2000-01-01" }], // בטיפול -> לא נספר
    "sq124/vo_licenses_list": [
      { person:"א", type:"פ.ת", expiry:"2000-01-01" },  // פג תוקף
      { person:"ב", type:"ס.ף", expiry:"2099-01-01" },  // בתוקף, לא נספר
    ],
    "sq124/maint_materials_list": [
      { name:"שמן", status:"ממתין להזמנה" },
      { name:"מסננים", status:"התקבל" },   // לא נספר
    ],
    "sq124/maint_motor_tools_list": [
      { name:"מפתח מומנט", nextCheck:"2000-01-01" },
    ],
  });
  const summary = await findVoIssues(db, { shedIds: ["shed1","shed2"] });
  record("סופר נכון: 1 רכב, 1 רישיון, 1 חומר, 1 כלי, סה\"כ 4",
    summary.vehCount===1 && summary.licCount===1 && summary.matCount===1 && summary.toolCount===1 && summary.totalCount===4,
    JSON.stringify(summary));
}

// 6. findVoIssues: כשאין שום בעיה בשום תחום -> totalCount=0 (לא שולחים פוש)
{
  const db = fakeDb({});
  const summary = await findVoIssues(db, { shedIds: ["shed1"] });
  record("אין נתונים בכלל -> totalCount=0", summary.totalCount===0, JSON.stringify(summary));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
