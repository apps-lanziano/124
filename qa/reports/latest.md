# הדוח היומי של אפליקציית טייסת 124

**יום שבת, 5 בספטמבר 2026**

## ⚠️ נמצאו 7 תקלות

**1. בדיקה נכשלה: cmd_dashboard_restructure_test.mjs**
❌ scr-safety: סיכום החתימות (KPI + טבלת אנשי צוות) גלוי למפקד - {"summaryVisible":false,"kpiEvents":"—","kpiFullsign":"—","cmdReadsHasContent":false} | ❌ scr-morning: באנר 'טרם בוצעו' מוצג כשאין מטלות שהושלמו - {"hasNoneBanner":false}

**2. בדיקה נכשלה: firestore_rules_test.mjs**
❌ firebase-tools לא מותקן (node_modules/.bin/firebase חסר). הרץ: npm install

**3. בדיקה נכשלה: pwa_shortcuts_test.mjs**
❌ קיצור rollcall: הכניסה נוחתת ישר על scr-rollcall (לא על מסך ברירת המחדל) - {"activeScreen":"scr-safety","searchAfter":"","loggedIn":false} | ❌ קיצור faults: הכניסה נוחתת ישר על scr-faults - {"activeScreen":"scr-safety","searchAfter":"","loggedIn":false} | ❌ בלי קיצור: חייל נוחת על scr-today ("היום שלי") כמסך הפתיחה - {"activeScreen":"scr-safety","searchAfter":"","loggedIn":false}

**4. בדיקה נכשלה: quick_login_fix_test.mjs**
❌ כניסה מהירה מסתיימת בהצלחה בפועל (לא נופלת חזרה למסך קוד) - {"calls":[{"email":"u7788@sq124.app","password":"sq124:7788"}],"loggedIn":false,"currentUser":null}

**5. בדיקה נכשלה: red_team_firestore_rules_test.mjs**
❌ firebase-tools not installed. Run: npm install

**6. בדיקה נכשלה: safety_reminder_visible_test.mjs**
page.evaluate: TypeError: Cannot read properties of undefined (reading 'querySelectorAll')

**7. בדיקה נכשלה: training_hide_board_duties_medchecks_test.mjs**
❌ מ״ע הדרכה: תורנויות גלויות (7.2), כשירות חיילים מוסתר - {"boardHidden":false,"dutiesHidden":false,"medchecksHidden":false} | ❌ מ״ע הדרכה שוב (אחרי מ״ע אחזקה): תורנויות גלויות, כשירות חיילים מוסתר - {"boardHidden":false,"dutiesHidden":false,"medchecksHidden":false}

### מה נבדק היום

- נכנסתי לאפליקציה בתור **כל 19 סוגי המשתמשים** שיש בה (מפקדים, חיילים, אחראי הדרכה, מ״ע אחזקה, מנהל-על ועוד)
- פתחתי **102 מסכים** ובדקתי שכולם נטענים ומציגים נתונים
- הרצתי **150 בדיקות** שמוודאות שתקלות שכבר תוקנו לא חזרו
- ניסיתי לפרוץ לאפליקציה בשיטות מוכרות, כדי לוודא שאי אפשר

---

## בדיקת כל המשתמשים וכל המסכים

> ✅ הכל תקין

_אין מה לדווח._

## בדיקה שתקלות ישנות לא חזרו

> 7 נקודות לתשומת לב

**🔴 חמור · בדיקה נכשלה: cmd_dashboard_restructure_test.mjs**
❌ scr-safety: סיכום החתימות (KPI + טבלת אנשי צוות) גלוי למפקד - {"summaryVisible":false,"kpiEvents":"—","kpiFullsign":"—","cmdReadsHasContent":false} | ❌ scr-morning: באנר 'טרם בוצעו' מוצג כשאין מטלות שהושלמו - {"hasNoneBanner":false}

**🔴 חמור · בדיקה נכשלה: firestore_rules_test.mjs**
❌ firebase-tools לא מותקן (node_modules/.bin/firebase חסר). הרץ: npm install

