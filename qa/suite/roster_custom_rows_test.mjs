/* שורות מותאמות-אישית בלוח צוות תורן: הוספה ידנית ע"י מ"ע תורנויות,
   כולל קביעת מיקום בלוח, הסתרה כשלא מאוישות, ושמירה/קריאה מהאחסון
   בלי איבוד הנתונים (migrateRosterToV2 חייב לשמר שדות custom_<id>). */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};

  // הגדרת שתי שורות מותאמות-אישית: אחת בתחילת הלוח, אחת אחרי "מטיס"
  const rows = [
    {id:"cr_kitchen", label:"רכב תורן", afterKey:"pilot"},
    {id:"cr_first",   label:"תדריך בוקר", afterKey:"__start__"},
  ];
  await saveRosterCustomRows(rows);
  r.savedLoaded = rosterCustomRows.length === 2;

  // שורה ריקה (אין שיבוץ באף יום) — לא מוצגת בלוח
  const empty = migrateRosterToV2(null);
  empty.days["ראשון"].pilot = "מטיס א";
  const htmlEmpty = rosterBoardHtml(empty, "", "wide");
  r.emptyCustomHidden = !htmlEmpty.includes("רכב תורן") && !htmlEmpty.includes("תדריך בוקר");

  // שיבוץ שם בשורה המותאמת-אישית — מוצגת עם השם, ובמיקום הנכון
  const draft = migrateRosterToV2(null);
  draft.days["ראשון"].pilot = "מטיס א";
  draft.days["ראשון"]["custom_cr_kitchen"] = ["נהג תורן א"];
  draft.days["שני"]["custom_cr_first"] = ["קצין תורן א"];
  const html = rosterBoardHtml(draft, "", "wide");
  r.customShown = html.includes("רכב תורן") && html.includes("נהג תורן א");
  r.customShown2 = html.includes("תדריך בוקר") && html.includes("קצין תורן א");
  const idx = s => html.indexOf(s);
  r.afterPilotPos = idx(">מטיס<") < idx("רכב תורן") && idx("רכב תורן") < idx(">נהג<");
  r.startPos = idx("תדריך בוקר") < idx(">מנהל<");

  // migrateRosterToV2 משמר custom_<id> אחרי שמירה וקריאה חוזרת (לא נמחק)
  const ok = await saveDutyRosterV2(draft);
  const reread = await getDutyRoster();
  r.saved = ok !== false;
  r.persistedAfterReread = Array.isArray(reread.days["ראשון"]["custom_cr_kitchen"]) &&
    reread.days["ראשון"]["custom_cr_kitchen"].includes("נהג תורן א");

  // עריכת שורה קיימת (שינוי תווית ומיקום) דרך טופס הניהול
  rosterCustomRowEditId = "cr_kitchen";
  document.getElementById("roster-customrows-modal") // ודא שהמודל קיים ב-DOM לפני רינדור טופס
    ?.classList.add("open");
  renderRosterCustomRowsMgr();
  document.getElementById("roster-customrow-label").value = "רכב תורן מעודכן";
  document.getElementById("roster-customrow-anchor").value = "__start__";
  await saveRosterCustomRowForm();
  r.editedLabel = rosterCustomRows.find(c=>c.id==="cr_kitchen").label === "רכב תורן מעודכן";
  r.editedAnchor = rosterCustomRows.find(c=>c.id==="cr_kitchen").afterKey === "__start__";

  // מחיקת שורה — נעלמת מרשימת ההגדרות
  window.confirm = ()=>true;
  await deleteRosterCustomRow("cr_first");
  r.deleted = rosterCustomRows.length === 1;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("הגדרות שורות מותאמות-אישית נשמרות ונטענות", out.savedLoaded, String(out.savedLoaded));
record("שורה מותאמת-אישית ריקה כל השבוע לא מוצגת", out.emptyCustomHidden, String(out.emptyCustomHidden));
record("שורה מותאמת-אישית מוצגת עם שיבוץ בפועל", out.customShown, String(out.customShown));
record("שורה שנייה (מיקום שונה) מוצגת עם שיבוץ", out.customShown2, String(out.customShown2));
record("מיקום: שורה שעוגנה אחרי 'מטיס' מופיעה שם", out.afterPilotPos, String(out.afterPilotPos));
record("מיקום: שורה שעוגנה בתחילת הלוח מופיעה ראשונה", out.startPos, String(out.startPos));
record("שמירת הלוח הצליחה", out.saved, String(out.saved));
record("שדה custom_<id> נשמר ולא נמחק אחרי קריאה חוזרת (migrateRosterToV2)", out.persistedAfterReread, String(out.persistedAfterReread));
record("עריכת שורה קיימת מעדכנת תווית", out.editedLabel, String(out.editedLabel));
record("עריכת שורה קיימת מעדכנת מיקום", out.editedAnchor, String(out.editedAnchor));
record("מחיקת שורה מסירה אותה מההגדרות", out.deleted, String(out.deleted));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
