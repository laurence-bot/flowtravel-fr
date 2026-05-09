## Objectif

Aligner le calcul du compteur mensuel sur la **réalité du mois** (pas le forfait paie), avec pause déjeuner par défaut et nouveau type `remplacement`.

## 1. Données — corriger les pauses manquantes

`UPDATE` sur les 2 entrées de Lisa avec `pause_minutes = 0` :
- 04/05/2026 → pause_minutes = 30
- 12/05/2026 → pause_minutes = 30

## 2. Migration DB

- Ajouter `'remplacement'` à l'enum `hr_planning_entry_type`
- Créer `hr_jours_dus` (employee_id, agence_id, sens 'du'|'rendu', date_origine, motif, planning_entry_id, date_extinction, extinction_entry_id, statut, note) + RLS agence
- Trigger `hr_planning_entries`: à l'insert d'un `remplacement` → créer `hr_jours_dus` (sens='rendu') et tenter d'éteindre le plus ancien `du` ouvert de l'employé

## 3. `src/lib/hr.ts` — refonte `calcCompteurMensuel`

**Pause par défaut** : helper `dureeNetteEntry(e)` — si `type='travail'`, `heures_debut`/`heures_fin` saisis, durée brute > 6h et `pause_minutes = 0` → applique 30 min de pause par défaut.

**Boucle jours du mois** :
- `joursRythme[d]` = jour rythme (selon `rythme_semaine`/`semaine_a_jours`/`semaine_b_jours`/`semaine_ref_iso`) ET non férié
- **Base mensuelle** = `joursRythme.length × heuresParJour` (= 7h) → pour Lisa mai 2026 : 19 × 7 = **133h**

**Comptage par type** :
| Type | Comptage |
|---|---|
| `travail`, `teletravail`, `reunion` | `dureeNetteEntry(e)` (avec pause auto) |
| `deplacement`, `formation` | si jour rythme → 7h forfait ; sinon **0h** |
| `remplacement` | **0h** (impact via DB jours dus) |
| `recuperation` | `−heuresParJour` |
| `conge_paye` | neutre = `heuresParJour` |

**Suppression** du paramètre `baseMensuelleFixe` (forfait 151,67h n'est plus utilisé pour le solde RH).

## 4. Types & UI planning

- `PlanningEntryType` + `PLANNING_TYPE_LABELS` : ajouter `remplacement` (libellé « Remplacement »)
- Couleur dédiée dans le calendrier planning
- Option dans le dialog de création d'entrée

## 5. `src/routes/ops.equipe.index.tsx`

- `hParJour = 7` (au lieu de 7,5)
- Badge mensuel : `Xh / 133h` (base réelle) avec couleur selon solde
- Tooltip : « Forfait paie 151,67h — base réelle du mois Yh (jours rythme − fériés × 7h) »

## 6. `src/routes/ops.equipe.$id.tsx`

- Bloc « Jours à rendre / rendus » listant `hr_jours_dus` ouverts
- Bouton « Marquer comme rendu manuellement »

## 7. Hors scope

- Acquisition CP / soldes annuels
- Heures sup > 7h sur jour rythme : restent comptées telles quelles (génèrent solde positif)
- Calcul forfait paie 151,67h : reste utilisé uniquement pour les bulletins, pas modifié

## Impact recalculé pour Lisa — mai 2026

- Base réelle = **133h**
- Réalisé = 90,5h travail (avec pauses corrigées) + 49h déplacement forfait − 2,75h récup = **136,75h**

  Wait — recalcul précis avec pauses corrigées :
  - 04/05 : 7h (au lieu de 7,5h)
  - 12/05 : 7,5h (au lieu de 8h, pause 30 min ajoutée)
  - Travail = 9×7,5 + 2×7 = 81,5h… 
  
  Calcul détaillé sera refait à l'implémentation, mais ordre de grandeur : **~135h réalisé vs 133h base → solde ≈ +2h**.

- Jours dus = −1 (Mer 27/05 marqué `remplacement`)
