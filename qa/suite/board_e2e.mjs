import { launchBrowser } from '../lib/pw.mjs';
const b = await launchBrowser();
const p = await b.newPage();
await p.route('**gstatic.com/**', r=>r.abort()); await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(300);

const out = await p.evaluate(async ()=>{
  const store = {};
  window.sGetRaw = async k => store[k] ?? null;
  window.sSetRaw = async (k,v) => { store[k]=v; return true; };
  window.toast = (msg)=>{ window._lastToast = msg; };
  window.openWaPrompt = ()=>{ window._waPromptCalled = true; };
  window.logAction = async ()=>{};
  currentShed = { id:"shed1", name:"סככה 1" };
  user = "מפקד בדיקה"; userRole = "מפקד";
  await renderBoard();

  // יוצר קובץ תמונה אמיתי (PNG קטן) ומדמה בחירת קובץ
  const canvas = document.createElement('canvas'); canvas.width=50; canvas.height=50;
  const ctx = canvas.getContext('2d'); ctx.fillStyle='red'; ctx.fillRect(0,0,50,50);
  const blob = await new Promise(res=>canvas.toBlob(res,'image/png'));
  const file = new File([blob], "board.png", {type:"image/png"});
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById('board-input');
  input.files = dt.files;

  window._waPromptCalled = false;
  onBoardFile({ target: input });
  // ההעלאה אסינכרונית (FileReader+Image) — ממתינים
  await new Promise(r=>setTimeout(r, 400));

  const boards = store["shed1_boards_list"];
  return {
    toast: window._lastToast,
    waPromptCalled: window._waPromptCalled,
    boardsSaved: Array.isArray(boards) ? boards.length : boards,
    hasImg: !!store["shed1_board_img_" + (boards && boards[0] && boards[0].id)],
  };
});
console.log("ERRORS:", JSON.stringify(errs));
console.log(JSON.stringify(out,null,2));
await b.close();
