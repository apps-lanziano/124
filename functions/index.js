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
const {findOverdueReserves} = require("./lib/reserve_refresh_reminders");
const {findVoIssues} = require("./lib/vo_reminders");
const {detectAnomalies, buildAlertMessage, WINDOW_MINUTES} = require("./lib/login_anomaly");
const {buildDailyDigests, filterDailyDigestTokens} = require("./lib/daily_digest");
const {buildDutyRosterDigests, resolveNameToShed} = require("./lib/duty_roster_digest");
const {analyzeBoardImage: analyzeBoardImageCore} = require("./lib/board_ai_analyze");
const {isQuietDay} = require("./lib/quiet_days");
const {validateTestNotificationRequest} = require("./lib/test_notification");
const {dumpCollection, computeBackupChecksum, verifyBackupIntegrity} = require("./lib/backup");
const {classify, decide, SHED_NAMES, BROADCAST_SHED, PER_PERSON_SHED} = require("./lib/notify");
const {commanderChangeBody} = require("./lib/roster_changes");
const {shouldAuthorize} = require("./lib/authorize");
const {isSensitiveDocId, buildAuditEntries} = require("./lib/audit_log");
const {checkRateLimit} = require("./lib/rate_limit");
const crypto = require("crypto");

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
   בנוסף לאימות עצמו.

   ⚠️ הקשחה קריטית (2026-08-22): sign_in_provider==="password" *לבד* לא
   מספיק. חשבון "u<code>@sq124.app" נוצר דרך ה-SDK של הלקוח
   (createUserWithEmailAndPassword ב-provisionAuthAccounts) — וזו פעולה
   שכל דפדפן יכול לבצע בעצמו (Email/Password sign-up פתוח ב-Firebase
   Auth כברירת מחדל, ו-App Check-על-Auth רק מוודא "דפדפן אמיתי באתר
   האמיתי", לא "פעולה שהאתר עצמו יזם"). בלי הבדיקה למטה, תוקף חיצוני
   בלי שום קוד/הרשאה יכול היה לפתוח את האתר האמיתי, לקרוא
   ל-createUserWithEmailAndPassword ישירות מ-DevTools עבור קוד-בדוי
   כלשהו (u9999@sq124.app וכו'), להתחבר לחשבון-שהוא-עצמו-יצר (שזו
   כן כניסת password אמיתית — shouldAuthorize מחזיר true), ולקבל
   authorized:true+role:"חייל" **בלי שאף מ״ע אישר אי-פעם את הקוד**.
   הפתרון: authprofile_<hash> חייב להתקיים בפועל (הוא נכתב אך ורק
   ע"י provisionAuthAccounts, יחד עם החשבון) — קוד שלא הוקצה מעולם
   ע"י מ״ע נדחה כאן, לא רק מקבל role ברירת-מחדל. ר'
   authorize_lib_test.mjs + firestore_rules_test.mjs לבדיקות רגרסיה. */
exports.markAuthorized = onCall(
  {region: "me-west1", enforceAppCheck: true},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "נדרש להיות מחובר");
    }
    if (!checkRateLimit(request.auth.uid)) {
      console.warn(`markAuthorized: rate limit uid=${request.auth.uid}`);
      throw new HttpsError("resource-exhausted", "יותר מדי בקשות — נסה שוב בעוד דקה");
    }
    if (!shouldAuthorize(request.auth)) {
      // אירוע אבטחה: ניסיון להשיג authorized:true בלי כניסה אמיתית עם קוד
      // (למשל session אנונימי גולמי). בלי טוקן/סיסמה/PII — רק uid+ספק, לצורך ניטור.
      console.warn(`markAuthorized: נדחה (ספק לא-password) — ספק=${request.auth.token.firebase && request.auth.token.firebase.sign_in_provider} uid=${request.auth.uid}`);
      throw new HttpsError("permission-denied", "רק כניסה עם קוד תקף מאושרת");
    }

    // קרא את התפקיד מ-authprofile בצד השרת — לא סומך על הלקוח.
    // אימייל בפורמט u<code>@sq124.app; מפתח המסמך = sha256("sq124code|" + code).
    // קיום המסמך הזה (לא רק תוכנו) הוא ההוכחה שהקוד הוקצה בפועל ע"י מ״ע —
    // חשבון-Auth לבדו לא מספיק, כי כל דפדפן יכול ליצור אחד לעצמו (ר' למעלה).
    const email = request.auth.token.email || "";
    const codeMatch = email.match(/^u(\d+)@/);
    if (!codeMatch) {
      console.warn(`markAuthorized: נדחה (פורמט אימייל לא תקין) uid=${request.auth.uid}`);
      throw new HttpsError("permission-denied", "חשבון לא מוכר");
    }
    const code = codeMatch[1];
    const hash = crypto.createHash("sha256").update("sq124code|" + code).digest("hex");
    const profSnap = await db.doc("sq124/authprofile_" + hash).get();
    const prof = profSnap.exists ? profSnap.data().v : null;
    if (!prof || typeof prof.role !== "string" || !prof.role) {
      // קוד עם חשבון-Auth קיים (עבר את shouldAuthorize) אך בלי authprofile —
      // כלומר לא הוקצה מעולם ע"י מ״ע. זה בדיוק וקטור התקיפה שסגרנו כאן.
      console.warn(`markAuthorized: נדחה (אין authprofile מוקצה) uid=${request.auth.uid}`);
      throw new HttpsError("permission-denied", "קוד לא מוכר במערכת");
    }
    const role = prof.role;

    await getAuth().setCustomUserClaims(request.auth.uid, {authorized: true, role});
    return {ok: true};
  },
);

