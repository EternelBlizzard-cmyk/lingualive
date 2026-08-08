---
name: verif
description: Vérifie une modification de LinguaLive de bout en bout — syntaxe, redémarrage du serveur sur le port 3100, instance unique, test réel de l'endpoint touché, contrôle UI. À utiliser après toute modif de server.js ou de public/, avant de commiter.
---

# Vérification d'une modif LinguaLive

Objectif : ne jamais annoncer « c'est bon » sans preuve. Chaque étape produit une
sortie qu'on lit vraiment. Si une étape échoue, on corrige et on **reprend à l'étape 1**.

Contrainte permanente : l'état du shell ne persiste pas entre deux appels d'outil —
chaque étape doit tenir dans **une seule commande PowerShell** (piège 7 du CLAUDE.md).

## Étape 1 — Syntaxe (toujours)

```powershell
node --check server.js; if ($?) { node --check public/app.js }; if ($?) { "SYNTAXE OK" }
```

Aucune sortie d'erreur + « SYNTAXE OK » = on continue. Sinon on corrige avant tout le reste.

## Étape 2 — Redémarrage (seulement si `server.js` a changé)

Les fichiers de `public/` n'exigent **aucun** redémarrage : passer directement à l'étape 4.

On ne relance pas node à la main : on tue le process qui écoute le port 3100, le
superviseur `server-loop.bat` le relance seul en 3-5 s avec le nouveau code.

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }; Start-Sleep -Seconds 9; try { Invoke-RestMethod http://localhost:3100/api/status -TimeoutSec 10 | ConvertTo-Json -Compress } catch { "ECHEC: le serveur n a pas repris - lire server.log et server-err.log" }
```

Attendu : un JSON avec `model`, `keyConfigured`, `ttsProvider`.
Si ça échoue : lire la fin de `server-err.log`, puis `server.log`.

## Étape 3 — Instance unique (si l'étape 2 a été faite)

Piège n°9, déjà payé cher : deux `node server.js` coexistent, l'ancien garde le port
avec des connexions mortes → les requêtes API pendent à l'infini (l'avatar « réfléchit »
sans fin) alors que `/api/status` répond normalement.

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, CreationDate, CommandLine | Format-List
```

Attendu : **un seul** process dont la ligne de commande contient `server.js`.
S'il y en a deux (âges différents) : tuer TOUS les `node server.js` ET les
`cmd server-loop`, puis relancer un seul superviseur (`server-loop.bat`).

## Étape 4 — Test réel de l'endpoint touché

Un POST direct avec une charge utile réaliste. Adapter le corps à l'endpoint modifié ;
ne jamais se contenter de `/api/status`, qui répond même quand le reste est cassé.

Exemple pour `/api/reply` :

```powershell
$b = @{ scenario = "commander un cafe"; persona = "barista"; language = "en"; level = "B1"; mission = "commander et demander le wifi"; history = @(); userText = "Hi, can I have a coffee please" } | ConvertTo-Json -Depth 5; try { $r = Invoke-RestMethod http://localhost:3100/api/reply -Method Post -Body $b -ContentType "application/json" -TimeoutSec 60; $r | ConvertTo-Json -Depth 5 } catch { "ECHEC: " + $_.Exception.Message }
```

Points de contrôle :
- réponse en moins de ~5 s (au-delà, suspecter l'instance en double, étape 3) ;
- structure JSON conforme au schéma attendu par le client ;
- pour tout ce qui touche au TTS ou aux clés : vérifier que **l'échec retombe sur un
  repli fonctionnel** — jamais de silence ni de blocage.

## Étape 5 — UI (si `public/` a changé)

`preview_start {url: "http://localhost:3100"}` — **jamais** un second serveur.

La preview est instable sur ce projet (fetch qui pendent, viewport 0x0, screenshots
qui expirent) : privilégier `javascript_tool` (injection de données factices,
lecture du DOM) et `get_page_text` plutôt que des captures d'écran.

**Nettoyage obligatoire** à la fin de tout test : remettre `state` et `localStorage`
dans leur état d'origine. Si le test a eu lieu dans le vrai Chrome, remettre
`wantListening = false` et `state.inSession = false` avant de quitter, sinon l'onglet
vole le micro de Jeffrey.

Ne jamais écrire de données de test dans `data.json` (vraies données de progression)
sans les supprimer ensuite.

## Étape 6 — Bilan

Rapporter en clair : ce qui a été vérifié, ce qui a été sauté et pourquoi.
Si tout est vert, proposer le commit — message **sans aucun guillemet** et sans
accents (piège 2 : PowerShell 5.1 coupe l'argument). Les commits dans OneDrive
peuvent expirer : réessayer, vérifier `git log` avant de conclure à un échec.