**🔴 חמור · בדיקה נכשלה: pwa_shortcuts_test.mjs**
❌ קיצור rollcall: הכניסה נוחתת ישר על scr-rollcall (לא על מסך ברירת המחדל) - {"activeScreen":"scr-safety","searchAfter":"","loggedIn":false} | ❌ קיצור faults: הכניסה נוחתת ישר על scr-faults - {"activeScreen":"scr-safety","searchAfter":"","loggedIn":false} | ❌ בלי קיצור: חייל נוחת על scr-today ("היום שלי") כמסך הפתיחה - {"activeScreen":"scr-safety","searchAfter":"","loggedIn":false}

**🔴 חמור · בדיקה נכשלה: quick_login_fix_test.mjs**
❌ כניסה מהירה מסתיימת בהצלחה בפועל (לא נופלת חזרה למסך קוד) - {"calls":[{"email":"u7788@sq124.app","password":"sq124:7788"}],"loggedIn":false,"currentUser":null}

**🔴 חמור · בדיקה נכשלה: red_team_firestore_rules_test.mjs**
❌ firebase-tools not installed. Run: npm install

**🔴 חמור · בדיקה נכשלה: safety_reminder_visible_test.mjs**
page.evaluate: TypeError: Cannot read properties of undefined (reading 'querySelectorAll')

**🔴 חמור · בדיקה נכשלה: training_hide_board_duties_medchecks_test.mjs**
❌ מ״ע הדרכה: תורנויות גלויות (7.2), כשירות חיילים מוסתר - {"boardHidden":false,"dutiesHidden":false,"medchecksHidden":false} | ❌ מ״ע הדרכה שוב (אחרי מ״ע אחזקה): תורנויות גלויות, כשירות חיילים מוסתר - {"boardHidden":false,"dutiesHidden":false,"medchecksHidden":false}

---

## אבטחה

> 1 נקודה לתשומת לב

**🟠 בינוני · שימוש בפקודה insertAdjacentHTML()**
1 מופעים (שורות 16921). זו פקודה שמריצה טקסט כאילו היה קוד. יש לוודא שהטקסט שמגיע אליה לא בא ממשתמש.

**🔵 מידע · מפתח Firebase/Google API נמצא בקוד**
1 מופעים (שורה 4184). מפתח Web של Firebase הוא ציבורי מעצם טיבו — ההגנה בפועל היא כללי מסד הנתונים + App Check. לא נדרשת פעולה, בתנאי ששני אלה מופעלים.

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
1324 KB, 19,038 שורות בקובץ יחיד. מעל 900KB — כל טעינה ראשונה מורידה את הכל. שווה לשקול פיצול ה-CSS/JS לקבצים נפרדים שנשמרים במטמון בנפרד.

**🟡 קל · פונקציות שלא נקראות מאף מקום**
5 פונקציות: hashPinLegacy, pinUpgradeNeeded, triggerBoardUpload, openBoardViewer, deleteBoard. מועמדות למחיקה — פחות קוד, פחות מקום לטעות.

**🟡 קל · שדות קלט ללא תיאור**
3 שדות בלי aria-label/placeholder/id.

**🟡 קל · פונקציות ארוכות מאוד**
6 פונקציות מעל 120 שורות. הארוכות: removeCertById (219 שורות, שורה 16541), applyLoginUiForRole (175 שורות, שורה 5282), renderRosterEditor (148 שורות, שורה 9998). פיצול יקל על תחזוקה ויקטין סיכון לבאגים.

**🔵 מידע · ההגנה על רשימת הצוות במקומה**
אין כתיבות עיוורות של PERSONNEL — כל השמירות עוברות דרך mutatePersonnel().

**🔵 מידע · ההגנה על יושרת השמירה במקומה**
אין catch שמחזיר true — כשלי שמירה מדווחים כפי שהם.

**🔵 מידע · דגלי מיגרציה/זריעה חד-פעמיים מוגנים מפני כשל קריאה חולף**
כל הפונקציות שבודקות דגל "כבר בוצע" מתייחסות ל-fbReadFailed לפני שהן מחליטות לרוץ מחדש.

---

## UX ומוצר — הזדמנויות שיפור

> 3 נקודות לתשומת לב

