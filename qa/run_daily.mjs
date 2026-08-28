/* ============================================================
   מפעיל הסוכנים — דוח יומי, טייסת 124
   ------------------------------------------------------------
   מריץ את כל הסוכנים ומייצר דוח אחד בעברית:
     1. סריקת זהויות ומסכים  — נכנס בתור כל משתמש ובודק כל מסך
     2. בדיקות רגרסיה         — כל מנגנוני הכתיבה הקריטיים
     3. אבטחת מידע            — פרצות, כולל בדיקת XSS חיה
     4. שיפור וייעול          — ביצועים, קוד מת, שמירה על תיקונים
     5. UX ומוצר              — חיפוש אקטיבי של הזדמנויות שיפור בחוויית המשתמש

   הרצה:  node qa/run_daily.mjs
   פלט:   qa/reports/YYYY-MM-DD.md  (+ הדפסה למסך)
   קוד יציאה: 1 אם יש ממצא חמור, 0 אחרת.
   ============================================================ */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { closeBrowser } from './lib/harness.mjs';
import { summarizeError, stripAnsi } from './lib/report_util.mjs';
import { IDEAS as UPGRADE_IDEAS } from './improvement_ideas.mjs';

import { ROOT } from './lib/pw.mjs';   // שורש המאגר — נגזר, לא מקובע
const SEV_ORDER = { high:0, med:1, low:2, info:3 };
const SEV_HE = { high:"🔴 חמור", med:"🟠 בינוני", low:"🟡 קל", info:"🔵 מידע" };

/* תיאור כשל של בדיקה, בשפה שאפשר לקרוא בדוח.
   פלט הבדיקה עלול להכיל צבעי טרמינל ורעש של כלים חיצוניים
   (firebase-tools מדפיס "Shutting down emulators" אחרי השגיאה עצמה),
   ולכן: מנקים ANSI, מעדיפים שורות ❌, ואחריהן שורת Error אמיתית. */
function testFailureDetail(e){
  const out = stripAnsi(((e.stdout||'')+''+(e.stderr||'')).toString());
  const lines = out.split('\n').map(l=>l.trim()).filter(Boolean);
  const failed = lines.filter(l=>l.includes('❌')).slice(0,3);
  if(failed.length) return failed.join(' | ');
  const errLine = lines.find(l=>/^Error:/.test(l) || /Error:/.test(l));
  if(errLine) return errLine.slice(0,300);
  return lines.slice(-3).join(' | ').slice(0,300) || "כשל ללא פלט";
}

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
  let pass=0, fail=0, skip=0;
  for(const f of files){
    try{
      const out = stripAnsi(execFileSync('node', [`${dir}/${f}`], { timeout: 180000, stdio:'pipe' }).toString());
      // בדיקה שדילגה על עצמה מרצון (סביבה חסרה — למשל JDK 21 שנדרש
      // ל-Firebase Emulator). לא כשל של האפליקציה, אבל גם לא "עברה":
      // מדווח כהערה קלה כדי שלא ייעלם בשקט. ר' qa/lib/java_check.mjs.
      const skipLine = out.split('\n').find(l=>l.startsWith('QA_SKIP:'));
      if(skipLine){
        skip++;
        findings.push({sev:"low", area:"רגרסיה", title:`בדיקה לא רצה בסביבה הזו: ${f}`,
          detail: `${skipLine.replace(/^QA_SKIP:\s*/, '')}. אין כאן תקלה באפליקציה — הבדיקה פשוט לא הורצה, ולכן גם לא אישרה שהכל תקין.`,
          where:`qa/suite/${f}`});
      } else pass++;
    }catch(e){
      fail++;
      findings.push({sev:"high", area:"רגרסיה", title:`בדיקה נכשלה: ${f}`,
        detail: testFailureDetail(e), where:`qa/suite/${f}`});
    }
  }
  if(!fail) findings.push({sev:"info", area:"רגרסיה", title:"כל בדיקות הרגרסיה עברו",
    detail:`${pass} קבצי בדיקה, כולם ירוקים — כל מנגנוני הכתיבה הקריטיים תקינים.`
      + (skip ? ` (${skip} בדיקות לא הורצו בסביבה הזו — ר' הערות למטה.)` : ''), where:"qa/suite"});
  return { name:"בדיקות רגרסיה", summary:{ pass, fail, skip, total:files.length }, findings };
}

/* מילון: מונחים מקצועיים -> הסבר בשפה יומיומית.
   הדוח נקרא ע"י מפקד, לא ע"י מתכנת. כל מונח שדורש רקע טכני מקבל
   כאן תרגום שמסביר *מה זה אומר בפועל למשתמשים באפליקציה*. */
/* רק החלפות שעומדות בפני עצמן בכל הקשר. מונחים שדורשים ניסוח
   מחדש של המשפט כולו (SRI, PBKDF2, salt וכו') נכתבים בשפה פשוטה
   כבר במקור, בסורק עצמו — החלפת מילה בודדת שם ייצרה עברית שבורה
   מסוג "מ-שרת חיצוני" ו"שיטת הצפנה רגילה יחיד". */
