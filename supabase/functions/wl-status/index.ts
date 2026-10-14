import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{...corsHeaders,"Content-Type":"application/json"}});
async function sha256(text:string) {
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async req => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"Método não permitido."},405);
  try {
    const {tracking_code}=await req.json();
    if(typeof tracking_code!=="string" || !/^CA-[A-F0-9]{12}$/i.test(tracking_code.trim())) return json({error:"Código inválido. Confira o código recebido após a inscrição."},400);
    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const hash=await sha256(tracking_code.trim().toUpperCase());
    const {data,error}=await db.from("wl_submissions").select("score,status,public_note,updated_at").eq("tracking_code_hash",hash).maybeSingle();
    if(error) { console.error("status lookup failed"); return json({error:"Não foi possível consultar o status."},500); }
    if(!data) return json({error:"Inscrição não encontrada. Verifique o código digitado."},404);
    return json(data);
  } catch { return json({error:"Não foi possível consultar o status."},500); }
});