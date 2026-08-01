/* ============================================================
   גיבוי שבועי — ייצוא כל אוסף sq124 כאובייקט JSON פשוט
   ------------------------------------------------------------
   לוגיקה טהורה: לא נוגעת ב-Storage בכלל — functions/index.js הוא זה
   שכותב את התוצאה לקובץ. כך אפשר לבדוק עם db מדומה בלי תלות חיצונית.

   db.collection(name).get() צריך להחזיר snapshot עם forEach(doc=>...)
   ו-size — בדיוק כמו ה-Admin SDK האמיתי.
   ============================================================ */
async function dumpCollection(db, collectionName = "sq124") {
  const snap = await db.collection(collectionName).get();
  const docs = {};
  snap.forEach((doc) => { docs[doc.id] = doc.data(); });
  return { docs, count: snap.size };
}

module.exports = { dumpCollection };
