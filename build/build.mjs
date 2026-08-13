/* ============================================================
   בניית גרסת ייצור ממוזערת ל-GitHub Pages
   ------------------------------------------------------------
   קורא את index.html (מקור קריא ומתועד), ממזער את בלוק ה-JS
   ואת ה-CSS המוטבעים, ומייצר dist/index.html + העתקת הנכסים.

   חשוב — בטיחות: ה-JS ממוזער *בלי* שינוי שמות (mangle:false) ו*בלי*
   compress, כי האפליקציה קוראת לפונקציות דרך onclick="foo()" במחרוזות
   HTML — compress/mangle היו מסירים/משנים פונקציות ש"נראות" לא בשימוש
   ושוברים את האפליקציה. לכן המזעור מסיר רק הערות ורווחים (הרווח הגדול:
   מאות שורות הערות בעברית), בלי לגעת בלוגיקה.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { minify as terserMinify } from "terser";
import CleanCSS from "clean-css";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist");
const ASSETS = ["manifest.json", "service-worker.js", "firebase-messaging-sw.js", "icons"];

function kb(s){ return (Buffer.byteLength(s, "utf8")/1024).toFixed(0) + "KB"; }

const html = readFileSync(join(ROOT, "index.html"), "utf8");

// --- CSS ---
const styleM = html.match(/<style>([\s\S]*?)<\/style>/);
if(!styleM) throw new Error("לא נמצא בלוק <style> יחיד");
const cssMin = new CleanCSS({ level: 2 }).minify(styleM[1]);
if(cssMin.errors && cssMin.errors.length) throw new Error("CleanCSS: " + cssMin.errors.join("; "));

// --- JS ---
const scriptM = html.match(/<script>([\s\S]*?)<\/script>/);
if(!scriptM) throw new Error("לא נמצא בלוק <script> יחיד");
const jsRes = await terserMinify(scriptM[1], {
  compress: false,       // בלי compress — לא להסיר "קוד לא בשימוש" (onclick במחרוזות)
  mangle: false,         // בלי שינוי שמות — שמות הפונקציות חייבים להישאר לזיהוי מ-onclick
  format: { comments: false },
  module: false,
});
if(jsRes.error) throw jsRes.error;

// --- הרכבה מחדש ---
let out = html
  .replace(styleM[0], "<style>" + cssMin.styles + "</style>")
  .replace(scriptM[0], "<script>" + jsRes.code + "</script>");

if(existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), out, "utf8");
for(const a of ASSETS){
  const src = join(ROOT, a);
  if(existsSync(src)) cpSync(src, join(OUT, a), { recursive: true });
}

console.log("=== בניית dist הושלמה ===");
console.log("  CSS:   " + kb(styleM[1]) + " → " + kb(cssMin.styles));
console.log("  JS:    " + kb(scriptM[1]) + " → " + kb(jsRes.code));
console.log("  index: " + kb(html) + " → " + kb(out));
