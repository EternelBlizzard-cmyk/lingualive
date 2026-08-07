const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
// Réutilise la clé configurée pour SlideForge si aucune clé locale
if (!process.env.ANTHROPIC_API_KEY) {
  require("dotenv").config({ path: path.join(__dirname, "..", "slideforge", ".env") });
}
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3100;
// Sonnet par défaut : la latence compte pour une conversation orale fluide
const MODEL = process.env.LINGUALIVE_MODEL || "claude-sonnet-5";
const MAX_HISTORY = 24; // tours conservés dans le contexte de conversation

// timeout/maxRetries explicites : sans eux, une connexion morte fait pendre la
// requête plusieurs minutes et l'appli reste bloquée sur « réfléchit »
const CLIENT_OPTS = { timeout: 60000, maxRetries: 2 };
let client = new Anthropic(CLIENT_OPTS);

const ENV_PATH = path.join(__dirname, ".env");

function saveEnvVar(name, value) {
  process.env[name] = value;
  let env = "";
  if (fs.existsSync(ENV_PATH)) {
    env = fs.readFileSync(ENV_PATH, "utf-8").replace(new RegExp(`^${name}=.*$`, "m"), "").trim();
  }
  fs.writeFileSync(ENV_PATH, `${name}=${value}\n${env ? env + "\n" : ""}`);
}

function setApiKey(key) {
  client = new Anthropic({ ...CLIENT_OPTS, apiKey: key });
  saveEnvVar("ANTHROPIC_API_KEY", key);
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Contrôle de santé de l'hébergeur : volontairement hors de /api pour ne pas être
// bloqué par le code d'accès (sinon Render conclut que l'appli est morte)
app.get("/healthz", (req, res) => res.type("text").send("ok"));

// Protection par code d'accès quand l'appli est exposée sur Internet (tunnel/hébergement).
// Sans ACCESS_CODE dans l'environnement, tout passe (usage purement local).
const ACCESS_CODE = (process.env.ACCESS_CODE || "").trim();
app.use("/api", (req, res, next) => {
  // Sur le PC lui-même (localhost), pas de code : seul l'accès via Internet (tunnel/hébergement) est protégé
  const local = ["localhost", "127.0.0.1", "::1"].includes(req.hostname);
  if (!ACCESS_CODE || local || req.get("x-access-code") === ACCESS_CODE) return next();
  res.status(401).json({ error: "Code d'accès requis.", codeRequired: true });
});

// --- Schéma d'un tour de conversation ---

const TURN_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "Your in-character spoken reply in English, adapted to the learner's CEFR level. Natural spoken language, 1-4 sentences, ends with something that invites the learner to keep talking (a question, a request, a reaction).",
    },
    corrections: {
      type: "array",
      description:
        "Real language errors in the learner's LAST utterance only. Empty array if none. Never invent errors. Ignore punctuation/capitalization (input comes from speech recognition).",
      items: {
        type: "object",
        properties: {
          original: { type: "string", description: "The erroneous fragment, quoted from the learner" },
          corrected: { type: "string", description: "The corrected fragment" },
          type: {
            type: "string",
            enum: ["grammar", "vocabulary", "register", "structure"],
            description:
              "grammar: conjugaison, temps, accords, articles, prépositions; vocabulary: mot inexact, faux ami, calque du français; register: niveau de langue inadapté au contexte; structure: ordre des mots, tournure non idiomatique",
          },
          explanation: { type: "string", description: "Explication brève et pédagogique EN FRANÇAIS (1 phrase)" },
        },
        required: ["original", "corrected", "type", "explanation"],
        additionalProperties: false,
      },
    },
    nativeVersion: {
      type: "string",
      description:
        "How a native speaker would naturally express the learner's last utterance, if meaningfully more idiomatic than what they said. Empty string if their phrasing was already natural.",
    },
    vocab: {
      type: "array",
      description:
        "0 to 3 genuinely useful words or expressions from this exchange (from your reply or the corrections) worth memorizing for this scenario. Prefer expressions over single common words.",
      items: {
        type: "object",
        properties: {
          term: { type: "string", description: "The English word or expression" },
          translation: { type: "string", description: "Traduction française" },
          example: { type: "string", description: "Short natural example sentence in English" },
        },
        required: ["term", "translation", "example"],
        additionalProperties: false,
      },
    },
    coachNote: {
      type: "string",
      description:
        "Optional short coaching tip IN FRENCH (rythme, stratégie de réponse, conseil culturel, encouragement ciblé). Empty string most turns — only when genuinely useful.",
    },
    missionStatus: {
      type: "string",
      enum: ["none", "in_progress", "accomplished"],
      description:
        "If a mission was set: 'accomplished' the moment the learner has clearly achieved it, otherwise 'in_progress'. 'none' when no mission.",
    },
  },
  required: ["reply", "corrections", "nativeVersion", "vocab", "coachNote", "missionStatus"],
  additionalProperties: false,
};

const LEVEL_GUIDE = {
  B1: "Use high-frequency vocabulary and simple sentence structures. Speak in short sentences. Be patient, rephrase if needed. Avoid idioms and phrasal verbs beyond the most common ones.",
  B2: "Use everyday vocabulary with some richer expressions and common phrasal verbs. Normal sentence complexity. Occasionally introduce a useful idiom.",
  C1: "Speak naturally as with a fluent colleague: idioms, phrasal verbs, nuance, hypotheticals, humour. Expect precision and push back on vague answers.",
  C2: "Speak as with a native professional: fast-paced, idiomatic, culturally loaded references, irony, complex argumentation. Challenge the learner intellectually.",
};

