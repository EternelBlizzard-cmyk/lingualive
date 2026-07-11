"use strict";

/* ═══════════════ Données des scénarios ═══════════════ */

const SCENARIOS = [
  {
    id: "daily", emoji: "🛒", label: "Vie quotidienne",
    desc: "Café, courses, voyages, petites conversations du quotidien.",
    role: "a friendly local you meet in everyday situations (barista, shop assistant, neighbour, fellow traveller — pick one and stay consistent)",
    setting: "everyday life situations in an English-speaking city",
    missions: [
      "Commander un repas et demander une modification (allergie, cuisson…)",
      "Demander ton chemin et faire répéter poliment",
      "Rapporter un article défectueux et obtenir un remboursement",
      "Faire connaissance avec un voisin et proposer une activité",
    ],
  },
  {
    id: "business", emoji: "💼", label: "Business & réunions",
    desc: "Réunions d'équipe, négociations, échanges avec des collègues.",
    role: "a colleague or business counterpart in a professional meeting (project manager, supplier, partner — pick one and stay consistent)",
    setting: "a professional business context: meetings, negotiations, project discussions",
    missions: [
      "Négocier un délai supplémentaire sur un projet en retard",
      "Convaincre un fournisseur de baisser son prix de 10 %",
      "Annoncer une mauvaise nouvelle à l'équipe avec diplomatie",
      "Défendre ton idée face à un collègue sceptique",
    ],
  },
  {
    id: "interview", emoji: "🎤", label: "Entretien d'embauche",
    desc: "Un recruteur exigeant te fait passer un vrai entretien.",
    role: "a demanding but fair recruiter conducting a job interview. Ask classic and behavioural questions, dig into vague answers, raise objections about the candidate's profile",
    setting: "a job interview for a position the learner describes (ask them about the role at the start if unclear)",
    missions: [
      "Te présenter en 2 minutes de façon percutante",
      "Répondre à « quelle est votre plus grande faiblesse ? » sans te griller",
      "Négocier le salaire proposé à la hausse",
      "Expliquer un trou dans ton CV avec assurance",
    ],
  },
  {
    id: "appointment", emoji: "📅", label: "Rendez-vous & services",
    desc: "Médecin, banque, administration, prise de rendez-vous.",
    role: "a service professional (doctor, bank advisor, hotel receptionist, administrative agent — pick one and stay consistent)",
    setting: "appointments and service interactions: medical, banking, administration, hotels",
    missions: [
      "Décrire des symptômes chez le médecin et comprendre ses recommandations",
      "Ouvrir un compte bancaire et poser les bonnes questions",
      "Te plaindre (poliment) d'une chambre d'hôtel décevante et obtenir mieux",
      "Reprogrammer un rendez-vous à cause d'un imprévu",
    ],
  },
  {
    id: "presentation", emoji: "📊", label: "Présentation client",
    desc: "Présente un projet, réponds aux questions et aux objections.",
    role: "a client executive attending the learner's presentation. Listen, ask sharp questions, raise objections about cost, timeline and risks — but remain winnable",
    setting: "a client presentation: the learner presents a project, product or results to you",
    missions: [
      "Pitcher ton projet en 90 secondes et susciter l'intérêt",
      "Répondre à l'objection « c'est trop cher » sans baisser le prix",
      "Reprendre la main après une question déstabilisante",
      "Conclure la réunion en obtenant un prochain rendez-vous",
    ],
  },
  {
    id: "free", emoji: "💬", label: "Conversation libre",
    desc: "Discute de tout et de rien : actualité, passions, culture.",
    role: "a curious, cultured conversation partner. Follow the learner's interests, share opinions, gently debate",
    setting: "an open, friendly conversation about any topic the learner enjoys",
    missions: [
      "Débattre d'un sujet d'actualité en défendant ton point de vue",
      "Raconter ton meilleur souvenir de vacances avec des détails vivants",
      "Expliquer ton métier à quelqu'un qui n'y connaît rien",
    ],
  },
];

