/* Cloud Function — התראות Push לטייסת 124
   ------------------------------------------------
   מופעלת אוטומטית כשמסמך באוסף sq124 משתנה. אם זה מסמך של הודעות
   (…_messages_list), קרא-וחתום (…_safety_events), לוח צוות (…_boards_list)
   או חומר הדרכה (…_training_list) ונוסף פריט חדש — שולחת התראת FCM לכל
   המכשירים הרשומים במסגרת הזו. שאר השינויים מסוננים מיד (return).

   הסיסמאות/מפתחות של השליחה נשמרים בשרת (Admin SDK) — לא בקוד הלקוח. */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const {getStorage} = require("firebase-admin/storage");
const {getAuth} = require("firebase-admin/auth");
const {findUnsignedReminders} = require("./lib/reminders");
const {findExpiringCerts} = require("./lib/cert_expiry_reminders");
const {findOverdueReserves} = require("./lib/reserve_refresh_reminders");
const {findVoIssues} = require("./lib/vo_reminders");
const {buildDailyDigests, filterDailyDigestTokens} = require("./lib/daily_digest");
const {buildDutyRosterDigests} = require("./lib/duty_roster_digest");
const {analyzeBoardImage: analyzeBoardImageCore} = require("./lib/board_ai_analyze");
const {isQuietDay} = require("./lib/quiet_days");
const {validateTestNotificationRequest} = require("./lib/test_notification");
const {dumpCollection} = require("./lib/backup");
const {decide, SHED_NAMES} = require("./lib/notify");
const {shouldAuthorize} = require("./lib/authorize");

initializeApp();
const db = getFirestore();

// מפתח ה-API של Claude — Secret של Firebase (לא בקוד, לא ב-env רגיל).
// הגדרה חד-פעמית: firebase functions:secrets:set ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

/* ===== markAuthorized — סוגר את פרצת האימות האנונימי =====
   אימות אנונימי (מופעל אוטומטית בטעינת כל דף, לפני הקלדת קוד) עומד
   באותה בדיקת isAuthed() כמו כניסה אמיתית — כך שמי שפותח את האתר
   האמיתי בלבד (בלי להקליד קוד) יכול לקרוא את כל המסד ב-F12 (ראו
   SECURITY.md). הפונקציה הזו נקראת מהלקוח מיד אחרי כניסה מוצלחת עם
   קוד (signInAs), ומצמידה תגית authorized:true לחשבון — רק לאחר
   שווידאה בעצמה בצד השרת (לא סומכת על הלקוח) שזו אכן כניסה עם
   email/password ולא סתם אימות אנונימי. כללי ה-Firestore (שלב הבא,
   רק אחרי אימות שהכניסה החיה אכן מקבלת את התגית) ידרשו authorized==true
   בנוסף לאימות עצמו. */
exports.markAuthorized = onCall(
  {region: "me-west1", enforceAppCheck: true},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "נדרש להיות מחובר");
    }
    if (!shouldAuthorize(request.auth)) {
      throw new HttpsError("permission-denied", "רק כניסה עם קוד תקף מאושרת");
    }
    await getAuth().setCustomUserClaims(request.auth.uid, {authorized: true});
    return {ok: true};
  },
);

/* ===== analyzeBoardImage — הצעת שיבוץ תורנויות מתוך תמונת הלוח =====
   נקראת מהלקוח מיד אחרי העלאת/צפייה בלוח, עם התמונה בקידוד base64.
   לא כותבת שום דבר ל-Firestore — רק מחזירה הצעה. הלקוח ממלא איתה
   מראש את עורך השיבוץ הקיים, ורק שמירה ידנית ע"י אדם (saveDutyRoster)
   מכניסה את זה בפועל ל-board_roster שממנו dutyRosterDigest שולח
   התראות חיות. אם ANTHROPIC_API_KEY לא הוגדר בשרת — נכשל בבירור
   במקום להעמיד פנים שהניתוח הצליח. */
