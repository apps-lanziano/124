/* ============================================================
   תקציר יומי — סיכום אחד לכל מפקד בבוקר
   ------------------------------------------------------------
   בשונה מהתזכורות הקיימות (reminders.js, cert_expiry_reminders.js
   וכו') — אלה בודקות "האם כבר הזכרנו את זה?" (cooldown/לוג), כי
   מטרתן להתריע נקודתית על שינוי. התקציר הזה שונה במהותו: נשלח כל
   בוקר בלי תלות במה שכבר נשלח, כי זו תמונת מצב ולא התראה חדשה —
   ולכן משתמש בפונקציות התזכורות הקיימות עם cooldownDays:0 (מתעלם
   מהלוג, לא כותב אליו) כדי לא לשכפל את הלוגיקה של "מי לא חתם"/
   "אילו הסמכות פגות" פעמיים.
   ============================================================ */

const { SHED_IDS, findUnsignedReminders } = require("./reminders");
const { findExpiringCerts } = require("./cert_expiry_reminders");

/* מחזיר תקציר לכל מסגרת שיש בה משהו לדווח (חתימות חסרות/תקלות פתוחות/
   הסמכות שפגות תוך שבוע) — מסגרת "נקייה" לא מקבלת תקציר ריק. */
async function buildDailyDigests(db, opts = {}) {
  const now = opts.now ?? Date.now();
  const shedIds = opts.shedIds ?? SHED_IDS;

  const [unsigned, certs] = await Promise.all([
    findUnsignedReminders(db, {now, remindAfterDays: 0, cooldownDays: 0, shedIds}),
    findExpiringCerts(db, {now, remindWithinDays: 7, cooldownDays: 0, shedIds}),
  ]);

  const unsignedByShed = {};
  for (const item of unsigned.toSend) {
    unsignedByShed[item.shedId] = (unsignedByShed[item.shedId] || 0) + 1;
  }
  const certsByShed = {};
  for (const group of certs.toSend) certsByShed[group.shedId] = group.items.length;

  const openFaultsByShed = {};
  await Promise.all(shedIds.map(async (shedId) => {
    const snap = await db.doc(`sq124/${shedId}_faults_list`).get();
    const faults = snap.exists ? (snap.data().v || []) : [];
    const open = faults.filter((f) => f && f.status !== "closed").length;
    if (open) openFaultsByShed[shedId] = open;
  }));

  const digests = [];
  for (const shedId of shedIds) {
    const unsignedCount = unsignedByShed[shedId] || 0;
    const certsSoon = certsByShed[shedId] || 0;
    const openFaults = openFaultsByShed[shedId] || 0;
    const totalCount = unsignedCount + openFaults + certsSoon;
    if (totalCount === 0) continue;
    digests.push({shedId, unsignedCount, openFaults, certsSoon, totalCount});
  }
  return digests;
}

module.exports = {SHED_IDS, buildDailyDigests};
