## Objectif

Aligner la **base RH** sur le **forfait mensualisé paie** (151,67h pour Lisa temps plein 35h) au lieu du calcul "jours rythme réels du mois". Conséquence : le solde RH ne fluctue plus selon le nombre de fériés du mois.

## Formule

```
base_mensuelle = jours_rythme_par_semaine × heures_par_jour × 52 / 12
```

- Lisa (5 jours × 7h) → **5 × 7 × 52/12 = 151,67h**
- Temps partiel 4 jours × 7h → 121,33h
- Rythme A/B → moyenne des deux semaines

## 1. `src/lib/hr.ts` — `calcCompteurMensuel`

- Remplacer `const base = joursRythme.length * heuresParJour;` par le calcul forfait :
  ```ts
  const joursParSemaine = emp ? moyenneJoursParSemaine(emp) : 5;
  const base = joursParSemaine * heuresParJour * 52 / 12;
  ```
- Ajouter helper `moyenneJoursParSemaine(emp)` :
  - `fixe` → `semaine_a_jours.length` (fallback 5)
  - `ab` → `(semaine_a_jours.length + semaine_b_jours.length) / 2`
- Le reste du calcul (réalisé, neutralisations CP, récup, déplacement forfait, remplacement) ne change pas.
- `joursNeutralises` (CP, maladie, RTT) restent comptés "comme travaillés" pour ne pas creuser le solde — comportement OK avec le forfait.

## 2. UI — labels et tooltips

`src/routes/ops.equipe.index.tsx` :
- Commentaire ligne 158-159 : remplacer par "Base = forfait mensualisé (jours rythme/sem × h/jour × 52/12)"
- Si un tooltip mentionne "133h" ou "jours rythme du mois", le mettre à jour : "151,67h pour un temps plein 5j × 7h, identique à la fiche de paie"

`src/routes/ops.equipe.planning.tsx` : aucun changement de signature, juste vérifier que l'affichage du compteur dit bien "Base 151,67h" et non "Base 119h".

## 3. Migration & nettoyage

- Pas de schéma à modifier.
- Vider `hr_compteur_heures` pour forcer recalcul (déjà géré par `clearCompteursMois` au load + bouton "Forcer le recalcul").

## Impact

| Mois 2026 | Ancienne base (réelle) | Nouvelle base (forfait) |
|---|---|---|
| Janvier | 147h | **151,67h** |
| Février | 140h | **151,67h** |
| Mars | 154h | **151,67h** |
| Mai | 119h | **151,67h** |

Le solde RH reflètera désormais l'**effort réel vs contrat paie**, pas les variations de calendrier.

## Hors scope

- Soldes annuels CP / RTT
- Modulation annuelle 1607h (à faire si un jour vous signez un accord de modulation)
