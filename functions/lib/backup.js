/* ============================================================
   גיבוי שבועי — ייצוא כל אוסף sq124 כאובייקט JSON פשוט
   ------------------------------------------------------------
   לוגיקה טהורה: לא נוגעת ב-Storage בכלל — functions/index.js הוא זה
   שכותב את התוצאה לקובץ. כך אפשר לבדוק עם db מדומה בלי תלות חיצונית.

   db.collection(name).get() צריך להחזיר snapshot עם forEach(doc=>...)
   ו-size — בדיוק כמו ה-Admin SDK האמיתי.
   ============================================================ */
const crypto = require("crypto");

async function dumpCollection(db, collectionName = "sq124") {
  const snap = await db.collection(collectionName).get();
  const docs = {};
  snap.forEach((doc) => { docs[doc.id] = doc.data(); });
  return { docs, count: snap.size };
}

function computeBackupChecksum(docs) {
  const sorted = JSON.stringify(docs, Object.keys(docs).sort());
  return crypto.createHash("sha256").update(sorted).digest("hex");
}

function verifyBackupIntegrity(backupJson) {
  if (!backupJson || typeof backupJson !== "object") return { ok: false, error: "invalid_format" };
  const keys = Object.keys(backupJson);
  if (!keys.length) return { ok: false, error: "empty_backup" };
  const critical = ["board_roster", "shed1_cfg_personnel", "shed2_cfg_personnel"];
  const missing = critical.filter(k => !backupJson[k]);
  return {
    ok: missing.length === 0,
    docCount: keys.length,
    checksum: computeBackupChecksum(backupJson),
    missingCritical: missing,
    error: missing.length ? "missing_critical_docs" : null,
  };
}

module.exports = { dumpCollection, computeBackupChecksum, verifyBackupIntegrity };
