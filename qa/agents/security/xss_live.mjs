/* ============================================================
   אגף אבטחה · בדיקת XSS חיה
   ------------------------------------------------------------
   במקום לנחש מהקוד אילו מקומות חשופים — מזריקים מטען עוין
   לשדות שמשתמשים באמת מקלידים, מריצים את האפליקציה, ובודקים
   אם המטען *באמת* רץ. ממצא כאן הוא פרצה מוכחת, לא ניחוש סטטי.
   ============================================================ */
import { runXssProbe } from '../../lib/xss_probe.mjs';
import { closeBrowser } from '../../lib/harness.mjs';

const agent = {
  id: 'security/xss-live',
  name: 'בדיקת XSS חיה',
  kind: 'dynamic',
  domain: 'security',
  privacy: 'public',
  async run(){
    const findings = await runXssProbe();
    return { summary:{ count: findings.length }, findings };
  }
};
export default agent;

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await agent.run();
  console.log(JSON.stringify(r, null, 2));
  await closeBrowser();
  process.exit(r.findings.some(f=>f.sev==="high") ? 1 : 0);
}
