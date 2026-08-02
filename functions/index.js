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
const {decide, SHED_NAMES} = require("./lib/notify");

initializeApp();
const db = getFirestore();

exports.notifyOnPublish = onDocumentWritten(
  {
    document: "sq124/{docId}",
    maxInstances: 10, // תקרת-בטיחות: לעולם לא יותר מ-10 מופעים במקביל — חוסם "בריחת" עלויות
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
  const docId = event.params.docId;
  const before = event.data.before.exists ? event.data.before.data().v : undefined;
  const after = event.data.after.exists ? event.data.after.data().v : undefined;

  const decision = decide({docId, before, after});
  if (!decision) return;
  const {kind, shedId, title, body, count} = decision;

  // הטוקנים של המסגרת הזו
  const tokRef = db.doc("sq124/push_tokens_" + shedId);
  const tokSnap = await tokRef.get();
  const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
  const tokens = Object.keys(tokMap);
  if (!tokens.length) return;

  // data-only: ה-Service Worker מציג את ההתראה ומעדכן את ה-badge (נדרש לאייפון)
  const resp = await getMessaging().sendEachForMulticast({
    tokens,
    data: {title, body, kind, n: String(count)},
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