function turnSystemPrompt({ scenario, level, mission, knownErrors, persona, language = "English" }) {
  return `You are LinguaLive, a ${language} conversation partner and language coach for a French-speaking learner. The entire conversation is in ${language}.

ROLE-PLAY
You are playing this character, realistically and consistently: ${persona ? `${persona.name}, from ${persona.origin} — ` : ""}${scenario.role}
Setting: ${scenario.setting}
${persona ? `Stay ${persona.name} throughout. Use turns of phrase, vocabulary and cultural references typical of ${language} speakers from ${persona.origin}.` : ""}
${mission ? `The learner has a mission to accomplish in this conversation: "${mission}". Give them realistic opportunities to achieve it (including obstacles or objections when the scenario calls for it), and mark missionStatus "accomplished" as soon as they clearly succeed.` : "No specific mission: keep a lively, engaging conversation going within the scenario."}

LEVEL — CEFR ${level}
${LEVEL_GUIDE[level] || LEVEL_GUIDE.B2}
If the learner is clearly comfortable, gradually raise complexity within the level. If they struggle (very short answers, misunderstandings), simplify and slow down — without breaking character.

COACHING (applies to the learner's LAST utterance only)
- The utterance comes from speech recognition: no punctuation, and occasional mis-transcribed homophones. Never correct punctuation or capitalization. Flag a suspected transcription artifact only if it is clearly a language error regardless.
- The utterance may be followed by a bracketed line "[reconnaissance — autres transcriptions possibles: ...]": these are alternative ways the recognizer heard the SAME speech (the learner typed none of this — never treat the bracketed line as their words). Cross-reference them: if a word looks odd but an alternative or the context suggests the learner actually said something correct, respond to the intended meaning and do NOT flag it as an error. If the whole utterance is unintelligible even with alternatives, stay in character and ask them to repeat.
- Report every real error in "corrections" with a brief French explanation. No error → empty array. Never invent errors to seem useful.
- "nativeVersion": give the natural native phrasing when the learner's sentence was understandable but clunky. Empty string when already natural.
${knownErrors && knownErrors.length ? `- The learner's recurring weaknesses: ${knownErrors.join("; ")}. Occasionally steer the conversation so they must use these patterns, and be especially vigilant about them.` : ""}
- Stay in character in "reply" — coaching lives ONLY in the structured fields, never in the reply text.
- "reply" is spoken aloud by text-to-speech: plain conversational text, no lists, no markdown, no stage directions.`;
}

app.post("/api/turn", async (req, res) => {
  const { scenario, level = "B2", mission = "", history = [], userText = "", knownErrors = [], alternatives = [], persona = null, language = "English" } = req.body || {};
  if (!scenario || !scenario.role) return res.status(400).json({ error: "Scénario manquant." });
  if (!userText.trim()) return res.status(400).json({ error: "Message vide." });

  const messages = history
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
  const alts = (Array.isArray(alternatives) ? alternatives : []).filter((a) => a && a.trim()).slice(0, 6);
  messages.push({
    role: "user",
    content: userText.trim() + (alts.length ? `\n[reconnaissance — autres transcriptions possibles: ${alts.join(" | ")}]` : ""),
  });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // appel conversationnel court et fréquent : raisonnement coupé (latence)
      thinking: { type: "disabled" },
      system: turnSystemPrompt({ scenario, level, mission, knownErrors, persona, language }),
      output_config: { format: { type: "json_schema", schema: TURN_SCHEMA } },
      messages,
    });
    if (message.stop_reason === "refusal") {
      return res.status(422).json({ error: "Réponse refusée pour ce contenu. Reformulez." });
    }
    const textBlock = message.content.find((b) => b.type === "text");
    res.json({ turn: JSON.parse(textBlock.text) });
  } catch (err) {
    handleApiError(err, res);
  }
});

// --- Schéma du débrief de fin de session ---

const DEBRIEF_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Bilan global de la session en français, 2-3 phrases, ton encourageant mais honnête" },
    cefrEstimate: {
      type: "string",
      description: "Estimation du niveau réellement démontré pendant la session, ex: 'B2', 'B2+', 'C1-'. Basée sur la production réelle, pas sur le niveau choisi.",
    },
    strengths: { type: "array", items: { type: "string" }, description: "2-4 points forts observés, en français, concrets (citer des exemples de la session)" },
    improvements: { type: "array", items: { type: "string" }, description: "2-4 axes d'amélioration prioritaires, en français, concrets et actionnables" },
    recurringErrors: {
      type: "array",
      description: "Motifs d'erreur apparus plusieurs fois ou typiques des francophones, à retravailler",
      items: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Le motif d'erreur, en français, ex: 'oubli du -s à la 3e personne'" },
          type: { type: "string", enum: ["grammar", "vocabulary", "register", "structure"] },
          advice: { type: "string", description: "Comment le corriger durablement, en français, 1 phrase" },
        },
        required: ["pattern", "type", "advice"],
        additionalProperties: false,
      },
    },
    nativeUpgrades: {
      type: "array",
      description: "2-4 phrases dites par l'apprenant, reformulées comme un natif (les plus utiles à retenir)",
      items: {
        type: "object",
        properties: {
          original: { type: "string", description: "Ce que l'apprenant a dit" },
          better: { type: "string", description: "La version naturelle d'un natif" },
        },
        required: ["original", "better"],
        additionalProperties: false,
      },
    },
    nextSteps: { type: "array", items: { type: "string" }, description: "2-3 recommandations pour les prochaines sessions (scénarios, niveau, points à cibler), en français" },
  },
  required: ["summary", "cefrEstimate", "strengths", "improvements", "recurringErrors", "nativeUpgrades", "nextSteps"],
  additionalProperties: false,
};

app.post("/api/debrief", async (req, res) => {
  const { scenario, level = "B2", mission = "", history = [], corrections = [], language = "English", languageFr = "anglais", drillReport = null } = req.body || {};
  if (!history.length) return res.status(400).json({ error: "Aucune conversation à analyser." });

  const transcript = history
    .map((m) => `${m.role === "assistant" ? "COACH" : "LEARNER"}: ${m.text}`)
    .join("\n");
  const corrList = corrections
    .map((c) => `- [${c.type}] "${c.original}" → "${c.corrected}" (${c.explanation})`)
    .join("\n");

  const prompt = `Session de conversation en ${languageFr} terminée. Analyse la production de l'apprenant.

Scénario : ${scenario?.label || "conversation libre"} — ${scenario?.setting || ""}
Niveau choisi : ${level}${mission ? `\nMission : ${mission}` : ""}

TRANSCRIPT
${transcript}

CORRECTIONS RELEVÉES PENDANT LA SESSION
${corrList || "(aucune)"}${drillReport ? `

SESSION D'ENTRAÎNEMENT CIBLÉ — termes à placer :
${drillReport.terms.map((t) => `- "${t.term}" : ${t.used ? "PLACÉ ✓" : "NON PLACÉ ✗"}`).join("\n")}
Commente dans le bilan la façon dont les termes ont été employés (ou pas) et si les erreurs ciblées ont été évitées.` : ""}`;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system:
        `Tu es un professeur de ${languageFr} (${language}) expérimenté, spécialiste des apprenants francophones. Tu produis un débrief de session honnête, précis et actionnable. Tu t'appuies uniquement sur ce qui s'est réellement passé dans le transcript.`,
      output_config: { format: { type: "json_schema", schema: DEBRIEF_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return res.status(422).json({ error: "Analyse refusée pour ce contenu." });
    }
    const textBlock = message.content.find((b) => b.type === "text");
    res.json({ debrief: JSON.parse(textBlock.text) });
  } catch (err) {
    handleApiError(err, res);
  }
});

// --- Conversation en 2 temps : réponse rapide (latence minimale) + analyse en parallèle ---

const FAST_MODEL = process.env.LINGUALIVE_FAST_MODEL || "claude-haiku-4-5-20251001";

function targetTermsBlock(targetTerms) {
  if (!targetTerms || !targetTerms.length) return "";
  return `
TARGET EXPRESSIONS — the learner is training to use these: ${targetTerms.join(" · ")}.
Steer the conversation so THEY get natural openings to use each one (ask questions or create situations that call for them). Do not use these expressions yourself before the learner does — leave them the opening.`;
}

function replySystemPrompt({ scenario, level, mission, persona, language = "English", targetTerms = [] }) {
  return `You are a ${language} conversation partner for a French-speaking learner. The conversation is entirely in ${language}. Role-play only — no coaching, no corrections, no meta-comments.

You are: ${persona ? `${persona.name}, from ${persona.origin} — ` : ""}${scenario.role}
Setting: ${scenario.setting}
${persona ? `Use turns of phrase typical of ${language} speakers from ${persona.origin}.` : ""}
${mission ? `The learner is trying to accomplish: "${mission}". Give them realistic opportunities (including light obstacles).` : ""}

CEFR ${level}: ${LEVEL_GUIDE[level] || LEVEL_GUIDE.B2}
${targetTermsBlock(targetTerms)}
Rules:
- Stay in character, react to what they said, keep the conversation moving with a question or hook.
- 1 to 3 short spoken sentences. Plain text only — it is read aloud by text-to-speech.
- The learner's message may end with a bracketed "[reconnaissance — autres transcriptions possibles: ...]" line: alternative speech-recognition transcriptions of the same words. Use them to understand what was really said; never mention them.
- Never correct the learner: respond to their intended meaning.`;
}

app.post("/api/reply", async (req, res) => {
  const { scenario, level = "B2", mission = "", history = [], userText = "", alternatives = [], persona = null, language = "English", targetTerms = [] } = req.body || {};
  if (!scenario || !scenario.role) return res.status(400).json({ error: "Scénario manquant." });
  if (!userText.trim()) return res.status(400).json({ error: "Message vide." });

  const messages = history
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
  const alts = (Array.isArray(alternatives) ? alternatives : []).filter((a) => a && a.trim()).slice(0, 6);
  messages.push({
    role: "user",
    content: userText.trim() + (alts.length ? `\n[reconnaissance — autres transcriptions possibles: ${alts.join(" | ")}]` : ""),
  });

  try {
    const message = await client.messages.create({
      model: FAST_MODEL,
      max_tokens: 300,
      // Haiku 4.5 : sans paramètre thinking, pas de raisonnement — c'est déjà le
      // réglage voulu pour cet appel ultra-fréquent (ne pas ajouter "disabled",
      // seul le format {type:"enabled", budget_tokens} existe sur ce modèle)
      system: replySystemPrompt({ scenario, level, mission, persona, language, targetTerms }),
      messages,
    });
    const textBlock = message.content.find((b) => b.type === "text");
    res.json({ reply: (textBlock?.text || "").trim() });
  } catch (err) {
    handleApiError(err, res);
  }
});

// Analyse pédagogique (corrections, version native, vocab) — mêmes champs que /api/turn sans "reply"
const COACH_SCHEMA = {
  type: "object",
  properties: {
    corrections: TURN_SCHEMA.properties.corrections,
    nativeVersion: TURN_SCHEMA.properties.nativeVersion,
    vocab: TURN_SCHEMA.properties.vocab,
    coachNote: TURN_SCHEMA.properties.coachNote,
    missionStatus: TURN_SCHEMA.properties.missionStatus,
  },
  required: ["corrections", "nativeVersion", "vocab", "coachNote", "missionStatus"],
  additionalProperties: false,
};

app.post("/api/coach", async (req, res) => {
  const { scenario, level = "B2", mission = "", history = [], userText = "", alternatives = [], knownErrors = [], language = "English" } = req.body || {};
  if (!userText.trim()) return res.status(400).json({ error: "Message vide." });

  const transcript = history
    .slice(-MAX_HISTORY)
    .map((m) => `${m.role === "assistant" ? "PARTNER" : "LEARNER"}: ${m.text}`)
    .join("\n");
  const alts = (Array.isArray(alternatives) ? alternatives : []).filter((a) => a && a.trim()).slice(0, 6);

  const prompt = `Conversation so far (scenario: ${scenario?.label || "free"} — ${scenario?.setting || ""}, level ${level}${mission ? `, learner's mission: "${mission}"` : ""}):
${transcript || "(start of conversation)"}

LEARNER's new utterance to analyse:
${userText.trim()}${alts.length ? `\n[speech recognition alternatives for the same words: ${alts.join(" | ")}]` : ""}`;

  const system = `You are a ${language} coach for a French-speaking learner. The learner speaks in ${language}. Analyse ONLY the learner's new utterance.
- It comes from speech recognition: no punctuation, occasional mis-transcribed homophones. Never correct punctuation/capitalization. Use the bracketed alternatives (the learner typed none of this) and the context to infer what was really said; do not flag transcription artifacts as errors.
- Report every real error in "corrections" (explanation in French, 1 sentence). No error → empty array. Never invent errors.
- "nativeVersion": natural native phrasing if their sentence was clunky; empty string if already natural.
- "vocab": 0-3 genuinely useful words/expressions for this scenario (prefer expressions).
- "coachNote": short French tip, empty most of the time.
- "missionStatus": ${mission ? `"accomplished" the moment the mission "${mission}" is clearly achieved in the conversation, else "in_progress"` : `"none"`}.
${knownErrors && knownErrors.length ? `- Recurring weaknesses to watch: ${knownErrors.join("; ")}.` : ""}`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      // appelé à chaque tour en parallèle de /api/reply : raisonnement coupé (latence)
      thinking: { type: "disabled" },
      system,
      output_config: { format: { type: "json_schema", schema: COACH_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    res.json({ coach: JSON.parse(textBlock.text) });
  } catch (err) {
    handleApiError(err, res);
  }
});

// --- Synthèse vocale neurale (voix Microsoft Edge, tous accents) ---

const TTS_RATES = { B1: "-12%", B2: "-4%", C1: "+0%", C2: "+8%" };
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
// Une instance par voix, réutilisée entre les phrases : évite de rouvrir
// une connexion à chaque réplique (~1 s gagnée)
const ttsPool = new Map();

async function getTtsStream(voice, text, rate) {
  let tts = ttsPool.get(voice);
  if (!tts) {
    tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    ttsPool.set(voice, tts);
  }
  const result = await tts.toStream(text, { rate });
  return result.audioStream || result;
}

// --- Voix premium (optionnelles) : ElevenLabs ou OpenAI, repli automatique sur Edge ---

// Voix ElevenLabs pré-faites correspondant à nos interlocuteurs (accents UK/US/AU
// disponibles ; les accents IN/ZA/SG restent sur Edge, qui les fait mieux)
const ELEVEN_VOICES = {
  "en-GB-SoniaNeural": "Xb7hH8MSUJpSbSDYk0k2",       // Alice — britannique
  "en-GB-LibbyNeural": "pFZP5JQG7iQjIQuC4Bku",       // Lily — britannique
  "en-GB-RyanNeural": "JBFqnCBsd6RMkjVDRZzb",        // George — britannique
  "en-GB-ThomasNeural": "onwK4e9ZLuTAKqWW03F9",      // Daniel — britannique
  "en-US-JennyNeural": "cgSgspJ2msm6clMCkdW9",       // Jessica — américaine
  "en-US-AriaNeural": "21m00Tcm4TlvDq8ikWAM",        // Rachel — américaine
  "en-US-GuyNeural": "nPczCjzI2devNBz1zQrb",         // Brian — américain
  "en-US-ChristopherNeural": "bIHbv24MWmeRgasZH58o", // Will — américain
  "en-US-EricNeural": "nPczCjzI2devNBz1zQrb",        // Brian — américain
  "en-AU-WilliamNeural": "IKne3meq5aSn9XLyUdCD",     // Charlie — australien
};

// OpenAI gpt-4o-mini-tts : la voix + des instructions de jeu (accent, ton, débit)
const OPENAI_PACE = {
  B1: "Speak slowly and very clearly, with simple intonation.",
  B2: "Speak at a relaxed, natural pace.",
  C1: "Speak at a natural conversational pace.",
  C2: "Speak at a brisk, fully natural native pace.",
};
const OPENAI_VOICES = {
  "en-GB-SoniaNeural": ["coral", "British accent (London), warm and friendly woman."],
  "en-GB-LibbyNeural": ["shimmer", "British accent, cheerful young woman."],
  "en-GB-RyanNeural": ["echo", "British accent (Manchester), friendly man."],
  "en-GB-ThomasNeural": ["onyx", "British accent (London), professional man."],
  "en-US-JennyNeural": ["nova", "American accent, friendly professional woman."],
  "en-US-AriaNeural": ["coral", "American accent, confident professional woman."],
  "en-US-GuyNeural": ["ash", "New York American accent, easygoing man."],
  "en-US-ChristopherNeural": ["onyx", "American accent, calm professional man."],
  "en-US-EricNeural": ["echo", "American accent, energetic man."],
  "en-AU-WilliamNeural": ["ash", "Australian accent, laid-back man."],
  "en-IN-NeerjaNeural": ["nova", "Indian English accent (Mumbai), warm professional woman."],
  "en-IN-PrabhatNeural": ["onyx", "Indian English accent, courteous professional man."],
  "en-ZA-LeahNeural": ["shimmer", "South African English accent, friendly woman."],
  "en-SG-LunaNeural": ["nova", "Singaporean English accent, efficient friendly woman."],
  "es-ES-ElviraNeural": ["coral", "Castilian Spanish from Madrid, warm expressive woman. Speak Spanish."],
  "es-MX-JorgeNeural": ["onyx", "Mexican Spanish from Mexico City, friendly man. Speak Spanish."],
  "es-AR-ElenaNeural": ["nova", "Argentinian Spanish from Buenos Aires, lively woman. Speak Spanish."],
  "de-DE-KatjaNeural": ["coral", "Standard German from Berlin, warm professional woman. Speak German."],
  "de-DE-ConradNeural": ["onyx", "Standard German from Munich, calm friendly man. Speak German."],
  "de-AT-IngridNeural": ["shimmer", "Austrian German from Vienna, cheerful woman. Speak German."],
  "it-IT-ElsaNeural": ["coral", "Italian from Rome, warm expressive woman. Speak Italian."],
  "it-IT-DiegoNeural": ["echo", "Italian from Milan, energetic man. Speak Italian."],
  "it-IT-IsabellaNeural": ["nova", "Italian from Naples, lively friendly woman. Speak Italian."],
};

async function elevenTts(voiceId, text, level) {
  const speed = { B1: 0.85, B2: 0.95, C1: 1.0, C2: 1.1 }[level] || 1.0;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_flash_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed },
    }),
  });
  if (!r.ok) throw new Error("ElevenLabs HTTP " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function openaiTts(voice, text, level) {
  const [voiceName, style] = OPENAI_VOICES[voice] || ["coral", "Natural English accent."];
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: voiceName,
      input: text,
      instructions: `${style} ${OPENAI_PACE[level] || OPENAI_PACE.B2} You are a conversation partner in a language-learning app: sound alive and human.`,
      response_format: "mp3",
    }),
  });
  if (!r.ok) throw new Error("OpenAI TTS HTTP " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

function ttsProvider() {
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "edge";
}

// Quand le fournisseur premium échoue (crédit épuisé…), on l'écarte 5 minutes
// pour ne pas payer sa latence à chaque phrase, et on l'affiche dans les réglages
let premiumSkipUntil = 0;
let premiumIssue = "";

app.post("/api/tts", async (req, res) => {
  const { text = "", voice = "en-US-AriaNeural", level = "B2" } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: "Texte vide." });
  const cleanText = text.slice(0, 2000);

  // 1. Voix premium si une clé est configurée (échec → repli Edge, jamais de silence)
  if (Date.now() > premiumSkipUntil) {
    try {
      if (process.env.ELEVENLABS_API_KEY && ELEVEN_VOICES[voice]) {
        const buf = await elevenTts(ELEVEN_VOICES[voice], cleanText, level);
        premiumIssue = "";
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");
        return res.send(buf);
      }
      if (process.env.OPENAI_API_KEY) {
        const buf = await openaiTts(voice, cleanText, level);
        premiumIssue = "";
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");
        return res.send(buf);
      }
    } catch (err) {
      console.error("Voix premium indisponible, repli Edge :", err.message);
      premiumSkipUntil = Date.now() + 5 * 60000;
      premiumIssue = /429/.test(err.message) ? "quota" : "erreur";
    }
  }

  // 2. Voix neurales Edge (gratuites)
  const rate = TTS_RATES[level] || "+0%";
  try {
    let stream;
    try {
      stream = await getTtsStream(voice, cleanText, rate);
    } catch {
      // Connexion expirée : on repart d'une instance neuve
      ttsPool.delete(voice);
      stream = await getTtsStream(voice, cleanText, rate);
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    stream.on("error", () => { ttsPool.delete(voice); try { res.destroy(); } catch {} });
    stream.pipe(res);
  } catch (err) {
    console.error("Erreur TTS:", err.message);
    ttsPool.delete(voice);
    res.status(500).json({ error: "Synthèse vocale indisponible : " + err.message });
  }
});

// Enregistre une clé de voix premium (saisie par l'utilisateur dans les réglages)
app.post("/api/ttskey", async (req, res) => {
  const provider = (req.body?.provider || "").trim();
  // Nettoie les guillemets/espaces qu'un copier-coller peut embarquer
  const key = (req.body?.key || "").trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, "");
  if (!["elevenlabs", "openai"].includes(provider)) return res.status(400).json({ error: "Fournisseur inconnu." });
  if (!key) {
    // Champ vide = désactiver ce fournisseur
    saveEnvVar(provider === "elevenlabs" ? "ELEVENLABS_API_KEY" : "OPENAI_API_KEY", "");
    delete process.env[provider === "elevenlabs" ? "ELEVENLABS_API_KEY" : "OPENAI_API_KEY"];
    return res.json({ ok: true, ttsProvider: ttsProvider() });
  }
  try {
    if (provider === "elevenlabs") {
      // On valide en générant réellement un mini-échantillon : c'est la permission
      // "Text to Speech" qui compte (les clés restreintes échouent sur /v1/user)
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM?output_format=mp3_22050_32`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hi!", model_id: "eleven_flash_v2_5" }),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        console.error("Validation ElevenLabs:", r.status, detail.slice(0, 400));
        // Traduit la raison exacte renvoyée par ElevenLabs
        let status = "", msg = "";
        try { const j = JSON.parse(detail); status = j?.detail?.status || ""; msg = j?.detail?.message || ""; } catch {}
        const REASONS = {
          invalid_api_key: "La clé est invalide ou incomplète — copie-la juste après sa création (elle n'est affichée qu'une fois, la version masquée de la liste ne marche pas).",
          missing_permissions: "La clé n'a pas la permission « Text to Speech » — modifie-la ou crée une clé sans restrictions.",
          detected_unusual_activity: "ElevenLabs bloque l'offre GRATUITE sur ce réseau (VPN/proxy détecté). Désactive tout VPN, ou passe au plan Starter (5 $/mois).",
          quota_exceeded: "Crédits ElevenLabs épuisés pour ce mois.",
        };
        return res.status(401).json({
          error: `Clé ElevenLabs refusée (HTTP ${r.status}${status ? " · " + status : ""}). ${REASONS[status] || msg || "Vérifie la clé et ses permissions."}`,
        });
      }
      saveEnvVar("ELEVENLABS_API_KEY", key);
    } else {
      // Même principe : on teste la permission qui compte (génération audio),
      // ce qui détecte aussi l'absence de crédit
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "coral", input: "Hi!", response_format: "mp3" }),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        console.error("Validation OpenAI:", r.status, detail.slice(0, 400));
        let code = "", msg = "";
        try { const j = JSON.parse(detail); code = j?.error?.code || ""; msg = j?.error?.message || ""; } catch {}
        const REASONS = {
          invalid_api_key: "La clé est invalide ou incomplète — copie-la juste après sa création.",
          insufficient_quota: "Aucun crédit sur le compte OpenAI — ajoute du crédit dans platform.openai.com → Settings → Billing (5 $ minimum).",
          model_not_found: "Cette clé n'a pas accès au modèle de voix — crée une clé sans restrictions (permissions par défaut).",
        };
        return res.status(401).json({
          error: `Clé OpenAI refusée (HTTP ${r.status}${code ? " · " + code : ""}). ${REASONS[code] || msg || "Vérifie la clé."}`,
        });
      }
      saveEnvVar("OPENAI_API_KEY", key);
    }
    res.json({ ok: true, ttsProvider: ttsProvider() });
  } catch (err) {
    res.status(500).json({ error: "Validation impossible : " + err.message });
  }
});

