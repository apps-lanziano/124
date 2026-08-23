/* ============================================================
   בדיקת זמינות Java לבדיקות שמריצות Firebase Emulator — טייסת 124
   ------------------------------------------------------------
   שתי בדיקות בחבילה (firestore_rules_test / red_team_firestore_rules_test)
   מריצות את *כללי האבטחה האמיתיים* על Firestore Emulator, וה-emulator
   רץ על Java. מאז firebase-tools 15 נדרש JDK 21 ומעלה — גרסה ישנה יותר
   מפילה את הבדיקה עם:
     "firebase-tools no longer supports Java version before 21…"

   ⚠️ זה כשל *סביבה*, לא כשל של האפליקציה. בלי הבחנה, הדוח היומי דיווח
   עליו כ"🔴 חמור · בדיקה נכשלה" — התראת שווא שנראית כמו פרצת אבטחה,
   בזמן שהכללים עצמם תקינים לגמרי (runner של GitHub מגיע עם Java 17
   כברירת מחדל). לכן: אם אין JDK 21 — מדלגים בבירור (SKIP), לא נכשלים.

   🔒 כדי שדילוג לא יהפוך ל"בדיקת אבטחה שלא רצה אף פעם בשקט":
   כש-QA_REQUIRE_EMULATOR=1 (מוגדר ב-CI ובדוח היומי) דילוג הוא כשל קשה.
   ============================================================ */
import { spawnSync } from "child_process";

export const SKIP_MARKER = "QA_SKIP";
export const MIN_JAVA = 21;

/** גרסת ה-major של Java שבנתיב, או null אם java אינו מותקן/לא ניתן לזהות. */
export function javaMajorVersion(){
  let res;
  try{
    res = spawnSync("java", ["-Duser.language=en", "-version"], { encoding: "utf8" });
  }catch{
    return null;
  }
  if(!res || res.error) return null;
  const out = `${res.stdout || ""}\n${res.stderr || ""}`;
  const m = /version "([1-9][0-9]*)/.exec(out);
  return m ? Number(m[1]) : null;
}

/**
 * מוודא ש-JDK 21+ זמין. אם לא — מדפיס שורת דילוג ויוצא בקוד 0,
 * אלא אם QA_REQUIRE_EMULATOR=1 (אז יוצא 1, כדי ש-CI לא "יעבור" בשקט).
 */
export function ensureJava21OrSkip(testName){
  const v = javaMajorVersion();
  if(v !== null && v >= MIN_JAVA) return v;
  const why = v === null
    ? "Java אינו מותקן (או שלא ניתן לזהות את גרסתו)"
    : `מותקן Java ${v}, ונדרש ${MIN_JAVA} ומעלה`;
  const reason = `${testName}: הבדיקה דורשת Firebase Emulator — ${why}`;
  if(process.env.QA_REQUIRE_EMULATOR === "1"){
    console.error(`❌ ${reason}. הסביבה חייבת לספק JDK ${MIN_JAVA}+ (QA_REQUIRE_EMULATOR=1).`);
    process.exit(1);
  }
  console.log(`${SKIP_MARKER}: ${reason}`);
  console.log(`⏭️  דילוג — לא כשל של האפליקציה. להרצה מקומית: התקן JDK ${MIN_JAVA} ומעלה.`);
  process.exit(0);
}
