/* ============================================================
   ניתוח תמונת "לוח צוות שבועי" ע"י Claude (Vision) — מזהה הצעת
   שיבוץ תורנויות מתוך התמונה, אבל לא כותב שום דבר בעצמו. הלקוח
   מקבל את ההצעה וממלא איתה מראש את עורך השיבוץ הקיים (אותו עורך
   שממלאים בו ידנית) — שמירה בפועל ל-board_roster (המסמך שממנו
   dutyRosterDigest שולח התראות אמיתיות למפקדים) קורית רק כשאדם
   לוחץ "שמור שיבוץ" בעצמו, אחרי שבדק/תיקן. שום נתיב כאן לא "שותל"
   תוצאה ישירות להתראות חיות בלי אישור אדם.

   fetchImpl ניתן להזרקה כדי לבדוק את הלוגיקה כאן במלואה בלי רשת
   אמיתית (אותה גישה כמו fake-db בשאר lib/*_test.mjs). */

const WEEK_DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// יש לוודא מול console.anthropic.com/docs/models שזהו עדיין מזהה מודל תקף
// בעל יכולת ראייה לפני הפעלה בפרודקשן — מזהי מודלים מתעדכנים מדי פעם.
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

/* data:<mime>;base64,<...> → {mediaType, base64Data}. null אם הפורמט לא תקין. */
function dataUrlToImageBlock(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || "");
  if (!m) return null;
  return { mediaType: m[1], base64Data: m[2] };
}

/* rosterNames (אופציונלי): רשימת שמות מלאים ומדויקים של אנשי הטייסת,
   שנשלחת כעזר-קריאה כדי שה-AI יתאים אליה במקום "לנחש" איות — בעיקר
   עוזר כשהתמונה היא צילום גיליון Excel עם טקסט מודפס קטן/מטושטש
   (הבהקים, זווית צילום), לא כתב יד. בלי הרשימה, ה-AI מוגבל להעתקה
   מדויקת של הטקסט הנראה, כפי שהיה קודם. */
function buildAnalysisPrompt(rosterNames) {
  const lines = [
    'זו תמונה של "לוח צוות שבועי" של טייסת מסוקים — צילום (או צילום מסך)',
    "של גיליון Excel: טקסט מודפס/מוקלד בתוך תאי טבלה, לא כתב יד. קרא כל",
    "תא בעיון, בהתחשב בפגמי צילום אפשריים (הבהק, זווית, רזולוציה,",
    "רשת התאים של הגיליון) — לא בקשיי פענוח כתב יד.",
    'זהה מתוכה מי משובץ כ"צוות תורן" ומי כ"תורן נח" בכל אחד מימות השבוע',
    "(ראשון עד שבת).",
    "- כלל הצבע: שם בתא שצבע הרקע שלו ירוק משמעו שהאדם ב\"תורן נח\" (rest).",
    '  תא בצבע רגיל (לא ירוק) הוא בצוות התורן הפעיל (duty).',
    "- שמות בגיליון עשויים להיות כתובים בשם פרטי בלבד, בשם משפחה בלבד, או שם מלא.",
  ];
  if (Array.isArray(rosterNames) && rosterNames.length) {
    lines.push(
      "",
      "להלן רשימת השמות המלאים והמדויקים של אנשי הטייסת (עזר קריאה בלבד —",
      "לא כולם בהכרח מופיעים בלוח השבוע הזה):",
      rosterNames.map((n) => `- ${n}`).join("\n"),
      "",
      "עבור כל שם שאתה קורא בתא: אם יש התאמה ברורה וחד-משמעית לשם מהרשימה",
      "למעלה — כתוב את השם המלא המדויק כפי שהוא מופיע ברשימה (לא מה שאתה",
      "חושב שכתוב בתא, אלא הצורה המדויקת מהרשימה). אם אינך בטוח לאיזה שם",
      "ברשימה הוא מתאים, או שהוא לא נראה תואם לאף אחד מהם — כתוב בדיוק את",
      "הטקסט כפי שהוא נראה בתא, בלי לנחש התאמה לא ודאית לרשימה.",
    );
  } else {
    lines.push(
      "  כתוב בדיוק את הטקסט כפי שהוא מופיע בגיליון, בלי לתקן איות ובלי",
      "  להשלים בעצמך לשם מלא (השלמת השם המלא מול רשימות הצוות תתבצע בשלב נפרד).",
    );
  }
  lines.push(
    "השב אך ורק ב-JSON תקין (בלי טקסט נוסף, בלי הסברים, בלי markdown),",
    "במבנה המדויק הבא:",
    '{"days": {"ראשון": {"duty": ["שם", "..."], "rest": ["שם", "..."]}, "שני": {...}, ..., "שבת": {...}}}',
    "- יום שלא מופיע בגיליון או ריק — השמט אותו או השאר מערכים ריקים.",
    "- אם אינך בטוח בזיהוי שם מסוים, כלול אותו כפי שנראה לך הכי סביר —",
    "  זו הצעה בלבד שתיבדק ותאושר ע\"י אדם לפני שהיא משמשת בפועל.",
  );
  return lines.join("\n");
}

/* טקסט התשובה של Claude → {ok, days, error}. מטפל בעטיפת ```json```,
   JSON לא תקין, ומבנה לא צפוי — בלי לזרוק חריגה, כי כשל כאן אמור
   להוביל להודעת "מלא ידנית", לא לקריסה. */
function parseRosterResponse(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, days: {}, error: "תשובה ריקה מה-AI" };
  }
  let jsonText = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(jsonText);
  if (fenced) jsonText = fenced[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, days: {}, error: "התשובה מה-AI לא הייתה JSON תקין" };
  }

  const rawDays = parsed && typeof parsed === "object" ? parsed.days : null;
  if (!rawDays || typeof rawDays !== "object") {
    return { ok: false, days: {}, error: 'מבנה התשובה לא תואם (חסר שדה "days")' };
  }

  const days = {};
  for (const day of WEEK_DAYS_HE) {
    const entry = rawDays[day];
    const clean = (arr) =>
      Array.isArray(arr) ? arr.filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim()) : [];
    const duty = clean(entry && entry.duty);
    const rest = clean(entry && entry.rest);
    if (duty.length || rest.length) days[day] = { duty, rest };
  }
  return { ok: true, days, error: null };
}

/* קריאה בפועל ל-API של Claude וניתוח התשובה. apiKey מגיע מ-Secret של
   Firebase (ANTHROPIC_API_KEY) — לא נשמר ולא נגזר בקוד. */
async function analyzeBoardImage(imageDataUrl, apiKey, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const model = opts.model || DEFAULT_MODEL;
  const rosterNames = opts.rosterNames;

  const block = dataUrlToImageBlock(imageDataUrl);
  if (!block) return { ok: false, days: {}, error: "פורמט תמונה לא תקין" };

  let res;
  try {
    res = await fetchImpl(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: block.mediaType, data: block.base64Data } },
              { type: "text", text: buildAnalysisPrompt(rosterNames) },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, days: {}, error: "כשל ברשת בפנייה ל-API של Claude" };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, days: {}, error: `שגיאה מה-API של Claude (${res.status}): ${errText.slice(0, 300)}` };
  }

  const data = await res.json();
  const text = data && Array.isArray(data.content) && data.content[0] && data.content[0].text;
  return parseRosterResponse(text);
}

module.exports = {
  WEEK_DAYS_HE,
  ANTHROPIC_API_URL,
  DEFAULT_MODEL,
  dataUrlToImageBlock,
  buildAnalysisPrompt,
  parseRosterResponse,
  analyzeBoardImage,
};
