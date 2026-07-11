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

function setApiKey(key) {
  process.env.ANTHROPIC_API_KEY = key;
  client = new Anthropic({ apiKey: key });
  let env = "";
  if (fs.existsSync(ENV_PATH)) {
    env = fs.readFileSync(ENV_PATH, "utf-8").replace(/^ANTHROPIC_API_KEY=.*$/m, "").trim();
  }
  fs.writeFileSync(ENV_PATH, `ANTHROPIC_API_KEY=${key}\n${env ? env + "\n" : ""}`);
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Protection par code d'accès quand l'appli est exposée sur Internet (tunnel/hébergement).
// Sans ACCESS_CODE dans l'environnement, tout passe (usage purement local).
const ACCESS_CODE = (process.env.ACCESS_CODE || "").trim();
app.use("/api", (req, res, next) => {
  if (!ACCESS_CODE || req.get("x-access-code") === ACCESS_CODE) return next();
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

function turnSystemPrompt({ scenario, level, mission, knownErrors }) {
  return `You are LinguaLive, an English conversation partner and language coach for a French-speaking learner.

ROLE-PLAY
You are playing this character, realistically and consistently: ${scenario.role}
Setting: ${scenario.setting}
${mission ? `The learner has a mission to accomplish in this conversation: "${mission}". Give them realistic opportunities to achieve it (including obstacles or objections when the scenario calls for it), and mark missionStatus "accomplished" as soon as they clearly succeed.` : "No specific mission: keep a lively, engaging conversation going within the scenario."}

LEVEL — CEFR ${level}
${LEVEL_GUIDE[level] || LEVEL_GUIDE.B2}
If the learner is clearly comfortable, gradually raise complexity within the level. If they struggle (very short answers, misunderstandings), simplify and slow down — without breaking character.

COACHING (applies to the learner's LAST utterance only)
- The utterance comes from speech recognition: no punctuation, and occasional mis-transcribed homophones. Never correct punctuation or capitalization. Flag a suspected transcription artifact only if it is clearly a language error regardless.
- Report every real error in "corrections" with a brief French explanation. No error → empty array. Never invent errors to seem useful.
- "nativeVersion": give the natural native phrasing when the learner's sentence was understandable but clunky. Empty string when already natural.
${knownErrors && knownErrors.length ? `- The learner's recurring weaknesses: ${knownErrors.join("; ")}. Occasionally steer the conversation so they must use these patterns, and be especially vigilant about them.` : ""}
- Stay in character in "reply" — coaching lives ONLY in the structured fields, never in the reply text.
- "reply" is spoken aloud by text-to-speech: plain conversational text, no lists, no markdown, no stage directions.`;
}

app.post("/api/turn", async (req, res) => {
  const { scenario, level = "B2", mission = "", history = [], userText = "", knownErrors = [] } = req.body || {};
  if (!scenario || !scenario.role) return res.status(400).json({ error: "Scénario manquant." });
  if (!userText.trim()) return res.status(400).json({ error: "Message vide." });

  const messages = history
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
  messages.push({ role: "user", content: userText.trim() });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: turnSystemPrompt({ scenario, level, mission, knownErrors }),
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

app.get("/api/status", (req, res) => {
  res.json({
    model: MODEL,
    keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  });
});

app.listen(PORT, () => {
  console.log(`LinguaLive démarré : http://localhost:${PORT}`);
});
