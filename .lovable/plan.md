# Pourquoi le solde affiche −1h au lieu de +5h

## Diagnostic

Sur la capture, pour Lisa en mai 2026 :
- BASE RÉELLE = 142,5h (19j × 7,5h)
- H. RÉALISÉES = 138h
- SOLDE = **−1h**, RÉCUP (H) = vide

Le correctif précédent a retiré `rttCredit` de `dayImpact` dans `calcCompteurMensuel` (`src/lib/hr.ts` ligne 961). Conséquence :

- avant : chaque journée de 7h30 ajoutait +0h30 au solde (10 jours × 0,5 = +5h ✓)
- après : ces 0h30 ne vont plus que dans `rttAcquises`, jamais dans `solde`

Or la colonne SOLDE du récap (`src/routes/ops.equipe.index.tsx` ligne 340) affiche `calc.solde`, pas `calc.rttAcquises`. La colonne RÉCUP (H) (ligne 344) affiche aussi `Math.max(0, calc.solde)`. Donc le +5h attendu a disparu de l'écran, et il ne reste que les éventuelles journées < 7h30 qui creusent le solde → on tombe à −1h.

C'est exactement le contraire de ce qu'on voulait : on a corrigé un « double comptage » qui n'en était pas un. Le `rttCredit` n'était comptabilisé qu'une seule fois, dans `solde` (= heures à rattraper). `rttAcquises` est un compteur informatif séparé qui n'est affiché nulle part dans le récap mensuel.

## Correctif proposé

### 1. Revenir au comportement attendu pour le solde

Dans `src/lib/hr.ts` (ligne 961, fonction `calcCompteurMensuel`), réintégrer le crédit RTT journalier dans l'impact du jour :

```ts
dayImpact = effective < heuresParJour
  ? effective - heuresParJour
  : rttCredit + overtimeBeyondContract;
```

Lisa mai 2026 :
- 10 jours à 7h30 → 10 × 0,5 = +5h
- 2 jours à 7h00 → 0
- pas d'heure sup au-delà de 7h30, pas de récup
- **solde attendu = +5h** (au lieu de −1h)

### 2. Vérifier la colonne RÉCUP (H)

`heures_recup: Math.max(0, calc.solde)` reste cohérent : avec solde = +5h, la colonne affichera bien 5h.

### 3. Vérifier qu'on n'a pas d'autre source du −1h

Une fois le solde réintégré, il faut vérifier qu'il n'y a pas une journée saisie < 7h30 qui creuse encore le compteur. Si oui, identifier laquelle (probablement une saisie manuelle dans le planning à inspecter) avant de conclure.

## Vérification

1. Recharger `/ops/equipe` onglet « Récap mensuel », mois 2026-05 → SOLDE Lisa doit afficher **+5h** et RÉCUP (H) **5h**.
2. Aller sur le planning de Lisa pour mai 2026 et confirmer qu'aucune journée n'est saisie en dessous de 7h30 (sinon m'indiquer laquelle, je l'inspecte).
