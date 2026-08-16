/* ============================================================
   בניית הדוח — טייסת 124
   ------------------------------------------------------------
   אחריות יחידה: להפוך "מדורים" (תוצרי orchestrator.mjs) לדוח
   מרקדאון בעברית פשוטה + טקסט פוש קצר. לא יודע כלום על
   playwright/Firebase/regex — רק על צורת הממצאים.

   ⚠️ הפרדת פרטיות: buildPublicReport מסנן לפי `section.privacy`
   (מוצהר בכל סוכן, ר' agents/**) — לא לפי שם הסוכן. זה מה שמונע
   מדליפת נתוני טייסת אמיתיים למאגר הציבורי אם מישהו יחליף שם
   סוכן בעתיד.
   ============================================================ */
import { SEV_HE, sortBySeverity } from './lib/severity.mjs';
import { DOMAIN_ORDER, DOMAIN_LABELS } from './registry.mjs';

/* מילון: מונחים מקצועיים -> הסבר בשפה יומיומית.
   הדוח נקרא ע"י מפקד, לא ע"י מתכנת. כל מונח שדורש רקע טכני מקבל
   כאן תרגום שמסביר *מה זה אומר בפועל למשתמשים באפליקציה*. */
const PLAIN = [
  [/\bXSS\b/g,            "הזרקת קוד עוין"],
  [/\bPromise\.all\b/g,   "טעינה במקביל"],
  [/\bFirestore\b/g,      "מסד הנתונים"],
  [/\bרגרסיה\b/g,         "בדיקות חוזרות"],
  [/\bקוד מת\b/g,         "קוד שלא בשימוש"],
];
function plain(s){ return PLAIN.reduce((t,[re,to])=>t.replace(re,to), String(s||"")); }

/* כותרות הסוכנים בשפה פשוטה, לפי מזהה יציב (לא לפי שם עברי) */
const AGENT_PLAIN_NAME = {
  'functional/identity-screens': "בדיקת כל המשתמשים וכל המסכים",
  'functional/regression-suite': "בדיקה שתקלות ישנות לא חזרו",
  'security/xss-live':           "בדיקת הזרקת קוד עוין (חיה)",
  'security/static-audit':       "ביקורת אבטחה על הקוד",
  'security/regression-guards':  "שמירה על תיקוני אבטחה קריטיים",
  'quality/code-health':         "ניקיון וסדר בקוד",
  'quality/performance':         "ביצועים",
};

function trendBadge(f){
  if(f.trend === 'new') return ' · 🆕 חדש';
  if(f.trend === 'continuing') return ` · ↔ ממשיך ${f.trendDays} ${f.trendDays===1?'יום':'ימים'}`;
  return '';
}

