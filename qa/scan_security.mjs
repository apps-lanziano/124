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
    if(hits.length) add(sev, `שימוש ב-${label}`,
      `${hits.length} מופעים (שורות ${hits.slice(0,4).map(h=>lineOf(h.index)).join(", ")}). ` +
      `סינק שמריץ מחרוזת כקוד/HTML — יש לוודא שהערך שנכנס אליו אינו מגיע ממשתמש.`,
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
      add("med","אין הפרדת נתונים בין מסגרות בשרת",
        "כל משתמש מאומת יכול לקרוא מסמכים של כל מסגרת אחרת (ההפרדה היא בממשק בלבד, לא בשרת). "+
        "גרסה 2 של הכללים כבר כתובה בהערה בקובץ — הפעלתה דורשת חשבון נפרד לכל מסגרת.","firestore.rules");
  }
}

/* ---------- 5. חוזק שמירת ה-PIN ---------- */
{
  const hashFn = html.match(/async function hashPin[\s\S]{0,600}/);
  if(hashFn){
    const body = hashFn[0];
    if(/SHA-1|MD5/i.test(body)) add("high","PIN נשמר עם אלגוריתם חלש","יש להחליף ל-SHA-256 ומעלה.","index.html");
    const iter = body.match(/iterations\s*:\s*(\d+)/);
    if(/PBKDF2/i.test(body) && iter && Number(iter[1]) < 100000)
      add("med","מספר סבבי PBKDF2 נמוך",`${iter[1]} סבבים. מומלץ 100,000 ומעלה.`,"index.html");
    if(!/PBKDF2|bcrypt|scrypt|argon/i.test(body) && /SHA-256/i.test(body))
      add("med","PIN מוגן בגיבוב יחיד ללא הקשחה",
        "PIN בן 4 ספרות הוא 10,000 אפשרויות בלבד — SHA-256 יחיד נשבר במיליוניות שנייה למי שמשיג את הגיבובים. "+
        "מומלץ PBKDF2 עם 100,000+ סבבים. (הסיכון מתממש רק אם תוקף כבר קרא את מסמכי הצוות.)","index.html");
    if(!/salt/i.test(body)) add("high","PIN נשמר ללא salt","גיבוב ללא salt חשוף לטבלאות מוכנות מראש.","index.html");
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
      add("med","ל-Cloud Function אין תקרת מופעים","בלי maxInstances, תקלה או עומס עלולים לייצר חיוב גבוה.","functions/index.js");
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
    add("med","קוד חיצוני נטען מ-CDN בלי בדיקת שלמות (SRI)",
      `${noSri.length} מקורות, למשל: ${noSri[0].split('/').pop()}. אם ה-CDN ייפרץ, קוד זר ירוץ באפליקציה. מומלץ להוסיף integrity או לארח מקומית.`,
      "index.html");
}

/* ---------- 9. אחסון מקומי של מידע רגיש ---------- */
{
  const ls = [...html.matchAll(/localStorage\.setItem\(\s*["'`]([^"'`]+)/g)].map(m=>m[1]);
  const sensitive = ls.filter(k=>/pin|pass|token|secret|hash|auth/i.test(k));
  if(sensitive.length)
    add("med","מידע רגיש נשמר ב-localStorage",
      `מפתחות: ${[...new Set(sensitive)].join(", ")}. localStorage נגיש לכל סקריפט בדף ואינו מוצפן.`,"index.html");
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