const TYPE_LABELS = { grammar: "Grammaire", vocabulary: "Vocabulaire", register: "Registre", structure: "Structure" };
const SRS_INTERVALS = [0, 1, 3, 7, 14, 30]; // jours entre révisions selon le niveau de maîtrise

/* ═══════════════ Stockage local ═══════════════ */

const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem("lingualive_" + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem("lingualive_" + key, JSON.stringify(value)); },
};

/* ═══════════════ Appels API (avec code d'accès mémorisé) ═══════════════ */

async function api(path, opts = {}) {
  opts.headers = Object.assign({}, opts.headers, { "X-Access-Code": store.get("accessCode", "") });
  let res = await fetch(path, opts);
  if (res.status === 401) {
    const data = await res.clone().json().catch(() => ({}));
    if (data.codeRequired) {
      const code = prompt("🔒 Code d'accès LinguaLive :");
      if (code && code.trim()) {
        store.set("accessCode", code.trim());
        opts.headers["X-Access-Code"] = code.trim();
        res = await fetch(path, opts);
      }
    }
  }
  return res;
}

/* ═══════════════ État de session ═══════════════ */

const state = {
  scenario: SCENARIOS[0],
  level: "B2",
  mission: "",
  handsFree: true,
  history: [],        // [{role, text}]
  corrections: [],    // toutes les corrections de la session
  vocabSeen: [],      // vocab proposé pendant la session
  inSession: false,
  busy: false,
  missionDone: false,
  reviewQueue: [],
};

/* ═══════════════ Synthèse vocale (TTS) ═══════════════ */

let voices = [];
let chosenVoiceURI = store.get("voice", null);

function loadVoices() {
  voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const sel = document.getElementById("voiceSelect");
  sel.innerHTML = voices.map((v) =>
    `<option value="${v.voiceURI}" ${v.voiceURI === chosenVoiceURI ? "selected" : ""}>${v.name} (${v.lang})</option>`
  ).join("") || "<option value=''>Aucune voix anglaise trouvée</option>";
}
speechSynthesis.onvoiceschanged = loadVoices;

function pickVoice() {
  if (chosenVoiceURI) {
    const v = voices.find((v) => v.voiceURI === chosenVoiceURI);
    if (v) return v;
  }
  // Voix « naturelles » d'Edge, sinon Google, sinon la première anglaise
  return voices.find((v) => /natural/i.test(v.name) && v.lang === "en-US")
    || voices.find((v) => /Google US English/i.test(v.name))
    || voices.find((v) => v.lang === "en-US")
    || voices[0];
}

const SPEECH_RATE = { B1: 0.85, B2: 0.95, C1: 1.0, C2: 1.08 };

function speak(text, onend) {
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utt.voice = voice;
  utt.lang = voice?.lang || "en-US";
  utt.rate = SPEECH_RATE[state.level] || 0.95;
  utt.onend = () => onend && onend();
  utt.onerror = () => onend && onend();
  speechSynthesis.speak(utt);
}

/* ═══════════════ Reconnaissance vocale (STT) ═══════════════ */

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

function initRecognition() {
  if (!SpeechRec) {
    document.getElementById("micSupportNote").hidden = false;
    document.getElementById("micBtn").disabled = true;
    return;
  }
  recognition = new SpeechRec();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (e) => {
    let interim = "", final = "";
    for (const res of e.results) {
      if (res.isFinal) final += res[0].transcript;
      else interim += res[0].transcript;
    }
    document.getElementById("interimText").textContent = interim || final;
    if (final.trim()) {
      stopListening();
      sendTurn(final.trim());
    }
  };
  recognition.onend = () => {
    listening = false;
    document.getElementById("micBtn").classList.remove("listening");
  };
  recognition.onerror = (e) => {
    listening = false;
    document.getElementById("micBtn").classList.remove("listening");
    if (e.error === "not-allowed") {
      document.getElementById("interimText").textContent = "⚠️ Autorise le micro dans le navigateur pour parler.";
    }
  };
}

