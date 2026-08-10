/* ============================================================
   סוכן 5 — נתונים חיים מ-Firebase
   ------------------------------------------------------------
   הסוכנים האחרים בודקים את *הקוד*. הסוכן הזה בודק את *הנתונים
   האמיתיים* של הטייסת, ולכן הוא היחיד שיכול לתפוס דברים כמו:
     · קרא-וחתום שפורסם אבל לא הגיע לכל המסגרות
     · מסגרת שלא תרד לה אף התראה (אין מכשירים רשומים)
     · חיילים שאין להם PIN ולא יוכלו להיכנס
     · לוח צוות שלא עודכן שבועות

   ⚠️ פרטיות — קריטי:
   המאגר הזה ציבורי. לכן הסוכן הזה **לעולם אינו מוציא שמות של
   אנשים** — רק מספרים ושמות מסגרות. בנוסף, הפלט שלו נשמר בקובץ
   נפרד שאינו נכנס למאגר (qa/reports/live_*.json ב-.gitignore),
   ומגיע רק לדוח האישי.

   הרשאה: משתנה הסביבה FIREBASE_SA_KEY (מפתח שירות, קריאה בלבד).
   בלי המשתנה — הסוכן מדלג בשקט ולא מכשיל את הריצה.
   ============================================================ */

const COLLECTION = "sq124";
const SHEDS = [
  {id:"shed1", name:"סככה 1"}, {id:"shed2", name:"סככה 2"}, {id:"shed3", name:"סככה 3"},
  {id:"shed4", name:"סככה 4"}, {id:"shed5", name:"סככה 5"},
  {id:"dept", name:"מחלקות"}, {id:"maint", name:"מ״ע אחזקה"}, {id:"training", name:"הדרכה"},
];

const findings = [];
function add(sev, title, detail){ findings.push({sev, area:"נתונים חיים", title, detail}); }