// --- Bibliothèque de phrases : structures de base par contexte ---

const PHRASEBOOK_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      description: "4 à 6 situations clés de ce contexte (ex: se présenter, ouvrir la conversation, demander de répéter, conclure...)",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre de la situation, en français" },
          phrases: {
            type: "array",
            description: "3 à 5 phrases-structures réutilisables, du plus simple au plus élaboré",
            items: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  description: "La phrase dans la langue cible, avec des [crochets] pour les parties à personnaliser, ex: Hi, I'm [name]. I work as [role] at [company].",
                },
                fr: { type: "string", description: "Traduction française (avec les mêmes [crochets])" },
                usage: { type: "string", description: "Note d'usage en français très courte : registre, quand l'employer. Chaîne vide si évident." },
              },
              required: ["text", "fr", "usage"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "phrases"],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
};

app.post("/api/phrasebook", async (req, res) => {
  const { scenario, language = "English", languageFr = "anglais", level = "B2" } = req.body || {};
  if (!scenario || !scenario.label) return res.status(400).json({ error: "Contexte manquant." });

  const prompt = `Construis la bibliothèque de phrases de référence en ${languageFr} (${language}) pour le contexte « ${scenario.label} » (${scenario.setting}).

Objectif : donner à un apprenant francophone (niveau ${level}) des STRUCTURES réutilisables sur lesquelles s'appuyer à l'oral — des squelettes de phrases avec des [crochets] à personnaliser, pas des phrases figées.
Exemple du type attendu pour se présenter : "Hi, I'm [name]. I work as [role] at [company]. Lately I've been working on [project], and on the side I [activity]."
Couvre les situations incontournables du contexte, du basique au plus élaboré, avec les tournures que les natifs emploient vraiment à l'oral.`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      // génération longue et rare : raisonnement adaptatif explicite (qualité)
      thinking: { type: "adaptive" },
      system:
        "Tu es un professeur de langue orale pragmatique : tu fournis des structures de phrases directement réutilisables en conversation réelle, idiomatiques et naturelles, jamais scolaires.",
      output_config: { format: { type: "json_schema", schema: PHRASEBOOK_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    res.json({ phrasebook: JSON.parse(textBlock.text) });
  } catch (err) {
    handleApiError(err, res);
  }
});

// --- Blocs structurés : monologues guidés (pitchs) de 1 à 3 minutes + évaluation ---

const BLOCKS_SCHEMA = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      description: "2 à 3 blocs structurés incontournables pour ce contexte : des monologues guidés de 1 à 3 minutes (pitch, réponse structurée, récit...)",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre du bloc en français, ex: 'Pitch de présentation personnelle'" },
          targetDuration: { type: "string", description: "Durée cible, ex: '1 min 30 – 2 min'" },
          goal: { type: "string", description: "En français, une phrase : ce que ce bloc permet d'accomplir" },
          parts: {
            type: "array",
            description: "4 à 7 parties ORDONNÉES qui structurent le monologue, chacune avec son squelette de phrase(s)",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Nom de la partie en français, ex: 'Accroche', 'Mon rôle', 'Projets récents'" },
                text: { type: "string", description: "Le squelette dans la langue cible avec [crochets] à personnaliser, 1-2 phrases" },
                fr: { type: "string", description: "Traduction française" },
              },
              required: ["label", "text", "fr"],
              additionalProperties: false,
            },
          },
          tips: { type: "array", items: { type: "string" }, description: "1 à 3 conseils de livraison en français (rythme, transitions, pièges)" },
        },
        required: ["title", "targetDuration", "goal", "parts", "tips"],
        additionalProperties: false,
      },
    },
  },
  required: ["blocks"],
  additionalProperties: false,
};

