## Objectif

Aligner le calcul du compteur mensuel sur le contrat réel : **35h/semaine × 52 semaines = 1820h/an → 151,67h/mois fixes**, avec 7h comme référence quotidienne. Les CP sont déduits uniquement à la prise (pas de logique d'acquisition à toucher ici).

## Changements

### 1. `src/lib/hr.ts` — `calcCompteurMensuel`

- Ajouter un paramètre optionnel `baseMensuelleFixe?: number`. Quand fourni, il **remplace** le calcul `joursEffectifs.length * heuresParJour` :
  - `base = baseMensuelleFixe` (ex. 151,67)
  - Les jours fériés et les jours non travaillés du rythme n'ont plus d'impact sur la base (déjà inclus dans le forfait).
- Le calcul des heures réalisées par jour (`heuresParJourMap`) reste identique, mais utilise désormais `heuresParJour = 7` par défaut (au lieu de 7,5) pour :
  - le fallback `deplacement`/`formation` sans horaires saisis,
  - le fallback `travail` sans horaires saisis.
- Les heures réelles saisies (8:45–16:45, pause 30min = 7,5h) restent comptées telles quelles : Lisa générera donc naturellement +0,5h/jour de solde si elle dépasse 35h/semaine.
- Congés payés (`type === "conge_paye"`) : compter le jour comme **neutre** (= `heuresParJour` de référence, soit 7h) afin que la prise de CP ne crée ni solde positif ni négatif. Le décompte du nombre de jours de CP restants reste géré ailleurs (compteur séparé, hors scope).

### 2. `src/routes/ops.equipe.index.tsx`

- Remplacer `const hParJour = 7.5;` par `const hParJour = 7;`
- Calculer `const baseMensuelleFixe = (emp.heures_par_semaine ?? 35) * 52 / 12;` (fallback 35h si champ absent)
- Appeler `calcCompteurMensuel(empPlanningAvecRecups, joursOuvres, hParJour, emp, baseMensuelleFixe)`
- Stocker `h_par_jour: hParJour` (= 7) inchangé en structure.

### 3. `src/routes/ops.equipe.$id.tsx`

- Changer le `value={employee.heures_par_jour ?? 7.5}` → `?? 7`.
- Ajouter (si pas déjà présent) un champ `heures_par_semaine` (défaut 35) à côté de `heures_par_jour`, pour permettre la base contractuelle. Si tu préfères ne pas toucher au schéma DB maintenant, on garde la constante `35` en dur dans le calcul.

### 4. Reste hors scope

- Acquisition CP (2,08j/mois), report, soldes annuels → pas modifiés.
- `calcHeuresRealisees` (utilisé ailleurs avec 5,75) → pas touché tant que tu ne le demandes pas.

## Impact attendu pour Lisa — mai 2026

- **Base** = 151,67h (au lieu de 142,5h actuellement)
- **Réalisé** ≈ 146h (inchangé)
- **Solde** ≈ −5,67h (au lieu de +3,5h)

Ce qui reflète correctement qu'elle a fait un peu moins que son forfait mensuel ce mois-là.

## Question avant implémentation

Veux-tu :
- **(A)** Hardcoder 35h dans le calcul (rapide, pas de migration DB), ou
- **(B)** Ajouter un champ `heures_par_semaine` sur `employees` (migration + UI fiche employé) pour gérer aussi les temps partiels ?
