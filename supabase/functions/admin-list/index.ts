import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return json({error:"Método não permitido."},405);
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!token)return json({error:"Faça login para acessar o painel."},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authClient=createClient(url,anon,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});const {data:{user},error}=await authClient.auth.getUser(token);if(error||!user)return json({error:"Sessão inválida."},401);
  const allowed=(Deno.env.get("ADMIN_EMAILS")||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);if(!user.email||!allowed.includes(user.email.toLowerCase()))return json({error:"Este e-mail não está autorizado para acessar as inscrições."},403);
  const db=createClient(url,service,{auth:{persistSession:false}});const {data,error:dbError}=await db.from("wl_submissions").select("id,full_name,age,discord_tag,rules_read,rp_experience,character_type,character_story,motivation,q_metagaming,q_value_life,q_rdm,q_powergaming,q_conflict,q_bug,q_approach,q_injury,q_disconnect,q_community,score,status,created_at,updated_at,public_note").order("created_at",{ascending:false}).limit(500);
  if(dbError){console.error("admin list query failed");return json({error:"Não foi possível carregar as inscrições."},500)}return json({submissions:data||[]});
 }catch{return json({error:"Erro interno ao carregar o painel."},500)}
});
