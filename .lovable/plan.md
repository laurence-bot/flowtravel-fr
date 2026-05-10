## Contexte

Actuellement dans `src/lib/hr.ts`, les jours de **déplacement** et **formation** sont comptés à hauteur de `heures_par_jour` du contrat (= 7h30 pour Lisa, soit sa journée contractuelle complète hors pause).

C'est incorrect. La règle métier réelle est :

> **Déplacement / formation = 7h de travail effectif par jour, max 5 jours / semaine, pas de dépassement.**
> La pause de 30 min s'ajoute en amplitude horaire mais n'est jamais payée ni comptée.

Donc une journée de déplacement de Lisa doit compter **7h** (pas 7h30), même si son contrat normal est à 7h30/jour. La différence (-0h30) est absorbée — pas d'heures sup, pas de manque non plus puisque c'est la règle.

## Changements

### 1. `src/lib/hr.ts` — `calcCompteurMensuel()`

Remplacer le plafond `heuresParJour` par une **constante de 7h** pour les types `deplacement` et `formation` :

```ts
const PLAFOND_DEPLACEMENT_FORMATION = 7; // heures de travail effectif, hors pause
```

- Pour chaque jour `deplacement` ou `formation` tombant sur un jour travaillé du rythme A/B :
  - compter **exactement 7h** (ignorer toute valeur saisie supérieure)
  - si valeur saisie < 7h, prendre la valeur saisie (cas demi-journée)
- Si le jour tombe sur un jour non travaillé du rythme ou un férié → **ne rien compter** (déjà en place, on garde).
- Garder la limite "max 5 jours / semaine" déjà implémentée.

### 2. Documentation inline

Ajouter un commentaire au-dessus de la constante expliquant la règle métier (7h effectif + 30 min pause non payée = 7h30 d'amplitude), pour éviter qu'un futur dev re-confonde avec `heures_par_jour`.

### 3. Vérification visuelle

Aucun changement UI. Après déploiement, l'utilisateur clique **« Forcer le recalcul »** sur le planning de mai pour voir le solde de Lisa s'ajuster.

## Hors scope

- Pas de changement sur les autres types (travail normal, récup, congés, RTT, fériés).
- Pas de changement de schéma DB.
- Pas de changement du contrat de Lisa (reste à 7h30/jour, 30 min pause, 162.5h/mois).

## Question ouverte (à confirmer avant ou après implémentation)

La constante 7h est-elle **globale à toute l'entreprise**, ou doit-elle devenir un champ configurable par employé (`heures_deplacement_par_jour`) ? Pour l'instant je pars sur **constante globale 7h** ; on pourra extraire en colonne DB plus tard si besoin.
