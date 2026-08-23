/* ============================================================
   דיף שיבוצים בלוח הצוות התורן — מי נוסף ומי ירד
   ------------------------------------------------------------
   החלטת מוצר (2026-08-23): התראה על *שינוי* בלוח צוות תורן נשלחת
   רק לחייל שהשיבוץ שלו השתנה בפועל ולמפקד שלו — לא לכל הטייסת.
   שידור-לכולם נשמר אך ורק לשני מקרים שבהם באמת מדובר בלוח חדש:
   פרסום לוח שבוע הבא (publishFutureRoster), וקידום לוח לשבוע אחר
   (weekStart השתנה — restoreWeekToCurrent/שחזור מארכיון).

   לוגיקה טהורה, בלי שום תלות ב-firebase-admin (אותה תבנית כמו
   lib/reminders.js) — כדי שאפשר לבדוק אותה בלי emulator.
   ============================================================ */

const {WEEK_DAYS_HE} = require("./duty_roster_digest");

/* התוויות זהות ל-STANDARD_ROSTER_ROWS ב-index.html — כדי שמה שכתוב
   בהתראה יהיה בדיוק שם השורה שהחייל רואה בלוח. */
const ROSTER_SLOT_LABELS = {
  manager: "מנהל", lead: "ר״צ", deputyLead: "ל/ר״צ", fixedAug: "מתגבר",
  pilot: "מטיס", driver: "נהג", tools: "כלים", pf: "PF", pfRest: "נחים PF",
  pms: "PMS", pmsRest: "PMS נחים", reserve: "מילואים", basic: "תורנות",
};
/* שדות "שם בודד" ושדות "מערך שמות" — כפי שהם נשמרים ע"י saveDutyRosterV2. */
const SINGLE_NAME_KEYS = ["manager", "lead", "deputyLead", "pilot", "driver", "tools"];
const NAME_LIST_KEYS = ["fixedAug", "pfRest", "pms", "pmsRest", "reserve"];
/* ⚠️ `duty` ו-`rest` **לא** נכללים בכוונה: הם שדות *נגזרים* שנבנים
   ב-saveDutyRosterV2 מתוך שאר השדות (duty=rosterDayAssigned, rest=
   pfRest+pmsRest). לספור אותם יגרום לכל שינוי להיספר פעמיים ולהופיע
   בהתראה כשיבוץ נוסף שלא קיים בלוח. */

const CUSTOM_PREFIX = "custom_";
const CUSTOM_FALLBACK_LABEL = "שיבוץ נוסף";
/* שלושת ימי משמרת הסופ״ש — נשמרים כשלושה ימים נפרדים אך מתארים משמרת
   רצופה אחת (ר' rosterEditKey ב-index.html), ולכן שינוי אחד בעורך
   מייצר שלוש רשומות זהות. מכווצים אותן לטווח אחד בתצוגה. */
const WEEKEND_RUN = ["חמישי", "שישי", "שבת"];
const WEEKEND_RUN_LABEL = "חמישי–שבת";

/* כל השיבוצים של יום אחד: שם → קבוצת תוויות התפקידים שהוא מחזיק בו.
   שם שמופיע בשתי משבצות באותו יום (פקיד כלים שהוא גם PF) מקבל שתיהן. */
