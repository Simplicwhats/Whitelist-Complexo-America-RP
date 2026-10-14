import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Método não permitido."},405);
  try {
    const auth=req.headers.get("Authorization")||"";
    const token=auth.replace(/^Bearer\s+/i,"");
    if(!token)return json({error:"Faça login como membro autorizado da equipe."},401);
    const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
    const {data:userData,error:userError}=await userClient.auth.getUser(token);
    if(userError||!userData.user)return json({error:"Sessão inválida."},401);
    const discordId=userData.user.user_metadata?.provider_id || userData.user.identities?.find((x:any)=>x.provider==="discord")?.identity_data?.sub;
    const allowed=(Deno.env.get("ADMIN_DISCORD_IDS")||"").split(",").map(x=>x.trim()).filter(Boolean);
    if(!discordId || !allowed.includes(String(discordId)))return json({error:"Sua conta não tem permissão de staff."},403);
    const body=await req.json();
    const {submission_id,status,public_note,staff_note}=body;
    if(!submission_id || !["pending","approved","rejected","interview"].includes(status))return json({error:"Dados de atualização inválidos."},400);
    const db=createClient(url,service,{auth:{persistSession:false}});
    const {data:old,error:oldErr}=await db.from("wl_submissions").select("status").eq("id",submission_id).single();
    if(oldErr||!old)return json({error:"Inscrição não encontrada."},404);
    const {error}=await db.from("wl_submissions").update({
      status,
      public_note:typeof public_note==="string"?public_note.slice(0,300):null,
      staff_note:typeof staff_note==="string"?staff_note.slice(0,2000):null,
      reviewer_discord_id:String(discordId)
    }).eq("id",submission_id);
    if(error)return json({error:"Não foi possível atualizar a inscrição."},500);
    await db.from("wl_history").insert({submission_id,previous_status:old.status,new_status:status,actor_discord_id:String(discordId),note:typeof staff_note==="string"?staff_note.slice(0,500):null});
    return json({ok:true});
  } catch {return json({error:"Erro interno."},500);}
});