/* ============================================================
   מרשם הסוכנים — טייסת 124
   ------------------------------------------------------------
   רשימה אחת שמגדירה את כל סוכני הבדיקה, מאורגנים לפי אגף
   אחריות (מה שואלים), לא לפי איך בודקים:

     תפקודיות  — האם האפליקציה עובדת?
     אבטחה     — האם היא בטוחה?
     איכות     — האם היא בריאה (ביצועים/ניקיון/נגישות)?
     נתונים    — המצב האמיתי של הטייסת ב-Firebase (אישי — לא נשמר במאגר)
     מוצר      — הצעות שדרוג (שיפוט אנושי, לא סריקה אוטומטית)

   כל שינוי בכמות/סדר/מיקום הסוכנים נעשה כאן ורק כאן. כל סוכן
   מגדיר את עצמו במלואו בקובץ שלו (id, name, kind, domain,
   privacy) — הרשימה כאן רק קובעת סדר טעינה, לא מפרשת שום דבר.
   ============================================================ */
export const DOMAIN_ORDER = ['functional', 'security', 'quality'];
export const DOMAIN_LABELS = {
  functional: "תפקודיות",
  security:   "אבטחה",
  quality:    "איכות וביצועים",
  data:       "נתונים חיים",
  product:    "מוצר",
};

export const AGENT_LOADERS = [
  () => import('./agents/functional/identity_screens.mjs'),
  () => import('./agents/functional/regression_suite.mjs'),
  () => import('./agents/security/xss_live.mjs'),
  () => import('./agents/security/static_audit.mjs'),
  () => import('./agents/security/regression_guards.mjs'),
  () => import('./agents/quality/code_health.mjs'),
  () => import('./agents/quality/performance.mjs'),
  () => import('./agents/data/live_firebase.mjs'),
  () => import('./agents/product/upgrade_ideas.mjs'),
];