app.post("/api/blocks", async (req, res) => {
  const { scenario, language = "English", languageFr = "anglais", level = "B2" } = req.body || {};
  if (!scenario || !scenario.label) return res.status(400).json({ error: "Contexte manquant." });

  const prompt = `Conçois les blocs structurés de référence en ${languageFr} (${language}) pour le contexte « ${scenario.label} » (${scenario.setting}), niveau ${level}.

Un bloc = un monologue guidé de 1 à 3 minutes que l'apprenant doit savoir dérouler avec assurance (ex: pitch de présentation personnelle, présentation d'un projet, réponse structurée type STAR, monologue d'examen, récit d'une anecdote). Chaque partie enchaîne logiquement sur la précédente avec des transitions naturelles à l'oral.
Exemple du type attendu pour un pitch perso : Accroche → Mon rôle ("I'm [name], I work as [role] at [company]") → Travaux récents ("Lately I've been working on [project]") → En parallèle ("On the side, I [activity]") → Ouverture.`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      // génération longue et rare : raisonnement adaptatif explicite (qualité)
      thinking: { type: "adaptive" },
      system:
        "Tu es un coach de prise de parole en langue étrangère : tu construis des trames de monologues réutilisables, naturelles à l'oral, avec des transitions fluides entre les parties.",
      output_config: { format: { type: "json_schema", schema: BLOCKS_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    res.json({ blocks: JSON.parse(textBlock.text).blocks });
  } catch (err) {
    handleApiError(err, res);
  }
});

// Évaluation d'une récitation de bloc
const BLOCKEVAL_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "Note globale sur 100 : structure suivie, langue, fluidité apparente, complétude" },
    verdict: { type: "string", description: "Bilan en français, 1-2 phrases, honnête et encourageant" },
    coverage: {
      type: "array",
      description: "Pour CHAQUE partie du bloc, dans l'ordre : a-t-elle été couverte ?",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Le nom de la partie (repris du bloc)" },
          covered: { type: "boolean" },
          comment: { type: "string", description: "En français, très court : ce qui a été fait ou ce qui manque" },
        },
        required: ["label", "covered", "comment"],
        additionalProperties: false,
      },
    },
    strengths: { type: "array", items: { type: "string" }, description: "2-3 points forts, en français, concrets" },
    improvements: { type: "array", items: { type: "string" }, description: "2-3 améliorations prioritaires, en français, concrètes" },
    nativeUpgrades: {
      type: "array",
      description: "2-4 phrases dites par l'apprenant reformulées comme un natif (les plus utiles)",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          better: { type: "string" },
        },
        required: ["original", "better"],
        additionalProperties: false,
      },
    },
  },
  required: ["score", "verdict", "coverage", "strengths", "improvements", "nativeUpgrades"],
  additionalProperties: false,
};

