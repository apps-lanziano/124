/* שורש המאגר — נגזר ממיקום הקובץ הזה, לא מקובע. קובץ נפרד מ-pw.mjs
   (שמייבא Playwright בטעינה) כדי שבדיקות מקור טהורות (כמו
   scheduled_functions_wiring_test.mjs) שרק צריכות נתיב לקובץ יוכלו
   לרוץ בלי תלות בדפדפן — למשל בשלב הבדיקה הקל של פריסת ה-Functions,
   שמריץ npm ci רק על functions/ ולא מתקין Playwright בכלל. */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