const PLAIN = [
  [/\bXSS\b/g,            "הזרקת קוד עוין"],
  [/\bPromise\.all\b/g,   "טעינה במקביל"],
  [/\bFirestore\b/g,      "מסד הנתונים"],
  [/\bרגרסיה\b/g,         "בדיקות חוזרות"],
  [/\bקוד מת\b/g,         "קוד שלא בשימוש"],
];
function plain(s){ return PLAIN.reduce((t,[re,to])=>t.replace(re,to), String(s||"")); }

/* כותרות הסוכנים בשפה פשוטה */
const SECTION_PLAIN = {
  "סריקת זהויות ומסכים": "בדיקת כל המשתמשים וכל המסכים",
  "בדיקות רגרסיה":       "בדיקה שתקלות ישנות לא חזרו",
  "אבטחת מידע":          "אבטחה",
  "שיפור וייעול":        "הצעות לשיפור",
  "UX ומוצר":            "UX ומוצר — הזדמנויות שיפור",
};

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

  let md = `# הדוח היומי של אפליקציית טייסת 124\n\n**${dateHe}**\n\n`;

  /* השורה הראשונה — מה שצריך לדעת ב-10 שניות, בלי מונחים */
  if(high.length===0){
    md += `## ✅ הכל תקין\n\n`;
    md += `בדקתי את האפליקציה מקצה לקצה ולא מצאתי שום תקלה. אין צורך לעשות כלום.\n\n`;
  } else {
    md += `## ⚠️ ${high.length===1?'נמצאה תקלה אחת':`נמצאו ${high.length} תקלות`}\n\n`;
    high.forEach((f,i)=>{ md += `**${i+1}. ${plain(f.title)}**\n${plain(f.detail)}\n\n`; });
  }

  md += `### מה נבדק היום\n\n`;
  if(roles) md += `- נכנסתי לאפליקציה בתור **כל ${roles.summary.identities} סוגי המשתמשים** שיש בה (מפקדים, חיילים, אחראי הדרכה, מ״ע אחזקה, מנהל-על ועוד)\n`;
  if(roles) md += `- פתחתי **${roles.summary.screens} מסכים** ובדקתי שכולם נטענים ומציגים נתונים\n`;
  if(reg)   md += `- הרצתי **${reg.summary.total} בדיקות** שמוודאות שתקלות שכבר תוקנו לא חזרו\n`;
  md += `- ניסיתי לפרוץ לאפליקציה בשיטות מוכרות, כדי לוודא שאי אפשר\n`;
  md += `\n---\n\n`;

  /* פירוט לפי סוכן */
  for(const s of sections){
    const f = s.findings.slice().sort((a,b)=>SEV_ORDER[a.sev]-SEV_ORDER[b.sev]);
    const bad = f.filter(x=>x.sev!=='info').length;
    md += `## ${SECTION_PLAIN[s.name] || s.name}\n\n`;
    md += `> ${bad===0 ? '✅ הכל תקין' : `${bad} ${bad===1?'נקודה':'נקודות'} לתשומת לב`}\n\n`;
    if(!f.length){ md += `_אין מה לדווח._\n\n`; continue; }
    for(const x of f){
      md += `**${SEV_HE[x.sev]} · ${plain(x.title)}**\n`;
      md += `${plain(x.detail)}\n\n`;
    }
    md += `---\n\n`;
  }

  /* רעיונות לשדרוג — שיפוט אנושי, לא נבדק אוטומטית. ראו improvement_ideas.mjs
     להסבר למה זה קטע נפרד מ"הצעות לשיפור" (שם רק ניקיון קוד אוטומטי). */
  if(UPGRADE_IDEAS.length){
    md += `## רעיונות לשדרוג\n\n`;
    md += `_אלה לא ממצאי סריקה — הצעות מוצר שנכתבות ומתעדכנות בסקירה אנושית של האפליקציה, כדי שהדוח תמיד יכלול גם רעיונות ולא רק ניקיון קוד._\n\n`;
    UPGRADE_IDEAS.forEach((idea,i)=>{
      md += `**${i+1}. ${idea.title}** _(${idea.effort})_\n${idea.detail}\n\n`;
    });
    md += `---\n\n`;
  }

  /* המלצות */
  md += `## מה מומלץ לעשות\n\n`;
  const actions = [...high, ...med].slice(0,6);
  if(!actions.length){
    md += `שום דבר. האפליקציה עברה את כל הבדיקות.\n\n`;
  } else {
    actions.forEach((f,i)=>{ md += `${i+1}. **${plain(f.title)}** — ${plain(f.detail.split('.')[0])}.\n`; });
    md += `\n`;
  }
  if(low.length) md += `_יש עוד ${low.length} הערות קטנות שלא דחופות._\n\n`;

  md += `---\n\n`;
  md += `### מה הבדיקה הזו לא מכסה\n\n`;
  md += `הבדיקה רצה על הקוד של האפליקציה — לא על השרת החי. `;
  md += `כלומר היא **לא רואה** אם מישהו מנסה לפרוץ ברגע זה, ולא רואה את הנתונים האמיתיים של הטייסת. `;
  md += `כדי לקבל התראה על ניסיון חדירה בזמן אמת צריך להפעיל את ההתראות של Firebase עצמו — כתוב איך ב-\`qa/README.md\`.\n`;

  /* גרסה קצרה לפוש — מה שנכנס להתראה בטלפון */
  let push;
  if(high.length===0){
    push = `✅ אפליקציית טייסת 124 — הכל תקין\n` +
           `נבדקו ${roles?roles.summary.identities:0} סוגי משתמשים ו-${roles?roles.summary.screens:0} מסכים. לא נמצאה שום תקלה.` +
           (med.length ? `\n(${med.length} הצעות לשיפור בדוח המלא)` : ``);
  } else {
    push = `⚠️ אפליקציית טייסת 124 — ${high.length===1?'נמצאה תקלה':`נמצאו ${high.length} תקלות`}\n` +
           high.slice(0,3).map((f,i)=>`${i+1}. ${plain(f.title)}`).join('\n') +
           `\nהפירוט בדוח המצורף.`;
  }
  return { md, push, high, med, low };
}

