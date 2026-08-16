/* ============================================================
   אגף תפקודיות · סריקת זהויות ומסכים
   ------------------------------------------------------------
   נכנס בתור כל זהות באפליקציה (כל מסגרת × מפקד/חייל + מנהל
   מערכת, קצין טכני, אחראי תקציבים), עובר על כל מסך שגלוי לה,
   ומדווח על: כשל התחברות, מסך שלא נטען, מסך שנתקע על "טוען…",
   וכל שגיאת JavaScript שנזרקה בדרך.

   זה מחליף את "נכנס בעצמי לכל יוזר ובודק אם הדברים עוברים".
   ============================================================ */
import { newPage, loginAsFramework, loginAsSpecial, loginAsSuperAdmin, visibleScreens, visitScreen,
         SHED_LIST, closeBrowser } from '../../lib/harness.mjs';

async function scanIdentity(findings, summary, label, loginFn){
  summary.identities++;
  const { page, pageErrors, consoleErrors } = await newPage();
  try{
    const res = await loginFn(page);
    if(!res.ok){
      findings.push({sev:"high", area:label, title:"התחברות נכשלה", detail:res.why || "לא ידוע"});
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
        findings.push({sev:"high", area:label, title:`המסך ${scr} לא נטען`, detail:r.why});
        summary.failed++;
      } else if(r.spinnerStuck){
        findings.push({sev:"high", area:label, title:`המסך ${scr} נתקע על "טוען…"`, detail:"המסך לא סיים לרנדר נתונים"});
        summary.failed++;
      } else if(r.empty){
        findings.push({sev:"med", area:label, title:`המסך ${scr} ריק`, detail:"לא הוצג שום תוכן — ייתכן שתקין (אין נתונים) וייתכן שכשל רינדור"});
        summary.ok++;
      } else {
        summary.ok++;
      }
      if(newErrs.length){
        findings.push({sev:"high", area:label, title:`שגיאת JavaScript במסך ${scr}`, detail:newErrs.join(" | ").slice(0,400)});
        summary.failed++;
      }
    }
    if(pageErrors.length && !screens.length){
      findings.push({sev:"high", area:label, title:"שגיאות בהתחברות", detail:pageErrors.join(" | ").slice(0,400)});
    }
    /* רעש צפוי של סביבת הבדיקה עצמה (file:// בלי רשת) — לא באג באפליקציה:
       service worker לא נרשם בפרוטוקול file, ו-Firebase לא נטען כי הרשת
       חסומה בכוונה. מסננים כדי שהדוח יישאר נקי מהתראות שווא. */
    const HARNESS_NOISE = /service worker registration failed|Firebase init failed|Failed to fetch dynamically imported module|net::ERR|Failed to load resource|favicon|App Check/i;
    const uniqConsole = [...new Set(consoleErrors)].filter(t=>!HARNESS_NOISE.test(t));
    if(uniqConsole.length){
      findings.push({sev:"low", area:label, title:"שגיאות קונסולה", detail:uniqConsole.slice(0,3).join(" | ").slice(0,300)});
    }
  } finally {
    await page.close();
  }
}

const agent = {
  id: 'functional/identity-screens',
  name: 'סריקת זהויות ומסכים',
  kind: 'dynamic',
  domain: 'functional',
  privacy: 'public',
  async run(){
    const findings = [];
    const summary = { identities:0, screens:0, ok:0, failed:0 };
    for(const shed of SHED_LIST){
      for(const role of ["מפקד","חייל"]){
        await scanIdentity(findings, summary, `${shed.name} · ${role}`, p=>loginAsFramework(p, shed.id, role));
      }
    }
    for(const [kind,label] of [["tech","קצין טכני"],["budget","אחראי תקציבים"]]){
      await scanIdentity(findings, summary, label, p=>loginAsSpecial(p, kind));
    }
    // "מנהל מערכת" (כניסה נפרדת עם קוד ייעודי) הוסר — נבדק עכשיו כזהות אישית (מנהל-על)
    await scanIdentity(findings, summary, "מנהל-על (זהות אישית)", p=>loginAsSuperAdmin(p));
    return { summary, findings };
  }
};
export default agent;

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await agent.run();
  console.log(JSON.stringify(r, null, 2));
  await closeBrowser();
  process.exit(r.findings.some(f=>f.sev==="high") ? 1 : 0);
}
