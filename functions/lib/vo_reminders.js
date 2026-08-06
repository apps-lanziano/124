/* ============================================================
   תזכורת אוטומטית — סקירת מ״ע אחזקה יומית (רכבים/טסטים/רישיונות/
   הזמנות חומרים/כלים מוטוריים)
   ------------------------------------------------------------
   עד עכשיו ארבעת תחומי המעקב האלה לא היה להם שום מנגנון תזכורת —
   מ״ע אחזקה חייב היה להיכנס למסך "סקירה" כדי לגלות שמשהו דורש טיפול,
   בשונה מקרא-וחתום/הסמכות/מילואים שכבר מקבלים תזכורת יומית אוטומטית
   (ראו lib/reminders, lib/cert_expiry_reminders, lib/reserve_refresh_
   reminders). זו אותה תבנית: לוגיקה טהורה, בלי תלות ב-firebase-admin,
   כדי שאפשר לבדוק בלי emulator. מסכם למספר אחד בכל תחום (לא פריט-פריט)
   כדי לא להציף — בדיוק כמו הבאנרים המרוכזים במסך הסקירה עצמו. */

const SHED_IDS = ["shed1", "shed2", "shed3", "shed4", "shed5", "dept", "maint", "training"];

const VEHICLES_ALERT_DAYS = 14;       // שבועיים לפני טיפול/טיפול חודשי/טיפול שנתי
const VEHICLES_TEST_ALERT_DAYS = 30;  // חודש לפני פקיעת טסט
const VEHICLES_KM_ALERT_BUFFER = 500; // ק"מ/שעו"מ לפני יעד הטיפול
const LICENSE_ALERT_DAYS = 30;
const MOTOR_TOOL_ALERT_DAYS = 14;

function daysUntil(dateStr, now) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00").getTime();
  return Math.round((d - today.getTime()) / 86400000);
}

/* גרסה מצומצמת של vehicleStatusDetailed באפליקציה — מעניינת אותנו רק
   "יש בעיה כן/לא", לא הפירוט המלא שכבר מוצג במסך הסקירה עצמו. */
function vehicleNeedsAttention(v, now) {
  if (!v || v.inService) return false;
  const dateChecks = [
    [v.nextService, VEHICLES_ALERT_DAYS],
    [v.monthlyService, VEHICLES_ALERT_DAYS],
    [v.annualService, VEHICLES_ALERT_DAYS],
    [v.testDate, VEHICLES_TEST_ALERT_DAYS],
  ];
  for (const [dateStr, alertDays] of dateChecks) {
    if (dateStr && daysUntil(dateStr, now) <= alertDays) return true;
  }
  if (v.kmService) {
    const current = (v.km != null && v.km !== "") ? Number(v.km)
      : ((v.hours != null && v.hours !== "") ? Number(v.hours) : null);
    if (current != null && (Number(v.kmService) - current) <= VEHICLES_KM_ALERT_BUFFER) return true;
  }
  return false;
}

/* סופרת פריטים שדורשים תשומת לב בכל אחד מארבעת התחומים. לא שולחת כלום —
   רק מחשבת (בדיוק כמו findExpiringCerts/findOverdueReserves). */
async function findVoIssues(db, opts = {}) {
  const now = opts.now ?? Date.now();
  const shedIds = opts.shedIds ?? SHED_IDS;

  let vehCount = 0;
  for (const shedId of shedIds) {
    const snap = await db.doc(`sq124/${shedId}_vehicles_list`).get();
    const vehicles = snap.exists ? (snap.data().v || []) : [];
    for (const v of vehicles) { if (vehicleNeedsAttention(v, now)) vehCount++; }
  }

  const licSnap = await db.doc("sq124/vo_licenses_list").get();
  const licenses = licSnap.exists ? (licSnap.data().v || []) : [];
  const licCount = licenses.filter(l => l && l.expiry && daysUntil(l.expiry, now) <= LICENSE_ALERT_DAYS).length;

  const matSnap = await db.doc("sq124/maint_materials_list").get();
  const materials = matSnap.exists ? (matSnap.data().v || []) : [];
  const matCount = materials.filter(m => m && m.status !== "התקבל").length;

  const toolSnap = await db.doc("sq124/maint_motor_tools_list").get();
  const tools = toolSnap.exists ? (toolSnap.data().v || []) : [];
  const toolCount = tools.filter(t => t && t.nextCheck && daysUntil(t.nextCheck, now) <= MOTOR_TOOL_ALERT_DAYS).length;

  return {
    vehCount, licCount, matCount, toolCount,
    totalCount: vehCount + licCount + matCount + toolCount,
  };
}

/* עד עכשיו רישיונות עומדים לפוג דיווחו רק במספר המרוכז ל-מ״ע אחזקה
   (findVoIssues, למעלה) — מפקד המסגרת של בעל הרישיון עצמו לא קיבל שום
   התראה, אף שהוא זה שצריך לדאוג שהחייל שלו יחדש. הפונקציה הזו מקבצת
   את אותה רשימת רישיונות גלובלית (vo_licenses_list) לפי שדה shedId על
   כל פריט, כדי לשלוח לכל מפקד תזכורת רק על החיילים שלו — בנוסף לסיכום
   המרוכז שמ״ע אחזקה ממשיך לקבל כרגיל, לא במקומו. משתמשת ב-cooldown
   (כמו findExpiringCerts) כדי לא להטריד כל יום על אותו רישיון בדיוק. */
async function findExpiringLicensesByShed(db, opts = {}) {
  const now = opts.now ?? Date.now();
  const remindWithinDays = opts.remindWithinDays ?? LICENSE_ALERT_DAYS;
  const cooldownDays = opts.cooldownDays ?? 7;

  const logSnap = await db.doc("sq124/_license_reminder_log").get();
  const remindedAt = logSnap.exists ? (logSnap.data().v || {}) : {};
  const updatedLog = { ...remindedAt };

  const licSnap = await db.doc("sq124/vo_licenses_list").get();
  const licenses = licSnap.exists ? (licSnap.data().v || []) : [];

  const byShed = {};
  for (const l of licenses) {
    if (!l || !l.id || !l.expiry || !l.shedId) continue;
    const daysLeft = daysUntil(l.expiry, now);
    if (daysLeft > remindWithinDays) continue;

    if (remindedAt[l.id] && (now - remindedAt[l.id]) < cooldownDays * 86400000) continue;

    if (!byShed[l.shedId]) byShed[l.shedId] = [];
    byShed[l.shedId].push({ person: l.person, type: l.type, daysLeft });
    updatedLog[l.id] = now;
  }
  const toSend = Object.entries(byShed).map(([shedId, items]) => ({ shedId, items }));
  return { toSend, updatedLog };
}

module.exports = { SHED_IDS, daysUntil, vehicleNeedsAttention, findVoIssues, findExpiringLicensesByShed };
