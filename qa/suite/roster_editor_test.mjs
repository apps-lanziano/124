/* עורך לוח הצוות — הרשאת מ"ע תורנויות ופעולות העריכה.
   ההרשאה נשענת על roster_managers (ברירת מחדל: טל מלכה, דניאל זאורוב)
   או על נע"ת ייעודי — כדי שהחלפת תפקיד לא תדרוש שינוי קוד. */
import { newPage, closeBrowser, loginAsFramework } from '../lib/harness.mjs';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

const { page } = await newPage();
const login = await loginAsFramework(page, "shed1", "מפקד");

const out = await page.evaluate(async ()=>{
  const r = {};
  r.defaults = ROSTER_MANAGERS_DEFAULT.slice();

  // מ"ע התורנויות בפועל מקבל הרשאה מהרשימה, בלי שינוי קוד
  user = "טל מלכה";
  await refreshAreaPermissions();
  r.talIsManager = isRosterManager;

  // מי שאינו ברשימה ואינו משובץ נע"ת — לא מקבל
  user = "חייל אקראי כלשהו";
  await refreshAreaPermissions();
  r.randomIsManager = isRosterManager;

  // נע"ת "מ״ע תורנויות" מעניק את אותה הרשאה (מסלול חלופי, בלי קוד)
  await sSet("naatim_list", [{area:"מ״ע תורנויות", person:"חייל אקראי כלשהו"}]);
  await refreshAreaPermissions();
  r.naatimGrants = isRosterManager;
  await sSet("naatim_list", []);

  // רשימה מותאמת דורסת את ברירת המחדל
  await sSetRaw("roster_managers", ["מישהו אחר"]);
  user = "טל מלכה"; await refreshAreaPermissions();
  r.talAfterOverride = isRosterManager;
  user = "מישהו אחר"; await refreshAreaPermissions();
  r.overrideGrants = isRosterManager;
  await sSetRaw("roster_managers", null);

  // ---- שני הבאנרים למ"ע תורנויות ----
  user = "טל מלכה"; await refreshAreaPermissions();
  go("scr-board", null); await renderBoard();
  const banners = document.querySelectorAll(".roster-mgr-banners .roster-banner");
  r.bannerCount = banners.length;
  const bannerTxt = document.querySelector(".roster-mgr-banners")?.textContent || "";
  r.hasCurBanner = bannerTxt.includes("עריכת לוח נוכחי");
  r.hasFutBanner = bannerTxt.includes("בניית לוח עתידי");

  // ---- עריכת לוח נוכחי ----
  await openRosterEditor(null, "current");
  r.editorOpen = document.getElementById("duty-roster-modal").classList.contains("open");
  r.curTitle = document.getElementById("roster-ed-title").textContent;
  document.getElementById("duty-roster-modal").classList.remove("open");

  // ---- בניית לוח עתידי — כותרת וסלוט שונים ----
  await openRosterEditor(null, "next");
  r.futTitle = document.getElementById("roster-ed-title").textContent;
  r.futPublishLabel = document.getElementById("roster-ed-publish").textContent;

  // חוזרים לעריכת הנוכחי להמשך הבדיקות
  await openRosterEditor(null, "current");
  rosterEdDay = "שני";

  // שיבוץ שם למשבצת דרך בורר השמות
  openRosterPick("lead");
  renderRosterPickList();
  r.pickHasNames = rosterPickRows.length > 0;
  rosterPickChoose(0);
  r.leadSet = rosterDraft.days["שני"].lead === r.pickRowName0;
  r.leadValue = rosterDraft.days["שני"].lead;

  // מחזוריות מצב PF: רגיל -> בקורס -> מילואים -> רגיל
  rosterDraft.days["שני"].pf = [{name:"בדיקה"}];
  const states = [];
  for(let i=0;i<4;i++){
    const p = rosterDraft.days["שני"].pf[0];
    states.push(p.course ? "course" : (p.reserve ? "reserve" : "plain"));
    rosterCyclePf(0);
  }
  r.pfCycle = states;

  // "העתק משבוע קודם" ממלא רק ריקים ולא דורס עבודה קיימת
  await sSetRaw("board_roster", {v:2, days:{ "שני":{lead:"ישן", tools:"כלים ישן", fixedAug:["מתגבר ישן"],
    pf:[], pfRest:[], pms:[], pmsRest:[], basic:[{name:"בסיסי ישן", type:"רס״ר"}]}}, squadronDuty:"shed3"});
  rosterDraft.days["שני"].lead = "נשמר";       // כבר מלא — אסור שיידרס
  rosterDraft.days["שני"].tools = "";           // ריק — אמור להתמלא
  await copyRosterFromLastWeek();
  r.copyKeptExisting = rosterDraft.days["שני"].lead === "נשמר";
  r.copyFilledEmpty  = rosterDraft.days["שני"].tools === "כלים ישן";
  r.copySquadron     = rosterDraft.squadronDuty;

  return r;
});

