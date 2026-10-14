(() => {
  "use strict";
  const cfg = window.CA_CONFIG || {};
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const form = $("#wlForm");
  const steps = $$(".form-step");
  let currentStep = 0;
  let client = null;
  let lastTrackingCode = "";
  $("#year").textContent = new Date().getFullYear();

  if (window.supabase && cfg.SUPABASE_URL?.startsWith("https://") &&
      !cfg.SUPABASE_URL.includes("SEU-PROJETO") &&
      cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("COLE_SUA")) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }

  ["#discordTop", "#discordHero"].forEach(id => { $(id).href = cfg.DISCORD_INVITE_URL || "#"; });

  function toast(message) {
    const el = $("#toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  function openApplication() {
    $("#application").classList.remove("hidden");
    $("#statusSection").classList.add("hidden");
    $("#application").scrollIntoView({behavior:"smooth"});
  }
  function openStatus() {
    $("#statusSection").classList.remove("hidden");
    $("#application").classList.add("hidden");
    $("#statusSection").scrollIntoView({behavior:"smooth"});
  }
  function closeApplication() { $("#application").classList.add("hidden"); $("#inicio").scrollIntoView({behavior:"smooth"}); }
  $("#startWl").addEventListener("click", openApplication);
  $("#startWl2").addEventListener("click", openApplication);
  $("#startWl3").addEventListener("click", openApplication);
  $("#closeWl").addEventListener("click", closeApplication);
  $$("[data-open-status]").forEach(b => b.addEventListener("click", openStatus));
  $$(".close-status").forEach(b => b.addEventListener("click", () => $("#statusSection").classList.add("hidden")));
  $("#menuToggle").addEventListener("click", () => $("nav").classList.toggle("open"));
  $$(".nav-link").forEach(a => a.addEventListener("click", () => $("nav").classList.remove("open")));

  function showStep(index) {
    currentStep = index;
    steps.forEach((el,i) => el.classList.toggle("active", i === index));
    $$(".step[data-step-label]").forEach((el,i) => el.classList.toggle("active", i === index));
    if (index === 3) fillReview();
  }
  function validateStep(index) {
    let valid = true;
    const fields = $$("input,select,textarea", steps[index]);
    for (const field of fields) {
      if (!field.checkValidity()) { field.reportValidity(); valid = false; break; }
      if (field.name === "rules_read" && field.value !== "yes") {
        field.setCustomValidity("Leia as regras antes de continuar."); field.reportValidity();
        field.setCustomValidity(""); valid = false; break;
      }
    }
    return valid;
  }
  $$(".next-step").forEach(btn => btn.addEventListener("click", () => {
    if (validateStep(currentStep)) showStep(Math.min(currentStep + 1, steps.length - 1));
  }));
  $$(".prev-step").forEach(btn => btn.addEventListener("click", () => showStep(Math.max(currentStep - 1, 0))));

  function formData() {
    const fd = new FormData(form), out = {};
    for (const [k,v] of fd.entries()) if (k !== "confirm_truth") out[k] = typeof v === "string" ? v.trim() : v;
    out.age = Number(out.age);
    return out;
  }
  function fillReview() {
    const d = formData();
    const items = [
      ["Nome", d.full_name], ["Idade", d.age], ["Discord", d.discord_tag || "Não informado"],
      ["Experiência", ({beginner:"Iniciante",under_6_months:"Menos de 6 meses", "6_12_months":"6 a 12 meses",over_1_year:"Mais de 1 ano"})[d.rp_experience] || d.rp_experience],
      ["Personagem", d.character_type], ["Regras", d.rules_read === "yes" ? "Confirmado" : "Não confirmado"],
      ["História", d.character_story], ["Motivação", d.motivation]
    ];
    $("#reviewSummary").replaceChildren(...items.map(([label,value]) => {
      const div=document.createElement("div"), small=document.createElement("small"), b=document.createElement("b");
      small.textContent=label; b.textContent=String(value || "—"); div.append(small,b); return div;
    }));
  }
  function randomTrackingCode() {
    const bytes = new Uint8Array(6); crypto.getRandomValues(bytes);
    return "CA-" + [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
  }
  async function invokeFunction(name, body) {
    if (!client) throw new Error("Configure a URL e a chave anon do Supabase em assets/js/config.js.");
    const { data, error } = await client.functions.invoke(name, { body });
    if (error) {
      let message = error.message || "Falha ao comunicar com o servidor.";
      try { const ctx = error.context; if (ctx && typeof ctx.json === "function") { const j = await ctx.json(); message = j.error || j.message || message; } } catch (_) {}
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!validateStep(3)) return;
    if (!form.confirm_truth.checked) { form.confirm_truth.reportValidity(); return; }
    const btn=$("#submitBtn"), errorEl=$("#formError");
    btn.disabled=true; btn.textContent="ENVIANDO..."; errorEl.textContent="";
    try {
      const d=formData();
      const tracking_code=randomTrackingCode();
      const result=await invokeFunction(cfg.SUBMIT_FUNCTION || "submit-wl", { ...d, tracking_code });
      lastTrackingCode=result.tracking_code || tracking_code;
      $("#trackingCode").textContent=lastTrackingCode;
      $("#successText").textContent=`Sua inscrição foi recebida. Pontuação inicial: ${result.score ?? "calculada"} / 100. Guarde seu código privado.`;
      form.classList.add("hidden"); $("#successPanel").classList.remove("hidden");
      toast("Inscrição enviada com sucesso!");
    } catch(err) {
      errorEl.textContent=err.message || "Não foi possível enviar. Tente novamente mais tarde.";
    } finally { btn.disabled=false; btn.textContent="ENVIAR INSCRIÇÃO ↗"; }
  });
  $("#copyCode").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(lastTrackingCode); toast("Código copiado."); }
    catch (_) { toast("Anote seu código: " + lastTrackingCode); }
  });
  $("#statusForm").addEventListener("submit", async e => {
    e.preventDefault();
    const code=new FormData(e.currentTarget).get("tracking_code").trim().toUpperCase();
    const btn=$("#statusBtn"), result=$("#statusResult");
    btn.disabled=true; btn.textContent="CONSULTANDO..."; result.classList.add("hidden"); result.replaceChildren();
    try {
      const data=await invokeFunction(cfg.STATUS_FUNCTION || "wl-status", { tracking_code: code });
      const statusLabels={pending:"Em análise",approved:"Aprovado",rejected:"Reprovado",interview:"Entrevista solicitada"};
      const status=data.status || "pending";
      const pillClass={pending:"pill-pending",approved:"pill-approved",rejected:"pill-rejected",interview:"pill-interview"}[status] || "pill-pending";
      const title=document.createElement("h3"); title.textContent=statusLabels[status] || "Em análise";
      const pill=document.createElement("span"); pill.className=`status-pill ${pillClass}`; pill.textContent=statusLabels[status] || status;
      const p=document.createElement("p"); p.textContent=`Pontuação: ${Number(data.score ?? 0)} / 100`;
      const date=document.createElement("p"); date.textContent=data.updated_at ? `Última atualização: ${new Date(data.updated_at).toLocaleString("pt-BR")}` : "";
      const note=document.createElement("p"); note.textContent=data.public_note ? `Observação: ${data.public_note}` : "Acompanhe este código para verificar atualizações.";
      result.append(title,pill,p,date,note); result.classList.remove("hidden");
    } catch(err) {
      const p=document.createElement("p"); p.textContent=err.message || "Não foi possível consultar o status. Confira o código.";
      result.append(p); result.classList.remove("hidden");
    } finally { btn.disabled=false; btn.textContent="CONSULTAR STATUS →"; }
  });
})();