function startListening() {
  if (!recognition || listening || state.busy) return;
  speechSynthesis.cancel();
  document.getElementById("interimText").textContent = "";
  try { recognition.start(); } catch { return; }
  listening = true;
  document.getElementById("micBtn").classList.add("listening");
}

function stopListening() {
  if (recognition && listening) recognition.stop();
  listening = false;
  document.getElementById("micBtn").classList.remove("listening");
}

/* ═══════════════ Navigation ═══════════════ */

const views = ["setup", "chat", "vocab", "progress", "errors"];

function show(view) {
  views.forEach((v) => (document.getElementById("view-" + v).hidden = v !== view));
  document.querySelectorAll(".tab").forEach((t) => {
    const target = t.dataset.view === "talk" ? (state.inSession ? "chat" : "setup") : t.dataset.view;
    t.classList.toggle("active", target === view);
  });
  if (view === "vocab") renderVocab();
  if (view === "progress") renderProgress();
  if (view === "errors") renderErrors();
}

document.getElementById("mainTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  const v = tab.dataset.view;
  if (v === "talk") show(state.inSession ? "chat" : "setup");
  else show(v);
});

/* ═══════════════ Écran de configuration ═══════════════ */

function renderSetup() {
  const grid = document.getElementById("scenarioGrid");
  grid.innerHTML = SCENARIOS.map((s) => `
    <button class="scenario-card ${s.id === state.scenario.id ? "active" : ""}" data-id="${s.id}">
      <span class="sc-emoji">${s.emoji}</span>
      <h3>${s.label}</h3>
      <p>${s.desc}</p>
    </button>`).join("");
  renderMissions();
}

function renderMissions() {
  const sel = document.getElementById("missionSelect");
  sel.innerHTML = `<option value="">Pas de mission — conversation ouverte</option>` +
    state.scenario.missions.map((m) => `<option value="${m.replace(/"/g, "&quot;")}">🎯 ${m}</option>`).join("");
}

document.getElementById("scenarioGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".scenario-card");
  if (!card) return;
  state.scenario = SCENARIOS.find((s) => s.id === card.dataset.id);
  renderSetup();
});

document.getElementById("levelRow").addEventListener("click", (e) => {
  const pill = e.target.closest(".level-pill");
  if (!pill) return;
  state.level = pill.dataset.level;
  document.querySelectorAll(".level-pill").forEach((p) => p.classList.toggle("active", p === pill));
});

document.getElementById("startBtn").addEventListener("click", () => startSession());

/* ═══════════════ Session de conversation ═══════════════ */

function knownErrorPatterns() {
  return store.get("errors", []).slice(0, 8).map((e) => e.pattern);
}

async function startSession(drillMode = false) {
  state.mission = document.getElementById("missionSelect").value;
  state.handsFree = document.getElementById("handsFreeToggle").checked;
  state.history = [];
  state.corrections = [];
  state.vocabSeen = [];
  state.missionDone = false;
  state.inSession = true;
  state.drillMode = drillMode;

  document.getElementById("chatScenario").textContent = `${state.scenario.emoji} ${state.scenario.label}`;
  document.getElementById("chatLevel").textContent = state.level;
  const mc = document.getElementById("missionChip");
  mc.hidden = !state.mission;
  mc.classList.remove("done");
  if (state.mission) mc.textContent = "🎯 " + state.mission;
  document.getElementById("chatScroll").innerHTML = "";
  show("chat");

  // Le partenaire ouvre la conversation
  await sendTurn("(the conversation starts — greet me and open the scene naturally)", { hidden: true });
}

