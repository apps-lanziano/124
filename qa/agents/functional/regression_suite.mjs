/* ============================================================
   אגף תפקודיות · בדיקות רגרסיה
   ------------------------------------------------------------
   מריץ את כל קבצי qa/suite/*.mjs — קבצים שנצברו מתיקוני באגים
   אמיתיים, כל אחד נכתב אחרי באג שקרה בפועל, כדי שהוא לא יחזור.
   ============================================================ */
import { existsSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { ROOT } from '../../lib/repo-root.mjs';

const agent = {
  id: 'functional/regression-suite',
  name: 'בדיקות רגרסיה',
  kind: 'dynamic',
  domain: 'functional',
  privacy: 'public',
  async run(){
    const findings = [];
    const dir = `${ROOT}/qa/suite`;
    if(!existsSync(dir)){
      return { summary:{total:0}, findings:[
        {sev:"med", area:"רגרסיה", title:"חבילת הבדיקות לא נמצאה",
         detail:"קבצי הבדיקה אינם בנתיב הצפוי. ודא ש-qa/suite קיים במאגר.", where:"qa/suite"}]};
    }
    const files = readdirSync(dir).filter(f=>f.endsWith('.mjs')).sort();
    let pass=0, fail=0;
    for(const f of files){
      try{
        execFileSync('node', [`${dir}/${f}`], { timeout: 180000, stdio:'pipe' });
        pass++;
      }catch(e){
        fail++;
        const out = ((e.stdout||'')+''+(e.stderr||'')).toString();
        const failedLines = out.split('\n').filter(l=>l.includes('❌')).slice(0,3).join(' | ');
        findings.push({sev:"high", area:"רגרסיה", title:`בדיקה נכשלה: ${f}`,
          detail: failedLines || out.slice(-300) || "כשל ללא פלט", where:`qa/suite/${f}`});
      }
    }
    if(!fail) findings.push({sev:"info", area:"רגרסיה", title:"כל בדיקות הרגרסיה עברו",
      detail:`${pass} קבצי בדיקה, כולם ירוקים — כל מנגנוני הכתיבה הקריטיים תקינים.`, where:"qa/suite"});
    return { summary:{ pass, fail, total:files.length }, findings };
  }
};
export default agent;

if(import.meta.url === `file://${process.argv[1]}`){
  const r = await agent.run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.findings.some(f=>f.sev==="high") ? 1 : 0);
}
