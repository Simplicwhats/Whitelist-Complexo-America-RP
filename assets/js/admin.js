(() => {
  "use strict";
  const $ = s => document.querySelector(s), cfg = window.CA_CONFIG || {};
  let client = null, rows = [], questionRows = [];
  if (window.supabase && cfg.SUPABASE_URL?.startsWith("https://") && cfg.SUPABASE_ANON_KEY) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  const labels = { full_name: "Nome completo", age: "Idade", discord_tag: "Discord", fivem_id: "ID do FiveM", rp_experience: "Experiência", character_type: "Tipo de personagem", character_story: "História do personagem", motivation: "Motivação" };
  const statusText = { pending: "Em análise", approved: "Aprovado", awaiting_id_release: "Aguardando liberação do ID", id_submitted: "ID recebido — aguardando equipe", released: "ID liberado no servidor", rejected: "Reprovado", interview: "Entrevista solicitada" };
  function err(message) { $("#adminError").textContent = message; }
  async function request(name, body = {}) {
    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error("Sessão expirada. Entre novamente.");
    const { data, error } = await client.functions.invoke(name, { body, headers: { Authorization: `Bearer ${session.access_token}` } });
    if (error) { let message = error.message; try { message = (await error.context?.json?.())?.error || message; } catch {} throw new Error(data?.error || message); }
    if (data?.error) throw new Error(data.error); return data;
  }
  $("#adminLogin").addEventListener("submit", async e => {
    e.preventDefault(); err(""); const btn = $("#adminLoginBtn"); btn.disabled = true;
    if (!client) { err("Configure a URL e a chave pública em assets/js/config.js."); btn.disabled = false; return; }
    const fd = new FormData(e.currentTarget);
    try { const { error } = await client.auth.signInWithPassword({ email: String(fd.get("email")).trim(), password: fd.get("password") }); if (error) throw error; await load(); }
    catch (error) { err(error.message); }
    finally { btn.disabled = false; }
  });
  async function load() {
    const { data: { session } } = await client.auth.getSession(); if (!session) throw new Error("Faça login.");
    const { data: profile, error } = await client.from("wl_admins").select("email").eq("email", session.user.email).maybeSingle();
    if (error) throw error;
    if (!profile) { await client.auth.signOut(); throw new Error("Este e-mail não está autorizado no painel."); }
    $("#adminLogin").classList.add("hidden"); $("#adminDashboard").classList.remove("hidden"); $("#adminLogout").classList.remove("hidden");
    await Promise.all([refresh(), refreshQuestions()]);
  }
  async function refresh() { $("#adminList").textContent = "Carregando inscrições..."; try { const result = await request(cfg.ADMIN_LIST_FUNCTION || "admin-list"); rows = result.submissions || []; render(); } catch (error) { $("#adminList").textContent = error.message; } }
  function render() {
    const term = $("#adminSearch").value.toLowerCase(), filter = $("#adminFilter").value, list = $("#adminList"); list.replaceChildren();
    const found = rows.filter(r => (filter === "all" || r.status === filter) && [r.full_name, r.discord_tag, r.fivem_id, r.id].some(x => String(x || "").toLowerCase().includes(term)));
    if (!found.length) { list.textContent = "Nenhuma inscrição encontrada."; return; }
    found.forEach(r => { const b = document.createElement("button"); b.className = "admin-candidate"; const s = document.createElement("strong"), sm = document.createElement("small"), p = document.createElement("span"); s.textContent = r.full_name; sm.textContent = `ID FiveM: ${r.fivem_id || "não informado"} · ${r.score}/100`; p.className = "admin-pill"; p.textContent = statusText[r.status] || r.status; b.append(s, sm, p); b.addEventListener("click", () => detail(r)); list.append(b); });
  }
  function addAnswer(out, label, value) { const box = document.createElement("section"), small = document.createElement("small"), p = document.createElement("p"); box.className = "answer-card"; small.textContent = label; p.textContent = String(value ?? "Não informado"); box.append(small, p); out.append(box); }
  function detail(r) {
    const out = $("#adminDetail"); out.replaceChildren(); const h = document.createElement("h2"), meta = document.createElement("p"); h.textContent = r.full_name; meta.className = "muted"; meta.textContent = `${r.score}/100 pontos · ${statusText[r.status] || r.status} · ${new Date(r.created_at).toLocaleString("pt-BR")}`; out.append(h, meta);
    for (const key of ["age", "discord_tag", "fivem_id", "rp_experience", "character_type", "character_story"]) addAnswer(out, labels[key] || key, r[key]);
    const responses = r.question_responses && typeof r.question_responses === "object" ? r.question_responses : null;
    if (responses) Object.entries(responses).forEach(([key, value]) => { const q = questionRows.find(item => item.question_key === key); addAnswer(out, q?.prompt || key, value); });
    else { for (const q of questionRows) if (Object.prototype.hasOwnProperty.call(r, q.question_key)) addAnswer(out, q.prompt, r[q.question_key]); }
    addAnswer(out, labels.motivation, r.motivation);
    const idLabel = document.createElement("label"); idLabel.textContent = "ID do FiveM (pode corrigir se necessário)"; const idInput = document.createElement("input"); idInput.id = "editFivemId"; idInput.inputMode = "numeric"; idInput.maxLength = 20; idInput.value = r.fivem_id || ""; idInput.placeholder = "ID numérico"; idLabel.append(idInput); out.append(idLabel);
    const statusLabel = document.createElement("label"); statusLabel.textContent = "Status da inscrição"; const sel = document.createElement("select"); sel.id = "editStatus";
    ["awaiting_id_release", "id_submitted", "released", "rejected", "interview"].forEach(value => { const option = document.createElement("option"); option.value = value; option.textContent = statusText[value]; sel.append(option); }); sel.value = ["awaiting_id_release", "id_submitted", "released", "rejected", "interview"].includes(r.status) ? r.status : "awaiting_id_release"; statusLabel.append(sel); out.append(statusLabel);
    const noteLabel = document.createElement("label"); noteLabel.textContent = "Mensagem exibida ao jogador"; const note = document.createElement("textarea"); note.id = "editNote"; note.rows = 3; note.maxLength = 500; note.value = r.public_note || ""; noteLabel.append(note); out.append(noteLabel);
    const save = document.createElement("button"); save.className = "btn btn-red"; save.textContent = "SALVAR STATUS E ID"; save.addEventListener("click", async () => { save.disabled = true; try { await request("admin-update", { id: r.id, fivem_id: idInput.value.trim() || null, status: sel.value, public_note: note.value.trim() }); r.fivem_id = idInput.value.trim() || null; r.status = sel.value; r.public_note = note.value.trim(); meta.textContent = `${r.score}/100 pontos · ${statusText[r.status]} · ${new Date(r.created_at).toLocaleString("pt-BR")}`; render(); alert("Inscrição atualizada."); } catch (error) { alert(error.message); } finally { save.disabled = false; } }); out.append(save);
  }
  const qForm = $("#questionForm"), qList = $("#questionList"), qError = $("#questionError"), qNew = $("#questionNew"), qSave = $("#questionSave");
  function resetQuestionForm() { qForm.reset(); qForm.elements.original_key.value = ""; qForm.elements.sort_order.value = String(questionRows.length + 1); qForm.elements.active.checked = true; qError.textContent = ""; qSave.textContent = "SALVAR PERGUNTA"; }
  function editQuestion(q) { qForm.elements.original_key.value = q.question_key; qForm.elements.prompt.value = q.prompt; qForm.elements.correct_answer.value = q.correct_answer; qForm.elements.wrong_answer_1.value = q.wrong_answer_1; qForm.elements.wrong_answer_2.value = q.wrong_answer_2; qForm.elements.sort_order.value = q.sort_order; qForm.elements.active.checked = q.active; qSave.textContent = "SALVAR ALTERAÇÕES"; qError.textContent = ""; qForm.scrollIntoView({ behavior: "smooth", block: "start" }); }
  async function questionRequest(action, extra = {}) { return await request(cfg.QUESTIONS_ADMIN_FUNCTION || "wl-questions-admin", { action, ...extra }); }
  async function refreshQuestions() {
    qList.textContent = "Carregando perguntas...";
    try {
      const result = await questionRequest("list"); questionRows = result.questions || []; qList.replaceChildren();
      if (!questionRows.length) { qList.textContent = "Nenhuma pergunta cadastrada."; return; }
      questionRows.forEach(q => {
        const card = document.createElement("article"); card.className = "admin-candidate"; const title = document.createElement("strong"), meta = document.createElement("small"); title.textContent = q.prompt; meta.textContent = `${q.question_key} · ${q.active ? "Ativa" : "Desativada"} · ordem ${q.sort_order}`;
        const edit = document.createElement("button"); edit.type = "button"; edit.className = "btn btn-ghost"; edit.textContent = "EDITAR"; edit.addEventListener("click", () => editQuestion(q));
        const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "btn btn-ghost"; toggle.textContent = q.active ? "DESATIVAR" : "ATIVAR"; toggle.addEventListener("click", async () => { toggle.disabled = true; try { await questionRequest("toggle", { question_key: q.question_key, active: !q.active }); await refreshQuestions(); } catch (error) { alert(error.message); toggle.disabled = false; } });
        const actions = document.createElement("div"); actions.className = "question-actions"; actions.append(edit, toggle); card.append(title, meta, actions); qList.append(card);
      });
    } catch (error) { qList.textContent = error.message || "Erro ao carregar perguntas."; }
  }
  qForm.addEventListener("submit", async event => {
    event.preventDefault(); qError.textContent = ""; qSave.disabled = true;
    const originalKey = qForm.elements.original_key.value.trim();
    const question = { question_key: originalKey || undefined, prompt: qForm.elements.prompt.value.trim(), correct_answer: qForm.elements.correct_answer.value.trim(), wrong_answer_1: qForm.elements.wrong_answer_1.value.trim(), wrong_answer_2: qForm.elements.wrong_answer_2.value.trim(), sort_order: Number(qForm.elements.sort_order.value), active: qForm.elements.active.checked };
    try { await questionRequest("save", { question }); resetQuestionForm(); await refreshQuestions(); alert("Pergunta salva. Novas inscrições usarão a configuração atualizada."); }
    catch (error) { qError.textContent = error.message || "Não foi possível salvar a pergunta."; }
    finally { qSave.disabled = false; }
  });
  qNew.addEventListener("click", resetQuestionForm);
  $("#adminSearch").addEventListener("input", render); $("#adminFilter").addEventListener("change", render); $("#adminRefresh").addEventListener("click", refresh);
  $("#adminLogout").addEventListener("click", async () => { await client?.auth.signOut(); location.reload(); });
  client?.auth.getSession().then(({ data }) => { if (data.session) load().catch(error => err(error.message)); });
})();
