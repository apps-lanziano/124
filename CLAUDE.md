# CLAUDE.md — טייסת 124 PWA

> קרא קובץ זה בתחילת כל סשן. הוא חוסך טוקנים רבים.

## מה זה?

PWA לניהול כוח-אדם של טייסת 124 (חיל האוויר). קובץ HTML בודד (~15,500 שורות) עם Firebase backend.

**שפת הממשק:** עברית (RTL). **שפת הקוד:** ג'אווהסקריפט + HTML + CSS מוטבעים.
**כל תקשורת עם המשתמש — בעברית.**

---

## ארכיטקטורה

| שכבה | פרטים |
|---|---|
| `index.html` | הכל מוטבע פנימה — style, script, HTML |
| `service-worker.js` | stale-while-revalidate; `CACHE_NAME` מתעדכן בכל פריסה |
| `functions/` | Cloud Functions (Node.js) — push notifications, Cloud Scheduler |
| `build/build.mjs` | מינימיזציה (terser + clean-css) → `dist/` (דורמנטי, לא בפריסה הנוכחית) |
| `qa/suite/*.mjs` | בדיקות Playwright — `node qa/suite/<file>.mjs` |
| `qa/lib/harness.mjs` | `newPage()`, `closeBrowser()`, `loginAsFramework(page, shed, role)` |

**פריסה:** `main` → GitHub Pages (קובץ index.html ישירות). ענף פיתוח: `claude/github-pages-site-review-b11uiu`.

---

## Storage helpers

```js
sGet(key)            // קריאה scoped לסככה הנוכחית
sSet(key, val)       // כתיבה scoped לסככה הנוכחית
sGetRaw(key)         // קריאה גלובלית (ללא scoping)
sSetRaw(key, val)    // כתיבה גלובלית
sGetIn(shed, key)    // קריאה לסככה ספציפית
sSetIn(shed, key, v) // כתיבה לסככה ספציפית
```

---

## תפקידים (roles / userRole)

| תפקיד | תיאור |
|---|---|
| `"מפקד"` | מפקד / קצין — גישה מלאה |
| `"מ״ע"` | מנהל עבודה (כלי ניהול מרביים) |
| `"חייל"` | חייל רגיל — תצוגה מוגבלת |

`isRosterManager` = `true` כשהמשתמש מ״ע תורניות (רשאי לערוך לוח).

---

## מודל לוח צוות (Roster v2)

```js
roster.days["ראשון" | "שני" | "שלישי" | "רביעי" | "חמישי"]
  .manager       // מנהל (חמישי = יום ה')
  .managerWknd   // מנהל (שישי–שבת) — שדה עורך בלבד
  .lead          // ר״צ
  .deputyLead    // ל ר״צ
  .pilot         // מטיס
  .driver        // נהג
  .tools         // פקיד כלים
  .fixedAug[]    // מתגבר קבוע (חמישי)
  .fixedAugWknd  // מתגבר קבוע (שישי–שבת)
  .pf[]          // [{name, course, reserve}]
  .pfRest[]      // נחים PF
  .pms[]         // PMS
  .pmsRest[]     // נחים PMS
  .reserve[]     // מילואים
  .basic[]       // [{name, type}] — תורנות בסיסית
  .duty[]        // תורן
  .rest[]        // נח
```

**ימי סיבוב:** `ROSTER_ROTATING_DAYS = ["ראשון","שני","שלישי","רביעי"]`
**ימי עריכה:** מוסיף "חמישי" (מייצג גם שישי–שבת) — `rosterEditKey()` מכווץ סופ״ש → "חמישי"

**slots בסופ״ש:** מנהל + מתגבר מפוצלים: `manager`/`fixedAug` = יום ה'; `managerWknd`/`fixedAugWknd` = שישי–שבת.

---

## תצוגות לוח צוות

```js
rosterView = "board" | "day" | "mine"
```

| ערך | שם בממשק | תוכן |
|---|---|---|
| `"board"` | לוח שבועי | טבלה שבועית (`rosterBoardHtml`) |
| `"day"` | לוח יומי | כרטיסי-יום (`rosterCardsHtml`) — ברירת מחדל לחיילים |
| `"mine"` | רק אני | פילטר אישי (`rosterMineHtml`) |

**ברירת מחדל:** חייל → `"day"`; מ״ע/מפקד → `"board"`.
> ⚠️ לשונית "כרטיסים" הוסרה. לשונית "יום" **היא** הכרטיסים.

---

## חוקי דוח חריגות (`computeRosterCompliance`)

