/* תכנון תורנות בסיסית — ריכוז כלל השיבוצים של חיילי הטייסת קדימה (עד
   חצי שנה), בלי קשר לחלוקה לסככות ובלי תלות בלוח השבועי (current/next
   בלבד). מאוחסן בנפרד (basic_duty_schedule, גלובלי — לא scoped לסככה,
   בדיוק כמו roster_custom_rows), ונשאב בהוספה-בלבד לתוך טיוטת עורך הלוח
   (current/next) דרך seedBasicDutyFromPlan — לא דורס שיבוץ קיים, ולא
   נוגע בלוח "שבוע שעבר"/בארכיון. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  isRosterManager = true;
  rosterAllPersonnel = await fetchAllPersonnelByShed();

  // ===== אחסון גלובלי (לא scoped לסככה) =====
  await saveBasicDutyPlan({});
  r.storageEmptyByDefault = Object.keys(await getBasicDutyPlan()).length === 0;
  const rawGlobal = await sGetRaw("basic_duty_schedule");
  const rawScoped = await sGet("basic_duty_schedule");   // לא אמור לשמש בכלל
  r.usesRawGlobalKey = rawGlobal !== undefined; // sGetRaw תמיד מחזיר (גם {}/null), רק בודקים שלא זרק

  // ===== openBasicDutyPlan בונה רשת שבועות ותאריכים אמיתיים =====
  basicDutyPlan = {};
  basicDutyPlanStart = rosterWeekSundayIso("current");
  renderBasicDutyPlan();
  const weekBlocks = document.querySelectorAll("#bdp-body .bdp-week");
  r.rendersWeekBlocks = weekBlocks.length === BASIC_DUTY_PLAN_WEEKS_VISIBLE;
  r.firstWeekMatchesCurrent = document.querySelectorAll("#bdp-body .bdp-grid td").length === ROSTER_EDIT_DAYS.length * BASIC_DUTY_PLAN_WEEKS_VISIBLE;

  // ===== bdpSnapToAnchor: א׳-ד׳ נשארים, ה׳/ו׳/ש׳ מתקפלים לעוגן ה׳ =====
  const sun = rosterWeekSundayIso("current");
  const wed = isoAddDays(sun, 3), thu = isoAddDays(sun, 4), fri = isoAddDays(sun, 5), sat = isoAddDays(sun, 6);
  r.snapKeepsRotatingDay = bdpSnapToAnchor(wed) === wed;
  r.snapKeepsThuAsIs = bdpSnapToAnchor(thu) === thu;
  r.snapFridayToThu = bdpSnapToAnchor(fri) === thu;
  r.snapSaturdayToThu = bdpSnapToAnchor(sat) === thu;

  // ===== הוספת שיבוץ בטווח תאריכים (חוצה שבוע) =====
  basicDutyPlan = {};
  document.getElementById("bdp-add-name").innerHTML = rosterNameOptionsBySquadron();
  document.getElementById("bdp-add-type").innerHTML = BASIC_DUTY_TYPES.map(t=>`<option>${t}</option>`).join("");
  document.getElementById("bdp-add-from").value = wed;                    // רביעי
  document.getElementById("bdp-add-to").value = isoAddDays(sun, 7+1);     // שני בשבוע הבא — טווח של יותר משבוע
  document.getElementById("bdp-add-name").value = "חייל א סככה 2";
  document.getElementById("bdp-add-type").value = "מטבח";
  await applyBasicDutyPlanAdd();
  const plan1 = await getBasicDutyPlan();
  r.addedAcrossMultipleWeeks = !!(plan1[wed] && plan1[thu] && plan1[isoAddDays(sun,7)] && plan1[isoAddDays(sun,8)]);
  // ו׳/ש׳ לא אמורים לקבל מפתח עצמאי — הם מקופלים לתוך ה׳
  r.fridaySaturdayNotIndependentKeys = !plan1[fri] && !plan1[sat];
  r.namePlacedCorrectly = plan1[wed] && plan1[wed].some(x=>x.name==="חייל א סככה 2" && x.type==="מטבח");

  // הוספה חוזרת של אותו טווח לא מכפילה
  await applyBasicDutyPlanAdd();
  const plan2 = await getBasicDutyPlan();
  r.noDuplicateOnReapply = plan2[wed].filter(x=>x.name==="חייל א סככה 2" && x.type==="מטבח").length === 1;

  // ===== הסרת שיבוץ בודד מהתכנון =====
  await removeBasicDutyPlanEntry(wed, 0);
  const plan3 = await getBasicDutyPlan();
  r.removedEntryGone = !(plan3[wed]||[]).some(x=>x.name==="חייל א סככה 2");
  r.emptyDayKeyCleaned = !("__never__" in plan3) && !plan3[wed];   // המפתח נמחק לגמרי כשהרשימה מתרוקנת

  // ===== seedBasicDutyFromPlan: הוספה בלבד, לא דורס, רק current/next =====
  await saveBasicDutyPlan({});
  const planned = { name:"חייל ב סככה 4", type:"אבט״ש" };
  const nextWed = rosterDayLockDates("רביעי", "next")[0];
  await saveBasicDutyPlan({ [nextWed]: [planned] });

  await saveDutyRosterV2(migrateRosterToV2(null), "next");   // "הבא" נקי
  rosterDraft = await getDutyRoster("next");
  rosterEditSlot = "next";
  await seedBasicDutyFromPlan();
  r.seedsIntoNextWeekDraft = (rosterDraft.days["רביעי"].basic||[]).some(b=>b.name===planned.name && b.type===planned.type);

  // לא דורס שיבוץ קיים שכבר יש שם (רק מוסיף, ולא מכפיל את אותו הזוג)
  rosterDraft.days["רביעי"].basic.push({name:"מישהו אחר", type:"רס״ר"});
  await seedBasicDutyFromPlan();
  r.doesNotDuplicateOnSecondSeed = rosterDraft.days["רביעי"].basic.filter(b=>b.name===planned.name).length === 1;
  r.keepsManualAssignment = rosterDraft.days["רביעי"].basic.some(b=>b.name==="מישהו אחר");

  // לא נוגע ב"שבוע שעבר" — רק current/next
  await saveDutyRosterV2(migrateRosterToV2(null), "prev");
  rosterDraft = await getDutyRoster("prev");
  rosterEditSlot = "prev";
  await seedBasicDutyFromPlan();
  r.doesNotSeedIntoPrevWeek = !(rosterDraft.days["רביעי"].basic||[]).length;

  // ===== ניווט מוגבל: לא לפני השבוע הנוכחי, לא מעבר לחצי שנה קדימה =====
  basicDutyPlanStart = rosterWeekSundayIso("current");
  shiftBasicDutyPlan(-1);   // ניסיון לזוז אחורה מהשבוע הנוכחי
  r.navDoesNotGoBeforeToday = basicDutyPlanStart === rosterWeekSundayIso("current");
  for(let i=0;i<20;i++) shiftBasicDutyPlan(1);   // ניסיון לזוז הרבה קדימה
  r.navClampedToHorizon = basicDutyPlanStart <= isoAddDays(rosterWeekSundayIso("current"), BASIC_DUTY_PLAN_HORIZON_DAYS);

  // ===== הבאנר קיים בלוח (renderRosterView) רק למ״ע תורנויות =====
  boardWeekSlot = "current";
  await renderRosterView();
  r.bannerVisibleToManager = !!document.querySelector(".roster-banner.plan");
  isRosterManager = false;
  await renderRosterView();
  r.bannerHiddenFromNonManager = !document.querySelector(".roster-banner.plan");
  isRosterManager = true;

  return r;
});

record("התחברות", login.ok, JSON.stringify(login));
record("אחסון התכנון ריק כברירת מחדל", out.storageEmptyByDefault, String(out.storageEmptyByDefault));
record("🔴 נשמר תחת מפתח גלובלי (sGetRaw), לא scoped לסככה", out.usesRawGlobalKey, String(out.usesRawGlobalKey));
record("openBasicDutyPlan מרנדר 4 שבועות", out.rendersWeekBlocks, String(out.rendersWeekBlocks));
record("כל שבוע מרנדר 5 עמודות ימים (ROSTER_EDIT_DAYS)", out.firstWeekMatchesCurrent, String(out.firstWeekMatchesCurrent));
record("bdpSnapToAnchor: א׳-ד׳ נשארים כמות שהם", out.snapKeepsRotatingDay, String(out.snapKeepsRotatingDay));
record("bdpSnapToAnchor: ה׳ נשאר כמות שהוא", out.snapKeepsThuAsIs, String(out.snapKeepsThuAsIs));
record("bdpSnapToAnchor: ו׳ מתקפל לעוגן ה׳", out.snapFridayToThu, String(out.snapFridayToThu));
record("bdpSnapToAnchor: ש׳ מתקפל לעוגן ה׳", out.snapSaturdayToThu, String(out.snapSaturdayToThu));
record("הוספת טווח חוצה-שבוע נכנסת לכל התאריכים בטווח", out.addedAcrossMultipleWeeks, String(out.addedAcrossMultipleWeeks));
record("🔒 ו׳/ש׳ לא הופכים למפתח עצמאי בתכנון", out.fridaySaturdayNotIndependentKeys, String(out.fridaySaturdayNotIndependentKeys));
record("השם/הסוג נשמרים נכון על התאריך שנבחר", out.namePlacedCorrectly, String(out.namePlacedCorrectly));
record("הוספה חוזרת של אותו טווח לא מכפילה", out.noDuplicateOnReapply, String(out.noDuplicateOnReapply));
record("הסרת שיבוץ בודד מוחקת אותו מהתכנון", out.removedEntryGone, String(out.removedEntryGone));
record("מפתח יום שמתרוקן — נמחק לגמרי (לא נשאר מערך ריק)", out.emptyDayKeyCleaned, String(out.emptyDayKeyCleaned));
record("🔒 seedBasicDutyFromPlan שואב לטיוטת 'הבא'", out.seedsIntoNextWeekDraft, String(out.seedsIntoNextWeekDraft));
record("🔒 שאיבה חוזרת לא מכפילה את אותו שיבוץ", out.doesNotDuplicateOnSecondSeed, String(out.doesNotDuplicateOnSecondSeed));
record("🔒 שאיבה לא דורסת שיבוץ ידני קיים באותו יום", out.keepsManualAssignment, String(out.keepsManualAssignment));
record("🔒 לא שואב ל'שבוע שעבר' — רק current/next", out.doesNotSeedIntoPrevWeek, String(out.doesNotSeedIntoPrevWeek));
record("ניווט לא זז לפני השבוע הנוכחי", out.navDoesNotGoBeforeToday, String(out.navDoesNotGoBeforeToday));
record("ניווט לא חורג מגבול חצי השנה", out.navClampedToHorizon, String(out.navClampedToHorizon));
record("הבאנר מוצג למ״ע תורנויות", out.bannerVisibleToManager, String(out.bannerVisibleToManager));
record("הבאנר מוסתר ממי שאינו מ״ע תורנויות", out.bannerHiddenFromNonManager, String(out.bannerHiddenFromNonManager));

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
