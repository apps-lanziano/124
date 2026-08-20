/* בודק שהחיווט בפועל של functions/index.js תקין — לא רק שהלוגיקה הטהורה
   ב-lib/ נכונה, אלא שהיא מחוברת נכון (תזמון, timezone, סינון לתפקיד מפקד
   בלבד, ונתיב הגיבוי). firebase-admin/functions לא מותקנים בסביבת הבדיקה,
   ולכן זו בדיקת מקור (כמו ב-rollcall_alert_test.mjs) ולא הרצה בפועל. */
import { readFileSync } from 'fs';
import { ROOT } from '../lib/repo-root.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }
const fn = readFileSync(`${ROOT}/functions/index.js`, 'utf8');

// 1. תזכורת חתימות (remindUnsignedDaily) הוסרה במכוון — "חתימות חסרות" לא
// נשלחת יותר כתזכורת מתוזמנת (הבקשה: "להוריד התראת חתימות חסרות"). לוגיקת
// findUnsignedReminders עצמה נשארת ב-lib/reminders.js כי dailyDigest עדיין
// משתמש בה (ראו 5ה/5ג) — רק הפונקציה המתוזמנת הנפרדת הוסרה.
{
  const noScheduledFn = !/remindUnsignedDaily\s*=\s*onSchedule/.test(fn);
  const noDeadImport = !/const \{findUnsignedReminders\} = require\("\.\/lib\/reminders"\)/.test(fn);
  record("תזכורת חתימות (remindUnsignedDaily) הוסרה — אין יותר תזכורת מתוזמנת נפרדת לחתימות חסרות",
    noScheduledFn && noDeadImport, JSON.stringify({noScheduledFn, noDeadImport}));
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

// 5. תזכורות + מסדר בוקר (notifyOnPublish) + סקירת מ״ע אחזקה מסננים טוקנים
// למפקדים בלבד. תקציר יומי (dailyDigest) לא נכלל כאן — הוא עבר לסינון ייעודי
// (רשימה סגורה, ראו 5ה). שיבוץ התורנויות אינו עוד פונקציה נפרדת — הוא אוחד
// לתוך תקציר היומי (ראו 5ד). תזכורת חתימות הוסרה (ראו 1) — לכן 4 מקומות, לא 5.
{
  const filterCount = (fn.match(/filter\(\(\[, m\]\)\s*=>\s*m\s*&&\s*m\.role\s*===\s*"מפקד"\)/g) || []).length;
  record("סה״כ 4 מקומות מסננים למפקד בלבד (הסמכות, מילואים, מסדר בוקר, סקירת מ״ע אחזקה)",
    filterCount===4, String(filterCount));
}

// 5ו. רישיונות עומדים לפוג ממשיכים להתדווח רק במסגרת סקירת מ״ע אחזקה
// המרוכזת (findVoIssues) — לא כתזכורת נפרדת לכל סככה. החלטת מוצר מכוונת.
{
  const noPerShedLicenseReminder = !/remindLicenseExpiryDaily/.test(fn) && !/findExpiringLicensesByShed/.test(fn);
  record("אין תזכורת רישיונות נפרדת לכל מסגרת — רק הסיכום המרוכז למ״ע אחזקה",
    noPerShedLicenseReminder, String(noPerShedLicenseReminder));
}

// 5ג. תקציר יומי — מתוזמן ל-08:00, בטיימזון ישראל, מחובר ל-lib/daily_digest, ואינו תלוי בלוג cooldown כלשהו
{
  const hasSchedule = /dailyDigest\s*=\s*onSchedule/.test(fn);
  const hasCorrectTime = /schedule:\s*"0 8 \* \* \*"/.test(fn);
  const usesLib = /buildDailyDigests\(db\)/.test(fn);
  const importsLib = /require\("\.\/lib\/daily_digest"\)/.test(fn);
  record("תקציר יומי: מתוזמן ל-08:00 (Asia/Jerusalem), ומשתמש בלוגיקה מ-lib/daily_digest",
    hasSchedule && hasCorrectTime && usesLib && importsLib,
    JSON.stringify({hasSchedule, hasCorrectTime, usesLib, importsLib}));
}

// 5ה. תקציר יומי — החלטת מוצר: רק רשימה סגורה של מפקדים בשם (לא כל role:"מפקד")
// מקבלת אותו, כדי שמ״ע אחזקה/הדרכה לא יקבלו אותו לצד הסיכום הייעודי שלהם
{
  const importsFilter = /const \{buildDailyDigests, filterDailyDigestTokens\} = require\("\.\/lib\/daily_digest"\)/.test(fn);
  const start = fn.indexOf("exports.dailyDigest");
  const end = fn.indexOf("exports.sendTestNotificationToSelf");
  const body = start >= 0 && end > start ? fn.slice(start, end) : "";
  const usesAllowlistFilter = /const cmdTokens = filterDailyDigestTokens\(tokMap\)/.test(body);
  const noGenericInlineFilter = !/filter\(\(\[, m\]\)\s*=>\s*m\s*&&\s*m\.role\s*===\s*"מפקד"\)/.test(body);
  record("תקציר יומי (dailyDigest) משתמש בסינון הרשימה הסגורה (filterDailyDigestTokens), לא בסינון role בלבד",
    importsFilter && usesAllowlistFilter && noGenericInlineFilter,
    JSON.stringify({importsFilter, usesAllowlistFilter, noGenericInlineFilter}));
}

// 5ד. שיבוץ תורנויות אוחד לתוך התקציר היומי (הודעה אחת ב-08:00, לבקשת המשתמש) —
// אין עוד פונקציה מתוזמנת נפרדת dutyRosterDigest, אבל התקציר היומי משתמש
// בלוגיקה מ-lib/duty_roster_digest ומצרף את שיבוץ היום לגוף ההודעה.
{
  const noSeparateDutyFn = !/exports\.dutyRosterDigest/.test(fn);
  const dailyUsesRosterLib = /buildDutyRosterDigests\(db\)/.test(fn);
  const importsRosterLib = /require\("\.\/lib\/duty_roster_digest"\)/.test(fn);
  // מוודאים שהקריאה ל-buildDutyRosterDigests יושבת בתוך גוף dailyDigest
  const start = fn.indexOf("exports.dailyDigest");
  const end = fn.indexOf("exports.sendTestNotificationToSelf");
  const dailyBody = start >= 0 && end > start ? fn.slice(start, end) : "";
  const mergedIntoDaily = /buildDutyRosterDigests\(db\)/.test(dailyBody) && /צוות תורן:/.test(dailyBody);
  record("שיבוץ תורנויות אוחד לתוך התקציר היומי (הודעה אחת ב-08:00) — אין פונקציה נפרדת, והתורנות מצורפת לגוף התקציר",
    noSeparateDutyFn && dailyUsesRosterLib && importsRosterLib && mergedIntoDaily,
    JSON.stringify({noSeparateDutyFn, dailyUsesRosterLib, importsRosterLib, mergedIntoDaily}));
}

// 5ב. תזכורת סקירת מ״ע אחזקה יומית — מתוזמנת, מחוברת ללוגיקה הטהורה, שולחת רק ל-push_tokens_maint
{
  const hasSchedule = /remindVoIssuesDaily\s*=\s*onSchedule/.test(fn);
  const usesLib = /findVoIssues\(db\)/.test(fn);
  const importsLib = /require\("\.\/lib\/vo_reminders"\)/.test(fn);
  const targetsMaintOnly = /db\.doc\("sq124\/push_tokens_maint"\)/.test(fn);
  record("תזכורת סקירת מ״ע אחזקה: מתוזמנת, משתמשת ב-lib/vo_reminders, ושולחת רק לטוקני מסגרת מ״ע אחזקה",
    hasSchedule && usesLib && importsLib && targetsMaintOnly,
    JSON.stringify({hasSchedule, usesLib, importsLib, targetsMaintOnly}));
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

// 6ב. "ימים שקטים" (שישי/שבת) — מדיניות טייסתית: כל תזכורת מתוזמנת מדלגת
// בימים האלה. לא חל על notifyOnPublish (זמן אמת) ולא על weeklyBackup (לא התראה).
{
  const importsQuietDays = /require\("\.\/lib\/quiet_days"\)/.test(fn);
  const scheduledFns = [
    ["remindCertExpiryDaily", "תזכורות הסמכות"],
    ["remindReserveRefreshDaily", "תזכורות מילואים"],
    ["remindVoIssuesDaily", "תזכורת מ״ע אחזקה"],
    ["dailyDigest", "תקציר יומי (כולל תורנויות)"],
  ];
  const missing = [];
  for (const [name] of scheduledFns) {
    const fnStart = fn.indexOf(`exports.${name} = onSchedule(`);
    const fnBody = fnStart >= 0 ? fn.slice(fnStart, fnStart + 1200) : "";
    if (!/if \(isQuietDay\(Date\.now\(\)\)\)/.test(fnBody)) missing.push(name);
  }
  record("כל ארבע התזכורות המתוזמנות בודקות isQuietDay בתחילת הריצה ומדלגות בשישי/שבת",
    importsQuietDays && missing.length === 0,
    JSON.stringify({importsQuietDays, missing}));

  const backupHasNoQuietCheck = (() => {
    const start = fn.indexOf("exports.weeklyBackup = onSchedule(");
    const body = start >= 0 ? fn.slice(start, start + 1200) : "";
    return !/isQuietDay/.test(body);
  })();
  record("גיבוי שבועי (לא התראה למשתמש) לא מושפע מ-isQuietDay",
    backupHasNoQuietCheck, String(backupHasNoQuietCheck));

  const notifyOnPublishHasNoQuietCheck = (() => {
    const start = fn.indexOf("exports.notifyOnPublish = onDocumentWritten(");
    const end = fn.indexOf("exports.remindCertExpiryDaily");
    const body = start >= 0 && end > start ? fn.slice(start, end) : "";
    return !/isQuietDay/.test(body);
  })();
  record("התראות בזמן אמת (notifyOnPublish) לא מושפעות מ-isQuietDay — רק תזכורות מתוזמנות",
    notifyOnPublishHasNoQuietCheck, String(notifyOnPublishHasNoQuietCheck));
}

// 7. notifyOnPublish: מסדר בוקר (commandersOnly) מסונן למפקדים בזמן אמת, לא רק תזכורות מתוזמנות
{
  const destructuresFlag = /const\s*\{kind,\s*shedId,\s*title,\s*body,\s*count,\s*commandersOnly\}\s*=\s*decision/.test(fn);
  const branchesOnFlag = /commandersOnly\s*\?\s*Object\.entries\(tokMap\)\.filter\(\(\[, m\]\)\s*=>\s*m\s*&&\s*m\.role\s*===\s*"מפקד"\)/.test(fn);
  record("notifyOnPublish: דיווח מסדר בוקר (commandersOnly) מסונן למפקדים בזמן אמת, שאר הסוגים לכולם",
    destructuresFlag && branchesOnFlag, JSON.stringify({destructuresFlag, branchesOnFlag}));
}

// 8. notifyOnPublish: לוח צוות תורן (roster_publish/roster_current) הוא גלובלי —
// BROADCAST_SHED גורם ללולאה על כל המסגרות במקום פנייה יחידה ל-shedId בודד
{
  const importsBroadcast = /const \{decide, SHED_NAMES, BROADCAST_SHED\} = require\("\.\/lib\/notify"\)/.test(fn);
  const loopsOverShedIds = /const shedIds = shedId === BROADCAST_SHED \? Object\.keys\(SHED_NAMES\) : \[shedId\]/.test(fn);
  const iteratesLoop = /for \(const sid of shedIds\)/.test(fn);
  record("notifyOnPublish: לוח צוות תורן (BROADCAST_SHED) משודר בלולאה לכל המסגרות ב-SHED_NAMES",
    importsBroadcast && loopsOverShedIds && iteratesLoop,
    JSON.stringify({importsBroadcast, loopsOverShedIds, iteratesLoop}));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
