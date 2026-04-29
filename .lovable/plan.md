
# Essai charte « La Voyagerie » — White-label complet + PDF de devis

## Objectif

Faire de FlowTravel une plateforme **multi-tenant white-label** : chaque agence (ici La Voyagerie) possède sa charte graphique complète, qui s'applique à tous les livrables qu'elle envoie à ses clients voyageurs (PDF, portail public, emails). FlowTravel reste FlowTravel à l'intérieur ; **dehors**, c'est l'agence qui parle.

On fait l'essai sur le **PDF de devis complet** (le livrable phare), en deux temps : **maquette d'abord**, **code ensuite**.

---

## Étape 1 — Maquette du PDF de devis (avant tout code)

Je génère **une maquette PDF haute fidélité** appliquant la charte La Voyagerie, sans toucher à l'app. Ça nous permet de valider la direction visuelle, la typo, le rythme des pages, l'usage de l'ocre/doré, avant d'investir dans la mécanique.

**Contenu de la maquette (5–7 pages) :**

```text
1. COUVERTURE          Logo compas-V doré, titre du voyage,
                       nom du client, dates, "Devis nº ...",
                       filet ocre, crème en fond.
2. PRÉAMBULE           "L'art de voyager, discrètement."
                       Mot d'introduction signé par le conseiller.
3. ITINÉRAIRE          Jour-par-jour résumé (généré depuis tags
                       destination + dates). Lignes serif élégantes.
4. CE QUI EST INCLUS   Liste structurée : vols, hébergements,
                       prestations terrestres. Discret, pas tarifé.
5. BUDGET              Total TTC + prix par personne. Un seul
                       chiffre dominant. Détail en filets fins.
                       Échéancier : acompte + solde, dates.
6. CONDITIONS          CGV courtes, mention TVA marge / hors UE,
                       coordonnées agence, SIRET, n° TVA.
7. COLOPHON            Citation, signature, mentions légales.
```

**Données utilisées** : un faux dossier La Voyagerie (Tanzanie en famille, déjà présent dans les données QA) — pas de donnée client réelle.

**Livrable** : `/mnt/documents/devis-lavoyagerie-v1.pdf` + `presentation-artifact` à télécharger.

**Outil** : Python (reportlab) côté sandbox — pas dans l'app. Polices Google Fonts téléchargées (Cormorant Garamond pour les titres, Inter pour le corps, small caps via tracking serré).

➡️ **Stop ici, vous validez.** Si la direction ne plaît pas, on itère sur la maquette avant tout code. Si elle plaît, on passe à l'étape 2.

---

## Étape 2 — Implémentation dans FlowTravel (après validation)

### 2.1 Modèle de données — extension agence + thèmes

Migration Supabase : enrichir `agency_settings` pour porter une charte complète.

```text
agency_settings (colonnes ajoutées)
├── brand_baseline           text   "Maison de voyages sur-mesure"
├── brand_signature_quote    text   "L'art de voyager, discrètement."
├── logo_dark_url            text   logo fond sombre
├── logo_symbol_url          text   compas-V seul
├── favicon_url              text
├── color_primary            text   #0B0B0B
├── color_signature          text   #A14E2C  (accent ocre)
├── color_ornament           text   #C9A96E  (doré)
├── color_background         text   #F5F1E8  (crème)
├── color_muted              text   #EAE3D6  (beige)
├── color_secondary          text   #6A6F4C  (vert olive)
├── font_heading             text   "Cormorant Garamond"
├── font_body                text   "Inter"
├── pdf_footer_text          text   mentions légales pied PDF
├── cgv_text                 text   CGV libres (markdown)
└── public_subdomain_slug    text   ex. "lavoyagerie" (pour lien public)
```

Nouvelle table pour exposer publiquement un devis :

```text
quote_public_links
├── id
├── cotation_id
├── token            text unique  (URL impossible à deviner)
├── expires_at       timestamptz
├── viewed_at        timestamptz nullable
├── accepted_at      timestamptz nullable
└── created_at
```

RLS : le propriétaire de la cotation gère ses liens. Vue publique : pas de RLS, accès via Edge Function qui résout `token → cotation` + applique le branding agence.

