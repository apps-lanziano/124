/* ============================================================
   לוגיקת ההחלטה של notifyOnPublish — הופרדה ללוגיקה טהורה כדי
   שאפשר לבדוק אותה עם אירועי Firestore מדומים, בלי emulator.
   ============================================================ */
const {diffRosterWeek, personalChangeBody} = require("./roster_changes");

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
  // פניות תמיכה — מסמך גלובלי אחד (support_tickets). התראה למנהל-העל בלבד
  // (הטוקן שלו רשום ב-push_tokens_admin), לא למסגרת.
  if (docId === "support_tickets") return "support";
  return null;
}

/* מחזירה את ההחלטה (מה לשלוח, לאיזו מסגרת) או null אם אין לשלוח כלום —
   בדיוק אותה לוגיקה שהייתה בתוך notifyOnPublish, רק כפונקציה טהורה. */
// לוח צוות תורן משודר לכל הטייסת (כל המסגרות) ולא למסגרת בודדת — אין
// docId עם קידומת מסגרת לחלץ ממנו shedId, ולכן משתמשים בדגל מיוחד זה;
// notifyOnPublish (functions/index.js) מזהה אותו ושולח בלולאה על כל
// SHED_IDS, במקום לפנות ל-push_tokens_<shedId> בודד כמו כל שאר הסוגים.
const BROADCAST_SHED = "__broadcast__";
/* שינוי בשיבוץ בלוח קיים אינו משודר לכל הטייסת אלא נשלח פר-אדם: כל חייל
   שהשיבוץ שלו השתנה, והמפקד של המסגרת שלו. decide() מחזירה כאן מפה של
   שם→גוף-ההתראה, ו-notifyOnPublish (functions/index.js) מצליב אותה מול
   רשימות הצוות (cfg_personnel) ומול הטוקנים הרשומים. */
const PER_PERSON_SHED = "__perperson__";

/* מחליטה מה לעשות עם *שינוי* בלוח שכבר גלוי למשתמשים (הנוכחי, או "הבא"
   שכבר פורסם), אחרי ששער ה-pushedAt כבר עבר:
   • weekStart השתנה = לוח של שבוע אחר נכנס לתוקף (קידום מ"הבא"/שחזור
     מארכיון) — זה לוח חדש ולא "שינוי שיבוץ", ולכן משודר לכולם. דיף
     פר-חייל היה חסר משמעות כאן ממילא (כמעט כל השמות משתנים).
   • אותו שבוע = עריכה נקודתית → רק מי שנוסף/ירד + המפקד שלו.
   • רק מטא-דאטה השתנתה (טווח נוחים/תורן טייסת/השבתת שורה/תיקון תאריך
     על לוח בלי weekStart קודם) — אף אחד לא מקבל התראה. */
function rosterChangeDecision(before, after, customRowLabels) {
  const beforeWeek = (before && before.weekStart) || "";
  const afterWeek = (after && after.weekStart) || "";
  // "שבוע אחר" רק כששני הצדדים מתוארכים בפועל: לוח legacy בלי weekStart
  // שמקבל תאריך בשמירה רגילה (publishRoster מרענן weekStart בכל שמירה)
  // אינו לוח חדש, ואסור שייראה ככזה.
  if (beforeWeek && afterWeek && beforeWeek !== afterWeek) {
    return {kind: "roster_week", shedId: BROADCAST_SHED, count: 1};
  }
  const byName = diffRosterWeek(before, after, {customRowLabels});
  if (!byName.size) return null;
  const perName = {};
  for (const [name, change] of byName) perName[name] = personalChangeBody(change);
  return {kind: "roster_change", shedId: PER_PERSON_SHED, perName, count: byName.size};
}

