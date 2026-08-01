/* Cloud Function — התראות Push לטייסת 124
   ------------------------------------------------
   מופעלת אוטומטית כשמסמך באוסף sq124 משתנה. אם זה מסמך של הודעות
   (…_messages_list), קרא-וחתום (…_safety_events), לוח צוות (…_boards_list)
   או חומר הדרכה (…_training_list) ונוסף פריט חדש — שולחת התראת FCM לכל
   המכשירים הרשומים במסגרת הזו. שאר השינויים מסוננים מיד (return).

   הסיסמאות/מפתחות של השליחה נשמרים בשרת (Admin SDK) — לא בקוד הלקוח. */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const {getStorage} = require("firebase-admin/storage");
const {findUnsignedReminders} = require("./lib/reminders");
const {dumpCollection} = require("./lib/backup");

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
  else if (docId.endsWith("_boards_list")) kind = "board";
  else if (docId.endsWith("_training_list")) kind = "training";
  else if (docId.includes("_rollcall_active")) kind = "rollcall";
  else return; // כל שאר המסמכים (צוות, הסמכות, טוקנים…) — לא רלוונטי

  const before = event.data.before.exists ? event.data.before.data().v : undefined;
  const after = event.data.after.exists ? event.data.after.data().v : undefined;

  /* נכס הוא מתג בוליאני, לא רשימה של פריטים — ולכן הוא לא יכול לעבור
     בהשוואת המזהים שלמטה. שולחים רק במעבר כבוי→פעיל: סיום נכס או
     כתיבה חוזרת של אותו ערך לא מייצרים התראה.
     המפתח הוא <מסגרת>_rollcall_active[_<מחלקה>], ולכן ההתראה יוצאת
     מעצמה רק לטוקנים של אותה מסגרת — בדיוק כנדרש. */
  let newItems = [];
  let shedId;
  if (kind === "rollcall") {
    if (!(after === true && before !== true)) return;
    shedId = docId.slice(0, docId.indexOf("_rollcall_active"));
  } else {
    shedId = docId.replace(/_(messages_list|safety_events|boards_list|training_list)$/, "");
    const afterArr = Array.isArray(after) ? after : [];
    if (!Array.isArray(after)) return;
    const beforeIds = new Set((Array.isArray(before) ? before : []).map((x) => x && x.id));
    newItems = afterArr.filter((x) => x && x.id && !beforeIds.has(x.id));
    if (!newItems.length) return; // לא נוסף פריט חדש (עריכה/מחיקה) — לא שולחים
  }

  // הטוקנים של המסגרת הזו
  const tokRef = db.doc("sq124/push_tokens_" + shedId);
  const tokSnap = await tokRef.get();
  const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
  const tokens = Object.keys(tokMap);
  if (!tokens.length) return;

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

  // data-only: ה-Service Worker מציג את ההתראה ומעדכן את ה-badge (נדרש לאייפון)
  const resp = await getMessaging().sendEachForMulticast({
    tokens,
    data: {title, body, kind, n: String(newItems.length || 1)},
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

/* ===== תזכורת אוטומטית — קרא-וחתום שלא נסגר =====
   רץ כל בוקר. שולח פוש רק למפקדי המסגרת (לא לכל הצוות) — המטרה היא
   לדחוף למי שיכול לרדוף אחרי החותמים, לא להציף את כל הסככה. פריט
   שכבר קיבל תזכורת ב-3 הימים האחרונים לא נשלח שוב (ראו lib/reminders). */
exports.remindUnsignedDaily = onSchedule(
  {
    schedule: "0 7 * * *",
    timeZone: "Asia/Jerusalem",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const {toSend, updatedLog} = await findUnsignedReminders(db);
    if (!toSend.length) return;

    let sentCount = 0;
    for (const item of toSend) {
      const tokRef = db.doc("sq124/push_tokens_" + item.shedId);
      const tokSnap = await tokRef.get();
      const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
      const cmdTokens = Object.entries(tokMap)
        .filter(([, m]) => m && m.role === "מפקד")
        .map(([t]) => t);
      if (!cmdTokens.length) continue;

      const shedName = SHED_NAMES[item.shedId] || item.shedId;
      await getMessaging().sendEachForMulticast({
        tokens: cmdTokens,
        data: {
          title: "⏳ תזכורת חתימות · " + shedName,
          body: `"${item.title}" — ${item.missing} עדיין לא חתמו`,
          kind: "reminder",
          n: String(item.missing),
        },
      });
      sentCount++;
    }
    await db.doc("sq124/_reminder_log").set({v: updatedLog, updated: Date.now()}, {merge: true});
    console.log(`תזכורות חתימות: ${toSend.length} פריטים דורשים תזכורת, ${sentCount} נשלחו בפועל`);
  },
);

/* ===== גיבוי שבועי =====
   מייצא את כל אוסף sq124 לקובץ JSON ב-Cloud Storage (הדלי הדיפולטי של
   הפרויקט), כל יום ראשון בלילה. לא נוגע באפליקציה שהמשתמשים רואים —
   הגנה מפני מחיקה בטעות/תקלה שתאבד נתונים בלי שום עותק. */
exports.weeklyBackup = onSchedule(
  {
    schedule: "0 3 * * 0",
    timeZone: "Asia/Jerusalem",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const {docs, count} = await dumpCollection(db);
    const stamp = new Date().toISOString().slice(0, 10);
    const path = `backups/sq124-${stamp}.json`;
    const bucket = getStorage().bucket();
    await bucket.file(path).save(JSON.stringify(docs), {contentType: "application/json"});
    console.log(`גיבוי שבועי: ${count} מסמכים -> ${path}`);
  },
);