// שם השורה הראשונה בבורר נקרא בנפרד (הוא נקבע בתוך ה-evaluate)
const leadOk = await page.evaluate(()=> !!rosterDraft.days["שני"].lead);

record("התחברות הצליחה", login.ok, JSON.stringify(login));
record("ברירת המחדל היא מ״ע התורנויות בפועל",
  out.defaults.includes("טל מלכה") && out.defaults.includes("דניאל זאורוב"), JSON.stringify(out.defaults));
record("טל מלכה מקבל הרשאת עריכה", out.talIsManager, String(out.talIsManager));
record("חייל אקראי אינו מקבל הרשאה", out.randomIsManager === false, String(out.randomIsManager));
record("נע\"ת \"מ״ע תורנויות\" מעניק הרשאה (מסלול בלי קוד)", out.naatimGrants, String(out.naatimGrants));
record("רשימה מותאמת דורסת את ברירת המחדל",
  out.talAfterOverride === false && out.overrideGrants === true,
  `tal=${out.talAfterOverride} other=${out.overrideGrants}`);
record("שני באנרים מוצגים למ״ע תורנויות", out.bannerCount === 2, String(out.bannerCount));
record("באנר \"עריכת לוח נוכחי\" קיים", out.hasCurBanner, String(out.hasCurBanner));
record("באנר \"בניית לוח עתידי\" קיים", out.hasFutBanner, String(out.hasFutBanner));
record("כותרת עריכת לוח נוכחי", /עריכת לוח נוכחי/.test(out.curTitle||""), out.curTitle);
record("כותרת בניית לוח עתידי", /בניית לוח עתידי/.test(out.futTitle||""), out.futTitle);
record("בלוח עתידי הכפתור הוא \"שמור\" ולא \"פרסם\"", /שמור/.test(out.futPublishLabel||""), out.futPublishLabel);
record("העורך נפתח למ״ע תורנויות", out.editorOpen, String(out.editorOpen));
record("בורר השמות מציג אנשי צוות", out.pickHasNames, String(out.pickHasNames));
record("בחירת שם משבצת אותו במשבצת", leadOk, out.leadValue);
record("מחזוריות PF: רגיל → בקורס → מילואים → רגיל",
  JSON.stringify(out.pfCycle) === JSON.stringify(["plain","course","reserve","plain"]), JSON.stringify(out.pfCycle));
record("\"העתק משבוע קודם\" לא דורס שיבוץ קיים", out.copyKeptExisting, String(out.copyKeptExisting));
record("\"העתק משבוע קודם\" ממלא משבצת ריקה", out.copyFilledEmpty, String(out.copyFilledEmpty));
record("\"העתק משבוע קודם\" מביא גם את תורן הטייסת", out.copySquadron === "shed3", out.copySquadron);

await closeBrowser();

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
