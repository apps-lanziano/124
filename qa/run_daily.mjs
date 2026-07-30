/* ============================================================
   מפעיל הסוכנים — דוח יומי, טייסת 124
   ------------------------------------------------------------
   מריץ את כל הסוכנים ומייצר דוח אחד בעברית:
     1. סריקת זהויות ומסכים  — נכנס בתור כל משתמש ובודק כל מסך
     2. בדיקות רגרסיה         — כל מנגנוני הכתיבה הקריטיים
     3. אבטחת מידע            — פרצות, כולל בדיקת XSS חיה
     4. שיפור וייעול          — ביצועים, קוד מת, שמירה על תיקונים

   הרצה:  node qa/run_daily.mjs
   פלט:   qa/reports/YYYY-MM-DD.md  (+ הדפסה למסך)
   קוד יציאה: 1 אם יש ממצא חמור, 0 אחרת.
   ============================================================ */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { closeBrowser } from './lib/harness.mjs';

const ROOT = '/home/user/124';
const SEV_ORDER = { high:0, med:1, low:2, info:3 };
const SEV_HE = { high:"🔴 חמור", med:"🟠 בינוני", low:"🟡 קל", info:"🔵 מידע" };

/* ---------- סוכן 2: חבילת הרגרסיה הקיימת ---------- */
async function runRegression(){
  const findings = [];
  const SUITE_DIR = '/tmp/claude-0/-home-user-124/87508a16-c6b2-5234-8c26-c6c20665afd9/scratchpad';
  const localSuite = `${ROOT}/qa/suite`;
  const dir = existsSync(localSuite) ? localSuite : (existsSync(SUITE_DIR) ? SUITE_DIR : null);
  if(!dir){
    return { name:"בדיקות רגרסיה", summary:{total:0}, findings:[
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
  return { name:"בדיקות רגרסיה", summary:{ pass, fail, total:files.length }, findings };
}

/* ---------- בניית הדוח ---------- */
function buildReport(sections){
  const now = new Date();
  const dateHe = now.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const all = sections.flatMap(s=>s.findings);
  const high = all.filter(f=>f.sev==='high');
  const med  = all.filter(f=>f.sev==='med');
  const low  = all.filter(f=>f.sev==='low');

  const roles = sections.find(s=>s.name==="סריקת זהויות ומסכים");
  const reg   = sections.find(s=>s.name==="בדיקות רגרסיה");

  let md = `# 🛡️ דוח יומי — אפליקציית טייסת 124\n\n**${dateHe}**\n\n`;

  /* שורה תחתונה בראש — מה שצריך לדעת ב-10 שניות */
  if(high.length===0){
    md += `## ✅ שורה תחתונה: הכל תקין\n\n`;
    md += `לא נמצאה שום תקלה שדורשת טיפול. `;
  } else {
    md += `## ⚠️ שורה תחתונה: ${high.length} ${high.length===1?'נושא דורש':'נושאים דורשים'} טיפול\n\n`;
    high.forEach((f,i)=>{ md += `${i+1}. **${f.title}** — ${f.detail}\n`; });
    md += `\n`;
  }
  if(roles) md += `נסרקו **${roles.summary.identities} זהויות** ו-**${roles.summary.screens} מסכים**`;
  if(reg)   md += `, והורצו **${reg.summary.total} קבצי בדיקה**`;
  md += `.\n\n---\n\n`;

  /* פירוט לפי סוכן */
  for(const s of sections){
    const f = s.findings.slice().sort((a,b)=>SEV_ORDER[a.sev]-SEV_ORDER[b.sev]);
    const bad = f.filter(x=>x.sev!=='info').length;
    md += `## ${s.name}\n\n`;
    md += `> ${bad===0 ? '✅ ללא ממצאים הדורשים טיפול' : `${bad} ממצאים`}\n\n`;
    if(!f.length){ md += `_אין ממצאים._\n\n`; continue; }
    for(const x of f){
      md += `**${SEV_HE[x.sev]} · ${x.title}**${x.area && x.area!==s.name ? ` _(${x.area})_`:''}\n`;
      md += `${x.detail}\n`;
      if(x.where) md += `\`${x.where}\`\n`;
      md += `\n`;
    }
    md += `---\n\n`;
  }

  /* המלצות — מה כדאי לעשות, לפי סדר עדיפות */
  md += `## 📋 מה מומלץ לעשות\n\n`;
  const actions = [...high, ...med].slice(0,6);
  if(!actions.length){
    md += `אין פעולה נדרשת היום. האפליקציה תקינה בכל הבדיקות.\n\n`;
  } else {
    actions.forEach((f,i)=>{ md += `${i+1}. **${f.title}** — ${f.detail.split('.')[0]}.\n`; });
    md += `\n`;
  }
  if(low.length) md += `_בנוסף ${low.length} ממצאים קלים (נגישות, קוד מת, סימוני TODO) — לא דחופים._\n\n`;

  md += `---\n\n`;
  md += `### מה הדוח הזה כן ולא מכסה\n\n`;
  md += `**כן:** כל זהות באפליקציה נבדקת בכניסה אמיתית, כל מסך שגלוי לה נטען ונבדק, `;
  md += `כל מנגנוני הכתיבה (פרסום, חתימה, שמירה) נבדקים מקצה לקצה, ומטענים עוינים מוזרקים כדי לבדוק פרצות בפועל.\n\n`;
  md += `**לא:** הדוח רץ על הקוד, לא על השרת החי. הוא **אינו** מזהה חדירה בזמן אמת ואינו רואה תעבורה אמיתית — `;
  md += `לכך נדרשות התראות מצד Firebase עצמו (ר' \`qa/README.md\`, סעיף "ניטור חי").\n`;
  return { md, high, med, low };
}

/* ---------- ריצה ---------- */
const sections = [];
const t0 = Date.now();
for(const [label, loader] of [
  ["סריקת זהויות", ()=>import('./scan_roles.mjs')],
  ["רגרסיה",       null],
  ["אבטחה",        ()=>import('./scan_security.mjs')],
  ["שיפור",        ()=>import('./scan_quality.mjs')],
]){
  try{
    if(label==="רגרסיה"){ sections.push(await runRegression()); continue; }
    const mod = await loader();
    sections.push(await mod.run());
  }catch(e){
    sections.push({ name:label, summary:{}, findings:[
      {sev:"high", area:label, title:`הסוכן "${label}" נכשל בריצה`, detail:String(e && e.message), where:"qa/"}]});
  }
}
await closeBrowser();

const { md, high } = buildReport(sections);
const stamp = new Date().toISOString().slice(0,10);
mkdirSync(`${ROOT}/qa/reports`, {recursive:true});
const path = `${ROOT}/qa/reports/${stamp}.md`;
writeFileSync(path, md, 'utf8');
writeFileSync(`${ROOT}/qa/reports/latest.md`, md, 'utf8');
console.log(md);
console.error(`\n[דוח נשמר: ${path} · ${Math.round((Date.now()-t0)/1000)} שניות]`);
process.exit(high.length ? 1 : 0);
