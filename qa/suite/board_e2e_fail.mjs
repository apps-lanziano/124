import { launchBrowser } from '../lib/pw.mjs';
const b = await launchBrowser();
const p = await b.newPage();
await p.route('**gstatic.com/**', r=>r.abort()); await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(300);

const out = await p.evaluate(async ()=>{
  const store = {};
  // מדמה כשל רשת אמיתי: fbReady=false, ו-window.storage.set נכשל (בדיוק המצב שגרם לבאג בשטח)
  window.fbReady = false;
  window.storage = { set: async ()=>{ throw new Error("network down"); }, get: async ()=>null };
  window.toast = (msg)=>{ window._toasts = window._toasts||[]; window._toasts.push(msg); };
  window.openWaPrompt = ()=>{ window._waPromptCalled = true; };
  window.logAction = async ()=>{};
  currentShed = { id:"shed1", name:"סככה 1" };
  user = "מפקד בדיקה"; userRole = "מפקד";
  await renderBoard();

  const canvas = document.createElement('canvas'); canvas.width=50; canvas.height=50;
  const ctx = canvas.getContext('2d'); ctx.fillStyle='blue'; ctx.fillRect(0,0,50,50);
  const blob = await new Promise(res=>canvas.toBlob(res,'image/png'));
  const file = new File([blob], "board.png", {type:"image/png"});
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById('board-input');
  input.files = dt.files;

  window._waPromptCalled = false; window._toasts = [];
  onBoardFile({ target: input });
  await new Promise(r=>setTimeout(r, 400));

  return {
    toasts: window._toasts,
    waPromptCalled: window._waPromptCalled,   // חייב להיות false — לא "מצליחים" לשתף לוואטסאפ אם השמירה נכשלה
  };
});
console.log("ERRORS:", JSON.stringify(errs));
console.log(JSON.stringify(out,null,2));
await b.close();
