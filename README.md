# 🎙️ LinguaLive

Coach de conversation orale en anglais : de vraies conversations vocales avec un partenaire IA, des corrections instantanées, et un suivi de progression continu.

## Fonctionnalités

- **Conversations vocales en temps réel** — parle au micro (reconnaissance vocale du navigateur), l'IA répond à voix haute (synthèse vocale). Mode mains libres : le micro se rouvre après chaque réponse.
- **Corrections instantanées et visuelles** — chaque prise de parole est analysée : grammaire (rouge), vocabulaire (orange), registre (violet), structure (bleu). Clique sur une correction pour l'explication en français.
- **« Un natif dirait… »** — reformulation idiomatique de tes phrases maladroites mais compréhensibles.
- **Niveaux B1 → C2** — la complexité, la vitesse de parole et l'exigence du partenaire s'adaptent au niveau choisi, et s'ajustent en cours de conversation.
- **6 contextes** — vie quotidienne, business/réunions, entretien d'embauche, rendez-vous & services, présentation client, conversation libre.
- **Missions** — un objectif concret par conversation (négocier un délai, répondre à une objection…), validé en direct par le coach.
- **Débrief de fin de session** — niveau CEFR réellement démontré, points forts, axes de travail, reformulations natives, recommandations.
- **Base de vocabulaire + révision espacée (SRS)** — le vocabulaire utile rencontré en conversation est mémorisé par contexte et revient à intervalles croissants (J+1, J+3, J+7, J+14, J+30).
- **Journal d'erreurs récurrentes** — tes fautes typiques sont suivies ; lance une « session ciblée » pour que le coach oriente la conversation dessus.
- **Progrès & streak** — statistiques par type d'erreur, historique des sessions, jours consécutifs de pratique.

## Démarrage

```bash
npm install
npm start          # http://localhost:3100
```

La clé API Anthropic est lue depuis `.env` (`ANTHROPIC_API_KEY=sk-ant-…`) ; à défaut, celle de `../slideforge/.env` est réutilisée automatiquement. Elle peut aussi être saisie via ⚙️ dans l'interface.

## Notes techniques

- **Voix** : Web Speech API — reconnaissance (`SpeechRecognition`, Chrome/Edge requis) et synthèse (`speechSynthesis`, voix « Natural » d'Edge recommandées, réglables via ⚙️).
- **IA** : API Anthropic (`claude-sonnet-5` par défaut, surchargez avec `LINGUALIVE_MODEL`) avec sorties structurées JSON pour les corrections et le débrief.
- **Données** : tout est stocké en `localStorage` (vocabulaire, sessions, erreurs, streak) — aucune base de données.
- La prononciation fine (phonèmes, accent) n'est pas notée : la reconnaissance vocale fournit le texte, pas l'audio. Les mots systématiquement mal transcrits sont toutefois un bon indicateur indirect.
