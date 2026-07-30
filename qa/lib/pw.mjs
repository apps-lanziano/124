/* ============================================================
   איתור Playwright ודפדפן — עובד בשתי הסביבות
   ------------------------------------------------------------
   בסביבת הפיתוח playwright מותקן גלובלית תחת /opt, ובשרת ה-CI
   הוא מותקן מקומית ב-node_modules. הדפדפן דומה: בפיתוח יש
   Chromium מוכן ב-/opt/pw-browsers, וב-CI Playwright מוריד לבד.
   הקובץ הזה מסתיר את ההבדל, כדי שקבצי הבדיקה לא יצטרכו לדעת
   על שום נתיב מוחלט.
   ============================================================ */
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve, join } from 'path';

/* שורש המאגר — נגזר ממיקום הקובץ הזה, לא מקובע.
   בלי זה הבדיקות רצות רק במחשב שבו נכתבו: ב-GitHub המאגר יושב
   תחת /home/runner/work/... ולא תחת /home/user. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const APP_URL = pathToFileURL(join(ROOT, 'index.html')).href;

let chromium;
try {
  ({ chromium } = await import('playwright'));           // CI / התקנה מקומית
} catch {
  ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'));  // סביבת הפיתוח
}

const LOCAL_CHROME = '/opt/pw-browsers/chromium';

/* מפעיל דפדפן עם הנתיב הנכון לסביבה. אפשר להעביר אפשרויות נוספות. */
export async function launchBrowser(opts = {}){
  const base = existsSync(LOCAL_CHROME) ? { executablePath: LOCAL_CHROME } : {};
  return chromium.launch({ ...base, ...opts });
}

export { chromium };