/* ===== verifyPersonalPin — אימות PIN אישי בצד השרת =====
   מחליף את verifyPin/verifyMasterPin הלקוחיות. הלקוח שולח shedId+שם+PIN,
   והפונקציה קוראת את הגיבוב מ-Firestore ומשווה כאן (PBKDF2 / SHA-256 legacy).
   נעילה מדורגת: Firestore-based (לא localStorage) — מסמך login_lock_<hash>
   עם failCount + lockUntil. מתאפסת אוטומטית אחרי אימות מוצלח. */
exports.verifyPersonalPin = onCall(
  {region: "me-west1", enforceAppCheck: true},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "נדרש להיות מחובר");
    }
    if (!request.auth.token.authorized) {
      throw new HttpsError("permission-denied", "נדרשת הרשאה");
    }
    if (!checkRateLimit(request.auth.uid)) {
      throw new HttpsError("resource-exhausted", "יותר מדי בקשות — נסה שוב בעוד דקה");
    }
    const {shedId, name, pin} = request.data || {};
    if (!shedId || typeof shedId !== "string" || !name || typeof name !== "string" || !pin || typeof pin !== "string") {
      throw new HttpsError("invalid-argument", "חסרים פרמטרים");
    }
    if (!/^\d{4,6}$/.test(pin)) {
      throw new HttpsError("invalid-argument", "PIN לא תקין");
    }

    // --- נעילה server-side ---
    const lockHash = crypto.createHash("sha256").update("pinlock|" + request.auth.uid).digest("hex").slice(0, 16);
    const lockRef = db.doc("sq124/login_lock_" + lockHash);
    const lockSnap = await lockRef.get();
    const lockData = lockSnap.exists ? lockSnap.data() : {};
    const MAX_TRIES = 5;
    if (lockData.lockUntil && lockData.lockUntil > Date.now()) {
      const waitSec = Math.ceil((lockData.lockUntil - Date.now()) / 1000);
      throw new HttpsError("resource-exhausted", "יותר מדי ניסיונות — המתן " + waitSec + " שניות");
    }

    // בדיקת נעילה בלבד (lockcheck) — הלקוח שואל אם הוא נעול
    if (name === "__lockcheck__") {
      return {ok: true, locked: false};
    }

    // בדיקת master PIN (סיסמת-על) — תמיד, לפני קריאת personnel
    const masterSnap = await db.doc("sq124/admin_master_pin").get();
    const masterRec = masterSnap.exists ? (masterSnap.data().v || null) : null;
    let isMaster = false;
    if (masterRec && masterRec.pinHash && masterRec.pinSalt) {
      const masterH = await serverHashPin(pin, masterRec.pinSalt, masterRec.pinIter || 210000);
      if (masterH === masterRec.pinHash) isMaster = true;
    }

    if (isMaster) {
      await lockRef.set({failCount: 0, lockUntil: 0, updatedAt: Date.now()});
      return {ok: true, master: true};
    }

    // בדיקת master PIN בלבד (verifyMasterPin) — לא צריך personnel
    if (name === "__master__") {
      // master PIN לא תאם — לא סופרים כישלון (לא לחסום משתמש שרק בדק master)
      return {ok: false};
    }

    // --- קריאת רשומת האדם ---
    const persSnap = await db.doc("sq124/" + shedId + "_cfg_personnel").get();
    const personnel = persSnap.exists ? (persSnap.data().v || []) : [];
    const person = personnel.find((p) => p.name === name);

    if (!person) {
      throw new HttpsError("not-found", "משתמש לא נמצא");
    }
    if (!person.pinHash) {
      return {ok: true, noPin: true};
    }

    let match = false;
    if (person.pinAlgo === "pbkdf2") {
      const h = await serverHashPin(pin, person.pinSalt, person.pinIter || 210000);
      match = (h === person.pinHash);
    } else {
      const h = await serverHashPinLegacy(pin, person.pinSalt);
      match = (h === person.pinHash);
    }

    if (!match) {
      // כישלון — עדכן נעילה
      const failCount = (lockData.failCount || 0) + 1;
      const update = {failCount, updatedAt: Date.now()};
      if (failCount % MAX_TRIES === 0) {
        const rounds = Math.floor(failCount / MAX_TRIES);
        const secs = Math.min(30 * Math.pow(2, rounds - 1), 600);
        update.lockUntil = Date.now() + secs * 1000;
      }
      await lockRef.set(update);
      return {ok: false, locked: !!update.lockUntil, waitSec: update.lockUntil ? Math.ceil((update.lockUntil - Date.now()) / 1000) : 0};
    }

    // הצלחה — אפס נעילה
    await lockRef.set({failCount: 0, lockUntil: 0, updatedAt: Date.now()});
    return {ok: true, legacy: person.pinAlgo !== "pbkdf2"};
  },
);