function addBubble(role, text, extras = {}) {
  const scroll = document.getElementById("chatScroll");
  const msg = document.createElement("div");
  msg.className = "msg " + (role === "user" ? "user" : "ai");

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  if (role === "ai") {
    const replay = document.createElement("button");
    replay.className = "replay";
    replay.title = "Réécouter";
    replay.textContent = "🔊";
    replay.onclick = () => speak(text);
    bubble.appendChild(replay);
  }
  msg.appendChild(bubble);

  if (extras.corrections?.length) {
    const wrap = document.createElement("div");
    wrap.className = "corrections";
    for (const c of extras.corrections) {
      const div = document.createElement("div");
      div.className = "correction " + c.type;
      div.innerHTML =
        `<span class="ctype-tag">${TYPE_LABELS[c.type] || c.type}</span>` +
        `<span class="c-orig"></span> → <span class="c-fix"></span>` +
        `<div class="c-expl"></div>`;
      div.querySelector(".c-orig").textContent = c.original;
      div.querySelector(".c-fix").textContent = c.corrected;
      div.querySelector(".c-expl").textContent = c.explanation;
      div.onclick = () => div.classList.toggle("open");
      wrap.appendChild(div);
    }
    msg.appendChild(wrap);
  } else if (extras.perfect) {
    const ok = document.createElement("div");
    ok.className = "perfect-tag";
    ok.textContent = "✓ Impeccable";
    msg.appendChild(ok);
  }

  if (extras.nativeVersion) {
    const nv = document.createElement("div");
    nv.className = "native-version";
    nv.textContent = "🗣 Un natif dirait : « " + extras.nativeVersion + " »";
    msg.appendChild(nv);
  }
  if (extras.coachNote) {
    const cn = document.createElement("div");
    cn.className = "coach-note";
    cn.textContent = "💡 " + extras.coachNote;
    msg.appendChild(cn);
  }
  if (extras.vocab?.length) {
    const vw = document.createElement("div");
    vw.className = "vocab-inline";
    for (const v of extras.vocab) {
      const chip = document.createElement("span");
      chip.className = "vocab-chip";
      chip.innerHTML = `<b></b> · <span></span>`;
      chip.querySelector("b").textContent = v.term;
      chip.querySelector("span").textContent = v.translation;
      chip.title = v.example;
      vw.appendChild(chip);
    }
    msg.appendChild(vw);
  }

  scroll.appendChild(msg);
  scroll.scrollTop = scroll.scrollHeight;
  return msg;
}

async function sendTurn(userText, opts = {}) {
  if (state.busy) return;
  state.busy = true;
  stopListening();
  document.getElementById("interimText").textContent = "";

  let userBubble = null;
  if (!opts.hidden) userBubble = addBubble("user", userText);

  const scroll = document.getElementById("chatScroll");
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.textContent = "réfléchit";
  scroll.appendChild(typing);
  scroll.scrollTop = scroll.scrollHeight;

  try {
    const res = await api("/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: { role: state.scenario.role, setting: state.scenario.setting, label: state.scenario.label },
        level: state.level,
        mission: state.mission,
        history: state.history,
        userText,
        knownErrors: state.drillMode ? knownErrorPatterns() : [],
      }),
    });
    const data = await res.json();
    typing.remove();
    if (!res.ok) {
      if (res.status === 401) openSettings(data.error);
      addBubble("ai", "⚠️ " + (data.error || "Erreur serveur"));
      return;
    }
    const t = data.turn;

    // Annoter le message utilisateur avec les corrections
    if (userBubble) {
      const decorated = addUserAnnotations(userBubble, t);
      state.corrections.push(...(t.corrections || []));
    }
    state.history.push({ role: "user", text: userText });
    state.history.push({ role: "assistant", text: t.reply });
    if (t.vocab?.length) state.vocabSeen.push(...t.vocab);

    addBubble("ai", t.reply, {});

    if (t.missionStatus === "accomplished" && !state.missionDone) {
      state.missionDone = true;
      const mc = document.getElementById("missionChip");
      mc.classList.add("done");
      mc.textContent = "✅ Mission accomplie !";
      const banner = document.createElement("div");
      banner.className = "mission-banner";
      banner.textContent = "🎉 Mission accomplie !";
      scroll.appendChild(banner);
      scroll.scrollTop = scroll.scrollHeight;
    }

    speak(t.reply, () => {
      if (state.handsFree && state.inSession) startListening();
    });
  } catch (err) {
    typing.remove();
    addBubble("ai", "⚠️ Connexion impossible : " + err.message);
  } finally {
    state.busy = false;
  }
}