export async function run(){
  const raw = process.env.FIREBASE_SA_KEY;
  if(!raw || !raw.trim()){
    return { name:"נתונים חיים", skipped:true, summary:{}, findings:[{
      sev:"info", area:"נתונים חיים", title:"בדיקת הנתונים החיים לא רצה",
      detail:"לא הוגדר מפתח גישה ל-Firebase. הבדיקה על הקוד רצה כרגיל; "+
             "כדי לבדוק גם את הנתונים האמיתיים יש להוסיף את המפתח (ר' qa/README.md)."
    }]};
  }

  let db;
  try{
    const admin = await import('firebase-admin');
    const creds = JSON.parse(raw);
    const app = admin.default.apps?.length
      ? admin.default.app()
      : admin.default.initializeApp({ credential: admin.default.credential.cert(creds) });
    db = admin.default.firestore(app);
  }catch(e){
    return { name:"נתונים חיים", summary:{}, findings:[{
      sev:"high", area:"נתונים חיים", title:"החיבור ל-Firebase נכשל",
      detail:"לא הצלחתי להתחבר עם המפתח שהוגדר. ייתכן שהמפתח פג, נמחק, או הוגדר לא נכון. פירוט: "+String(e && e.message).slice(0,200)
    }]};
  }

  /* קריאת מסמך בודד לפי מפתח — בדיוק כמו שהאפליקציה עושה */
  const get = async key => {
    try{
      const snap = await db.collection(COLLECTION).doc(key.replace(/[\/\.\#\$\[\]]/g,"_")).get();
      return snap.exists ? snap.data().v : null;
    }catch{ return null; }
  };
  const arr = async key => { const v = await get(key); return Array.isArray(v) ? v : []; };

  /* ---------- אבחון דחוף (מספרים בלבד, ללא שמות) ----------
     נועד לאמת מול Firestore אם רשימות הצוות קיימות — לתפיסת דיווח על
     "מחיקת משתמשים". בטוח לפרסום: רק מונים ומצב מסמך לכל מסגרת. */
  try{
    const parts = [];
    for(const shed of SHEDS){
      const raw = await get(shed.id+"_cfg_personnel");
      const n = Array.isArray(raw) ? raw.length : (raw===null ? "missing" : "notarr");
      const pins = Array.isArray(raw) ? raw.filter(p=>p && p.pinHash).length : 0;
      parts.push(`${shed.id}=${n}(pin:${pins})`);
    }
    console.error("[חי·אבחון אנשי צוות] " + parts.join(" "));
  }catch(e){ console.error("[חי·אבחון] נכשל:", String(e&&e.message).slice(0,120)); }

  /* ---------- 1. פריטים שפורסמו אך לא הגיעו לכל המסגרות ---------- */
  {
    const adminEvents = await arr("admin_events");
    const gaps = [];
    for(const shed of SHEDS){
      const local = await arr(shed.id+"_safety_events");
      const ids = new Set(local.map(e=>e && e.id));
      const missing = adminEvents.filter(e=>e && e.id && !ids.has(e.id));
      if(missing.length) gaps.push({shed:shed.name, count:missing.length, titles:missing.slice(0,2).map(m=>m.title)});
    }
    if(gaps.length){
      add("high","קרא-וחתום שפורסם לא הגיע לכל המסגרות",
        gaps.map(g=>`${g.shed}: חסרים ${g.count} פריטים (למשל "${g.titles[0]}")`).join(" · ") +
        ". המשמעות: אנשי המסגרות האלה לא רואים את הפריט ולא יכולים לחתום עליו.");
    } else if(adminEvents.length){
      add("info","כל פריטי הקרא-וחתום הגיעו לכל המסגרות",
        `נבדקו ${adminEvents.length} פריטים מול ${SHEDS.length} מסגרות — אין פערים.`);
    }
  }

  /* ---------- 2. חומרי הדרכה שלא הגיעו ---------- */
  {
    const adminTraining = await arr("admin_training");
    const gaps = [];
    for(const shed of SHEDS){
      const local = await arr(shed.id+"_training_list");
      const ids = new Set(local.map(e=>e && e.id));
      const missing = adminTraining.filter(e=>e && e.id && !ids.has(e.id));
      if(missing.length) gaps.push(`${shed.name}: ${missing.length}`);
    }
    if(gaps.length) add("high","חומרי הדרכה שפורסמו לא הגיעו לכל המסגרות", gaps.join(" · "));
  }

  /* ---------- 3. מסגרות שלא יקבלו התראות ---------- */
  {
    const none = [];
    for(const shed of SHEDS){
      const tokens = await get("push_tokens_"+shed.id);
      const n = tokens && typeof tokens === "object" ? Object.keys(tokens).length : 0;
      if(n === 0) none.push(shed.name);
    }
    if(none.length){
      add(none.length === SHEDS.length ? "high" : "med",
        "מסגרות שלא מקבלות התראות כלל",
        `${none.join(", ")} — אין באף מכשיר במסגרות האלה אישור להתראות. `+
        `כל פרסום שיישלח אליהן לא ייצור התראה בטלפון. `+
        `הפתרון: להתקין את האפליקציה מהמסך הבית ולאשר התראות.`);
    } else {
      add("info","כל המסגרות רשומות להתראות","בכל מסגרת יש לפחות מכשיר אחד שמקבל התראות.");
    }
  }

  /* ---------- 4. חיילים בלי PIN (מספרים בלבד — בלי שמות) ---------- */
  {
    const rows = [];
    let totalPeople = 0, totalNoPin = 0;
    for(const shed of SHEDS){
      const people = await arr(shed.id+"_cfg_personnel");
      const active = people.filter(p=>p && !(p.release && p.release <= new Date().toISOString().slice(0,10)));
      const noPin = active.filter(p=>!p.pinHash).length;
      totalPeople += active.length; totalNoPin += noPin;
      if(noPin) rows.push(`${shed.name}: ${noPin} מתוך ${active.length}`);
    }
    if(rows.length){
      add(totalNoPin > totalPeople/2 ? "med" : "info",
        "אנשים שטרם הגדירו PIN אישי",
        rows.join(" · ") + `. (סה"כ ${totalNoPin} מתוך ${totalPeople}.) `+
        `זה תקין למי שעדיין לא נכנס לאפליקציה — הוא יתבקש להגדיר בכניסה הראשונה.`);
    }
  }

  /* ---------- 5. לוח צוות שלא עודכן ---------- */
  {
    const stale = [];
    for(const shed of SHEDS){
      const boards = await arr(shed.id+"_boards_list");
      if(!boards.length){ stale.push(`${shed.name}: אין לוח כלל`); continue; }
      const newest = boards[0];
      const m = /board_(\d{10,})/.exec(newest.id || "");
      if(m){
        const days = Math.floor((Date.now() - Number(m[1]))/86400000);
        if(days > 10) stale.push(`${shed.name}: ${days} ימים`);
      }
    }
    if(stale.length) add("med","לוח צוות שלא עודכן",
      stale.join(" · ") + ". ייתכן שזה תקין (חופשה/תקופה שקטה), וייתכן שהעלאה נכשלה.");
  }

  /* ---------- 6. שלמות נתונים ---------- */
  {
    const problems = [];
    for(const shed of SHEDS){
      const people = await arr(shed.id+"_cfg_personnel");
      const names = people.map(p=>p && p.name).filter(Boolean);
      const dupes = names.length - new Set(names).size;
      if(dupes > 0) problems.push(`${shed.name}: ${dupes} רשומות כפולות`);
      const noRole = people.filter(p=>p && !p.role).length;
      if(noRole > 0) problems.push(`${shed.name}: ${noRole} ללא תפקיד`);
    }
    if(problems.length) add("med","רשומות צוות לא תקינות",
      problems.join(" · ") + ". כדאי לבדוק בניהול הצוות של המסגרות האלה.");
    else add("info","נתוני הצוות תקינים","אין רשומות כפולות או חסרות תפקיד באף מסגרת.");
  }

  const bySev = s => findings.filter(f=>f.sev===s).length;
  return {
    name: "נתונים חיים",
    summary: { high:bySev("high"), med:bySev("med"), info:bySev("info") },
    findings,
  };
}

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.findings.some(f=>f.sev==="high") ? 1 : 0);
}