function dayAssignments(day, customRowLabels = {}) {
  const out = new Map();
  if (!day || typeof day !== "object") return out;
  const add = (name, label) => {
    const n = typeof name === "string" ? name.trim() : "";
    if (!n || !label) return;
    if (!out.has(n)) out.set(n, new Set());
    out.get(n).add(label);
  };
  for (const k of SINGLE_NAME_KEYS) add(day[k], ROSTER_SLOT_LABELS[k]);
  for (const k of NAME_LIST_KEYS) {
    if (Array.isArray(day[k])) day[k].forEach((n) => add(n, ROSTER_SLOT_LABELS[k]));
  }
  if (Array.isArray(day.pf)) day.pf.forEach((p) => add(p && p.name, ROSTER_SLOT_LABELS.pf));
  if (Array.isArray(day.basic)) day.basic.forEach((b) => add(b && b.name, ROSTER_SLOT_LABELS.basic));
  for (const k of Object.keys(day)) {
    if (k.indexOf(CUSTOM_PREFIX) !== 0 || !Array.isArray(day[k])) continue;
    const label = customRowLabels[k.slice(CUSTOM_PREFIX.length)] || CUSTOM_FALLBACK_LABEL;
    day[k].forEach((n) => add(n, label));
  }
  return out;
}

/* משווה שני לוחות ומחזירה Map: שם → {added:[{day,label}], removed:[...]}.
   רק שמות שמשהו בשיבוץ שלהם השתנה בפועל מופיעים במפה. */
function diffRosterWeek(before, after, opts = {}) {
  const customRowLabels = opts.customRowLabels || {};
  const days = opts.days || WEEK_DAYS_HE;
  const beforeDays = (before && before.days) || {};
  const afterDays = (after && after.days) || {};
  const byName = new Map();
  const touch = (name) => {
    if (!byName.has(name)) byName.set(name, {added: [], removed: []});
    return byName.get(name);
  };

  for (const day of days) {
    const b = dayAssignments(beforeDays[day], customRowLabels);
    const a = dayAssignments(afterDays[day], customRowLabels);
    for (const name of new Set([...b.keys(), ...a.keys()])) {
      const bl = b.get(name) || new Set();
      const al = a.get(name) || new Set();
      for (const label of al) if (!bl.has(label)) touch(name).added.push({day, label});
      for (const label of bl) if (!al.has(label)) touch(name).removed.push({day, label});
    }
  }
  return byName;
}

/* "PF (ראשון, שני)" — מקבץ לפי תפקיד, ומכווץ את משמרת הסופ״ש לטווח אחד. */
function formatEntries(entries) {
  const byLabel = new Map();
  for (const {day, label} of entries) {
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(day);
  }
  const parts = [];
  for (const [label, rawDays] of byLabel) {
    const set = new Set(rawDays);
    const hasFullWeekend = WEEKEND_RUN.every((d) => set.has(d));
    if (hasFullWeekend) WEEKEND_RUN.forEach((d) => set.delete(d));
    const ordered = WEEK_DAYS_HE.filter((d) => set.has(d));
    if (hasFullWeekend) ordered.push(WEEKEND_RUN_LABEL);
    parts.push(`${label} (${ordered.join(", ")})`);
  }
  return parts.join(", ");
}

/* גוף ההתראה האישית לחייל: "נוסף: PF (ראשון, שני) · ירד: נהג (רביעי)" */
function personalChangeBody(change, maxLen = 140) {
  if (!change) return "";
  const parts = [];
  if (change.added.length) parts.push("נוסף: " + formatEntries(change.added));
  if (change.removed.length) parts.push("ירד: " + formatEntries(change.removed));
  const body = parts.join(" · ");
  return body.length > maxLen ? body.slice(0, maxLen - 1) + "…" : body;
}

/* גוף ההתראה למפקד: רשימת אנשי הצוות שלו שהשיבוץ שלהם השתנה. */
function commanderChangeBody(names, maxNames = 6) {
  const list = names.slice(0, maxNames).join(", ");
  const extra = names.length > maxNames ? ` ועוד ${names.length - maxNames}` : "";
  return names.length === 1
    ? `${list} — עודכן בלוח הצוות התורן`
    : `${names.length} מאנשי הצוות שלך עודכנו בלוח: ${list}${extra}`;
}

module.exports = {
  ROSTER_SLOT_LABELS, SINGLE_NAME_KEYS, NAME_LIST_KEYS,
  dayAssignments, diffRosterWeek, personalChangeBody, commanderChangeBody,
};