/* ---------- ריצה ---------- */
const sections = [];
const t0 = Date.now();
for(const [label, loader] of [
  ["סריקת זהויות", ()=>import('./scan_roles.mjs')],
  ["רגרסיה",       null],
  ["אבטחה",        ()=>import('./scan_security.mjs')],
  ["שיפור",        ()=>import('./scan_quality.mjs')],
  ["UX ומוצר",     ()=>import('./scan_ux.mjs')],
  ["נתונים חיים",  ()=>import('./scan_live.mjs')],
]){
  try{
    if(label==="רגרסיה"){ sections.push(await runRegression()); continue; }
    const mod = await loader();
    sections.push(await mod.run());
  }catch(e){
    sections.push({ name:label, summary:{}, findings:[
      {sev:"high", area:label, title:`הסוכן "${label}" נכשל בריצה`, detail:summarizeError(e), where:"qa/"}]});
  }
}
await closeBrowser();

/* ⚠️ הפרדת פרטיות — המאגר ציבורי.
   ממצאי הנתונים החיים נוגעים לטייסת עצמה (כמה אנשים, איזו מסגרת
   לא מקבלת התראות) ולכן אינם נשמרים במאגר. הדוח הציבורי מכיל רק
   את בדיקות הקוד; הממצאים החיים נכתבים לקובץ נפרד שמוחרג מגיט
   ומגיע רק לדוח האישי. */
const liveSection   = sections.find(s=>s.name==="נתונים חיים");
const publicSections = sections.filter(s=>s.name!=="נתונים חיים");

const { md, push, high } = buildReport(publicSections);
const stamp = new Date().toISOString().slice(0,10);
mkdirSync(`${ROOT}/qa/reports`, {recursive:true});
writeFileSync(`${ROOT}/qa/reports/${stamp}.md`, md, 'utf8');
writeFileSync(`${ROOT}/qa/reports/latest.md`, md, 'utf8');

/* הדוח האישי = דוח הקוד + פרק הנתונים החיים */
let personal = md;
let liveHigh = [];
if(liveSection && liveSection.findings.length){
  liveHigh = liveSection.findings.filter(f=>f.sev==="high");
  personal += `\n---\n\n## 🔒 בדיקת הנתונים האמיתיים של הטייסת\n\n`;
  personal += `> _הפרק הזה אינו נשמר במאגר הציבורי._\n\n`;
  const order = {high:0, med:1, low:2, info:3};
  for(const f of liveSection.findings.slice().sort((a,b)=>order[a.sev]-order[b.sev])){
    personal += `**${SEV_HE[f.sev]} · ${f.title}**\n${f.detail}\n\n`;
  }
}
writeFileSync(`${ROOT}/qa/reports/latest_personal.md`, personal, 'utf8');

const allHigh = [...high, ...liveHigh];
const pushText = liveHigh.length
  ? `⚠️ אפליקציית טייסת 124 — ${allHigh.length} ${allHigh.length===1?'תקלה':'תקלות'}\n` +
    allHigh.slice(0,3).map((f,i)=>`${i+1}. ${f.title}`).join('\n') + `\nהפירוט בדוח המצורף.`
  : push;
writeFileSync(`${ROOT}/qa/reports/latest_push.txt`, pushText, 'utf8');

console.log(personal);

/* שורת אבחון בטוחה ללוג. הלוג של מאגר ציבורי גלוי לכולם, ולכן
   מדווחים כאן רק על מצב החיבור וכמות הממצאים — בלי שום פרט על
   הטייסת עצמה (לא שמות מסגרות, לא מספרים, לא כותרות). */
if(liveSection){
  const state = liveSection.skipped ? "לא הוגדר מפתח"
    : liveSection.findings.some(f=>f.title.includes("החיבור ל-Firebase נכשל")) ? "החיבור נכשל"
    : "התחבר בהצלחה";
  console.error(`[נתונים חיים: ${state} · ${liveHigh.length} ממצאים חמורים]`);
}
console.error(`[דוח נשמר · ${Math.round((Date.now()-t0)/1000)} שניות]`);
process.exit(allHigh.length ? 1 : 0);
