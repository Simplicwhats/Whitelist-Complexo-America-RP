import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-supabase-api-version","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const questions=["q_metagaming", "q_value_life", "q_powergaming", "q_rdm", "q_vdm", "q_combatlog", "q_failrp", "q_meta_voice", "q_bug", "q_nvl", "q_rp_scene", "q_injury", "q_disconnect", "q_ooc_ic", "q_safezone", "q_revenge", "q_pov", "q_character", "q_robbery", "q_community"];
async function sha256(s:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors}); if(req.method!=="POST")return json({error:"Método não permitido."},405);
 try{
  const d=await req.json();const required=["full_name","age","fivem_id","rules_read","rp_experience","character_type","character_story","motivation","tracking_code",...questions];
  for(const k of required)if(d[k]===undefined||d[k]===null||String(d[k]).trim()==="")return json({error:`Campo obrigatório ausente: ${k}`},400);
  if(typeof d.full_name!=="string"||d.full_name.trim().length<3||d.full_name.length>80)return json({error:"Informe um nome válido."},400);
  if(!Number.isInteger(Number(d.age))||Number(d.age)<13||Number(d.age)>99)return json({error:"Idade inválida."},400);
  if(typeof d.fivem_id!=="string"||!/^[0-9]{1,20}$/.test(d.fivem_id.trim()))return json({error:"Informe o ID numérico do FiveM."},400);
  if(d.rules_read!=="yes")return json({error:"Leia e confirme as regras antes de enviar."},400);
  if(typeof d.character_story!=="string"||d.character_story.trim().length<30||d.character_story.length>1200)return json({error:"A história deve ter entre 30 e 1200 caracteres."},400);
  if(typeof d.motivation!=="string"||d.motivation.trim().length<20||d.motivation.length>800)return json({error:"A motivação deve ter entre 20 e 800 caracteres."},400);
  if(!/^CA-[A-F0-9]{12}$/.test(String(d.tracking_code)))return json({error:"Código de acompanhamento inválido."},400);
  for(const k of questions)if(!["correct","wrong1","wrong2"].includes(d[k]))return json({error:"Uma das respostas selecionadas é inválida."},400);
  const score=questions.reduce((n,k)=>n+(d[k]==="correct"?5:0),0);const status=score>=80?"awaiting_id_release":"rejected";
  const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;const db=createClient(url,key,{auth:{persistSession:false}});
  const {data,error}=await db.from("wl_submissions").insert({tracking_code_hash:await sha256(d.tracking_code),full_name:d.full_name.trim(),age:Number(d.age),discord_tag:typeof d.discord_tag==="string"?d.discord_tag.trim().slice(0,80)||null:null,fivem_id:d.fivem_id.trim(),rules_read:true,rp_experience:String(d.rp_experience).slice(0,40),character_type:String(d.character_type).slice(0,40),character_story:d.character_story.trim(),motivation:d.motivation.trim(),...Object.fromEntries(questions.map(k=>[k,d[k]])),score,status,public_note:status==="awaiting_id_release"?"Aprovado na whitelist; aguardando a equipe liberar o ID do FiveM.":"Reprovado automaticamente: é necessário acertar pelo menos 16 das 20 questões."}).select("id").single();
  if(error){console.error("insert submission failed",error.code);return json({error:error.code==="23505"?"Não foi possível registrar. Gere uma nova inscrição e tente novamente.":"Não foi possível salvar sua inscrição."},500)}
  await db.from("wl_history").insert({submission_id:data.id,previous_status:null,new_status:status,note:`Correção automática: ${score}/100.`});
  return json({ok:true,tracking_code:d.tracking_code,score,status});
 }catch{console.error("submit-wl unexpected error");return json({error:"Erro inesperado. Tente novamente."},500)}
});
