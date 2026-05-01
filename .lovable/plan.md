
# Plan — Zone perso "FlowTravel OPS"

## État actuel (bonne nouvelle)

L'infrastructure est **déjà en place** :
- Colonne `user_profiles.is_super_admin` existe
- Fonction SQL `is_super_admin(uuid)` existe
- Le compte `bonjour@flowtravel.fr` est déjà flaggé super_admin
- La sidebar filtre déjà avec `superAdminOnly: true`
- 5 pages admin existent déjà : `/admin-dashboard`, `/admin-agences`, `/admin-messages`, `/admin-errors`, `/admin-demos`

**Ce qu'il manque** : une vraie organisation visuelle "zone OPS" séparée pour t'y retrouver et y greffer facilement tes futurs outils perso.

## Ce qu'on va faire

### 1. Créer le namespace `/ops/*` (ta zone perso)

Au lieu de pages dispersées (`/admin-xxx`), on crée une vraie section :

```
/ops                  → Dashboard OPS (point d'entrée)
/ops/agences          → (= ancien /admin-agences)
/ops/messages         → (= ancien /admin-messages)
/ops/errors           → (= ancien /admin-errors)
/ops/demos            → (= ancien /admin-demos)
/ops/dashboard        → (= ancien /admin-dashboard)
```

Les anciennes URLs `/admin-*` continuent de fonctionner (redirections) pour ne rien casser.

### 2. Garde-fou de sécurité (3 niveaux)

- **Route guard** : `_ops.tsx` (layout parent) qui vérifie `is_super_admin` côté client → redirige sinon
- **Permissions.ts** : ajout d'un helper `canAccessOps(profile)` 
- **RLS Supabase** : déjà en place via `is_super_admin()` sur les tables sensibles

### 3. Sidebar : section visuelle "FlowTravel OPS"

Dans `app-layout.tsx`, on transforme la section actuelle "navFlowTravel" en bloc visuellement distinct :
- Séparateur + titre "🛠 FlowTravel OPS — Vous seul"
- Sur fond légèrement différent (bandeau terracotta discret)
- Visible uniquement si `isSuperAdmin === true`

### 4. Page d'accueil OPS

`/ops` → dashboard avec :
- 4 raccourcis vers les sections existantes (agences, messages, errors, demos)
- Une zone "Tes prochains outils" prête à recevoir ce que tu voudras ajouter plus tard

## Comment tu me parleras après

Convention claire :

| Mot-clé | Zone touchée |
|---|---|
| **"OPS : ..."** ou "dans mes outils" | Uniquement `/ops/*` (toi seul) |
| "landing", "page d'accueil publique" | Zone publique (prospects) |
| "dans l'app", "côté agences" | Zone SaaS client |
| Ambigu | Je te poserai la question |

Exemples :
- *"OPS : ajoute un graphique du MRR mensuel"* → page dans `/ops`, invisible aux clients
- *"Sur la landing, change le titre"* → `src/routes/index.tsx`
- *"Dans l'app, ajoute un filtre dans les dossiers"* → `src/routes/dossiers.tsx` (visible par tous tes clients)

## Détails techniques

**Fichiers créés**
- `src/routes/ops.tsx` — layout parent + garde super_admin + sidebar OPS
- `src/routes/ops.index.tsx` — dashboard OPS
- `src/routes/ops.agences.tsx`, `ops.messages.tsx`, `ops.errors.tsx`, `ops.demos.tsx`, `ops.dashboard.tsx` — réexports légers des composants existants

**Fichiers modifiés**
- `src/routes/admin-*.tsx` — gardés comme redirections vers `/ops/*`
- `src/components/app-layout.tsx` — section sidebar "FlowTravel OPS" mise en évidence
- `src/lib/permissions.ts` — helper `canAccessOps()` + ajout de `/ops` dans les routes admin

**Pas de migration DB** — l'infra `is_super_admin` est déjà en place.

**Pas de casse** — les anciennes URLs continuent de fonctionner via redirections.

## Hors-scope (à faire plus tard à ta demande)

- Ajout d'outils perso concrets dans `/ops` (KPIs MRR, vue clients SaaS, etc.) — tu me diras "OPS : ..." et je les ajouterai un par un
- Sous-domaine `ops.flowtravel.fr` — possible plus tard si tu veux une vraie séparation visuelle d'URL