/* PBKDF2 server-side — תואם בדיוק ל-hashPin בלקוח */
async function serverHashPin(pin, salt, iterations) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2("sq124|" + pin, salt, iterations || 210000, 32, "sha256", (err, derived) => {
      if (err) return reject(err);
      resolve(derived.toString("hex"));
    });
  });
}

/* SHA-256 legacy — תואם ל-hashPinLegacy בלקוח */
async function serverHashPinLegacy(pin, salt) {
  const data = "sq124|" + salt + "|" + pin;
  return crypto.createHash("sha256").update(data).digest("hex");
}

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

    // מכסה יומית: 10 קריאות לאנתרופיק לכל משתמש (Firestore transaction אטומי).
    const today = new Date().toISOString().slice(0, 10);
    const quotaRef = db.doc("sq124/ai_quota_" + request.auth.uid);
    const DAILY_LIMIT = 10;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(quotaRef);
      const data = snap.exists ? snap.data() : null;
      const count = (data && data.date === today) ? (data.count || 0) : 0;
      if (count >= DAILY_LIMIT) {
        // אירוע אבטחה: מיצוי מכסה — יכול להעיד על ניצול-לרעה (proxy חינמי ל-Claude).
        console.warn(`analyzeBoardImage: מכסה יומית מוצתה uid=${request.auth.uid}`);
        throw new HttpsError("resource-exhausted", "הגעת למכסה היומית של ניתוח לוח. נסה שוב מחר.");
      }
      tx.set(quotaRef, {date: today, count: count + 1});
    });

    const imageDataUrl = request.data && request.data.image;
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      throw new HttpsError("invalid-argument", "חסרה תמונה לניתוח");
    }
    // תקרת גודל: תמונת לוח אמיתית (צילום/צילום מסך) היא כמה מאות KB עד
    // כמה MB. בלי תקרה, משתמש מאומת (עם מכסה יומית של 10 קריאות) יכול
    // עדיין לשלוח payload ענק בכל קריאה — יותר טוקנים ל-Claude = יותר עלות
    // לכל קריאה בודדת, מעבר למה שמכסה-הכמות לבדה חוסמת. 8MB base64 ~ 6MB
    // תמונה מקורית — נדיב בהרבה מכל תמונת לוח אמיתית.
    const MAX_IMAGE_DATA_URL_LEN = 8 * 1024 * 1024;
    if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LEN) {
      throw new HttpsError("invalid-argument", "התמונה גדולה מדי לניתוח");
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

/* ===== התראת שינוי בלוח הצוות התורן — פר-אדם, לא לכל הטייסת =====
   החלטת מוצר (2026-08-23): "פורסם לוח צוות חדש" נשלח לכולם, אבל *שינוי*
   בלוח שכבר גלוי נשלח אך ורק לחייל שהשיבוץ שלו השתנה בפועל ולמפקד של
   המסגרת שלו. הדיף עצמו מחושב בלוגיקה הטהורה (lib/roster_changes) —
   כאן רק ההצלבה מול הנתונים החיים: שם→מסגרת לפי רשימות הצוות
   (cfg_personnel, בדיוק כמו התקציר היומי), ושם→מכשיר לפי הטוקנים
   הרשומים. שם שלא זוהה באף מסגרת (או שקיים בשתיים) לא משויך לאף מפקד —
   לא מנחשים — אבל החייל עצמו עדיין מקבל התראה אם יש לו טוקן רשום. */
async function sendRosterChangeNotifications({title, kind, perName}) {
  const affected = perName || {};
  const names = Object.keys(affected);
  if (!names.length) return;

  const shedIds = Object.keys(SHED_NAMES);
  const shedPersonnelMap = {};
  await Promise.all(shedIds.map(async (sid) => {
    const snap = await db.doc(`sq124/${sid}_cfg_personnel`).get();
    shedPersonnelMap[sid] = snap.exists ? (snap.data().v || []) : [];
  }));

  const byShed = {};
  const unresolved = [];
  for (const name of names) {
    const sid = resolveNameToShed(name, shedPersonnelMap);
    if (!sid) { unresolved.push(name); continue; }
    (byShed[sid] = byShed[sid] || []).push(name);
  }
  if (unresolved.length) {
    console.warn(`שינוי לוח צוות: ${unresolved.length} שמות לא זוהו באף מסגרת (לא נשלחה התראה למפקד): ${unresolved.join(", ")}`);
  }

  let sentTotal = 0;
  for (const sid of shedIds) {
    const tokRef = db.doc("sq124/push_tokens_" + sid);
    const tokSnap = await tokRef.get();
    const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
    const teamNames = byShed[sid] || [];

    const messages = [];
    const msgTokens = [];
    for (const [token, meta] of Object.entries(tokMap)) {
      const lines = [];
      const personal = meta && meta.name ? affected[meta.name] : null;
      if (personal) lines.push("השיבוץ שלך — " + personal);
      // המפקד מקבל סיכום על אנשי הצוות שלו; אם הוא עצמו שובץ/ירד, שתי השורות
      if (meta && meta.role === "מפקד" && teamNames.length) lines.push(commanderChangeBody(teamNames));
      if (!lines.length) continue;
      msgTokens.push(token);
      messages.push({token, data: {title, body: lines.join("\n"), kind, n: String(teamNames.length || 1)}});
    }
    if (!messages.length) continue;

    const resp = await getMessaging().sendEach(messages);
    sentTotal += resp.successCount;

    const bad = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token" ||
            code === "messaging/invalid-argument") {
          bad.push(msgTokens[i]);
        }
      }
    });
    if (bad.length) {
      bad.forEach((t) => delete tokMap[t]);
      await tokRef.set({v: tokMap, updated: Date.now()}, {merge: true});
    }
  }
  console.log(`push ${kind}: ${names.length} שמות הושפעו, ${sentTotal} התראות אישיות נשלחו`);
}

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

  // תוויות השורות המותאמות-אישית (id→תווית) הן מסמך גלובלי אחד; נקרא רק
  // כשהכתיבה היא ללוח הצוות עצמו, כדי לא להוסיף קריאה לכל כתיבה אחרת.
  let customRowLabels;
  const docKind = classify(docId);
  if (docKind === "roster_current" || docKind === "roster_next") {
    const crSnap = await db.doc("sq124/roster_custom_rows").get();
    const rows = crSnap.exists ? (crSnap.data().v || []) : [];
    customRowLabels = {};
    for (const r of rows) if (r && r.id) customRowLabels[r.id] = r.label || "";
  }

  const decision = decide({docId, before, after, customRowLabels});
  if (!decision) return;
  const {kind, shedId, title, body, count, commandersOnly} = decision;

  // שינוי בשיבוץ בלוח קיים — לא שידור: רק החיילים שהושפעו והמפקדים שלהם
  if (shedId === PER_PERSON_SHED) { await sendRosterChangeNotifications(decision); return; }

  // "לוח חדש" (roster_publish = פרסום שבוע הבא, roster_week = לוח של שבוע
  // אחר שנכנס לתוקף) הוא גלובלי ולא שייך למסגרת בודדת — decide() מסמן זאת
  // עם BROADCAST_SHED, ואז שולחים בלולאה על כל המסגרות במקום פנייה יחידה
  // ל-push_tokens_<shedId>. *שינוי* בלוח קיים כבר לא מגיע לכאן (ר' למעלה).
  const shedIds = shedId === BROADCAST_SHED ? Object.keys(SHED_NAMES) : [shedId];

  for (const sid of shedIds) {
    // הטוקנים של המסגרת הזו — מסדר בוקר נשלח רק למפקדים, שאר הסוגים לכולם
    const tokRef = db.doc("sq124/push_tokens_" + sid);
    const tokSnap = await tokRef.get();
    const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
    const tokens = commandersOnly
      ? Object.entries(tokMap).filter(([, m]) => m && m.role === "מפקד").map(([t]) => t)
      : Object.keys(tokMap);
    if (!tokens.length) continue;

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
    console.log(`push ${kind}→${sid}: ${resp.successCount}/${tokens.length} נשלחו, ${bad.length} טוקנים נוקו`);
  }
});

