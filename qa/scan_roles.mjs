/* ============================================================
   סוכן 1 — סריקת זהויות מקצה לקצה
   ------------------------------------------------------------
   נכנס בתור כל זהות באפליקציה (כל מסגרת × מפקד/חייל + מנהל
   מערכת, קצין טכני, אחראי תקציבים), עובר על כל מסך שגלוי לה,
   ומדווח על: כשל התחברות, מסך שלא נטען, מסך שנתקע על "טוען…",
   וכל שגיאת JavaScript שנזרקה בדרך.

   זה מחליף את "נכנס בעצמי לכל יוזר ובודק אם הדברים עוברים".
   ============================================================ */
import { newPage, loginAsFramework, loginAsSpecial, visibleScreens, visitScreen,
         SHED_LIST, closeBrowser } from './lib/harness.mjs';

const findings = [];
const summary  = { identities:0, screens:0, ok:0, failed:0 };

function add(sev, area, title, detail){ findings.push({sev, area, title, detail}); }

async function scanIdentity(label, loginFn){
  summary.identities++;
  const { page, pageErrors, consoleErrors } = await newPage();
  try{
    const res = await loginFn(page);
    if(!res.ok){
      add("high", label, "התחברות נכשלה", res.why || "לא ידוע");
      summary.failed++;
      return;
    }
    const screens = await visibleScreens(page);
    for(const scr of screens){
      summary.screens++;
      const before = pageErrors.length;
      const r = await visitScreen(page, scr);
      const newErrs = pageErrors.slice(before);
      if(!r.ok){
        add("high", label, `המסך ${scr} לא נטען`, r.why);
        summary.failed++;
      } else if(r.spinnerStuck){
        add("high", label, `המסך ${scr} נתקע על "טוען…"`, "המסך לא סיים לרנדר נתונים");
        summary.failed++;
      } else if(r.empty){
        add("med", label, `המסך ${scr} ריק`, "לא הוצג שום תוכן — ייתכן שתקין (אין נתונים) וייתכן שכשל רינדור");
        summary.ok++;
      } else {
        summary.ok++;
      }
      if(newErrs.length){
        add("high", label, `שגיאת JavaScript במסך ${scr}`, newErrs.join(" | ").slice(0,400));
        summary.failed++;
      }
    }
    // שגיאות שנזרקו בזמן ההתחברות עצמה (לפני מעבר מסכים)
    if(pageErrors.length && !screens.length){
      add("high", label, "שגיאות בהתחברות", pageErrors.join(" | ").slice(0,400));
    }
    /* רעש צפוי של סביבת הבדיקה עצמה (file:// בלי רשת) — לא באג באפליקציה:
       service worker לא נרשם בפרוטוקול file, ו-Firebase לא נטען כי הרשת
       חסומה בכוונה. מסננים כדי שהדוח יישאר נקי מהתראות שווא. */
    const HARNESS_NOISE = /service worker registration failed|Firebase init failed|Failed to fetch dynamically imported module|net::ERR|Failed to load resource|favicon|App Check/i;
    const uniqConsole = [...new Set(consoleErrors)].filter(t=>!HARNESS_NOISE.test(t));
    if(uniqConsole.length){
      add("low", label, "שגיאות קונסולה", uniqConsole.slice(0,3).join(" | ").slice(0,300));
    }
  } finally {
    await page.close();
  }
}

export async function run(){
  for(const shed of SHED_LIST){
    for(const role of ["מפקד","חייל"]){
      await scanIdentity(`${shed.name} · ${role}`, p=>loginAsFramework(p, shed.id, role));
    }
  }
  for(const [kind,label] of [["owner","מנהל מערכת"],["tech","קצין טכני"],["budget","אחראי תקציבים"]]){
    await scanIdentity(label, p=>loginAsSpecial(p, kind));
  }
  return { name:"סריקת זהויות ומסכים", summary, findings };
}

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await run();
  console.log(JSON.stringify(r, null, 2));
  await closeBrowser();
  process.exit(r.findings.some(f=>f.sev==="high") ? 1 : 0);
}
