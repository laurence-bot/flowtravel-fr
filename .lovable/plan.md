# Correctif heures à rattraper + récup avec créneau horaire

## 1. Bug du double comptage (afficher 5h au lieu de 6h)

Dans `src/lib/hr.ts`, fonction `calcCompteurMensuel` (~ligne 958) :

Aujourd'hui pour chaque jour travaillé : `dayImpact = rttCredit + overtimeBeyondContract` — donc le 0h30 entre la base de paie (7h) et la base contractuelle (7h30) est ajouté **à la fois** dans `rttAcquises` et dans le `solde/impact`.

Correction : ne plus ajouter `rttCredit` dans `dayImpact`. Le solde ne s'incrémente qu'avec les vraies heures sup au-dessus de 7h30. Le 0h30 reste uniquement dans `rttAcquises` (heures à rattraper).

Résultat attendu pour Lisa, mai 2026 : **+5h** au lieu de +6h.

## 2. Demande de récupération avec plage horaire

### Dialog (`src/routes/ops.equipe.planning.tsx`)
- Remplacer le champ unique « Heures à récupérer » par **Heure de début** + **Heure de fin** (inputs `time`)
- Calculer automatiquement `heures_demandees = fin - début` et l'afficher en lecture seule
- Validation : fin > début, total > 0

### Helper (`src/lib/hr.ts`)
- `createRecupDemande` remplit `heure_debut`, `heure_fin` et `heures_demandees` dérivé de la plage
- Compatibilité conservée pour les anciennes demandes sans créneau

### Trigger SQL `trg_absence_recup_to_planning`
- Quand la demande est approuvée, l'entrée `recuperation` créée dans `hr_planning_entries` reprend `heure_debut` / `heure_fin` au lieu de couvrir la journée entière
- L'absence apparaît alors dans le planning sur le créneau exact (ex. 14:00 → 16:30)

## 3. Vérification

Après build :
- Recharger la page planning de Lisa pour mai 2026 → solde doit afficher **+5h**
- Créer une demande de récup avec plage horaire → vérifier qu'elle apparaît bien dans le créneau dans la grille planning une fois approuvée
