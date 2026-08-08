# 📱 LinguaLive sur ton téléphone

Le micro n'est autorisé qu'en **HTTPS** sur mobile — d'où les deux solutions ci-dessous.
Dans les deux cas, le **code d'accès** te sera demandé une seule fois au premier appel (il est ensuite mémorisé sur l'appareil). Il se trouve dans `lingualive/.env` (ligne `ACCESS_CODE=…`).

## Option A — Tunnel Cloudflare (PC allumé, changements visibles instantanément)

### Sans compte (URL qui change à chaque lancement)
1. Double-clique sur `start-tunnel.bat`
2. Une URL `https://xxxx.trycloudflare.com` s'affiche → ouvre-la sur ton téléphone
3. Garde la fenêtre ouverte pendant l'utilisation

### Avec compte gratuit (URL fixe, recommandé à terme)
1. Crée un compte gratuit sur https://dash.cloudflare.com (il faut aussi y avoir un domaine, ou utiliser un sous-domaine `cfargotunnel`)
2. Dans un terminal :
   ```
   cloudflared tunnel login
   cloudflared tunnel create lingualive
   cloudflared tunnel route dns lingualive lingualive.TON-DOMAINE.com
   cloudflared tunnel run --url http://localhost:3100 lingualive
   ```
3. L'URL `https://lingualive.TON-DOMAINE.com` est alors permanente (tant que le PC est allumé).

## Option B — Hébergement Render (marche même PC éteint, URL permanente)

1. Crée un compte sur https://github.com (si pas déjà fait) et https://render.com (connexion via GitHub possible)
2. Crée un dépôt **privé** `lingualive` sur GitHub, puis pousse le code (le dépôt git local est déjà prêt) :
   ```
   cd "C:\Users\jeffr\OneDrive\Documents\Claude\Projects\LinguaLive"
   git remote add origin https://github.com/TON-PSEUDO/lingualive.git
   git push -u origin master
   ```
   (Demande-moi de le faire une fois tes comptes créés — j'aurai besoin que tu sois connecté via `gh auth login`.)
3. Sur render.com : **New + → Blueprint** → choisis le dépôt `lingualive` → Render lit `render.yaml` automatiquement
4. Renseigne les 2 variables d'environnement demandées :
   - `ANTHROPIC_API_KEY` = ta clé (dans `slideforge/.env`)
   - `ACCESS_CODE` = ton code d'accès
5. Déploie → l'appli est sur `https://lingualive-XXXX.onrender.com`
6. **Mises à jour automatiques** : à chaque changement du code ici, on fait `git push` et Render redéploie tout seul (~2 min). Ton téléphone récupère la nouvelle version au prochain lancement (service worker « réseau d'abord »).

⚠️ Plan gratuit Render : l'appli s'endort après 15 min d'inactivité → premier chargement ~30-60 s.

## Installer comme une vraie appli sur le téléphone

Une fois l'URL HTTPS ouverte dans Chrome (Android) ou Safari (iPhone) :
- **Android** : menu ⋮ → « Ajouter à l'écran d'accueil » / « Installer l'application »
- **iPhone** : bouton Partager → « Sur l'écran d'accueil »

L'icône 🎙️ apparaît comme une appli native, en plein écran, et **se met à jour automatiquement** à chaque ouverture.
