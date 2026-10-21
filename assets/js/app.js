(() => {
  "use strict";
  const cfg = window.CA_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const form = $("#wlForm"), steps = $$(".form-step");
  let currentStep = 0, client = null, lastTrackingCode = "", quizTimer = null, quizDeadline = 0;
  let questionList = [], activeQuestionKeys = [];
  $("#year").textContent = new Date().getFullYear();
  if (window.supabase && cfg.SUPABASE_URL?.startsWith("https://") && cfg.SUPABASE_ANON_KEY) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  function toast(message) {
    const el = $("#toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  function openApplication() { $("#application").classList.remove("hidden"); $("#statusSection").classList.add("hidden"); $("#application").scrollIntoView({ behavior: "smooth" }); }
  function openStatus() { $("#statusSection").classList.remove("hidden"); $("#application").classList.add("hidden"); $("#statusSection").scrollIntoView({ behavior: "smooth" }); }
  function closeApplication() { $("#application").classList.add("hidden"); $("#inicio").scrollIntoView({ behavior: "smooth" }); }
  $("#startWl").addEventListener("click", openApplication); $("#startWl2").addEventListener("click", openApplication); $("#startWl3").addEventListener("click", openApplication); $("#closeWl").addEventListener("click", closeApplication);
  $("#viewRules").addEventListener("click", () => $("#regras").scrollIntoView({ behavior: "smooth" }));
  $$('[data-open-status]').forEach(b => b.addEventListener("click", openStatus));
  $$(".close-status").forEach(b => b.addEventListener("click", () => $("#statusSection").classList.add("hidden")));
  $("#menuToggle").addEventListener("click", () => $("nav").classList.toggle("open"));
  $$(".nav-link").forEach(a => a.addEventListener("click", () => $("nav").classList.remove("open")));
  function showStep(i) {
    currentStep = i; steps.forEach((el, n) => el.classList.toggle("active", n === i));
    $$(".step[data-step-label]").forEach((el, n) => el.classList.toggle("active", n === i));
    if (i === 2) startQuizTimer(); if (i === 3) fillReview();
  }
  function validateStep(i) {
    for (const field of $$("input,select,textarea", steps[i])) {
      if (!field.checkValidity()) { field.reportValidity(); return false; }
      if (field.name === "rules_read" && field.value !== "yes") {
        field.setCustomValidity("Leia as regras antes de continuar."); field.reportValidity(); field.setCustomValidity(""); return false;
      }
    }
    return true;
  }
  $$(".next-step").forEach(b => b.addEventListener("click", () => { if (validateStep(currentStep)) showStep(Math.min(currentStep + 1, steps.length - 1)); }));
  $$(".prev-step").forEach(b => b.addEventListener("click", () => showStep(Math.max(currentStep - 1, 0))));
  function shuffleArray(items) {
    const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out;
  }
  async function invoke(name, body = {}) {
    if (!client) throw new Error("Configure a URL e a chave pública do Supabase em assets/js/config.js.");
    const { data, error } = await client.functions.invoke(name, { body });
    if (error) { let message = error.message || "Falha ao comunicar com o servidor."; try { if (error.context?.json) { const j = await error.context.json(); message = j.error || j.message || message; } } catch {} throw new Error(data?.error || message); }
    if (data?.error) throw new Error(data.error); return data;
  }
  async function loadQuestions() {
    const container = $("#dynamicQuestions"); container.replaceChildren();
    const msg = document.createElement("p"); msg.className = "muted"; msg.textContent = "Carregando perguntas da whitelist..."; container.append(msg);
    try {
      const result = await invoke(cfg.QUESTIONS_PUBLIC_FUNCTION || "wl-questions-public", {});
      if (!Array.isArray(result.questions) || !result.questions.length) throw new Error("A equipe ainda não cadastrou perguntas ativas.");
      questionList = result.questions; activeQuestionKeys = questionList.map(q => q.question_key); renderQuestions(true);
    } catch (error) {
      container.replaceChildren(); const p = document.createElement("p"); p.className = "form-error"; p.textContent = `${error.message} Atualize a página ou avise a equipe.`; container.append(p); throw error;
    }
  }
  function renderQuestions(clearAnswers = false) {
    const container = $("#dynamicQuestions"); container.replaceChildren();
    const shuffled = shuffleArray(questionList);
    shuffled.forEach((q, index) => {
      const label = document.createElement("label"); label.dataset.questionKey = q.question_key;
      label.append(document.createTextNode(`${index + 1}. ${q.prompt}`));
      const select = document.createElement("select"); select.name = `dynamic_${q.question_key}`; select.required = true;
      const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Selecione uma resposta"; select.append(placeholder);
      shuffleArray(q.options || []).forEach(answer => { const opt = document.createElement("option"); opt.value = answer; opt.textContent = answer; select.append(opt); });
      label.append(select); container.append(label);
    });
    if (!clearAnswers) return;
  }
  function stopQuizTimer() { if (quizTimer) { clearInterval(quizTimer); quizTimer = null; } quizDeadline = 0; sessionStorage.removeItem("ca_wl_quiz_deadline"); const el = document.getElementById("wlTimer"); if (el) el.remove(); }
  function resetQuiz() {
    stopQuizTimer(); form.reset(); $("#successPanel").classList.add("hidden"); form.classList.remove("hidden"); $("#formError").textContent = "";
    renderQuestions(true); showStep(0); toast("Tempo esgotado. A whitelist foi reiniciada e a ordem das perguntas mudou."); $("#application").scrollIntoView({ behavior: "smooth" });
  }
  function startQuizTimer() {
    let saved = Number(sessionStorage.getItem("ca_wl_quiz_deadline") || 0);
    if (!saved || saved <= Date.now()) { saved = Date.now() + 10 * 60 * 1000; sessionStorage.setItem("ca_wl_quiz_deadline", String(saved)); }
    quizDeadline = saved; let el = document.getElementById("wlTimer");
    if (!el) { el = document.createElement("div"); el.id = "wlTimer"; el.className = "wl-timer"; el.setAttribute("role", "timer"); el.setAttribute("aria-live", "polite"); el.innerHTML = "<span>⏱ TEMPO RESTANTE</span><strong></strong>"; $(".form-step[data-step='2'] h2").after(el); }
    if (quizTimer) clearInterval(quizTimer);
    const tick = () => { const left = quizDeadline - Date.now(); if (left <= 0) { resetQuiz(); return; } const m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000); el.querySelector("strong").textContent = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; el.classList.toggle("urgent", left <= 60000); };
    tick(); quizTimer = setInterval(tick, 250);
  }
  $("#dynamicQuestions").addEventListener("copy", e => e.preventDefault());
  function formData() {
    const fd = new FormData(form), out = {};
    for (const [key, value] of fd.entries()) if (key !== "confirm_truth" && !key.startsWith("dynamic_")) out[key] = typeof value === "string" ? value.trim() : value;
    out.age = Number(out.age); out.question_responses = {};
    for (const q of questionList) { const select = form.elements.namedItem(`dynamic_${q.question_key}`); out.question_responses[q.question_key] = select?.value || ""; }
    return out;
  }
  function fillReview() {
    const d = formData(); const items = [["Nome", d.full_name], ["Idade", d.age], ["Discord", d.discord_tag || "Não informado"], ["ID do FiveM", d.fivem_id], ["Experiência", d.rp_experience], ["Personagem", d.character_type], ["História", d.character_story], ["Motivação", d.motivation], ["Questionário", `${questionList.length} questões — aprovação a partir de 80%`]];
    $("#reviewSummary").replaceChildren(...items.map(([label, value]) => { const x = document.createElement("div"), s = document.createElement("small"), b = document.createElement("b"); s.textContent = label; b.textContent = String(value || "—"); x.append(s, b); return x; }));
  }
  function randomTrackingCode() { const bytes = new Uint8Array(6); crypto.getRandomValues(bytes); return "CA-" + [...bytes].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase(); }
  form.addEventListener("submit", async e => {
    e.preventDefault(); if (!validateStep(3)) return; if (!form.confirm_truth.checked) { form.confirm_truth.reportValidity(); return; }
    const btn = $("#submitBtn"), err = $("#formError"); btn.disabled = true; btn.textContent = "ENVIANDO INSCRIÇÃO..."; err.textContent = "";
    try {
      if (!questionList.length) throw new Error("As perguntas não carregaram. Atualize a página antes de enviar.");
      const code = randomTrackingCode(); const result = await invoke(cfg.SUBMIT_FUNCTION || "submit-wl", { ...formData(), tracking_code: code });
      stopQuizTimer(); lastTrackingCode = result.tracking_code || code; $("#trackingCode").textContent = lastTrackingCode;
      const approved = Number(result.score) >= 80 && ["approved", "awaiting_id_release", "id_submitted", "released"].includes(result.status);
      $("#successText").textContent = approved ? `Resultado automático: ${result.score}/100 pontos — APROVADO! Sua inscrição está aguardando a liberação do ID pela equipe.` : `Resultado automático: ${result.score}/100 pontos — REPROVADO. É necessário alcançar 80% para aprovação.`;
      $("#successPanel").classList.remove("hidden"); form.classList.add("hidden"); toast(approved ? "Whitelist aprovada automaticamente!" : "Inscrição registrada.");
    } catch (error) { err.textContent = error.message || "Não foi possível enviar. Tente novamente."; }
    finally { btn.disabled = false; btn.textContent = "ENVIAR INSCRIÇÃO ↗"; }
  });
  $("#copyCode").addEventListener("click", async () => { try { await navigator.clipboard.writeText(lastTrackingCode); toast("Código copiado."); } catch { toast("Anote seu código: " + lastTrackingCode); } });
  $("#statusForm").addEventListener("submit", async e => {
    e.preventDefault(); const code = new FormData(e.currentTarget).get("tracking_code").trim().toUpperCase(), btn = $("#statusBtn"), out = $("#statusResult");
    btn.disabled = true; btn.textContent = "CONSULTANDO..."; out.classList.add("hidden"); out.replaceChildren();
    try {
      const d = await invoke(cfg.STATUS_FUNCTION || "wl-status", { tracking_code: code });
      const map = { pending: "Em análise", approved: "Aguardando liberação do ID", awaiting_id_release: "Aguardando liberação do ID", id_submitted: "ID recebido — aguardando equipe", released: "ID liberado no servidor", rejected: "Reprovado", interview: "Entrevista solicitada" };
      const h = document.createElement("h3"), pill = document.createElement("span"), p = document.createElement("p"), date = document.createElement("p"), note = document.createElement("p");
      h.textContent = map[d.status] || d.status; pill.className = "status-pill " + (["approved", "awaiting_id_release", "id_submitted", "released"].includes(d.status) ? "pill-approved" : d.status === "rejected" ? "pill-pending" : "pill-interview"); pill.textContent = map[d.status] || d.status;
      p.textContent = `Pontuação: ${d.score}/100`; date.textContent = d.updated_at ? `Última atualização: ${new Date(d.updated_at).toLocaleString("pt-BR")}` : ""; note.textContent = d.public_note || "A avaliação é automática com base nas respostas objetivas."; out.append(h, pill, p, date, note); out.classList.remove("hidden");
    } catch (error) { const p = document.createElement("p"); p.textContent = error.message || "Não foi possível consultar o código."; out.append(p); out.classList.remove("hidden"); }
    finally { btn.disabled = false; btn.textContent = "CONSULTAR STATUS →"; }
  });
  loadQuestions().catch(error => console.error("Falha ao carregar perguntas da WL:", error));
})();
