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
  // תום — PMS תקין: 2 תורן + נח (סה"כ 3, אחת נח)
  r.days["ראשון"].pf.push({name:"תום"});
  r.days["שני"].pf.push({name:"תום"});
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
    // תורנות בסיסית = אחת: מי שיש לו בסיסית + עוד תורנות => חורג
    _basicTest: (()=>{
      const r3 = empty();
      r3.days["רביעי"].basic = [{name:"תום", type:"מטבח"}];
      r3.days["ראשון"].pf = [{name:"תום"}];
      const c3 = computeRosterCompliance(r3, pf, pool);
      const row = c3.rows.find(x=>x.name==="תום");
      return row && !row.ok && /בסיסית/.test(row.reasons.join(" "));
    })(),
  };
});

record("התחברות", login.ok, JSON.stringify(login));
record("PF תקין (2, אחת נח) → ירוק", out.pfOk, String(out.pfOk));
record("PF חורג (3 בלי נח) → אדום עם סיבה", out.pfBad, String(out.pfBad));
record("PMS תקין (3, אחת נח) → ירוק", out.pmsOk, String(out.pmsOk));
record("ר\"צ תקין (1–2) → ירוק, סיווג ר\"צ", out.leadOk, String(out.leadOk));
record("אפור: חייל קרבי שלא שובץ מופיע", out.grayHasGuy, String(out.grayHasGuy));
record("אפור: פקיד כלים לא נספר", out.grayExcludesClerk, String(out.grayExcludesClerk));
record("אפור: מי ששובץ לא מופיע כאפור", out.grayExcludesScheduled, String(out.grayExcludesScheduled));
record("בקורס ששובץ נח → חורג", out._courseTest, String(out._courseTest));
record("תורנות בסיסית + עוד תורנות → חורג", out._basicTest, String(out._basicTest));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
