// Module cotations / devis : types, calculs financiers et utilitaires de
// transformation vers dossier + factures fournisseurs prévisionnelles.

import { supabase } from "@/integrations/supabase/client";
import type { DeviseCode, FxSource } from "@/lib/fx";

export type CotationStatut =
  | "brouillon"
  | "en_cours"
  | "envoyee"
  | "en_option"
  | "validee"
  | "confirmee"
  | "perdue"
  | "annulee"
  | "transformee_en_dossier"
  | "archivee";

export type CotationRegimeTva = "marge_ue" | "hors_ue";
export type CotationLigneModeTarifaire = "global" | "par_personne";

export type Cotation = {
  id: string;
  user_id: string;
  client_id: string | null;
  group_id: string;
  version_number: number;
  titre: string;
  destination: string | null;
  pays_destination: string | null;
  tags_destination: string[];
  langue: string | null;
  date_depart: string | null;
  date_retour: string | null;
  nombre_pax: number;
  nombre_chambres: number;
  prix_vente_ht: number;
  prix_vente_ttc: number;
  prix_vente_usd: number | null;
  regime_tva: CotationRegimeTva;
  taux_tva_marge: number;
  statut: CotationStatut;
  raison_perte: string | null;
  dossier_id: string | null;
  agent_id: string | null;
  notes: string | null;
  hero_image_url: string | null;
  storytelling_intro: string | null;
  inclus_text: string | null;
  non_inclus_text: string | null;
  version_label: string | null;
  programme_pdf_url: string | null;
  programme_pdf_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CotationLigne = {
  id: string;
  user_id: string;
  cotation_id: string;
  fournisseur_id: string | null;
  nom_fournisseur: string;
  payeur: string | null;
  prestation: string | null;
  date_prestation: string | null;
  mode_tarifaire: CotationLigneModeTarifaire;
  quantite: number;
  devise: DeviseCode;
  montant_devise: number;
  taux_change_vers_eur: number;
  montant_eur: number;
  source_fx: FxSource;
  couverture_id: string | null;
  pct_acompte_1: number;
  pct_acompte_2: number;
  pct_acompte_3: number;
  pct_solde: number;
  date_acompte_1: string | null;
  date_acompte_2: string | null;
  date_acompte_3: string | null;
  date_solde: string | null;
  notes: string | null;
  ordre: number;
  created_at: string;
  updated_at: string;
};

export const COTATION_STATUT_LABELS: Record<CotationStatut, string> = {
  brouillon: "Brouillon",
  en_cours: "En cours",
  envoyee: "Envoyée",
  en_option: "En option",
  validee: "Validée",
  confirmee: "Confirmée",
  perdue: "Perdue",
  annulee: "Annulée",
  transformee_en_dossier: "Transformée en dossier",
  archivee: "Archivée",
};

export const COTATION_STATUT_TONES: Record<
  CotationStatut,
  "neutral" | "info" | "success" | "danger" | "primary" | "muted" | "warn"
> = {
  brouillon: "neutral",
  en_cours: "info",
  envoyee: "info",
  en_option: "warn",
  validee: "success",
  confirmee: "success",
  perdue: "danger",
  annulee: "danger",
  transformee_en_dossier: "primary",
  archivee: "muted",
};

export const REGIME_TVA_LABELS: Record<CotationRegimeTva, string> = {
  marge_ue: "TVA sur marge (UE)",
  hors_ue: "Hors UE (pas de TVA)",
};

/** Coût total EUR d'une ligne, en tenant compte du mode tarifaire. */
export function ligneCoutEur(ligne: CotationLigne, nombrePax: number): number {
  const base = Number(ligne.montant_eur || 0);
  const qte = Number(ligne.quantite || 1);
  if (ligne.mode_tarifaire === "par_personne") {
    return base * qte * Math.max(1, nombrePax);
  }
  return base * qte;
}

/** Calculs financiers d'une cotation. */
export function computeCotationFinance(cot: Cotation, lignes: CotationLigne[]) {
  const ligneOfCot = lignes.filter((l) => l.cotation_id === cot.id);
  const coutTotal = ligneOfCot.reduce((s, l) => s + ligneCoutEur(l, cot.nombre_pax), 0);
  const prixVente = Number(cot.prix_vente_ttc || 0);
  const margeBrute = prixVente - coutTotal;

  let tvaSurMarge = 0;
  if (cot.regime_tva === "marge_ue" && margeBrute > 0) {
    const t = Number(cot.taux_tva_marge || 0);
    tvaSurMarge = margeBrute - margeBrute / (1 + t / 100);
  }
  const margeNette = margeBrute - tvaSurMarge;
  const margeNettePct = prixVente > 0 ? (margeNette / prixVente) * 100 : 0;

  return {
    coutTotal,
    prixVente,
    margeBrute,
    tvaSurMarge,
    margeNette,
    margeNettePct,
  };
}

/** Détecte si une ligne fournisseur correspond à un vol/billet d'avion. */
export function isLigneVol(l: { prestation: string | null; nom_fournisseur?: string | null }): boolean {
  const txt = `${l.prestation || ""} ${l.nom_fournisseur || ""}`.toLowerCase();
  return /\b(vol|vols|avion|avions|billet|billets|flight|flights|airlines?|airways)\b/.test(txt);
}

/**
 * Acompte client à verser à la confirmation.
 * Règle métier agence de voyage (zéro découvert) :
 *   - Vols : 100 % du coût (billets payés cash à l'émission)
 *   - Autres lignes : pct_acompte_1 de la ligne (typiquement 30 %)
 *   - + 50 % marge brute (sécurisation marge)
 * Si la marge est négative, la part marge est ignorée. Plafonné au prix de vente.
 */
export function computeAcompteClient(cot: Cotation, lignes: CotationLigne[]) {
  const fin = computeCotationFinance(cot, lignes);
  const ligneOfCot = lignes.filter((l) => l.cotation_id === cot.id);
  const acomptesFournisseurs = ligneOfCot.reduce((s, l) => {
    const cout = ligneCoutEur(l, cot.nombre_pax);
    const pct = isLigneVol(l) ? 100 : Number(l.pct_acompte_1 || 0);
    return s + cout * (pct / 100);
  }, 0);
  const partMarge = Math.max(0, fin.margeBrute) * 0.5;
  const acompte = Math.min(fin.prixVente, acomptesFournisseurs + partMarge);
  const solde = Math.max(0, fin.prixVente - acompte);
  return {
    totalFournisseurs: fin.coutTotal,
    acomptesFournisseurs,
    margeBrute: fin.margeBrute,
    partMarge,
    acompte,
    solde,
    prixVente: fin.prixVente,
    margeNegative: fin.margeBrute < 0,
  };
}

/** Échéances calculées à partir des % d'une ligne. */
export function ligneEcheances(ligne: CotationLigne) {
  const total = Number(ligne.montant_devise || 0);
  const items: Array<{
    type: "acompte_1" | "acompte_2" | "acompte_3" | "solde";
    pct: number;
    montant_devise: number;
    date_echeance: string | null;
  }> = [
    {
      type: "acompte_1",
      pct: ligne.pct_acompte_1,
      montant_devise: total * ligne.pct_acompte_1 / 100,
      date_echeance: ligne.date_acompte_1,
    },
    {
      type: "acompte_2",
      pct: ligne.pct_acompte_2,
      montant_devise: total * ligne.pct_acompte_2 / 100,
      date_echeance: ligne.date_acompte_2,
    },
    {
      type: "acompte_3",
      pct: ligne.pct_acompte_3,
      montant_devise: total * ligne.pct_acompte_3 / 100,
      date_echeance: ligne.date_acompte_3,
    },
    {
      type: "solde",
      pct: ligne.pct_solde,
      montant_devise: total * ligne.pct_solde / 100,
      date_echeance: ligne.date_solde,
    },
  ];
  return items.filter((it) => it.pct > 0);
}

/** Crée une nouvelle version d'une cotation par duplication. */
export async function duplicateCotation(
  userId: string,
  source: Cotation,
  lignes: CotationLigne[],
): Promise<{ id: string; version_number: number } | null> {
  // Récupérer le max version_number du group
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("cotations")
    .select("version_number")
    .eq("group_id", source.group_id);
  const nextVersion =
    Math.max(0, ...(existing ?? []).map((r: { version_number: number }) => r.version_number)) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (supabase as any)
    .from("cotations")
    .insert({
      user_id: userId,
      client_id: source.client_id,
      group_id: source.group_id,
      version_number: nextVersion,
      titre: source.titre,
      destination: source.destination,
      pays_destination: source.pays_destination,
      tags_destination: source.tags_destination,
      langue: source.langue,
      date_depart: source.date_depart,
      date_retour: source.date_retour,
      nombre_pax: source.nombre_pax,
      nombre_chambres: source.nombre_chambres,
      prix_vente_ht: source.prix_vente_ht,
      prix_vente_ttc: source.prix_vente_ttc,
      prix_vente_usd: source.prix_vente_usd,
      regime_tva: source.regime_tva,
      taux_tva_marge: source.taux_tva_marge,
      statut: "brouillon",
      notes: source.notes,
    })
    .select()
    .single();
  if (error || !created) return null;

  const lignesSrc = lignes.filter((l) => l.cotation_id === source.id);
  if (lignesSrc.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("cotation_lignes_fournisseurs").insert(
      lignesSrc.map((l) => ({
        user_id: userId,
        cotation_id: created.id,
        fournisseur_id: l.fournisseur_id,
        nom_fournisseur: l.nom_fournisseur,
        payeur: l.payeur,
        prestation: l.prestation,
        date_prestation: l.date_prestation,
        mode_tarifaire: l.mode_tarifaire,
        quantite: l.quantite,
        devise: l.devise,
        montant_devise: l.montant_devise,
        taux_change_vers_eur: l.taux_change_vers_eur,
        montant_eur: l.montant_eur,
        source_fx: l.source_fx,
        couverture_id: l.couverture_id,
        pct_acompte_1: l.pct_acompte_1,
        pct_acompte_2: l.pct_acompte_2,
        pct_acompte_3: l.pct_acompte_3,
        pct_solde: l.pct_solde,
        date_acompte_1: l.date_acompte_1,
        date_acompte_2: l.date_acompte_2,
        date_acompte_3: l.date_acompte_3,
        date_solde: l.date_solde,
        notes: l.notes,
        ordre: l.ordre,
      })),
    );
  }
  return { id: created.id, version_number: nextVersion };
}

/** Transforme une cotation validée en dossier + factures + échéances. */
export async function transformerCotationEnDossier(
  userId: string,
  cot: Cotation,
  lignes: CotationLigne[],
): Promise<{ dossierId: string } | { error: string }> {
  const fin = computeCotationFinance(cot, lignes);
  // 1. Créer le dossier
  const { data: dossier, error: errDossier } = await supabase
    .from("dossiers")
    .insert({
      user_id: userId,
      client_id: cot.client_id,
      titre: cot.titre,
      statut: "confirme",
      prix_vente: cot.prix_vente_ttc,
      cout_total: fin.coutTotal,
      taux_tva_marge: cot.regime_tva === "marge_ue" ? cot.taux_tva_marge : 0,
    })
    .select()
    .single();
  if (errDossier || !dossier) {
    return { error: errDossier?.message ?? "Création dossier impossible." };
  }

  // 2. Pour chaque ligne -> facture fournisseur prévisionnelle + échéances
  const lignesSrc = lignes.filter((l) => l.cotation_id === cot.id);
  for (const l of lignesSrc) {
    const montantTotalDevise = Number(l.montant_devise || 0) * Number(l.quantite || 1) *
      (l.mode_tarifaire === "par_personne" ? Math.max(1, cot.nombre_pax) : 1);
    const montantTotalEur = ligneCoutEur(l, cot.nombre_pax);

    const { data: facture, error: errF } = await supabase
      .from("factures_fournisseurs")
      .insert({
        user_id: userId,
        dossier_id: dossier.id,
        fournisseur_id: l.fournisseur_id,
        montant: montantTotalEur,
        montant_eur: montantTotalEur,
        montant_devise: montantTotalDevise,
        devise: l.devise,
        taux_change: l.taux_change_vers_eur,
        fx_source: l.source_fx,
        coverage_id: l.couverture_id,
        date_echeance: l.date_solde,
        paye: false,
      })
      .select()
      .single();
    if (errF || !facture) continue;

    // Échéances calculées
    const ech = ligneEcheances(l);
    if (ech.length > 0) {
      await supabase.from("facture_echeances").insert(
        ech.map((e, i) => ({
          statut: "a_payer" as const,
          user_id: userId,
          facture_id: facture.id,
          ordre: i + 1,
          type: e.type,
          date_echeance: e.date_echeance,
          devise: l.devise,
          montant_devise: e.montant_devise *
            (l.mode_tarifaire === "par_personne" ? Math.max(1, cot.nombre_pax) : 1) *
            Number(l.quantite || 1),
          taux_change: l.taux_change_vers_eur,
          montant_eur: (e.montant_devise *
            (l.mode_tarifaire === "par_personne" ? Math.max(1, cot.nombre_pax) : 1) *
            Number(l.quantite || 1)) * l.taux_change_vers_eur,
          fx_source: l.source_fx,
          coverage_id: l.couverture_id,
        })),
      );
    }
  }

  // 3. Mettre à jour la cotation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("cotations")
    .update({ statut: "transformee_en_dossier", dossier_id: dossier.id })
    .eq("id", cot.id);

  return { dossierId: dossier.id };
}

/** Stats client pour bloc fiche contact. */
export function computeClientCotationStats(
  clientId: string,
  cotations: Cotation[],
  lignes: CotationLigne[],
) {
  const mine = cotations.filter((c) => c.client_id === clientId);
  // dernière version par group
  const byGroup = new Map<string, Cotation>();
  for (const c of mine) {
    const cur = byGroup.get(c.group_id);
    if (!cur || c.version_number > cur.version_number) byGroup.set(c.group_id, c);
  }
  const last = Array.from(byGroup.values());

  const enCours = last.filter((c) => c.statut === "brouillon").length;
  const envoyees = last.filter((c) => c.statut === "envoyee").length;
  const validees = last.filter(
    (c) => c.statut === "validee" || c.statut === "transformee_en_dossier",
  ).length;
  const perdues = last.filter((c) => c.statut === "perdue").length;
  const transformees = last.filter((c) => c.statut === "transformee_en_dossier").length;

  const decidees = validees + perdues;
  const tauxTransformation = decidees > 0 ? (validees / decidees) * 100 : 0;

  const montantTotal = last.reduce((s, c) => s + Number(c.prix_vente_ttc || 0), 0);
  const margePotentielle = last
    .filter((c) => c.statut !== "perdue")
    .reduce((s, c) => s + computeCotationFinance(c, lignes).margeNette, 0);

  return {
    total: last.length,
    enCours,
    envoyees,
    validees,
    perdues,
    transformees,
    tauxTransformation,
    montantTotal,
    margePotentielle,
  };
}
