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
};

export type Facture = {
  id: string;
  fournisseur_id: string | null;
  dossier_id: string | null;
  montant: number;
  date_echeance: string | null;
  paye: boolean;
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
