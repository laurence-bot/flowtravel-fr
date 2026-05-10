# Correction du bug "Lock auth-token was released because another request stole it"

## Cause confirmée

Dans `src/routes/ops.equipe.planning.tsx` (lignes 561-575), la sauvegarde d'un planning sur une plage déclenche `Promise.all(dates.map(upsertPlanning(...)))`. Chaque appel `upsertPlanning` dans `src/lib/hr.ts` fait son propre `supabase.auth.getUser()` (12 occurrences au total dans `hr.ts`). Quand 10-30 dates partent en parallèle, le lock interne `lock:sb-…-auth-token` est volé d'une requête à l'autre → erreur visible côté UI.

Le même problème touche `getMyAgenceId()` qui est lui aussi appelé dans la plupart des fonctions RH.

## Plan

### 1. Helper centralisé (nouveau fichier `src/lib/auth-cache.ts`)

- `getCurrentUserSafe()` : mémorise la `Promise` en cours pour dédupliquer les appels concurrents (pattern fourni par l'utilisateur).
- `getCurrentUserIdSafe()` : raccourci qui renvoie `user.id`.
- `getMyAgenceIdSafe()` : même pattern de promise-cache, avec en plus une **mémoïsation par `user.id`** (l'`agence_id` ne change pas pendant la session) pour éviter de re-frapper `user_profiles` à chaque opération.
- Reset des caches sur `supabase.auth.onAuthStateChange` (sign-in/out).

### 2. Refactor `src/lib/hr.ts`

- Remplacer les 12 `supabase.auth.getUser()` par `getCurrentUserSafe()`.
- Remplacer le corps actuel de `getMyAgenceId()` par un appel à `getMyAgenceIdSafe()` (on garde l'export pour ne rien casser ailleurs).
- Pas de changement de signature publique → aucun impact sur les routes consommatrices.

### 3. Sérialiser la sauvegarde planning (`src/routes/ops.equipe.planning.tsx`)

- Remplacer les deux `Promise.all` (lignes 517 et 561-575) par des **boucles `for…of` séquentielles**. Le gain de parallélisme est négligeable (≤30 lignes), et ça élimine définitivement la contention sur le lock auth + réduit la charge concurrente côté Postgres.
- Idem pour les `Promise.all(conflictEntries.map(deletePlanning…))`.

### 4. Anti double-clic sur "Enregistrer"

- Le bouton est déjà `disabled={saving}` (ligne 1378) ✅.
- Ajouter une **garde au tout début de `save()`** : `if (saving) return;` pour bloquer un éventuel double appel (clavier, double event).
- Pour le 2ᵉ bouton "Enregistrer" du dialogue récup (ligne 1500) : ajouter aussi un état `savingRecup` + `disabled`.

### 5. Vérification

- Test manuel : créer une "semaine type" sur un mois entier (≈22 entrées) → plus d'erreur de lock, toast "X entrée(s) ajoutée(s)" OK.
- Vérifier qu'aucun autre endroit du repo ne fait des `Promise.all` massifs sur des fonctions RH (rapide grep `Promise.all.*upsert|Promise.all.*hr`).

## Fichiers touchés

- **Nouveau** : `src/lib/auth-cache.ts`
- **Modifié** : `src/lib/hr.ts` (substitutions ciblées, pas de refonte)
- **Modifié** : `src/routes/ops.equipe.planning.tsx` (Promise.all → for…of, garde anti double-clic, savingRecup)

## Hors scope

- Pas de changement de schéma DB.
- Pas de refonte de la logique métier (compteurs, A/B, fériés…) — strictement le bug technique signalé.
