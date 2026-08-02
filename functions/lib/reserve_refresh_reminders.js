/* ============================================================
   תזכורת אוטומטית — אנשי מילואים שלא רועננו זמן רב
   ------------------------------------------------------------
   לוגיקה טהורה, בלי שום תלות ב-firebase-admin (ראו lib/reminders.js
   להסבר הכללי על התבנית). מרוכזת לפי מסגרת, כמו lib/cert_expiry_reminders.
   ============================================================ */

const SHED_IDS = ["shed1", "shed2", "shed3", "shed4", "shed5", "dept", "maint", "training"];

/* מנרמל את "עכשיו" לחצות מקומית לפני החישוב — ראו הערה מקבילה ב-
   lib/cert_expiry_reminders.js — כדי שההפרש בימים לא יתעוות לפי שעת היום. */
function daysSince(dateStr, now) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00").getTime();
  return Math.floor((today.getTime() - d) / 86400000);
}

/* מוצא אנשי מילואים (reserve:true) שתאריך הרענון האחרון שלהם ישן מדי, לפי
   מסגרת, בלי תזכורת כפולה על אותו אדם תוך תקופת ה-cooldown. */
async function findOverdueReserves(db, opts = {}) {
  const now = opts.now ?? Date.now();
  const remindAfterDays = opts.remindAfterDays ?? 180;
  const cooldownDays = opts.cooldownDays ?? 14;
  const shedIds = opts.shedIds ?? SHED_IDS;

  const logSnap = await db.doc("sq124/_reserve_reminder_log").get();
  const remindedAt = logSnap.exists ? (logSnap.data().v || {}) : {};
  const updatedLog = { ...remindedAt };
  const toSend = [];

  for (const shedId of shedIds) {
    const personnelSnap = await db.doc(`sq124/${shedId}_cfg_personnel`).get();
    const personnel = personnelSnap.exists ? (personnelSnap.data().v || []) : [];
    const reserves = personnel.filter((p) => p && p.name && p.reserve);
    if (!reserves.length) continue;

    const items = [];
    for (const p of reserves) {
      if (!p.refresh) continue;
      const age = daysSince(p.refresh, now);
      if (age < remindAfterDays) continue;

      const logKey = shedId + "|" + p.name;
      if (updatedLog[logKey] && (now - updatedLog[logKey]) < cooldownDays * 86400000) continue;

      items.push({ person: p.name, age });
      updatedLog[logKey] = now;
    }
    if (items.length) toSend.push({ shedId, items });
  }
  return { toSend, updatedLog };
}

module.exports = { SHED_IDS, daysSince, findOverdueReserves };
