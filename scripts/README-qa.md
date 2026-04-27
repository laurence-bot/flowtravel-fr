# Flow Travel — Scénario QA E2E

Deux livrables complémentaires :

1. **Plan manuel** — `/mnt/documents/flow-travel-scenario-test-e2e.pdf`
   PDF de 8 pages, 15 blocs, ~70 actions, grille de sign-off finale.
   À suivre pas à pas dans l'UI sur un compte de test dédié.

2. **Script automatisé** — `scripts/qa-e2e.ts`
   Injecte un dataset complet dans la base via l'API Supabase.

## Lancer le script automatisé

### 1. Créer le compte de test (UI, 30 s)

1. Ouvre `/auth` en navigation privée
2. Inscription : `qa-test@flowtravel.test` / `QaTest!2026`
3. Confirme l'email si besoin

### 2. Lancer

```bash
export SUPABASE_URL="https://hgvcvbfdbkbakqxluiys.supabase.co"
export SUPABASE_ANON_KEY="<clé anon du projet>"
export QA_EMAIL="qa-test@flowtravel.test"
export QA_PASSWORD="QaTest!2026"

bun run scripts/qa-e2e.ts
```

### 3. Vérifier

- Connecte-toi à l'UI avec `qa-test@flowtravel.test`
- Tu vois la demande Dupont, la cotation transformée, le dossier, les options, paiements, tâches, transaction bancaire en attente de rapprochement
- Rapport Markdown : `/mnt/documents/flow-travel-qa-report.md`

## Couverture

| Bloc | Manuel (PDF) | Auto (script) |
|---|---|---|
| Demande client | ✅ | ✅ |
| Transformation cotation | ✅ | ✅ |
| Lignes EUR + USD + FX | ✅ | ✅ |
| Marge / TVA marge | ✅ (vérif visuelle) | ✅ (calculs loggés) |
| Passage en option | ✅ | ✅ |
| Options vols | ✅ | ✅ |
| Deadlines + alertes | ✅ | ✅ (1 expirée injectée) |
| Acompte client | ✅ | ✅ |
| Confirmation fournisseurs | ✅ | ✅ |
| Email drafts | ✅ (UI) | — |
| Dossier + factures | ✅ | ✅ |
| Checklist dossier_tasks | ✅ | ✅ (5 tâches) |
| Trésorerie | ✅ | ✅ |
| Couverture FX | ✅ | ✅ |
| Rapprochement bancaire | ✅ | ✅ (tx injectée) |
| Export comptable | ✅ (UI) | — |

## Nettoyage

Toutes les entités sont préfixées `[QA]`. Pour purger plus tard :

```sql
-- via migration ou outil DB
DELETE FROM dossiers WHERE titre LIKE '[QA]%';
DELETE FROM cotations WHERE titre LIKE '[QA]%';
DELETE FROM demandes WHERE nom_client LIKE '[QA]%';
DELETE FROM contacts WHERE nom LIKE '[QA]%';
-- etc. (RLS limite déjà au seul user qa-test)
```

Plus simple : supprimer le compte `qa-test@flowtravel.test` dans **Utilisateurs**, les RLS feront le reste si tu ajoutes des `ON DELETE CASCADE` (sinon, requêtes ci-dessus).
