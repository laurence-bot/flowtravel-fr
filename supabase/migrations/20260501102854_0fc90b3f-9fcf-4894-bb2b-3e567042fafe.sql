
-- Types
CREATE TYPE public.coaching_ressource_type AS ENUM ('article', 'video', 'checklist', 'template', 'lien');
CREATE TYPE public.coaching_categorie AS ENUM ('demarrage', 'ventes', 'finance', 'legal', 'outils', 'astuces');
CREATE TYPE public.coaching_progression_statut AS ENUM ('non_commence', 'en_cours', 'termine');

-- Table des ressources
CREATE TABLE public.coaching_ressources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT,
  type public.coaching_ressource_type NOT NULL DEFAULT 'article',
  categorie public.coaching_categorie NOT NULL DEFAULT 'demarrage',
  contenu_md TEXT,
  url_externe TEXT,
  duree_minutes INTEGER,
  ordre INTEGER NOT NULL DEFAULT 0,
  obligatoire BOOLEAN NOT NULL DEFAULT false,
  publie BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_ressources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaching_ressources_read_all"
ON public.coaching_ressources FOR SELECT
TO authenticated
USING (publie = true OR public.has_role(auth.uid(), 'administrateur'));

CREATE POLICY "coaching_ressources_admin_write"
ON public.coaching_ressources FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'administrateur'))
WITH CHECK (public.has_role(auth.uid(), 'administrateur'));

CREATE TRIGGER set_updated_at_coaching_ressources
BEFORE UPDATE ON public.coaching_ressources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Table de progression
CREATE TABLE public.coaching_progression (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ressource_id UUID NOT NULL REFERENCES public.coaching_ressources(id) ON DELETE CASCADE,
  statut public.coaching_progression_statut NOT NULL DEFAULT 'non_commence',
  termine_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ressource_id)
);

ALTER TABLE public.coaching_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaching_progression_own_all"
ON public.coaching_progression FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_coaching_progression
BEFORE UPDATE ON public.coaching_progression
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_coaching_progression_user ON public.coaching_progression(user_id);

-- Ressources de démarrage
INSERT INTO public.coaching_ressources (titre, description, type, categorie, contenu_md, duree_minutes, ordre, obligatoire) VALUES
('Bienvenue dans FlowTravel', 'Vue d''ensemble de la plateforme et premiers pas', 'article', 'demarrage', '# Bienvenue !\n\nFlowTravel est votre outil tout-en-un pour gérer votre agence de voyage : demandes, cotations, dossiers, factures, trésorerie et plus.\n\n## Premiers pas\n\n1. Configurez votre **agence** (logo, couleurs, CGV) dans Paramètres\n2. Créez votre premier **contact** client\n3. Saisissez une **demande** entrante\n4. Construisez votre première **cotation**\n5. Convertissez en **dossier** confirmé', 5, 1, true),
('Configurer son agence', 'Logo, couleurs, mentions légales, CGV', 'checklist', 'demarrage', '## À configurer\n\n- [ ] Logo principal (PNG transparent)\n- [ ] Couleurs primaire / accent\n- [ ] Coordonnées complètes (SIRET, IM, adresse)\n- [ ] CGV personnalisées\n- [ ] Signature email\n- [ ] Pied de page PDF', 10, 2, true),
('Créer une cotation gagnante', 'Storytelling, photos, jours, options vols', 'video', 'ventes', '## Conseils clés\n\n- Soignez le **storytelling d''intro** : c''est ce que le client lit en premier\n- Une **photo héros** forte vaut 1000 mots\n- Détaillez chaque **jour** avec lieu, image et description\n- Proposez 2-3 **options vols** pour donner le choix\n- Listez clairement **inclus / non inclus**', 15, 3, false),
('Le bulletin d''inscription numérique', 'Faire signer le client en ligne', 'article', 'ventes', '## Workflow\n\n1. Depuis une cotation acceptée, créez un **bulletin**\n2. Ajoutez les voyageurs\n3. Envoyez le lien public au client\n4. Le client signe sur n''importe quel appareil\n5. La **facture client** est générée automatiquement', 8, 4, false),
('Liste de mariage : mode d''emploi', 'Activer une cagnotte sur une cotation', 'article', 'ventes', '## Comment activer\n\n1. Sur la cotation, cochez **"Liste de mariage"**\n2. Définissez l''**objectif** (ex: 5000 €)\n3. Personnalisez le **message aux invités**\n4. Partagez le lien public aux mariés\n5. Suivez les contributions en temps réel', 6, 5, false),
('Carnet de voyage interactif', 'Offrir un souvenir digital aux clients', 'article', 'ventes', '## Avantages\n\n- Cadeau différenciant **avant** le départ\n- Itinéraire jour par jour avec photos\n- Infos pratiques (visa, climat, contacts urgence)\n- Lien partageable avec la famille', 7, 6, false),
('Comprendre la TVA sur la marge', 'Régime spécifique aux agences de voyage', 'article', 'finance', '## Principes\n\nL''agence de voyage applique la **TVA sur la marge** (art. 266 CGI) pour les prestations achetées et revendues telles quelles dans l''UE.\n\n- TVA = (Prix vente TTC - Coût total) × 20/120\n- Hors UE : exonéré\n- Mixte : prorata\n\nFlowTravel calcule automatiquement selon le régime choisi sur la cotation.', 10, 7, true),
('Couvertures de change (FX)', 'Sécuriser ses achats en devises', 'video', 'finance', '## Pourquoi couvrir ?\n\nQuand vous achetez en USD/GBP/MAD/etc., le taux peut bouger entre la cotation et le paiement. Une couverture **fige le taux** auprès d''Ebury et protège votre marge.\n\n## Workflow\n\n1. Ouvrir une couverture (devise, montant, taux, échéance)\n2. La rattacher à des lignes fournisseurs\n3. Au paiement, le taux figé est utilisé', 12, 8, false),
('Rapprochement bancaire', 'Matcher transactions et paiements', 'article', 'finance', '## Étapes\n\n1. Importer le relevé (CSV Ebury / OFX banque)\n2. Aller dans **Rapprochement**\n3. Pour chaque transaction, valider le matching automatique ou pointer manuellement\n4. Les écarts sont mis en évidence', 10, 9, false),
('Obligations légales agence de voyage', 'IM, garantie financière, RC pro', 'article', 'legal', '## Points clés\n\n- **Immatriculation Atout France** obligatoire\n- **Garantie financière** (APST ou banque) couvrant les fonds clients\n- **RC professionnelle** spécifique tourisme\n- **Information précontractuelle** (art. R211-4 Code Tourisme)\n- **Bulletin d''inscription** signé avant tout paiement', 15, 10, true),
('Modèles d''emails clients', 'Bibliothèque de templates', 'template', 'outils', '## Templates inclus\n\n- Accusé réception demande\n- Envoi cotation\n- Relance acompte\n- Confirmation dossier\n- J-30 départ\n- Retour de voyage', 5, 11, false),
('Astuces productivité', 'Raccourcis et bonnes pratiques', 'article', 'astuces', '## Top 5\n\n1. **Dupliquer une cotation** pour créer une variante\n2. **Tags destination** pour filtrer rapidement\n3. **Conditions fournisseurs** réutilisables\n4. **Import PDF** pour digitaliser les devis reçus\n5. **Pilotage** : suivez vos KPIs hebdomadairement', 6, 12, false);