**לא נספרים בחריגות:**
- מפקד (`role === "מפקד"`)
- מנהל-סלוט (`manager` / `managerWknd`)
- מטיס (profession `"מטיס"` / `"טייס"` או סלוט `pilot`)
- מילואים (`p.reserve === true`)
- נהג (profession `"נהג"` / `"נהג מקצועי"`)
- חופש כל השבוע (constraint vacation מאושרת)
- פקיד כלים — תמיד נח (לא נספר)
- תורנות בסיסית — לא נספרת כשיבוץ
- **סופ״ש לא נספר** (שישי, שבת, יום ה' כמשמרת סופ״ש)

---

## פרטיות שבוע הבא

רק מ״ע תורניות (`isRosterManager`) רואה לוח שבוע הבא לפני פרסום.
כלל היוזרים רואים: שבוע שעבר + שבוע נוכחי.

---

## Service Worker

`CACHE_NAME` בקובץ `service-worker.js` חייב להתעדכן בכל batch שנפרס.
גרסה נוכחית: **v34**.

משתמש ב-`SKIP_WAITING` message (לא `skipWaiting()` אוטומטי) — עדכון נשאר "ממתין" עד שהמשתמש לוחץ "גרסה חדשה זמינה".

---

## QA

```bash
node qa/suite/<test>.mjs    # הרץ בדיקה בודדת
```

**109 בדיקות, כולן עוברות** נכון ל-2026-08-16.

קבצי בדיקות קיימים:
- `roster_cards_view_test.mjs` — לשוניות + כרטיסי יום
- `roster_ui_test.mjs` — ממשק כללי + זום
- `roster_new_slots_test.mjs` — משבצות מנהל/מטיס/PMS נחים
- `roster_weekend_split_test.mjs` — פיצול מנהל/מתגבר חמישי vs שישי–שבת
- `roster_count_and_search_test.mjs` — ספירות + חיפוש חייל
- `roster_compliance_test.mjs` — חוקי חריגות
- `roster_next_week_privacy_test.mjs` — פרטיות שבוע הבא
- `soldier_dashboard_test.mjs` — דשבורד חייל
- `profession_field_test.mjs` — שדה מקצוע
- `tools_sort_by_expiry_test.mjs` — מיון כלים לפי תוקף
- `vo_licenses_by_shed_test.mjs` — רישיונות לפי סככה
- `build_minify_test.mjs` — מינימיזציה
- `constraint_edit_resubmit_and_daily_wa_test.mjs` — אילוצים

---

## Git workflow

```bash
# ענף פיתוח:
git checkout claude/github-pages-site-review-b11uiu

# בתחילת batch:
git stash
git fetch origin claude/github-pages-site-review-b11uiu
git checkout claude/github-pages-site-review-b11uiu
git merge main --ff-only
git stash pop

# קומיט:
git add -A
git commit -m "תיאור בעברית"
git push -u origin claude/github-pages-site-review-b11uiu

# מיזוג ל-main (לאחר אישור המשתמש):
git checkout main
git fetch origin main
git merge origin/main
git merge --no-ff claude/github-pages-site-review-b11uiu
git push origin main
```

---

## ניווט המפקד (סרגל תחתון + תפריט "עוד")

**מסך-שער "הדרכה"** (`scr-trainhub`, `renderTrainHub`) — מאחד הסמכות + קליטת חייל חדש + חומרי הדרכה. לא מחזיק נתונים, רק מנתב + מונה מצב לכל שורה.

| פריט | מפקד סככה | חייל |
|---|---|---|
| הדרכה (`nav-trainhub`) | לשונית ✅ | — |
| הסמכות (`nav-certs`) | — (דרך השער) | `sheet-certs` |
| חומרי הדרכה | דרך השער | `nav-training` |
| קליטת חייל חדש | דרך השער | `sheet-onboarding` (אם רלוונטי) |
| כשירות חיילים | לשונית `nav-medchecks` ✅ | `sheet-medchecks` |
| רכבים | `more-vehicles-item` ב"עוד" | לפי `isVehiclesResp` |

`hasTrainHub` = מפקד **וגם** לא מחלקות **וגם** לא מסגרת תפקידית (מ״ע אחזקה/הדרכה). במסגרות בלי שער — כל פריט נשאר במקומו המקורי, כדי לא לנתק גישה.

> ⚠️ **"סגירת יום" הוסר לגמרי** (מסך, מודל, פונקציות, פריט תפריט). לא להחזיר.

---

## Design System

> מקור האמת: בלוק ה-`<style>` ב-`index.html`. כאן — הטוקנים לשימוש עקבי בכל מסך/רכיב חדש.

**עקרון:** מובייל-פירסט, RTL עברית. `#app` = `max-width:480px` ממורכז, `100dvh`, app-shell (`overflow:hidden`). **אין מצב כהה.**

### צבעים (משתני `:root`, מבוססי OKLCH)

| קטגוריה | טוקנים |
|---|---|
| רקע/משטח | `--bg` (דף), `--card` (#fff כרטיסים), `--line` (גבולות) |
| טקסט (היררכיה) | `--ink` → `--ink-2` → `--ink-3` |
| זהות (אדום) | `--red` / `--red-2` / `--red-deep` + `--red-soft` / `--red-line` |
| סטטוס/אקסנט | `--gold` / `--gold-soft` (אזהרה), `--green` / `--green-soft` (הצלחה) |

### טיפוגרפיה

- גופן יחיד: **Assistant** (משקלים 300–900, נטען מ-Google Fonts). כותרות היסטורית Heebo/Secular One.
- כיוון RTL, `text-align:right`, `-webkit-font-smoothing:antialiased`.

### צורה ותנועה

- רדיוס: `--radius` = 16px (כפתורים/אינפוט ~13px).
- צל: `--shadow` (עדין), `--shadow-lg` (מוגבה).
- **מוסכמת אינטראקציה:** לחיצה = `transform:scale(.96)` ב-`:active` (בכל הרכיבים).

### רכיבי מפתח

- `.m-btn` — `.primary` = גרדיאנט אדום + צל; `.ghost` = לבן + `--line`. `.m-input` — פוקוס → גבול `--red`. `.m-file` — dashed.
- נוספים: `.card`, `.role-chip`, `.nav-btn`, `.today-card`, `.alert-*`, `.roster-*`.

---

## עולמות הסייבר / Security

> פרטים מלאים ב-`SECURITY.md`. כאן — מודל האיום ונקודות המפתח בלבד.

### מודל האימות (2 שכבות — לא שוות בערך!)

1. **קוד מסגרת** — `checkCode()` → חשבון Firebase `u<code>@sq124.app`, סיסמה נגזרת: `deriveAuthPassword(code) = "sq124:" + code`. **זה שער-המידע האמיתי:** ברגע שהקוד תקין → `markSessionAuthorized()` → `authorized:true` → `loadRuntimeLists()` טוען את *כל* הנתונים — **לפני** שהוקלד PIN.
2. **PIN אישי** — `verifyPin()` **בצד הלקוח בלבד**. נעילת-מסך, **לא** שער-מידע. לא מגן על הדאטה ברמת השרת.

### Firestore rules (`firestore.rules`, גרסה 3 פעילה)

- דורש claim `authorized:true` (נקבע ב-Cloud Function `markAuthorized` — מוודאת server-side ש-`sign_in_provider==="password"`, לא anonymous).
- `list` חסום תמיד (בלי שאיבה המונית). קריאה תמיד מסמך בודד לפי מפתח.
- **אין הפרדת מסגרות** (בכוונה — v2 מושבתת). קוד תקין *אחד* (חייל או מפקד) = גישת קריאה/כתיבה לכל הטייסת.

### App Check

- **אכוף על Firestore.** מאותחל בלקוח (reCAPTCHA v3) *לפני* ההתחברות → כבר נשלח גם ל-Auth.
- ⚠️ **לא אכוף על Authentication** — הפעלתו (הגדרת קונסולה, אפס קוד) חוסמת brute-force על הקוד. מומלץ.

### חולשה ידועה / TODO

- קוד מסגרת = **4 ספרות מספריות** (10,000 צירופים). הבלם היחיד לניחוש = App Check. חיזוק: קוד אלפאנומרי ארוך **או** אכיפת App Check על Auth.
- נעילת-כניסה (`sq124_failCount`/`lockUntil`) = **localStorage בלבד** → עקיפה טריוויאלית. לא בלם אמיתי.

### כללי ברזל

- `FIREBASE_SA_KEY` — רק ב-GitHub Secrets, לא בקוד.
- אין להטמיע App Check **debug token** בקוד (עוקף את ההגנה מכל מקור).
- אין לפרסם artifacts עם נתוני כוח-אדם אמיתיים.

---

## מה **לא** לשנות

- זרימת ה-login (קריאות serial — `fbReadFailed` global דורש זאת)
- `maybeRotateWeek` — יש 3-retry read כנגד transient failures
- מינימיזציה (`build/`) — workflow דורמנטי, לא לשנות בלי הוראה מפורשת
