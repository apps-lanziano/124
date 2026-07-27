/* Cloud Function — התראות Push לטייסת 124
   ------------------------------------------------
   מופעלת אוטומטית כשמסמך באוסף sq124 משתנה. אם זה מסמך של הודעות
   (…_messages_list) או קרא-וחתום (…_safety_events) ונוסף פריט חדש — שולחת
   התראת FCM לכל המכשירים הרשומים במסגרת הזו. שאר השינויים מסוננים מיד (return).

   הסיסמאות/מפתחות של השליחה נשמרים בשרת (Admin SDK) — לא בקוד הלקוח. */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

const SHED_NAMES = {
  shed1: "סככה 1", shed2: "סככה 2", shed3: "סככה 3", shed4: "סככה 4", shed5: "סככה 5",
  dept: "מחלקות", maint: "מ״ע אחזקה", training: "הדרכה",
};

exports.notifyOnPublish = onDocumentWritten(
  {
    document: "sq124/{docId}",
    maxInstances: 10, // תקרת-בטיחות: לעולם לא יותר מ-10 מופעים במקביל — חוסם "בריחת" עלויות
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
  const docId = event.params.docId;
  let kind = null;
  if (docId.endsWith("_messages_list")) kind = "message";
  else if (docId.endsWith("_safety_events")) kind = "safety";
  else return; // כל שאר המסמכים (צוות, הסמכות, טוקנים…) — לא רלוונטי

  const shedId = docId.replace(/_(messages_list|safety_events)$/, "");
  const before = event.data.before.exists ? (event.data.before.data().v || []) : [];
  const after = event.data.after.exists ? (event.data.after.data().v || []) : [];
  if (!Array.isArray(after)) return;

  const beforeIds = new Set((Array.isArray(before) ? before : []).map((x) => x && x.id));
  const newItems = after.filter((x) => x && x.id && !beforeIds.has(x.id));
  if (!newItems.length) return; // לא נוסף פריט חדש (עריכה/מחיקה) — לא שולחים

  // הטוקנים של המסגרת הזו
  const tokRef = db.doc("sq124/push_tokens_" + shedId);
  const tokSnap = await tokRef.get();
  const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
  const tokens = Object.keys(tokMap);
  if (!tokens.length) return;

  const item = newItems[0];
  const shedName = SHED_NAMES[shedId] || shedId;
  const title = kind === "message" ? ("הודעה חדשה · " + shedName) : ("קרא וחתום חדש · " + shedName);
  const body = kind === "message" ? String(item.text || "").slice(0, 140) : String(item.title || "");

  // data-only: ה-Service Worker מציג את ההתראה ומעדכן את ה-badge (נדרש לאייפון)
  const resp = await getMessaging().sendEachForMulticast({
    tokens,
    data: {title, body, kind, n: String(newItems.length)},
  });

  // ניקוי טוקנים שכבר לא תקפים
  const bad = [];
  resp.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument") {
        bad.push(tokens[i]);
      }
    }
  });
  if (bad.length) {
    bad.forEach((t) => delete tokMap[t]);
    await tokRef.set({v: tokMap, updated: Date.now()}, {merge: true});
  }
  console.log(`push ${kind}→${shedId}: ${resp.successCount}/${tokens.length} נשלחו, ${bad.length} טוקנים נוקו`);
});
