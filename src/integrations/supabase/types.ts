export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      comptes: {
        Row: {
          actif: boolean
          banque: Database["public"]["Enums"]["compte_banque"]
          categorie: Database["public"]["Enums"]["compte_categorie"]
          created_at: string
          id: string
          nom: string
          solde_initial: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean
          banque: Database["public"]["Enums"]["compte_banque"]
          categorie: Database["public"]["Enums"]["compte_categorie"]
          created_at?: string
          id?: string
          nom: string
          solde_initial?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean
          banque?: Database["public"]["Enums"]["compte_banque"]
          categorie?: Database["public"]["Enums"]["compte_categorie"]
          created_at?: string
          id?: string
          nom?: string
          solde_initial?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nom: string
          telephone: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          telephone?: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          telephone?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dossiers: {
        Row: {
          client_id: string | null
          cout_total: number
          created_at: string
          id: string
          prix_vente: number
          statut: Database["public"]["Enums"]["dossier_statut"]
          taux_tva_marge: number
          titre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          cout_total?: number
          created_at?: string
          id?: string
          prix_vente?: number
          statut?: Database["public"]["Enums"]["dossier_statut"]
          taux_tva_marge?: number
          titre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          cout_total?: number
          created_at?: string
          id?: string
          prix_vente?: number
          statut?: Database["public"]["Enums"]["dossier_statut"]
          taux_tva_marge?: number
          titre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      factures_fournisseurs: {
        Row: {
          created_at: string
          date_echeance: string | null
          dossier_id: string | null
          fournisseur_id: string | null
          id: string
          montant: number
          paye: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_echeance?: string | null
          dossier_id?: string | null
          fournisseur_id?: string | null
          id?: string
          montant: number
          paye?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_echeance?: string | null
          dossier_id?: string | null
          fournisseur_id?: string | null
          id?: string
          montant?: number
          paye?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_fournisseurs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_fournisseurs_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements: {
        Row: {
          compte_id: string | null
          created_at: string
          date: string
          dossier_id: string | null
          id: string
          methode: Database["public"]["Enums"]["paiement_methode"]
          montant: number
          personne_id: string | null
          source: Database["public"]["Enums"]["paiement_source"]
          type: Database["public"]["Enums"]["paiement_type"]
          user_id: string
        }
        Insert: {
          compte_id?: string | null
          created_at?: string
          date?: string
          dossier_id?: string | null
          id?: string
          methode?: Database["public"]["Enums"]["paiement_methode"]
          montant: number
          personne_id?: string | null
          source?: Database["public"]["Enums"]["paiement_source"]
          type: Database["public"]["Enums"]["paiement_type"]
          user_id: string
        }
        Update: {
          compte_id?: string | null
          created_at?: string
          date?: string
          dossier_id?: string | null
          id?: string
          methode?: Database["public"]["Enums"]["paiement_methode"]
          montant?: number
          personne_id?: string | null
          source?: Database["public"]["Enums"]["paiement_source"]
          type?: Database["public"]["Enums"]["paiement_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_personne_id_fkey"
            columns: ["personne_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      transferts: {
        Row: {
          compte_destination_id: string
          compte_source_id: string
          created_at: string
          date: string
          id: string
          libelle: string | null
          montant: number
          user_id: string
        }
        Insert: {
          compte_destination_id: string
          compte_source_id: string
          created_at?: string
          date?: string
          id?: string
          libelle?: string | null
          montant: number
          user_id: string
        }
        Update: {
          compte_destination_id?: string
          compte_source_id?: string
          created_at?: string
          date?: string
          id?: string
          libelle?: string | null
          montant?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      compte_banque: "sg" | "cic" | "ebury" | "autre"
      compte_categorie:
        | "gestion"
        | "anticipation"
        | "clients"
        | "fournisseurs"
        | "plateforme"
      contact_type: "client" | "fournisseur"
      dossier_statut: "brouillon" | "confirme" | "cloture"
      paiement_methode: "virement" | "carte" | "especes"
      paiement_source: "banque" | "manuel"
      paiement_type: "paiement_client" | "paiement_fournisseur"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      compte_banque: ["sg", "cic", "ebury", "autre"],
      compte_categorie: [
        "gestion",
        "anticipation",
        "clients",
        "fournisseurs",
        "plateforme",
      ],
      contact_type: ["client", "fournisseur"],
      dossier_statut: ["brouillon", "confirme", "cloture"],
      paiement_methode: ["virement", "carte", "especes"],
      paiement_source: ["banque", "manuel"],
      paiement_type: ["paiement_client", "paiement_fournisseur"],
    },
  },
} as const
