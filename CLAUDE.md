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

## Firebase / Security

- Firestore סגור (403) — App Check enforced
- Authentication: Firebase Auth (לא anonymous — נדחה על ידי App Check)
- `FIREBASE_SA_KEY` — רק ב-GitHub Secrets, לא בקוד
- אין לפרסם artifacts עם נתוני כוח-אדם אמיתיים

---

## מה **לא** לשנות

- זרימת ה-login (קריאות serial — `fbReadFailed` global דורש זאת)
- `maybeRotateWeek` — יש 3-retry read כנגד transient failures
- מינימיזציה (`build/`) — workflow דורמנטי, לא לשנות בלי הוראה מפורשת
