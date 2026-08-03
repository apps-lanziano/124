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

// 3. תזכורת הסמכות — מתוזמנת, בטיימזון ישראל, מחוברת ללוגיקה הטהורה, מסננת למפקדים
{
  const hasSchedule = /remindCertExpiryDaily\s*=\s*onSchedule/.test(fn);
  const usesLib = /findExpiringCerts\(db\)/.test(fn);
  const importsLib = /require\("\.\/lib\/cert_expiry_reminders"\)/.test(fn);
  record("תזכורת הסמכות: מתוזמנת עם onSchedule, ומשתמשת בלוגיקה מ-lib/cert_expiry_reminders",
    hasSchedule && usesLib && importsLib, JSON.stringify({hasSchedule, usesLib, importsLib}));
}

// 4. תזכורת רענון מילואים — מתוזמנת, מחוברת ללוגיקה הטהורה
{
  const hasSchedule = /remindReserveRefreshDaily\s*=\s*onSchedule/.test(fn);
  const usesLib = /findOverdueReserves\(db\)/.test(fn);
  const importsLib = /require\("\.\/lib\/reserve_refresh_reminders"\)/.test(fn);
  record("תזכורת רענון מילואים: מתוזמנת עם onSchedule, ומשתמשת בלוגיקה מ-lib/reserve_refresh_reminders",
    hasSchedule && usesLib && importsLib, JSON.stringify({hasSchedule, usesLib, importsLib}));
}

// 5. תזכורות + מסדר בוקר מסננים טוקנים למפקדים בלבד (אותה תבנית כמו remindUnsignedDaily)
{
  const filterCount = (fn.match(/filter\(\(\[, m\]\)\s*=>\s*m\s*&&\s*m\.role\s*===\s*"מפקד"\)/g) || []).length;
  record("סה״כ 4 מקומות מסננים למפקד בלבד (חתימות, הסמכות, מילואים, מסדר בוקר)",
    filterCount===4, String(filterCount));
}

// 6. גיבוי שבועי — מתוזמן, כותב ל-Storage בנתיב backups/, ומחובר ל-dumpCollection
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

// 7. notifyOnPublish: מסדר בוקר (commandersOnly) מסונן למפקדים בזמן אמת, לא רק תזכורות מתוזמנות
{
  const destructuresFlag = /const\s*\{kind,\s*shedId,\s*title,\s*body,\s*count,\s*commandersOnly\}\s*=\s*decision/.test(fn);
  const branchesOnFlag = /commandersOnly\s*\?\s*Object\.entries\(tokMap\)\.filter\(\(\[, m\]\)\s*=>\s*m\s*&&\s*m\.role\s*===\s*"מפקד"\)/.test(fn);
  record("notifyOnPublish: דיווח מסדר בוקר (commandersOnly) מסונן למפקדים בזמן אמת, שאר הסוגים לכולם",
    destructuresFlag && branchesOnFlag, JSON.stringify({destructuresFlag, branchesOnFlag}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
