#!/usr/bin/env node
/* מחשב את CACHE_NAME של ה-service worker כפונקציה דטרמיניסטית של תוכן
   index.html (hash), במקום מספר-גרסה שמעלים ידנית ב-1. פותר מהשורש את
   תקרית ה-2026-08-19: שני סבבי פיתוח מקבילים העלו את המספר בלי לבדוק
   את origin/main בפועל ונחתו על אותה גרסה — service-worker.js שנפרס יצא
   זהה בייטים למה שכבר רץ אצל חלק מהמשתמשים, updatefound אף פעם לא ירה,
   ובאנר "גרסה חדשה זמינה" לא הופיע — משתמשים נשארו תקועים על קוד ישן
   בלי שום התראה. עם hash תלוי-תוכן, כל שינוי אמיתי ל-index.html מייצר
   בהכרח CACHE_NAME שונה, מכל ענף, בלי תלות בזיכרון/היסטוריה מקומית.

   שימוש:
     node scripts/sw-cache-name.mjs           — מדפיס את הערך הנכון
     node scripts/sw-cache-name.mjs --check    — בודק sync מול service-worker.js (exit 1 אם לא תואם)
     node scripts/sw-cache-name.mjs --write    — כותב את הערך הנכון ל-service-worker.js */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const htmlPath = join(root, "index.html");
const swPath = join(root, "service-worker.js");

function computeCacheName(){
  const html = readFileSync(htmlPath);
  const hash = createHash("sha256").update(html).digest("hex").slice(0, 12);
  return `tayeset124-${hash}`;
}

const CACHE_NAME_RE = /const CACHE_NAME = "([^"]*)";/;

function currentCacheName(){
  const sw = readFileSync(swPath, "utf8");
  const m = sw.match(CACHE_NAME_RE);
  if(!m) throw new Error(`לא נמצא CACHE_NAME ב-${swPath}`);
  return m[1];
}

const mode = process.argv[2];
const expected = computeCacheName();

if(mode === "--check"){
  const actual = currentCacheName();
  if(actual !== expected){
    console.error(`❌ CACHE_NAME לא מסונכרן עם תוכן index.html.`);
    console.error(`   קיים:  ${actual}`);
    console.error(`   צפוי:  ${expected}`);
    console.error(`   הרץ: node scripts/sw-cache-name.mjs --write`);
    process.exit(1);
  }
  console.log(`✅ CACHE_NAME מסונכרן (${actual})`);
  process.exit(0);
}

if(mode === "--write"){
  const sw = readFileSync(swPath, "utf8");
  const updated = sw.replace(CACHE_NAME_RE, `const CACHE_NAME = "${expected}";`);
  writeFileSync(swPath, updated);
  console.log(`נכתב: ${expected}`);
  process.exit(0);
}

console.log(expected);
