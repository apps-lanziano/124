/* ============================================================
   סוכן 2 — אבטחת מידע
   ------------------------------------------------------------
   סורק את קוד האפליקציה, כללי ה-Firestore וה-Cloud Function
   ומחפש פרצות: הזרקת HTML/סקריפט, סודות בקוד, הרשאות רחבות
   מדי, חולשות בשמירת סיסמאות, ודליפת מידע ללקוח.

   מגבלה שחשוב להכיר: זו סריקה *סטטית* של הקוד. היא לא רואה
   תעבורה חיה ולכן לא מזהה חדירה בזמן אמת — לכך נדרשת התראה
   מצד Firebase עצמו (ר' סעיף "ניטור חי" ב-qa/README.md).
   ============================================================ */
import { readFileSync, existsSync } from 'fs';

import { ROOT } from './lib/pw.mjs';   // שורש המאגר — נגזר, לא מקובע
const findings = [];
function add(sev, title, detail, where){ findings.push({sev, area:"אבטחה", title, detail, where}); }

const html = readFileSync(`${ROOT}/index.html`, 'utf8');
const lines = html.split('\n');
const rules = existsSync(`${ROOT}/firestore.rules`) ? readFileSync(`${ROOT}/firestore.rules`,'utf8') : "";
const fn    = existsSync(`${ROOT}/functions/index.js`) ? readFileSync(`${ROOT}/functions/index.js`,'utf8') : "";

function lineOf(idx){ return html.slice(0, idx).split('\n').length; }

/* ---------- 1. XSS — נבדק בזמן ריצה, לא בניחוש סטטי ----------
   ניתוח סטטי של innerHTML מייצר יותר התראות שווא מאשר ממצאים
   (למשל ${ft.label} מטבלת קבועים, או משתנה שכבר מכיל HTML מסונן).
   לכן הבדיקה עברה ל-lib/xss_probe.mjs: מזריקים מטען אמיתי ובודקים
   אם הוא רץ. הממצא מצורף כאן ע"י run(). */

