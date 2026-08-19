/* "יוזרים מתלוננים שרואים רק חצי מהלוח צוות של שבוע הבא" — שורש הבעיה:
   שורות קבוצתיות (PF/PMS/מילואים/תורנות/מתגבר) מוסתרות בלוח כשאין
   בהן שיבוץ (hasAny ב-rosterBoardHtml), ומ״ע תורנויות עלול לפרסם
   "שבוע הבא" לפני שסיים למלא את כולן — כך שכל הצופים רואים לוח שנראה
   "חצי" (רק שורות השלד קיימות). התיקון: אזהרת-אישור (confirm) לפני
   שהטיוטה נחשפת לכולם, אם שורה שמאוישת בלוח הנוכחי עדיין ריקה בטיוטה
   (ר' confirmRosterCompletenessBeforeVisible, publishFutureRoster,
   saveRosterDraftNext). לא חוסם — רק מוודא אישור מודע. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  try{
  isRosterManager = true;
  window.toast = ()=>{};
  const confirmCalls = [];
  window.confirm = (msg)=>{ confirmCalls.push(msg); return window.__confirmReturn; };

  // לוח נוכחי: מאויש גם ב-PF (שורה קבוצתית), לא רק שלד
  const cur = migrateRosterToV2(null);
  cur.days["ראשון"].lead = "נוכחי";
  cur.days["ראשון"].pf = [{name:"פלוני"}];
  await saveDutyRosterV2(cur, "current");

  // --- טיוטה עתידית חסרה PF: פרסום ראשון עם ביטול ---
  await openRosterEditor(null, "next");
  rosterDraft.days["ראשון"].lead = "טיוטה";
  window.__confirmReturn = false;                     // המשתמש מבטל
  await publishFutureRoster();
  r.warnedOnMissingPf = confirmCalls.length === 1 && confirmCalls[0].includes("PF");
  const afterCancel = await getDutyRoster("next");
  r.publishAbortedOnCancel = afterCancel.published !== true;

  // --- אותה טיוטה, הפעם המשתמש מאשר שהוא מודע לחוסר ---
  confirmCalls.length = 0;
  window.__confirmReturn = true;
  await publishFutureRoster();
  r.publishProceedsOnConfirm = (await getDutyRoster("next")).published === true;
  r.confirmCalledAgain = confirmCalls.length === 1;

  // --- טיוטה מלאה (כולל PF) לא מעוררת אזהרה כלל ---
  confirmCalls.length = 0;
  await openRosterEditor(null, "next");
  rosterDraft.days["ראשון"].lead = "טיוטה שנייה";
  rosterDraft.days["ראשון"].pf = [{name:"אלמוני"}];
  window.__confirmReturn = false;   // אם ייקרא confirm בטעות, זה יגרום לביטול שנזהה
  await publishFutureRoster();
  r.noWarningWhenComplete = confirmCalls.length === 0;
  r.publishedWhenComplete = (await getDutyRoster("next")).published === true;

  // --- saveRosterDraftNext: לפני פרסום (private) — אין אזהרה גם אם חסר PF ---
  const priv = migrateRosterToV2(null);
  priv.published = false;
  priv.days["ראשון"].lead = "פרטי";
  await saveDutyRosterV2(priv, "next");
  await openRosterEditor(null, "next");
  rosterDraft.days["ראשון"].lead = "פרטי 2";
  confirmCalls.length = 0;
  await saveRosterDraftNext();
  r.noWarningOnPrivateDraftSave = confirmCalls.length === 0;

  // --- saveRosterDraftNext: אחרי פרסום (גלוי לכולם) — עריכה שמרוקנת PF מזהירה ---
  const pub = migrateRosterToV2(null);
  pub.published = true;
  pub.days["ראשון"].lead = "גלוי";
  pub.days["ראשון"].pf = [{name:"פלוני"}];
  await saveDutyRosterV2(pub, "next");
  await openRosterEditor(null, "next");
  rosterDraft.days["ראשון"].pf = [];    // מרוקן PF בטיוטה שכבר גלויה
  confirmCalls.length = 0;
  window.__confirmReturn = false;
  await saveRosterDraftNext();
  r.warnedOnPublishedDraftEditRemovingPf = confirmCalls.length === 1;
  const afterSaveCancel = await getDutyRoster("next");
  r.saveAbortedOnCancel = afterSaveCancel.days["ראשון"].pf.length === 1;

  }catch(e){ r.error = String(e && (e.stack||e.message||e)); }
  return r;
});

if(out.error) console.log("EVAL ERROR:", out.error);
record("התחברות", login.ok, JSON.stringify(login));
record("פרסום עם PF חסר: מזהיר ומזכיר 'PF'", out.warnedOnMissingPf, String(out.warnedOnMissingPf));
record("פרסום עם PF חסר + ביטול: לא מתפרסם", out.publishAbortedOnCancel, String(out.publishAbortedOnCancel));
record("פרסום עם PF חסר + אישור: כן מתפרסם", out.publishProceedsOnConfirm, String(out.publishProceedsOnConfirm));
record("האזהרה נקראת שוב בניסיון השני", out.confirmCalledAgain, String(out.confirmCalledAgain));
record("טיוטה מלאה: אין אזהרה בכלל", out.noWarningWhenComplete, String(out.noWarningWhenComplete));
record("טיוטה מלאה: מתפרסמת בהצלחה", out.publishedWhenComplete, String(out.publishedWhenComplete));
record("שמירת טיוטה פרטית (טרם פורסמה): אין אזהרה", out.noWarningOnPrivateDraftSave, String(out.noWarningOnPrivateDraftSave));
record("שמירה אחרי פרסום שמרוקנת PF: מזהירה", out.warnedOnPublishedDraftEditRemovingPf, String(out.warnedOnPublishedDraftEditRemovingPf));
record("שמירה אחרי פרסום + ביטול: לא נשמר הריקון", out.saveAbortedOnCancel, String(out.saveAbortedOnCancel));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
