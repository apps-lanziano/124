import { newPage, closeBrowser } from "../lib/harness.mjs";

const t = [];
let pg;
try {
  pg = await newPage();
  const page = pg.page;
  await page.waitForFunction(() => typeof WEEKEND_DUTY_SCHEDULE !== "undefined");

  // 1) WEEKEND_DUTY_SCHEDULE exists and has expected structure
  const schedule = await page.evaluate(() => WEEKEND_DUTY_SCHEDULE);
  const keys = Object.keys(schedule);
  t.push(keys.length === 17
    ? "PASS: schedule has 17 weeks"
    : `FAIL: expected 17 weeks, got ${keys.length}`);

  const w = schedule["2026-09-13"];
  t.push(w && w.lead === "יהונתן פרץ"
    ? "PASS: week 2026-09-13 lead = יהונתן פרץ"
    : `FAIL: unexpected lead for 2026-09-13: ${w?.lead}`);
  t.push(w && w.pf.length === 6
    ? "PASS: week 2026-09-13 has 6 PF"
    : `FAIL: expected 6 PF, got ${w?.pf?.length}`);
  t.push(w && w.tools === "שלום קיסרא"
    ? "PASS: week 2026-09-13 tools = שלום קיסרא"
    : `FAIL: unexpected tools: ${w?.tools}`);

  // 2) seedWeekendDutyFromSchedule seeds Thursday fields for future roster
  const result = await page.evaluate(() => {
    rosterDraft = {
      weekStart: "2026-10-25",
      days: {
        "ראשון": {}, "שני": {}, "שלישי": {}, "רביעי": {},
        "חמישי": { lead: "", tools: "", pf: [] },
        "שישי": {}, "שבת": {}
      }
    };
    rosterEditSlot = "next";
    seedWeekendDutyFromSchedule();
    const thu = rosterDraft.days["חמישי"];
    return { lead: thu.lead, tools: thu.tools, pfCount: thu.pf.length, pfNames: thu.pf.map(x => x.name) };
  });
  t.push(result.lead === "אורי גנור"
    ? "PASS: seeded lead = אורי גנור"
    : `FAIL: expected lead אורי גנור, got ${result.lead}`);
  t.push(result.tools === "שלום סיקרא"
    ? "PASS: seeded tools = שלום סיקרא"
    : `FAIL: expected tools שלום סיקרא, got ${result.tools}`);
  t.push(result.pfCount === 4
    ? "PASS: seeded 4 PF members"
    : `FAIL: expected 4 PF, got ${result.pfCount}`);

  // 3) Does not overwrite existing values
  const result2 = await page.evaluate(() => {
    rosterDraft = {
      weekStart: "2026-10-25",
      days: {
        "ראשון": {}, "שני": {}, "שלישי": {}, "רביעי": {},
        "חמישי": { lead: "שם קיים", tools: "כלים קיים", pf: [{name:"יואב אולשינקה",course:"",reserve:false}] },
        "שישי": {}, "שבת": {}
      }
    };
    rosterEditSlot = "next";
    seedWeekendDutyFromSchedule();
    const thu = rosterDraft.days["חמישי"];
    return { lead: thu.lead, tools: thu.tools, pfCount: thu.pf.length };
  });
  t.push(result2.lead === "שם קיים"
    ? "PASS: did not overwrite existing lead"
    : `FAIL: lead overwritten to ${result2.lead}`);
  t.push(result2.tools === "כלים קיים"
    ? "PASS: did not overwrite existing tools"
    : `FAIL: tools overwritten to ${result2.tools}`);
  t.push(result2.pfCount === 4
    ? "PASS: deduped existing PF, added 3 new"
    : `FAIL: expected 4 PF (1 existing + 3 new), got ${result2.pfCount}`);

  // 4) Does not seed for "current" slot
  const result3 = await page.evaluate(() => {
    rosterDraft = {
      weekStart: "2026-10-25",
      days: {
        "ראשון": {}, "שני": {}, "שלישי": {}, "רביעי": {},
        "חמישי": { lead: "", tools: "", pf: [] },
        "שישי": {}, "שבת": {}
      }
    };
    rosterEditSlot = "current";
    seedWeekendDutyFromSchedule();
    const thu = rosterDraft.days["חמישי"];
    return { lead: thu.lead, pfCount: thu.pf.length };
  });
  t.push(result3.lead === "" && result3.pfCount === 0
    ? "PASS: no seeding for current slot"
    : `FAIL: seeded for current slot: lead=${result3.lead}, pf=${result3.pfCount}`);

  // 5) No seeding for unknown week
  const result4 = await page.evaluate(() => {
    rosterDraft = {
      weekStart: "2027-01-10",
      days: {
        "ראשון": {}, "שני": {}, "שלישי": {}, "רביעי": {},
        "חמישי": { lead: "", tools: "", pf: [] },
        "שישי": {}, "שבת": {}
      }
    };
    rosterEditSlot = "next";
    seedWeekendDutyFromSchedule();
    const thu = rosterDraft.days["חמישי"];
    return { lead: thu.lead, pfCount: thu.pf.length };
  });
  t.push(result4.lead === "" && result4.pfCount === 0
    ? "PASS: no seeding for week outside schedule"
    : `FAIL: seeded for unknown week`);

} catch (e) {
  t.push("FAIL: " + e.message);
}
await closeBrowser();
const fail = t.filter(l => l.startsWith("FAIL"));
console.log(t.join("\n"));
if (fail.length) { console.error("\n" + fail.length + " FAILED"); process.exit(1); }
console.log("\nAll passed ✓");