function addUserAnnotations(userBubble, turn) {
  const extras = {
    corrections: turn.corrections || [],
    perfect: !(turn.corrections || []).length,
    nativeVersion: turn.nativeVersion,
    coachNote: turn.coachNote,
    vocab: turn.vocab,
  };
  // Reconstruit le bloc utilisateur avec annotations sous la bulle
  const text = userBubble.querySelector(".bubble").textContent;
  const fresh = addBubble("user", text, extras);
  userBubble.replaceWith(fresh);
  // addBubble a ajouté fresh en bas — le remettre à la place d'origine n'est pas
  // nécessaire puisque userBubble était déjà le dernier message affiché
  return fresh;
}

/* Micro & clavier */
document.getElementById("micBtn").addEventListener("click", () => (listening ? stopListening() : startListening()));
document.getElementById("sendBtn").addEventListener("click", submitText);
document.getElementById("textInput").addEventListener("keydown", (e) => { if (e.key === "Enter") submitText(); });

function submitText() {
  const input = document.getElementById("textInput");
  const text = input.value.trim();
  if (!text || state.busy) return;
  input.value = "";
  sendTurn(text);
}

/* ═══════════════ Fin de session & débrief ═══════════════ */

document.getElementById("endBtn").addEventListener("click", endSession);

