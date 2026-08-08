# 🚀 Mettre LinguaLive en ligne (URL définitive, PC éteint)

Objectif : une adresse **qui ne change plus jamais**, accessible du téléphone même PC éteint.
Hébergeur : **Render** (offre gratuite). Durée : ~15 minutes, dont 5 pour toi.

---

## Ce que TU fais (je ne peux pas créer de comptes à ta place)

### Étape 1 — Compte GitHub (~3 min)
1. Va sur **github.com/signup** (si tu as déjà un compte, passe à l'étape 2)
2. Email `jeffreysiombo@gmail.com`, choisis un pseudo et un mot de passe
3. Valide le code reçu par email

### Étape 2 — Créer le dépôt vide (~1 min)
1. Va sur **github.com/new**
2. **Repository name** : `lingualive`
3. Coche **Private** (personne d'autre ne verra le code)
4. ⚠️ Ne coche **RIEN** d'autre (pas de README, pas de .gitignore, pas de licence)
5. Clique **Create repository**
6. Copie l'adresse affichée, du type `https://github.com/TON-PSEUDO/lingualive.git`

### Étape 3 — Me donner l'adresse
Colle-la-moi dans le chat. **Je m'occupe d'envoyer le code.**
Une fenêtre de connexion GitHub peut s'ouvrir sur ton écran : connecte-toi, c'est normal (c'est ton ordinateur qui demande l'autorisation d'écrire sur ton dépôt).

### Étape 4 — Compte Render et déploiement (~5 min)
1. Va sur **render.com** → **Get Started** → **Sign in with GitHub** (autorise l'accès)
2. Clique **New +** (en haut à droite) → **Blueprint**
3. Choisis le dépôt **lingualive** → Render lit tout seul le fichier de configuration
4. Il demande 3 valeurs (elles restent secrètes chez Render, jamais dans le code) :
   - **ANTHROPIC_API_KEY** : ta clé Claude — elle est dans le fichier
     `C:\Users\jeffr\OneDrive\Documents\Claude\Projects\SlideForge\.env`
     (ouvre-le avec le Bloc-notes, copie ce qui suit `ANTHROPIC_API_KEY=`)
   - **ACCESS_CODE** : ton code d'accès — il est dans le fichier `.env` du projet,
     ligne `ACCESS_CODE=` (ce fichier n'est jamais envoyé sur GitHub).
     ⚠️ Ne jamais écrire ce code dans un fichier suivi par git : le dépôt est public.
   - **OPENAI_API_KEY** : ta clé OpenAI si tu veux les voix premium, sinon laisse vide
5. Clique **Apply** / **Deploy** et attends ~3 minutes
6. Render affiche ton adresse définitive, du type **`https://lingualive-xxxx.onrender.com`**

### Étape 5 — Installer sur le téléphone (dernière fois !)
1. Ouvre cette adresse sur le téléphone (Chrome ou Safari)
2. Saisis le code d'accès au premier échange
3. Menu ⋮ → **« Ajouter à l'écran d'accueil »**
4. Supprime les anciennes icônes LinguaLive

---

## Ensuite : les mises à jour

À chaque amélioration faite ici, je fais un `git push` et **Render redéploie tout seul en ~2 minutes**.
Ton téléphone reçoit la nouvelle version à la réouverture de l'appli. Plus rien à réinstaller, jamais.

---

## Bon à savoir (offre gratuite)

- **Mise en veille** : après 15 minutes sans usage, le serveur s'endort. Le premier chargement suivant prend **30 à 60 secondes** (l'appli patiente, elle est réglée pour). Les suivants sont instantanés.
- **Ta clé API est stockée chez Render** (chiffrée, invisible dans le code). Le code d'accès empêche un inconnu tombant sur l'adresse d'utiliser tes crédits.
- **Tes données de progression** (vocabulaire, sessions, erreurs, parcours) restent sur tes appareils et se synchronisent via le serveur. Le fichier de synchronisation côté Render peut être remis à zéro lors d'un redéploiement : sans conséquence, tes appareils le reremplissent à la synchronisation suivante.
- **Le PC ne sert plus** pour l'usage mobile. Tu peux garder le serveur local pour travailler dessus, les deux coexistent sans problème.
