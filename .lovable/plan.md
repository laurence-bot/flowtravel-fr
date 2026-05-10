## Objectif

Finaliser les 3 points en suspens des correctifs globaux FlowTravel sur la synchronisation PDF + vols + fournisseurs.

## 1. Stabilité de la modale d'import PDF

Fichier : `src/components/program-import-dialog.tsx` (ou équivalent)

- Ajouter `onInteractOutside={(e) => e.preventDefault()}` et `onEscapeKeyDown` contrôlé pour empêcher la fermeture accidentelle pendant un changement d'onglet ou un clic hors zone.
- Persister l'état de la modale (fichier sélectionné, onglet actif, données parsées) dans `sessionStorage` sous une clé `pdfImport:{cotationId}`.
- Restaurer cet état à l'ouverture si présent ; nettoyer la clé après import réussi ou annulation explicite par l'utilisateur (bouton « Annuler »).

## 2. Garde-fous sur `upsertJoursProgramme`

Fichier : `src/lib/program-import.ts`

- Avant tout insert/upsert d'un jour, charger `cotations.date_depart` et `cotations.date_retour` (ou équivalent) de la cotation cible.
- Filtrer toute ligne PDF dont `date_jour` est strictement postérieure à la date de retour ou antérieure à la date de départ.
- Logger en console les lignes ignorées avec raison (`hors_plage_voyage`) pour diagnostic.
- Règle globale : aucun hardcode de pays, fournisseur ou cotation.

## 3. Rafraîchissement des inclusions via `inferTripContext`

Fichiers : `src/lib/detect-inclusions.ts` + le composant qui héberge le bouton « Détecter les inclusions » (probablement `src/components/quote-content-editor-block.tsx`).

- Exposer `inferTripContext(cotation, vols)` déjà créé dans le module.
- Le bouton « Détecter les inclusions » doit :
  1. Recharger les vols et la cotation à jour.
  2. Appeler `inferTripContext()` pour résoudre `home_country` et `destination_country`.
  3. Passer ce contexte à `detectInclusions()` afin que les badges Vol international / domestique / Nuit en vol / Hébergement soient recalculés selon les nouvelles règles IATA.
  4. Mettre à jour les badges en base via le même flux d'upsert idempotent (pas de doublon).

## Vérifications après implémentation

- Cliquer 2× « Sync PDF + vols » → aucun nouveau jour, aucun nouveau fournisseur.
- Ouvrir la modale d'import, changer d'onglet du navigateur, revenir → modale toujours ouverte avec son état.
- Importer un PDF qui contient des jours après la date de retour → ces jours sont ignorés.
- Cliquer « Détecter les inclusions » sur une cotation existante → badges cohérents avec les règles IATA (pas de « Hébergement » sur une nuit en vol, pas de « Vol domestique » pour CDG→MRS dans un voyage international).
