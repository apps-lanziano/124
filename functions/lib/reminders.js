/* ============================================================
   תזכורת אוטומטית — קרא-וחתום שלא נסגר
   ------------------------------------------------------------
   לוגיקה טהורה, בלי שום תלות ב-firebase-admin — כך שאפשר לבדוק אותה
   עם db מדומה (אובייקט פשוט), בלי Firestore emulator. functions/index.js
   הוא היחיד שמחבר את זה ל-Firestore/Messaging האמיתיים.

   db.doc(path).get() צריך להחזיר { exists, data(){ return {v: ...} } } —
   בדיוק כמו שהמסמכים האמיתיים נשמרים (עטופים ב-v, ראו sSetRaw באפליקציה).
   ============================================================ */

const SHED_IDS = ["shed1", "shed2", "shed3", "shed4", "shed5", "dept", "maint", "training"];

/* חייב להיות זהה בדיוק ל-safeName באפליקציה (index.html) — זה המפתח
   שתחתיו נשמרות החתימות של כל אדם. */
const safeName = (n) => String(n || "").trim().replace(/[\s/\\'"]+/g, "_");

/* ימים מאז יצירת הפריט (ev_<timestamp>) — זהה ל-eventAgeDays באפליקציה. */
function eventAgeDays(evId, now) {
  const m = /_(\d{10,})/.exec(evId || "");
  if (!m) return 0;
  return Math.floor((now - Number(m[1])) / 86400000);
}

/* מוצא פריטי קרא-וחתום שיש להם חתימות חסרות, עברו מספיק זמן מהפרסום,
   ולא נשלחה עליהם תזכורת לאחרונה (cooldown). לא שולח כלום בעצמו —
   מחזיר את הרשימה + יומן מעודכן, כדי שהקריאה תישאר טהורה וניתנת לבדיקה. */
async function findUnsignedReminders(db, opts = {}) {
  const now = opts.now ?? Date.now();
  const remindAfterDays = opts.remindAfterDays ?? 3;
  const cooldownDays = opts.cooldownDays ?? 3;
  const shedIds = opts.shedIds ?? SHED_IDS;

  const logSnap = await db.doc("sq124/_reminder_log").get();
  const remindedAt = logSnap.exists ? (logSnap.data().v || {}) : {};
  const updatedLog = { ...remindedAt };
  const toSend = [];

  for (const shedId of shedIds) {
    const eventsSnap = await db.doc(`sq124/${shedId}_safety_events`).get();
    const events = eventsSnap.exists ? (eventsSnap.data().v || []) : [];
    if (!events.length) continue;

    const personnelSnap = await db.doc(`sq124/${shedId}_cfg_personnel`).get();
    const todayKey = new Date(now).toISOString().slice(0, 10);
    const personnel = (personnelSnap.exists ? (personnelSnap.data().v || []) : [])
      .filter((p) => p && p.name && !(p.release && p.release <= todayKey));
    if (!personnel.length) continue;

    for (const ev of events) {
      if (!ev || !ev.id) continue;
      const age = eventAgeDays(ev.id, now);
      if (age < remindAfterDays) continue;

      const logKey = shedId + "|" + ev.id;
      if (updatedLog[logKey] && (now - updatedLog[logKey]) < cooldownDays * 86400000) continue;

      let missing = 0;
      for (const p of personnel) {
        const sigsSnap = await db.doc(`sq124/${shedId}_sigs_${safeName(p.name)}`).get();
        const sigs = sigsSnap.exists ? (sigsSnap.data().v || {}) : {};
        if (!sigs[ev.id]) missing++;
      }
      if (missing > 0) {
        toSend.push({ shedId, eventId: ev.id, title: ev.title, missing, age });
        updatedLog[logKey] = now;
      }
    }
  }
  return { toSend, updatedLog };
}

module.exports = { SHED_IDS, safeName, eventAgeDays, findUnsignedReminders };
