"use strict";

/* ═══════════════ Langues disponibles ═══════════════ */

const LANGS = {
  en: { flag: "🇬🇧", label: "Anglais", labelFr: "anglais", name: "English" },
  es: { flag: "🇪🇸", label: "Espagnol", labelFr: "espagnol", name: "Spanish" },
  de: { flag: "🇩🇪", label: "Allemand", labelFr: "allemand", name: "German" },
  it: { flag: "🇮🇹", label: "Italien", labelFr: "italien", name: "Italian" },
};

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
      "Appeler les urgences et décrire la situation avec calme et précision",
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
    id: "exam", emoji: "📝", label: "Examens & certifications",
    desc: "Un examinateur officiel te fait passer une épreuve orale type IELTS, TOEIC ou entretien visa.",
    role: "an official examiner conducting an oral language exam (IELTS/TOEFL speaking style, or a visa/immigration interview officer — pick the one matching the mission). Structured questions, follow-ups on vague answers, neutral but fair tone, keep strict exam timing",
    setting: "an official speaking examination or formal interview",
    missions: [
      "Épreuve type IELTS Part 2 : parler 2 minutes sur un sujet imposé sans t'arrêter",
      "Épreuve type IELTS Part 3 : débattre en profondeur avec l'examinateur",
      "Entretien visa/immigration : justifier ton projet avec précision et calme",
      "Répondre à 5 questions rapides type TOEIC speaking sans temps mort",
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

// Scénario interne du test de niveau (absent de la grille de contextes)
const PLACEMENT_SCENARIO = {
  id: "placement", emoji: "📊", label: "Test de niveau",
  role: "a friendly language placement assessor. Start with very simple everyday questions, then raise the difficulty every 2 exchanges (past/future tenses, hypotheticals, opinions to defend, abstract topics) to find the learner's ceiling in about 8-10 exchanges. Adapt instantly: if they struggle, ease off; if they cruise, push harder. Stay warm and encouraging, never say which level you think they are",
  setting: "a relaxed oral placement assessment to evaluate the learner's real speaking level",
  missions: [],
};

/* Échelle CEFR : conversion estimation ↔ position numérique (pour la jauge) */
const CEFR_NAMES = ["A1", "A2", "B1", "B2", "C1", "C2"];

function cefrToNum(s) {
  const m = (s || "").trim().toUpperCase().match(/^([ABC][12])\s*([+-])?/);
  if (!m || !CEFR_NAMES.includes(m[1])) return null;
  let n = CEFR_NAMES.indexOf(m[1]);
  if (m[2] === "+") n += 0.33;
  if (m[2] === "-") n -= 0.33;
  return n;
}

function numToCefr(n) {
  const k = Math.max(0, Math.min(5, Math.round(n * 3) / 3));
  const i = Math.floor(k + 0.001);
  return CEFR_NAMES[Math.min(i, 5)] + (k - i > 0.2 && i < 5 ? "+" : "");
}

// Niveau réellement démontré : moyenne pondérée (récent d'abord) des estimations
// CEFR des 5 dernières sessions débriefées
function measuredLevelNum() {
  const nums = store.get("sessions", [])
    .map((s) => cefrToNum(s.cefr))
    .filter((n) => n !== null)
    .slice(0, 5);
  if (!nums.length) return null;
  const weights = [5, 4, 3, 2, 1];
  let sum = 0, wsum = 0;
  nums.forEach((n, i) => { sum += n * weights[i]; wsum += weights[i]; });
  return sum / wsum;
}

// Interlocuteurs : chacun a un accent (voix TTS correspondante si disponible) et une origine
const PERSONAS = {
  daily: [
    { name: "Emma", flag: "🇬🇧", origin: "London, UK", lang: "en-GB", ttsVoice: "en-GB-SoniaNeural" },
    { name: "Jake", flag: "🇺🇸", origin: "New York, USA", lang: "en-US", ttsVoice: "en-US-GuyNeural" },
    { name: "Liam", flag: "🇦🇺", origin: "Sydney, Australia", lang: "en-AU", ttsVoice: "en-AU-WilliamNeural" },
  ],
  business: [
    { name: "Sarah", flag: "🇺🇸", origin: "San Francisco, USA", lang: "en-US", ttsVoice: "en-US-JennyNeural" },
    { name: "Oliver", flag: "🇬🇧", origin: "Manchester, UK", lang: "en-GB", ttsVoice: "en-GB-RyanNeural" },
    { name: "Priya", flag: "🇮🇳", origin: "Mumbai, India", lang: "en-IN", ttsVoice: "en-IN-NeerjaNeural" },
  ],
  interview: [
    { name: "Rachel", flag: "🇺🇸", origin: "Chicago, USA", lang: "en-US", ttsVoice: "en-US-AriaNeural" },
    { name: "James", flag: "🇬🇧", origin: "London, UK", lang: "en-GB", ttsVoice: "en-GB-ThomasNeural" },
    { name: "Aisha", flag: "🇿🇦", origin: "Cape Town, South Africa", lang: "en-ZA", ttsVoice: "en-ZA-LeahNeural" },
  ],
  appointment: [
    { name: "Grace", flag: "🇬🇧", origin: "Edinburgh, UK", lang: "en-GB", ttsVoice: "en-GB-LibbyNeural" },
    { name: "Carlos", flag: "🇺🇸", origin: "Miami, USA", lang: "en-US", ttsVoice: "en-US-ChristopherNeural" },
    { name: "Mei", flag: "🇸🇬", origin: "Singapore", lang: "en-SG", ttsVoice: "en-SG-LunaNeural" },
  ],
  presentation: [
    { name: "Michael", flag: "🇺🇸", origin: "Boston, USA", lang: "en-US", ttsVoice: "en-US-EricNeural" },
    { name: "Charlotte", flag: "🇬🇧", origin: "London, UK", lang: "en-GB", ttsVoice: "en-GB-SoniaNeural" },
    { name: "Raj", flag: "🇮🇳", origin: "Bangalore, India", lang: "en-IN", ttsVoice: "en-IN-PrabhatNeural" },
  ],
  placement: [
    { name: "Sam", flag: "📊", origin: "international assessment center", lang: "en-US", ttsVoice: "en-US-AriaNeural" },
  ],
  exam: [
    { name: "Margaret", flag: "🇬🇧", origin: "London, UK", lang: "en-GB", ttsVoice: "en-GB-SoniaNeural" },
    { name: "Steven", flag: "🇺🇸", origin: "Washington DC, USA", lang: "en-US", ttsVoice: "en-US-EricNeural" },
    { name: "Anjali", flag: "🇮🇳", origin: "New Delhi, India", lang: "en-IN", ttsVoice: "en-IN-NeerjaNeural" },
  ],
  free: [
    { name: "Alex", flag: "🇺🇸", origin: "Seattle, USA", lang: "en-US", ttsVoice: "en-US-GuyNeural" },
    { name: "Sophie", flag: "🇬🇧", origin: "Bristol, UK", lang: "en-GB", ttsVoice: "en-GB-LibbyNeural" },
    { name: "Noah", flag: "🇦🇺", origin: "Melbourne, Australia", lang: "en-AU", ttsVoice: "en-AU-WilliamNeural" },
  ],
};

// Interlocuteurs des autres langues (communs à tous les contextes)
const LANG_PERSONAS = {
  es: [
    { name: "Lucía", flag: "🇪🇸", origin: "Madrid, Spain", lang: "es-ES", ttsVoice: "es-ES-ElviraNeural" },
    { name: "Diego", flag: "🇲🇽", origin: "Mexico City, Mexico", lang: "es-MX", ttsVoice: "es-MX-JorgeNeural" },
    { name: "Valentina", flag: "🇦🇷", origin: "Buenos Aires, Argentina", lang: "es-AR", ttsVoice: "es-AR-ElenaNeural" },
  ],
  de: [
    { name: "Katja", flag: "🇩🇪", origin: "Berlin, Germany", lang: "de-DE", ttsVoice: "de-DE-KatjaNeural" },
    { name: "Jonas", flag: "🇩🇪", origin: "Munich, Germany", lang: "de-DE", ttsVoice: "de-DE-ConradNeural" },
    { name: "Emilia", flag: "🇦🇹", origin: "Vienna, Austria", lang: "de-AT", ttsVoice: "de-AT-IngridNeural" },
  ],
  it: [
    { name: "Giulia", flag: "🇮🇹", origin: "Rome, Italy", lang: "it-IT", ttsVoice: "it-IT-ElsaNeural" },
    { name: "Marco", flag: "🇮🇹", origin: "Milan, Italy", lang: "it-IT", ttsVoice: "it-IT-DiegoNeural" },
    { name: "Sofia", flag: "🇮🇹", origin: "Naples, Italy", lang: "it-IT", ttsVoice: "it-IT-IsabellaNeural" },
  ],
};

function personasFor(scenarioId) {
  return state.lang === "en" ? (PERSONAS[scenarioId] || []) : (LANG_PERSONAS[state.lang] || []);
}

const TYPE_LABELS = { grammar: "Grammaire", vocabulary: "Vocabulaire", register: "Registre", structure: "Structure" };
const SRS_INTERVALS = [0, 1, 3, 7, 14, 30]; // jours entre révisions selon le niveau de maîtrise

/* ═══════════════ Stockage local ═══════════════ */

const SYNC_KEYS = ["vocab", "sessions", "errors", "streak", "program", "lang", "pauseMs", "personaAccent", "voice", "phrasebook", "placement"];

const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem("lingualive_" + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem("lingualive_" + key, JSON.stringify(value));
    // Toute modification d'une donnée synchronisée est horodatée puis poussée au serveur
    if (SYNC_KEYS.includes(key)) {
      try {
        const meta = JSON.parse(localStorage.getItem("lingualive_meta") || "{}");
        meta[key] = Date.now();
        localStorage.setItem("lingualive_meta", JSON.stringify(meta));
      } catch {}
      scheduleSync();
    }
  },
};

