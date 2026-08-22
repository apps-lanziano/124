# Security Audit — טייסת 124 PWA

תאריך: 2026-08-22
היקף: כל הבקשה המקורית (Authentication & Authorization, Firestore Rules, Cloud Functions,
App Check, AI/Claude API, Secrets, Dependencies, Client-side storage, XSS/Injection, CORS/Headers,
Logging, Threat Model).

## Threat Model (סעיף 20)

**לתוקף יש:** מאגר GitHub פומבי, URL פומבי לאפליקציה, דפדפן + DevTools, יכולת ליצור
session אנונימי ב-Firebase, יכולת לבדוק כל בקשת רשת/JS.
**לתוקף אין:** חשבון מאושר, חשבון admin, גישה ל-Firebase Console, secrets כלשהם.

היעד: תוקף כזה לא יכול לקרוא/לשנות/למחוק/להפעיל שום מידע או פעולה מוגנת — **ללא** קוד
מסגרת תקף שהוקצה בפועל ע״י מ״ע.

---

## טבלת ממצאים

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| F1 | **CRITICAL** | `markAuthorized` העניק `authorized:true` לכל חשבון עם `sign_in_provider==="password"`, גם אם הקוד מעולם לא הוקצה ע״י מ״ע — תוקף חיצוני יכול היה ליצור לעצמו חשבון (`createUserWithEmailAndPassword` פתוח כברירת מחדל) ולקבל גישה מלאה למסד | **תוקן** |
| F2 | HIGH | לא היו בדיקות Firestore Rules אוטומטיות מול emulator אמיתי — רגרסיה עתידית בקובץ הכללים לא הייתה נתפסת | **תוקן** |
| F3 | HIGH | פריסת `firestore.rules` לפרודקשן הייתה שלב **ידני בלבד** — אין ערובה ש-GitHub==Production | **תוקן** |
| F4 | MEDIUM | `analyzeBoardImage` לא הגביל את גודל התמונה הנשלחת ל-Claude — משתמש מאומת יכול היה לנפח עלות לכל קריאה | **תוקן** |
| F5 | LOW | אין logging ייעודי לאירועי אבטחה (ניסיון authorize כושל, מיצוי מכסת AI) | **תוקן (חלקי)** |
| F6 | MEDIUM | `firebase-admin` ב-`functions/` נושא 9 חולשות moderate טרנזיטיביות (uuid) — תיקון דורש קפיצת major שלא נתמכת ע״י `firebase-functions@5.1.1` | **פתוח — מתועד, לא מתוקן בכוונה** |
| F7 | MEDIUM | GitHub Pages לא מאפשר HTTP headers מותאמים (CSP/X-Frame-Options/X-Content-Type-Options) | **פתוח — הוסף מה שניתן (Referrer-Policy), השאר מתועד כהמלצה** |
| F8 | INFO | מפתח Firebase Web API גלוי בקוד הלקוח | **לא פרצה — התנהגות תקנית של Firebase** |
| F9 | INFO | אין הפרדת מסגרות בשרת — כל קוד תקין רואה את כל הטייסת | **לא פרצה — החלטת מוצר מתועדת (SECURITY.md שלב 4)** |
| F10 | INFO | נעילת-כניסה (`sq124_failCount`) היא localStorage בלבד, עוקפת בקלות | **לא פרצה חדשה — מתועד כ-TODO, מוגן בפועל ע״י App Check על Auth** |
| F11 | INFO | `npm audit` בשורש: 0 חולשות בפרודקשן; חולשות moderate רק ב-devDependencies חדשות (firebase-tools, לצורך בדיקות) | **תועד — לא משפיע על האפליקציה החיה** |
| F12 | INFO | בדיקת XSS חיה (11 סוגי שדות, כל המסכים) עברה — אין הזרקת HTML מוכחת | **נבדק, ירוק** |
| F13 | INFO | Cloud Functions: כל ה-`onCall` הרגישות אוכפות App Check + auth; אין endpoint HTTP פתוח עם CORS רחב | **נבדק, תקין** |

