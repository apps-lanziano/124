/* חוקי-אצבע ללוח הצוות: מנוע שעוזר למ"ע תורנויות לא לפספס אף חייל.
   סיווג נגזר מהסמכות (PF = הסמכת "PF"; PMS = חייל בלי הסמכת PF; ר"צ לפי
   שיבוץ). מכסות: PF פעמיים (אחת נח) · PMS שלוש (אחת נח) · ר"צ 1–2 ·
   בקורס בלי נח · תורנות בסיסית = אחת. אפור = חייל קרבי שלא שובץ כלל. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const pf = new Set(["פלג","דור","ניר"]);          // מוסמכי PF
  // shedPool: קרביים במסגרת (כולל אחד שלא ישובץ => אפור)
  const pool = [
    {name:"פלג", role:"חייל"}, {name:"דור", role:"חייל"}, {name:"ניר", role:"חייל"},
    {name:"תום", role:"חייל"},   // PMS (אין PF)
    {name:"גיא", role:"חייל"},   // PMS שלא ישובץ => אפור
    {name:"פקיד", role:"חייל", profession:"פקיד כלים"},  // לא נספר לאפור
    {name:"מיל א", role:"חייל", reserve:true},   // מילואים — לא נעקב כלל
    {name:"נהג א", role:"חייל", profession:"נהג מקצועי"},  // נהג — לא נעקב כלל
    {name:"מפקד א", role:"מפקד"},   // מפקד/מנהל — לא נעקב כלל
    {name:"טייס א", role:"חייל", profession:"מטיס"},  // מטיס — לא נעקב כלל
  ];
  const empty = () => migrateRosterToV2(null);
  const r = empty();

  // פלג — PF תקין: תורנות אחת + נח אחד (סה"כ 2, אחת נח)
  r.days["ראשון"].pf = [{name:"פלג"}];
  r.days["שני"].pfRest = ["פלג"];
  // דור — PF חורג: 3 תורנויות בלי נח
  r.days["ראשון"].pf.push({name:"דור"});
  r.days["שני"].pf = [{name:"דור"}];
  r.days["שלישי"].pf = [{name:"דור"}];
  // תום — PMS תקין: 1 תורן + נח (סה"כ 2, אחת נח)
  r.days["ראשון"].pf.push({name:"תום"});
  r.days["שלישי"].pfRest = ["תום"];
  // ניר — ר"צ תקין: יומיים ר"צ
  r.days["ראשון"].lead = "ניר";
  r.days["שני"].lead = "ניר";

  const c = computeRosterCompliance(r, pf, pool);
  const byName = {}; c.rows.forEach(x=>byName[x.name]=x);
  return {
    pfOk:   byName["פלג"] && byName["פלג"].ok && byName["פלג"].cat==="PF",
    pfBad:  byName["דור"] && !byName["דור"].ok && /PF: 3/.test(byName["דור"].reasons.join(" ")),
    pmsOk:  byName["תום"] && byName["תום"].ok && byName["תום"].cat==="PMS",
    leadOk: byName["ניר"] && byName["ניר"].ok && byName["ניר"].cat==="ר\"צ",
    grayHasGuy: c.gray.some(g=>g.name==="גיא"),
    grayExcludesClerk: !c.gray.some(g=>g.name==="פקיד"),
    grayExcludesScheduled: !c.gray.some(g=>g.name==="פלג"),
    okCount: c.okCount, badCount: c.badCount,
    // בדיקת חוק "בקורס בלי נח": חייל בקורס ששובץ נח => חורג
    _courseTest: (()=>{
      const r2 = empty();
      r2.days["ראשון"].pf = [{name:"פלג", course:true}];
      r2.days["שני"].pfRest = ["פלג"];
      const c2 = computeRosterCompliance(r2, pf, pool);
      const row = c2.rows.find(x=>x.name==="פלג");
      return row && !row.ok && /בקורס/.test(row.reasons.join(" "));
    })(),
    // תורנות בסיסית לא נספרת כשיבוץ: תום עם 2 PF + נח + גם בסיסית — עדיין תקין
    // (הבסיסית לא מוסיפה ולא מורידה מהמכסה)
    _basicNotCounted: (()=>{
      const r3 = empty();
      r3.days["ראשון"].pf = [{name:"תום"}];
      r3.days["שלישי"].pfRest = ["תום"];       // 2 סה"כ, אחת נח → PMS תקין
      r3.days["רביעי"].basic = [{name:"תום", type:"מטבח"}];   // בסיסית — לא נספרת
      const c3 = computeRosterCompliance(r3, pf, pool);
      const row = c3.rows.find(x=>x.name==="תום");
      return row && row.ok && row.total===2;
    })(),
    // חייל שמשובץ רק לתורנות בסיסית — לא חריג (תפוס)
    _basicOnlyOk: (()=>{
      const r4 = empty();
      r4.days["ראשון"].basic = [{name:"תום", type:"מטבח"}];
      const c4 = computeRosterCompliance(r4, pf, pool);
      const row = c4.rows.find(x=>x.name==="תום");
      return row && row.ok && row.cat==="תורנות בסיסית";
    })(),
    // מילואים לא נעקב כלל — לא בשורות ולא באפור (שובץ או לא)
    _reserveNotTracked: (()=>{
      const r5 = empty();
      r5.days["ראשון"].reserve = ["מיל א"];       // שובץ
      const c5 = computeRosterCompliance(r5, pf, pool);
      const cEmpty = computeRosterCompliance(empty(), pf, pool);  // לא שובץ
      return !c5.rows.some(x=>x.name==="מיל א") && !c5.gray.some(g=>g.name==="מיל א")
        && !cEmpty.rows.some(x=>x.name==="מיל א") && !cEmpty.gray.some(g=>g.name==="מיל א");
    })(),
    // נהג לא נעקב כלל
    _driverNotTracked: (()=>{
      const c7 = computeRosterCompliance(empty(), pf, pool);
      return !c7.rows.some(x=>x.name==="נהג א") && !c7.gray.some(g=>g.name==="נהג א");
    })(),
    // מפקד/מנהל לא נעקב כלל (גם אם שובץ למשבצת מנהל)
    _commanderNotTracked: (()=>{
      const r8 = empty(); r8.days["ראשון"].manager = "מפקד א";
      const c8 = computeRosterCompliance(r8, pf, pool);
      return !c8.rows.some(x=>x.name==="מפקד א") && !c8.gray.some(g=>g.name==="מפקד א");
    })(),
    // מטיס לא נעקב כלל — גם לפי מקצוע וגם לפי שיבוץ למשבצת מטיס
    _pilotNotTracked: (()=>{
      const r9 = empty(); r9.days["שני"].pilot = "פלג";   // פלג משובץ כמטיס
      const c9 = computeRosterCompliance(r9, pf, pool);
      return !c9.rows.some(x=>x.name==="טייס א")          // לפי מקצוע
        && !c9.rows.some(x=>x.name==="פלג");              // לפי משבצת מטיס
    })(),
    // חופש כל השבוע: לא מופיע כחריג ולא כאפור (אין איפה לצוות)
    _fullWeekVacation: (()=>{
      const cons = { "גיא": [
        {type:"vacation", status:"approved", fromDate:"2000-01-01", toDate:"2100-01-01"},
      ]};
      const c8 = computeRosterCompliance(empty(), pf, pool, cons, "current");
      const inRows = c8.rows.some(x=>x.name==="גיא");
      const inGray = c8.gray.some(g=>g.name==="גיא");
      return !inRows && !inGray;
    })(),
    // משמרת סופ"ש (חמישי) לא נספרת: PF עם 2 בחול + עוד שיבוץ בסופ"ש → עדיין תקין
    _weekendNotCounted: (()=>{
      const r4 = empty();
      r4.days["ראשון"].pf = [{name:"פלג"}];
      r4.days["שני"].pfRest = ["פלג"];      // 2 (אחת נח) → תקין
      r4.days["חמישי"].pf = [{name:"פלג"}]; // סופ"ש — לא אמור להיספר
      const c4 = computeRosterCompliance(r4, pf, pool);
      const row = c4.rows.find(x=>x.name==="פלג");
      return row && row.ok && row.total===2;   // חמישי לא הוסיף
    })(),
    // פקיד כלים — תמיד נח, פטור ממכסות (גם אם שובץ כלים בכל הימים)
    _toolsClerkAlwaysRest: (()=>{
      const r5 = empty();
      r5.days["ראשון"].tools = "פקיד";
      r5.days["שני"].tools   = "פקיד";
      r5.days["שלישי"].tools = "פקיד";
      const c5 = computeRosterCompliance(r5, pf, pool);
      const row = c5.rows.find(x=>x.name==="פקיד");
      return row && row.ok && row.cat==="פקיד כלים" && row.rest===3 && row.duty===0;
    })(),
  };
});

record("התחברות", login.ok, JSON.stringify(login));
record("PF תקין (2, אחת נח) → ירוק", out.pfOk, String(out.pfOk));
record("PF חורג (3 בלי נח) → אדום עם סיבה", out.pfBad, String(out.pfBad));
record("PMS תקין (2, אחת נח) → ירוק", out.pmsOk, String(out.pmsOk));
record("ר\"צ תקין (1–2) → ירוק, סיווג ר\"צ", out.leadOk, String(out.leadOk));
record("אפור: חייל קרבי שלא שובץ מופיע", out.grayHasGuy, String(out.grayHasGuy));
record("אפור: פקיד כלים לא נספר", out.grayExcludesClerk, String(out.grayExcludesClerk));
record("אפור: מי ששובץ לא מופיע כאפור", out.grayExcludesScheduled, String(out.grayExcludesScheduled));
record("בקורס ששובץ נח → חורג", out._courseTest, String(out._courseTest));
record("תורנות בסיסית לא נספרת כשיבוץ (לא מוסיפה למכסה)", out._basicNotCounted, String(out._basicNotCounted));
record("חייל רק בבסיסית → לא חריג (תפוס)", out._basicOnlyOk, String(out._basicOnlyOk));
record("מילואים לא נעקב כלל (לא שורה ולא אפור)", out._reserveNotTracked, String(out._reserveNotTracked));
record("נהג לא נעקב כלל", out._driverNotTracked, String(out._driverNotTracked));
record("מפקד/מנהל לא נעקב כלל", out._commanderNotTracked, String(out._commanderNotTracked));
record("מטיס לא נעקב כלל (מקצוע + משבצת)", out._pilotNotTracked, String(out._pilotNotTracked));
record("חופש כל השבוע → לא חריג ולא אפור", out._fullWeekVacation, String(out._fullWeekVacation));
record("משמרת סופ״ש (חמישי) לא נספרת כשיבוץ", out._weekendNotCounted, String(out._weekendNotCounted));
record("פקיד כלים תמיד נח, פטור ממכסות", out._toolsClerkAlwaysRest, String(out._toolsClerkAlwaysRest));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