/* ═══════════════ Synchronisation PC ↔ téléphone ═══════════════ */

let syncTimer = null;

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 2500);
}

async function syncNow() {
  clearTimeout(syncTimer);
  try {
    const data = {};
    for (const k of SYNC_KEYS) {
      const v = store.get(k, null);
      if (v !== null) data[k] = v;
    }
    const meta = JSON.parse(localStorage.getItem("lingualive_meta") || "{}");
    const res = await api("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, meta }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const merged = await res.json();
    // Réécrit l'état fusionné sans repasser par store.set (pas de nouvelle synchro)
    for (const k of SYNC_KEYS) {
      if (merged.data && merged.data[k] !== undefined && merged.data[k] !== null) {
        localStorage.setItem("lingualive_" + k, JSON.stringify(merged.data[k]));
      }
    }
    localStorage.setItem("lingualive_meta", JSON.stringify(merged.meta || {}));
    // Rafraîchit ce qui dépend des données fusionnées
    if (!state.inSession) {
      state.lang = store.get("lang", state.lang);
      state.pauseMs = store.get("pauseMs", state.pauseMs);
    }
    renderStreak();
    updateBadges();
    setSyncChip(true);
  } catch {
    setSyncChip(false);
  }
}

function setSyncChip(ok) {
  const chip = document.getElementById("syncChip");
  if (!chip) return;
  chip.textContent = ok ? "☁️" : "☁️✕";
  chip.style.opacity = ok ? "0.85" : "0.5";
  chip.title = ok
    ? "Synchronisé PC ↔ téléphone à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "Synchronisation impossible (hors ligne ?) — nouvel essai à la prochaine modification";
}

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
  lang: store.get("lang", "en"),
  persona: PERSONAS.daily[0],
  level: "B2",
  mission: "",
  handsFree: true,
  pauseMs: store.get("pauseMs", 2000), // silence avant envoi de la phrase
  history: [],        // [{role, text, corrections?, native?}]
  corrections: [],    // toutes les corrections de la session
  vocabSeen: [],      // vocab proposé pendant la session
  inSession: false,
  busy: false,
  missionDone: false,
  reviewQueue: [],
  programStepIndex: null, // étape du parcours en cours, le cas échéant
  targetTerms: [],        // session ciblée : [{term, translation, why, used}]
  repeatTarget: null,     // répétition en cours : {text, statusEl}
};

/* ═══════════════ Termes à placer (session ciblée) ═══════════════ */

function renderTermChips() {
  for (const id of ["termChips", "callTerms"]) {
    const box = document.getElementById(id);
    box.hidden = !state.targetTerms.length;
    box.innerHTML = "";
    for (const t of state.targetTerms) {
      const chip = document.createElement("span");
      chip.className = "term-chip" + (t.used ? " used" : "");
      chip.textContent = t.term;
      chip.title = `${t.translation} — ${t.why}`;
      box.appendChild(chip);
    }
  }
}

// Vérifie quels termes cibles apparaissent dans la prise de parole
function checkTargetTerms(userText) {
  if (!state.targetTerms.length) return;
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, " ").replace(/\s+/g, " ").trim();
  const said = " " + norm(userText) + " ";
  const placed = [];
  for (const t of state.targetTerms) {
    if (!t.used && said.includes(" " + norm(t.term) + " ")) {
      t.used = true;
      placed.push(t);
    }
  }
  if (!placed.length) return;
  state.termHintCounter = 0; // il vient d'en placer : pas de relance
  renderTermChips();
  creditVocabReviews(placed);

  const scroll = document.getElementById("chatScroll");
  for (const t of placed) {
    const ok = document.createElement("div");
    ok.className = "term-placed";
    ok.textContent = `✅ Terme placé : « ${t.term} »`;
    scroll.appendChild(ok);
    addCallToast((el) => { el.textContent = `✅ « ${t.term} » placé !`; }, "native");
  }
  scroll.scrollTop = scroll.scrollHeight;

  if (state.targetTerms.every((t) => t.used)) {
    const banner = document.createElement("div");
    banner.className = "mission-banner";
    banner.textContent = "🏆 Tous les termes placés !";
    scroll.appendChild(banner);
    scroll.scrollTop = scroll.scrollHeight;
    if (callOpen()) document.getElementById("callStatus").textContent = "🏆 Tous les termes placés !";
  }
}

// Employer un mot du SRS en vraie conversation vaut révision réussie
function creditVocabReviews(placedTerms) {
  const vocab = store.get("vocab", []);
  let changed = false;
  for (const t of placedTerms) {
    const v = vocab.find((x) => (x.lang || "en") === state.lang && x.term.toLowerCase() === t.term.toLowerCase());
    if (v && v.due <= Date.now()) {
      v.box = Math.min((v.box || 0) + 1, SRS_INTERVALS.length - 1);
      v.due = Date.now() + SRS_INTERVALS[v.box] * 86400000;
      v.touched = Date.now();
      changed = true;
    }
  }
  if (changed) { store.set("vocab", vocab); updateBadges(); }
}

// Relance discrète si plusieurs tours passent sans placer les termes restants
function maybeShowTermHint() {
  const remaining = state.targetTerms.filter((t) => !t.used);
  if (!remaining.length) return;
  state.termHintCounter = (state.termHintCounter || 0) + 1;
  if (state.termHintCounter < 2) return;
  state.termHintCounter = 0;
  const list = remaining.slice(0, 3).map((t) => `« ${t.term} »`).join(", ");
  const scroll = document.getElementById("chatScroll");
  const hint = document.createElement("div");
  hint.className = "coach-note";
  hint.textContent = `💡 Pense à placer : ${list}`;
  scroll.appendChild(hint);
  scroll.scrollTop = scroll.scrollHeight;
  addCallToast((el) => { el.textContent = `💡 À placer : ${list}`; });
}

/* ═══════════════ Synthèse vocale (TTS) ═══════════════ */

let voices = [];
let chosenVoiceURI = store.get("voice", null);

function loadVoices() {
  // Toutes les voix (l'appli est multilingue) ; pickVoice choisit selon l'interlocuteur
  voices = speechSynthesis.getVoices();
  const sel = document.getElementById("voiceSelect");
  sel.innerHTML = voices.map((v) =>
    `<option value="${v.voiceURI}" ${v.voiceURI === chosenVoiceURI ? "selected" : ""}>${v.name} (${v.lang})</option>`
  ).join("") || "<option value=''>Aucune voix anglaise trouvée</option>";
}
speechSynthesis.onvoiceschanged = loadVoices;