/* ===== auditSensitiveWrites — יומן ביקורת שרת-צד, לא ניתן לזיוף/מחיקה =====
   טריגר נפרד מ-notifyOnPublish (אותו מסמך sq124/{docId}, שני triggers
   עצמאיים — לגיטימי ב-Firestore). מסנן כמעט מיד (isSensitiveDocId) כל
   כתיבה שלא נוגעת בכוח-אדם/הרשאות/יומן מנהל-העל, כדי לא להוסיף עומס
   לכל כתיבה רגילה בלוח/משימות/וכו'. הלוגיקה הטהורה של הדיף עצמו יושבת
   ב-lib/audit_log.js (נבדקת בלי emulator, ר' audit_log_lib_test.mjs).

   כותב לאוסף `audit_log` הנפרד (לא sq124!) — לפי firestore.rules הלקוח
   יכול רק לקרוא ממנו (ומנהל-על בלבד), לא לכתוב אליו בשום צורה. זו הערובה
   ל"לא ניתן לזיוף/מחיקה מהלקוח" — בשונה מ-owner_log/admin_audit_log
   הקיימים (מסמכי sq124 רגילים שהלקוח כותב אליהם ישירות).

   שדה `_by` (שם+תפקיד המבצע) מוטמע ע"י הלקוח בגוף המסמך עצמו (sSetRaw,
   רק למסמכים רגישים) — כמו כל שאר זהות המשתמש באפליקציה הזו (אין
   התחברות אישית, ר' CLAUDE.md), זו זהות מדווחת-עצמית ולא מאומתת
   server-side; מה שהופך ליומן בלתי-ניתן-למחיקה/עריכה הוא *מנגנון הכתיבה*
   (רק Admin SDK), לא זהות הכותב. */
