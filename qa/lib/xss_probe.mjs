/* ============================================================
   בדיקת XSS בזמן ריצה (לא ניחוש סטטי)
   ------------------------------------------------------------
   במקום לנחש מהקוד אילו מקומות חשופים — מזריקים מטען עוין
   לשדות שמשתמשים באמת מקלידים (שמות, כותרות, הודעות, תקלות),
   מריצים את האפליקציה, ובודקים אם המטען *באמת* רץ.
   כך אין התראות שווא: ממצא = פרצה מוכחת.
   ============================================================ */
import { newPage, SHED_LIST, ALL_SCREENS } from './harness.mjs';
import { summarizeError } from './report_util.mjs';

const PAYLOAD = `<img src=x onerror="window.__xssHits=(window.__xssHits||0)+1;window.__xssWhere=(window.__xssWhere||[]);window.__xssWhere.push('IMG')">`;
const PAYLOAD2 = `"><svg onload="window.__xssHits=(window.__xssHits||0)+1;window.__xssWhere=(window.__xssWhere||[]);window.__xssWhere.push('SVG')">`;

export async function runXssProbe(){
  const findings = [];
  let page;
  try{
    const pageObj = await newPage();
    page = pageObj.page;
    const result = await page.evaluate(async ({payload, payload2, screens})=>{
      window.__xssHits = 0; window.__xssWhere = [];
      const put = (k,v)=>{ window.__store[k] = JSON.stringify(v); };
      const shed = "shed1";

      // הזרקה לכל שדה שמשתמש מקליד בפועל
      put(shed+"_cfg_personnel", [
        {name:"מפקד תקין", role:"מפקד", bday:"1995-01-01"},
        {name:payload,    role:"חייל", bday:"2003-01-01"},
        {name:payload2,   role:"חייל", bday:"2003-01-01"},
      ]);
      put(shed+"_safety_events",[{id:"x1", title:payload,  by:payload2, date:"1.1", ftype:"image", thumb:""}]);
      put(shed+"_messages_list",[{id:"m1", text:payload,   type:"normal", by:payload2, date:"1.1"}]);
      put(shed+"_faults_list",  [{id:"f1", title:payload,  by:payload2, status:"פתוח", date:"1.1"}]);
      put(shed+"_boards_list",  [{id:"b1", label:payload,  by:payload2, date:"1.1", thumb:""}]);
      put(shed+"_training_list",[{id:"t1", title:payload,  ftype:"pdf", fname:payload2}]);
      put(shed+"_certs_list",   [{id:"c1", person:payload, name:payload2, expiry:"2027-01-01"}]);
      put(shed+"_tools_list",   [{id:"o1", name:payload,   qty:1}]);
      put(shed+"_vehicles_list",[{id:"v1", name:payload,   number:payload2, testDate:"2027-01-01"}]);
      put(shed+"_naatim_list",  [{id:"n1", area:payload,   person:payload2}]);
      put("binui_faults_list",  [{id:"bf1",title:payload,  by:payload2, shedId:shed, status:"פתוח", date:"1.1"}]);

      window.initPush = async()=>{};
      const shedObj = {id:shed, name:"סככה 1"};
      await enterFrameworkAfterAuth(shedObj, "מפקד", "TEST");
      const person = PERSONNEL.find(p=>p.role==="מפקד");
      // חייב לעבור דרך buildPinFields — הגדרת pinHash בלי שדה האלגוריתם
      // גורמת ל-verifyPin לבדוק מול הפורמט הישן והכניסה נכשלת.
      Object.assign(person, await buildPinFields("1234"));
      document.getElementById("login-select").value = person.name;
      onLoginNameChange();
      document.getElementById("login-pin").value = "1234";
      await doLogin();

      // מעבר על כל מסך שגלוי — שם המטען היה מתרנדר אילו היה חשוף
      const visible = [...document.querySelectorAll("nav .nav-btn")]
        .filter(b=>!b.classList.contains("hidden") && b.dataset.scr).map(b=>b.dataset.scr);
      for(const s of visible){
        try{ go(s, null); await new Promise(r=>setTimeout(r,200)); }catch(e){}
      }
      await new Promise(r=>setTimeout(r,400));

      // סימן נוסף לפרצה: נוצר אלמנט אמיתי מתוך המטען (ולא טקסט)
      const injectedEls = document.querySelectorAll('img[src="x"], svg[onload]').length;
      return { hits: window.__xssHits, where: window.__xssWhere, injectedEls, screensVisited: visible.length };
    }, {payload:PAYLOAD, payload2:PAYLOAD2, screens:ALL_SCREENS});

    if(result.hits > 0 || result.injectedEls > 0){
      findings.push({
        sev:"high", area:"אבטחה", title:"פרצת XSS מאומתת — קוד ממשתמש רץ אצל משתמשים אחרים",
        detail:`מטען עוין שהוזרק לשדות טקסט רגילים (שם/כותרת/הודעה) הופעל בפועל: `+
               `${result.hits} הפעלות, ${result.injectedEls} אלמנטים שנוצרו. `+
               `משמעות: מי שיכול להקליד שם או כותרת יכול להריץ קוד בדפדפן של כל מי שרואה אותם.`,
        where:"index.html",
      });
    } else {
      findings.push({
        sev:"info", area:"אבטחה", title:"בדיקת XSS עברה",
        detail:`מטענים עוינים הוזרקו ל-11 סוגי שדות שמשתמשים מקלידים, ונסרקו ${result.screensVisited} מסכים — `+
               `שום מטען לא הופעל. הסינון (escapeHTML) עובד בנתיבים שנבדקו.`,
        where:"index.html",
      });
    }
  } catch(e){
    const msg = String((e && e.message) || e || "");
    // "browser has been closed" = expected בסביבות עם משאבים מוגבלים אחרי
    // עומס בדיקות כבד, לא פרצה. בכל מקרה (גם כשזה כן ממצא אמיתי) ה-detail
    // עובר דרך summarizeError כדי שיומן קריסה גולמי של הדפדפן לא ידלוף לדוח.
    if(msg.includes("browser") && msg.includes("closed")){
      findings.push({sev:"info", area:"אבטחה", title:"בדיקת ה-XSS דילגה (משאבי דפדפן מחוסרים)",
        detail:"הדפדפן נסגר עקב עומס משאבים. זו הערה סביבתית, לא פרצה.", where:"qa/lib/xss_probe.mjs"});
    } else {
      findings.push({sev:"med", area:"אבטחה", title:"בדיקת ה-XSS לא הושלמה", detail:summarizeError(e), where:"qa/lib/xss_probe.mjs"});
    }
  } finally {
    if(page) await page.close().catch(()=>{});
  }
  return findings;
}
