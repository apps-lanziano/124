/* ============================================================
   יומן ביקורת שרת-צד (Audit Log) — פעולות רגישות בלבד
   ------------------------------------------------------------
   למה זה קיים: `owner_log`/`admin_audit_log`/`audit_log` (ר' index.html)
   הם כולם מסמכי sq124 רגילים — הלקוח כותב אליהם ישירות, ולכן משתמש
   (גם מפקד-על) יכול תיאורטית לערוך/למחוק רשומה כדי לטשטש עקבות. האוסף
   `audit_log` (טופ-לבל, לא תחת sq124) שהלוגיקה כאן כותבת אליו הוא
   קריאה-בלבד ללקוח (ר' firestore.rules) — רק Admin SDK, מתוך הטריגר
   ב-functions/index.js, יכול לכתוב אליו. אי אפשר לזייף/למחוק מהדפדפן.

   מה נסרק: כל כתיבה למסמכי sq124 שמזהה המסמך תואם אחד מהדפוסים למטה —
   הפרשים בין before ל-after, לא "כל כתיבה" (רוב כתיבות הלוח/משימות/וכו'
   לא נוגעות כאן בכלל ולא עוברות אפילו בדיקת regex).

   * `<שם-סככה>_cfg_personnel` — הוספה/הסרה/עדכון איש צוות (כולל תפקיד,
     PIN, מקצוע, מחלקה, מילואים) — "מי נכנס/יצא/שונה" בכוח האדם.
   * `authprofile_<hash>` — הקצאה/ביטול/שינוי של קוד כניסה (provisionAuthAccounts/
     closeAuthCode) — זהות ההרשאה שמאחורי כל קוד.
   * `owner_log` — מראה (mirror) של יומן פעולות מנהל-העל (ownerLog) —
     הוספת/עריכת/הסרת משתמש דרך מסך "ניהול משתמשים", איפוס PIN, כניסה
     בתור. נכתב כבר ע"י הלקוח לצורך תצוגה; כאן רק משוכפל לאחסון שאי
     אפשר לגעת בו כדי שמחיקה/עריכה מאוחרת של owner_log לא תמחק את העדות.

   כל פונקציה כאן טהורה (קלט→פלט, בלי Firestore/Admin SDK) כדי שאפשר
   לבדוק אותה ישירות — ר' qa/suite/audit_log_lib_test.mjs. */

const SENSITIVE_PATTERNS = [
  /_cfg_personnel$/,
  /^authprofile_/,
  /^owner_log$/,
];

function isSensitiveDocId(docId) {
  return SENSITIVE_PATTERNS.some((re) => re.test(docId));
}

function describeProfile(prof) {
  if (!prof || !prof.kind) return "לא ידוע";
  if (prof.kind === "owner") return "מנהל מערכת";
  if (prof.kind === "tech") return "קצין טכני";
  if (prof.kind === "budget") return "אחראי תקציבים";
  if (prof.kind === "framework") return `${prof.shedId || "?"} · ${prof.role || "?"}`;
  return "לא ידוע";
}

/* השוואת רשימת אנשי צוות (מערך {name, role, pinHash, ...}) — לפי שם,
   בדיוק כמו שאר האפליקציה (השם הוא מפתח הזיהוי, ר' renamePersonEverywhere
   ב-index.html). שדות שמושווים מפורשות בלבד — לא כל שינוי JSON גולמי,
   כדי שהתעדכנות "רועשת" (customFields, refresh) לא תציף את היומן. */
const PERSONNEL_DIFF_FIELDS = [
  {key: "role", label: "תפקיד"},
  {key: "profession", label: "מקצוע"},
  {key: "dept", label: "מחלקה"},
  {key: "reserve", label: "מילואים"},
];

function diffPersonnel(before, after) {
  const beforeArr = Array.isArray(before) ? before : [];
  const afterArr = Array.isArray(after) ? after : [];
  const beforeMap = new Map(beforeArr.filter((p) => p && p.name).map((p) => [p.name, p]));
  const afterMap = new Map(afterArr.filter((p) => p && p.name).map((p) => [p.name, p]));
  const entries = [];

  for (const [name, p] of afterMap) {
    if (!beforeMap.has(name)) {
      entries.push({action: "הוספת איש צוות", target: name, detail: `תפקיד: ${p.role || "?"}`});
    }
  }
  for (const [name, p] of beforeMap) {
    if (!afterMap.has(name)) {
      entries.push({action: "הסרת איש צוות", target: name, detail: `תפקיד: ${p.role || "?"}`});
    }
  }
  for (const [name, np] of afterMap) {
    const op = beforeMap.get(name);
    if (!op) continue;
    const changes = [];
    for (const f of PERSONNEL_DIFF_FIELDS) {
      const ov = op[f.key], nv = np[f.key];
      if (JSON.stringify(ov ?? null) !== JSON.stringify(nv ?? null)) {
        changes.push(`${f.label}: ${ov ?? "—"} → ${nv ?? "—"}`);
      }
    }
    if (!!op.pinHash !== !!np.pinHash || (op.pinHash && np.pinHash && op.pinHash !== np.pinHash)) {
      changes.push(np.pinHash ? "PIN הוגדר/אופס" : "PIN הוסר");
    }
    if (changes.length) {
      entries.push({action: "עדכון פרטי איש צוות", target: name, detail: changes.join(" · ")});
    }
  }
  return entries;
}

function diffAuthProfile(docId, before, after) {
  if (before === undefined && after !== undefined) {
    return [{action: "הקצאת קוד כניסה", target: docId, detail: describeProfile(after)}];
  }
  if (before !== undefined && after === undefined) {
    return [{action: "ביטול קוד כניסה", target: docId, detail: describeProfile(before)}];
  }
  if (before !== undefined && after !== undefined && JSON.stringify(before) !== JSON.stringify(after)) {
    return [{action: "שינוי הקצאת קוד כניסה", target: docId, detail: `${describeProfile(before)} → ${describeProfile(after)}`}];
  }
  return [];
}

/* owner_log הוא מערך שנכתב ב-unshift (חדש בראש) — רק תוספות אמיתיות
   מעניינות אותנו; קיצור/עריכה של המערך הקיים (למשל slice(0,300)) לא
   אמורים לייצר רשומות חדשות. */
function diffOwnerLog(before, after) {
  const beforeArr = Array.isArray(before) ? before : [];
  const afterArr = Array.isArray(after) ? after : [];
  if (afterArr.length <= beforeArr.length) return [];
  const added = afterArr.slice(0, afterArr.length - beforeArr.length);
  return added.map((e) => ({
    action: "פעולת מנהל",
    target: null,
    detail: (e && e.text) || "",
    by: (e && e.by) || null,
  }));
}

function buildAuditEntries(docId, before, after) {
  if (/_cfg_personnel$/.test(docId)) return diffPersonnel(before, after);
  if (/^authprofile_/.test(docId)) return diffAuthProfile(docId, before, after);
  if (docId === "owner_log") return diffOwnerLog(before, after);
  return [];
}

module.exports = {isSensitiveDocId, buildAuditEntries, diffPersonnel, diffAuthProfile, diffOwnerLog, describeProfile};
