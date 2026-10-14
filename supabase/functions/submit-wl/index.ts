import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function scoreAnswers(d: Record<string, any>) {
  let score = 0;
  for (const key of ["q_metagaming", "q_value_life", "q_conflict", "q_bug"]) {
    if (d[key] === "correct") score += 20;
  }
  score += d.character_story.length >= 80 ? 10 : 6;
  score += d.motivation.length >= 60 ? 10 : 6;
  return Math.min(100, score);
}
function sha256(text: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    .then(buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join(""));
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const d = await req.json();
    const required = ["full_name","age","rules_read","rp_experience","character_type","character_story","q_metagaming","q_value_life","q_conflict","q_bug","motivation","tracking_code"];
    for (const k of required) if (d[k] === undefined || d[k] === null || String(d[k]).trim() === "") return json({ error: `Campo obrigatório ausente: ${k}` }, 400);
    if (typeof d.full_name !== "string" || d.full_name.trim().length < 3 || d.full_name.length > 80) return json({ error: "Informe um nome válido." }, 400);
    if (!Number.isInteger(Number(d.age)) || Number(d.age) < 13 || Number(d.age) > 99) return json({ error: "Idade inválida." }, 400);
    if (d.rules_read !== "yes") return json({ error: "Leia e confirme as regras antes de enviar." }, 400);
    if (typeof d.character_story !== "string" || d.character_story.trim().length < 30 || d.character_story.length > 1200) return json({ error: "A história deve ter entre 30 e 1200 caracteres." }, 400);
    if (typeof d.motivation !== "string" || d.motivation.trim().length < 20 || d.motivation.length > 800) return json({ error: "A motivação deve ter entre 20 e 800 caracteres." }, 400);
    if (!/^CA-[A-F0-9]{12}$/.test(String(d.tracking_code))) return json({ error: "Código de acompanhamento inválido." }, 400);
    for (const k of ["discord_tag","discord_id"]) if (d[k] && String(d[k]).length > 80) return json({ error: "Campo Discord muito longo." }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const codeHash = await sha256(d.tracking_code);
    const score = scoreAnswers(d);
    const { data, error } = await db.from("wl_submissions").insert({
      tracking_code_hash: codeHash,
      full_name: d.full_name.trim(),
      age: Number(d.age),
      discord_tag: d.discord_tag?.trim() || null,
      discord_id: d.discord_id?.trim() || null,
      rules_read: true,
      rp_experience: d.rp_experience,
      character_type: d.character_type,
      character_story: d.character_story.trim(),
      q_metagaming: d.q_metagaming,
      q_value_life: d.q_value_life,
      q_conflict: d.q_conflict,
      q_bug: d.q_bug,
      motivation: d.motivation.trim(),
      score,
      status: "pending"
    }).select("id").single();
    if (error) {
      console.error("insert submission failed", error.code);
      return json({ error: error.code === "23505" ? "Não foi possível registrar a inscrição. Gere uma nova inscrição e tente novamente." : "Não foi possível salvar sua inscrição." }, 500);
    }
    await db.from("wl_history").insert({ submission_id: data.id, previous_status: null, new_status: "pending", note: "Inscrição recebida automaticamente." });

    // O envio de aviso é opcional e executado por outra função que lê o webhook em segredo.
    try {
      await fetch(`${url}/functions/v1/discord-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey },
        body: JSON.stringify({ event: "new_submission", submission_id: data.id, score })
      });
    } catch (e) { console.error("notification request failed"); }

    return json({ ok: true, tracking_code: d.tracking_code, score });
  } catch (e) {
    console.error("submit-wl unexpected error");
    return json({ error: "Erro inesperado. Tente novamente." }, 500);
  }
});