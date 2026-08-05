/* ============================================================
   התראה יומית ממוקדת — שיבוץ תורנויות מתוך "לוח צוות שבועי"
   ------------------------------------------------------------
   board_roster (מסמך גלובלי, לא לפי סככה — הלוח מערבב שמות מכמה
   סככות) נשמר ע"י מי שמפרסם את הלוח: {weekKey, days:{<יום עברי>:
   {duty:[שמות], rest:[שמות]}}}. הפונקציה הזו קוראת את היום הנוכחי
   (לפי שעון ישראל, לא שעון השרת), מצליבה כל שם מול רשימות הצוות
   האמיתיות של כל הסככות כדי לדעת לאיזו סככה הוא שייך, ומחזירה
   תקציר לכל סככה בנפרד — כדי שההתראה תישלח רק למפקד הרלוונטי, לא
   לכל הטייסת. שם שמופיע באפס סככות או ביותר מסככה אחת מסומן
   כ"לא זוהה" ולא משויך לאף אחד — לא מנחשים.
   ============================================================ */

const { SHED_IDS } = require("./reminders");

const WEEK_DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const WEEKDAY_EN_TO_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

/* יום השבוע הנוכחי לפי שעון ישראל בפועל — לא לפי אזור הזמן שבו רץ
   תהליך הפונקציה (בד"כ UTC), כדי שלא "נחטוף" יום שגוי סביב חצות. */
function todayHebrewDayName(now, timeZone = "Asia/Jerusalem") {
  const enWeekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(new Date(now));
  const idx = WEEKDAY_EN_TO_INDEX[enWeekday];
  return idx === undefined ? null : WEEK_DAYS_HE[idx];
}

/* לאיזו סככה שם שייך בפועל — לפי רשימות הצוות האמיתיות, לא ניחוש.
   שם שלא נמצא באף רשימה, או שנמצא ביותר מאחת (שם כפול בין סככות),
   מוחזר null במכוון — עדיף לדלג ולסמן כ"לא זוהה" מאשר לשלוח למפקד
   הלא-נכון. */
function resolveNameToShed(name, shedPersonnelMap) {
  const matches = [];
  for (const [shedId, list] of Object.entries(shedPersonnelMap)) {
    if (list.some((p) => p && p.name === name)) matches.push(shedId);
  }
  return matches.length === 1 ? matches[0] : null;
}

/* מחזירה {dayName, digests:[{shedId,duty:[],rest:[]}], unmatched:[]}.
   digests לא כולל סככה בלי אף שם שהצליח — "אין מה לדווח" לא מייצר רעש. */
async function buildDutyRosterDigests(db, opts = {}) {
  const now = opts.now ?? Date.now();
  const shedIds = opts.shedIds ?? SHED_IDS;
  const timeZone = opts.timeZone ?? "Asia/Jerusalem";

  const dayName = todayHebrewDayName(now, timeZone);
  if (!dayName) return { dayName: null, digests: [], unmatched: [] };

  const rosterSnap = await db.doc("sq124/board_roster").get();
  const roster = rosterSnap.exists ? rosterSnap.data().v : null;
  const today = roster && roster.days ? roster.days[dayName] : null;
  if (!today || (!today.duty?.length && !today.rest?.length)) {
    return { dayName, digests: [], unmatched: [] };
  }

  const shedPersonnelMap = {};
  await Promise.all(
    shedIds.map(async (shedId) => {
      const snap = await db.doc(`sq124/${shedId}_cfg_personnel`).get();
      shedPersonnelMap[shedId] = snap.exists ? snap.data().v || [] : [];
    }),
  );

  const byShed = {};
  const unmatched = [];
  const assign = (names, key) => {
    for (const name of names || []) {
      const shedId = resolveNameToShed(name, shedPersonnelMap);
      if (!shedId) { unmatched.push(name); continue; }
      if (!byShed[shedId]) byShed[shedId] = { shedId, duty: [], rest: [] };
      byShed[shedId][key].push(name);
    }
  };
  assign(today.duty, "duty");
  assign(today.rest, "rest");

  return { dayName, digests: Object.values(byShed), unmatched };
}

module.exports = { WEEK_DAYS_HE, todayHebrewDayName, resolveNameToShed, buildDutyRosterDigests };
