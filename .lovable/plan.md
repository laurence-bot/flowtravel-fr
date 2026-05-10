Je vais corriger la logique sans toucher aux données de Lisa.

Constat dans le code et la base :
- Mai contient bien 2 récupérations approuvées de 2h30, soit 5h.
- Le planning mensuel et la vue annuelle ne lisent pas les récupérations de la même façon :
  - le planning mensuel repart des demandes RH et compte bien 2h30 + 2h30 ;
  - la vue annuelle relit surtout les entrées planning liées, qui n’ont pas le champ `heures_demandees`, donc elles retombent à 2h + 2h au lieu de 5h.
- La logique RTT a aussi été trop durcie : pour Lisa en accord RTT, une journée à 7h30 doit créditer 0h30 de récupération, une journée à 7h ne doit pas créer -0h30. Les 5h de crédit RTT de mai doivent donc être annulées par les 5h posées.

Plan de correction :
1. Créer une logique commune dans `src/lib/hr.ts` pour construire les entrées utilisées par les compteurs :
   - ignorer les entrées planning `recuperation` déjà liées à une demande RH ;
   - ajouter à la place les demandes de récupération approuvées avec leur vraie durée `heures_demandees`.
2. Corriger `calcCompteurMensuel` pour les employés avec RTT :
   - journée normale à 7h30 = +0h30 de solde récupérable ;
   - journée à 7h = 0, pas -0h30 ;
   - récupération posée = déduction exacte des heures demandées ;
   - heures sup réelles seulement au-delà de 7h30.
3. Brancher le planning mensuel et la vue annuelle sur cette même logique commune, pour que mai affiche le même solde dans les deux vues.
4. Vérifier avec les données actuelles de Lisa que mai 2026 retombe à 0h sur le planning et sur la vue annuelle.