import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors}); if(req.method!=="POST")return json({error:"Método não permitido."},405);
 try{const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!token)return json({error:"Faça login."},401);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;const auth=createClient(url,anon,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});const {data:{user},error}=await auth.auth.getUser(token);if(error||!user)return json({error:"Sessão inválida."},401);
 const allowed=(Deno.env.get("ADMIN_EMAILS")||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);if(!user.email||!allowed.includes(user.email.toLowerCase()))return json({error:"E-mail não autorizado."},403);
 const d=await req.json();if(typeof d.id!=="string"||!d.id)return json({error:"Inscrição inválida."},400);const allowedStatuses=["awaiting_id_release","id_submitted","released","rejected","interview"];if(!allowedStatuses.includes(d.status))return json({error:"Status inválido."},400);
 const db=createClient(url,service,{auth:{persistSession:false}});const patch:any={status:d.status,public_note:typeof d.public_note==="string"?d.public_note.slice(0,500):null};if(d.fivem_id!==undefined){if(d.fivem_id!==null&&!/^[0-9]{1,20}$/.test(String(d.fivem_id)))return json({error:"ID FiveM inválido."},400);patch.fivem_id=d.fivem_id||null;}const {error:updateError}=await db.from("wl_submissions").update(patch).eq("id",d.id);if(updateError)return json({error:"Não foi possível atualizar a inscrição."},500);await db.from("wl_history").insert({submission_id:d.id,previous_status:null,new_status:d.status,actor_discord_id:null,note:`Atualizado pelo painel por ${user.email}`});return json({ok:true});
 }catch{return json({error:"Erro interno ao atualizar inscrição."},500)}
});
