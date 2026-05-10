# Plan corrigé : solde Lisa = 5h

## Règle métier à appliquer

Pour un contrat RTT comme Lisa :

- la journée de référence paie est **7h** ;
- la journée contractuelle est **7h30** ;
- entre 7h et 7h30, on crédite uniquement la différence en récupération ;
- à 7h pile, l'impact est **0h** ;
- sous 7h, on creuse le solde ;
- les déplacements / formations restent neutralisés : comptés 7h sur les jours de travail, sans crédit RTT ni pénalité.

## Résultat attendu pour Lisa en mai 2026

Lisa a 12 jours de travail réellement saisis :

- **02/05** : 7h → 0h à rattraper
- **04/05** : 7h → 0h à rattraper
- **05, 06, 07, 11, 12, 25, 26, 28, 29, 30** : 10 jours à 7h30 → 10 × 0h30 = **5h à rattraper**
- **13 au 24** : déplacement → neutralisé, compté 7h sur les jours de travail, sans toucher au solde

Donc le solde mensuel attendu est **+5h**, pas 4h ni 4h30.

## Correction à faire

Dans `src/lib/hr.ts`, fonction `calcCompteurMensuel`, branche `hasRttAgreement` :

1. Garder le calcul du crédit RTT journalier :

```ts
const rttCredit = Math.max(0, Math.min(effective, heuresParJour) - basePaieJour);
const overtimeBeyondContract = Math.max(0, effective - heuresParJour);
rttAcquises += rttCredit;
```

2. Remplacer la pénalité actuelle basée sur `heuresParJour` par une pénalité basée sur `basePaieJour` :

```ts
if (effective < basePaieJour) {
  dayImpact = effective - basePaieJour;
} else {
  dayImpact = rttCredit + overtimeBeyondContract;
}
```

## Effet de la correction

- Journée à 7h00 : `effective < basePaieJour` est faux, `rttCredit = 0`, donc impact **0h**.
- Journée à 7h30 : `rttCredit = 0,5`, donc impact **+0,5h**.
- Journée à 8h00 : `rttCredit = 0,5` + `overtimeBeyondContract = 0,5`, donc impact **+1h**.
- Journée à 6h30 : `6,5 - 7 = -0,5h`, donc impact **−0,5h**.

## Vérification

Après implémentation :

1. Recalculer Lisa sur mai 2026.
2. Confirmer que le solde affiche **+5h**.
3. Confirmer que les déplacements du 13 au 24 restent neutralisés et ne génèrent ni RTT ni pénalité.