async function endSession() {
  stopListening();
  speechSynthesis.cancel();
  const userTurns = state.history.filter((m) => m.role === "user").length;
  if (userTurns < 2) {
    if (confirm("Session très courte — quitter sans débrief ?")) {
      state.inSession = false;
      show("setup");
    }
    return;
  }

  const modal = document.getElementById("debriefModal");
  document.getElementById("debriefContent").innerHTML = `<h2>📋 Débrief en préparation…</h2><p class="muted">Analyse de ta session en cours, quelques secondes…</p>`;
  modal.hidden = false;

  try {
    const res = await api("/api/debrief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: { label: state.scenario.label, setting: state.scenario.setting },
        level: state.level,
        mission: state.mission,
        history: state.history,
        corrections: state.corrections,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur serveur");
    renderDebrief(data.debrief);
    saveSession(data.debrief);
  } catch (err) {
    document.getElementById("debriefContent").innerHTML =
      `<h2>📋 Débrief indisponible</h2><p class="muted">${err.message}</p>`;
    saveSession(null);
  }
}

function renderDebrief(d) {
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const root = document.getElementById("debriefContent");
  root.innerHTML = "";
  root.appendChild(el("h2", null, "📋 Débrief de session"));
  root.appendChild(el("div", "cefr-big", d.cefrEstimate));
  root.appendChild(el("p", null, d.summary));

  const section = (title, items, render) => {
    if (!items?.length) return;
    root.appendChild(el("h3", null, title));
    const ul = el("ul");
    items.forEach((it) => ul.appendChild(render(it)));
    root.appendChild(ul);
  };
  section("💪 Points forts", d.strengths, (s) => el("li", null, s));
  section("🎯 À travailler", d.improvements, (s) => el("li", null, s));

  if (d.nativeUpgrades?.length) {
    root.appendChild(el("h3", null, "🗣 Comme un natif"));
    for (const u of d.nativeUpgrades) {
      const div = el("div", "upgrade");
      div.appendChild(el("span", "u-orig", u.original));
      div.appendChild(el("span", "u-better", u.better));
      root.appendChild(div);
    }
  }
  if (d.recurringErrors?.length) {
    root.appendChild(el("h3", null, "🩹 Erreurs à retravailler (ajoutées à ton journal)"));
    const ul = el("ul");
    for (const r of d.recurringErrors) ul.appendChild(el("li", null, `${r.pattern} — ${r.advice}`));
    root.appendChild(ul);
  }
  section("🧭 Pour la suite", d.nextSteps, (s) => el("li", null, s));
}

document.getElementById("debriefCloseBtn").addEventListener("click", () => {
  document.getElementById("debriefModal").hidden = true;
  state.inSession = false;
  show("progress");
});

/* ═══════════════ Persistance : sessions, vocab, erreurs, streak ═══════════════ */

function saveSession(debrief) {
  const errorsByType = {};
  for (const c of state.corrections) errorsByType[c.type] = (errorsByType[c.type] || 0) + 1;

  const sessions = store.get("sessions", []);
  sessions.unshift({
    date: new Date().toISOString(),
    scenario: state.scenario.label,
    emoji: state.scenario.emoji,
    level: state.level,
    mission: state.mission,
    missionDone: state.missionDone,
    turns: state.history.filter((m) => m.role === "user").length,
    errors: state.corrections.length,
    errorsByType,
    cefr: debrief?.cefrEstimate || "",
  });
  store.set("sessions", sessions.slice(0, 200));

  // Vocabulaire → SRS
  const vocab = store.get("vocab", []);
  for (const v of state.vocabSeen) {
    if (!vocab.some((x) => x.term.toLowerCase() === v.term.toLowerCase())) {
      vocab.push({ ...v, context: state.scenario.label, box: 0, due: Date.now(), added: Date.now() });
    }
  }
  store.set("vocab", vocab);

  // Journal d'erreurs récurrentes
  if (debrief?.recurringErrors?.length) {
    const errors = store.get("errors", []);
    for (const r of debrief.recurringErrors) {
      const existing = errors.find((e) => e.pattern.toLowerCase() === r.pattern.toLowerCase());
      if (existing) { existing.count++; existing.advice = r.advice; }
      else errors.push({ ...r, count: 1 });
    }
    errors.sort((a, b) => b.count - a.count);
    store.set("errors", errors.slice(0, 40));
  }

  updateStreak();
  updateBadges();
}

function updateStreak() {
  const today = new Date().toDateString();
  const data = store.get("streak", { count: 0, last: "" });
  if (data.last === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  data.count = data.last === yesterday ? data.count + 1 : 1;
  data.last = today;
  store.set("streak", data);
  renderStreak();
}

function renderStreak() {
  const data = store.get("streak", { count: 0, last: "" });
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const active = data.last === today || data.last === yesterday;
  document.getElementById("streakChip").textContent = "🔥 " + (active ? data.count : 0);
}

function dueVocab() {
  return store.get("vocab", []).filter((v) => v.due <= Date.now());
}

function updateBadges() {
  const due = dueVocab().length;
  const badge = document.getElementById("vocabDueBadge");
  badge.hidden = !due;
  badge.textContent = due;
}

/* ═══════════════ Vue vocabulaire & révision SRS ═══════════════ */

function renderVocab() {
  renderReviewPanel();
  const vocab = store.get("vocab", []);
  const list = document.getElementById("vocabList");
  if (!vocab.length) {
    list.innerHTML = `<div class="empty-state">Ta base de vocabulaire se remplit automatiquement pendant les conversations.<br>Lance une première session ! 🎤</div>`;
    return;
  }
  const byContext = {};
  for (const v of vocab) (byContext[v.context] ||= []).push(v);
  list.innerHTML = "";
  for (const [ctx, items] of Object.entries(byContext)) {
    const group = document.createElement("div");
    group.className = "vocab-group";
    group.innerHTML = `<h3></h3>`;
    group.querySelector("h3").textContent = `${ctx} (${items.length})`;
    for (const v of items.sort((a, b) => b.added - a.added)) {
      const row = document.createElement("div");
      row.className = "vocab-row";
      row.innerHTML = `<span class="v-term"></span><span class="v-tr"></span><span class="v-srs"></span>`;
      row.querySelector(".v-term").textContent = v.term;
      row.querySelector(".v-tr").textContent = v.translation;
      row.querySelector(".v-srs").textContent = v.box >= SRS_INTERVALS.length - 1 ? "★ acquis" :
        v.due <= Date.now() ? "à réviser" : "revu · niv. " + (v.box + 1);
      row.title = v.example;
      group.appendChild(row);
    }
    list.appendChild(group);
  }
}

function renderReviewPanel() {
  const panel = document.getElementById("reviewPanel");
  state.reviewQueue = dueVocab();
  if (!state.reviewQueue.length) {
    panel.innerHTML = `<h2>🧠 Révision espacée</h2><div class="empty-state">Rien à réviser pour l'instant — tout est à jour ! ✨</div>`;
    return;
  }
  panel.innerHTML = `<h2>🧠 Révision espacée <span class="muted">— ${state.reviewQueue.length} mot(s) à réviser</span></h2>`;
  showReviewCard(panel);
}

function showReviewCard(panel) {
  const item = state.reviewQueue[0];
  if (!item) { renderReviewPanel(); renderVocab(); updateBadges(); return; }
  const old = panel.querySelector(".review-card");
  if (old) old.remove();

  const card = document.createElement("div");
  card.className = "review-card";
  card.innerHTML = `
    <div class="rc-fr"></div>
    <div class="rc-ctx"></div>
    <div class="rc-answer" hidden></div>
    <div class="rc-example" hidden></div>
    <div class="review-actions"></div>`;
  card.querySelector(".rc-fr").textContent = item.translation;
  card.querySelector(".rc-ctx").textContent = "Comment dit-on ça en anglais ? · contexte : " + item.context;
  card.querySelector(".rc-answer").textContent = item.term;
  card.querySelector(".rc-example").textContent = item.example;

  const actions = card.querySelector(".review-actions");
  const revealBtn = document.createElement("button");
  revealBtn.className = "rv-btn";
  revealBtn.textContent = "👁 Voir la réponse";
  revealBtn.onclick = () => {
    card.querySelector(".rc-answer").hidden = false;
    card.querySelector(".rc-example").hidden = false;
    speak(item.term);
    actions.innerHTML = "";
    const dont = document.createElement("button");
    dont.className = "rv-btn dont";
    dont.textContent = "✗ Je ne savais pas";
    dont.onclick = () => gradeReview(item, false, panel);
    const know = document.createElement("button");
    know.className = "rv-btn know";
    know.textContent = "✓ Je savais";
    know.onclick = () => gradeReview(item, true, panel);
    actions.append(dont, know);
  };
  actions.appendChild(revealBtn);
  panel.appendChild(card);
}

function gradeReview(item, knew, panel) {
  const vocab = store.get("vocab", []);
  const v = vocab.find((x) => x.term === item.term);
  if (v) {
    v.box = knew ? Math.min(v.box + 1, SRS_INTERVALS.length - 1) : 0;
    v.due = Date.now() + SRS_INTERVALS[v.box] * 86400000 + (knew ? 0 : 10 * 60000);
    store.set("vocab", vocab);
  }
  state.reviewQueue.shift();
  showReviewCard(panel);
}

/* ═══════════════ Vue progrès ═══════════════ */

function renderProgress() {
  const sessions = store.get("sessions", []);
  const root = document.getElementById("progressContent");
  if (!sessions.length) {
    root.innerHTML = `<div class="panel"><div class="empty-state">Tes statistiques apparaîtront après ta première session. 🎤</div></div>`;
    return;
  }
  const totalTurns = sessions.reduce((a, s) => a + s.turns, 0);
  const totalErrors = sessions.reduce((a, s) => a + s.errors, 0);
  const errorRate = totalTurns ? (totalErrors / totalTurns).toFixed(1) : 0;
  const byType = {};
  for (const s of sessions) for (const [t, n] of Object.entries(s.errorsByType || {})) byType[t] = (byType[t] || 0) + n;
  const maxType = Math.max(1, ...Object.values(byType));
  const typeColors = { grammar: "var(--grammar)", vocabulary: "var(--vocabulary)", register: "var(--register)", structure: "var(--structure)" };

  const lastCefr = sessions.find((s) => s.cefr)?.cefr || "—";

  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-tile"><div class="st-num">${sessions.length}</div><div class="st-label">sessions</div></div>
      <div class="stat-tile"><div class="st-num">${totalTurns}</div><div class="st-label">prises de parole</div></div>
      <div class="stat-tile"><div class="st-num">${errorRate}</div><div class="st-label">erreurs / prise de parole</div></div>
      <div class="stat-tile"><div class="st-num">${lastCefr}</div><div class="st-label">dernier niveau estimé</div></div>
    </div>
    <div class="panel"><h2>Répartition de mes erreurs</h2><div id="typeBars"></div></div>
    <div class="panel"><h2>Historique des sessions</h2><div id="sessionRows"></div></div>`;

  const bars = root.querySelector("#typeBars");
  for (const [type, label] of Object.entries(TYPE_LABELS)) {
    const n = byType[type] || 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `<span class="b-label">${label}</span><div class="bar-track"><div class="bar-fill" style="width:${(n / maxType) * 100}%;background:${typeColors[type]}"></div></div><span class="b-count">${n}</span>`;
    bars.appendChild(row);
  }

  const rows = root.querySelector("#sessionRows");
  for (const s of sessions.slice(0, 25)) {
    const row = document.createElement("div");
    row.className = "session-row";
    const d = new Date(s.date);
    row.innerHTML = `<span class="s-date">${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
      <span class="s-scen"></span>
      <span class="muted">${s.turns} tours · ${s.errors} corr.</span>
      <span class="s-cefr">${s.cefr || ""}</span>`;
    row.querySelector(".s-scen").textContent = `${s.emoji} ${s.scenario}${s.missionDone ? " · 🎯✓" : ""}`;
    rows.appendChild(row);
  }
}

/* ═══════════════ Vue journal d'erreurs ═══════════════ */

function renderErrors() {
  const errors = store.get("errors", []);
  const list = document.getElementById("errorsList");
  const drillBtn = document.getElementById("drillBtn");
  drillBtn.hidden = !errors.length;
  if (!errors.length) {
    list.innerHTML = `<div class="empty-state">Aucune erreur récurrente identifiée pour l'instant.<br>Elles seront détectées automatiquement au fil des débriefs.</div>`;
    return;
  }
  list.innerHTML = "";
  for (const e of errors) {
    const row = document.createElement("div");
    row.className = "error-row";
    row.innerHTML = `<span class="e-count">×${e.count}</span><span class="type-dot ${e.type}"></span><span class="e-pattern"></span><div class="e-advice"></div>`;
    row.querySelector(".e-pattern").textContent = e.pattern;
    row.querySelector(".e-advice").textContent = e.advice;
    list.appendChild(row);
  }
}

document.getElementById("drillBtn").addEventListener("click", () => {
  show("setup");
  // La prochaine session ciblera les erreurs du journal
  startSession(true);
});

/* ═══════════════ Réglages / clé API ═══════════════ */

function openSettings(errorMsg = "") {
  document.getElementById("settingsModal").hidden = false;
  document.getElementById("keyError").textContent = errorMsg;
  api("/api/status").then((r) => r.json()).then((s) => {
    document.getElementById("keyStatus").textContent = s.keyConfigured
      ? `✓ Clé API configurée · modèle : ${s.model}`
      : "Aucune clé API configurée — colle ta clé Anthropic ci-dessous.";
  }).catch(() => {});
  loadVoices();
}

document.getElementById("settingsBtn").addEventListener("click", () => openSettings());
document.getElementById("settingsCloseBtn").addEventListener("click", () => (document.getElementById("settingsModal").hidden = true));
document.getElementById("voiceSelect").addEventListener("change", (e) => {
  chosenVoiceURI = e.target.value;
  store.set("voice", chosenVoiceURI);
  const v = voices.find((v) => v.voiceURI === chosenVoiceURI);
  if (v) speak("Hello! This is how I sound.");
});

document.getElementById("keySaveBtn").addEventListener("click", async () => {
  const key = document.getElementById("keyInput").value.trim();
  const err = document.getElementById("keyError");
  err.textContent = "";
  try {
    const res = await api("/api/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error; return; }
    document.getElementById("keyInput").value = "";
    openSettings();
  } catch (e) {
    err.textContent = "Connexion impossible : " + e.message;
  }
});

/* ═══════════════ Initialisation ═══════════════ */

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

renderSetup();
initRecognition();
loadVoices();
renderStreak();
updateBadges();
show("setup");
