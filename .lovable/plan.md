## Plan de correction RH — version revue

### Distinction clé
- **Bulletin de paie** : reste sur la base mensualisée 151,67h (35h × 52 / 12). C’est l’information à afficher comme « base paie » et à exporter pour la comptable.
- **Logiciel RH (FlowTravel)** : suit la **réalité** du contrat 37h30 / semaine. Toute heure travaillée au-delà de 35h doit être visible, comptée et déclencher une alerte / un droit à récupération. C’est cette mécanique qui pilote les rattrapages d’heures et de jours.

Donc on **n’absorbe pas** les heures sup dans le calcul interne. On affiche simplement deux références côte à côte.

### 1. Compteur mensuel — deux références claires
Dans `src/lib/hr.ts` (`calcCompteurMensuel`) et dans les vues, exposer :
- `base_paie` : 151,67h (paie 35h mensualisée). Sert uniquement à l’affichage / export.
- `base_contractuelle` : forfait réel = jours rythme × heures/jour (ex. Lisa 37h30 → 162,5h sur un mois standard).
- `realisees` : heures réellement faites (planning + récup déduites).
- `solde` : `realisees − base_contractuelle` → c’est ce solde qui alimente les alertes et les droits à récup.
- `heures_sup_cumulees` : heures au-delà de la base contractuelle, à reporter / rattraper.

Important : on **ne soustrait pas** la part « RTT » du solde. Les RTT restent un compteur **séparé**, posé via le module Absences.

### 2. Vue d’ensemble compteurs — afficher les deux bases
Dans :
- `src/routes/ops.equipe.planning.tsx` (onglet « Compteurs d’heures »)
- `src/routes/ops.equipe.index.tsx` (onglet « Récap mensuel »)

Ajouter une colonne **Base paie (151,67h)** à côté de **Base réelle (162,5h)** pour Lisa, avec une infobulle expliquant que la paie reste mensualisée à 35h, indépendamment du rythme réel.

### 3. Alertes fin de mois — garder strict
`alertesFinDeMois()` reste basée sur `solde > 0` par rapport à la **base contractuelle réelle**, pas la base paie. Pas de “tolérance RTT”. C’est exactement ce qui doit déclencher la pose de récup.

### 4. Compteurs incohérents après suppression
Lorsque tout le planning d’un employé est supprimé pour le mois :
- recalculer immédiatement et écraser/supprimer la ligne `hr_compteur_heures` correspondante ;
- la vue d’ensemble doit recharger comme la vue planning (aujourd’hui elle peut afficher un solde figé).

Action : sur la vue d’ensemble (`ops.equipe.index.tsx`), après chaque suppression OU au chargement, exécuter le même `clearCompteursMois` + recalcul que `ops.equipe.planning.tsx`.

### 5. Poubelle sur les demandes de récupération (Planning)
Dans l’onglet **Demandes de récupération** de `ops.equipe.planning.tsx`, ajouter un bouton poubelle sur chaque ligne quel que soit le statut (en attente, approuvée, refusée), avec confirmation. Comportement identique à `ops.equipe.absences.tsx` (utilise `deleteRecupDemande`, qui supprime aussi l’entrée planning liée).

### 6. Vue annuelle du planning à partir du 01/05/2026
Nouvel onglet « Année » dans `ops.equipe.planning.tsx` :
- vue compacte 12 mois (mai 2026 → avril 2027 par défaut), une ligne par employé ;
- chaque cellule = 1 jour, couleur du type (travail / congé / récup / déplacement…), comme la vue mensuelle mais réduite ;
- en-tête mensuel cliquable pour basculer sur le mois correspondant ;
- colonne de droite : cumul annuel d’heures sup à rattraper et de jours dus / rendus ;
- date de départ paramétrable (input « depuis »), pré-remplie au 01/05/2026.

Pas de nouvelle table : on agrège côté client `listPlanning(start, end)` et `listAbsences()` sur la fenêtre choisie, plus la liste des compteurs mensuels stockés.

### Fichiers concernés
- `src/lib/hr.ts` — calc compteurs, base paie / base réelle, agrégat annuel.
- `src/routes/ops.equipe.planning.tsx` — colonnes compteurs, poubelle récup, onglet « Année ».
- `src/routes/ops.equipe.index.tsx` — recalcul auto, colonne base paie.
- Pas de migration DB nécessaire (on dérive la base paie à partir de l’existant).