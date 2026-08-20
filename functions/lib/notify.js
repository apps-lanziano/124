/* ============================================================
   לוגיקת ההחלטה של notifyOnPublish — הופרדה ללוגיקה טהורה כדי
   שאפשר לבדוק אותה עם אירועי Firestore מדומים, בלי emulator.
   ============================================================ */
const SHED_NAMES = {
  shed1: "סככה 1", shed2: "סככה 2", shed3: "סככה 3", shed4: "סככה 4", shed5: "סככה 5",
  dept: "מחלקות", maint: "מ״ע אחזקה", training: "הדרכה",
};

// אותם 5 סטטוסים כמו MC_STATUSES ב-index.html — סדר ותוויות זהים כדי שגוף
// ההתראה יתאים למה שהמפקד רואה במסך עצמו.
const MC_STATUS_LABELS = [
  ["present", "נוכחים"], ["duty", "תורנות"], ["after", "אפטר"],
  ["duty_team", "צוות תורן"], ["absent", "נעדרים"],
];
function morningRollcallBody(after) {
  if (after.counts) {
    const parts = MC_STATUS_LABELS
      .map(([key, label]) => [after.counts[key] || 0, label])
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}`);
    return parts.length ? parts.join(", ") : "אין נתוני נוכחות";
  }
  // מסמכים ישנים (לפני השדרוג ל-5 סטטוסים) — פורמט present/absent בלבד
  return `${after.presentCount || 0} נוכחים, ${after.absentCount || 0} נעדרים`;
}

function classify(docId) {
  if (docId.endsWith("_messages_list")) return "message";
  if (docId.endsWith("_safety_events")) return "safety";
  if (docId.endsWith("_boards_list")) return "board";
  if (docId.endsWith("_training_list")) return "training";
  // חייב לבדוק את binui_faults_list (מסמך גלובלי, בלי קידומת מסגרת) לפני
  // הבדיקה הכללית — "binui_faults_list" בעצמו מסתיים ב-"_faults_list"
  if (docId === "binui_faults_list") return "binui_fault";
  if (docId.endsWith("_faults_list")) return "fault";
  if (docId.includes("_rollcall_active")) return "rollcall";
  if (docId.endsWith("_daily_rollcall_report")) return "morning_rollcall";
  // אילוצים/החלפות שממתינים לאישור מ״ע תורנויות (מסמך duty_requests של מסגרת)
  if (docId.endsWith("_duty_requests")) return "duty_naat";
  // לוח צוות תורן (Roster v2) — מסמך גלובלי אחד לכל הטייסת (לא לפי מסגרת,
  // בשונה מכל שאר הסוגים למעלה) — ראו rosterStorageKey/saveDutyRosterV2
  // ב-index.html. "current" הוא הלוח הפעיל שכולם רואים כברירת מחדל;
  // "next" הוא לוח השבוע הבא, גלוי לכולם רק אחרי שסומן published.
  if (docId === "board_roster") return "roster_current";
  if (docId === "board_roster_next") return "roster_next";
  return null;
}

/* מחזירה את ההחלטה (מה לשלוח, לאיזו מסגרת) או null אם אין לשלוח כלום —
   בדיוק אותה לוגיקה שהייתה בתוך notifyOnPublish, רק כפונקציה טהורה. */
// לוח צוות תורן משודר לכל הטייסת (כל המסגרות) ולא למסגרת בודדת — אין
// docId עם קידומת מסגרת לחלץ ממנו shedId, ולכן משתמשים בדגל מיוחד זה;
// notifyOnPublish (functions/index.js) מזהה אותו ושולח בלולאה על כל
// SHED_IDS, במקום לפנות ל-push_tokens_<shedId> בודד כמו כל שאר הסוגים.
const BROADCAST_SHED = "__broadcast__";

function decide({docId, before, after}) {
  let kind = classify(docId);
  if (!kind) return null;

  let newItems = [];
  let shedId;
  if (kind === "roster_current") {
    // כל כתיבה ללוח הצוות הפעיל (הנוכחי) = עדכון לכולם. יצירה ראשונה של
    // המסמך (before===undefined) לא נחשבת "עדכון" בעיני משתמש — מדלגים.
    if (before === undefined) return null;
    shedId = BROADCAST_SHED;
  } else if (kind === "roster_next") {
    // "next" גלוי לכולם רק אחרי שסומן published (ראו publishFutureRoster
    // ב-index.html) — לפני זה רק מ״ע תורנויות רואה, ואין למי להודיע.
    // מעבר false→true = פרסום לוח חדש; כתיבה נוספת כשכבר published מקודם
    // = עדכון ללוח שכבר גלוי (אותו מלל כמו עדכון ללוח הנוכחי).
    if (!(after && after.published)) return null;
    const wasPublished = !!(before && before.published);
    kind = wasPublished ? "roster_current" : "roster_publish";
    shedId = BROADCAST_SHED;
  } else if (kind === "rollcall") {
    if (!(after === true && before !== true)) return null;
    shedId = docId.slice(0, docId.indexOf("_rollcall_active"));
  } else if (kind === "morning_rollcall") {
    if (!after || typeof after !== "object") return null;
    // כל כתיבה מחליפה את הדיווח הקודם (לא נצבר) — שולחים רק כשזה דיווח
    // חדש בפועל (חותמת זמן שונה), לא על כל שינוי מקרי במסמך
    if (before && before.sentAt === after.sentAt) return null;
    shedId = docId.slice(0, docId.indexOf("_daily_rollcall_report"));
  } else if (kind === "binui_fault") {
    // מסמך גלובלי אחד לכל הטייסת (בלי קידומת מסגרת) — כל התקלות מדווחות
    // תמיד ל-מ״ע אחזקה, בלי קשר לאיזו מסגרת דיווחה. עד עכשיו התזכורת
    // היחידה הייתה תזכורת ידנית בוואטסאפ ("openWaPrompt('binui',...)").
    if (!Array.isArray(after)) return null;
    const beforeIds = new Set((Array.isArray(before) ? before : []).map((x) => x && x.id));
    newItems = after.filter((x) => x && x.id && !beforeIds.has(x.id));
    if (!newItems.length) return null;
    shedId = "maint";
  } else if (kind === "duty_naat") {
    // התראה ל-מ״ע תורנויות: פריט (החלפה/אילוץ) שרק עכשיו נכנס לסטטוס
    // שממתין לאישורו — naat (החלפה שהמפקד אישר) או naat_c (אילוץ שמפקד
    // הזין אחרי חלון ההזנה). שולחים רק על מעבר חדש לסטטוס הזה, לא על כל
    // כתיבה למסמך. הטוקנים נשמרים ב-push_tokens_naat (גלובלי, רק מ״ע).
    if (!Array.isArray(after)) return null;
    const awaitsNaat = (s) => s === "naat" || s === "naat_c";
    const beforeById = new Map(
        (Array.isArray(before) ? before : []).map((x) => [x && x.id, x]));
    newItems = after.filter((x) => {
      if (!x || !x.id || !awaitsNaat(x.status)) return false;
      const prev = beforeById.get(x.id);
      return !prev || !awaitsNaat(prev.status);
    });
    if (!newItems.length) return null;
    shedId = "naat";
  } else {
    shedId = docId.replace(/_(messages_list|safety_events|boards_list|training_list|faults_list)$/, "");
    const afterArr = Array.isArray(after) ? after : [];
    if (!Array.isArray(after)) return null;
    const beforeIds = new Set((Array.isArray(before) ? before : []).map((x) => x && x.id));
    newItems = afterArr.filter((x) => x && x.id && !beforeIds.has(x.id));
    if (!newItems.length) return null;
  }

  const item = newItems[0] || {};
  const shedName = SHED_NAMES[shedId] || shedId;
  const KIND_TITLES = {
    message: "הודעה חדשה · " + shedName,
    safety: "קרא וחתום חדש · " + shedName,
    board: "לוח צוות חדש · " + shedName,
    training: "חומר הדרכה חדש · " + shedName,
    fault: "🔧 תקלה חדשה · " + shedName,
    binui_fault: "🚧 תקלת בינוי חדשה",
    rollcall: "🚨 נכס · " + shedName,
    morning_rollcall: "📋 מסדר בוקר · " + shedName,
    duty_naat: "🔄 אישורי מ״ע תורנויות",
    roster_publish: "פורסם לוח צוות חדש",
    roster_current: "בוצע עדכון ללוח צוות תורן",
  };
  const title = KIND_TITLES[kind];
  const body = kind === "rollcall" ? "הופעל נכס — יש לסמן נוכחות עכשיו"
    : kind === "morning_rollcall" ? morningRollcallBody(after)
    : kind === "message" ? String(item.text || "").slice(0, 140)
    : kind === "board" ? String(item.label || "")
    : kind === "binui_fault" ? (item.shedName ? item.shedName + ": " : "") + String(item.title || "")
    : kind === "duty_naat" ? `${newItems.length} פריטים ממתינים לאישורך`
    : kind === "roster_publish" ? "לוח הצוות התורן לשבוע הבא זמין לצפייה"
    : kind === "roster_current" ? "לחצו כדי לצפות בשיבוץ המעודכן"
    : String(item.title || item.fname || "");

  // מסדר בוקר/תקלה רגילה/תקלת בינוי נשלחים רק למפקדים — לא לכל הצוות
  // (בשונה מהודעה/קרא-וחתום/לוח/הדרכה/לוח צוות, שמגיעים לכולם). אישורי
  // מ״ע נשלחים לכל הטוקנים שרשומים ב-push_tokens_naat (רק מ״ע תורנויות).
  const commandersOnly = kind === "morning_rollcall" || kind === "fault" || kind === "binui_fault";

  return {kind, shedId, shedName, title, body, count: kind==="morning_rollcall" ? (after.absentCount||0) : (newItems.length || 1), commandersOnly};
}

module.exports = {SHED_NAMES, classify, decide, BROADCAST_SHED};
