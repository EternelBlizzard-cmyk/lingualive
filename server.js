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

let client = new Anthropic();

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
  client = new Anthropic({ apiKey: key });
  saveEnvVar("ANTHROPIC_API_KEY", key);
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

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

function turnSystemPrompt({ scenario, level, mission, knownErrors, persona }) {
  return `You are LinguaLive, an English conversation partner and language coach for a French-speaking learner.

ROLE-PLAY
You are playing this character, realistically and consistently: ${persona ? `${persona.name}, from ${persona.origin} — ` : ""}${scenario.role}
Setting: ${scenario.setting}
${persona ? `Stay ${persona.name} throughout. Use turns of phrase, vocabulary and cultural references typical of ${persona.origin} English speakers.` : ""}
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
  const { scenario, level = "B2", mission = "", history = [], userText = "", knownErrors = [], alternatives = [], persona = null } = req.body || {};
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
      system: turnSystemPrompt({ scenario, level, mission, knownErrors, persona }),
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
  const { scenario, level = "B2", mission = "", history = [], corrections = [] } = req.body || {};
  if (!history.length) return res.status(400).json({ error: "Aucune conversation à analyser." });

  const transcript = history
    .map((m) => `${m.role === "assistant" ? "COACH" : "LEARNER"}: ${m.text}`)
    .join("\n");
  const corrList = corrections
    .map((c) => `- [${c.type}] "${c.original}" → "${c.corrected}" (${c.explanation})`)
    .join("\n");

  const prompt = `Session de conversation en anglais terminée. Analyse la production de l'apprenant.

Scénario : ${scenario?.label || "conversation libre"} — ${scenario?.setting || ""}
Niveau choisi : ${level}${mission ? `\nMission : ${mission}` : ""}

TRANSCRIPT
${transcript}

CORRECTIONS RELEVÉES PENDANT LA SESSION
${corrList || "(aucune)"}`;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system:
        "Tu es un professeur d'anglais expérimenté, spécialiste des apprenants francophones. Tu produis un débrief de session honnête, précis et actionnable. Tu t'appuies uniquement sur ce qui s'est réellement passé dans le transcript.",
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

function replySystemPrompt({ scenario, level, mission, persona }) {
  return `You are an English conversation partner for a French-speaking learner. Role-play only — no coaching, no corrections, no meta-comments.

You are: ${persona ? `${persona.name}, from ${persona.origin} — ` : ""}${scenario.role}
Setting: ${scenario.setting}
${persona ? `Use turns of phrase typical of ${persona.origin} English speakers.` : ""}
${mission ? `The learner is trying to accomplish: "${mission}". Give them realistic opportunities (including light obstacles).` : ""}

CEFR ${level}: ${LEVEL_GUIDE[level] || LEVEL_GUIDE.B2}

Rules:
- Stay in character, react to what they said, keep the conversation moving with a question or hook.
- 1 to 3 short spoken sentences. Plain text only — it is read aloud by text-to-speech.
- The learner's message may end with a bracketed "[reconnaissance — autres transcriptions possibles: ...]" line: alternative speech-recognition transcriptions of the same words. Use them to understand what was really said; never mention them.
- Never correct the learner: respond to their intended meaning.`;
}

app.post("/api/reply", async (req, res) => {
  const { scenario, level = "B2", mission = "", history = [], userText = "", alternatives = [], persona = null } = req.body || {};
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
      system: replySystemPrompt({ scenario, level, mission, persona }),
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
  const { scenario, level = "B2", mission = "", history = [], userText = "", alternatives = [], knownErrors = [] } = req.body || {};
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

  const system = `You are an English coach for a French-speaking learner. Analyse ONLY the learner's new utterance.
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

app.post("/api/tts", async (req, res) => {
  const { text = "", voice = "en-US-AriaNeural", level = "B2" } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: "Texte vide." });
  const cleanText = text.slice(0, 2000);

  // 1. Voix premium si une clé est configurée (échec → repli Edge, jamais de silence)
  try {
    if (process.env.ELEVENLABS_API_KEY && ELEVEN_VOICES[voice]) {
      const buf = await elevenTts(ELEVEN_VOICES[voice], cleanText, level);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.send(buf);
    }
    if (process.env.OPENAI_API_KEY) {
      const buf = await openaiTts(voice, cleanText, level);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.send(buf);
    }
  } catch (err) {
    console.error("Voix premium indisponible, repli Edge :", err.message);
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
  const key = (req.body?.key || "").trim();
  if (!["elevenlabs", "openai"].includes(provider)) return res.status(400).json({ error: "Fournisseur inconnu." });
  if (!key) {
    // Champ vide = désactiver ce fournisseur
    saveEnvVar(provider === "elevenlabs" ? "ELEVENLABS_API_KEY" : "OPENAI_API_KEY", "");
    delete process.env[provider === "elevenlabs" ? "ELEVENLABS_API_KEY" : "OPENAI_API_KEY"];
    return res.json({ ok: true, ttsProvider: ttsProvider() });
  }
  try {
    if (provider === "elevenlabs") {
      const r = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": key } });
      if (!r.ok) return res.status(401).json({ error: "Clé ElevenLabs refusée (HTTP " + r.status + ")." });
      saveEnvVar("ELEVENLABS_API_KEY", key);
    } else {
      const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
      if (!r.ok) return res.status(401).json({ error: "Clé OpenAI refusée (HTTP " + r.status + ")." });
      saveEnvVar("OPENAI_API_KEY", key);
    }
    res.json({ ok: true, ttsProvider: ttsProvider() });
  } catch (err) {
    res.status(500).json({ error: "Validation impossible : " + err.message });
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
  const { startLevel = "B1", targetLevel = "C1", priorities = "" } = req.body || {};

  const prompt = `Crée un parcours de progression en anglais ORAL, du niveau ${startLevel} au niveau ${targetLevel}.

Contraintes pédagogiques :
- 16 à 24 étapes de conversation, chacune réalisable en 10-15 minutes de dialogue.
- Progression réaliste : on démarre confortablement à ${startLevel}, on termine sur des étapes exigeantes de niveau ${targetLevel}.
- Varier les contextes (quotidien, business, entretien, rendez-vous/services, présentation client, conversation libre) avec une dominante professionnelle en seconde moitié.
- Chaque étape a UNE mission concrète (accomplissable et vérifiable en conversation) et UN point de langue prioritaire (grammaire, lexique, registre ou stratégie de discours) — les points de langue doivent couvrir les difficultés classiques des francophones (for/since, present perfect, prépositions, faux amis, phrasal verbs, conditionnels, registre formel/informel...).
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

app.get("/api/status", (req, res) => {
  res.json({
    model: MODEL,
    keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    ttsProvider: ttsProvider(),
  });
});

app.listen(PORT, () => {
  console.log(`LinguaLive démarré : http://localhost:${PORT}`);
});