app.post("/api/blockeval", async (req, res) => {
  const { block, transcript = "", language = "English", languageFr = "anglais", level = "B2" } = req.body || {};
  if (!block || !block.parts) return res.status(400).json({ error: "Bloc manquant." });
  if (!transcript.trim()) return res.status(400).json({ error: "Aucune prise de parole à évaluer." });

  const prompt = `L'apprenant (francophone, niveau ${level}) devait dérouler ce bloc structuré en ${languageFr} (${language}) :

BLOC « ${block.title} » (durée cible ${block.targetDuration || "1-3 min"})
${block.parts.map((p, i) => `${i + 1}. ${p.label} — modèle : ${p.text}`).join("\n")}

SA PRODUCTION (transcription de reconnaissance vocale — ignore la ponctuation manquante et les homophones douteux) :
${transcript.trim()}

Évalue : chaque partie a-t-elle été couverte (même avec d'autres mots que le modèle — c'est le fond qui compte) ? Qualité de la langue et des transitions ? Note sur 100 exigeante mais juste.`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      // évaluation complexe (note, couverture partie par partie) : raisonnement adaptatif
      thinking: { type: "adaptive" },
      system:
        "Tu es un coach de prise de parole exigeant et bienveillant, spécialiste des apprenants francophones. Tu évalues la récitation d'un monologue structuré : couverture des parties, langue, naturel. Tu t'appuies uniquement sur la transcription fournie.",
      output_config: { format: { type: "json_schema", schema: BLOCKEVAL_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    res.json({ eval: JSON.parse(textBlock.text) });
  } catch (err) {
    handleApiError(err, res);
  }
});

// --- Plan d'entraînement ciblé : scénario construit sur les erreurs + termes à placer ---

const DRILL_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Titre court et motivant de la session d'entraînement, en français" },
    scenarioId: {
      type: "string",
      enum: ["daily", "business", "interview", "appointment", "presentation", "exam", "free"],
      description: "Le contexte le plus propice pour faire travailler ces erreurs et ces termes",
    },
    mission: {
      type: "string",
      description: "Mission concrète en français, conçue pour forcer l'apprenant à affronter ses erreurs récurrentes",
    },
    targetTerms: {
      type: "array",
      description: "5 à 7 termes/expressions que l'apprenant devra placer pendant la conversation : mélange de son vocabulaire fragile fourni et d'expressions directement liées à ses erreurs récurrentes (ex: s'il confond for/since, inclure une expression avec chacun)",
      items: {
        type: "object",
        properties: {
          term: { type: "string", description: "L'expression dans la langue cible, courte (1-4 mots)" },
          translation: { type: "string", description: "Traduction française" },
          why: { type: "string", description: "En français, très court : le lien avec son erreur ou le scénario, ex: 'ton point faible for/since'" },
        },
        required: ["term", "translation", "why"],
        additionalProperties: false,
      },
    },
    targetErrors: {
      type: "array",
      description: "2 à 4 erreurs récurrentes de l'apprenant que cette session cible en priorité, reprises de la liste fournie",
      items: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Le motif d'erreur ciblé, en français" },
          tip: { type: "string", description: "Le réflexe à adopter pendant la conversation, en français, 1 phrase courte" },
        },
        required: ["pattern", "tip"],
        additionalProperties: false,
      },
    },
    focusSummary: { type: "string", description: "Une phrase en français résumant ce que cette session fait travailler" },
  },
  required: ["title", "scenarioId", "mission", "targetTerms", "targetErrors", "focusSummary"],
  additionalProperties: false,
};