---

## פירוט הממצאים

### F1 — CRITICAL: עקיפת authorization מלאה דרך יצירת חשבון עצמאית

**הבעיה:** `functions/index.js` (`markAuthorized`, שורה 65) בדק רק
`shouldAuthorize(request.auth)` — כלומר `sign_in_provider === "password"` — ואז קרא ל-
`authprofile_<hash(code)>` כדי לקבוע `role`, אבל **אם המסמך לא נמצא, הפונקציה המשיכה
בכל זאת** עם `role = "חייל"` וברירת המחדל הזו **עדיין** הובילה ל-`setCustomUserClaims(uid,
{authorized:true, role})`.

**איך תוקף היה מנצל את זה — שלב אחר שלב, בלי שום קוד/PIN אמיתי:**
1. פותח את האתר האמיתי (ציבורי, ללא סיסמה).
2. פותח DevTools Console וקורא ל-SDK של Firebase (שכבר טעון בעמוד) עם ה-config
   הפומבי (`apiKey` וכו׳ — גלוי לכל אחד, כצפוי מ-Firebase):
   `createUserWithEmailAndPassword(fbAuth, "u9999@sq124.app", "sq124:9999")`.
   זו פעולה שכל דפדפן יכול לבצע — Firebase Auth מאפשר self-signup לספק
   Email/Password כברירת מחדל, ו-App Check-על-Auth (SECURITY.md שלב 1ב) רק מוודא
   "זה דפדפן אמיתי באתר האמיתי" — הוא **לא** מבחין בין "המשתמש הקליד קוד תקף
   במסך הכניסה" לבין "המשתמש קרא ל-API של Auth ישירות". תוקף עם דפדפן אמיתי
   עובר את App Check בהצלחה בדיוק כמו משתמש לגיטימי.
3. החשבון החדש (`u9999@sq124.app`, לא קיים מראש) נוצר ומחבר את התוקף אוטומטית.
   `sign_in_provider` הוא `"password"` — כניסת password אמיתית, לא anonymous.
4. תוקף קורא ל-`markAuthorized()`. `shouldAuthorize` מחזיר `true` (זו כן כניסת
   password). קוד `9999` לא הוקצה מעולם ע״י מ״ע → אין מסמך `authprofile_<hash>`.
   **בקוד הישן:** `role` נשאר "חייל" (ברירת מחדל) והפונקציה **עדיין** קוראת
   ל-`setCustomUserClaims(uid, {authorized:true, role:"חייל"})`.
5. התוקף מקבל טוקן עם `authorized:true` → כללי ה-Firestore (`isAuthorized()`)
   מתירים לו כעת לקרוא ולכתוב לכל מסמך לא-רגיש ב-`sq124` — **כל נתוני הטייסת**
   (שמות, תאריכי לידה, שיבוצים, תורנויות, תקלות, רכבים...), בלי לדעת שום קוד אמיתי.