exports.analyzeBoardImage = onCall(
  {region: "me-west1", enforceAppCheck: true, secrets: [ANTHROPIC_API_KEY], memory: "256MiB", timeoutSeconds: 60},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "נדרש להיות מחובר");
    }
    const imageDataUrl = request.data && request.data.image;
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      throw new HttpsError("invalid-argument", "חסרה תמונה לניתוח");
    }
    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "מפתח ה-API של Claude לא מוגדר בשרת");
    }
    // רשימת שמות הצוות — עזר-קריאה ל-AI (ראו lib/board_ai_analyze), לא
    // מקור אמת. מסוננת ומוגבלת כאן כדי לא לתת ללקוח לנפח את הבקשה.
    const rawRoster = request.data && request.data.rosterNames;
    const rosterNames = Array.isArray(rawRoster)
      ? rawRoster.filter((n) => typeof n === "string" && n.trim()).slice(0, 300).map((n) => n.trim().slice(0, 60))
      : [];
    const result = await analyzeBoardImageCore(imageDataUrl, apiKey, {rosterNames});
    if (!result.ok) {
      throw new HttpsError("internal", result.error || "ניתוח התמונה נכשל");
    }
    return {days: result.days};
  },
);

exports.notifyOnPublish = onDocumentWritten(
  {
    document: "sq124/{docId}",
    region: "me-west1", // האזור שבו הפונקציה כבר פרוסה בפועל — בלי זה firebase deploy מנסה למחוק אותה (אזור לא תואם למקור)
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
  const {kind, shedId, title, body, count, commandersOnly} = decision;

  // הטוקנים של המסגרת הזו — מסדר בוקר נשלח רק למפקדים, שאר הסוגים לכולם
  const tokRef = db.doc("sq124/push_tokens_" + shedId);
  const tokSnap = await tokRef.get();
  const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
  const tokens = commandersOnly
    ? Object.entries(tokMap).filter(([, m]) => m && m.role === "מפקד").map(([t]) => t)
    : Object.keys(tokMap);
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
    region: "me-west1", // אותו אזור כמו notifyOnPublish — עקביות, בלי תלות שקטה באזור ברירת המחדל
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    if (isQuietDay(Date.now())) { console.log("תזכורות חתימות: יום שקט (שישי/שבת) — מדלג"); return; }
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

/* ===== תזכורת אוטומטית — הסמכות שפגו/עומדות לפוג =====
   רץ כל בוקר, שולח פוש מרוכז למפקד המסגרת (לא לכל חייל בנפרד) — רשימת
   כל ההסמכות באותה מסגרת שדורשות תשומת לב. אותה הסמכה לא מזכירה שוב
   תוך תקופת ה-cooldown (ראו lib/cert_expiry_reminders). */
exports.remindCertExpiryDaily = onSchedule(
  {
    schedule: "15 7 * * *",
    timeZone: "Asia/Jerusalem",
    region: "me-west1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    if (isQuietDay(Date.now())) { console.log("תזכורות הסמכות: יום שקט (שישי/שבת) — מדלג"); return; }
    const {toSend, updatedLog} = await findExpiringCerts(db);
    if (!toSend.length) return;

    let sentCount = 0;
    for (const group of toSend) {
      const tokRef = db.doc("sq124/push_tokens_" + group.shedId);
      const tokSnap = await tokRef.get();
      const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
      const cmdTokens = Object.entries(tokMap)
        .filter(([, m]) => m && m.role === "מפקד")
        .map(([t]) => t);
      if (!cmdTokens.length) continue;

      const shedName = SHED_NAMES[group.shedId] || group.shedId;
      const expiredCount = group.items.filter((i) => i.daysLeft < 0).length;
      const body = expiredCount
        ? `${expiredCount} הסמכות פג תוקפן, ${group.items.length - expiredCount} עומדות לפוג בקרוב`
        : `${group.items.length} הסמכות עומדות לפוג בקרוב`;
      await getMessaging().sendEachForMulticast({
        tokens: cmdTokens,
        data: {
          title: "🎓 הסמכות דורשות תשומת לב · " + shedName,
          body,
          kind: "cert_reminder",
          n: String(group.items.length),
        },
      });
      sentCount++;
    }
    await db.doc("sq124/_cert_reminder_log").set({v: updatedLog, updated: Date.now()}, {merge: true});
    console.log(`תזכורות הסמכות: ${toSend.length} מסגרות דורשות תשומת לב, ${sentCount} נשלחו בפועל`);
  },
);

/* ===== תזכורת אוטומטית — מילואים שלא רועננו זמן רב =====
   אותו רעיון בדיוק כמו תזכורת ההסמכות — פוש מרוכז למפקד המסגרת בלבד. */
exports.remindReserveRefreshDaily = onSchedule(
  {
    schedule: "30 7 * * *",
    timeZone: "Asia/Jerusalem",
    region: "me-west1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    if (isQuietDay(Date.now())) { console.log("תזכורות מילואים: יום שקט (שישי/שבת) — מדלג"); return; }
    const {toSend, updatedLog} = await findOverdueReserves(db);
    if (!toSend.length) return;

    let sentCount = 0;
    for (const group of toSend) {
      const tokRef = db.doc("sq124/push_tokens_" + group.shedId);
      const tokSnap = await tokRef.get();
      const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
      const cmdTokens = Object.entries(tokMap)
        .filter(([, m]) => m && m.role === "מפקד")
        .map(([t]) => t);
      if (!cmdTokens.length) continue;

      const shedName = SHED_NAMES[group.shedId] || group.shedId;
      await getMessaging().sendEachForMulticast({
        tokens: cmdTokens,
        data: {
          title: "🎖️ רענון מילואים · " + shedName,
          body: `${group.items.length} אנשי מילואים לא רועננו זמן רב`,
          kind: "reserve_reminder",
          n: String(group.items.length),
        },
      });
      sentCount++;
    }
    await db.doc("sq124/_reserve_reminder_log").set({v: updatedLog, updated: Date.now()}, {merge: true});
    console.log(`תזכורות מילואים: ${toSend.length} מסגרות דורשות תשומת לב, ${sentCount} נשלחו בפועל`);
  },
);

/* ===== תזכורת אוטומטית — סקירת מ״ע אחזקה יומית =====
   רכבים/טסטים, רישיונות, הזמנות חומרים וכלים מוטוריים — עד עכשיו לא היה
   לתחומים האלה שום מנגנון תזכורת (בשונה מקרא-וחתום/הסמכות/מילואים למעלה),
   ומ״ע אחזקה היה צריך להיכנס למסך "סקירה" כדי לגלות שמשהו דורש טיפול.
   פוש מרוכז אחד ליום, רק למפקד מסגרת מ״ע אחזקה, עם מספר פריטים לכל תחום —
   לא פריט-פריט, כדי לא להציף (אותו עקרון כמו הבאנרים במסך הסקירה עצמו). */
exports.remindVoIssuesDaily = onSchedule(
  {
    schedule: "45 7 * * *",
    timeZone: "Asia/Jerusalem",
    region: "me-west1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    if (isQuietDay(Date.now())) { console.log("תזכורת מ״ע אחזקה: יום שקט (שישי/שבת) — מדלג"); return; }
    const summary = await findVoIssues(db);
    if (!summary.totalCount) return;

    const tokRef = db.doc("sq124/push_tokens_maint");
    const tokSnap = await tokRef.get();
    const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
    const cmdTokens = Object.entries(tokMap)
      .filter(([, m]) => m && m.role === "מפקד")
      .map(([t]) => t);
    if (!cmdTokens.length) return;

    const parts = [];
    if (summary.vehCount) parts.push(`${summary.vehCount} רכבים/טסטים`);
    if (summary.licCount) parts.push(`${summary.licCount} רישיונות`);
    if (summary.matCount) parts.push(`${summary.matCount} הזמנות חומרים`);
    if (summary.toolCount) parts.push(`${summary.toolCount} כלים מוטוריים`);
    await getMessaging().sendEachForMulticast({
      tokens: cmdTokens,
      data: {
        title: "🔧 סקירת מ״ע אחזקה יומית",
        body: parts.join(", ") + " דורשים תשומת לב",
        kind: "vo_reminder",
        n: String(summary.totalCount),
      },
    });
    console.log(`תזכורת מ״ע אחזקה: ${summary.totalCount} פריטים דורשים תשומת לב`);
  },
);

/* ===== תקציר יומי (כולל שיבוץ תורנויות) =====
   פוש אחד מרוכז לכל מפקד ב-08:00 — כולל גם את ממצאי הבוקר (חתימות/תקלות/
   הסמכות) וגם את שיבוץ התורנות של היום מתוך "לוח צוות שבועי", כהודעה
   אחת. אוחד לבקשת המשתמש (היו שתי התראות נפרדות ב-08:00 וב-08:05).
   שיבוץ התורנות מצליב כל שם מול רשימות הצוות האמיתיות (buildDutyRosterDigests)
   כדי לצרף לכל מפקד רק את החיילים של המסגרת שלו. ריצה יומית קבועה, בלי
   תלות בלוג cooldown של אף תזכורת אחרת (ראו lib/daily_digest.js). */
exports.dailyDigest = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Asia/Jerusalem",
    region: "me-west1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    if (isQuietDay(Date.now())) { console.log("תקציר יומי: יום שקט (שישי/שבת) — מדלג"); return; }
    const digests = await buildDailyDigests(db);
    const {dayName, digests: rosterDigests, unmatched} = await buildDutyRosterDigests(db);
    if (unmatched.length) {
      console.warn(`שיבוץ תורנויות (${dayName}): ${unmatched.length} שמות לא זוהו באף סככה: ${unmatched.join(", ")}`);
    }

    // מאחדים לפי מסגרת — מסגרת נכללת אם יש לה ממצאי סקירה או שיבוץ תורנות היום
    const byShed = new Map();
    for (const d of digests) byShed.set(d.shedId, {shedId: d.shedId, digest: d, roster: null});
    for (const r of rosterDigests) {
      const e = byShed.get(r.shedId) || {shedId: r.shedId, digest: null, roster: null};
      e.roster = r;
      byShed.set(r.shedId, e);
    }
    if (!byShed.size) return;

    let sentCount = 0;
    for (const {shedId, digest, roster} of byShed.values()) {
      const tokRef = db.doc("sq124/push_tokens_" + shedId);
      const tokSnap = await tokRef.get();
      const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
      const cmdTokens = filterDailyDigestTokens(tokMap);
      if (!cmdTokens.length) continue;

      const shedName = SHED_NAMES[shedId] || shedId;
      const lines = [];
      if (digest) {
        const parts = [];
        if (digest.unsignedCount) parts.push(`${digest.unsignedCount} חתימות חסרות`);
        if (digest.openFaults) parts.push(`${digest.openFaults} תקלות פתוחות`);
        if (digest.certsSoon) parts.push(`${digest.certsSoon} הסמכות פגות השבוע`);
        if (parts.length) lines.push(parts.join(" · "));
      }
      if (roster && (roster.duty.length || roster.rest.length)) {
        const rparts = [];
        if (roster.duty.length) rparts.push(`צוות תורן: ${roster.duty.join(", ")}`);
        if (roster.rest.length) rparts.push(`נח: ${roster.rest.join(", ")}`);
        lines.push(`🗓️ תורנות היום${dayName ? ` (${dayName})` : ""} — ${rparts.join(" · ")}`);
      }
      if (!lines.length) continue;

      const count = (digest ? digest.totalCount : 0) +
        (roster ? roster.duty.length + roster.rest.length : 0);
      await getMessaging().sendEachForMulticast({
        tokens: cmdTokens,
        data: {
          title: "📋 סקירה יומית למפקד · " + shedName,
          body: lines.join("\n"),
          kind: "daily_digest",
          n: String(count),
        },
      });
      sentCount++;
    }
    console.log(`תקציר יומי (כולל תורנויות): ${byShed.size} מסגרות, ${sentCount} נשלחו בפועל`);
  },
);

/* ===== sendTestNotificationToSelf — התראת-בדיקה, אך ורק למכשיר הקורא =====
   ה-token מגיע מהלקוח (fcmToken של המכשיר הנוכחי) ולא מחיפוש בשרת —
   מבנית אין דרך לשלוח למישהו אחר עם הפונקציה הזו. נועדה למי שרוצה
   לראות בעצמו איך נראית התראה אוטומטית (כמו dutyRosterDigest) על
   המכשיר שלו, בלי להציף אף מפקד אחר. */
exports.sendTestNotificationToSelf = onCall(
  {region: "me-west1", enforceAppCheck: true, memory: "128MiB", timeoutSeconds: 30},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "נדרש להיות מחובר");
    }
    const {ok, token, title, body, error} = validateTestNotificationRequest(request.data);
    if (!ok) {
      throw new HttpsError("invalid-argument", error);
    }
    try {
      await getMessaging().send({token, data: {title, body, kind: "test_preview"}});
    } catch (e) {
      throw new HttpsError("internal", "שליחת ההתראה נכשלה: " + (e && e.message || String(e)));
    }
    return {ok: true};
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
    region: "me-west1",
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
