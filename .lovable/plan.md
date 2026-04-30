
# V2 vidéo FlowTravel — démo produit réelle, 60 secondes

## Pourquoi la V1 ne marche pas
Mockups stylisés ≠ FlowTravel. L'agent ne reconnaît pas le produit, ne comprend pas ce qu'il achète. On corrige en filmant **l'app réelle** avec **la vraie charte**.

## Principe V2
- **Captures réelles** de l'app via le navigateur automatisé, sur les routes existantes
- **Charte FlowTravel** extraite de `src/styles.css` + `src/lib/agency-theme.ts` (mêmes couleurs, mêmes polices, même radius que l'app)
- **Parcours agent narré** : on suit un dossier de la demande à la facturation
- **60 secondes** chrono, 1 module = 1 plan ≥ 5 secondes, mockup plein cadre
- **Focus itinéraire** : 10 secondes dédiées au rendu du carnet/devis (le moment "wow")

## Scénario — 60s, 9 plans

```
0:00 ─ Hook (4s)              Logo FlowTravel + "12 outils. Maintenant 1." 
0:04 ─ 1. Demande client (6s) Inbox /demandes → fiche → "Transformer en cotation"
0:10 ─ 2. Cotation (6s)       Éditeur /cotations/$id : prix, marge live
0:16 ─ 3. Itinéraire (10s)    ★ MOMENT FORT ★ Mise en page jour par jour, 
                              images, vol auto, rendu public final
0:26 ─ 4. Envoi client (5s)   Lien public devis + email auto fournisseur
0:31 ─ 5. Fournisseurs (6s)   Facture multi-devises + échéances
0:37 ─ 6. FX & Couvertures (7s) ★ DIFFÉRENCIATEUR ★ Optimiseur multi-monnaies
0:44 ─ 7. Facturation (5s)    Acomptes, soldes, statuts
0:49 ─ 8. Pilotage admin (7s) Trésorerie réelle + acomptes + perfs agents
0:56 ─ Outro (4s)             Logo + tagline + flowtravel.fr
```

## Méthode de capture (auto)

1. Connexion preview avec un compte démo existant (`/demo` ou compte de test)
2. Navigation sur chaque route, viewport 1920×1080
3. `browser--screenshot` pour chaque écran clé (≈ 12 captures, certains modules nécessitent 2 vues)
4. Stockage dans `remotion/public/screens/`
5. Si une donnée affichée est moche/vide, je fais une mini-injection de données démo cohérentes avant capture

**Routes à capturer** : `/demandes`, `/demandes/$id`, `/cotations`, `/cotations/$id`, `/p/$token` (rendu public devis = wow itinéraire), `/dossiers/$id`, `/factures/$id`, `/couvertures-fx`, `/pilotage`.

## Charte respectée

J'extrais avant tout shot :
- couleurs CSS (`--background`, `--primary`, `--accent`…) dans `src/styles.css`
- police de l'app (à vérifier dans le tag `<html>` / styles)
- radius et ombres
- logo `src/assets/logo-arrow.svg`

Habillage vidéo (titres de modules, transitions, fond) utilisera **exactement** ces tokens. Plus de couleurs inventées.

## Réalisation Remotion

**Cadre vidéo type pour chaque plan** :
- Fond : couleur de fond de l'app (pas de gradient flashy)
- Mockup : screenshot dans un cadre navigateur sobre (barre URL avec `flowtravel.fr/...`)
- Label module en haut à gauche (typo de l'app, couleur primary)
- Highlight animé (cercle / underline SVG) sur l'élément clé : bouton "Transformer en cotation", badge statut, montant marge, ligne couverture EUR/USD…
- Léger Ken Burns (scale 1 → 1.04 sur la durée du plan) pour donner vie

**Plan itinéraire (10s, le wow)** :
- 0-3s : vue éditeur côté agent (drag d'image dans un jour)
- 3-7s : transition vers le rendu public `/p/$token`
- 7-10s : scroll vertical lent à travers les jours du voyage
→ l'agent voit ce que reçoit son client. C'est ça qui déclenche l'achat.

**Voix off** : 9 segments ElevenLabs (même voix française que V1), pré-encodés AAC. Script réécrit pour correspondre exactement à ce qui est à l'écran ("Ici, l'agent transforme la demande en cotation en un clic. Le prix de vente, la marge, les options s'ajustent en temps réel…").

## Plan technique

1. Lire `src/styles.css`, `agency-theme.ts`, identifier la police utilisée
2. Lancer le browser, login démo, naviguer route par route
3. Préparer un dossier de démo réaliste si les données sont vides
4. Capturer les 12 screenshots → `remotion/public/screens/`
5. Écrire le nouveau script voix off (9 segments, ~60s)
6. Générer les MP3 ElevenLabs → pré-encoder AAC
7. Refondre `MainVideo.tsx` : 9 scènes, 1800 frames @30fps
8. Créer un composant `<AppShot>` réutilisable (cadre navigateur + Ken Burns + label + highlight)
9. Créer 9 composants Scene*.tsx
10. Mettre à jour `Root.tsx` pour la nouvelle durée
11. Render des 2 formats → `flowtravel-16x9-v2.mp4` et `flowtravel-1x1-v2.mp4` dans `/mnt/documents/`

## Livrables
- `flowtravel-16x9-v2.mp4` — landing/YouTube
- `flowtravel-1x1-v2.mp4` — LinkedIn/mobile
- V1 conservées pour comparaison
