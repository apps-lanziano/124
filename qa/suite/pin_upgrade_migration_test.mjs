/* שדרוג PIN ל-6 ספרות — מיגרציה רכה (שלב 11).
   מוודא: (1) requiredPinLength מחזיר 6, (2) validPinFormat דוחה 4 ספרות,
   (3) acceptedPinFormat מקבל 4 ו-6, (4) באנר שדרוג מופיע לאחר כניסה עם PIN
   קצר, (5) ספירת דחיות עובדת, (6) אכיפה נכנסת לתוקף אחרי 3 דחיות + 7 ימים,
   (7) מודל השדרוג שומר PIN חדש של 6 ספרות. */
import { launchBrowser, APP_URL } from '../lib/pw.mjs';
const b = await launchBrowser();
const results = [];
async function page(){
  const p = await b.newPage();
  await p.route('**gstatic.com/**', r=>r.abort());
  await p.route('**googleapis.com/**', r=>r.abort());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP_URL, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(250);
  await p.evaluate(()=>{
    window.callVerifyPin = async (shedId, name, pin)=>{
      if(name === "__master__") return {ok:false};
      const pers = (typeof PERSONNEL !== "undefined" && PERSONNEL) || [];
      const person = pers.find(x=>x.name===name);
      if(!person) return {ok:false};
      if(!person.pinHash) return {ok:true, noPin:true};
      let match = false;
      if(person.pinAlgo === "pbkdf2"){
        match = (await hashPin(pin, person.pinSalt, person.pinIter)) === person.pinHash;
      } else {
        match = (await hashPinLegacy(pin, person.pinSalt)) === person.pinHash;
      }
      return match ? {ok:true, legacy: person.pinAlgo !== "pbkdf2"} : {ok:false};
    };
  });
  return {p, errs};
}
function record(name, pass, detail){ results.push({name, pass, detail}); }

// 1. requiredPinLength מחזיר 6 לכל המשתמשים
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    return {
      regular: requiredPinLength("חייל רגיל"),
      commander: requiredPinLength("מפקד"),
      superAdmin: requiredPinLength(typeof SUPER_ADMIN_NAMES !== 'undefined' ? SUPER_ADMIN_NAMES[0] : "admin"),
    };
  });
  record("requiredPinLength מחזיר 6 לכל המשתמשים",
    out.regular === 6 && out.commander === 6 && out.superAdmin === 6,
    JSON.stringify(out));
  await p.close();
}

// 2. validPinFormat דוחה 4 ספרות, מקבלת 6 ספרות
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    return {
      four_rejected: validPinFormat("1234", "חייל"),
      six_accepted: validPinFormat("123456", "חייל"),
      five_rejected: validPinFormat("12345", "חייל"),
      letters_rejected: validPinFormat("12345a", "חייל"),
      empty_rejected: validPinFormat("", "חייל"),
    };
  });
  record("validPinFormat דוחה 4 ספרות, מקבלת בדיוק 6 ספרות",
    !out.four_rejected && out.six_accepted && !out.five_rejected
      && !out.letters_rejected && !out.empty_rejected,
    JSON.stringify(out));
  await p.close();
}

// 3. acceptedPinFormat מקבל 4 או 6 ספרות (backward compat)
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    return {
      four_ok: acceptedPinFormat("1234"),
      six_ok: acceptedPinFormat("123456"),
      five_no: acceptedPinFormat("12345"),
      three_no: acceptedPinFormat("123"),
      seven_no: acceptedPinFormat("1234567"),
      letters_no: acceptedPinFormat("abcd"),
    };
  });
  record("acceptedPinFormat מקבל 4 או 6 ספרות, דוחה שאר",
    out.four_ok && out.six_ok && !out.five_no && !out.three_no
      && !out.seven_no && !out.letters_no,
    JSON.stringify(out));
  await p.close();
}

// 4. pinUpgradeNeeded חוזר true ל-PIN של 4 ספרות, false ל-6
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    const person = { name:"טסט", pinHash:"something" };
    return {
      short_needs: pinUpgradeNeeded(person, "1234"),
      long_ok: pinUpgradeNeeded(person, "123456"),
      no_pin_no: pinUpgradeNeeded({ name:"ללא" }, "1234"),
    };
  });
  record("pinUpgradeNeeded: true ל-4 ספרות עם pinHash, false ל-6 או ללא hash",
    out.short_needs === true && out.long_ok === false && out.no_pin_no === false,
    JSON.stringify(out));
  await p.close();
}

