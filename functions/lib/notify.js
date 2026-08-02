/* ============================================================
   לוגיקת ההחלטה של notifyOnPublish — הופרדה ללוגיקה טהורה כדי
   שאפשר לבדוק אותה עם אירועי Firestore מדומים, בלי emulator.
   ============================================================ */
const SHED_NAMES = {
  shed1: "סככה 1", shed2: "סככה 2", shed3: "סככה 3", shed4: "סככה 4", shed5: "סככה 5",
  dept: "מחלקות", maint: "מ״ע אחזקה", training: "הדרכה",
};

function classify(docId) {
  if (docId.endsWith("_messages_list")) return "message";
  if (docId.endsWith("_safety_events")) return "safety";
  if (docId.endsWith("_boards_list")) return "board";
  if (docId.endsWith("_training_list")) return "training";
  if (docId.includes("_rollcall_active")) return "rollcall";
  return null;
}

/* מחזירה את ההחלטה (מה לשלוח, לאיזו מסגרת) או null אם אין לשלוח כלום —
   בדיוק אותה לוגיקה שהייתה בתוך notifyOnPublish, רק כפונקציה טהורה. */
function decide({docId, before, after}) {
  const kind = classify(docId);
  if (!kind) return null;

  let newItems = [];
  let shedId;
  if (kind === "rollcall") {
    if (!(after === true && before !== true)) return null;
    shedId = docId.slice(0, docId.indexOf("_rollcall_active"));
  } else {
    shedId = docId.replace(/_(messages_list|safety_events|boards_list|training_list)$/, "");
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
    rollcall: "🚨 נכס · " + shedName,
  };
  const title = KIND_TITLES[kind];
  const body = kind === "rollcall" ? "הופעל נכס — יש לסמן נוכחות עכשיו"
    : kind === "message" ? String(item.text || "").slice(0, 140)
    : kind === "board" ? String(item.label || "")
    : String(item.title || item.fname || "");

  return {kind, shedId, shedName, title, body, count: newItems.length || 1};
}

module.exports = {SHED_NAMES, classify, decide};
