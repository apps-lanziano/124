/* תזכורת אוטומטית — סקירת מ״ע אחזקה יומית (רכבים/טסטים/רישיונות/הזמנות
   חומרים/כלים מוטוריים). עד עכשיו תחומים אלה לא היה להם שום מנגנון תזכורת;
   בודק את functions/lib/vo_reminders.js — לוגיקה טהורה, בלי emulator. */
import { findVoIssues, vehicleNeedsAttention, daysUntil, findExpiringLicensesByShed } from '../../functions/lib/vo_reminders.js';

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

// 7. findExpiringLicensesByShed: מקבצת נכון לפי shedId (לא רק סיכום למ״ע אחזקה)
{
  const db = fakeDb({
    "sq124/vo_licenses_list": [
      { id:"lic1", shedId:"shed1", person:"דני כהן", type:"פ.ת", expiry:"2000-01-01" },   // פג תוקף
      { id:"lic2", shedId:"shed2", person:"רותם לוי", type:"ס.ף", expiry:"2099-01-01" },  // בתוקף, לא נכלל
      { id:"lic3", shedId:"shed1", person:"יוסי מזרחי", type:"רישיון צבאי", expiry:"2000-02-01" }, // פג תוקף, אותה מסגרת כמו lic1
    ],
  });
  const {toSend} = await findExpiringLicensesByShed(db, { now: Date.now() });
  const shed1 = toSend.find(g=>g.shedId==="shed1");
  const shed2 = toSend.find(g=>g.shedId==="shed2");
  record("סככה 1 מקבלת רק את שני הרישיונות שלה שפגי תוקף, מקובצים יחד", !!shed1 && shed1.items.length===2, JSON.stringify(shed1));
  record("סככה 2 (רישיון בתוקף) לא נכללת כלל בתקצירים", !shed2, JSON.stringify(toSend));
}

// 8. findExpiringLicensesByShed: cooldown — לא מזכירים פעמיים תוך התקופה, אבל כן ממשיכים אחריה
{
  const now = Date.now();
  const db = fakeDb({
    "sq124/vo_licenses_list": [{ id:"lic9", shedId:"shed3", person:"דנה שני", type:"פ.ת", expiry:"2000-01-01" }],
    "sq124/_license_reminder_log": { lic9: now - 2*86400000 },   // הוזכר לפני יומיים
  });
  const within = await findExpiringLicensesByShed(db, { now, cooldownDays: 7 });
  record("תוך תקופת ה-cooldown לא נשלחת תזכורת שוב על אותו רישיון", within.toSend.length===0, JSON.stringify(within.toSend));
  const after = await findExpiringLicensesByShed(db, { now, cooldownDays: 1 });
  record("אחרי שחלף ה-cooldown, התזכורת חוזרת", after.toSend.length===1, JSON.stringify(after.toSend));
}

// 9. findExpiringLicensesByShed: רישיון בלי shedId (נתונים ישנים/חסרים) מדולג בלי קריסה
{
  const db = fakeDb({
    "sq124/vo_licenses_list": [{ id:"lic7", person:"עלום", type:"פ.ת", expiry:"2000-01-01" }],
  });
  const {toSend} = await findExpiringLicensesByShed(db, { now: Date.now() });
  record("רישיון בלי shedId מדולג בלי לקרוס ובלי להיכנס לאף תקציר", toSend.length===0, JSON.stringify(toSend));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