function pickVoice() {
  // 1. Accent de l'interlocuteur choisi (voix « naturelles » d'Edge en priorité),
  //    sinon n'importe quelle voix de la même langue de base (es, de, it…)
  const lang = state.inSession && state.persona && store.get("personaAccent", true) ? state.persona.lang : null;
  if (lang) {
    const base = lang.split("-")[0];
    const match = voices.find((v) => /natural/i.test(v.name) && v.lang === lang)
      || voices.find((v) => v.lang === lang)
      || voices.find((v) => /natural/i.test(v.name) && v.lang.startsWith(base))
      || voices.find((v) => v.lang.startsWith(base));
    if (match) return match;
  }
  // 2. Voix choisie manuellement dans les réglages
  if (chosenVoiceURI) {
    const v = voices.find((v) => v.voiceURI === chosenVoiceURI);
    if (v) return v;
  }
  // 3. Meilleure voix par défaut
  return voices.find((v) => /natural/i.test(v.name) && v.lang === "en-US")
    || voices.find((v) => /Google US English/i.test(v.name))
    || voices.find((v) => v.lang === "en-US")
    || voices[0];
}

const SPEECH_RATE = { B1: 0.85, B2: 0.95, C1: 1.0, C2: 1.08 };

let resumeTicker = null;
let currentAudio = null;

function stopAudio() {
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    try { currentAudio.pause(); } catch {}
    currentAudio = null;
  }
  speechSynthesis.cancel();
  clearInterval(resumeTicker);
}

// Voix neurales Microsoft générées côté serveur : naturelles et fidèles à l'accent
// de l'interlocuteur, sur tous les navigateurs. Repli : synthèse du navigateur.
// Voix serveur par défaut hors session, selon la langue d'étude
const DEFAULT_TTS = { en: "en-US-AriaNeural", es: "es-ES-ElviraNeural", de: "de-DE-KatjaNeural", it: "it-IT-ElsaNeural" };

async function speak(text, onend) {
  stopAudio();
  try {
    const voice = (state.inSession && state.persona && store.get("personaAccent", true) && state.persona.ttsVoice)
      ? state.persona.ttsVoice
      : (DEFAULT_TTS[state.lang] || "en-US-AriaNeural");
    const res = await api("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, level: state.level }),
    });
    if (!res.ok) throw new Error("tts " + res.status);
    const blob = await res.blob();
    if (!blob.size) throw new Error("audio vide");
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      onend && onend();
    };
    audio.onerror = () => { URL.revokeObjectURL(url); speakLocal(text, onend); };
    await audio.play();
    setCallState("speaking", text);
  } catch {
    speakLocal(text, onend);
  }
}

function speakLocal(text, onend) {
  speechSynthesis.cancel();
  clearInterval(resumeTicker);
  if (!voices.length) loadVoices(); // les voix arrivent parfois après le chargement de la page

  const utter = (voice, isRetry) => {
    const utt = new SpeechSynthesisUtterance(text);
    if (voice) { utt.voice = voice; utt.lang = voice.lang; }
    else utt.lang = "en-US";
    utt.rate = SPEECH_RATE[state.level] || 0.95;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(resumeTicker);
      onend && onend();
    };
    utt.onstart = () => setCallState("speaking", text);
    utt.onend = finish;
    utt.onerror = (e) => {
      // Certaines voix (notamment réseau) échouent en silence : on retente une fois avec la voix système par défaut
      if (!isRetry && e.error !== "interrupted" && e.error !== "canceled") {
        settled = true;
        clearInterval(resumeTicker);
        setTimeout(() => utter(null, true), 60);
        return;
      }
      finish();
    };
    // Contournement Chrome : la synthèse se met parfois en pause seule sur les textes longs
    resumeTicker = setInterval(() => { if (speechSynthesis.paused) speechSynthesis.resume(); }, 3000);
    speechSynthesis.speak(utt);
  };
  // Contournement Chrome : speak() immédiatement après cancel() est parfois ignoré
  setTimeout(() => utter(pickVoice(), false), 80);
}

/* ═══════════════ Reconnaissance vocale (STT) ═══════════════ */

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;      // le moteur tourne
let wantListening = false;  // on souhaite écouter (relance auto si le moteur s'arrête seul)
let finalBuffer = "";       // segments finalisés en attente d'envoi
let pendingAlts = [];       // transcriptions alternatives des segments
let silenceTimer = null;

function initRecognition() {
  if (!SpeechRec) {
    document.getElementById("micSupportNote").hidden = false;
    document.getElementById("micBtn").disabled = true;
    return;
  }
  recognition = new SpeechRec();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  // Écoute continue : on n'envoie qu'après un vrai silence (state.pauseMs),
  // pour ne jamais couper l'utilisateur en pleine phrase.
  recognition.continuous = true;
  recognition.maxAlternatives = 4;

  recognition.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) {
        finalBuffer = (finalBuffer + " " + res[0].transcript).trim();
        for (let j = 1; j < res.length; j++) {
          const alt = res[j].transcript.trim();
          if (alt && alt.toLowerCase() !== res[0].transcript.trim().toLowerCase()) pendingAlts.push(alt);
        }
      } else {
        interim += res[0].transcript;
      }
    }
    const live = (finalBuffer + " " + interim).trim();
    document.getElementById("interimText").textContent = live;
    if (callOpen() && live) document.getElementById("callCaption").textContent = live;
    scheduleUtteranceEnd();
  };
  recognition.onend = () => {
    listening = false;
    document.getElementById("micBtn").classList.remove("listening");
    // Le moteur s'arrête parfois seul (long silence, erreur réseau) : relance différée
    // — un redémarrage immédiat après un arrêt échoue souvent (InvalidStateError)
    if (wantListening && state.inSession && !state.busy) {
      setTimeout(tryRestartMic, 300);
    }
  };
  recognition.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      wantListening = false;
      const msg = "⚠️ Micro bloqué par le navigateur — clique sur l'icône 🔒/🎤 dans la barre d'adresse et autorise le micro.";
      document.getElementById("interimText").textContent = msg;
      if (callOpen()) document.getElementById("callCaption").textContent = msg;
    } else if (e.error === "aborted") {
      // Un seul onglet peut utiliser la reconnaissance vocale : des "aborted" en
      // rafale = un autre onglet LinguaLive ouvert nous vole le micro en boucle
      abortStreak.push(Date.now());
      abortStreak = abortStreak.filter((t) => Date.now() - t < 10000);
      if (abortStreak.length >= 3 && !document.hidden) {
        wantListening = false;
        const msg = "⚠️ Le micro est disputé par un autre onglet/fenêtre LinguaLive ouvert. Ferme les doublons (onglets et appli installée), puis clique sur le micro.";
        document.getElementById("interimText").textContent = msg;
        if (callOpen()) { document.getElementById("callCaption").textContent = msg; setCallState("", undefined); }
        abortStreak = [];
      }
    } else if (e.error !== "no-speech") {
      // Erreur passagère (network…) : on l'affiche et la relance auto fera le reste
      document.getElementById("interimText").textContent = `⚠️ micro : ${e.error} — reconnexion…`;
    }
  };

  // Chien de garde : si l'écoute est souhaitée mais que le moteur est tombé, on le relève
  setInterval(() => {
    if (wantListening && !listening && state.inSession && !state.busy) tryRestartMic();
  }, 3000);

  // Le micro n'appartient qu'à l'onglet visible : en arrière-plan on le lâche,
  // et on le reprend automatiquement quand l'onglet redevient actif
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (wantListening || listening) {
        micPausedByHide = true;
        stopListening();
      }
    } else if (micPausedByHide && state.inSession && !state.busy) {
      micPausedByHide = false;
      startListening();
    }
  });
}

let abortStreak = [];
let micPausedByHide = false;

function tryRestartMic() {
  if (!recognition || !wantListening || listening || state.busy || document.hidden) return;
  try {
    recognition.start();
    listening = true;
    document.getElementById("micBtn").classList.add("listening");
    setCallState("listening");
  } catch { /* le prochain passage du chien de garde retentera */ }
}

// (Re)démarre le compte à rebours de fin de phrase : tant que tu parles, il est repoussé
function scheduleUtteranceEnd() {
  clearTimeout(silenceTimer);
  if (!finalBuffer.trim()) return;
  silenceTimer = setTimeout(finishUtterance, state.pauseMs);
}

