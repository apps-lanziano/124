# הדוח היומי של אפליקציית טייסת 124

**יום ראשון, 23 באוגוסט 2026**

## ⚠️ נמצאו 2 תקלות

**1. בדיקה נכשלה: firestore_rules_test.mjs**
[36m[1mi  emulators:[22m[39m Shutting down emulators.

[1m[31mError:[39m[22m firebase-tools no longer supports Java version before 21. Please install a JDK at version 21 or above to get a compatible runtime.


**2. בדיקה נכשלה: red_team_firestore_rules_test.mjs**
[36m[1mi  emulators:[22m[39m Shutting down emulators.

[1m[31mError:[39m[22m firebase-tools no longer supports Java version before 21. Please install a JDK at version 21 or above to get a compatible runtime.


### מה נבדק היום

- נכנסתי לאפליקציה בתור **כל 19 סוגי המשתמשים** שיש בה (מפקדים, חיילים, אחראי הדרכה, מ״ע אחזקה, מנהל-על ועוד)
- פתחתי **107 מסכים** ובדקתי שכולם נטענים ומציגים נתונים
- הרצתי **126 בדיקות** שמוודאות שתקלות שכבר תוקנו לא חזרו
- ניסיתי לפרוץ לאפליקציה בשיטות מוכרות, כדי לוודא שאי אפשר

---

## בדיקת כל המשתמשים וכל המסכים

> ✅ הכל תקין

_אין מה לדווח._

## בדיקה שתקלות ישנות לא חזרו

> 2 נקודות לתשומת לב

**🔴 חמור · בדיקה נכשלה: firestore_rules_test.mjs**
[36m[1mi  emulators:[22m[39m Shutting down emulators.

[1m[31mError:[39m[22m firebase-tools no longer supports Java version before 21. Please install a JDK at version 21 or above to get a compatible runtime.


**🔴 חמור · בדיקה נכשלה: red_team_firestore_rules_test.mjs**
[36m[1mi  emulators:[22m[39m Shutting down emulators.

[1m[31mError:[39m[22m firebase-tools no longer supports Java version before 21. Please install a JDK at version 21 or above to get a compatible runtime.


---

## אבטחה

> ✅ הכל תקין

**🔵 מידע · מפתח Firebase/Google API נמצא בקוד**
1 מופעים (שורה 3944). מפתח Web של Firebase הוא ציבורי מעצם טיבו — ההגנה בפועל היא כללי מסד הנתונים + App Check. לא נדרשת פעולה, בתנאי ששני אלה מופעלים.

**🔵 מידע · הפרדה בין מסגרות אינה אכופה בשרת — החלטה מתועדת, לא פרצה**
תגית authorized חוסמת אימות אנונימי (ראה SECURITY.md שלב 7), אבל כל כניסה אמיתית עם קוד עדיין יכולה לקרוא נתונים של מסגרות אחרות — זו החלטת מוצר מכוונת שתועדה ב-SECURITY.md שלב 4 ("הוחלט לא לבצע הפרדת מסגרות בשרת — החשש אינו מפני אנשי הטייסת עצמם"). אם יידרש בעתיד להדק, הפתרון כבר כתוב כתיעוד היסטורי בקובץ הכללים (גרסה 2).

**🔵 מידע · קודי הכניסה אינם בקוד הלקוח**
האימות מתבצע מול Firebase Auth — נכון ובטוח.

**🔵 מידע · בדיקת הזרקת קוד עוין עברה**
מטענים עוינים הוזרקו ל-11 סוגי שדות שמשתמשים מקלידים, ונסרקו 6 מסכים — שום מטען לא הופעל. הסינון (escapeHTML) עובד בנתיבים שנבדקו.

---

## הצעות לשיפור

> 4 נקודות לתשומת לב

**🟠 בינוני · גודל האפליקציה**
1182 KB, 16,994 שורות בקובץ יחיד. מעל 900KB — כל טעינה ראשונה מורידה את הכל. שווה לשקול פיצול ה-CSS/JS לקבצים נפרדים שנשמרים במטמון בנפרד.

**🟡 קל · פונקציות שלא נקראות מאף מקום**
1 פונקציות: hebDayOffset. מועמדות למחיקה — פחות קוד, פחות מקום לטעות.

**🟡 קל · שדות קלט ללא תיאור**
1 שדות בלי aria-label/placeholder/id.

**🟡 קל · פונקציות ארוכות מאוד**
4 פונקציות מעל 120 שורות. הארוכות: renderRosterEditor (148 שורות, שורה 9072), applyLoginUiForRole (146 שורות, שורה 4875), renderRosterView (125 שורות, שורה 7304). פיצול יקל על תחזוקה ויקטין סיכון לבאגים.

**🔵 מידע · ההגנה על רשימת הצוות במקומה**
אין כתיבות עיוורות של PERSONNEL — כל השמירות עוברות דרך mutatePersonnel().

**🔵 מידע · ההגנה על יושרת השמירה במקומה**
אין catch שמחזיר true — כשלי שמירה מדווחים כפי שהם.

**🔵 מידע · דגלי מיגרציה/זריעה חד-פעמיים מוגנים מפני כשל קריאה חולף**
כל הפונקציות שבודקות דגל "כבר בוצע" מתייחסות ל-fbReadFailed לפני שהן מחליטות לרוץ מחדש.

---

## מה מומלץ לעשות

1. **בדיקה נכשלה: firestore_rules_test.mjs** — [36m[1mi  emulators:[22m[39m Shutting down emulators.
2. **בדיקה נכשלה: red_team_firestore_rules_test.mjs** — [36m[1mi  emulators:[22m[39m Shutting down emulators.
3. **גודל האפליקציה** — 1182 KB, 16,994 שורות בקובץ יחיד.

_יש עוד 3 הערות קטנות שלא דחופות._

---

### מה הבדיקה הזו לא מכסה

הבדיקה רצה על הקוד של האפליקציה — לא על השרת החי. כלומר היא **לא רואה** אם מישהו מנסה לפרוץ ברגע זה, ולא רואה את הנתונים האמיתיים של הטייסת. כדי לקבל התראה על ניסיון חדירה בזמן אמת צריך להפעיל את ההתראות של Firebase עצמו — כתוב איך ב-`qa/README.md`.
