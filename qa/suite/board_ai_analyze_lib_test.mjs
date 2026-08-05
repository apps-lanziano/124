/* ניתוח לוח צוות ע"י AI — בודק את functions/lib/board_ai_analyze.js
   עם fetch מדומה, בלי צורך ברשת אמיתית או במפתח API אמיתי. */
import {
  dataUrlToImageBlock,
  buildAnalysisPrompt,
  parseRosterResponse,
  analyzeBoardImage,
} from '../../functions/lib/board_ai_analyze.js';

const results = [];
function record(name, pass, detail){ results.push({name, pass, detail}); }

// --- 1. dataUrlToImageBlock ---
{
  const ok = dataUrlToImageBlock("data:image/jpeg;base64,QUJD");
  record("data URL תקין מפוצל נכון ל-mediaType+base64Data",
    !!ok && ok.mediaType==="image/jpeg" && ok.base64Data==="QUJD", JSON.stringify(ok));
  const bad = dataUrlToImageBlock("not-a-data-url");
  record("קלט לא תקין מחזיר null (לא זורק חריגה)", bad===null, String(bad));
  const empty = dataUrlToImageBlock("");
  record("מחרוזת ריקה מחזירה null", empty===null, String(empty));
}

// --- 2. buildAnalysisPrompt: מכיל את הנחיות המבנה החיוניות ---
{
  const p = buildAnalysisPrompt();
  const hasDutyRest = p.includes('"duty"') && p.includes('"rest"');
  const hasDays = p.includes('"days"');
  const mentionsHumanReview = p.includes("תיבדק") || p.includes("תאושר");
  const mentionsGreenRule = p.includes("ירוק") && p.includes("נח");
  const mentionsPartialNames = p.includes("שם פרטי בלבד") && p.includes("שם משפחה בלבד");
  record("הפרומפט כולל את מבנה duty/rest/days הנדרש", hasDutyRest && hasDays, JSON.stringify({hasDutyRest, hasDays}));
  record("הפרומפט מבהיר שזו הצעה שתיבדק ע\"י אדם", mentionsHumanReview, String(mentionsHumanReview));
  record("הפרומפט מסביר את כלל הצבע הירוק = תורן נח", mentionsGreenRule, String(mentionsGreenRule));
  record("הפרומפט מבהיר ששמות עשויים להיות חלקיים (פרטי/משפחה בלבד)", mentionsPartialNames, String(mentionsPartialNames));
}

// --- 3. parseRosterResponse: JSON תקין ישיר ---
{
  const text = JSON.stringify({days: {"ראשון": {duty:["דני כהן"], rest:["רותם לוי"]}}});
  const {ok, days, error} = parseRosterResponse(text);
  record("JSON תקין ישיר מפורש בהצלחה", ok && days["ראשון"].duty[0]==="דני כהן", JSON.stringify({ok, days, error}));
}

// --- 4. parseRosterResponse: עטוף ב-```json fences ---
{
  const text = "הנה התשובה:\n```json\n" + JSON.stringify({days:{"שני":{duty:["משה"], rest:[]}}}) + "\n```";
  const {ok, days} = parseRosterResponse(text);
  record("JSON עטוף ב-code fence מפורש בהצלחה", ok && days["שני"].duty[0]==="משה", JSON.stringify(days));
}

// --- 5. parseRosterResponse: JSON לא תקין ---
{
  const {ok, error} = parseRosterResponse("זו לא תשובת JSON בכלל");
  record("טקסט חופשי לא-JSON מוחזר כ-ok:false עם שגיאה, בלי לזרוק חריגה", ok===false && !!error, JSON.stringify({ok, error}));
}

// --- 6. parseRosterResponse: מבנה חסר days ---
{
  const {ok, error} = parseRosterResponse(JSON.stringify({foo:"bar"}));
  record('JSON תקין אך בלי שדה "days" מוחזר כ-ok:false', ok===false && !!error, JSON.stringify({ok, error}));
}

