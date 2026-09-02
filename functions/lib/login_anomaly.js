/* ============================================================
   login_anomaly — זיהוי דפוסי כניסה חריגים
   ------------------------------------------------------------
   לוגיקה טהורה: מקבלת רשימת אירועי כניסה כושלת ומחזירה התראות
   אם יש דפוס חשוד. נבדקת בלי emulator/Admin SDK אמיתי.
   ============================================================ */

const FAILED_THRESHOLD = 10;
const WINDOW_MINUTES = 15;

function detectAnomalies(events) {
  const alerts = [];
  const byIp = {};

  for (const ev of events) {
    const key = ev.ip || "unknown";
    if (!byIp[key]) byIp[key] = [];
    byIp[key].push(ev);
  }

  for (const [ip, ipEvents] of Object.entries(byIp)) {
    if (ipEvents.length >= FAILED_THRESHOLD) {
      const codes = new Set(ipEvents.map(e => e.code).filter(Boolean));
      alerts.push({
        type: "brute_force",
        ip,
        attempts: ipEvents.length,
        uniqueCodes: codes.size,
        firstSeen: ipEvents[0].ts,
        lastSeen: ipEvents[ipEvents.length - 1].ts,
      });
    }
  }

  const codeAttempts = {};
  for (const ev of events) {
    const c = ev.code || "?";
    if (!codeAttempts[c]) codeAttempts[c] = 0;
    codeAttempts[c]++;
  }
  for (const [code, count] of Object.entries(codeAttempts)) {
    if (count >= FAILED_THRESHOLD) {
      alerts.push({
        type: "targeted_code",
        code,
        attempts: count,
      });
    }
  }

  return alerts;
}

function buildAlertMessage(alerts) {
  if (!alerts.length) return null;
  const lines = ["⚠️ התראת אבטחה — טייסת 124\n"];
  for (const a of alerts) {
    if (a.type === "brute_force") {
      lines.push(`🔴 ניסיון פריצה מ-IP ${a.ip}: ${a.attempts} ניסיונות כושלים, ${a.uniqueCodes} קודים שונים`);
    } else if (a.type === "targeted_code") {
      lines.push(`🟠 ניסיונות חוזרים על קוד ${a.code}: ${a.attempts} פעמים`);
    }
  }
  return lines.join("\n");
}

module.exports = { detectAnomalies, buildAlertMessage, FAILED_THRESHOLD, WINDOW_MINUTES };
