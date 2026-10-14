import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  // This function is invoked server-to-server by submit-wl. Require the service-role bearer.
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!serviceKey || req.headers.get("Authorization")!==`Bearer ${serviceKey}`) return json({error:"Não autorizado."},401);
  if(req.method!=="POST") return json({error:"Método não permitido."},405);
  const webhook=Deno.env.get("DISCORD_WL_WEBHOOK_URL");
  if(!webhook) return json({ok:false,warning:"Webhook não configurado."},200);
  try {
    const {event,submission_id,score}=await req.json();
    const db=createClient(Deno.env.get("SUPABASE_URL")!,serviceKey,{auth:{persistSession:false}});
    const {data,error}=await db.from("wl_submissions").select("full_name,age,discord_tag,status").eq("id",submission_id).single();
    if(error || !data) return json({error:"Inscrição não encontrada."},404);
    const content=event==="new_submission"
      ? {username:"Complexo America | WL",embeds:[{title:"📝 Nova inscrição de Whitelist",color:0xef172d,description:"Uma nova candidatura foi recebida para análise.",fields:[{name:"Candidato",value:String(data.full_name).slice(0,100),inline:true},{name:"Idade",value:String(data.age),inline:true},{name:"Discord",value:String(data.discord_tag||"Não informado").slice(0,100),inline:true},{name:"Pontuação",value:`${score ?? 0}/100`,inline:true},{name:"Status",value:"Em análise",inline:true}],footer:{text:"Complexo America RP • Painel da equipe"}}]}
      : {content:"Atualização de whitelist."};
    const r=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(content)});
    if(!r.ok) { console.error("Discord webhook returned",r.status); return json({error:"Falha ao enviar aviso ao Discord."},502); }
    return json({ok:true});
  } catch { return json({error:"Falha ao enviar notificação."},500); }
});