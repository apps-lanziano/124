/* ============================================================
   תזכורת אוטומטית — הסמכות שפג תוקפן או עומדות לפוג
   ------------------------------------------------------------
   לוגיקה טהורה, בלי שום תלות ב-firebase-admin (ראו lib/reminders.js
   להסבר הכללי על התבנית). מרוכזת לפי מסגרת — כדי לא להציף את המפקד
   בהתראה נפרדת לכל הסמכה, כמו שכבר עשוי לקרות במסגרת גדולה.
   ============================================================ */

const SHED_IDS = ["shed1", "shed2", "shed3", "shed4", "shed5", "dept", "maint", "training"];

/* מנרמל את "עכשיו" לחצות מקומית לפני החישוב — בדיוק כמו renderAdminCertExpiry
   באפליקציה — כדי שההפרש בימים לא יתעוות לפי שעת היום הנוכחית. */
function daysUntil(expiry, now) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry + "T00:00:00").getTime();
  return Math.round((exp - today.getTime()) / 86400000);
}

/* מוצא הסמכות שפג תוקפן או עומדות לפוג בקרוב לפי מסגרת, בלי תזכורת כפולה
   על אותה הסמכה תוך תקופת ה-cooldown. לא שולח כלום בעצמו. */
async function findExpiringCerts(db, opts = {}) {
  const now = opts.now ?? Date.now();
  const remindWithinDays = opts.remindWithinDays ?? 14;
  const cooldownDays = opts.cooldownDays ?? 7;
  const shedIds = opts.shedIds ?? SHED_IDS;

  const logSnap = await db.doc("sq124/_cert_reminder_log").get();
  const remindedAt = logSnap.exists ? (logSnap.data().v || {}) : {};
  const updatedLog = { ...remindedAt };
  const toSend = [];

  for (const shedId of shedIds) {
    const certsSnap = await db.doc(`sq124/${shedId}_certs_list`).get();
    const certs = certsSnap.exists ? (certsSnap.data().v || []) : [];
    if (!certs.length) continue;

    const items = [];
    for (const c of certs) {
      if (!c || !c.id || !c.expiry) continue;
      const daysLeft = daysUntil(c.expiry, now);
      if (daysLeft > remindWithinDays) continue;

      const logKey = shedId + "|" + c.id;
      if (updatedLog[logKey] && (now - updatedLog[logKey]) < cooldownDays * 86400000) continue;

      items.push({ person: c.person, certName: c.name, daysLeft });
      updatedLog[logKey] = now;
    }
    if (items.length) toSend.push({ shedId, items });
  }
  return { toSend, updatedLog };
}

module.exports = { SHED_IDS, daysUntil, findExpiringCerts };