/* ---------- 2. סינקים שמריצים קוד מחרוזתי ---------- */
{
  const sinks = [
    [/\beval\s*\(/g, "eval()", "high"],
    [/new\s+Function\s*\(/g, "new Function()", "high"],
    [/\.outerHTML\s*=/g, "outerHTML=", "med"],
    [/insertAdjacentHTML\s*\(/g, "insertAdjacentHTML()", "med"],
    [/document\.write\s*\(/g, "document.write()", "low"],
  ];
  for(const [re, label, sev] of sinks){
    const hits = [...html.matchAll(re)];
    if(hits.length) add(sev, `שימוש בפקודה ${label}`,
      `${hits.length} מופעים (שורות ${hits.slice(0,4).map(h=>lineOf(h.index)).join(", ")}). ` +
      `זו פקודה שמריצה טקסט כאילו היה קוד. יש לוודא שהטקסט שמגיע אליה לא בא ממשתמש.`,
      "index.html");
  }
}

/* ---------- 3. סודות בקוד ---------- */
{
  const patterns = [
    [/AIza[0-9A-Za-z_\-]{30,}/g, "מפתח Firebase/Google API"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "מפתח פרטי"],
    [/(?:password|passwd|secret|apiSecret|clientSecret)\s*[:=]\s*["'][^"']{6,}["']/gi, "סיסמה/סוד בקוד"],
    [/sk-[A-Za-z0-9]{20,}/g, "מפתח API חיצוני"],
  ];
  for(const [re, label] of patterns){
    const hits = [...html.matchAll(re)];
    if(!hits.length) continue;
    // מפתח Firebase Web הוא ציבורי מעצם הגדרתו — לא ממצא, אלא תזכורת
    const sev = /Firebase\/Google/.test(label) ? "info" : "high";
    const note = /Firebase\/Google/.test(label)
      ? "מפתח Web של Firebase הוא ציבורי מעצם טיבו — ההגנה בפועל היא כללי Firestore + App Check. לא נדרשת פעולה, בתנאי ששני אלה מופעלים."
      : "יש להוציא מהקוד ולהעביר לשרת/משתני סביבה.";
    add(sev, label + " נמצא בקוד",
      `${hits.length} מופעים (שורה ${lineOf(hits[0].index)}). ${note}`, "index.html");
  }
}

/* ---------- 4. כללי Firestore ---------- */
{
  if(!rules){ add("high","קובץ כללי Firestore חסר","לא נמצא firestore.rules — ייתכן שהמסד פתוח.","firestore.rules"); }
  else {
    if(/allow\s+(read|write|get|list|create|update|delete)[^;]*:\s*if\s+true/.test(rules))
      add("high","כלל Firestore פתוח לגמרי (if true)","יש כלל שמתיר גישה ללא כל תנאי — כל אדם באינטרנט יכול לקרוא/לכתוב.","firestore.rules");
    if(!/request\.auth\s*!=\s*null/.test(rules))
      add("high","כללי Firestore לא דורשים אימות","לא נמצאה בדיקת request.auth — המסד עלול להיות נגיש ללא התחברות.","firestore.rules");
    if(/allow\s+list\s*:\s*if\s+(?!false)/.test(rules))
      add("med","שאילתת list מותרת","מאפשר שאיבה המונית של כל המסד בבקשה אחת.","firestore.rules");
    // הפרדה בין מסגרות — כרגע כל מאומת רואה הכל
    if(/allow get:\s*if isAuthed\(\)/.test(rules) && !/myPrefix\(\)/.test(rules.replace(/\/\*[\s\S]*?\*\//g,"")))
      add("med","מסגרת יכולה לקרוא נתונים של מסגרת אחרת",
        "כרגע ההפרדה בין המסגרות קיימת רק במסכים של האפליקציה, לא בשרת. "+
        "מי שמחובר לאפליקציה ויודע לפנות ישירות לשרת יכול למשוך נתונים של כל מסגרת. "+
        "הפתרון כבר כתוב ומוכן בקובץ ההרשאות, אבל הפעלתו דורשת חשבון כניסה נפרד לכל מסגרת — שינוי משמעותי.","firestore.rules");
  }
}

/* ---------- 5. חוזק שמירת ה-PIN ---------- */
{
  const hashFn = html.match(/async function hashPin[\s\S]{0,600}/);
  if(hashFn){
    const body = hashFn[0];
    if(/SHA-1|MD5/i.test(body)) add("high","ה-PIN נשמר בשיטת הצפנה מיושנת ושבורה","יש להחליף לשיטה עדכנית.","index.html");
    const iter = body.match(/iterations\s*:\s*(\d+)/);
    if(/PBKDF2/i.test(body) && iter && Number(iter[1]) < 100000)
      add("med","ההצפנה של ה-PIN חלשה מהמומלץ",`מבוצעים ${iter[1]} סבבי הצפנה. מומלץ 100,000 לפחות.`,"index.html");
    if(!/PBKDF2|bcrypt|scrypt|argon/i.test(body) && /SHA-256/i.test(body))
      add("med","הצפנת ה-PIN ניתנת לפיצוח מהיר",
        "ה-PIN הוא 4 ספרות, כלומר 10,000 אפשרויות בלבד, והוא מוצפן בשיטה מהירה. "+
        "מי שיצליח להשיג את רשימת ההצפנות יוכל לפענח את כל ה-PIN-ים תוך שניות. "+
        "מומלץ לעבור לשיטת הצפנה איטית במכוון, שהופכת פיצוח כזה ללא מעשי. "+
        "חשוב לסייג: הסיכון מתממש רק אם תוקף כבר הצליח לקרוא את נתוני הצוות.","index.html");
    if(!/salt/i.test(body)) add("high","ה-PIN נשמר בלי ערבול אקראי",
      "בלי ערבול, שני אנשים עם אותו PIN מקבלים אותה הצפנה — ואפשר לפענח את כולם בבת אחת מטבלה מוכנה.","index.html");
  }
}

/* ---------- 6. קוד מסגרת/PIN בצד הלקוח ---------- */
{
  if(/const\s+CODES\s*=\s*\{[^}]*\d{4}/.test(html))
    add("high","קודי כניסה מקובעים בקוד הלקוח","כל מי שפותח את קוד המקור רואה את הקודים.","index.html");
  if(/isReservedCode/.test(html) && !/CODES\s*=/.test(html))
    add("info","קודי הכניסה אינם בקוד הלקוח","האימות מתבצע מול Firebase Auth — נכון ובטוח.","index.html");
}

/* ---------- 7. Cloud Function ---------- */
{
  if(fn){
    if(!/maxInstances/.test(fn))
      add("med","לשרת ההתראות אין תקרת עומס","בלי תקרה, תקלה או עומס חריג עלולים לייצר חיוב כספי גבוה.","functions/index.js");
    if(/\.data\(\)\s*\.\s*v/.test(fn) && !/Array\.isArray/.test(fn))
      add("low","הפונקציה לא מאמתת מבנה נתונים נכנס","מומלץ לוודא טיפוסים לפני שימוש.","functions/index.js");
  } else {
    add("info","לא נמצאה Cloud Function","אם ההתראות אמורות לעבוד — יש לוודא פריסה.","functions/");
  }
}

/* ---------- 8. תלות בקוד חיצוני בזמן ריצה ---------- */
{
  const cdns = [...html.matchAll(/https:\/\/(cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net)\/[^\s"')]+/g)];
  const uniq = [...new Set(cdns.map(c=>c[0]))];
  const noSri = uniq.filter(u=>{
    const i = html.indexOf(u);
    return !/integrity\s*=/.test(html.slice(Math.max(0,i-300), i+300));
  });
  if(noSri.length)
    add("med","האפליקציה טוענת קוד משרת חיצוני בלי לבדוק אותו",
      `${noSri.length} ספריות, למשל ${noSri[0].split('/').pop()}. אם השרת החיצוני הזה ייפרץ, קוד זר יוכל לרוץ בתוך האפליקציה שלנו. `+
      `שתי דרכים לסגור: לשמור עותק של הספרייה אצלנו, או להוסיף חתימה שמוודאת שהקובץ לא שונה.`,
      "index.html");
}

/* ---------- 9. אחסון מקומי של מידע רגיש ---------- */
{
  const ls = [...html.matchAll(/localStorage\.setItem\(\s*["'`]([^"'`]+)/g)].map(m=>m[1]);
  const sensitive = ls.filter(k=>/pin|pass|token|secret|hash|auth/i.test(k));
  if(sensitive.length)
    add("med","מידע רגיש נשמר בזיכרון המקומי של הדפדפן",
      `נשמרים שם: ${[...new Set(sensitive)].join(", ")}. הזיכרון הזה אינו מוצפן וכל קוד שרץ בדף יכול לקרוא אותו.`,"index.html");
}

export async function run(){
  // בדיקת XSS אמיתית (מריצה את האפליקציה עם מטען עוין)
  try{
    const { runXssProbe } = await import('./lib/xss_probe.mjs');
    findings.push(...await runXssProbe());
  }catch(e){
    findings.push({sev:"med", area:"אבטחה", title:"בדיקת XSS לא רצה", detail:String(e && e.message), where:"qa/lib/xss_probe.mjs"});
  }
  const bySev = s => findings.filter(f=>f.sev===s).length;
  return {
    name: "אבטחת מידע",
    summary: { high:bySev("high"), med:bySev("med"), low:bySev("low"), info:bySev("info") },
    findings,
  };
}

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.findings.some(f=>f.sev==="high") ? 1 : 0);
}
