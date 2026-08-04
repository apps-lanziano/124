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
import { pathToFileURL } from 'url';
import { join } from 'path';
import { ROOT } from './repo-root.mjs';

export { ROOT };
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