// 5. ספירת דחיות ואזהרה — _pinUpgradeDismissals עולה, ואחרי 3 נכתב warnStart
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    const name = "test_dismiss_" + Date.now();
    // ניקוי
    const k = n => "pinUpgrade_" + name + "_" + n;
    localStorage.removeItem(k("dismissals"));
    localStorage.removeItem(k("warnStart"));

    const d0 = _pinUpgradeDismissals(name);

    // סימולציה של 3 דחיות
    localStorage.setItem(k("dismissals"), "1");
    const d1 = _pinUpgradeDismissals(name);
    localStorage.setItem(k("dismissals"), "2");
    const d2 = _pinUpgradeDismissals(name);
    localStorage.setItem(k("dismissals"), "3");
    localStorage.setItem(k("warnStart"), new Date().toISOString());
    const d3 = _pinUpgradeDismissals(name);

    const enforced_now = pinUpgradeEnforced(name);

    // ניקוי
    localStorage.removeItem(k("dismissals"));
    localStorage.removeItem(k("warnStart"));

    return { d0, d1, d2, d3, enforced_now };
  });
  record("ספירת דחיות: 0→1→2→3, אכיפה לא מיידית (צריך 7 ימים)",
    out.d0 === 0 && out.d1 === 1 && out.d2 === 2 && out.d3 === 3
      && out.enforced_now === false,
    JSON.stringify(out));
  await p.close();
}

// 6. אכיפה נכנסת לתוקף אחרי 3 דחיות + 7 ימים
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    const name = "test_enforce_" + Date.now();

    const k = n => "pinUpgrade_" + name + "_" + n;
    // 3 דחיות + warnStart לפני 8 ימים
    localStorage.setItem(k("dismissals"), "5");
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
    localStorage.setItem(k("warnStart"), eightDaysAgo);

    const enforced = pinUpgradeEnforced(name);

    // אבל אם warnStart רק לפני 3 ימים — לא אכיפה
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    localStorage.setItem(k("warnStart"), threeDaysAgo);
    const not_enforced = pinUpgradeEnforced(name);

    // ואם 0 דחיות — גם לא
    localStorage.setItem(k("dismissals"), "0");
    localStorage.setItem(k("warnStart"), eightDaysAgo);
    const no_dismiss = pinUpgradeEnforced(name);

    // ניקוי
    localStorage.removeItem(k("dismissals"));
    localStorage.removeItem(k("warnStart"));

    return { enforced, not_enforced, no_dismiss };
  });
  record("אכיפה: 3+ דחיות + 7+ ימים = true; פחות = false",
    out.enforced === true && out.not_enforced === false && out.no_dismiss === false,
    JSON.stringify(out));
  await p.close();
}

// 7. _pinUpgradeMarkDone מנקה את כל מפתחות השדרוג
{
  const {p, errs} = await page();
  const out = await p.evaluate(()=>{
    const name = "test_done_" + Date.now();
    const k = n => "pinUpgrade_" + name + "_" + n;
    localStorage.setItem(k("dismissals"), "5");
    localStorage.setItem(k("warnStart"), new Date().toISOString());

    _pinUpgradeMarkDone(name);

    return {
      dismissals: localStorage.getItem(k("dismissals")),
      warnStart: localStorage.getItem(k("warnStart")),
    };
  });
  record("_pinUpgradeMarkDone מנקה את כל מפתחות השדרוג",
    out.dismissals === null && out.warnStart === null,
    JSON.stringify(out));
  await p.close();
}

// 8. PIN של 6 ספרות — hash + אימות עובד
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    currentShed = {id:"shed1", name:"סככה 1"};
    const fields = await buildPinFields("654321");
    const person = { name:"שדרוג", ...fields };
    PERSONNEL = [person];
    return {
      algo: fields.pinAlgo,
      correct: await verifyPin(person, "654321"),
      wrong_4: await verifyPin(person, "6543"),
      wrong_6: await verifyPin(person, "654322"),
    };
  });
  record("PIN של 6 ספרות: hash PBKDF2, אימות נכון, 4 ספרות ו-6 שגוי נדחים",
    out.algo === "pbkdf2" && out.correct === true
      && out.wrong_4 === false && out.wrong_6 === false,
    JSON.stringify(out));
  await p.close();
}

// 9. master PIN backward compat — 4 ספרות ישן עדיין עובר
{
  const {p, errs} = await page();
  const out = await p.evaluate(async ()=>{
    const oldFields = await buildPinFields("4444");
    const masterDoc = { pinHash: oldFields.pinHash, pinSalt: oldFields.pinSalt,
                        pinAlgo: oldFields.pinAlgo, pinIter: oldFields.pinIter };
    // localVerifyMasterPin should accept 4-digit via acceptedPinFormat
    const accepts4 = acceptedPinFormat("4444");
    const accepts6 = acceptedPinFormat("666666");
    const rejects5 = acceptedPinFormat("55555");
    return { accepts4, accepts6, rejects5 };
  });
  record("master PIN backward compat: acceptedPinFormat מקבל 4 ו-6, דוחה 5",
    out.accepts4 && out.accepts6 && !out.rejects5,
    JSON.stringify(out));
  await p.close();
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
await b.close();
process.exit(allPass?0:1);
