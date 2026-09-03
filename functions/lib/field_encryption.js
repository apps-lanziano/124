const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(ciphertext, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc, null, "utf8") + decipher.final("utf8");
}

const SENSITIVE_FIELDS = ["phone", "id_number", "address", "medical_profile"];

function encryptSensitiveFields(obj, keyHex) {
  if (!obj || typeof obj !== "object" || !keyHex) return obj;
  const result = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = "ENC:" + encrypt(result[field], keyHex);
    }
  }
  return result;
}

function decryptSensitiveFields(obj, keyHex) {
  if (!obj || typeof obj !== "object" || !keyHex) return obj;
  const result = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] && typeof result[field] === "string" && result[field].startsWith("ENC:")) {
      try {
        result[field] = decrypt(result[field].slice(4), keyHex);
      } catch (_) { /* corrupted — leave as-is */ }
    }
  }
  return result;
}

module.exports = { encrypt, decrypt, encryptSensitiveFields, decryptSensitiveFields, SENSITIVE_FIELDS };
