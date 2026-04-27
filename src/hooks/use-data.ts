import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type Contact = {
  id: string;
  nom: string;
  type: "client" | "fournisseur";
  email: string | null;
  telephone: string | null;
  created_at: string;
};

export type Dossier = {
  id: string;
  client_id: string | null;
  titre: string;
  statut: "brouillon" | "confirme" | "cloture";
  prix_vente: number;
  cout_total: number;
  taux_tva_marge: number;
  created_at: string;
};

export type Paiement = {
  id: string;
  dossier_id: string | null;
  personne_id: string | null;
  compte_id: string | null;
  montant: number;
  type: "paiement_client" | "paiement_fournisseur";
  date: string;
  source: "banque" | "manuel";
  methode: "virement" | "carte" | "especes";
  statut_rapprochement: "non_rapproche" | "rapproche";
  bank_transaction_id: string | null;
  // FX
  devise: import("@/lib/fx").DeviseCode;
  montant_devise: number | null;
  taux_change: number;
  montant_eur: number | null;
  fx_source: import("@/lib/fx").FxSource;
  coverage_id: string | null;
};

export type BankTransaction = {
  id: string;
  compte_id: string;
  date: string;
  libelle_original: string;
  libelle_normalise: string;
  montant: number;
  sens: "credit" | "debit";
  source_banque: "sg" | "cic" | "ebury";
  hash_unique: string;
  statut: "nouveau" | "rapproche" | "ignore";
  created_at: string;
  // FX
  devise: import("@/lib/fx").DeviseCode;
  montant_devise: number | null;
  taux_change: number | null;
  libelle_fx: string | null;
  reference_ebury: string | null;
  contrepartie: string | null;
};

export type Rapprochement = {
  id: string;
  bank_transaction_id: string;
  paiement_id: string;
  score: number;
  statut: "suggere" | "valide" | "rejete";
  raison: string | null;
  created_at: string;
  validated_at: string | null;
};

export type Facture = {
  id: string;
  fournisseur_id: string | null;
  dossier_id: string | null;
  montant: number;
  date_echeance: string | null;
  paye: boolean;
  // FX
  devise: import("@/lib/fx").DeviseCode;
  montant_devise: number | null;
  taux_change: number;
  montant_eur: number | null;
  fx_source: import("@/lib/fx").FxSource;
  coverage_id: string | null;
};

export type EcheanceType = "acompte_1" | "acompte_2" | "acompte_3" | "solde" | "autre";
export type EcheanceStatut = "a_payer" | "paye" | "en_retard" | "annule";

export type FactureEcheance = {
  id: string;
  facture_id: string;
  ordre: number;
  type: EcheanceType;
  date_echeance: string | null;
  devise: import("@/lib/fx").DeviseCode;
  montant_devise: number;
  taux_change: number;
  montant_eur: number;
  fx_source: import("@/lib/fx").FxSource;
  coverage_id: string | null;
  paiement_id: string | null;
  statut: EcheanceStatut;
  notes: string | null;
  created_at: string;
};

export const ECHEANCE_TYPE_LABELS: Record<EcheanceType, string> = {
  acompte_1: "Acompte 1",
  acompte_2: "Acompte 2",
  acompte_3: "Acompte 3",
  solde: "Solde",
  autre: "Autre",
};

export const ECHEANCE_STATUT_LABELS: Record<EcheanceStatut, string> = {
  a_payer: "À payer",
  paye: "Payée",
  en_retard: "En retard",
  annule: "Annulée",
};

export type CompteBanque = "sg" | "cic" | "ebury" | "autre";
export type CompteCategorie = "gestion" | "anticipation" | "clients" | "fournisseurs" | "plateforme";

export type Compte = {
  id: string;
  nom: string;
  banque: CompteBanque;
  categorie: CompteCategorie;
  solde_initial: number;
  actif: boolean;
  created_at: string;
};

export type Transfert = {
  id: string;
  compte_source_id: string;
  compte_destination_id: string;
  montant: number;
  date: string;
  libelle: string | null;
  created_at: string;
};

export const BANQUE_LABELS: Record<CompteBanque, string> = {
  sg: "Société Générale",
  cic: "CIC",
  ebury: "Ebury",
  autre: "Autre",
};

export const CATEGORIE_LABELS: Record<CompteCategorie, string> = {
  gestion: "Gestion",
  anticipation: "Anticipation",
  clients: "Clients",
  fournisseurs: "Fournisseurs",
  plateforme: "Plateforme",
};

export function useTable<T>(table: string, deps: unknown[] = []) {
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setData(data as T[]);
    setLoading(false);
  }, [user, table]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, table, ...deps]);

  return { data, loading, refetch };
}