function decide({docId, before, after, customRowLabels}) {
  let kind = classify(docId);
  if (!kind) return null;

  let newItems = [];
  let shedId;
  let perName = null;
  if (kind === "roster_current") {
    // כל כתיבה ללוח הצוות הפעיל (הנוכחי) עלולה לבוא גם מכתיבת-מערכת שקטה
    // (רוטציה שבועית אוטומטית, maybeRotateWeek ב-index.html) — לא רק
    // מדחיפה מפורשת של מ״ע תורנויות. שולחים רק כש-pushedAt השתנה לערך חדש
    // (נקבע ורק בפעולה מכוונת — ראו saveDutyRosterV2/manualPush); רוטציה
    // אוטומטית משמרת בכוונה את pushedAt הישן כדי לא "להיראות" כמו שינוי.
    if (before === undefined) return null;   // יצירה ראשונה — לא "עדכון" בעיני משתמש
    if (!after || !after.pushedAt || after.pushedAt === (before && before.pushedAt)) return null;
    const change = rosterChangeDecision(before, after, customRowLabels);
    if (!change) return null;
    kind = change.kind; shedId = change.shedId; perName = change.perName || null;
    newItems = new Array(change.count).fill(null);
  } else if (kind === "roster_next") {
    // "next" גלוי לכולם רק אחרי שסומן published (ראו publishFutureRoster
    // ב-index.html) — לפני זה רק מ״ע תורנויות רואה, ואין למי להודיע.
    // מעבר false→true = פרסום לוח חדש; כתיבה נוספת כשכבר published מקודם
    // = עדכון ללוח שכבר גלוי (אותו מלל כמו עדכון ללוח הנוכחי) — וגם שם
    // נדרש pushedAt חדש בפועל, מאותה סיבה כמו למעלה.
    if (!(after && after.published)) return null;
    const wasPublished = !!(before && before.published);
    if (!wasPublished) {
      // פרסום ראשון — "לוח צוות חדש", לכל הטייסת (החלטת מוצר, כלל 1)
      kind = "roster_publish";
      shedId = BROADCAST_SHED;
    } else {
      // כבר פורסם: זו עריכה של לוח שכבר גלוי — אותם כללים כמו הלוח הנוכחי
      if (!after.pushedAt || after.pushedAt === (before && before.pushedAt)) return null;
      const change = rosterChangeDecision(before, after, customRowLabels);
      if (!change) return null;
      kind = change.kind; shedId = change.shedId; perName = change.perName || null;
      newItems = new Array(change.count).fill(null);
    }
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
  } else if (kind === "support") {
    // פנייה חדשה בתמיכה — מזהים לפי id שלא היה קודם. תשובות של המנהל
    // (עדכון פנייה קיימת) לא מוסיפות id חדש ולכן לא מפעילות התראה.
    // הטוקן של מנהל-העל רשום ב-push_tokens_admin (ראו syncAdminPushToken).
    if (!Array.isArray(after)) return null;
    const beforeIds = new Set((Array.isArray(before) ? before : []).map((x) => x && x.id));
    newItems = after.filter((x) => x && x.id && !beforeIds.has(x.id));
    if (!newItems.length) return null;
    shedId = "admin";
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
    roster_week: "לוח צוות חדש נכנס לתוקף",
    roster_change: "🗓️ עדכון בלוח הצוות התורן",
    support: "📩 פנייה חדשה בתמיכה",
  };
  const title = KIND_TITLES[kind];
  const body = kind === "rollcall" ? "הופעל נכס — יש לסמן נוכחות עכשיו"
    : kind === "morning_rollcall" ? morningRollcallBody(after)
    : kind === "message" ? String(item.text || "").slice(0, 140)
    : kind === "board" ? String(item.label || "")
    : kind === "binui_fault" ? (item.shedName ? item.shedName + ": " : "") + String(item.title || "")
    : kind === "duty_naat" ? `${newItems.length} פריטים ממתינים לאישורך`
    : kind === "roster_publish" ? "לוח הצוות התורן לשבוע הבא זמין לצפייה"
    : kind === "roster_week" ? "לחצו כדי לצפות בשיבוץ של השבוע"
    // roster_change: הגוף אישי לכל נמען (perName) — נבנה ב-notifyOnPublish
    : kind === "roster_change" ? ""
    : kind === "support" ? (String(item.by || "משתמש") + ": " + String(item.text || "").slice(0, 120))
    : String(item.title || item.fname || "");

  // מסדר בוקר/תקלה רגילה/תקלת בינוי נשלחים רק למפקדים — לא לכל הצוות
  // (בשונה מהודעה/קרא-וחתום/לוח/הדרכה/לוח צוות, שמגיעים לכולם). אישורי
  // מ״ע נשלחים לכל הטוקנים שרשומים ב-push_tokens_naat (רק מ״ע תורנויות).
  // פניות תמיכה נשלחות לכל הטוקנים ב-push_tokens_admin (רק מנהל-העל).
  const commandersOnly = kind === "morning_rollcall" || kind === "fault" || kind === "binui_fault";

  return {kind, shedId, shedName, title, body, perName, count: kind==="morning_rollcall" ? (after.absentCount||0) : (newItems.length || 1), commandersOnly};
}

module.exports = {SHED_NAMES, classify, decide, BROADCAST_SHED, PER_PERSON_SHED};
