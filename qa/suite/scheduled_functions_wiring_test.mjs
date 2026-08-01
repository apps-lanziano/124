/* בודק שהחיווט בפועל של functions/index.js תקין — לא רק שהלוגיקה הטהורה
   ב-lib/ נכונה, אלא שהיא מחוברת נכון (תזמון, timezone, סינון לתפקיד מפקד
   בלבד, ונתיב הגיבוי). firebase-admin/functions לא מותקנים בסביבת הבדיקה,
   ולכן זו בדיקת מקור (כמו ב-rollcall_alert_test.mjs) ולא הרצה בפועל. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/pw.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const fn = readFileSync(`${ROOT}/functions/index.js`, 'utf8');

// 1. תזכורת חתימות — מתוזמנת, בשעה סבירה, בטיימזון ישראל, ומחוברת ללוגיקה הטהורה
{
  const hasSchedule = /remindUnsignedDaily\s*=\s*onSchedule/.test(fn);
  const hasTZ = /timeZone:\s*"Asia\/Jerusalem"/.test(fn);
  const usesLib = /findUnsignedReminders\(db\)/.test(fn);
  const importsLib = /require\("\.\/lib\/reminders"\)/.test(fn);
  record("תזכורת חתימות: מתוזמנת עם onSchedule, בטיימזון ישראל, ומשתמשת בלוגיקה מ-lib/reminders",
    hasSchedule && hasTZ && usesLib && importsLib,
    JSON.stringify({hasSchedule, hasTZ, usesLib, importsLib}));
}

// 2. שולחת רק למפקדים — לא מציפה את כל הסככה
{
  const filtersToCommander = /filter\(\(\[, m\]\)\s*=>\s*m\s*&&\s*m\.role\s*===\s*"מפקד"\)/.test(fn);
  record("תזכורת חתימות: מסננת טוקנים לתפקיד מפקד בלבד לפני השליחה",
    filtersToCommander, String(filtersToCommander));
}

// 3. גיבוי שבועי — מתוזמן, כותב ל-Storage בנתיב backups/, ומחובר ל-dumpCollection
{
  const hasSchedule = /weeklyBackup\s*=\s*onSchedule/.test(fn);
  const hasTZ = (fn.match(/timeZone:\s*"Asia\/Jerusalem"/g) || []).length >= 2;
  const usesLib = /dumpCollection\(db\)/.test(fn);
  const writesToBackupsPath = /`backups\/sq124-\$\{stamp\}\.json`/.test(fn);
  const usesStorage = /getStorage\(\)\.bucket\(\)/.test(fn);
  record("גיבוי שבועי: מתוזמן, כותב ל-backups/sq124-<תאריך>.json ב-Storage, ומשתמש ב-dumpCollection",
    hasSchedule && hasTZ && usesLib && writesToBackupsPath && usesStorage,
    JSON.stringify({hasSchedule, hasTZ, usesLib, writesToBackupsPath, usesStorage}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