// --- 7. parseRosterResponse: מסנן ערכים לא-מחרוזת וימים ריקים ---
{
  const text = JSON.stringify({days: {
    "רביעי": {duty:["דני", 42, "", "  "], rest:null},
    "חמישי": {duty:[], rest:[]},
  }});
  const {ok, days} = parseRosterResponse(text);
  record("ערכים לא-מחרוזת/ריקים מסוננים מרשימת duty", ok && days["רביעי"].duty.length===1 && days["רביעי"].duty[0]==="דני", JSON.stringify(days));
  record("יום עם duty+rest ריקים לגמרי לא נכלל בתוצאה", !("חמישי" in days), JSON.stringify(days));
}

// --- 8. parseRosterResponse: קלט ריק/לא-מחרוזת ---
{
  const a = parseRosterResponse("");
  const b = parseRosterResponse(undefined);
  record("מחרוזת ריקה מוחזרת כ-ok:false בלי חריגה", a.ok===false, JSON.stringify(a));
  record("undefined מוחזר כ-ok:false בלי חריגה", b.ok===false, JSON.stringify(b));
}

// --- 9. analyzeBoardImage: מסלול מלא עם fetch מדומה שמצליח ---
{
  let capturedUrl = null, capturedOpts = null;
  const fakeFetch = async (url, opts) => {
    capturedUrl = url; capturedOpts = opts;
    return {
      ok: true,
      json: async () => ({content: [{type:"text", text: JSON.stringify({days:{"שישי":{duty:["יוסי מזרחי"], rest:[]}}})}]}),
    };
  };
  const res = await analyzeBoardImage("data:image/jpeg;base64,QUJD", "fake-key", {fetchImpl: fakeFetch});
  record("analyzeBoardImage מחזיר ok:true עם הצעת שיבוץ תקינה", res.ok && res.days["שישי"].duty[0]==="יוסי מזרחי", JSON.stringify(res));
  record("הבקשה נשלחת לכתובת ה-API הנכונה", capturedUrl === "https://api.anthropic.com/v1/messages", String(capturedUrl));
  const body = JSON.parse(capturedOpts.body);
  const imgBlock = body.messages[0].content.find(c=>c.type==="image");
  record("גוף הבקשה כולל את התמונה בקידוד base64 הנכון", !!imgBlock && imgBlock.source.data==="QUJD" && imgBlock.source.media_type==="image/jpeg", JSON.stringify(imgBlock));
  record("המפתח נשלח בכותרת x-api-key ולא בגוף הבקשה", capturedOpts.headers["x-api-key"]==="fake-key" && !JSON.stringify(body).includes("fake-key"), JSON.stringify(capturedOpts.headers));
}

// --- 10. analyzeBoardImage: תמונה לא תקינה — נכשל בלי לפנות לרשת בכלל ---
{
  let fetchCalled = false;
  const fakeFetch = async () => { fetchCalled = true; return {ok:true, json: async()=>({})}; };
  const res = await analyzeBoardImage("not-an-image", "fake-key", {fetchImpl: fakeFetch});
  record("data URL לא תקין נכשל מיד בלי לקרוא ל-fetch", res.ok===false && !fetchCalled, JSON.stringify({res, fetchCalled}));
}

// --- 11. analyzeBoardImage: תגובת שגיאה מה-API (למשל מפתח לא תקף / חריגה ממכסה) ---
{
  const fakeFetch = async () => ({ok:false, status:401, text: async()=>"invalid x-api-key"});
  const res = await analyzeBoardImage("data:image/jpeg;base64,QUJD", "bad-key", {fetchImpl: fakeFetch});
  record("שגיאת HTTP מה-API מוחזרת כ-ok:false עם קוד הסטטוס בהודעה", res.ok===false && res.error.includes("401"), JSON.stringify(res));
}

// --- 12. analyzeBoardImage: כשל רשת (fetch זורק) ---
{
  const fakeFetch = async () => { throw new Error("network down"); };
  const res = await analyzeBoardImage("data:image/jpeg;base64,QUJD", "fake-key", {fetchImpl: fakeFetch});
  record("כשל רשת לא מקריס את הפונקציה — מוחזר ok:false", res.ok===false, JSON.stringify(res));
}

console.log("\n=== SUMMARY ===");
let allPass = true;
for(const r of results){
  console.log((r.pass?"✅":"❌"), r.name, "-", r.detail);
  if(!r.pass) allPass = false;
}
console.log(allPass ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPass?0:1);
