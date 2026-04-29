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
      agency_settings: {
        Row: {
          address: string | null
          agency_name: string | null
          brand_baseline: string | null
          brand_signature_quote: string | null
          cgv_text: string | null
          city: string | null
          color_background: string | null
          color_muted: string | null
          color_ornament: string | null
          color_primary: string | null
          color_secondary: string | null
          color_signature: string | null
          country: string | null
          created_at: string
          email: string | null
          favicon_url: string | null
          font_body: string | null
          font_heading: string | null
          id: string
          legal_name: string | null
          logo_dark_url: string | null
          logo_symbol_url: string | null
          logo_url: string | null
          pdf_footer_text: string | null
          phone: string | null
          primary_contact_name: string | null
          public_subdomain_slug: string | null
          siret: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          agency_name?: string | null
          brand_baseline?: string | null
          brand_signature_quote?: string | null
          cgv_text?: string | null
          city?: string | null
          color_background?: string | null
          color_muted?: string | null
          color_ornament?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          color_signature?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          favicon_url?: string | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          legal_name?: string | null
          logo_dark_url?: string | null
          logo_symbol_url?: string | null
          logo_url?: string | null
          pdf_footer_text?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          public_subdomain_slug?: string | null
          siret?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          agency_name?: string | null
          brand_baseline?: string | null
          brand_signature_quote?: string | null
          cgv_text?: string | null
          city?: string | null
          color_background?: string | null
          color_muted?: string | null
          color_ornament?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          color_signature?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          favicon_url?: string | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          legal_name?: string | null
          logo_dark_url?: string | null
          logo_symbol_url?: string | null
          logo_url?: string | null
          pdf_footer_text?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          public_subdomain_slug?: string | null
          siret?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          description: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["audit_entity"]
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: Database["public"]["Enums"]["audit_entity"]
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["audit_entity"]
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          compte_id: string
          contrepartie: string | null
          created_at: string
          date: string
          devise: Database["public"]["Enums"]["devise_code"]
          hash_unique: string
          id: string
          libelle_fx: string | null
          libelle_normalise: string
          libelle_original: string
          montant: number
          montant_devise: number | null
          reference_ebury: string | null
          sens: Database["public"]["Enums"]["bank_sens"]
          source_banque: Database["public"]["Enums"]["bank_source"]
          statut: Database["public"]["Enums"]["bank_statut"]
          taux_change: number | null
          user_id: string
        }
        Insert: {
          compte_id: string
          contrepartie?: string | null
          created_at?: string
          date: string
          devise?: Database["public"]["Enums"]["devise_code"]
          hash_unique: string
          id?: string
          libelle_fx?: string | null
          libelle_normalise: string
          libelle_original: string
          montant: number
          montant_devise?: number | null
          reference_ebury?: string | null
          sens: Database["public"]["Enums"]["bank_sens"]
          source_banque: Database["public"]["Enums"]["bank_source"]
          statut?: Database["public"]["Enums"]["bank_statut"]
          taux_change?: number | null
          user_id: string
        }
        Update: {
          compte_id?: string
          contrepartie?: string | null
          created_at?: string
          date?: string
          devise?: Database["public"]["Enums"]["devise_code"]
          hash_unique?: string
          id?: string
          libelle_fx?: string | null
          libelle_normalise?: string
          libelle_original?: string
          montant?: number
          montant_devise?: number | null
          reference_ebury?: string | null
          sens?: Database["public"]["Enums"]["bank_sens"]
          source_banque?: Database["public"]["Enums"]["bank_source"]
          statut?: Database["public"]["Enums"]["bank_statut"]
          taux_change?: number | null
          user_id?: string
        }
        Relationships: []
      }
      comptes: {
        Row: {
          actif: boolean
          banque: Database["public"]["Enums"]["compte_banque"]
          categorie: Database["public"]["Enums"]["compte_categorie"]
          created_at: string
          devise: Database["public"]["Enums"]["devise_code"]
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
          devise?: Database["public"]["Enums"]["devise_code"]
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
          devise?: Database["public"]["Enums"]["devise_code"]
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
      cotation_jours: {
        Row: {
          cotation_id: string
          created_at: string
          date_jour: string | null
          description: string | null
          gallery_credits: Json
          gallery_urls: Json
          id: string
          image_credit: string | null
          image_url: string | null
          lieu: string | null
          ordre: number
          titre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cotation_id: string
          created_at?: string
          date_jour?: string | null
          description?: string | null
          gallery_credits?: Json
          gallery_urls?: Json
          id?: string
          image_credit?: string | null
          image_url?: string | null
          lieu?: string | null
          ordre?: number
          titre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cotation_id?: string
          created_at?: string
          date_jour?: string | null
          description?: string | null
          gallery_credits?: Json
          gallery_urls?: Json
          id?: string
          image_credit?: string | null
          image_url?: string | null
          lieu?: string | null
          ordre?: number
          titre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cotation_lignes_fournisseurs: {
        Row: {
          cotation_id: string
          couverture_id: string | null
          created_at: string
          date_acompte_1: string | null
          date_acompte_2: string | null
          date_acompte_3: string | null
          date_prestation: string | null
          date_solde: string | null
          devise: Database["public"]["Enums"]["devise_code"]
          fournisseur_id: string | null
          id: string
          mode_tarifaire: Database["public"]["Enums"]["cotation_ligne_mode_tarifaire"]
          montant_devise: number
          montant_eur: number
          nom_fournisseur: string
          notes: string | null
          ordre: number
          payeur: string | null
          pct_acompte_1: number
          pct_acompte_2: number
          pct_acompte_3: number
          pct_solde: number
          prestation: string | null
          quantite: number
          source_fx: Database["public"]["Enums"]["fx_source"]
          taux_change_vers_eur: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cotation_id: string
          couverture_id?: string | null
          created_at?: string
          date_acompte_1?: string | null
          date_acompte_2?: string | null
          date_acompte_3?: string | null
          date_prestation?: string | null
          date_solde?: string | null
          devise?: Database["public"]["Enums"]["devise_code"]
          fournisseur_id?: string | null
          id?: string
          mode_tarifaire?: Database["public"]["Enums"]["cotation_ligne_mode_tarifaire"]
          montant_devise?: number
          montant_eur?: number
          nom_fournisseur: string
          notes?: string | null
          ordre?: number
          payeur?: string | null
          pct_acompte_1?: number
          pct_acompte_2?: number
          pct_acompte_3?: number
          pct_solde?: number
          prestation?: string | null
          quantite?: number
          source_fx?: Database["public"]["Enums"]["fx_source"]
          taux_change_vers_eur?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cotation_id?: string
          couverture_id?: string | null
          created_at?: string
          date_acompte_1?: string | null
          date_acompte_2?: string | null
          date_acompte_3?: string | null
          date_prestation?: string | null
          date_solde?: string | null
          devise?: Database["public"]["Enums"]["devise_code"]
          fournisseur_id?: string | null
          id?: string
          mode_tarifaire?: Database["public"]["Enums"]["cotation_ligne_mode_tarifaire"]
          montant_devise?: number
          montant_eur?: number
          nom_fournisseur?: string
          notes?: string | null
          ordre?: number
          payeur?: string | null
          pct_acompte_1?: number
          pct_acompte_2?: number
          pct_acompte_3?: number
          pct_solde?: number
          prestation?: string | null
          quantite?: number
          source_fx?: Database["public"]["Enums"]["fx_source"]
          taux_change_vers_eur?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotation_lignes_fournisseurs_cotation_id_fkey"
            columns: ["cotation_id"]
            isOneToOne: false
            referencedRelation: "cotations"
            referencedColumns: ["id"]
          },
        ]
      }
      cotations: {
        Row: {
          client_id: string | null
          created_at: string
          date_depart: string | null
          date_retour: string | null
          demande_id: string | null
          destination: string | null
          dossier_id: string | null
          group_id: string
          hero_image_url: string | null
          id: string
          inclus_text: string | null
          langue: string | null
          nombre_chambres: number
          nombre_pax: number
          non_inclus_text: string | null
          notes: string | null
          pays_destination: string | null
          prix_vente_ht: number
          prix_vente_ttc: number
          prix_vente_usd: number | null
          raison_perte: string | null
          regime_tva: Database["public"]["Enums"]["cotation_regime_tva"]
          statut: Database["public"]["Enums"]["cotation_statut"]
          storytelling_intro: string | null
          tags_destination: string[]
          taux_tva_marge: number
          titre: string
          updated_at: string
          user_id: string
          version_number: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          date_depart?: string | null
          date_retour?: string | null
          demande_id?: string | null
          destination?: string | null
          dossier_id?: string | null
          group_id?: string
          hero_image_url?: string | null
          id?: string
          inclus_text?: string | null
          langue?: string | null
          nombre_chambres?: number
          nombre_pax?: number
          non_inclus_text?: string | null
          notes?: string | null
          pays_destination?: string | null
          prix_vente_ht?: number
          prix_vente_ttc?: number
          prix_vente_usd?: number | null
          raison_perte?: string | null
          regime_tva?: Database["public"]["Enums"]["cotation_regime_tva"]
          statut?: Database["public"]["Enums"]["cotation_statut"]
          storytelling_intro?: string | null
          tags_destination?: string[]
          taux_tva_marge?: number
          titre: string
          updated_at?: string
          user_id: string
          version_number?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          date_depart?: string | null
          date_retour?: string | null
          demande_id?: string | null
          destination?: string | null
          dossier_id?: string | null
          group_id?: string
          hero_image_url?: string | null
          id?: string
          inclus_text?: string | null
          langue?: string | null
          nombre_chambres?: number
          nombre_pax?: number
          non_inclus_text?: string | null
          notes?: string | null
          pays_destination?: string | null
          prix_vente_ht?: number
          prix_vente_ttc?: number
          prix_vente_usd?: number | null
          raison_perte?: string | null
          regime_tva?: Database["public"]["Enums"]["cotation_regime_tva"]
          statut?: Database["public"]["Enums"]["cotation_statut"]
          storytelling_intro?: string | null
          tags_destination?: string[]
          taux_tva_marge?: number
          titre?: string
          updated_at?: string
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      demandes: {
        Row: {
          budget: number | null
          canal: Database["public"]["Enums"]["demande_canal"]
          client_id: string | null
          created_at: string
          date_depart_souhaitee: string | null
          date_retour_souhaitee: string | null
          dernier_contact_at: string | null
          destination: string | null
          email: string | null
          id: string
          message_client: string | null
          nom_client: string
          nombre_pax: number
          notes: string | null
          pays_destination: string | null
          raison_perte: string | null
          statut: Database["public"]["Enums"]["demande_statut"]
          telephone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          canal?: Database["public"]["Enums"]["demande_canal"]
          client_id?: string | null
          created_at?: string
          date_depart_souhaitee?: string | null
          date_retour_souhaitee?: string | null
          dernier_contact_at?: string | null
          destination?: string | null
          email?: string | null
          id?: string
          message_client?: string | null
          nom_client: string
          nombre_pax?: number
          notes?: string | null
          pays_destination?: string | null
          raison_perte?: string | null
          statut?: Database["public"]["Enums"]["demande_statut"]
          telephone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          canal?: Database["public"]["Enums"]["demande_canal"]
          client_id?: string | null
          created_at?: string
          date_depart_souhaitee?: string | null
          date_retour_souhaitee?: string | null
          dernier_contact_at?: string | null
          destination?: string | null
          email?: string | null
          id?: string
          message_client?: string | null
          nom_client?: string
          nombre_pax?: number
          notes?: string | null
          pays_destination?: string | null
          raison_perte?: string | null
          statut?: Database["public"]["Enums"]["demande_statut"]
          telephone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dossier_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          date_echeance: string | null
          description: string | null
          dossier_id: string
          id: string
          ordre: number
          phase: Database["public"]["Enums"]["dossier_task_phase"]
          priorite: Database["public"]["Enums"]["dossier_task_priorite"]
          statut: Database["public"]["Enums"]["dossier_task_statut"]
          titre: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date_echeance?: string | null
          description?: string | null
          dossier_id: string
          id?: string
          ordre?: number
          phase?: Database["public"]["Enums"]["dossier_task_phase"]
          priorite?: Database["public"]["Enums"]["dossier_task_priorite"]
          statut?: Database["public"]["Enums"]["dossier_task_statut"]
          titre: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date_echeance?: string | null
          description?: string | null
          dossier_id?: string
          id?: string
          ordre?: number
          phase?: Database["public"]["Enums"]["dossier_task_phase"]
          priorite?: Database["public"]["Enums"]["dossier_task_priorite"]
          statut?: Database["public"]["Enums"]["dossier_task_statut"]
          titre?: string
          type?: string | null
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
          pays_destination: string | null
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
          pays_destination?: string | null
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
          pays_destination?: string | null
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
      facture_echeances: {
        Row: {
          coverage_id: string | null
          created_at: string
          date_echeance: string | null
          devise: Database["public"]["Enums"]["devise_code"]
          facture_id: string
          fx_source: Database["public"]["Enums"]["fx_source"]
          id: string
          montant_devise: number
          montant_eur: number
          notes: string | null
          ordre: number
          paiement_id: string | null
          statut: Database["public"]["Enums"]["echeance_statut"]
          taux_change: number
          type: Database["public"]["Enums"]["echeance_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          coverage_id?: string | null
          created_at?: string
          date_echeance?: string | null
          devise?: Database["public"]["Enums"]["devise_code"]
          facture_id: string
          fx_source?: Database["public"]["Enums"]["fx_source"]
          id?: string
          montant_devise: number
          montant_eur?: number
          notes?: string | null
          ordre?: number
          paiement_id?: string | null
          statut?: Database["public"]["Enums"]["echeance_statut"]
          taux_change?: number
          type?: Database["public"]["Enums"]["echeance_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          coverage_id?: string | null
          created_at?: string
          date_echeance?: string | null
          devise?: Database["public"]["Enums"]["devise_code"]
          facture_id?: string
          fx_source?: Database["public"]["Enums"]["fx_source"]
          id?: string
          montant_devise?: number
          montant_eur?: number
          notes?: string | null
          ordre?: number
          paiement_id?: string | null
          statut?: Database["public"]["Enums"]["echeance_statut"]
          taux_change?: number
          type?: Database["public"]["Enums"]["echeance_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facture_echeances_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "fx_coverages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_echeances_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures_fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_echeances_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
        ]
      }
      factures_fournisseurs: {
        Row: {
          coverage_id: string | null
          created_at: string
          date_echeance: string | null
          devise: Database["public"]["Enums"]["devise_code"]
          dossier_id: string | null
          fournisseur_id: string | null
          fx_source: Database["public"]["Enums"]["fx_source"]
          id: string
          montant: number
          montant_devise: number | null
          montant_eur: number | null
          paye: boolean
          taux_change: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coverage_id?: string | null
          created_at?: string
          date_echeance?: string | null
          devise?: Database["public"]["Enums"]["devise_code"]
          dossier_id?: string | null
          fournisseur_id?: string | null
          fx_source?: Database["public"]["Enums"]["fx_source"]
          id?: string
          montant: number
          montant_devise?: number | null
          montant_eur?: number | null
          paye?: boolean
          taux_change?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coverage_id?: string | null
          created_at?: string
          date_echeance?: string | null
          devise?: Database["public"]["Enums"]["devise_code"]
          dossier_id?: string | null
          fournisseur_id?: string | null
          fx_source?: Database["public"]["Enums"]["fx_source"]
          id?: string
          montant?: number
          montant_devise?: number | null
          montant_eur?: number | null
          paye?: boolean
          taux_change?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_coverage_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "fx_coverages"
            referencedColumns: ["id"]
          },
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
      flight_options: {
        Row: {
          compagnie: string
          cotation_id: string
          created_at: string
          date_depart: string | null
          date_retour: string | null
          deadline_option_date: string | null
          deadline_option_time: string | null
          devise: Database["public"]["Enums"]["devise_code"]
          heure_depart: string | null
          heure_retour: string | null
          id: string
          notes: string | null
          numero_vol: string | null
          prix: number
          routing: string
          statut: Database["public"]["Enums"]["flight_option_statut"]
          updated_at: string
          user_id: string
        }
        Insert: {
          compagnie: string
          cotation_id: string
          created_at?: string
          date_depart?: string | null
          date_retour?: string | null
          deadline_option_date?: string | null
          deadline_option_time?: string | null
          devise?: Database["public"]["Enums"]["devise_code"]
          heure_depart?: string | null
          heure_retour?: string | null
          id?: string
          notes?: string | null
          numero_vol?: string | null
          prix?: number
          routing: string
          statut?: Database["public"]["Enums"]["flight_option_statut"]
          updated_at?: string
          user_id: string
        }
        Update: {
          compagnie?: string
          cotation_id?: string
          created_at?: string
          date_depart?: string | null
          date_retour?: string | null
          deadline_option_date?: string | null
          deadline_option_time?: string | null
          devise?: Database["public"]["Enums"]["devise_code"]
          heure_depart?: string | null
          heure_retour?: string | null
          id?: string
          notes?: string | null
          numero_vol?: string | null
          prix?: number
          routing?: string
          statut?: Database["public"]["Enums"]["flight_option_statut"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flight_segments: {
        Row: {
          aeroport_arrivee: string
          aeroport_depart: string
          compagnie: string | null
          created_at: string
          date_arrivee: string | null
          date_depart: string | null
          duree_escale_minutes: number | null
          flight_option_id: string
          heure_arrivee: string | null
          heure_depart: string | null
          id: string
          notes: string | null
          numero_vol: string | null
          ordre: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aeroport_arrivee: string
          aeroport_depart: string
          compagnie?: string | null
          created_at?: string
          date_arrivee?: string | null
          date_depart?: string | null
          duree_escale_minutes?: number | null
          flight_option_id: string
          heure_arrivee?: string | null
          heure_depart?: string | null
          id?: string
          notes?: string | null
          numero_vol?: string | null
          ordre?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aeroport_arrivee?: string
          aeroport_depart?: string
          compagnie?: string | null
          created_at?: string
          date_arrivee?: string | null
          date_depart?: string | null
          duree_escale_minutes?: number | null
          flight_option_id?: string
          heure_arrivee?: string | null
          heure_depart?: string | null
          id?: string
          notes?: string | null
          numero_vol?: string | null
          ordre?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_segments_flight_option_id_fkey"
            columns: ["flight_option_id"]
            isOneToOne: false
            referencedRelation: "flight_options"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseur_options: {
        Row: {
          cotation_id: string
          created_at: string
          deadline_option_date: string | null
          deadline_option_time: string | null
          email_fournisseur: string | null
          fournisseur_id: string | null
          id: string
          ligne_fournisseur_id: string | null
          nom_fournisseur: string
          notes: string | null
          prestation: string | null
          statut: Database["public"]["Enums"]["fournisseur_option_statut"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cotation_id: string
          created_at?: string
          deadline_option_date?: string | null
          deadline_option_time?: string | null
          email_fournisseur?: string | null
          fournisseur_id?: string | null
          id?: string
          ligne_fournisseur_id?: string | null
          nom_fournisseur: string
          notes?: string | null
          prestation?: string | null
          statut?: Database["public"]["Enums"]["fournisseur_option_statut"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cotation_id?: string
          created_at?: string
          deadline_option_date?: string | null
          deadline_option_time?: string | null
          email_fournisseur?: string | null
          fournisseur_id?: string | null
          id?: string
          ligne_fournisseur_id?: string | null
          nom_fournisseur?: string
          notes?: string | null
          prestation?: string | null
          statut?: Database["public"]["Enums"]["fournisseur_option_statut"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fx_coverage_reservations: {
        Row: {
          coverage_id: string
          created_at: string
          echeance_id: string | null
          facture_fournisseur_id: string | null
          id: string
          montant_devise: number
          paiement_id: string | null
          statut: Database["public"]["Enums"]["fx_reservation_statut"]
          taux_change: number
          user_id: string
        }
        Insert: {
          coverage_id: string
          created_at?: string
          echeance_id?: string | null
          facture_fournisseur_id?: string | null
          id?: string
          montant_devise: number
          paiement_id?: string | null
          statut?: Database["public"]["Enums"]["fx_reservation_statut"]
          taux_change: number
          user_id: string
        }
        Update: {
          coverage_id?: string
          created_at?: string
          echeance_id?: string | null
          facture_fournisseur_id?: string | null
          id?: string
          montant_devise?: number
          paiement_id?: string | null
          statut?: Database["public"]["Enums"]["fx_reservation_statut"]
          taux_change?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_coverage_reservations_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "fx_coverages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_coverage_reservations_facture_fournisseur_id_fkey"
            columns: ["facture_fournisseur_id"]
            isOneToOne: false
            referencedRelation: "factures_fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_coverage_reservations_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_res_echeance_fkey"
            columns: ["echeance_id"]
            isOneToOne: false
            referencedRelation: "facture_echeances"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_coverages: {
        Row: {
          created_at: string
          date_echeance: string
          date_ouverture: string
          devise: Database["public"]["Enums"]["devise_code"]
          id: string
          montant_devise: number
          notes: string | null
          reference: string | null
          statut: Database["public"]["Enums"]["fx_coverage_statut"]
          taux_change: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_echeance: string
          date_ouverture?: string
          devise: Database["public"]["Enums"]["devise_code"]
          id?: string
          montant_devise: number
          notes?: string | null
          reference?: string | null
          statut?: Database["public"]["Enums"]["fx_coverage_statut"]
          taux_change: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_echeance?: string
          date_ouverture?: string
          devise?: Database["public"]["Enums"]["devise_code"]
          id?: string
          montant_devise?: number
          notes?: string | null
          reference?: string | null
          statut?: Database["public"]["Enums"]["fx_coverage_statut"]
          taux_change?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paiements: {
        Row: {
          bank_transaction_id: string | null
          compte_id: string | null
          coverage_id: string | null
          created_at: string
          date: string
          devise: Database["public"]["Enums"]["devise_code"]
          dossier_id: string | null
          fx_source: Database["public"]["Enums"]["fx_source"]
          id: string
          methode: Database["public"]["Enums"]["paiement_methode"]
          montant: number
          montant_devise: number | null
          montant_eur: number | null
          personne_id: string | null
          source: Database["public"]["Enums"]["paiement_source"]
          statut_rapprochement: Database["public"]["Enums"]["paiement_statut_rapprochement"]
          taux_change: number
          type: Database["public"]["Enums"]["paiement_type"]
          user_id: string
        }
        Insert: {
          bank_transaction_id?: string | null
          compte_id?: string | null
          coverage_id?: string | null
          created_at?: string
          date?: string
          devise?: Database["public"]["Enums"]["devise_code"]
          dossier_id?: string | null
          fx_source?: Database["public"]["Enums"]["fx_source"]
          id?: string
          methode?: Database["public"]["Enums"]["paiement_methode"]
          montant: number
          montant_devise?: number | null
          montant_eur?: number | null
          personne_id?: string | null
          source?: Database["public"]["Enums"]["paiement_source"]
          statut_rapprochement?: Database["public"]["Enums"]["paiement_statut_rapprochement"]
          taux_change?: number
          type: Database["public"]["Enums"]["paiement_type"]
          user_id: string
        }
        Update: {
          bank_transaction_id?: string | null
          compte_id?: string | null
          coverage_id?: string | null
          created_at?: string
          date?: string
          devise?: Database["public"]["Enums"]["devise_code"]
          dossier_id?: string | null
          fx_source?: Database["public"]["Enums"]["fx_source"]
          id?: string
          methode?: Database["public"]["Enums"]["paiement_methode"]
          montant?: number
          montant_devise?: number | null
          montant_eur?: number | null
          personne_id?: string | null
          source?: Database["public"]["Enums"]["paiement_source"]
          statut_rapprochement?: Database["public"]["Enums"]["paiement_statut_rapprochement"]
          taux_change?: number
          type?: Database["public"]["Enums"]["paiement_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_coverage_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "fx_coverages"
            referencedColumns: ["id"]
          },
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
      pdf_imports: {
        Row: {
          confiance: Database["public"]["Enums"]["pdf_import_confiance"]
          created_at: string
          extracted_data: Json | null
          facture_fournisseur_id: string | null
          file_name: string
          fx_coverage_id: string | null
          id: string
          notes: string | null
          raw_text: string | null
          statut: Database["public"]["Enums"]["pdf_import_statut"]
          storage_path: string
          type: Database["public"]["Enums"]["pdf_import_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confiance?: Database["public"]["Enums"]["pdf_import_confiance"]
          created_at?: string
          extracted_data?: Json | null
          facture_fournisseur_id?: string | null
          file_name: string
          fx_coverage_id?: string | null
          id?: string
          notes?: string | null
          raw_text?: string | null
          statut?: Database["public"]["Enums"]["pdf_import_statut"]
          storage_path: string
          type: Database["public"]["Enums"]["pdf_import_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confiance?: Database["public"]["Enums"]["pdf_import_confiance"]
          created_at?: string
          extracted_data?: Json | null
          facture_fournisseur_id?: string | null
          file_name?: string
          fx_coverage_id?: string | null
          id?: string
          notes?: string | null
          raw_text?: string | null
          statut?: Database["public"]["Enums"]["pdf_import_statut"]
          storage_path?: string
          type?: Database["public"]["Enums"]["pdf_import_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_public_links: {
        Row: {
          accepted_at: string | null
          callback_requested_at: string | null
          chosen_flight_option_id: string | null
          cotation_id: string
          created_at: string
          expires_at: string
          flight_chosen_at: string | null
          id: string
          modification_request_text: string | null
          modification_requested_at: string | null
          token: string
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          callback_requested_at?: string | null
          chosen_flight_option_id?: string | null
          cotation_id: string
          created_at?: string
          expires_at?: string
          flight_chosen_at?: string | null
          id?: string
          modification_request_text?: string | null
          modification_requested_at?: string | null
          token: string
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          callback_requested_at?: string | null
          chosen_flight_option_id?: string | null
          cotation_id?: string
          created_at?: string
          expires_at?: string
          flight_chosen_at?: string | null
          id?: string
          modification_request_text?: string | null
          modification_requested_at?: string | null
          token?: string
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      rapprochements: {
        Row: {
          bank_transaction_id: string
          created_at: string
          id: string
          paiement_id: string
          raison: string | null
          score: number
          statut: Database["public"]["Enums"]["rapprochement_statut"]
          user_id: string
          validated_at: string | null
        }
        Insert: {
          bank_transaction_id: string
          created_at?: string
          id?: string
          paiement_id: string
          raison?: string | null
          score?: number
          statut?: Database["public"]["Enums"]["rapprochement_statut"]
          user_id: string
          validated_at?: string | null
        }
        Update: {
          bank_transaction_id?: string
          created_at?: string
          id?: string
          paiement_id?: string
          raison?: string | null
          score?: number
          statut?: Database["public"]["Enums"]["rapprochement_statut"]
          user_id?: string
          validated_at?: string | null
        }
        Relationships: []
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
      user_profiles: {
        Row: {
          actif: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "administrateur" | "gestion" | "lecture_seule" | "comptable"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "validate"
        | "reject"
        | "import"
        | "export"
      audit_entity:
        | "dossier"
        | "paiement"
        | "facture_fournisseur"
        | "compte"
        | "transfert"
        | "bank_transaction"
        | "rapprochement"
        | "export_comptable"
        | "fx_coverage"
        | "fx_reservation"
        | "facture_echeance"
        | "pdf_import"
        | "cotation"
        | "cotation_ligne"
        | "demande"
        | "dossier_task"
        | "fournisseur_option"
        | "flight_option"
        | "agency_settings"
      bank_sens: "credit" | "debit"
      bank_source: "sg" | "cic" | "ebury"
      bank_statut: "nouveau" | "rapproche" | "ignore"
      compte_banque: "sg" | "cic" | "ebury" | "autre"
      compte_categorie:
        | "gestion"
        | "anticipation"
        | "clients"
        | "fournisseurs"
        | "plateforme"
      contact_type: "client" | "fournisseur"
      cotation_ligne_mode_tarifaire: "global" | "par_personne"
      cotation_regime_tva: "marge_ue" | "hors_ue"
      cotation_statut:
        | "brouillon"
        | "envoyee"
        | "validee"
        | "perdue"
        | "transformee_en_dossier"
        | "archivee"
        | "en_cours"
        | "en_option"
        | "confirmee"
        | "annulee"
      demande_canal:
        | "email"
        | "telephone"
        | "site_web"
        | "whatsapp"
        | "recommandation"
        | "autre"
      demande_statut:
        | "nouvelle"
        | "en_cours"
        | "a_relancer"
        | "transformee_en_cotation"
        | "perdue"
      devise_code:
        | "EUR"
        | "USD"
        | "GBP"
        | "ZAR"
        | "CHF"
        | "CAD"
        | "AUD"
        | "JPY"
        | "AED"
        | "MAD"
        | "TND"
      dossier_statut: "brouillon" | "confirme" | "cloture"
      dossier_task_phase: "avant" | "pre_depart" | "pendant" | "apres" | "autre"
      dossier_task_priorite: "normale" | "importante" | "critique"
      dossier_task_statut: "a_faire" | "en_cours" | "termine"
      echeance_statut: "a_payer" | "paye" | "en_retard" | "annule"
      echeance_type: "acompte_1" | "acompte_2" | "acompte_3" | "solde" | "autre"
      flight_option_statut: "en_option" | "confirmee" | "expiree" | "annulee"
      fournisseur_option_statut:
        | "a_demander"
        | "demandee"
        | "option_confirmee"
        | "option_refusee"
        | "option_expiree"
        | "annulee"
        | "confirmee"
      fx_coverage_statut:
        | "ouverte"
        | "reservee"
        | "utilisee"
        | "expiree"
        | "anomalie"
      fx_reservation_statut: "active" | "utilisee" | "annulee"
      fx_source: "taux_du_jour" | "couverture" | "manuel"
      paiement_methode: "virement" | "carte" | "especes"
      paiement_source: "banque" | "manuel"
      paiement_statut_rapprochement: "non_rapproche" | "rapproche"
      paiement_type: "paiement_client" | "paiement_fournisseur"
      pdf_import_confiance: "faible" | "moyenne" | "elevee"
      pdf_import_statut: "extrait" | "valide" | "annule" | "erreur"
      pdf_import_type: "contrat_fournisseur" | "couverture_fx"
      rapprochement_statut: "suggere" | "valide" | "rejete"
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
      app_role: ["administrateur", "gestion", "lecture_seule", "comptable"],
      audit_action: [
        "create",
        "update",
        "delete",
        "validate",
        "reject",
        "import",
        "export",
      ],
      audit_entity: [
        "dossier",
        "paiement",
        "facture_fournisseur",
        "compte",
        "transfert",
        "bank_transaction",
        "rapprochement",
        "export_comptable",
        "fx_coverage",
        "fx_reservation",
        "facture_echeance",
        "pdf_import",
        "cotation",
        "cotation_ligne",
        "demande",
        "dossier_task",
        "fournisseur_option",
        "flight_option",
        "agency_settings",
      ],
      bank_sens: ["credit", "debit"],
      bank_source: ["sg", "cic", "ebury"],
      bank_statut: ["nouveau", "rapproche", "ignore"],
      compte_banque: ["sg", "cic", "ebury", "autre"],
      compte_categorie: [
        "gestion",
        "anticipation",
        "clients",
        "fournisseurs",
        "plateforme",
      ],
      contact_type: ["client", "fournisseur"],
      cotation_ligne_mode_tarifaire: ["global", "par_personne"],
      cotation_regime_tva: ["marge_ue", "hors_ue"],
      cotation_statut: [
        "brouillon",
        "envoyee",
        "validee",
        "perdue",
        "transformee_en_dossier",
        "archivee",
        "en_cours",
        "en_option",
        "confirmee",
        "annulee",
      ],
      demande_canal: [
        "email",
        "telephone",
        "site_web",
        "whatsapp",
        "recommandation",
        "autre",
      ],
      demande_statut: [
        "nouvelle",
        "en_cours",
        "a_relancer",
        "transformee_en_cotation",
        "perdue",
      ],
      devise_code: [
        "EUR",
        "USD",
        "GBP",
        "ZAR",
        "CHF",
        "CAD",
        "AUD",
        "JPY",
        "AED",
        "MAD",
        "TND",
      ],
      dossier_statut: ["brouillon", "confirme", "cloture"],
      dossier_task_phase: ["avant", "pre_depart", "pendant", "apres", "autre"],
      dossier_task_priorite: ["normale", "importante", "critique"],
      dossier_task_statut: ["a_faire", "en_cours", "termine"],
      echeance_statut: ["a_payer", "paye", "en_retard", "annule"],
      echeance_type: ["acompte_1", "acompte_2", "acompte_3", "solde", "autre"],
      flight_option_statut: ["en_option", "confirmee", "expiree", "annulee"],
      fournisseur_option_statut: [
        "a_demander",
        "demandee",
        "option_confirmee",
        "option_refusee",
        "option_expiree",
        "annulee",
        "confirmee",
      ],
      fx_coverage_statut: [
        "ouverte",
        "reservee",
        "utilisee",
        "expiree",
        "anomalie",
      ],
      fx_reservation_statut: ["active", "utilisee", "annulee"],
      fx_source: ["taux_du_jour", "couverture", "manuel"],
      paiement_methode: ["virement", "carte", "especes"],
      paiement_source: ["banque", "manuel"],
      paiement_statut_rapprochement: ["non_rapproche", "rapproche"],
      paiement_type: ["paiement_client", "paiement_fournisseur"],
      pdf_import_confiance: ["faible", "moyenne", "elevee"],
      pdf_import_statut: ["extrait", "valide", "annule", "erreur"],
      pdf_import_type: ["contrat_fournisseur", "couverture_fx"],
      rapprochement_statut: ["suggere", "valide", "rejete"],
    },
  },
} as const
