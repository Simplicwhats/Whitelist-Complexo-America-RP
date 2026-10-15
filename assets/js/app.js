
(() => {
  "use strict";

  const cfg = window.CA_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const form = $("#wlForm");
  const steps = $$(".form-step");
  let currentStep = 0;
  let client = null;
  let lastTrackingCode = "";
  let quizTimer = null;
  let quizDeadline = 0;

  $("#year").textContent = new Date().getFullYear();

  if (
    window.supabase &&
    cfg.SUPABASE_URL?.startsWith("https://") &&
    !cfg.SUPABASE_URL.includes("SEU-PROJETO") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("COLE_SUA")
  ) {
    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  function toast(m) {
    const e = $("#toast");
    e.textContent = m;
    e.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => e.classList.remove("show"), 3200);
  }

  function openApplication() {
    $("#application").classList.remove("hidden");
    $("#statusSection").classList.add("hidden");
    $("#application").scrollIntoView({ behavior: "smooth" });
  }

  function openStatus() {
    $("#statusSection").classList.remove("hidden");
    $("#application").classList.add("hidden");
    $("#statusSection").scrollIntoView({ behavior: "smooth" });
  }

  function closeApplication() {
    $("#application").classList.add("hidden");
    $("#inicio").scrollIntoView({ behavior: "smooth" });
  }

  $("#startWl").addEventListener("click", openApplication);
  $("#startWl2").addEventListener("click", openApplication);
  $("#startWl3").addEventListener("click", openApplication);
  $("#closeWl").addEventListener("click", closeApplication);

  $("#viewRules").addEventListener("click", () =>
    $("#regras").scrollIntoView({ behavior: "smooth" })
  );

  $$("[data-open-status]").forEach(b =>
    b.addEventListener("click", openStatus)
  );

  $$(".close-status").forEach(b =>
    b.addEventListener("click", () =>
      $("#statusSection").classList.add("hidden")
    )
  );

  $("#menuToggle").addEventListener("click", () =>
    $("nav").classList.toggle("open")
  );

  $$(".nav-link").forEach(a =>
    a.addEventListener("click", () =>
      $("nav").classList.remove("open")
    )
  );

  function showStep(i) {
    currentStep = i;
    steps.forEach((e, n) =>
      e.classList.toggle("active", n === i)
    );

    $$(".step[data-step-label]").forEach((e, n) =>
      e.classList.toggle("active", n === i)
    );

    if (i === 2) startQuizTimer();
    if (i === 3) fillReview();
  }

  function validateStep(i) {
    for (const f of $$("input,select,textarea", steps[i])) {
      if (!f.checkValidity()) {
        f.reportValidity();
        return false;
      }

      if (f.name === "rules_read" && f.value !== "yes") {
        f.setCustomValidity("Leia as regras antes de continuar.");
        f.reportValidity();
        f.setCustomValidity("");
        return false;
      }
    }

    return true;
  }

  $$(".next-step").forEach(b =>
    b.addEventListener("click", () => {
      if (validateStep(currentStep)) {
        showStep(Math.min(currentStep + 1, steps.length - 1));
      }
    })
  );

  $$(".prev-step").forEach(b =>
    b.addEventListener("click", () =>
      showStep(Math.max(currentStep - 1, 0))
    )
  );

  // Embaralha perguntas e alternativas sem alterar os valores do gabarito.
  const quizStep = steps[2];

  const quizLabels = () =>
    $$("label", quizStep).filter(l =>
      l.querySelector('select[name^="q_"]')
    );

  function shuffleQuestions() {
    const labels = quizLabels();

    for (let i = labels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [labels[i], labels[j]] = [labels[j], labels[i]];
    }

    const anchor =
      quizStep.querySelector('label textarea[name="motivation"]')
        ?.closest("label") ||
      quizStep.querySelector(".form-actions");

    labels.forEach((label, index) => {
      const sel = label.querySelector("select");
      const opts = [...sel.options].slice(1);

      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }

      opts.forEach(o => sel.appendChild(o));
      sel.selectedIndex = 0;

      const text = [...label.childNodes].find(
        n => n.nodeType === Node.TEXT_NODE
      );

      label.dataset.questionOriginal =
        label.dataset.questionOriginal ||
        (text ? text.textContent.trim() : "Pergunta");

      if (text) {
        text.textContent =
          `${index + 1}. ${label.dataset.questionOriginal.replace(/^\d+\.\s*/, "")}`;
      }
    });

    const frag = document.createDocumentFragment();
    labels.forEach(l => frag.appendChild(l));
    quizStep.insertBefore(frag, anchor);
  }

  function stopQuizTimer() {
    if (quizTimer) {
      clearInterval(quizTimer);
      quizTimer = null;
    }

    quizDeadline = 0;
    sessionStorage.removeItem("ca_wl_quiz_deadline");

    const el = document.getElementById("wlTimer");
    if (el) el.remove();
  }

  function resetQuiz() {
    stopQuizTimer();
    form.reset();
    $("#successPanel").classList.add("hidden");
    form.classList.remove("hidden");
    $("#formError").textContent = "";
    shuffleQuestions();
    showStep(0);
    toast("Tempo esgotado. A whitelist foi reiniciada e a ordem das perguntas mudou.");
    $("#application").scrollIntoView({ behavior: "smooth" });
  }

  function startQuizTimer() {
    let saved = Number(
      sessionStorage.getItem("ca_wl_quiz_deadline") || 0
    );

    if (!saved || saved <= Date.now()) {
      saved = Date.now() + 10 * 60 * 1000;
      sessionStorage.setItem("ca_wl_quiz_deadline", String(saved));
    }

    quizDeadline = saved;

    let el = document.getElementById("wlTimer");

    if (!el) {
      el = document.createElement("div");
      el.id = "wlTimer";
      el.className = "wl-timer";
      el.setAttribute("role", "timer");
      el.setAttribute("aria-live", "polite");
      el.innerHTML = "<span>⏱ TEMPO RESTANTE</span><strong></strong>";
      quizStep.insertBefore(el, quizStep.querySelector("h2").nextSibling);
    }

    if (quizTimer) clearInterval(quizTimer);

    const tick = () => {
      const left = quizDeadline - Date.now();

      if (left <= 0) {
        resetQuiz();
        return;
      }

      const m = Math.floor(left / 60000);
      const sec = Math.floor((left % 60000) / 1000);

      el.querySelector("strong").textContent =
        `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

      el.classList.toggle("urgent", left <= 60000);
    };

    tick();
    quizTimer = setInterval(tick, 250);
  }

  shuffleQuestions();

  ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"]
    .forEach(evt => {
      quizStep.addEventListener(evt, e => {
        e.preventDefault();

        if (["copy", "cut", "paste"].includes(evt)) {
          toast("Copiar e colar está desativado durante a avaliação.");
        }
      });
    });

  document.addEventListener("keydown", e => {
    if (
      currentStep === 2 &&
      (e.ctrlKey || e.metaKey) &&
      ["c", "x", "v", "a"].includes(e.key.toLowerCase())
    ) {
      e.preventDefault();
      toast("Atalhos de copiar/colar estão desativados durante a avaliação.");
    }
  });

  function formData() {
    const fd = new FormData(form);
    const o = {};

    for (const [k, v] of fd.entries()) {
      if (k !== "confirm_truth") {
        o[k] = typeof v === "string" ? v.trim() : v;
      }
    }

    o.age = Number(o.age);
    return o;
  }

  function fillReview() {
    const d = formData();

    const items = [
      ["Nome", d.full_name],
      ["Idade", d.age],
      ["Discord", d.discord_tag || "Não informado"],
      ["ID do FiveM", d.fivem_id],
      ["Experiência", d.rp_experience],
      ["Personagem", d.character_type],
      ["História", d.character_story],
      ["Motivação", d.motivation],
      ["Questionário", "20 questões — 100 pontos possíveis"]
    ];

    $("#reviewSummary").replaceChildren(
      ...items.map(([l, v]) => {
        const x = document.createElement("div");
        const s = document.createElement("small");
        const b = document.createElement("b");

        s.textContent = l;
        b.textContent = String(v || "—");

        x.append(s, b);
        return x;
      })
    );
  }

  function randomTrackingCode() {
    const b = new Uint8Array(6);
    crypto.getRandomValues(b);

    return "CA-" +
      [...b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  async function invoke(name, body) {
    if (!client) {
      throw new Error(
        "Configure a URL e a chave pública do Supabase em assets/js/config.js."
      );
    }

    const { data, error } = await client.functions.invoke(name, { body });

    if (error) {
      let m = error.message || "Falha ao comunicar com o servidor.";

      try {
        if (error.context?.json) {
          const j = await error.context.json();
          m = j.error || j.message || m;
        }
      } catch {}

      throw new Error(m);
    }

    if (data?.error) throw new Error(data.error);
    return data;
  }

  // Envio da whitelist e exibição do resultado corrigida.
  form.addEventListener("submit", async e => {
    e.preventDefault();

    if (!validateStep(3)) return;

    if (!form.confirm_truth.checked) {
      form.confirm_truth.reportValidity();
      return;
    }

    const btn = $("#submitBtn");
    const err = $("#formError");

    btn.disabled = true;
    btn.textContent = "ENVIANDO INSCRIÇÃO...";
    err.textContent = "";

    try {
      const code = randomTrackingCode();

      const result = await invoke(
        cfg.SUBMIT_FUNCTION || "submit-wl",
        { ...formData(), tracking_code: code }
      );

      stopQuizTimer();

      lastTrackingCode = result.tracking_code || code;
      $("#trackingCode").textContent = lastTrackingCode;

      const aprovado =
        Number(result.score) >= 80 &&
        [
          "approved",
          "awaiting_id_release",
          "id_submitted",
          "released"
        ].includes(result.status);

      $("#successText").textContent = aprovado
        ? `Resultado automático: ${result.score}/100 pontos — APROVADO! Você atingiu pelo menos 80%. Sua inscrição está aguardando a liberação do ID pela equipe.`
        : `Resultado automático: ${result.score}/100 pontos — REPROVADO. É necessário alcançar 80% para aprovação.`;

      $("#successPanel").classList.remove("hidden");
      form.classList.add("hidden");

      toast(
        aprovado
          ? "Whitelist aprovada automaticamente!"
          : "Inscrição registrada."
      );
    } catch (er) {
      err.textContent =
        er.message || "Não foi possível enviar. Tente novamente.";
    } finally {
      btn.disabled = false;
      btn.textContent = "ENVIAR INSCRIÇÃO ↗";
    }
  });

  $("#copyCode").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(lastTrackingCode);
      toast("Código copiado.");
    } catch {
      toast("Anote seu código: " + lastTrackingCode);
    }
  });

  // Consulta de status da whitelist.
  $("#statusForm").addEventListener("submit", async e => {
    e.preventDefault();

    const code = new FormData(e.currentTarget)
      .get("tracking_code")
      .trim()
      .toUpperCase();

    const btn = $("#statusBtn");
    const out = $("#statusResult");

    btn.disabled = true;
    btn.textContent = "CONSULTANDO...";
    out.classList.add("hidden");
    out.replaceChildren();

    try {
      const d = await invoke(
        cfg.STATUS_FUNCTION || "wl-status",
        { tracking_code: code }
      );

      const map = {
        pending: "Em análise",
        approved: "Aguardando liberação do ID",
        awaiting_id_release: "Aguardando liberação do ID",
        id_submitted: "ID recebido — aguardando equipe",
        released: "ID liberado no servidor",
        rejected: "Reprovado",
        interview: "Entrevista solicitada"
      };

      const h = document.createElement("h3");
      const pill = document.createElement("span");
      const p = document.createElement("p");
      const date = document.createElement("p");
      const note = document.createElement("p");

      h.textContent = map[d.status] || d.status;

      pill.className =
        "status-pill " +
        (
          ["approved", "awaiting_id_release", "id_submitted", "released"]
            .includes(d.status)
            ? "pill-approved"
            : d.status === "rejected"
              ? "pill-pending"
              : "pill-interview"
        );

      pill.textContent = map[d.status] || d.status;
      p.textContent = `Pontuação: ${d.score}/100`;

      date.textContent = d.updated_at
        ? `Última atualização: ${new Date(d.updated_at).toLocaleString("pt-BR")}`
        : "";

      note.textContent =
        d.public_note ||
        "A avaliação é automática com base nas respostas objetivas.";

      out.append(h, pill, p, date, note);
      out.classList.remove("hidden");
    } catch (er) {
      const p = document.createElement("p");
      p.textContent = er.message || "Não foi possível consultar o código.";
      out.append(p);
      out.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "CONSULTAR STATUS →";
    }
  });
})();
