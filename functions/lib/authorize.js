/* ============================================================
   markAuthorized — לוגיקת ההחלטה הטהורה (בדיוק כמו notify.js) כדי
   שאפשר לבדוק בלי emulator/Admin SDK אמיתי.
   ------------------------------------------------------------
   הבעיה: אימות אנונימי (מופעל אוטומטית בטעינת כל דף, לפני הקלדת קוד)
   עומד בדיוק באותה בדיקת isAuthed() כמו כניסה אמיתית עם קוד — ולכן
   מי שפותח את האתר האמיתי (בלי להקליד שום קוד) יכול לקרוא את כל
   המסד ב-F12. הפתרון: תגית authorized שנצמדת רק לכניסה אמיתית
   (email/password, כלומר קוד תקף שעבר את signInAs), לא לאימות אנונימי.
   ============================================================ */

/* true אם ורק אם ההתחברות היא כניסה אמיתית עם קוד (email/password) —
   לא אימות אנונימי. זו הבדיקה היחידה שקובעת אם מותר להצמיד את התגית. */
function shouldAuthorize(authContext) {
  return !!(authContext && authContext.token && authContext.token.firebase &&
    authContext.token.firebase.sign_in_provider === "password");
}

module.exports = { shouldAuthorize };