**🟠 בינוני · פעולת מחיקה בלי בקשת אישור מהמשתמש**
8 פונקציות ששמן מרמז על מחיקה, בלי confirm() בגוף שלהן: removeDeviceUser (שורה 4863), removeBdpBoardGroup (שורה 7346), removeBasicDutyPlanEntry (שורה 10373), removePersonCerts (שורה 12727), removeDeptReassignedPeople (שורה 13869), removeAdminCert (שורה 14539), removeCertBank (שורה 14611), removeCertById (שורה 16541). לחיצה אחת מוחקת נתונים בלי אפשרות להתחרט — כדאי לבדוק אם יש אישור בשכבה אחרת (למשל מודל ייעודי), ואם לא — להוסיף confirm() כמו בשאר פעולות המחיקה באפליקציה.

**🟡 קל · פעולת שמירה/פרסום בלי הודעת משוב (toast) למשתמש**
11 פונקציות: saveDeviceUsers (שורה 4850), saveManualEvents (שורה 6609), saveRosterCustomRows (שורה 7471), saveRosterArchive (שורה 8342), saveDutyRequests (שורה 8960), saveBasicDutyPlan (שורה 10273), savePushToken (שורה 11734), publishEventToAllSheds (שורה 14218), publishBoardToAllSheds (שורה 14323), publishTrainingToAllSheds (שורה 14670)…. ייתכן שהמשוב ניתן בדרך אחרת (רענון מסך, סגירת מודל) — כדאי לוודא שהמשתמש בכל זאת יודע אם השמירה הצליחה או נכשלה.

**🟡 קל · כפתורי אייקון בלי תיאור נגיש (title/aria-label)**
9 כפתורים (8 סוגי סמל) בלי title/aria-label, למשל "›", "‹", "→", "←", "🗑️", "−". הוספת title="..." קצר עוזרת גם למשתמש חדש שמנחש מה הכפתור עושה, וגם לנגישות.

---

## מה מומלץ לעשות

1. **בדיקה נכשלה: cmd_dashboard_restructure_test.mjs** — ❌ scr-safety: סיכום החתימות (KPI + טבלת אנשי צוות) גלוי למפקד - {"summaryVisible":false,"kpiEvents":"—","kpiFullsign":"—","cmdReadsHasContent":false} | ❌ scr-morning: באנר 'טרם בוצעו' מוצג כשאין מטלות שהושלמו - {"hasNoneBanner":false}.
2. **בדיקה נכשלה: firestore_rules_test.mjs** — ❌ firebase-tools לא מותקן (node_modules/.
3. **בדיקה נכשלה: pwa_shortcuts_test.mjs** — ❌ קיצור rollcall: הכניסה נוחתת ישר על scr-rollcall (לא על מסך ברירת המחדל) - {"activeScreen":"scr-safety","searchAfter":"","loggedIn":false} | ❌ קיצור faults: הכניסה נוחתת ישר על scr-faults - {"activeScreen":"scr-safety","searchAfter":"","loggedIn":false} | ❌ בלי קיצור: חייל נוחת על scr-today ("היום שלי") כמסך הפתיחה - {"activeScreen":"scr-safety","searchAfter":"","loggedIn":false}.
4. **בדיקה נכשלה: quick_login_fix_test.mjs** — ❌ כניסה מהירה מסתיימת בהצלחה בפועל (לא נופלת חזרה למסך קוד) - {"calls":[{"email":"u7788@sq124.
5. **בדיקה נכשלה: red_team_firestore_rules_test.mjs** — ❌ firebase-tools not installed.
6. **בדיקה נכשלה: safety_reminder_visible_test.mjs** — page.

_יש עוד 5 הערות קטנות שלא דחופות._

---

### מה הבדיקה הזו לא מכסה

הבדיקה רצה על הקוד של האפליקציה — לא על השרת החי. כלומר היא **לא רואה** אם מישהו מנסה לפרוץ ברגע זה, ולא רואה את הנתונים האמיתיים של הטייסת. כדי לקבל התראה על ניסיון חדירה בזמן אמת צריך להפעיל את ההתראות של Firebase עצמו — כתוב איך ב-`qa/README.md`.
