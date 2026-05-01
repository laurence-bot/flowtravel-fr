## Refonte v3 — Voix française + dossier démo Sophie/Japon + carnet 2 versions

### 1. Voix off : français vraiment naturel

**Problème** : voix Sarah (anglophone) → accent, débit haché.

**Correction** :
- Voix native française : **Audrey** (`s0XGIcqmceN2l7kjsqoZ`) ou **Charlotte** (`XB0fDUnXU5powFXDhCwa`)
- Modèle `eleven_multilingual_v2` (qualité production)
- `voice_settings`: stability 0.45 · similarity_boost 0.8 · style 0.35 · speed 0.98
- **Request stitching** : chaque segment reçoit `previous_text` + `next_text` → prosodie continue, plus de "reset" entre scènes
- Réécriture du script : phrases courtes, virgules respiratoires, zéro anglicisme ("wow factor" → "effet waouh")

### 2. Un seul dossier démo de bout en bout : Sophie Marchand · Japon · 14 jours · 2 pax · 8 500 €

Aujourd'hui chaque scène montre des données différentes. On suit **un seul dossier** pour que l'agent reconnaisse SON workflow.

| # | Scène | Durée | Contenu (toujours Sophie/Japon) |
|---|---|---|---|
| 1 | Hook | 4s | "Une agence c'est 12 outils. FlowTravel, c'est un seul." |
| 2 | Demande | 5s | Liste demandes, surlignage Sophie, clic "Transformer en cotation" |
| 3 | **Cotation expliquée** | 8s | Vol AF, ryokan Hakone, JR Pass, guide Kyoto — **marges ligne par ligne** + total + marge agence en live |
| 4 | **Devis client (effet waouh)** | 7s | Aperçu navigateur du `/p/$token` : hero Mont Fuji plein écran, scroll qui révèle les jours, design éditorial |
| 5 | Acceptation | 4s | Bouton "J'accepte" coché, signature, acompte 30% reçu |
| 6 | Fournisseurs multi-devises | 6s | Ryokan JPY, guide USD, vol EUR — bons de commande auto |
| 7 | FX & couvertures | 6s | "Bloquez 850 000 JPY à 0,0061 → +320 € marge protégée" |
| 8 | **Trésorerie réelle vs acomptes** | 9s | Le pain point — voir détail ci-dessous |
| 9 | **Carnet de voyage — 2 versions** | 7s | Voir détail ci-dessous |
| 10 | Outro | 4s | "Le système d'exploitation des agences de voyages." |

**Total** ~60 s.

### 3. Scène trésorerie repensée — pain point n°1

Remplacement de l'actuelle "Pilotage" (KPI génériques) par une démo visuelle du problème :

```
COMPTE BANCAIRE AGENCE          247 800 €     ← rassurant
            ↓ animation
− Acomptes clients (24)          87 400 €     ← apparait en rouge
− Soldes fournisseurs à venir    18 200 €
            ↓
TRÉSORERIE RÉELLE                142 200 €    ← vert qui pulse
"Ce qui est VRAIMENT à vous."
```

VO : *"La trésorerie d'une agence, c'est piégeux. Les acomptes clients dorment sur votre compte, mais ils ne sont pas à vous. FlowTravel les sépare automatiquement. Vous pilotez sereinement."*

### 4. Carnet de voyage — DEUX versions distinctes (scène 9)

Split-screen ou séquence en deux temps qui montre clairement les deux livrables :

**Version A — IMPRESSION (gauche)**
- Maquette d'un livret papier A5 relié, posé en perspective sur fond crème
- Pages qui tournent une à une (animation `rotateY` sur la couverture, puis défilé de pages intérieures)
- Couverture : "Japon — Sophie & Antoine Marchand — Mai 2026" en Cormorant Garamond, dorure
- Pages intérieures : photos pleine page, jour par jour, typographie éditoriale
- Étiquette "PDF haute résolution · prêt à imprimer · livré 7 jours avant départ"

**Version B — APPLICATION CLIENT LIVE (droite)**
- Mockup smartphone iPhone avec l'app/lien web
- Vue "Aujourd'hui — Jour 4 · Hakone" (le client est SUR PLACE)
- Carte interactive avec géoloc, météo locale 18°C, prochain rendez-vous "14h00 — Croisière lac Ashi"
- Bouton "Contacter mon conseiller" + chat
- Notification push qui apparaît : "Votre transfert pour le ryokan arrive dans 15 min"
- Étiquette "Suivi temps réel · le client a tout dans sa poche"

VO scène 9 : *"À la fin du parcours, deux carnets pour Sophie. Un livret imprimé pour le souvenir, livré avant le départ. Et l'application qui la suit jour après jour, sur place. Géolocalisation, programme du jour, contact direct avec son conseiller. Vous restez avec elle, du décollage au retour."*

### 5. Effet waouh sur la scène devis (scène 4)

Reconstitution fidèle de `/p/$token` :
- Hero plein écran : image Mont Fuji (Unsplash via `staticFile`)
- Overlay dégradé bas → haut, titre Cormorant Garamond 64px "Japon"
- Scroll vertical animé sur 5s qui révèle bloc vol, cartes jours, bouton ocre "J'accepte"
- Frame navigateur Safari pour authentique

### Détails techniques

**Fichiers** :
- `/tmp/gen-vo-v3.mjs` — génère `audio-v3/s1.aac` à `s10.aac` voix Audrey + stitching
- `remotion/src/MainVideo.tsx` — durées recalibrées, switch `audio-v3/`
- `remotion/src/scenes/Scene3Cotation.tsx` — refonte sur dossier Sophie
- `remotion/src/scenes/Scene4Itineraire.tsx` → renommée `Scene4Devis.tsx` : hero Fuji + scroll
- `remotion/src/scenes/Scene9Pilotage.tsx` → `Scene8Tresorerie.tsx` : animation soustraction acomptes
- `remotion/src/scenes/Scene9Carnet.tsx` (nouveau) : split version impression + version app live
- `remotion/public/images/` : 4-5 images Japon téléchargées via curl (Fuji, Kyoto, Hakone, Tokyo)

**Rendu** :
- `flowtravel-16x9-v3.mp4` (on garde la v2 pour comparaison)
- QA via `bunx remotion still` sur 8 frames clés avant render full
- Pas de version 1:1 carrée pour cette itération

**Hors scope** : musique de fond (à voir en v4 si la voix passe bien).

Validé ? Je lance le build dès ton OK.