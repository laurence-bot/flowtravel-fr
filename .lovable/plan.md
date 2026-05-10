## Objectif

Repartir à zéro sur le dossier RH de Lisa : effacer toutes les données rattachées à son `hr_employees.id` (planning, pointage, absences, récupérations, contrats, évaluations, fiches de poste, documents, compteurs, jours dus/rendus, abonnements push), **sans supprimer la fiche employée elle-même**.

Deux livrables :
1. **Nettoyage immédiat** via une opération de données ciblée sur Lisa.
2. **Bouton réutilisable** dans la fiche employé pour refaire la remise à zéro à la demande (admin uniquement).

## 1. Nettoyage immédiat (données)

Identification : `hr_employees` où `prenom ILIKE 'lisa'` (vérification du nom avant exécution pour éviter les homonymes).

Tables purgées pour `employee_id = <Lisa>` :
- `hr_planning_entries`
- `hr_time_entries`
- `hr_absences`
- `hr_recup_demandes`
- `hr_contracts`
- `hr_evaluations`
- `hr_job_descriptions`
- `hr_documents`
- `hr_compteur_heures`
- `hr_jours_dus`
- `hr_push_subscriptions`

Conservé : la ligne `hr_employees` de Lisa (profil, contrat horaire, rythme, jours de congés/RTT — tout ce qui est dans la fiche) ET son `auth.user` éventuel.

Ordre de suppression : enfants d'abord (jours dus, compteurs, planning, time entries, absences, récup, contrats, evals, fiches poste, documents, push) — pas de FK croisée problématique attendue.

## 2. Bouton « Réinitialiser les données RH » dans la fiche employé

Emplacement : `src/routes/ops.equipe.$id.tsx`, dans le header (à côté de « Supprimer ») — visible uniquement pour les administrateurs (via `useRole`).

Comportement :
- Bouton rouge outline « Réinitialiser les données RH » avec icône `Eraser`.
- Confirmation native : `confirm("Supprimer TOUTES les données RH (planning, pointage, absences, récup, contrats, évals, documents, compteurs, jours dus) de {Prénom Nom} ? La fiche employé est conservée. Action irréversible.")`.
- Appelle un nouveau helper `resetEmployeeData(employeeId)` exporté depuis `src/lib/hr.ts`.
- Toast succès + reload des données affichées (joursDus, etc.).

### Helper `resetEmployeeData` (src/lib/hr.ts)

Exécute en série les `delete()` Supabase sur les 11 tables listées ci-dessus avec `eq('employee_id', id)`. Renvoie `{ ok: true }` ou propage la première erreur. RLS existante (admin agence) couvre l'autorisation.

## Hors scope

- Suppression de la fiche `hr_employees` (l'utilisateur veut la garder).
- Données non-RH (cotations, dossiers, factures…).
- Recréation de seed/test data : Lisa repartira d'un dossier RH vierge.

## Détails techniques

- Pas de migration de schéma — uniquement des `DELETE` ciblés (outil `supabase--insert` pour le nettoyage immédiat).
- Le trigger `trg_planning_remplacement_to_jours_dus` ne se déclenche qu'à l'INSERT, donc les DELETE sont sûrs.
- Le bouton respecte la `useRole` admin pour éviter qu'un agent supprime son propre historique.