app.post("/api/drillplan", async (req, res) => {
  const { errors = [], weakVocab = [], language = "English", languageFr = "anglais", level = "B2" } = req.body || {};
  if (!errors.length && !weakVocab.length) {
    return res.status(400).json({ error: "Aucune erreur ni vocabulaire fragile à travailler pour l'instant." });
  }

  const prompt = `Conçois une session de conversation d'entraînement ciblé en ${languageFr} (${language}), niveau ${level}.

ERREURS RÉCURRENTES de l'apprenant (par fréquence) :
${errors.slice(0, 10).map((e) => `- [${e.type}] ${e.pattern} (×${e.count || 1}) — ${e.advice || ""}`).join("\n") || "(aucune)"}

VOCABULAIRE FRAGILE (mal mémorisé en révision) :
${weakVocab.slice(0, 10).map((v) => `- ${v.term} (${v.translation})`).join("\n") || "(aucun)"}

La session doit piéger gentiment l'apprenant : le scénario et la mission le forcent à utiliser les structures où il se trompe, et les termes cibles doivent être naturels dans ce scénario.`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      // conception d'exercice ciblé (analyse des erreurs) : raisonnement adaptatif
      thinking: { type: "adaptive" },
      system:
        "Tu es un professeur de langue expert en remédiation : tu conçois des exercices de conversation qui ciblent précisément les faiblesses d'un apprenant. Sois concret et malin dans le choix du scénario.",
      output_config: { format: { type: "json_schema", schema: DRILL_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    res.json({ plan: JSON.parse(textBlock.text) });
  } catch (err) {
    handleApiError(err, res);
  }
});

// --- Génération d'un parcours de progression (niveau départ → niveau cible) ---

const PROGRAM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Titre motivant du parcours, en français, ex: 'De B1 à C1 : parler anglais avec assurance'" },
    steps: {
      type: "array",
      description: "16 à 24 étapes de conversation, difficulté strictement croissante du niveau de départ au niveau cible",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre court de l'étape en français, ex: 'Small talk au café'" },
          scenarioId: {
            type: "string",
            enum: ["daily", "business", "interview", "appointment", "presentation", "free"],
            description: "Contexte de l'étape — varier les contextes au fil du parcours",
          },
          level: { type: "string", enum: ["B1", "B2", "C1", "C2"], description: "Niveau CEFR de l'étape (progression du départ vers la cible)" },
          mission: { type: "string", description: "Mission concrète et vérifiable à accomplir pendant la conversation, en français" },
          focus: { type: "string", description: "Le point de langue travaillé en priorité dans cette étape, en français, ex: 'les temps du passé', 'le vocabulaire de la négociation'" },
          durationMin: { type: "integer", description: "Durée estimée de la conversation en minutes (10 à 20, croissante avec le niveau)" },
        },
        required: ["title", "scenarioId", "level", "mission", "focus", "durationMin"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "steps"],
  additionalProperties: false,
};

