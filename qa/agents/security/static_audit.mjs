/* ============================================================
   אגף אבטחה · ביקורת סטטית
   ------------------------------------------------------------
   סורק את קוד האפליקציה, כללי ה-Firestore וה-Cloud Function
   ומחפש פרצות: הזרקת HTML/סקריפט, סודות בקוד, הרשאות רחבות
   מדי, חולשות בשמירת סיסמאות, ודליפת מידע ללקוח.

   מגבלה שחשוב להכיר: זו סריקה *סטטית* של הקוד. היא לא רואה
   תעבורה חיה ולכן לא מזהה חדירה בזמן אמת — לכך נדרשת התראה
   מצד Firebase עצמו (ר' סעיף "ניטור חי" ב-qa/README.md). את
   ה-XSS הבדיקה הזו לא בודקת עוד סטטית — יש לכך סוכן חי נפרד
   (security/xss-live) כי ניחוש סטטי מייצר יותר רעש מממצאים.
   ============================================================ */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { ROOT } from '../../lib/repo-root.mjs';

const html = readFileSync(`${ROOT}/index.html`, 'utf8');
const rules = existsSync(`${ROOT}/firestore.rules`) ? readFileSync(`${ROOT}/firestore.rules`,'utf8') : "";

/* קוד ה-Cloud Function מפוצל בין functions/index.js ו-functions/lib/*.js
   (הופרד כדי שהלוגיקה תהיה ניתנת לבדיקה ישירה — ראו notify_lib_test.mjs
   וכו'). בדיקות שמחפשות תבנית "בקובץ אחד" (למשל Array.isArray לצד .data().v)
   צריכות לראות את כל הקוד יחד, אחרת פיצול לגיטימי נראה כרגרסיה. */
function readFunctionsCode(){
  let combined = "";
  const idx = `${ROOT}/functions/index.js`;
  if(existsSync(idx)) combined += readFileSync(idx, 'utf8');
  const libDir = `${ROOT}/functions/lib`;
  if(existsSync(libDir)){
    for(const f of readdirSync(libDir).filter(f=>f.endsWith('.js'))){
      combined += "\n" + readFileSync(`${libDir}/${f}`, 'utf8');
    }
  }
  return combined;
}
const fn = readFunctionsCode();

function lineOf(idx){ return html.slice(0, idx).split('\n').length; }

function scan(){
  const findings = [];
  const add = (sev, title, detail, where) => findings.push({sev, area:"אבטחה", title, detail, where});

  /* ---------- 1. סינקים שמריצים קוד מחרוזתי ---------- */
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

  /* ---------- 2. סודות בקוד ---------- */
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

  /* ---------- 3. כללי Firestore ---------- */
  {
    if(!rules){ add("high","קובץ כללי Firestore חסר","לא נמצא firestore.rules — ייתכן שהמסד פתוח.","firestore.rules"); }
    else {
      if(/allow\s+(read|write|get|list|create|update|delete)[^;]*:\s*if\s+true/.test(rules))
        add("high","כלל Firestore פתוח לגמרי (if true)","יש כלל שמתיר גישה ללא כל תנאי — כל אדם באינטרנט יכול לקרוא/לכתוב.","firestore.rules");
      if(!/request\.auth\s*!=\s*null/.test(rules))
        add("high","כללי Firestore לא דורשים אימות","לא נמצאה בדיקת request.auth — המסד עלול להיות נגיש ללא התחברות.","firestore.rules");
      if(/allow\s+list\s*:\s*if\s+(?!false)/.test(rules))
        add("med","שאילתת list מותרת","מאפשר שאיבה המונית של כל המסד בבקשה אחת.","firestore.rules");
      // הפרדה בין מסגרות — נבדק על הכללים הפעילים בלבד (בלי הערות/גרסאות היסטוריות בתיעוד)
      const rulesActive = rules.replace(/\/\*[\s\S]*?\*\//g, "");
      const hasFrameworkSeparation = /myPrefix\(\)/.test(rulesActive);
      if(/allow get:\s*if isAuthed\(\)/.test(rulesActive) && !hasFrameworkSeparation)
        add("med","מסגרת יכולה לקרוא נתונים של מסגרת אחרת",
          "כל מי שמאומת (אפילו אימות אנונימי אוטומטי, בלי קוד) יכול לקרוא נתונים של כל מסגרת. "+
          "הפתרון כבר כתוב ומוכן בקובץ ההרשאות, אבל הפעלתו דורשת חשבון כניסה נפרד לכל מסגרת — שינוי משמעותי.","firestore.rules");
      else if(/allow get:\s*if isAuthorized\(\)/.test(rulesActive) && !hasFrameworkSeparation)
        add("info","הפרדה בין מסגרות אינה אכופה בשרת — החלטה מתועדת, לא פרצה",
          "תגית authorized חוסמת אימות אנונימי (ראה SECURITY.md שלב 7), אבל כל כניסה אמיתית עם קוד עדיין יכולה "+
          "לקרוא נתונים של מסגרות אחרות — זו החלטת מוצר מכוונת שתועדה ב-SECURITY.md שלב 4 "+
          "(\"הוחלט לא לבצע הפרדת מסגרות בשרת — החשש אינו מפני אנשי הטייסת עצמם\"). "+
          "אם יידרש בעתיד להדק, הפתרון כבר כתוב כתיעוד היסטורי בקובץ הכללים (גרסה 2).","firestore.rules");
    }
  }

  /* ---------- 4. חוזק שמירת ה-PIN ---------- */
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

  /* ---------- 5. קוד מסגרת/PIN בצד הלקוח ---------- */
  {
    if(/const\s+CODES\s*=\s*\{[^}]*\d{4}/.test(html))
      add("high","קודי כניסה מקובעים בקוד הלקוח","כל מי שפותח את קוד המקור רואה את הקודים.","index.html");
    if(/isReservedCode/.test(html) && !/CODES\s*=/.test(html))
      add("info","קודי הכניסה אינם בקוד הלקוח","האימות מתבצע מול Firebase Auth — נכון ובטוח.","index.html");
  }

  /* ---------- 6. Cloud Function ---------- */
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

  /* ---------- 7. תלות בקוד חיצוני בזמן ריצה ---------- */
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

  /* ---------- 8. אחסון מקומי של מידע רגיש ---------- */
  {
    const ls = [...html.matchAll(/localStorage\.setItem\(\s*["'`]([^"'`]+)/g)].map(m=>m[1]);
    const sensitive = ls.filter(k=>/pin|pass|token|secret|hash|auth/i.test(k));
    if(sensitive.length)
      add("med","מידע רגיש נשמר בזיכרון המקומי של הדפדפן",
        `נשמרים שם: ${[...new Set(sensitive)].join(", ")}. הזיכרון הזה אינו מוצפן וכל קוד שרץ בדף יכול לקרוא אותו.`,"index.html");
  }

  return findings;
}

const agent = {
  id: 'security/static-audit',
  name: 'ביקורת אבטחה סטטית',
  kind: 'static',
  domain: 'security',
  privacy: 'public',
  async run(){
    const findings = scan();
    const bySev = s => findings.filter(f=>f.sev===s).length;
    return { summary:{ high:bySev("high"), med:bySev("med"), low:bySev("low"), info:bySev("info") }, findings };
  }
};
export default agent;

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await agent.run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.findings.some(f=>f.sev==="high") ? 1 : 0);
}
