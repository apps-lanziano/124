/* ============================================================
   המטה — מריץ את כל הסוכנים לפי המרשם
   ------------------------------------------------------------
   אחריות יחידה: לטעון כל סוכן, להריץ אותו, ולהחזיר "מדור" אחיד
   (agent meta + summary + findings) לכל אחד — כולל טיפול בכשל
   טעינה/ריצה כדי שסוכן שקורס לא יפיל את כל הריצה היומית.
   בניית הדוח בפועל (report.mjs) לא יודעת שום דבר על playwright,
   Firebase, או regex — היא רק מקבלת "מדורים" ומרנדרת אותם.
   ============================================================ */
import { AGENT_LOADERS } from './registry.mjs';

export async function runAllAgents(){
  const sections = [];
  for(const load of AGENT_LOADERS){
    let agent;
    try{
      agent = (await load()).default;
    }catch(e){
      sections.push({
        id:'unknown', name:'סוכן לא נטען', domain:'functional', kind:'static', privacy:'public',
        summary:{}, findings:[{sev:'high', area:'מטה', title:'סוכן נכשל בטעינה', detail:String(e && e.message)}],
      });
      continue;
    }
    try{
      const result = await agent.run();
      sections.push({
        id:agent.id, name:agent.name, domain:agent.domain, kind:agent.kind, privacy:agent.privacy,
        skipped: !!result.skipped,
        summary: result.summary || {},
        findings: result.findings || [],
      });
    }catch(e){
      sections.push({
        id:agent.id, name:agent.name, domain:agent.domain, kind:agent.kind, privacy:agent.privacy,
        summary:{}, findings:[{sev:'high', area:agent.name, title:`הסוכן "${agent.name}" נכשל בריצה`, detail:String(e && e.message)}],
      });
    }
  }
  return sections;
}
