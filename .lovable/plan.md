## Problème observé

Lisa est à 7h30/jour contractuel. Quand on saisit ses heures réelles de travail, le compteur affiche bien +2h30 d'heures supp à rattraper. Dès qu'on ajoute un déplacement, le total perd 1h.

## Cause

Dans `src/lib/hr.ts`, fonction `calcCompteurMensuel` (ligne ~927), un jour de déplacement est plafonné à un hardcode `PLAFOND_DEPLACEMENT_FORMATION = 7` :

- jour de déplacement compté = `min(durée saisie, 7h)`
- pour Lisa (contrat 7h30) → chaque jour de déplacement vaut **7h au lieu de 7h30**
- 2 jours × 0,5h manquante = **−1h** sur le compteur

## Règle métier retenue (validée par tes réponses)

1. **Jour de déplacement sur un jour de rythme** = forfait contractuel pile (`heuresParJour` de l'employé, ex. 7h30 pour Lisa). Aucune heure sup générée par le déplacement, aucune perte non plus.
2. **Jour de déplacement hors rythme** (ex. samedi pour Lisa) = visible dans le planning, mais **0h** dans le compteur (déjà OK aujourd'hui).
3. La durée éventuellement saisie (heure début/fin) sur l'entrée déplacement est **ignorée pour le compteur** : le déplacement vaut toujours la journée contractuelle, ni plus ni moins.

## Modification ciblée

Fichier : `src/lib/hr.ts`, fonction `calcCompteurMensuel`.

- Supprimer la constante `PLAFOND_DEPLACEMENT_FORMATION = 7`.
- Branche `isContextOnly` (déplacement / formation) :
  - si `rythmeSet.has(d) && existing === null` → `heuresParJourMap.set(d, heuresParJour)` (forfait contractuel exact, plus de min/plafond hardcodé).
  - sinon (hors rythme, ou jour déjà rempli par une autre entrée travail) → inchangé : on ne touche à rien.
- Mettre à jour le commentaire d'en-tête de la fonction pour refléter la nouvelle règle ("déplacement/formation : forfait contractuel exact sur jour de rythme, 0 sinon, jamais d'heures sup").

Aucune autre fonction ni aucune table n'est impactée.

## Vérification après implémentation

Sur Lisa (contrat 7h30, 5j/sem) :

1. Mois sans aucun déplacement, semaine type avec +30 min/jour → solde = +2h30. **Inchangé**.
2. Ajouter un déplacement de 2 jours sur des jours de rythme, sans entrée travail concurrente → le compteur **n'augmente ni ne diminue** par rapport à la même semaine remplie en travail au forfait : chaque jour de déplacement = 7h30. Plus de "−1h".
3. Déplacement posé un samedi (hors rythme Lisa) → reste à 0h dans le compteur, badge visible dans le planning.
4. Déplacement + travail le même jour → l'entrée travail prend le pas (comportement actuel conservé), le déplacement n'ajoute rien.
