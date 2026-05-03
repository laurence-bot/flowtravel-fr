
# OPS — Module RH complet

Module privé `/ops/equipe` avec gestion complète des employés : contrats, planning, pointage, absences, évaluations, notifications, et email mensuel au comptable.

## À clarifier (3 points seulement, le reste je tranche par défaut)

1. **Email comptable** : configurable dans `/ops/equipe/parametres` (recommandé) — OK ?
2. **Notifications push** : web push (navigateur, fonctionne sur PC + mobile via PWA) — OK ? (vraies notif iOS/Android natives = projet séparé)
3. **Pointage temps réel** : badgeuse via bouton "Pointer arrivée / pause / sortie" dans l'app web (les employés se connectent à FlowTravel et cliquent) — OK ?

Si tu valides (ou ne dis rien), je pars là-dessus.

## Périmètre complet

### A. Fiches employés & contrats
- Fiche employé : civilité, coordonnées, poste, manager, date d'embauche, date sortie, type contrat (CDI/CDD/stage/freelance), salaire brut, jours congés acquis/an, RTT/an
- **Contrats** : upload PDF + envoi pour **signature électronique** (même système que tes bulletins clients : token, page publique de signature, horodatage, IP)
- Statuts contrat : brouillon → envoyé → signé → archivé
- Avenants gérés comme nouveaux contrats liés

### B. Planning
- Vue calendrier mensuelle (qui bosse / télétravail / absent)
- Créneaux : journée / matin / aprem / heures précises
- Vue par employé + vue équipe
- Duplication semaine type

### C. Pointage horaire temps réel
- Page `/pointage` accessible à tout employé connecté
- Boutons : **Arrivée / Pause début / Pause fin / Sortie**
- Stockage horodaté + IP (anti-fraude basique)
- Vue admin : qui est là maintenant, retards de la semaine, total heures par mois
- Export CSV pour le comptable

### D. Absences & congés
- Demande de congé par l'employé → workflow d'approbation manager/admin
- **Signature électronique de la demande** (même système) une fois approuvée
- Types : congé payé / RTT / maladie / sans solde / formation / récup / parental
- Compteur live "X jours restants" par type
- Justificatifs (PDF/image)

### E. Fiches de poste & évaluations annuelles
- **Fiche de poste** par employé : missions, compétences attendues, objectifs, KPI
- Versionnée (modifiable, historique conservé)
- **Évaluation annuelle** : campagne créée par l'admin → l'employé s'auto-évalue → entretien → manager note → bilan signé électroniquement
- Sections : objectifs N-1, atteinte, points forts, axes de progrès, formations, objectifs N+1, augmentation/évolution

### F. Notifications push (Web Push API)
Déclenchées sur :
- Demande de congé reçue (admin)
- Demande approuvée/refusée (employé)
- Contrat à signer (employé)
- Évaluation à compléter (employé)
- Rappel pointage de sortie oublié (employé, le soir)
- Récap mensuel envoyé (admin)

Système : Service Worker + VAPID keys + table `push_subscriptions`. Bouton "Activer les notifications" dans le profil utilisateur.

### G. Récap mensuel automatique au comptable
- Cron 1er du mois 8h via `pg_cron` → server route `/api/public/hooks/payroll-summary`
- Email envoyé avec :
  - Tableau par employé : jours travaillés, congés payés pris, RTT, maladie, autres absences, heures pointées totales, heures supp éventuelles
  - Lien CSV téléchargeable (Storage)
  - Lien `/ops/equipe` pour détails
- Bouton "Tester l'envoi maintenant" dans paramètres

## Pages OPS

```
/ops/equipe                    Liste employés
/ops/equipe/$id                Fiche complète (infos, contrats, congés, planning, pointage, fiche poste, évaluations)
/ops/equipe/planning           Calendrier équipe
/ops/equipe/absences           File des demandes à valider
/ops/equipe/pointage           Live "qui est là" + historique
/ops/equipe/contrats           Tous les contrats (à signer / signés)
/ops/equipe/evaluations        Campagnes d'évaluation
/ops/equipe/parametres         Email comptable, types absences, jours fériés, paramètres push
```

Pages côté employé (visibles dans l'app cliente FlowTravel pour les comptes liés à un employé) :
```
/mon-espace/pointage           Boutons badgeuse
/mon-espace/conges             Demander un congé / mes soldes
/mon-espace/contrats           Mes contrats à signer / signés
/mon-espace/evaluation         Mon évaluation en cours
```

Plus une entrée "Équipe RH" dans le bloc OPS de la sidebar (icône `Users`).

## Base de données (10 tables)

- `hr_employees` — fiche
- `hr_contracts` — contrats + token signature + statut + PDF
- `hr_contract_signatures` — données de signature (image, IP, horodatage)
- `hr_planning_entries` — créneaux planning
- `hr_absences` — demandes + token signature
- `hr_time_entries` — pointages (in/out/pause)
- `hr_job_descriptions` — fiches de poste versionnées
- `hr_evaluations` — campagnes + réponses + signature
- `hr_settings` — config par agence (email comptable, etc.)
- `push_subscriptions` — endpoints Web Push

Toutes en RLS strict :
- Admin agence voit tout son agence
- Employé voit uniquement ses propres données (+ peut signer ses contrats/congés/évaluations)
- Super_admin voit tout

## Sécurité & conformité

- Signatures électroniques : même mécanisme éprouvé que `bulletins` (token unique, expiration, IP, horodatage, hash données signées)
- Justificatifs médicaux : Storage privé, accès restreint admin RH
- RGPD : suppression possible à la sortie de l'employé + journal d'audit
- Pointage : pas de géoloc imposée (RGPD), juste IP

## Setup technique requis

1. Vérifier domaine email Lovable Cloud
2. Scaffold emails transactionnels (templates : `payroll-monthly-summary`, `contract-to-sign`, `leave-approved`, `leave-refused`, `evaluation-due`)
3. Générer paire VAPID pour Web Push (secrets `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`)
4. Créer Service Worker `public/push-sw.js`
5. Cron `pg_cron` mensuel + cron quotidien (rappels pointage)

## Hors-scope (à demander plus tard)

- App mobile native iOS/Android (les push web suffisent pour démarrer)
- Export Silae / DSN direct
- Génération automatique des fiches de paie (le comptable les fait à partir du récap)
- Reconnaissance faciale / pointage biométrique
- Géolocalisation du pointage
- Intégration calendrier externe (Google/Outlook) — possible v2

## Travail en plusieurs étapes

C'est un gros module. Je propose ce découpage si tu veux étaler :
- **Phase 1** (cette fois) : tables + employés + contrats avec signature + absences avec signature + email mensuel comptable
- **Phase 2** : planning + pointage temps réel
- **Phase 3** : fiches de poste + évaluations annuelles
- **Phase 4** : notifications Web Push partout

**Tu préfères tout d'un coup, ou phase par phase ?** (par défaut, je fais tout d'un coup)
