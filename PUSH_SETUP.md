# התראות Push — מדריך הפעלה (טייסת 124)

התראות שמגיעות למכשיר **גם כשהאפליקציה סגורה** (כמו וואטסאפ), + עדכון ה-badge
על סמל האפליקציה. כל הקוד כבר במאגר; צריך רק להפעיל שלושה דברים חד-פעמיים.

> **חשוב:** באייפון זה עובד רק על אפליקציה **מותקנת** (הוסף למסך הבית) + אישור
> התראות. כל עוד לא סיימת את המדריך — האפליקציה עובדת רגיל, וה-badge מתעדכן
> בפתיחה (FCM כבוי כי `FCM_VAPID_KEY` ריק).

---

## שלב 1 — הפעלת Blaze (חד-פעמי)

Cloud Functions דורשות את תוכנית Blaze. **בפועל העלות ≈ 0 ₪** בקנה-המידה שלכם
(מכסה חינמית: ~2M הפעלות פונקציה + FCM חינם ללא הגבלה). צריך כרטיס אשראי מוגדר.

1. Firebase Console → גלגל שיניים → **Usage and billing** → **Details & settings**
   → **Modify plan** → בחר **Blaze**.
2. **מומלץ מיד:** הגדר **Budget alert** על **$1** (Google Cloud Console →
   Billing → Budgets & alerts) — תקבל מייל אם אי-פעם מתקרבים לחיוב.

---

## שלב 2 — מפתח Web-Push (VAPID)

1. Firebase Console → **Project settings** → **Cloud Messaging**.
2. תחת **Web configuration** → **Web Push certificates** → **Generate key pair**.
3. העתק את המחרוזת הארוכה (Key pair).
4. ב-`index.html` מצא את השורה:
   ```js
   const FCM_VAPID_KEY = "";
   ```
   הדבק את המפתח בין המרכאות, שמור, ו-commit/push (מתפרס אוטומטית ל-GitHub Pages).

---

## שלב 3 — פריסת ה-Cloud Function (ממחשב)

צריך מחשב עם **Node.js 18+**. פעם אחת:

```bash
npm install -g firebase-tools          # התקנת הכלי
firebase login                         # התחברות לחשבון ה-Firebase שלך

# בתיקיית המאגר (שבה firebase.json):
cd functions && npm install && cd ..   # התקנת תלויות הפונקציה
firebase deploy --only functions       # פריסה!
```

בסיום תראה `notifyOnPublish` נפרסה. מאותו רגע היא רצה לבד לתמיד — כשמתפרסמת
הודעה או קרא-וחתום, כל המכשירים הרשומים באותה מסגרת מקבלים התראה.

> אם `firebase deploy` מבקש להפעיל APIs (Cloud Functions, Cloud Build,
> Artifact Registry / Eventarc) — אשר. זה חלק מהתשתית של Blaze, עדיין במכסה החינמית.

---

## שלב 4 — בדיקה

1. באייפון: פתח את האתר ב-Safari → שיתוף → **הוסף למסך הבית**.
2. פתח מהסמל שבמסך הבית (לא מ-Safari), היכנס, ו**אשר התראות** כשמופיע.
3. ממכשיר אחר (או כמנהל): פרסם הודעה למסגרת.
4. במכשיר הראשון — גם אם האפליקציה סגורה — אמורה להופיע התראה + ספרה על הסמל.

---

## איך זה בנוי (לתחזוקה)

- **לקוח** (`index.html`): `initPush()` רושם `token` של המכשיר תחת
  `sq124/push_tokens_<shedId>` (רק אחרי אישור התראות). `updateAppBadge()` כותב
  את הספירה המדויקת ל-IndexedDB המשותף.
- **Service Worker** (`firebase-messaging-sw.js`): מקבל את ה-push גם כשסגור,
  מציג התראה, ומגדיל את ה-badge מהבסיס שב-IndexedDB.
- **Cloud Function** (`functions/index.js`): מאזינה ל-`sq124/{docId}`; על פריט
  חדש ב-`…_messages_list` / `…_safety_events` שולחת FCM לטוקנים של אותה מסגרת,
  ומנקה טוקנים לא-תקפים.

## נתונים ופרטיות

הטוקנים הם מזהי-מכשיר של FCM (לא סוד אישי). מפתח השליחה נשאר בשרת. אין שינוי
בכללי ה-Firestore — כתיבת טוקן היא כתיבה רגילה של משתמש מאומת.

## לכבות זמנית

החזר את `FCM_VAPID_KEY` ל-`""` ו-push ייכבה (ה-badge-בפתיחה נשאר). כדי לעצור
גם את ה-Function: `firebase functions:delete notifyOnPublish`.