זה בדיוק וקטור התקיפה שהבקשה המקורית ביקשה לחסום ("ודא שאין endpoint שמאפשר
להפוך משתמש ל-authorized ללא אימות מתאים").

**הקובץ:** `functions/index.js`, פונקציית `markAuthorized` (שורות 65–113 אחרי התיקון).

**התיקון:** אימות שדורש **קיום בפועל** של `authprofile_<hash>` — לא רק כניסת
password. אם האימייל לא בפורמט `u<ספרות>@...`, או שאין מסמך `authprofile_` תואם —
**דחייה** (`permission-denied`), לא ברירת מחדל שממשיכה. מסמך `authprofile_` נכתב
**רק** ע״י `provisionAuthAccounts()` (יחד עם החשבון עצמו), כך שכל חשבון לגיטימי
(קיים או עתידי) ממשיך לעבוד בדיוק כמו קודם — רק חשבונות שתוקף יצר לעצמו
עבור קודים שלא הוקצו נחסמים.

```js
const codeMatch = email.match(/^u(\d+)@/);
if (!codeMatch) throw new HttpsError("permission-denied", "חשבון לא מוכר");
const hash = crypto.createHash("sha256").update("sq124code|" + code).digest("hex");
const profSnap = await db.doc("sq124/authprofile_" + hash).get();
const prof = profSnap.exists ? profSnap.data().v : null;
if (!prof || typeof prof.role !== "string" || !prof.role) {
  throw new HttpsError("permission-denied", "קוד לא מוכר במערכת");
}
const role = prof.role;
```

**איך נבדק:**
1. `qa/suite/mark_authorized_wiring_test.mjs` (חדש) — בדיקת מקור סטטית שמוודאת:
   קריאה יחידה ל-`setCustomUserClaims`, שהיא מגיעה **אחרי** guard מפורש שדוחה
   כש-`!prof`, ש-`role` נגזר אך ורק מ-`prof.role` (לא ברירת מחדל), ושפורמט אימייל
   לא-תקין נדחה. **בדיקת רגרסיה שלילית**: כשהחזרתי זמנית את הקוד הפגיע (ברירת
   מחדל "חייל" בלי guard), 3 מתוך הבדיקות נכשלו מיד — מוכיח שהבדיקה תופסת את
   הרגרסיה הזו בפועל, לא רק "נראית טוב".
2. `qa/suite/authorize_lib_test.mjs` (קיים) — עדיין ירוק, `shouldAuthorize` עצמו
   לא השתנה (הבדיקה החדשה משלימה אותו, לא מחליפה).
3. `node qa/run_daily.mjs` המלא (121 קבצי בדיקה, כולל הבדיקה החדשה) — ירוק.

**⚠️ נדרשת פעולה לפרוס לפרודקשן:** `functions/index.js` השתנה — התיקון לא
משפיע על משתמשים חיים עד לפריסה בפועל של ה-Cloud Function (`firebase deploy
--only functions`, או אוטומטית דרך `deploy-functions.yml` בדחיפה ל-`main` — ר' F3).
עד אז, כל מי שכבר פרץ בשיטה הזו (אם בכלל) ישמור על ה-claim הקיים שלו עד
שהטוקן מתחדש/הוא מתנתק — מומלץ לבדוק ב-Firebase Console → Authentication אם יש
חשבונות `u<code>@sq124.app` חשודים (קודים שלא הוקצו ע״י אף מ״ע) ולמחוק אותם ידנית
אחרי הפריסה.

---

### F2 — HIGH: אין בדיקות Firestore Rules אוטומטיות

**הבעיה:** `firestore.rules` לא נבדק ע״י שום automated test — שינוי שמרחיב כלל
בטעות (כמו F1, ברמת ה-rules) לא היה נתפס לפני שהוא מגיע לפרודקשן.

**התיקון:** `qa/suite/firestore_rules_test.mjs` (חדש) — מריץ את `firestore.rules`
**האמיתי** על Firestore Emulator אמיתי (`firebase-tools emulators:exec --only
firestore`, Java 21 + jar שיורד פעם אחת), ובודק את כל המטריצה שהתבקשה:

| הקשר | get | list/query | create | update | delete |
|---|---|---|---|---|---|
| אנונימי-לגמרי (בלי session) | ❌ | ❌ | ❌ | ❌ | ❌ |
| מאומת, בלי `authorized` claim (בדיוק פרצת ה-F12 הישנה) | ❌ | ❌ | ❌ | ❌ | ❌ |
| `authorized:false` מפורש | ❌ | — | — | — | — |
| `role` בלי `authorized` (ניסיון "לזייף" claim) | ❌ | — | ❌ (מסמך רגיש) | — | — |
| `authorized:true`, role חייל, מסמך רגיל | ✅ | ❌ | ✅ | ✅ | — |
| `authorized:true`, role חייל, מסמך רגיש (`admin_/authprofile_/ai_quota_`) | ✅* | — | ❌ | — | ❌ |
| `authorized:true`, role מפקד, מסמך רגיש | ✅ | ❌ | ✅ | ✅ | ✅ |
| כל הקשר, אוסף אחר מ-`sq124` | ❌ | ❌ | ❌ | — | — |

\* קריאת מסמך רגיש ע״י חייל **מותרת בכוונה** — רק כתיבה/מחיקה מוגבלת למפקד
(תועד כבר ב-SECURITY.md שלב 8; זה לא regression, זה design קיים שאומת).

25 assertions, כולן ירוקות. **בדיקת רגרסיה שלילית**: שיניתי זמנית `allow get: if
isAuthorized()` ל-`if true` (סימולציה של regression עתידי) — 5 בדיקות נכשלו
מיד, כולל "אנונימי: get DENY". הוכחה שהבדיקה תופסת רגרסיה אמיתית בכללים, לא
רק מריצה בלי לבדוק כלום.

**הרצה:** `node qa/suite/firestore_rules_test.mjs` (עצמאי — מרים ומוריד את ה-
emulator בעצמו). רץ אוטומטית גם ב-CI (`ci.yml`, כבר לולאה על `qa/suite/*.mjs`)
וגם כשער-בטיחות לפני כל פריסה (`deploy-functions.yml`, ר' F3).

---

### F3 — HIGH: פריסת Firestore Rules הייתה שלב ידני, ללא ערובת GitHub==Production

**הבעיה:** `deploy-functions.yml` פרס אוטומטית רק Cloud Functions
(`--only functions`). פריסת `firestore.rules` הייתה **שלב ידני מתועד** ב-
`SECURITY.md` ("מה נדרש לפרסם: firebase deploy --only functions,firestore:rules"
או דרך הקונסולה) — כלומר לא היה שום דבר שמבטיח שהכללים ב-repo הם אכן מה שרץ
בפרודקשן. אין לי גישת Firebase Console/CLI מאומתת בסביבה הזו כדי לאמת ישירות
מול הפרויקט החי (`squadron124-96357`) — בדיוק המגבלה שסעיף 3 בבקשה המקורית
הזהיר מפניה ("אל תניח ש-GitHub = Production").

**התיקון (`.github/workflows/deploy-functions.yml`):**
1. הטריגר כולל עכשיו גם `firestore.rules` (לא רק `functions/**`).
2. שער בטיחות חדש **לפני** פריסה: `node qa/suite/firestore_rules_test.mjs` —
   אם הכללים שבורים, ה-workflow נכשל ולא מגיע לשלב הפריסה.
3. הפקודה עצמה: `firebase deploy --only functions,firestore:rules` — מפרסמת את
   שני הרכיבים יחד, בכל דחיפה ל-`main` שנוגעת באחד מהם (מותנה עדיין ב-Secret
   `FIREBASE_TOKEN`, בדיוק כמו הפריסה הקיימת של Functions — אם הוא לא מוגדר,
   הריצה מדלגת בבטחה על שלב הפריסה ומזהירה בלוג, לא נכשלת).

**מה זה לא פותר:** אני לא יכול לאמת מכאן שהכללים שכבר רצים היום בפרודקשן
(*לפני* ה-workflow הזה) תואמים ל-repo — ל-workflow הזה יש תוקף רק **מרגע
המיזוג קדימה**. מומלץ לוודא ידנית פעם אחת (Firebase Console → Firestore →
Rules → Publish, או `firebase deploy --only firestore:rules` עם הרשאות מתאימות)
שהכללים הנוכחיים ב-`main` באמת פורסמו, לפני שסומכים על ה-workflow לבדו.

---

### F4 — MEDIUM: אין הגבלת גודל תמונה ל-`analyzeBoardImage`

**הבעיה:** `functions/index.js` קיבל `request.data.image` (data URL, base64)
בלי הגבלת אורך. עלות קריאה ל-Claude Vision תלויה בגודל/רזולוציית התמונה —
משתמש מאומת (בתוך מכסת 10/יום) עדיין יכול היה לנפח את העלות **לכל קריאה
בודדת** בלי גבול עליון.

**התיקון:** תקרה של 8MB על אורך ה-data URL (~6MB תמונה מקורית — נדיב בהרבה
מכל תמונת לוח אמיתית), נדחה עם `invalid-argument` לפני קריאה ל-API.

**איך נבדק:** `qa/suite/analyze_board_image_wiring_test.mjs` ממשיך לעבור (5/5) —
אין רגרסיה בזרימה הקיימת.

---

### F5 — LOW: Logging לאירועי אבטחה

נוספו `console.warn` (ללא PII/secrets — רק `uid` וקוד-ספק) בשלוש נקודות:
דחיית `markAuthorized` (ספק לא-password, פורמט אימייל שגוי, קוד לא מוכר),
ומיצוי מכסת `analyzeBoardImage`. אלה נקלטים אוטומטית ב-Cloud Logging (כל
Cloud Function רושמת `console.*` לשם). **לא הושלם:** ניטור/alerting פעיל על
הלוגים האלה (למשל alert על ריבוי דחיות `markAuthorized` מאותו IP/uid בטווח
קצר) — זה דורש הגדרה ב-Cloud Monitoring/Console, מחוץ להיקף שינוי קוד.

---

### F6 — MEDIUM (פתוח בכוונה): חולשות moderate ב-`functions/` (uuid טרנזיטיבי)

`npm audit` ב-`functions/`: 9 חולשות moderate, כולן מ-`uuid@<11.1.1`
("Missing buffer bounds check") שמגיע טרנזיטיבית דרך `@google-cloud/firestore`
ו-`@google-cloud/storage` (תלויות פנימיות של `firebase-admin`). **הבדיקה:**
תיקון דורש `firebase-admin@14.3.0` — אבל `firebase-functions@5.1.1` המותקן
מצהיר `peerDependencies: {"firebase-admin": "^11.10.0 || ^12.0.0"}` — כלומר
עדכון ל-13/14 **לא נתמך רשמית** ע״י גרסת `firebase-functions` הנוכחית, ועלול
לשבור התנהגות ב-runtime בלי דרך לבדוק זאת כאן (אין לי גישה ל-emulator מלא
עם Auth+Functions+Admin SDK אמיתי מול הפרויקט החי, ולא ניתן לפרוס ולבדוק
בפרודקשן בלי אישור). בהתאם להנחיה המפורשת ("אל תשדרג major versions
בעיוורון") — **לא בוצע שדרוג**. הסיכון בפועל נמוך: `uuid` בשרשרת הזו משמש
פנימית ליצירת מזהי-בקשה, לא נחשף לקלט-תוקף חיצוני דרך שום נתיב באפליקציה
הזו. **המלצה:** שדרוג מתואם (`firebase-admin@14.x` + `firebase-functions@6.x`)
עם בדיקה מלאה מול emulator, כמשימה נפרדת.

`npm audit` בשורש: 0 חולשות פרודקשן. 11 moderate ב-devDependencies (כולל
`firebase-tools` שהוספתי כרגע לבדיקות ה-rules) — אלה רצות רק בסביבת CI/פיתוח,
לא בקוד שמגיע לדפדפן משתמש או ל-Cloud Function, ולכן לא חושפות משטח תקיפה
לתוקף חיצוני של האפליקציה החיה.

---

### F7 — MEDIUM (חלקי): HTTP Security Headers

GitHub Pages (האחסון הנוכחי של `index.html`) **לא תומך** בהגדרת HTTP headers
מותאמים — אין דרך להוסיף `Content-Security-Policy`, `X-Frame-Options` או
`X-Content-Type-Options` אמיתיים (כותרות HTTP בלבד, `X-Frame-Options`/
`X-Content-Type-Options` לא ניתנים בכלל דרך `<meta>`, ו-`frame-ancestors`
ב-CSP מפורשות מתעלם כשמגיע דרך `<meta>` לפי הספסיפיקציה). **בוצע:** תגית
`<meta name="referrer" content="strict-origin-when-cross-origin">` — מונעת
דליפת ה-URL המלא של האפליקציה בכותרת `Referer` לאתרים חיצוניים (כמו
`wa.me`). **לא בוצע (פתוח, המלצה בלבד):** CSP מלא לא נוסה כאן כי מנגנון
הבדיקות של הפרויקט (`qa/lib/harness.mjs`) חוסם באופן מכוון את כל הבקשות
ל-`gstatic.com`/`googleapis.com`/`cloudflare.com` (כדי לבדוק לוגיקה בלי
תלות ברשת אמיתית) — כלומר **אין דרך בסביבה הזו לוודא ש-CSP לא שובר טעינת
Firebase/reCAPTCHA/Sentry/html2canvas/Fonts אמיתית** בלי לבדוק מול הדפדפן
החי. הצעת מדיניות (יש לבדוק ידנית ב-branch/preview לפני אכיפה):
```
script-src 'self' https://www.gstatic.com https://js-de.sentry-cdn.com https://cdnjs.cloudflare.com https://www.google.com https://www.gstatic.com/recaptcha/;
connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://api.anthropic.com... (רק דרך השרת, לא מהלקוח);
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
img-src 'self' data: blob:;
```
העברת האחסון ל-Firebase Hosting (תומך `firebase.json` → `headers`) היא הדרך
הנקייה להשיג את זה בעתיד — שינוי תשתית מחוץ להיקף השינוי הזה.

---

### F8–F13 — ממצאי INFO (נבדקו, לא פרצות)

- **F8:** מפתח ה-Web API של Firebase (`AIzaSy...`) גלוי ב-`index.html`,
  `firebase-messaging-sw.js`. זו התנהגות **תקנית** של Firebase — המפתח מזהה
  פרויקט, לא מעניק הרשאה; ההגנה בפועל היא Firestore Rules + App Check, ששניהם
  אומתו כפעילים (ר' SECURITY.md שלבים 1–2). לא לבלבל עם secret אמיתי.
- **F9:** כל קוד תקין אחד = גישה לכל הטייסת (לא הפרדת מסגרות). זו החלטת מוצר
  מתועדת (SECURITY.md שלב 4, CLAUDE.md "מה לא לשנות") — לא פרצה.
- **F10:** נעילת-כניסה בצד לקוח בלבד (`sq124_failCount`). מוגן בפועל ע״י
  App Check אכוף על Authentication (SECURITY.md שלב 1ב, 100% verified requests
  באימות בפועל) — חוסם ניחוש אוטומטי-מרוחק. localStorage lockout הוא UX
  בלבד, לא בלם אמיתי — כבר מתועד כ-TODO ידוע, לא נגעתי (לא business logic
  שנדרש לשנות, וההגנה האמיתית כבר במקום).
- **F11:** `npm audit` בשורש — 0 בפרודקשן. ר' F6 לפירוט dev.
- **F12:** `qa/lib/xss_probe.mjs` — הזרקת payload אמיתי (לא ניחוש סטטי) ל-11
  סוגי שדות (שמות, כותרות, הודעות, תקלות...) על 6+ מסכים, כולל דרך
  `run_daily.mjs`. 0 הפעלות. `escapeHTML()` (index.html) עובד בנתיבים שנבדקו.
- **F13:** שלושת ה-`onCall` (`markAuthorized`, `analyzeBoardImage`,
  `sendTestNotificationToSelf`) כולן: `enforceAppCheck:true` + בדיקת
  `request.auth`. `notifyOnPublish`/`remind*Daily`/`dailyDigest`/`weeklyBackup`
  הן טריגרים (Firestore write / Cloud Scheduler) — אין להן משטח HTTP חיצוני
  שדורש CORS. `sendTestNotificationToSelf` שולחת רק ל-token שהלקוח עצמו שלח
  (לא חיפוש בשרת) — לא ניתן לשלוח למישהו אחר דרכה במבנה.

---

## Push Tokens (סעיף 10) — נבדק, לא שונה

`push_tokens_<shed>` הם מסמכי Firestore רגילים (לא `admin_/authprofile_/
ai_quota_`) — כל `authorized` יכול טכנית לכתוב את **כל** המסמך (לא רק
ה-entry שלו), כי כללי sq124 לא עושים field-level security. בקוד הלקוח
(`savePushToken`, index.html) הכתיבה תמיד read-modify-write על ה-key של
עצמו בלבד — אבל זו הגנת client, לא server. **זו לא רגרסיה חדשה** — היא נובעת
ישירות מהחלטת המוצר המתועדת ב-F9 (אין הפרדה/field-security בשרת, "החשש אינו
מפני אנשי הטייסת עצמם"). תיקון אמיתי (subcollection פר-token עם rule
`request.auth.uid`) הוא שינוי סכימה לא-טריוויאלי שדורש מיגרציה — **לא בוצע
בכוונה**, מתועד כאן כהמלצה עתידית אם המדיניות תשתנה.

---

## מה עדיין פתוח (לא בוצע בכוונה, מתועד)

1. **F6** — שדרוג `firebase-admin`/`firebase-functions` מתואם (חוסם עדכון
   ישיר עקב תאימות; לא exploitable ישירות דרך האפליקציה).
2. **F7** — CSP מלא (דורש בדיקה מול דפדפן חי, לא אפשרי בסביבת ה-emulator/
   הבדיקות הנוכחית).
3. **F3 (המשך)** — אימות ידני חד-פעמי שהכללים שכבר רצים בפרודקשן *כרגע*
   (לפני ה-workflow) תואמים ל-repo — לא ניתן לאימות בלי גישת Console/CLI.
4. **push_tokens field-level security** — שינוי סכימה, לא בוצע בכוונה.
5. **Cloud Scheduler IAM** — לא ניתן לאמת מכאן שפונקציות `onSchedule`
   (`remindCertExpiryDaily` וכו׳) אינן מוגדרות עם invoker ציבורי (`allUsers`)
   ב-IAM של GCP — זו הגדרת deploy-time, לא visible בקוד. ברירת המחדל של
   Firebase Deploy ל-`onSchedule` היא invoker מוגבל ל-service account של
   Cloud Scheduler בלבד (בטוח כברירת מחדל) — מומלץ לוודא פעם אחת ב-Console.

---

## בדיקות שהורצו (סעיף 21)

| בדיקה | תוצאה |
|---|---|
| `node qa/run_daily.mjs` (121 קבצי qa/suite, כולל 2 חדשים, + XSS חי + סריקה סטטית + 103 מסכים × 19 סוגי משתמש) | ✅ ירוק, 0 ממצאים חמורים |
| `node qa/suite/firestore_rules_test.mjs` (25 assertions על emulator אמיתי) | ✅ ירוק + אומת עם negative control |
| `node qa/suite/mark_authorized_wiring_test.mjs` (חדש) | ✅ ירוק + אומת עם negative control |
| `node qa/suite/authorize_lib_test.mjs`, `authorize_client_test.mjs` | ✅ ירוק |
| `node qa/suite/analyze_board_image_wiring_test.mjs`, `board_ai_analyze_lib_test.mjs` | ✅ ירוק |
| `npm audit` (שורש) | 0 production, 11 moderate dev-only (ר' F6) |
| `npm audit` (`functions/`) | 9 moderate, פתוח בכוונה (ר' F6) |
| סריקת secrets (working tree + `git log --all -p`, כל הענפים) | 0 secrets אמיתיים; רק Firebase Web API key הפומבי (F8) |
| `node scripts/sw-cache-name.mjs --write` | סונכרן אחרי שינוי `index.html` |
| בדיקת XSS חיה (הזרקה אמיתית, לא ניחוש) | ✅ 0 הפעלות |

---

## סיכום קצר

**נמצא:** פרצת authorization קריטית (F1) שמאפשרת לתוקף חיצוני *ללא שום קוד
אמיתי* להשיג `authorized:true` מלא, דרך self-signup פתוח ב-Firebase Auth
שהקוד לא בדק נכון מולו. בנוסף — היעדר בדיקות Firestore Rules אוטומטיות (F2)
והיעדר אכיפת פריסה אוטומטית של הכללים (F3), שני פערים שהיו יכולים להשאיר
רגרסיות עתידיות (כולל F1 עצמו, אילו נכתב מחדש) בלי שאף אחד יבחין.

**תוקן:** F1 (הקוד עצמו + logging), F2 (25 בדיקות emulator אמיתיות), F3
(פריסה אוטומטית + שער בטיחות), F4 (תקרת גודל תמונה), F5 (logging חלקי).

**עדיין פתוח:** F6 (שדרוג dependencies מתואם), F7 (CSP מלא — דורש בדיקה
בדפדפן חי), אימות ידני חד-פעמי שהפרודקשן תואם ל-repo, IAM של Cloud Scheduler.

**5 הסיכונים החשובים ביותר (לפני התיקון בסשן הזה):**
1. F1 — עקיפת authorization מלאה (CRITICAL — תוקן).
2. F3 — אין ערובה ש-Firestore Rules בפרודקשן תואמות ל-repo (HIGH — תוקן קדימה).
3. F2 — רגרסיה עתידית ב-rules לא הייתה נתפסת (HIGH — תוקן).
4. F6 — חולשות moderate ב-dependencies של Functions (MEDIUM — פתוח, low exploitability).
5. F7 — אין CSP/security headers (MEDIUM — חלקית תוקן, מוגבל ע״י פלטפורמת האחסון).

**Security Score (סובייקטיבי, 1–10):**
- **לפני:** 9/10 מבחינת התשתית שכבר הייתה במקום (App Check אכוף, Firestore
  Rules deny-by-default, secrets נכונים, XSS מטופל) — **אבל 2/10 בפועל בגלל
  F1**: פרצת authorization קריטית אחת מאפסת את כל שאר ההגנות, כי היא נותנת
  לתוקף בדיוק את מה שכל שאר המנגנונים נועדו למנוע ממנו.
- **אחרי:** 8.5/10. F1 סגור ומאומת בבדיקה שתופסת רגרסיה. נותרו פערים
  מתועדים (F6, F7) שאינם exploitable ישירות דרך משטח-התקיפה של האפליקציה
  הזו, ותלות אחת בפעולה ידנית חד-פעמית (וידוא שהתיקון אכן נפרס לפרודקשן).

**האם מוכן ל-production?** **לא עדיין** — עד שהתיקון ל-F1 (`functions/
index.js`) **נפרס בפועל** ל-Cloud Functions (דרך `deploy-functions.yml`
בדחיפה ל-`main`, או ידנית). קוד בענף/PR לא מגן על אף אחד. מומלץ גם: לבדוק
ב-Firebase Console → Authentication אחרי הפריסה אם קיימים חשבונות
`u<code>@sq124.app` לקוד שלא הוקצה ע״י אף מ״ע (סימן לניצול-בפועל של F1
לפני התיקון) ולמחוק אותם.