function finishUtterance() {
  const text = finalBuffer.trim();
  const alts = pendingAlts.slice(0, 6);
  finalBuffer = "";
  pendingAlts = [];
  if (!text) return;
  stopListening();
  // Mode répétition : on compare à la phrase modèle au lieu d'envoyer à l'IA
  if (state.repeatTarget) {
    const rt = state.repeatTarget;
    state.repeatTarget = null;
    const pct = Math.round(repeatScore(rt.text, text) * 100);
    if (rt.statusEl?.isConnected) {
      rt.statusEl.textContent = pct >= 75 ? `✅ ${pct} %` : `🔁 ${pct} % — réessaie`;
      rt.statusEl.classList.toggle("ok", pct >= 75);
    }
    // Reprend le fil de la conversation si on était en session mains libres
    if (state.inSession && state.handsFree && !state.busy) startListening();
    return;
  }
  sendTurn(text, { alternatives: alts });
}

/* ═══════════════ Répétition orale (phrase modèle → micro → score) ═══════════════ */

function repeatScore(target, said) {
  const norm = (s) => s.toLowerCase().replace(/\[[^\]]*\]/g, " ").replace(/[^\p{L}\p{N}' ]/gu, " ").replace(/\s+/g, " ").trim();
  const targetWords = norm(target).split(" ").filter(Boolean);
  const saidWords = new Set(norm(said).split(" "));
  if (!targetWords.length) return 0;
  return targetWords.filter((w) => saidWords.has(w)).length / targetWords.length;
}

function repeatDrill(text, statusEl) {
  if (state.repeatTarget) return; // une répétition à la fois
  stopAudio();
  stopListening();
  if (recognition) {
    recognition.lang = (state.inSession && state.persona?.lang)
      || ({ en: "en-US", es: "es-ES", de: "de-DE", it: "it-IT" }[state.lang] || "en-US");
  }
  if (statusEl) { statusEl.textContent = "🔊 écoute…"; statusEl.classList.remove("ok"); }
  state.repeatTarget = { text, statusEl };
  speak(text, () => {
    if (statusEl?.isConnected) statusEl.textContent = "🎤 à toi — répète la phrase";
    startListening();
  });
}

// Ligne réutilisable : phrase + traduction + écouter + répéter + score
function buildRepeatRow(text, subtitle, usage) {
  const row = document.createElement("div");
  row.className = "repeat-row";
  const body = document.createElement("div");
  body.className = "rr-body";
  const main = document.createElement("div");
  main.className = "rr-text";
  main.textContent = text;
  body.appendChild(main);
  if (subtitle) { const s = document.createElement("div"); s.className = "rr-sub"; s.textContent = subtitle; body.appendChild(s); }
  if (usage) { const u = document.createElement("div"); u.className = "rr-usage"; u.textContent = usage; body.appendChild(u); }
  const actions = document.createElement("div");
  actions.className = "rr-actions";
  const status = document.createElement("span");
  status.className = "rr-status";
  const listen = document.createElement("button");
  listen.className = "rv-btn";
  listen.textContent = "🔊";
  listen.title = "Écouter";
  listen.onclick = () => { state.repeatTarget = null; speak(text); };
  const rep = document.createElement("button");
  rep.className = "rv-btn know";
  rep.textContent = "🎤";
  rep.title = "Écouter puis répéter au micro";
  rep.onclick = () => repeatDrill(text, status);
  actions.append(status, listen, rep);
  row.append(body, actions);
  return row;
}

function startListening() {
  if (!recognition || state.busy) return;
  if (document.hidden) { micPausedByHide = true; return; } // repris au retour sur l'onglet
  stopAudio();
  wantListening = true;
  finalBuffer = "";
  pendingAlts = [];
  document.getElementById("interimText").textContent = "";
  if (!listening) {
    try {
      recognition.start();
      listening = true;
    } catch {
      // Moteur pas encore libéré : nouvel essai imminent (puis chien de garde)
      setTimeout(tryRestartMic, 350);
      return;
    }
  }
  document.getElementById("micBtn").classList.add("listening");
  setCallState("listening", "");
}

function stopListening() {
  wantListening = false;
  clearTimeout(silenceTimer);
  // abort() libère le micro immédiatement — indispensable sur mobile, où un micro
  // encore ouvert empêche la synthèse vocale de parler
  if (recognition && listening) try { recognition.abort(); } catch {}
  listening = false;
  document.getElementById("micBtn").classList.remove("listening");
}

/* ═══════════════ Mode appel (interaction immersive type Leo AI) ═══════════════ */

function callOverlayEl() { return document.getElementById("callOverlay"); }
function callOpen() { return !callOverlayEl().hidden; }

function openCall() {
  if (!state.inSession) return;
  callOverlayEl().hidden = false;
  document.getElementById("callFlag").textContent = state.persona?.flag || "🎙️";
  document.getElementById("callName").textContent = state.persona?.name || state.scenario.label;
  document.getElementById("callScenarioLabel").textContent =
    `${state.scenario.emoji} ${state.scenario.label} · ${state.level}${state.mission ? " · 🎯 mission en cours" : ""}`;
}

function closeCall() {
  callOverlayEl().hidden = true;
}

function setCallState(mode, caption) {
  if (!callOpen()) return;
  const o = callOverlayEl();
  o.classList.remove("speaking", "listening", "thinking");
  if (mode) o.classList.add(mode);
  const labels = {
    listening: "🟢 Je t'écoute — parle librement",
    thinking: "réfléchit…",
    speaking: `${state.persona?.name || "Ton interlocuteur"} parle — touche l'avatar pour l'interrompre`,
  };
  document.getElementById("callStatus").textContent = labels[mode] || "";
  if (caption !== undefined) document.getElementById("callCaption").textContent = caption;
}

function addCallToast(build, cls) {
  if (!callOpen()) return;
  const t = document.createElement("div");
  t.className = "call-toast" + (cls ? " " + cls : "");
  build(t);
  document.getElementById("callToasts").appendChild(t);
  setTimeout(() => t.remove(), 11000);
}

function callToastsFromCoach(t) {
  for (const c of t.corrections || []) {
    addCallToast((el) => {
      const o = document.createElement("span"); o.className = "c-orig"; o.textContent = c.original;
      const b = document.createElement("b"); b.textContent = " " + c.corrected;
      const ex = document.createElement("div"); ex.textContent = c.explanation; ex.style.opacity = ".8";
      el.append(o, b, ex);
    });
  }
  if (t.nativeVersion) {
    addCallToast((el) => {
      const b = document.createElement("b"); b.textContent = "🗣 Un natif dirait : ";
      const s = document.createElement("span"); s.textContent = t.nativeVersion;
      el.append(b, s);
    }, "native");
  }
}

document.getElementById("callToChatBtn").addEventListener("click", closeCall);
document.getElementById("backToCallBtn").addEventListener("click", openCall);
document.getElementById("callEndBtn").addEventListener("click", () => { closeCall(); endSession(); });
document.getElementById("callMicBtn").addEventListener("click", () => {
  if (listening) { stopListening(); setCallState("", ""); }
  else { stopAudio(); startListening(); }
});
// Toucher l'avatar pendant qu'il parle = l'interrompre et prendre la parole (comme au téléphone)
document.getElementById("callAvatar").addEventListener("click", () => {
  stopAudio();
  startListening();
});

/* ═══════════════ Navigation ═══════════════ */

const views = ["setup", "chat", "program", "phrases", "vocab", "progress", "errors"];

function show(view) {
  views.forEach((v) => (document.getElementById("view-" + v).hidden = v !== view));
  document.querySelectorAll(".tab").forEach((t) => {
    const target = t.dataset.view === "talk" ? (state.inSession ? "chat" : "setup") : t.dataset.view;
    t.classList.toggle("active", target === view);
  });
  if (view === "program") renderProgram();
  if (view === "phrases") renderPhrasebook();
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
  const langRow = document.getElementById("langRow");
  langRow.innerHTML = Object.entries(LANGS).map(([code, l]) => `
    <button class="level-pill ${code === state.lang ? "active" : ""}" data-lang="${code}">
      <strong>${l.flag}</strong><span>${l.label}</span>
    </button>`).join("");
  const grid = document.getElementById("scenarioGrid");
  grid.innerHTML = SCENARIOS.map((s) => `
    <button class="scenario-card ${s.id === state.scenario.id ? "active" : ""}" data-id="${s.id}">
      <span class="sc-emoji">${s.emoji}</span>
      <h3>${s.label}</h3>
      <p>${s.desc}</p>
    </button>`).join("");
  renderPersonas();
  renderMissions();
}

function renderPersonas() {
  const row = document.getElementById("personaRow");
  const list = personasFor(state.scenario.id);
  if (!list.some((p) => p.name === state.persona?.name)) state.persona = list[0];
  row.innerHTML = list.map((p) => `
    <button class="persona-card ${p.name === state.persona?.name ? "active" : ""}" data-name="${p.name}">
      <span class="p-flag">${p.flag}</span>
      <span><span class="p-name">${p.name}</span><br><span class="p-origin">${p.origin}</span></span>
    </button>`).join("");
}

document.getElementById("personaRow").addEventListener("click", (e) => {
  const card = e.target.closest(".persona-card");
  if (!card) return;
  state.persona = personasFor(state.scenario.id).find((p) => p.name === card.dataset.name);
  renderPersonas();
});

function renderMissions() {
  const sel = document.getElementById("missionSelect");
  sel.innerHTML = `<option value="">Pas de mission — conversation ouverte</option>` +
    state.scenario.missions.map((m) => `<option value="${m.replace(/"/g, "&quot;")}">🎯 ${m}</option>`).join("");
}

document.getElementById("langRow").addEventListener("click", (e) => {
  const pill = e.target.closest(".level-pill");
  if (!pill) return;
  state.lang = pill.dataset.lang;
  store.set("lang", state.lang);
  state.persona = personasFor(state.scenario.id)[0];
  renderSetup();
});

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

async function startSession(opts = {}) {
  if (opts.scenario) state.scenario = opts.scenario;
  if (opts.level) state.level = opts.level;
  if (opts.persona !== undefined) state.persona = opts.persona;
  if (!personasFor(state.scenario.id).some((p) => p.name === state.persona?.name)) {
    state.persona = personasFor(state.scenario.id)[0];
  }
  state.mission = opts.mission !== undefined ? opts.mission : document.getElementById("missionSelect").value;
  state.handsFree = document.getElementById("handsFreeToggle").checked;
  state.history = [];
  state.corrections = [];
  state.vocabSeen = [];
  state.missionDone = false;
  state.inSession = true;
  state.drillMode = !!opts.drill;
  state.placementMode = !!opts.placement;
  state.programStepIndex = opts.programStep ?? null;
  state.termHintCounter = 0;
  let terms = opts.targetTerms || [];
  // Sessions normales : les mots du jour à réviser (SRS) deviennent des termes à
  // placer — les employer en vraie conversation vaut révision réussie
  if (!terms.length && !state.placementMode) {
    terms = store.get("vocab", [])
      .filter((v) => (v.lang || "en") === state.lang && v.due <= Date.now())
      .slice(0, 3)
      .map((v) => ({ term: v.term, translation: v.translation, why: "révision du jour — l'employer valide ta révision" }));
  }
  state.targetTerms = terms.map((t) => ({ ...t, used: false }));
  state.targetErrors = opts.targetErrors || [];
  renderTermChips();
  const focusLine = document.getElementById("drillFocus");
  focusLine.hidden = !state.targetErrors.length;
  if (state.targetErrors.length) {
    focusLine.textContent = "🩹 " + state.targetErrors.map((e) => e.pattern).join(" · ");
    focusLine.title = state.targetErrors.map((e) => `${e.pattern} → ${e.tip}`).join("\n");
  }
  // La reconnaissance écoute dans la langue (et la variante régionale) de l'interlocuteur
  if (recognition) recognition.lang = state.persona?.lang || (state.lang === "en" ? "en-US" : state.lang);

  document.getElementById("chatScenario").textContent = `${state.scenario.emoji} ${state.scenario.label}`;
  document.getElementById("chatLevel").textContent = state.level;
  const pc = document.getElementById("chatPersona");
  pc.hidden = !state.persona;
  if (state.persona) pc.textContent = `${state.persona.flag} ${state.persona.name}`;
  const mc = document.getElementById("missionChip");
  mc.hidden = !state.mission;
  mc.classList.remove("done");
  if (state.mission) mc.textContent = "🎯 " + state.mission;
  document.getElementById("chatScroll").innerHTML = "";
  document.getElementById("callToasts").innerHTML = "";
  document.getElementById("callCaption").textContent = "";
  show("chat");
  openCall(); // interaction immersive type appel — 💬 pour basculer sur le chat

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
    nv.textContent = "🗣 Un natif dirait : « " + extras.nativeVersion + " » ";
    // Répéter la tournure native quand TU le décides — sans que la conversation s'arrête
    const rep = document.createElement("button");
    rep.className = "replay";
    rep.textContent = "🔁 répéter";
    rep.title = "Écouter la phrase puis la répéter au micro";
    const status = document.createElement("span");
    status.className = "rr-status";
    rep.onclick = (e) => { e.stopPropagation(); repeatDrill(extras.nativeVersion, status); };
    nv.append(rep, status);
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
  setCallState("thinking", opts.hidden ? "" : userText);

  // Un seul corps de requête, partagé par la réponse rapide et l'analyse.
  // L'historique est figé AVANT ce tour pour que les deux appels voient la même chose.
  const payload = JSON.stringify({
    scenario: { role: state.scenario.role, setting: state.scenario.setting, label: state.scenario.label },
    persona: state.persona ? { name: state.persona.name, origin: state.persona.origin } : null,
    language: LANGS[state.lang]?.name || "English",
    level: state.level,
    mission: state.mission,
    history: state.history.slice(),
    userText,
    alternatives: opts.alternatives || [],
    knownErrors: state.drillMode ? knownErrorPatterns() : [],
    targetTerms: state.targetTerms.filter((t) => !t.used).map((t) => t.term),
  });
  const post = (path) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });

  // L'analyse pédagogique part EN PARALLÈLE : elle s'affichera sous ta bulle
  // dès qu'elle arrive, pendant que l'interlocuteur parle déjà.
  const historyEntry = { role: "user", text: userText, corrections: [], native: "" };
  if (!opts.hidden) runCoach(post, userBubble, historyEntry);

  try {
    const res = await post("/api/reply");
    const data = await res.json();
    typing.remove();
    if (!res.ok) {
      if (res.status === 401) openSettings(data.error);
      addBubble("ai", "⚠️ " + (data.error || "Erreur serveur"));
      return;
    }
    if (!opts.hidden) checkTargetTerms(userText);
    state.history.push(historyEntry);
    state.history.push({ role: "assistant", text: data.reply });
    addBubble("ai", data.reply, {});
    if (!opts.hidden) maybeShowTermHint();
    speak(data.reply, () => {
      if (state.handsFree && state.inSession) startListening();
    });
  } catch (err) {
    typing.remove();
    addBubble("ai", "⚠️ Connexion impossible : " + err.message);
  } finally {
    state.busy = false;
  }
}