exports.auditSensitiveWrites = onDocumentWritten(
  {
    document: "sq124/{docId}",
    region: "me-west1",
    maxInstances: 10,
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (event) => {
    const docId = event.params.docId;
    if (!isSensitiveDocId(docId)) return;
    const beforeDoc = event.data.before.exists ? event.data.before.data() : null;
    const afterDoc = event.data.after.exists ? event.data.after.data() : null;
    const before = beforeDoc ? beforeDoc.v : undefined;
    const after = afterDoc ? afterDoc.v : undefined;
    const clientBy = afterDoc && afterDoc._by ? afterDoc._by : null;

    let verifiedName = (clientBy && clientBy.name) || null;
    let verifiedRole = (clientBy && clientBy.role) || null;
    let verifiedUid = (clientBy && clientBy.uid) || null;
    let identitySource = "client";

    if (verifiedUid) {
      try {
        const userRecord = await getAuth().getUser(verifiedUid);
        const claims = userRecord.customClaims || {};
        if (claims.authorized && claims.role) {
          verifiedRole = claims.role;
          identitySource = "verified";
        }
      } catch (_) { /* uid invalid or deleted — keep client-reported values */ }
    }

    const entries = buildAuditEntries(docId, before, after);
    if (!entries.length) return;

    const ts = Date.now();
    const batch = db.batch();
    for (const entry of entries) {
      const ref = db.collection("audit_log").doc();
      batch.set(ref, {
        ts,
        docId,
        action: entry.action,
        target: entry.target,
        detail: entry.detail || "",
        by: entry.by || verifiedName,
        byRole: verifiedRole,
        byUid: verifiedUid,
        identitySource,
      });
    }
    await batch.commit();
    console.log(`audit: ${docId} → ${entries.length} רשומות (${identitySource})`);
  },
);

/* ===== תזכורת אוטומטית — מילואים שלא רועננו זמן רב =====
   החלטת מוצר (2026-08-23): רענון מילואים הוא תחום האחריות של **אחראי
   הדרכה** — ולכן ההתראה נשלחת רק אליו (push_tokens_training, תפקיד
   מפקד), ולא למפקד כל מסגרת בנפרד כמו קודם. מכיוון שהוא אחראי על כל
   הטייסת, נשלח פוש מרוכז אחד עם הפילוח לפי מסגרת — לא הודעה לכל מסגרת
   (אותו עיקרון כמו סקירת מ״ע אחזקה למטה: סיכום אחד, בלי הצפה). */
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

    const tokRef = db.doc("sq124/push_tokens_training");
    const tokSnap = await tokRef.get();
    const tokMap = tokSnap.exists ? (tokSnap.data().v || {}) : {};
    const cmdTokens = Object.entries(tokMap)
      .filter(([, m]) => m && m.role === "מפקד")
      .map(([t]) => t);
    // בלי נמען אין שליחה — וגם אין כתיבה ליומן ה-cooldown, אחרת התזכורת
    // הייתה "נצרכת" בשקט ואף אחד לא היה מקבל אותה גם מחר.
    if (!cmdTokens.length) { console.log("תזכורות מילואים: אין טוקן של אחראי הדרכה — מדלג"); return; }

    const total = toSend.reduce((n, g) => n + g.items.length, 0);
    const parts = toSend.map((g) => `${SHED_NAMES[g.shedId] || g.shedId}: ${g.items.length}`);
    await getMessaging().sendEachForMulticast({
      tokens: cmdTokens,
      data: {
        title: "🎖️ רענון מילואים",
        body: `${total} אנשי מילואים לא רועננו זמן רב — ${parts.join(" · ")}`,
        kind: "reserve_reminder",
        n: String(total),
      },
    });
    await db.doc("sq124/_reserve_reminder_log").set({v: updatedLog, updated: Date.now()}, {merge: true});
    console.log(`תזכורות מילואים: ${total} אנשים ב-${toSend.length} מסגרות — נשלח לאחראי הדרכה`);
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
    if (!checkRateLimit(request.auth.uid)) {
      throw new HttpsError("resource-exhausted", "יותר מדי בקשות — נסה שוב בעוד דקה");
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

/* ===== גיבוי יומי =====
   מייצא את כל אוסף sq124 לקובץ JSON ב-Cloud Storage (הדלי הדיפולטי של
   הפרויקט), כל לילה בשעה 03:00. לא נוגע באפליקציה שהמשתמשים רואים —
   הגנה מפני מחיקה בטעות/תקלה שתאבד נתונים בלי שום עותק. */
exports.dailyBackup = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Asia/Jerusalem",
    region: "me-west1",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const {docs, count} = await dumpCollection(db);
    const verification = verifyBackupIntegrity(docs);
    if (!verification.ok) {
      console.error(`גיבוי יומי: אימות נכשל — ${verification.error}, חסרים: ${(verification.missingCritical||[]).join(", ")}`);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const checksum = computeBackupChecksum(docs);
    const path = `backups/sq124-${stamp}.json`;
    const metaPath = `backups/sq124-${stamp}.meta.json`;
    const bucket = getStorage().bucket();
    await bucket.file(path).save(JSON.stringify(docs), {contentType: "application/json"});
    await bucket.file(metaPath).save(JSON.stringify({
      date: stamp, docCount: count, checksum, verified: verification.ok,
      missingCritical: verification.missingCritical,
    }), {contentType: "application/json"});
    console.log(`גיבוי יומי: ${count} מסמכים -> ${path} (checksum: ${checksum.slice(0,12)}…, verified: ${verification.ok})`);
  },
);

/* ===== ניטור חריגות כניסה =====
   רץ כל 15 דקות, סורק כשלונות אימות שנצברו ב-auth_events
   ושולח התראה למנהל-העל אם נמצא דפוס ניסיון פריצה. */
exports.monitorLoginAnomalies = onSchedule(
  {
    schedule: `every ${WINDOW_MINUTES} minutes`,
    timeZone: "Asia/Jerusalem",
    region: "me-west1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async () => {
    const cutoff = Date.now() - WINDOW_MINUTES * 60 * 1000;
    const snap = await db.collection("auth_events")
      .where("ts", ">=", cutoff)
      .where("ok", "==", false)
      .get();
    if (snap.empty) return;

    const events = [];
    snap.forEach((d) => events.push(d.data()));
    const alerts = detectAnomalies(events);
    if (!alerts.length) return;

    const message = buildAlertMessage(alerts);
    console.warn("LOGIN_ANOMALY:", message);

    await db.collection("security_dashboard").doc("latest_scan").set({
      ts: Date.now(),
      failedAttempts: events.length,
      alertCount: alerts.length,
      alerts: alerts.map(a => ({type: a.type, ip: a.ip || null, attempts: a.attempts})),
      window: WINDOW_MINUTES,
    });

    const adminSnap = await db.collection("sq124").doc("push_tokens_admin").get();
    if (!adminSnap.exists) return;
    const adminData = adminSnap.data();
    const tokens = adminData && adminData.v ? Object.keys(adminData.v) : [];
    if (!tokens.length) return;

    const payload = {
      notification: {title: "⚠️ התראת אבטחה", body: `${alerts.length} דפוסים חשודים זוהו`},
      data: {kind: "security_alert", detail: message},
    };
    await getMessaging().sendEachForMulticast({tokens, ...payload});
    console.log(`login anomaly alert → ${tokens.length} מכשירים`);
  },
);