### 2.2 Génération PDF côté serveur

Lib choisie : **pdf-lib** (compatible Cloudflare Workers, pas reportlab).
Polices embarquées dans le bundle : Cormorant Garamond + Inter (fichiers .ttf dans `public/fonts/`).

Server function `generateQuotePdf({ cotationId })` :
1. Charge cotation + lignes + agence + client
2. Compose PDF en respectant le template validé à l'étape 1
3. Retourne un blob téléchargeable

Bouton « Télécharger le devis » sur la page cotation.

### 2.3 Page « Identité & Marque » dans Paramètres agence

Refonte de `parametres-agence.tsx` avec un nouvel onglet **Identité visuelle** :
- Upload des 4 logos (clair, sombre, symbole, favicon)
- Sélecteur des 6 couleurs (avec aperçu live respectant la règle "ocre = accent")
- Choix de typo dans une liste curatée (3 paires serif/sans-serif)
- Édition du baseline, citation, CGV, footer PDF
- Aperçu en direct d'une page de devis miniature

### 2.4 Portail client public (lien partageable)

Route `src/routes/p.$token.tsx` (publique, hors RequireAuth) :
- Layout entièrement à la marque agence (palette, typo, logo)
- Affichage du devis : couverture, itinéraire, inclusions, budget
- Bouton "Télécharger le PDF"
- Bouton "J'accepte ce devis" → marque `accepted_at`
- Pas de mention FlowTravel (sauf petit "Powered by" optionnel en pied)

### 2.5 Application du thème agence à l'app interne

`AgencyThemeProvider` lit la charte de l'utilisateur connecté et injecte les variables CSS dans le `:root`. L'app interne FlowTravel garde sa structure mais reflète discrètement la marque (header, accents). On ne refait pas l'UI complète — on substitue les tokens couleur/typo via CSS variables sur `src/styles.css`.

---

## Détails techniques

- **Polices** : Cormorant Garamond + Inter via `@import` Google Fonts dans `src/styles.css`, et fichiers .ttf dans `public/fonts/` pour pdf-lib (bundlé au build).
- **Bucket logos** : déjà existant (`agency-logos`, public). On l'utilise tel quel.
- **PDF côté Worker** : pdf-lib fonctionne en Cloudflare Worker (pas de native). Pas reportlab (Python, hors runtime).
- **RLS** : tout reste sur `auth.uid() = user_id` sauf la lecture publique d'un devis via token (Edge Function avec service role limitée à `SELECT cotation WHERE id = quote_public_links.cotation_id`).
- **Sécurité du lien public** : token 32 octets random + `expires_at` obligatoire (90 j par défaut) + audit log à chaque vue.
- **Pas d'enable Cloud** déjà fait : on a tout ce qu'il faut.

---

## Hors périmètre de cet essai

Pour rester focus, ces sujets sont reportés :
- Itinéraire jour-par-jour structuré (table dédiée) → pour l'essai on génère depuis champs existants
- Voyageurs (PAX) avec passeports → existait déjà dans la réflexion stratégique, pas ici
- Multilingue FR/EN → on reste FR
- AI copilot pour rédiger l'introduction du devis → plus tard
- Messagerie client sur le devis → plus tard
- Sous-domaine personnalisé (`devis.lavoyagerie.fr`) → URL `/p/<token>` du domaine FlowTravel suffit pour valider

---

## Ce que vous voyez à la fin de chaque étape

| Étape | Livrable | Validation |
|---|---|---|
| 1 | PDF maquette à télécharger | Vous dites "go" ou "on itère" |
| 2.1–2.2 | Bouton "Télécharger le devis" dans la cotation, donne le PDF | Vous testez sur le scénario QA |
| 2.3 | Onglet Identité visuelle dans Paramètres → vous saisissez la charte La Voyagerie | Vous voyez le PDF se mettre à jour |
| 2.4 | Lien public partageable, page web à la marque | Vous l'ouvrez en navigation privée |
| 2.5 | App interne aux accents La Voyagerie | Vous naviguez dans l'app |

Je commence par l'étape 1 dès que vous approuvez ce plan : juste la maquette PDF, rien d'autre. Vous jugez sur pièce avant qu'on touche au code.