app.post("/api/program", async (req, res) => {
  const { startLevel = "B1", targetLevel = "C1", priorities = "", languageFr = "anglais" } = req.body || {};

  const prompt = `Crée un parcours de progression en ${languageFr} ORAL, du niveau ${startLevel} au niveau ${targetLevel}.

Contraintes pédagogiques :
- 16 à 24 étapes de conversation, chacune réalisable en 10-15 minutes de dialogue.
- Progression réaliste : on démarre confortablement à ${startLevel}, on termine sur des étapes exigeantes de niveau ${targetLevel}.
- Varier les contextes (quotidien, business, entretien, rendez-vous/services, présentation client, conversation libre) avec une dominante professionnelle en seconde moitié.
- Chaque étape a UNE mission concrète (accomplissable et vérifiable en conversation) et UN point de langue prioritaire (grammaire, lexique, registre ou stratégie de discours) — les points de langue doivent couvrir les difficultés classiques des francophones dans cette langue (temps verbaux, prépositions, faux amis, tournures idiomatiques, registre formel/informel...).
- Inclure 2-3 étapes de type « monologue structuré » : la mission demande de dérouler un pitch ou une réponse structurée de 1-3 minutes face à l'interlocuteur, qui réagit ensuite.
- Les 2-3 dernières étapes sont des synthèses de haut niveau (présentation à enjeu, entretien difficile, débat).${priorities ? `\n- Priorités exprimées par l'apprenant : ${priorities}` : ""}`;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      system:
        "Tu es un ingénieur pédagogique spécialiste de l'anglais oral pour francophones, concepteur de parcours du type Global Exam. Tu produis des parcours progressifs, concrets et motivants.",
      output_config: { format: { type: "json_schema", schema: PROGRAM_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return res.status(422).json({ error: "Génération refusée." });
    }
    const textBlock = message.content.find((b) => b.type === "text");
    res.json({ program: JSON.parse(textBlock.text) });
  } catch (err) {
    handleApiError(err, res);
  }
});

