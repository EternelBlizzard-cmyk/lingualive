# LinguaLive — guide pour les sessions Claude (tout modèle)

Coach de conversation orale multilingue (anglais/espagnol/allemand/italien) pour un apprenant francophone. Node/Express + API Anthropic, front vanilla JS servi depuis `public/`. **Tout est en localStorage côté client, synchronisé entre appareils via le serveur.** Pas de base de données, pas de framework, pas de build.

**En ligne aussi sur Render** : https://lingualive.onrender.com — adresse définitive, installée sur le téléphone, distincte du couple serveur local + tunnel Cloudflare décrit ci-dessous (qui reste utile pour le développement). Variables sur Render : `ANTHROPIC_API_KEY`, `ACCESS_CODE`, `OPENAI_API_KEY` (optionnelle, voix premium non activées en ligne faute de crédit au dernier contrôle).

**Projet indépendant** (`Projects\LinguaLive\`, sorti du dossier Edutrust le 2026-08-08 — aucun lien fonctionnel avec Edutrust ; le dossier s'appelait `lingualive`). ⚠️ `lingualive-autostart.vbs` contient le **chemin absolu** de ce dossier et une copie de ce fichier vit dans `shell:startup` : si le projet est déplacé, corriger les deux, sinon LinguaLive ne démarrera plus avec Windows.

## Démarrage & infrastructure (NE PAS CASSER)

- **Port 3100 FIXE** : le tunnel mobile et la PWA installée pointent dessus. Ne jamais lancer de doublon ni changer le port. La preview Claude doit utiliser `preview_start {url: "http://localhost:3100"}` (pas de second serveur).
- Le serveur tourne en permanence via `server-loop.bat` (superviseur : relance node en 3 s s'il tombe). Le tunnel mobile via `tunnel-loop.bat` (idem). Les deux sont lancés au démarrage de Windows par `lingualive-autostart.vbs` copié dans `shell:startup` (délai 45 s pour OneDrive).
- **Pour redémarrer le serveur après une modif de server.js** : tuer le process qui écoute le port 3100 (`Get-NetTCPConnection -LocalPort 3100`) — le superviseur le relance seul en ~3-5 s avec le nouveau code. Les fichiers de `public/` n'exigent aucun redémarrage.
- Tunnel : URL `https://xxx.trycloudflare.com` **qui change à chaque relance** — l'URL du moment est dans `tunnel.log` et affichée avec QR code dans ⚙️ Réglages > « Sur le téléphone » (endpoint `/api/tunnel`, accès local uniquement).
- Clé API Anthropic : `.env` local, sinon repli sur `../slideforge/.env` (codé dans server.js). `.env` contient aussi `ACCESS_CODE` (PIN protégeant `/api/*` hors localhost) et `OPENAI_API_KEY` (voix premium).

## Modèles API utilisés par l'appli

- `/api/reply` : `claude-haiku-4-5-20251001` (`FAST_MODEL`) — latence conversationnelle, ~1,5 s.
- Tout le reste (coach, débrief, parcours, drillplan, phrasebook, blocks, blockeval) : `claude-sonnet-5` (`MODEL`, surchargeable via `LINGUALIVE_MODEL`).
- Sorties structurées partout : `output_config: { format: { type: "json_schema", schema } }`, réponse dans le bloc `text` à `JSON.parse`.

## Endpoints (server.js)

| Endpoint | Rôle |
|---|---|
| POST /api/reply | Réponse rapide en personnage (Haiku). Reçoit scenario, persona, language, level, mission, history, userText, alternatives (variantes STT), targetTerms |
| POST /api/coach | Analyse en parallèle : corrections (type grammar/vocabulary/register/structure, explications EN FRANÇAIS), nativeVersion, vocab, coachNote, missionStatus |
| POST /api/turn | Ancienne version fusionnée (plus utilisée par le client, conservée) |
| POST /api/debrief | Bilan de session : cefrEstimate (niveau DÉMONTRÉ), forces/faiblesses, recurringErrors, nativeUpgrades, + drillReport (termes placés) |
| POST /api/program | Parcours 16-24 étapes niveau départ→cible (durationMin par étape, 2-3 étapes monologue structuré) |
| POST /api/drillplan | Session ciblée : scénario+mission piégés sur les erreurs du journal + 5-7 targetTerms + targetErrors |
| POST /api/phrasebook | Bibliothèque de phrases par contexte (squelettes à [crochets]) |
| POST /api/blocks | Blocs structurés : monologues 1-3 min en 4-7 parties |
| POST /api/blockeval | Évaluation d'une récitation de bloc : score/100, couverture par partie |
| POST /api/tts | Audio MP3 : OpenAI gpt-4o-mini-tts si clé (instructions d'accent par persona), sinon ElevenLabs si clé+mapping, sinon voix Edge (msedge-tts, pool par voix). Échec premium → écarté 5 min (premiumSkipUntil) |
| POST /api/sync | Synchronisation PC↔téléphone : fusion dans data.json (union vocab/sessions/erreurs/phrasebook/blocks, last-writer-wins pour le reste via meta horodaté) |
| GET /api/status | model, keyConfigured, ttsProvider, premiumIssue |
| POST /api/key, /api/ttskey | Enregistrement des clés (validation par vraie mini-requête, erreurs traduites) |

Toute erreur premium/TTS doit TOUJOURS retomber sur un repli fonctionnel — jamais de silence ni de blocage.

## Client (public/app.js) — invariants

- **Micro** : webkitSpeechRecognition continu, envoi après silence de `state.pauseMs` (réglable 0,5–3,5 s). UN SEUL onglet peut avoir le micro (Chrome) → le micro appartient à l'onglet **visible** (visibilitychange), rafales d'`aborted` = onglets en doublon (message affiché). Chien de garde 3 s + relance différée 300 ms. `finishUtterance` est INTERCEPTÉ par `state.blockCapture` (récitation) puis `state.repeatTarget` (répétition) avant l'envoi normal.
- **Tour de conversation** : 2 appels PARALLÈLES — `/api/reply` (affiché+parlé immédiatement) et `/api/coach` (runCoach annote la bulle après coup). L'historique est figé avant le tour.
- **Audio** : `speak()` → `/api/tts` (blob → Audio) avec repli `speakLocal()` (speechSynthesis navigateur). `stopAudio()` avant toute prise de micro.
- **Mode appel** (`#callOverlay`) : ouvert par défaut en session. États CSS speaking/listening/thinking. Toute erreur de tour DOIT appeler `setCallState("", message)` sinon l'avatar « réfléchit » pour toujours.
- **Rappel actif** : chaque session embarque les mots SRS dus comme targetTerms ; les employer = révision validée (`creditVocabReviews`). Jetons `#termChips`/`#callTerms`, relance après 2 tours sans placement.
- **Données** (localStorage préfixe `lingualive_`) : vocab (SRS boîtes 0-5, intervalles 0/1/3/7/14/30 j), sessions (avec transcript `messages`), errors, streak, program, placement, phrasebook, blocks — tous dans `SYNC_KEYS`, poussés 2,5 s après modif via `store.set` (méta horodaté).
- La jauge du Parcours = niveau DÉMONTRÉ (`measuredLevelNum()` : moyenne pondérée des cefr des 5 dernières sessions), PAS le comptage d'étapes.

## Pièges connus (déjà payés cher — ne pas retomber dedans)

1. **PowerShell 5.1 + UTF-8** : ne JAMAIS réécrire un fichier du projet via `Get-Content`/`Set-Content` sans encodage explicite (a déjà corrompu app.js). Utiliser `[IO.File]::ReadAllText($f, [Text.Encoding]::UTF8)` et `WriteAllText` avec `New-Object Text.UTF8Encoding $false`.
2. **Messages de commit git** : AUCUN guillemet (ni " ni « ») dans les here-strings de commit — PowerShell 5.1 coupe l'argument. Accents déconseillés aussi.
3. **git dans OneDrive** : les commits peuvent timeouter — réessayer, ça finit par passer. Ne pas paniquer, vérifier `git log` avant de conclure.
4. **`[hidden]` CSS** : la règle `[hidden] { display: none !important; }` existe en tête de styles.css — toute classe avec `display:` la contournerait sans elle.
5. **Preview pane Claude instable sur ce projet** (fetch qui pendent, viewport 0x0, screenshots timeout) : vérifier via appels HTTP directs (PowerShell) + injection DOM (`javascript_tool`), et l'appli réelle via claude-in-chrome si besoin. Toujours nettoyer l'état injecté (state, localStorage) après un test.
6. **Session de diagnostic dans le vrai Chrome** : remettre `wantListening=false`/`state.inSession=false` avant de quitter, sinon l'onglet vole le micro de l'utilisateur.
7. **Variables PowerShell** : l'état du shell ne persiste PAS entre deux appels d'outil — tout test multi-étapes doit tenir dans une seule commande.
8. **data.json** : contient les vraies données de progression synchronisées — ne jamais y écrire de données de test sans les supprimer ensuite.
9. **UNE SEULE instance serveur** : plusieurs `node server.js` peuvent coexister (IPv4/IPv6, superviseurs lancés en double) ; l'ancienne instance garde le port avec des connexions HTTP mortes → les requêtes API pendent à l'infini (« réfléchit » sans fin) alors que `/api/status` répond. Symptôme : `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` montre 2 processus d'âges différents. Remède : tuer TOUS les `node server.js` ET les `cmd server-loop`, puis relancer un seul superviseur. Le serveur sort maintenant seul sur EADDRINUSE, et le client Anthropic a `timeout: 60000, maxRetries: 2`.
10. **Le micro ne doit jamais dépendre de l'audio** : `speak()` garantit l'appel de `onend` (garde-fou 6 s si rien ne démarre, puis durée réelle + 8 s). Sans ça, un audio bloqué (politique d'autoplay, TTS en panne) fige la conversation.
11. **Tunnel quick Cloudflare = point faible connu** : URL différente à chaque relance (déjà 5), échecs de connexion en série côté Cloudflare. La PWA installée sur le téléphone meurt à chaque changement. **Résolu pour l'usage quotidien** par le déploiement Render (adresse fixe, voir en tête de fichier) ; le tunnel reste utile pour développer et tester en local avant d'envoyer sur Render.
12. **Render + code d'accès = déploiement qui échoue silencieusement** : Render sonde `/api/status` pour vérifier que le service est vivant, mais toutes les routes `/api/` exigent `ACCESS_CODE` dès que l'appel ne vient pas du PC local — Render reçoit un refus et déclare le déploiement mort alors que le serveur tourne. Solution posée : une route publique dédiée `/healthz` qui ne répond que « vivant », sans passer par la protection. Si un futur déploiement échoue avec un service qui semble pourtant démarrer, vérifier en premier que le health check de la plateforme d'hébergement ne tape pas sur une route protégée.
13. **`backdrop-filter` casse `position: fixed`** : un élément avec `backdrop-filter` devient le repère de positionnement de ses descendants `fixed` — la barre d'onglets flottante du bas se calait sur la `.topbar` et remontait tout en haut de l'écran. Même effet avec `filter`, `transform` et `will-change`. Si un élément fixé atterrit au mauvais endroit, chercher un de ces quatre chez un ancêtre. Deux autres façons d'**étrangler le compositeur**, toutes deux rencontrées ici : une **couche masquée plein écran** (`mask-image` sur un élément couvrant tout l'écran) au-dessus du mode appel, et l'attribut **`opacity` sur un groupe SVG** — il isole chaque groupe dans son propre calque, donc une trentaine de groupes suffit à bloquer le rendu (utiliser `fill-opacity`, qui n'en crée aucun). Symptôme commun : la page répond normalement au JavaScript mais la capture d'écran expire. C'est le signal d'alerte à prendre au sérieux — sur téléphone ça se traduit par des saccades.
14. **Tester dans le vrai Chrome** (claude-in-chrome) : `document.hidden` est true dans un onglet piloté → le micro refuse de démarrer ; surcharger `document.hidden`. Un clic programmatique n'est PAS un geste utilisateur → l'audio peut être bloqué (d'où l'importance du garde-fou). Instrumenter en enveloppant `speak`/`startListening` et en écoutant les événements de `recognition`, avec des marqueurs horodatés.

## Vérification type après une modif

1. `node --check` sur server.js et public/app.js (syntaxe).
2. Si server.js modifié : tuer le process port 3100, attendre ~6 s (superviseur), `GET /api/status`.
3. Tester l'endpoint touché par un POST PowerShell direct avec un payload réaliste (une seule commande, cf. piège 7).
4. UI : `preview_start {url}` + `javascript_tool` (injection de données factices, vérification DOM, nettoyage).
5. Commit (message sans guillemets), et mettre à jour la mémoire utilisateur si le changement est structurant.

## Style & langue

- Interface et textes utilisateur : FRANÇAIS (tutoiement). Explications pédagogiques en français, contenus de conversation dans la langue cible.
- Commentaires de code : français, sobres, seulement pour les contraintes non évidentes.
- L'utilisateur (Jeffrey) n'est pas développeur : les réponses de chat expliquent le « quoi » et le « pourquoi » simplement, sans jargon inutile.

## Discipline de coût

Jeffrey finance les crédits API lui-même ; la maîtrise du coût fait partie du travail.
Appliquer ces règles d'office, sans qu'il ait à le demander (section absente jusqu'au
2026-08-08, remontée du modèle `Projects\_modele\` — LinguaLive en manquait entièrement).

- **Modèle** : Sonnet 5 suffit pour implémenter un plan décidé, corriger un détail, mettre à
  jour la doc. Réserver Fable/Opus (5× le prix) à la conception et au débogage retors. Le
  signaler en une phrase quand on bascule — ne jamais changer de modèle soi-même, c'est sa
  décision et sa facture. Ne pas recommander `/fast` pour économiser : le mode rapide se paie
  au prix fort.
- **`/clear`** : le proposer une fois un chantier terminé et testé. Toute la conversation est
  relue à chaque échange — le 50ᵉ message coûte bien plus que le 5ᵉ. Tenir ce fichier à jour
  est ce qui rend le `/clear` sans douleur.
- **Captures d'écran** : seulement sur demande ou pour juger un rendu visuel — jamais en
  routine (vérifier par `get_page_text`, `read_page` ou une évaluation JS, quasi gratuit ;
  la preview étant instable sur ce projet, préférer les appels HTTP directs, cf. piège 5).
- **Lire les fichiers avec parcimonie** : Grep pour localiser avant de lire, la partie utile
  plutôt que tout le fichier, ne jamais relire un fichier qu'on vient d'éditer.
- **Ce qui ne fait PAS économiser — ne pas le suggérer** : demander à Jeffrey d'être plus bref
  (une consigne vague coûte *plus* cher : exploration, questions, allers-retours — ses
  messages qui posent tout le contexte d'un coup sont le format le plus économique,
  l'encourager) ; sauter les tests (un bug trouvé plus tard coûte une session de débogage
  entière — vu les pièges déjà payés cher sur ce projet, particulièrement vrai ici) ; découper
  une tâche en petits messages successifs.