// Reçoit corrections, version native, vocab et statut de mission en arrière-plan
async function runCoach(post, userBubble, historyEntry) {
  try {
    const res = await post("/api/coach");
    if (!res.ok) return; // l'analyse est optionnelle : la conversation continue sans elle
    const { coach: t } = await res.json();
    state.corrections.push(...(t.corrections || []));
    historyEntry.corrections = t.corrections || [];
    historyEntry.native = t.nativeVersion || "";
    if (t.vocab?.length) state.vocabSeen.push(...t.vocab);
    if (userBubble && userBubble.isConnected) addUserAnnotations(userBubble, t);
    callToastsFromCoach(t);

    if (t.missionStatus === "accomplished" && !state.missionDone) {
      state.missionDone = true;
      const mc = document.getElementById("missionChip");
      mc.classList.add("done");
      mc.textContent = "✅ Mission accomplie !";
      const scroll = document.getElementById("chatScroll");
      const banner = document.createElement("div");
      banner.className = "mission-banner";
      banner.textContent = "🎉 Mission accomplie !";
      scroll.appendChild(banner);
      scroll.scrollTop = scroll.scrollHeight;
    }
  } catch { /* silencieux : le coaching ne doit jamais bloquer la conversation */ }
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
  stopAudio();
  closeCall();
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
        language: LANGS[state.lang]?.name || "English",
        languageFr: LANGS[state.lang]?.labelFr || "anglais",
        level: state.level,
        mission: state.mission,
        history: state.history,
        corrections: state.corrections,
        drillReport: state.targetTerms.length
          ? { terms: state.targetTerms.map((t) => ({ term: t.term, used: t.used })) }
          : null,
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
    root.appendChild(el("h3", null, "🗣 Comme un natif — atelier de répétition"));
    root.appendChild(el("p", "muted", "Le moment idéal pour ancrer les tournures : écoute chaque phrase (🔊) puis répète-la au micro (🎤) — l'appli vérifie."));
    for (const u of d.nativeUpgrades) {
      root.appendChild(buildRepeatRow(u.better, "au lieu de : " + u.original));
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
    lang: state.lang,
    persona: state.persona ? `${state.persona.flag} ${state.persona.name}` : "",
    level: state.level,
    mission: state.mission,
    missionDone: state.missionDone,
    turns: state.history.filter((m) => m.role === "user").length,
    errors: state.corrections.length,
    errorsByType,
    cefr: debrief?.cefrEstimate || "",
    // Transcript complet (avec corrections par réplique) pour l'historique consultable
    messages: state.history,
  });
  store.set("sessions", sessions.slice(0, 80));

  // Étape de parcours accomplie
  if (state.programStepIndex !== null) {
    const program = store.get("program", null);
    if (program && program.steps[state.programStepIndex]) {
      program.completed[state.programStepIndex] = true;
      store.set("program", program);
    }
  }

  // Vocabulaire → SRS
  const vocab = store.get("vocab", []);
  for (const v of state.vocabSeen) {
    if (!vocab.some((x) => x.term.toLowerCase() === v.term.toLowerCase())) {
      vocab.push({ ...v, context: state.scenario.label, lang: state.lang, box: 0, due: Date.now(), added: Date.now(), touched: Date.now() });
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

  // Test de niveau : mémorise le résultat pour pré-régler le parcours
  if (state.placementMode && debrief?.cefrEstimate) {
    store.set("placement", { level: debrief.cefrEstimate, date: new Date().toISOString(), lang: state.lang });
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
  card.querySelector(".rc-ctx").textContent =
    `Comment dit-on ça en ${LANGS[item.lang]?.labelFr || "anglais"} ? · contexte : ${item.context}`;
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
    v.touched = Date.now();
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
    if (s.messages?.length) { row.style.cursor = "pointer"; row.title = "Voir la conversation complète"; }
    const d = new Date(s.date);
    row.innerHTML = `<span class="s-date">${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
      <span class="s-scen"></span>
      <span class="muted">${s.turns} tours · ${s.errors} corr.</span>
      <span class="s-cefr">${s.cefr || ""}</span>${s.messages?.length ? '<span class="muted">📜</span>' : ""}`;
    row.querySelector(".s-scen").textContent = `${s.lang && s.lang !== "en" ? LANGS[s.lang]?.flag + " " : ""}${s.emoji} ${s.scenario}${s.persona ? " · " + s.persona : ""}${s.missionDone ? " · 🎯✓" : ""}`;
    if (s.messages?.length) row.onclick = () => openTranscript(s);
    rows.appendChild(row);
  }
}

/* ═══════════════ Historique : transcript d'une session ═══════════════ */

function openTranscript(session) {
  const root = document.getElementById("historyContent");
  root.innerHTML = "";
  const h2 = document.createElement("h2");
  const d = new Date(session.date);
  h2.textContent = `📜 ${session.emoji} ${session.scenario} — ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
  root.appendChild(h2);
  const sub = document.createElement("p");
  sub.className = "muted";
  sub.textContent = `${session.persona ? session.persona + " · " : ""}Niveau ${session.level}${session.mission ? " · 🎯 " + session.mission : ""}${session.cefr ? " · estimé " + session.cefr : ""}`;
  root.appendChild(sub);

  const wrap = document.createElement("div");
  wrap.className = "transcript";
  for (const m of session.messages) {
    if (m.role === "user" && m.text.startsWith("(the conversation starts")) continue;
    const div = document.createElement("div");
    div.className = "t-msg " + (m.role === "user" ? "user" : "ai");
    const txt = document.createElement("span");
    txt.textContent = m.text;
    div.appendChild(txt);
    if (m.role === "assistant") {
      const replay = document.createElement("button");
      replay.className = "replay";
      replay.textContent = " 🔊";
      replay.title = "Réécouter";
      replay.onclick = () => speak(m.text);
      div.appendChild(replay);
    }
    if (m.corrections?.length) {
      for (const c of m.corrections) {
        const corr = document.createElement("div");
        corr.className = "t-corr";
        corr.innerHTML = `<span class="c-orig"></span> → <b></b> · <span></span>`;
        corr.querySelector(".c-orig").textContent = c.original;
        corr.querySelector("b").textContent = c.corrected;
        corr.querySelector("span:last-child").textContent = c.explanation;
        div.appendChild(corr);
      }
    }
    if (m.native) {
      const nv = document.createElement("div");
      nv.className = "t-native";
      nv.textContent = "🗣 " + m.native;
      div.appendChild(nv);
    }
    wrap.appendChild(div);
  }
  root.appendChild(wrap);
  document.getElementById("historyModal").hidden = false;
}

document.getElementById("historyCloseBtn").addEventListener("click", () => {
  stopAudio();
  document.getElementById("historyModal").hidden = true;
});

/* ═══════════════ Vue parcours (niveau départ → niveau cible) ═══════════════ */

const LEVELS = ["B1", "B2", "C1", "C2"];

function renderProgram() {
  const root = document.getElementById("programContent");
  const program = store.get("program", null);

  if (!program) {
    const placement = store.get("placement", null);
    const placedLevel = placement ? (placement.level.match(/^[ABC][12]/) || [])[0] : null;
    root.innerHTML = `
      <section class="panel">
        <h2>🎓 Mon parcours de progression</h2>
        <p class="muted">Un programme d'étapes sur mesure, du niveau où tu es vers le niveau que tu vises — contextes variés, missions concrètes, difficulté croissante. Chaque étape est une conversation de 10-15 minutes.</p>
        <div class="placement-box">
          ${placement
            ? `<span>📊 Niveau évalué : <b>${placement.level}</b> <span class="muted">(test du ${new Date(placement.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })})</span></span>
               <button class="ghost-btn" id="placementBtn" style="width:auto;margin:0">Repasser le test</button>`
            : `<span>Tu ne connais pas ton niveau réel ? Passe le <b>test de niveau</b> : ~10 échanges avec un évaluateur qui monte en difficulté, et ton niveau de départ se règle tout seul.</span>
               <button class="cta small" id="placementBtn" style="margin:0">📊 Passer le test (~10 min)</button>`}
        </div>
        <div class="program-form-row">
          <div>
            <label class="field-label">Je pars de</label>
            <select id="progStart" class="mission-select">${LEVELS.slice(0, 3).map((l) => `<option ${l === "B1" ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
          <div>
            <label class="field-label">Je vise</label>
            <select id="progTarget" class="mission-select">${LEVELS.slice(1).map((l) => `<option ${l === "C1" ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
        </div>
        <div class="program-form-row">
          <div>
            <label class="field-label">Mon rythme</label>
            <select id="progRhythm" class="mission-select">
              <option value="14">2 étapes par jour</option>
              <option value="7">1 étape par jour</option>
              <option value="5" selected>5 étapes par semaine</option>
              <option value="3">3 étapes par semaine</option>
              <option value="2">2 étapes par semaine</option>
            </select>
          </div>
          <div>
            <label class="field-label">Mes priorités (optionnel)</label>
            <input type="text" id="progPriorities" class="mission-select" placeholder="ex : entretiens, réunions clients…">
          </div>
        </div>
        <button class="cta" id="progGenBtn" style="margin-top:16px">✨ Générer mon parcours</button>
        <p class="error-text" id="progError"></p>
      </section>`;
    document.getElementById("progGenBtn").addEventListener("click", generateProgram);
    document.getElementById("placementBtn").addEventListener("click", () => {
      startSession({
        placement: true,
        scenario: PLACEMENT_SCENARIO,
        mission: "",
        level: placedLevel || "B2",
      });
    });
    // Pré-règle le niveau de départ sur le niveau évalué
    if (placedLevel && LEVELS.slice(0, 3).includes(placedLevel)) {
      document.getElementById("progStart").value = placedLevel;
    }
    return;
  }

  const done = program.completed.filter(Boolean).length;
  const total = program.steps.length;
  const nextIdx = program.completed.findIndex((c) => !c);
  const frac = total ? done / total : 0;

  // Temps de conversation total et restant
  const stepMin = (s) => s.durationMin || 12;
  const totalMin = program.steps.reduce((a, s) => a + stepMin(s), 0);
  const remainingMin = program.steps.reduce((a, s, i) => a + (program.completed[i] ? 0 : stepMin(s)), 0);
  const fmtH = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}` : `${min} min`);

  // Rythme → durée calendaire et date de fin estimées
  const rhythm = program.rhythmPerWeek || 5;
  const remainingSteps = total - done;
  const daysLeft = Math.ceil((remainingSteps / rhythm) * 7);
  const endDate = new Date(Date.now() + daysLeft * 86400000);
  const endStr = endDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const RHYTHM_LABELS = { 14: "2 étapes/jour", 7: "1 étape/jour", 5: "5 étapes/sem.", 3: "3 étapes/sem.", 2: "2 étapes/sem." };

  // Jauge de niveau : position selon le niveau réellement DÉMONTRÉ (estimations
  // CEFR des 5 dernières sessions, pondérées vers le récent) — pas selon le
  // simple comptage de séances (qui reste sur la barre du dessous)
  const span = LEVELS.slice(LEVELS.indexOf(program.startLevel), LEVELS.indexOf(program.targetLevel) + 1);
  const measured = measuredLevelNum();
  const startN = cefrToNum(program.startLevel);
  const targetN = cefrToNum(program.targetLevel);
  const levelFrac = measured === null ? 0 : Math.max(0, Math.min(1, (measured - startN) / (targetN - startN)));
  const currentLabel = measured === null ? program.startLevel : numToCefr(measured);
  const nbMeasures = store.get("sessions", []).filter((s) => cefrToNum(s.cefr) !== null).slice(0, 5).length;

  root.innerHTML = `
    <div class="program-header">
      <h2>🎓 ${program.title}</h2>
      <button class="ghost-btn" id="progResetBtn" style="width:auto;margin:0">Nouveau parcours</button>
    </div>

    <div class="gauge-card">
      <div class="gauge-labels">${span.map((l, i) => `<span style="left:${(i / (span.length - 1)) * 100}%">${l}</span>`).join("")}</div>
      <div class="level-gauge">
        <div class="lg-fill" style="width:${levelFrac * 100}%"></div>
        <div class="lg-marker" style="left:${levelFrac * 100}%"><span>≈ ${currentLabel}</span></div>
      </div>
      <p class="muted" style="font-size:0.8rem;margin:-22px 0 12px">${measured === null
        ? "La jauge avancera avec ton niveau réellement démontré en session (mesuré à chaque débrief)."
        : `Niveau mesuré sur tes ${nbMeasures} dernières sessions — c'est ta production réelle qui fait avancer la jauge, pas le nombre de séances.`}</p>
      <div class="gauge-stats">
        <span>🏁 ${done} / ${total} étapes</span>
        <span>⏱ ${fmtH(remainingMin)} de conversation restantes (sur ${fmtH(totalMin)})</span>
        <span>🗓 ${remainingSteps ? `fin estimée le <b>${endStr}</b>` : "parcours terminé 🎉"}</span>
      </div>
      <div class="gauge-rhythm">
        <label>Mon rythme :</label>
        <select id="progRhythmEdit" class="mission-select" style="width:auto">
          ${Object.entries(RHYTHM_LABELS).map(([v, l]) => `<option value="${v}" ${Number(v) === rhythm ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="program-progressbar"><div style="width:${frac * 100}%"></div></div>
    <div id="programSteps"></div>`;

  root.querySelector("#progRhythmEdit").addEventListener("change", (e) => {
    program.rhythmPerWeek = parseInt(e.target.value, 10) || 5;
    store.set("program", program);
    renderProgram();
  });

  const stepsRoot = root.querySelector("#programSteps");
  program.steps.forEach((step, i) => {
    const scen = SCENARIOS.find((s) => s.id === step.scenarioId) || SCENARIOS[5];
    const div = document.createElement("div");
    div.className = "program-step" + (program.completed[i] ? " done" : "") + (i === nextIdx ? " next" : "");
    div.innerHTML = `
      <span class="ps-num">${program.completed[i] ? "✓" : i + 1}</span>
      <div class="ps-body">
        <div class="ps-title">${scen.emoji} <span></span> <span class="lvl-chip">${step.level}</span> <span class="muted" style="font-weight:400">⏱ ${step.durationMin || 12} min</span></div>
        <div class="ps-meta">🎯 <span></span></div>
        <div class="ps-focus">📌 Point travaillé : <span></span></div>
      </div>
      <button class="cta small">${program.completed[i] ? "Refaire" : "Démarrer"}</button>`;
    div.querySelector(".ps-title span:not(.lvl-chip)").textContent = step.title;
    div.querySelector(".ps-meta span").textContent = step.mission;
    div.querySelector(".ps-focus span").textContent = step.focus;
    div.querySelector("button.cta").addEventListener("click", () => startProgramStep(i));
    stepsRoot.appendChild(div);
  });
  root.querySelector("#progResetBtn").addEventListener("click", () => {
    if (confirm("Abandonner ce parcours et en créer un nouveau ?")) {
      localStorage.removeItem("lingualive_program");
      renderProgram();
    }
  });
}

async function generateProgram() {
  const btn = document.getElementById("progGenBtn");
  const err = document.getElementById("progError");
  const startLevel = document.getElementById("progStart").value;
  const targetLevel = document.getElementById("progTarget").value;
  if (LEVELS.indexOf(targetLevel) <= LEVELS.indexOf(startLevel)) {
    err.textContent = "Le niveau visé doit être supérieur au niveau de départ.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "⏳ Génération du parcours (30 s environ)…";
  err.textContent = "";
  try {
    const res = await api("/api/program", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startLevel,
        targetLevel,
        priorities: document.getElementById("progPriorities").value.trim(),
        languageFr: LANGS[state.lang]?.labelFr || "anglais",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur serveur");
    store.set("program", {
      ...data.program,
      startLevel,
      targetLevel,
      rhythmPerWeek: parseInt(document.getElementById("progRhythm").value, 10) || 5,
      completed: data.program.steps.map(() => false),
      createdAt: Date.now(),
    });
    renderProgram();
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false;
    btn.textContent = "✨ Générer mon parcours";
  }
}

function startProgramStep(i) {
  const program = store.get("program", null);
  const step = program?.steps[i];
  if (!step) return;
  const scenario = SCENARIOS.find((s) => s.id === step.scenarioId) || SCENARIOS[5];
  startSession({
    scenario,
    level: step.level,
    mission: `${step.mission} — Point à travailler : ${step.focus}`,
    programStep: i,
  });
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

document.getElementById("drillBtn").addEventListener("click", async () => {
  const btn = document.getElementById("drillBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Préparation de ta session sur mesure…";
  try {
    // Vocabulaire fragile : mots retombés en boîte 0-1 lors des révisions
    const weakVocab = store.get("vocab", [])
      .filter((v) => (v.lang || "en") === state.lang && v.box <= 1)
      .slice(0, 10)
      .map((v) => ({ term: v.term, translation: v.translation }));
    const res = await api("/api/drillplan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        errors: store.get("errors", []).slice(0, 10),
        weakVocab,
        language: LANGS[state.lang]?.name || "English",
        languageFr: LANGS[state.lang]?.labelFr || "anglais",
        level: state.level,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur serveur");
    showDrillBriefing(data.plan);
  } catch (e) {
    // Repli : session ciblée simple (erreurs seulement, sans termes imposés)
    alert("Plan indisponible (" + e.message + ") — session ciblée simple lancée.");
    startSession({ drill: true, mission: "" });
  } finally {
    btn.disabled = false;
    btn.textContent = "🎯 Session ciblée sur mes erreurs";
  }
});

/* ═══════════════ Bibliothèque de phrases ═══════════════ */

let pbScenarioId = null;

function renderPhrasebook() {
  if (!pbScenarioId) pbScenarioId = state.scenario.id;
  const chips = document.getElementById("pbScenarios");
  chips.innerHTML = SCENARIOS.map((s) => `
    <button class="pb-chip ${s.id === pbScenarioId ? "active" : ""}" data-id="${s.id}">${s.emoji} ${s.label}</button>`).join("");

  const root = document.getElementById("pbContent");
  root.innerHTML = "";
  const key = state.lang + "|" + pbScenarioId;
  const cache = store.get("phrasebook", {});
  const book = cache[key];

  if (!book) {
    const btn = document.createElement("button");
    btn.className = "cta";
    btn.style.marginTop = "14px";
    btn.textContent = `✨ Générer les phrases de base — ${SCENARIOS.find((s) => s.id === pbScenarioId)?.label} (${LANGS[state.lang].label})`;
    btn.onclick = () => generatePhrasebook(btn);
    root.appendChild(btn);
    return;
  }

  for (const section of book.sections) {
    const h = document.createElement("h3");
    h.className = "plan-h3";
    h.textContent = section.title;
    root.appendChild(h);
    for (const p of section.phrases) {
      root.appendChild(buildRepeatRow(p.text, p.fr, p.usage));
    }
  }
  const refresh = document.createElement("button");
  refresh.className = "ghost-btn";
  refresh.style.width = "auto";
  refresh.textContent = "♻️ Régénérer cette bibliothèque";
  refresh.onclick = () => generatePhrasebook(refresh);
  root.appendChild(refresh);
}

document.getElementById("pbScenarios").addEventListener("click", (e) => {
  const chip = e.target.closest(".pb-chip");
  if (!chip) return;
  pbScenarioId = chip.dataset.id;
  renderPhrasebook();
});

async function generatePhrasebook(btn) {
  const scen = SCENARIOS.find((s) => s.id === pbScenarioId);
  btn.disabled = true;
  btn.textContent = "⏳ Génération (~20 s)…";
  try {
    const res = await api("/api/phrasebook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: { label: scen.label, setting: scen.setting },
        language: LANGS[state.lang]?.name || "English",
        languageFr: LANGS[state.lang]?.labelFr || "anglais",
        level: state.level,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur serveur");
    const cache = store.get("phrasebook", {});
    cache[state.lang + "|" + pbScenarioId] = { ...data.phrasebook, generatedAt: Date.now() };
    store.set("phrasebook", cache);
    renderPhrasebook();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "⚠️ " + e.message + " — réessayer";
  }
}

/* ═══════════════ Briefing d'entraînement ciblé ═══════════════ */

let pendingDrillPlan = null;

function showDrillBriefing(plan) {
  pendingDrillPlan = plan;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const root = document.getElementById("planContent");
  root.innerHTML = "";
  root.appendChild(el("h2", null, "🎯 " + plan.title));
  root.appendChild(el("p", "muted", plan.focusSummary));

  const scen = SCENARIOS.find((s) => s.id === plan.scenarioId);
  root.appendChild(el("p", null, `${scen?.emoji || "💬"} ${scen?.label || ""} — 🎯 ${plan.mission}`));

  if (plan.targetErrors?.length) {
    root.appendChild(el("h3", "plan-h3", "🩹 Tes erreurs dans le viseur"));
    for (const e of plan.targetErrors) {
      const row = el("div", "plan-row");
      row.appendChild(el("b", null, e.pattern));
      row.appendChild(el("div", "muted", "→ " + e.tip));
      root.appendChild(row);
    }
  }
  root.appendChild(el("h3", "plan-h3", "💬 Les termes à placer (coche-les en les prononçant)"));
  for (const t of plan.targetTerms || []) {
    const row = el("div", "plan-row");
    row.appendChild(el("b", null, t.term));
    row.appendChild(el("span", "muted", " — " + t.translation));
    row.appendChild(el("div", "plan-why", t.why));
    root.appendChild(row);
  }
  document.getElementById("planModal").hidden = false;
}

document.getElementById("planStartBtn").addEventListener("click", () => {
  document.getElementById("planModal").hidden = true;
  if (!pendingDrillPlan) return;
  const plan = pendingDrillPlan;
  pendingDrillPlan = null;
  startSession({
    drill: true,
    scenario: SCENARIOS.find((s) => s.id === plan.scenarioId) || state.scenario,
    mission: plan.mission,
    targetTerms: plan.targetTerms,
    targetErrors: plan.targetErrors || [],
  });
});
document.getElementById("planCancelBtn").addEventListener("click", () => {
  document.getElementById("planModal").hidden = true;
  pendingDrillPlan = null;
});

/* ═══════════════ Réglages / clé API ═══════════════ */

function openSettings(errorMsg = "") {
  document.getElementById("settingsModal").hidden = false;
  document.getElementById("keyError").textContent = errorMsg;
  api("/api/status").then((r) => r.json()).then((s) => {
    document.getElementById("keyStatus").textContent = s.keyConfigured
      ? `✓ Clé API configurée · modèle : ${s.model}`
      : "Aucune clé API configurée — colle ta clé Anthropic ci-dessous.";
    const labels = { elevenlabs: "✓ ElevenLabs actif", openai: "✓ OpenAI actif", edge: "(actuellement : voix Edge gratuites)" };
    document.getElementById("ttsProviderInfo").textContent = s.premiumIssue === "quota"
      ? "⚠️ Clé OK mais AUCUN CRÉDIT sur le compte — ajoute du crédit (Billing), les voix Edge sont utilisées en attendant"
      : s.premiumIssue
        ? "⚠️ Fournisseur premium en erreur — voix Edge utilisées en attendant"
        : (labels[s.ttsProvider] || "");
  }).catch(() => {});
  loadVoices();
  document.getElementById("pauseSelect").value = String(state.pauseMs);
  document.getElementById("accentToggle").checked = store.get("personaAccent", true);
  const v = pickVoice();
  document.getElementById("voiceInfo").textContent = v ? `Voix actuelle : ${v.name}` : "⚠️ Aucune voix anglaise détectée";

  // Accès mobile : URL du tunnel + QR code (visible uniquement depuis le PC)
  api("/api/tunnel").then((r) => r.json()).then((d) => {
    const box = document.getElementById("mobileAccess");
    if (!d.url) { box.hidden = true; return; }
    box.hidden = false;
    document.getElementById("tunnelQr").src = d.qr;
    const a = document.getElementById("tunnelUrl");
    a.textContent = d.url;
    a.href = d.url;
  }).catch(() => {});
}

document.getElementById("voiceTestBtn").addEventListener("click", () => {
  const v = pickVoice();
  document.getElementById("voiceInfo").textContent = v ? `Voix actuelle : ${v.name}` : "⚠️ Aucune voix anglaise détectée";
  speak("Hello! Can you hear me clearly? This is how I will sound during our conversations.");
});

document.getElementById("accentToggle").addEventListener("change", (e) => {
  store.set("personaAccent", e.target.checked);
});

document.getElementById("pauseSelect").addEventListener("change", (e) => {
  state.pauseMs = parseInt(e.target.value, 10) || 2000;
  store.set("pauseMs", state.pauseMs);
});

document.getElementById("settingsBtn").addEventListener("click", () => openSettings());
document.getElementById("settingsCloseBtn").addEventListener("click", () => (document.getElementById("settingsModal").hidden = true));
document.getElementById("voiceSelect").addEventListener("change", (e) => {
  chosenVoiceURI = e.target.value;
  store.set("voice", chosenVoiceURI);
  const v = voices.find((v) => v.voiceURI === chosenVoiceURI);
  if (v) speak("Hello! This is how I sound.");
});

document.getElementById("ttsKeySaveBtn").addEventListener("click", async () => {
  const err = document.getElementById("ttsKeyError");
  err.textContent = "";
  try {
    const res = await api("/api/ttskey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: document.getElementById("ttsProviderSelect").value,
        key: document.getElementById("ttsKeyInput").value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error; return; }
    document.getElementById("ttsKeyInput").value = "";
    openSettings();
    speak("Hello! Here is my new voice. Quite an upgrade, don't you think?");
  } catch (e) {
    err.textContent = "Connexion impossible : " + e.message;
  }
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
// Récupère l'état fusionné des autres appareils au démarrage, puis rafraîchit l'écran
syncNow().then(() => { if (!state.inSession) renderSetup(); });