function handleApiError(err, res) {
  if (err instanceof Anthropic.AuthenticationError || /resolve authentication method/i.test(err.message || "")) {
    return res.status(401).json({
      error: "Clé API Anthropic manquante ou invalide. Renseignez-la dans les réglages (icône ⚙️).",
    });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return res.status(429).json({ error: "Limite de requêtes atteinte. Réessayez dans une minute." });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return res.status(502).json({ error: "Impossible de joindre l'API Anthropic. Vérifiez votre connexion internet." });
  }
  console.error("Erreur API:", err);
  res.status(500).json({ error: "Erreur : " + err.message });
}

app.post("/api/key", async (req, res) => {
  const key = (req.body?.key || "").trim();
  if (!/^sk-ant-/.test(key)) {
    return res.status(400).json({ error: "Format de clé invalide : elle doit commencer par sk-ant-…" });
  }
  const testClient = new Anthropic({ apiKey: key });
  try {
    await testClient.models.retrieve(MODEL);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: "Cette clé est refusée par l'API Anthropic." });
    }
    return res.status(500).json({ error: "Validation impossible : " + err.message });
  }
  setApiKey(key);
  res.json({ ok: true });
});

// URL publique du tunnel (lue dans tunnel.log écrit par cloudflared) + QR code.
// Réservé à l'accès local : inutile de révéler l'URL du tunnel… via le tunnel.
app.get("/api/tunnel", async (req, res) => {
  if (!["localhost", "127.0.0.1", "::1"].includes(req.hostname)) {
    return res.status(403).json({ error: "Disponible uniquement depuis le PC." });
  }
  try {
    const logPath = path.join(__dirname, "tunnel.log");
    if (!fs.existsSync(logPath)) return res.json({ url: null });
    const log = fs.readFileSync(logPath, "utf-8");
    const matches = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
    if (!matches) return res.json({ url: null });
    const url = matches[matches.length - 1];
    const qr = await require("qrcode").toDataURL(url, { margin: 1, width: 220, color: { dark: "#0e1420", light: "#ffffff" } });
    res.json({ url, qr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Synchronisation des données entre appareils (PC ↔ téléphone) ---
// Le serveur garde l'état fusionné dans data.json ; chaque appareil envoie son
// état local et repart avec la fusion. Union pour vocab/sessions/erreurs,
// « le plus récent gagne » pour les réglages et le parcours.

const DATA_PATH = path.join(__dirname, "data.json");

function readSyncData() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8")); } catch { return { data: {}, meta: {} }; }
}

function mergeSync(saved, incoming) {
  const sData = saved.data || {}, iData = incoming.data || {};
  const sMeta = saved.meta || {}, iMeta = incoming.meta || {};
  const outData = {}, outMeta = {};

  // Réglages, streak et parcours : la version modifiée le plus récemment gagne
  for (const k of ["streak", "program", "lang", "pauseMs", "personaAccent", "voice"]) {
    const useIncoming = (iMeta[k] || 0) >= (sMeta[k] || 0);
    let val = useIncoming ? iData[k] : sData[k];
    if (val === undefined || val === null) val = useIncoming ? sData[k] : iData[k];
    if (val !== undefined && val !== null) outData[k] = val;
    outMeta[k] = Math.max(iMeta[k] || 0, sMeta[k] || 0);
  }

  // Vocabulaire : union par (langue, terme) — l'entrée travaillée le plus récemment gagne
  const vmap = new Map();
  for (const v of [...(sData.vocab || []), ...(iData.vocab || [])]) {
    if (!v || !v.term) continue;
    const id = (v.lang || "en") + "|" + v.term.toLowerCase();
    const prev = vmap.get(id);
    if (!prev || (v.touched || v.added || 0) > (prev.touched || prev.added || 0)) vmap.set(id, v);
  }
  outData.vocab = [...vmap.values()];
  outMeta.vocab = Math.max(iMeta.vocab || 0, sMeta.vocab || 0);

  // Sessions : union par horodatage
  const smap = new Map();
  for (const s of [...(sData.sessions || []), ...(iData.sessions || [])]) {
    if (s && s.date) smap.set(s.date, s);
  }
  outData.sessions = [...smap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
  outMeta.sessions = Math.max(iMeta.sessions || 0, sMeta.sessions || 0);

  // Erreurs récurrentes : union par motif, le compteur le plus élevé gagne
  const emap = new Map();
  for (const e of [...(sData.errors || []), ...(iData.errors || [])]) {
    if (!e || !e.pattern) continue;
    const id = e.pattern.toLowerCase();
    const prev = emap.get(id);
    emap.set(id, !prev ? e : { ...e, count: Math.max(prev.count || 1, e.count || 1) });
  }
  outData.errors = [...emap.values()].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 40);
  outMeta.errors = Math.max(iMeta.errors || 0, sMeta.errors || 0);

  // Bibliothèque de phrases et blocs structurés : union par (langue|contexte),
  // la génération la plus récente gagne
  for (const field of ["phrasebook", "blocks"]) {
    const merged = {};
    for (const src of [sData[field] || {}, iData[field] || {}]) {
      for (const [k, v] of Object.entries(src)) {
        if (!merged[k] || (v.generatedAt || 0) > (merged[k].generatedAt || 0)) merged[k] = v;
      }
    }
    outData[field] = merged;
    outMeta[field] = Math.max(iMeta[field] || 0, sMeta[field] || 0);
  }

  return { data: outData, meta: outMeta };
}

app.post("/api/sync", (req, res) => {
  try {
    const incoming = { data: req.body?.data || {}, meta: req.body?.meta || {} };
    const merged = mergeSync(readSyncData(), incoming);
    fs.writeFileSync(DATA_PATH, JSON.stringify(merged));
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: "Synchronisation impossible : " + err.message });
  }
});

app.get("/api/status", (req, res) => {
  res.json({
    model: MODEL,
    keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    ttsProvider: ttsProvider(),
    premiumIssue: Date.now() <= premiumSkipUntil ? premiumIssue : "",
  });
});

// Garde-fous : une connexion TTS du pool qui expire (ou toute erreur imprévue)
// ne doit jamais tuer le serveur
process.on("uncaughtException", (err) => {
  console.error("Exception non rattrapée (serveur maintenu) :", err.message);
  ttsPool.clear();
});
process.on("unhandledRejection", (err) => {
  console.error("Promesse rejetée non gérée (serveur maintenu) :", err?.message || err);
  ttsPool.clear();
});

// Une seule instance : si le port est déjà pris, on sort proprement au lieu de
// laisser deux serveurs (dont un périmé) se disputer le port
const server = app.listen(PORT, () => {
  console.log(`LinguaLive démarré : http://localhost:${PORT}`);
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} déjà utilisé par une autre instance — arrêt.`);
    process.exit(0);
  }
  throw err;
});
