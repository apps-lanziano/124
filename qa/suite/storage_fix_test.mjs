import { launchBrowser } from '../lib/pw.mjs';
const b = await launchBrowser();
const p = await b.newPage();
await p.route('**gstatic.com/**', r=>r.abort()); await p.route('**googleapis.com/**', r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/124/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(300);
const out = await p.evaluate(async ()=>{
  const o={};
  const store={};

  // --- 1) sSetRaw/sSetSafe honesty: success path ---
  window.fbReady = false;
  window.storage = { set: async ()=>{}, get: async ()=>null };
  o.sSetRaw_success = await sSetRaw("k1","v1");         // window.storage.set succeeds -> true
  o.sSetSafe_success = await sSetSafe("k2","v2");

  // --- 2) failure path: window.storage.set throws ---
  window.storage = { set: async ()=>{ throw new Error("network down"); }, get: async ()=>null };
  o.sSetRaw_fail = await sSetRaw("k3","v3");            // should be false now (was silently swallowed before)
  o.sSetSafe_fail = await sSetSafe("k4","v4");           // should be false now (was ALWAYS true before — the bug)

  // --- 3) publishBoardToAllSheds: one shed fails ---
  let calls = 0;
  window.sGetIn = async ()=>[];
  window.sDelRaw = async ()=>{};
  window.sSetIn = async (shedId,key,val)=>{ calls++; return !(shedId==="shed3"); }; // shed3 fails
  const boardOk = await publishBoardToAllSheds("b1","לוח","thumb","fullimg");
  o.boardPublish_partialFail = boardOk;   // expect false (shed3 failed)

  // all succeed
  window.sSetIn = async ()=> true;
  const boardOk2 = await publishBoardToAllSheds("b2","לוח2","thumb","fullimg");
  o.boardPublish_allOk = boardOk2;        // expect true

  // --- 4) publishEventToAllSheds: same pattern ---
  window.sGetRaw = async ()=>[];
  window.sSetRaw = async ()=> true;    // admin_events write ok
  window.sSetIn = async (shedId)=> !(shedId==="shed2");  // shed2 fails
  const evOk = await publishEventToAllSheds("e1","title",{type:"image",name:"n",mime:"image/png"},"data","thumb");
  o.eventPublish_partialFail = evOk;   // expect false

  window.sSetIn = async ()=> true;
  const evOk2 = await publishEventToAllSheds("e2","title2",{type:"image",name:"n",mime:"image/png"},"data","thumb");
  o.eventPublish_allOk = evOk2;        // expect true

  return o;
});
console.log("ERRORS:", JSON.stringify(errs));
console.log(JSON.stringify(out,null,2));
await b.close();