export function buildPublicReport(sections, { resolvedCount = 0 } = {}){
  const now = new Date();
  const dateHe = now.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long', year:'numeric'});

  const publicSections = sections.filter(s => s.privacy === 'public' && s.domain !== 'product');
  const all = publicSections.flatMap(s => s.findings);
  const high = all.filter(f=>f.sev==='high');
  const med  = all.filter(f=>f.sev==='med');
  const low  = all.filter(f=>f.sev==='low');

  const idScreens = sections.find(s=>s.id==='functional/identity-screens');
  const regSuite  = sections.find(s=>s.id==='functional/regression-suite');

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
  if(idScreens) md += `- נכנסתי לאפליקציה בתור **כל ${idScreens.summary.identities} סוגי המשתמשים** שיש בה (מפקדים, חיילים, אחראי הדרכה, מ״ע אחזקה, מנהל-על ועוד)\n`;
  if(idScreens) md += `- פתחתי **${idScreens.summary.screens} מסכים** ובדקתי שכולם נטענים ומציגים נתונים\n`;
  if(regSuite)  md += `- הרצתי **${regSuite.summary.total} בדיקות** שמוודאות שתקלות שכבר תוקנו לא חזרו\n`;
  md += `- ניסיתי לפרוץ לאפליקציה בשיטות מוכרות, כדי לוודא שאי אפשר\n`;
  if(resolvedCount) md += `- ✅ ${resolvedCount} ${resolvedCount===1?'ממצא שהיה תלוי אתמול נפתר':'ממצאים שהיו תלויים אתמול נפתרו'} — לא חוזרים היום\n`;
  md += `\n---\n\n`;

  /* פירוט לפי אגף (מה שואלים) → סוכן (איך בודקים) */
  for(const domainKey of DOMAIN_ORDER){
    const domainSections = publicSections.filter(s=>s.domain===domainKey);
    if(!domainSections.length) continue;
    const domainBad = domainSections.reduce((n,s)=>n + s.findings.filter(f=>f.sev!=='info').length, 0);
    md += `## אגף ${DOMAIN_LABELS[domainKey]}\n\n`;
    md += `> ${domainBad===0 ? '✅ הכל תקין' : `${domainBad} ${domainBad===1?'נקודה':'נקודות'} לתשומת לב`}\n\n`;
    for(const s of domainSections){
      const f = sortBySeverity(s.findings);
      const bad = f.filter(x=>x.sev!=='info').length;
      md += `### ${AGENT_PLAIN_NAME[s.id] || s.name}\n\n`;
      md += `> ${bad===0 ? '✅ הכל תקין' : `${bad} ${bad===1?'נקודה':'נקודות'} לתשומת לב`}\n\n`;
      if(!f.length){ md += `_אין מה לדווח._\n\n`; continue; }
      for(const x of f){
        md += `**${SEV_HE[x.sev]} · ${plain(x.title)}${trendBadge(x)}**\n`;
        md += `${plain(x.detail)}\n\n`;
      }
    }
    md += `---\n\n`;
  }

  /* רעיונות לשדרוג — שיפוט אנושי, לא נבדק אוטומטית. ראו
     agents/product/upgrade_ideas.mjs להסבר למה זה קטע נפרד. */
  const productSection = sections.find(s=>s.domain==='product');
  const ideas = productSection ? productSection.findings : [];
  if(ideas.length){
    md += `## רעיונות לשדרוג\n\n`;
    md += `_אלה לא ממצאי סריקה — הצעות מוצר שנכתבות ומתעדכנות בסקירה אנושית של האפליקציה, כדי שהדוח תמיד יכלול גם רעיונות ולא רק ניקיון קוד._\n\n`;
    ideas.forEach((idea,i)=>{
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
           `נבדקו ${idScreens?idScreens.summary.identities:0} סוגי משתמשים ו-${idScreens?idScreens.summary.screens:0} מסכים. לא נמצאה שום תקלה.` +
           (med.length ? `\n(${med.length} הצעות לשיפור בדוח המלא)` : ``);
  } else {
    push = `⚠️ אפליקציית טייסת 124 — ${high.length===1?'נמצאה תקלה':`נמצאו ${high.length} תקלות`}\n` +
           high.slice(0,3).map((f,i)=>`${i+1}. ${plain(f.title)}`).join('\n') +
           `\nהפירוט בדוח המצורף.`;
  }
  return { md, push, high, med, low };
}

/* מוסיף לדוח הציבורי את פרק הנתונים החיים (אישי — פרטי הטייסת עצמה).
   נקרא רק על ידי run_daily.mjs לבניית הדוח האישי, לעולם לא נכתב לדוח
   הציבורי/למייל. הזיהוי לפרטיות הוא לפי section.privacy — לא לפי שם. */
export function buildPersonalAddendum(sections){
  const dataSection = sections.find(s=>s.domain==='data' && s.privacy==='personal');
  if(!dataSection || !dataSection.findings.length) return { addendum:"", highFindings:[] };

  let addendum = `\n---\n\n## 🔒 בדיקת הנתונים האמיתיים של הטייסת\n\n`;
  addendum += `> _הפרק הזה אינו נשמר במאגר הציבורי._\n\n`;
  for(const f of sortBySeverity(dataSection.findings)){
    addendum += `**${SEV_HE[f.sev]} · ${f.title}**\n${f.detail}\n\n`;
  }
  const highFindings = dataSection.findings.filter(f=>f.sev==='high');
  return { addendum, highFindings, skipped: !!dataSection.skipped };
}
