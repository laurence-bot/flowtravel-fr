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
      agences: {
        Row: {
          admin_full_name: string
          admin_user_id: string | null
          adresse: string | null
          code_postal: string | null
          created_at: string
          doc_atout_france_url: string | null
          doc_kbis_url: string | null
          doc_piece_identite_url: string | null
          email_contact: string
          forfait: Database["public"]["Enums"]["agence_forfait"]
          id: string
          immat_atout_france: string
          max_agents: number
          motif_refus: string | null
          nom_commercial: string
          pappers_nom: string | null
          pappers_raw: Json | null
          pappers_statut_actif: boolean | null
          pappers_verified_at: string | null
          pays: string | null
          raison_sociale: string | null
          siret: string
          statut: Database["public"]["Enums"]["agence_statut"]
          telephone: string | null
          updated_at: string
          validee_at: string | null
          validee_par: string | null
          ville: string | null
        }
        Insert: {
          admin_full_name: string
          admin_user_id?: string | null
          adresse?: string | null
          code_postal?: string | null
          created_at?: string
          doc_atout_france_url?: string | null
          doc_kbis_url?: string | null
          doc_piece_identite_url?: string | null
          email_contact: string
          forfait?: Database["public"]["Enums"]["agence_forfait"]
          id?: string
          immat_atout_france: string
          max_agents?: number
          motif_refus?: string | null
          nom_commercial: string
          pappers_nom?: string | null
          pappers_raw?: Json | null
          pappers_statut_actif?: boolean | null
          pappers_verified_at?: string | null
          pays?: string | null
          raison_sociale?: string | null
          siret: string
          statut?: Database["public"]["Enums"]["agence_statut"]
          telephone?: string | null
          updated_at?: string
          validee_at?: string | null
          validee_par?: string | null
          ville?: string | null
        }
        Update: {
          admin_full_name?: string
          admin_user_id?: string | null
          adresse?: string | null
          code_postal?: string | null
          created_at?: string
          doc_atout_france_url?: string | null
          doc_kbis_url?: string | null
          doc_piece_identite_url?: string | null
          email_contact?: string
          forfait?: Database["public"]["Enums"]["agence_forfait"]
          id?: string
          immat_atout_france?: string
          max_agents?: number
          motif_refus?: string | null
          nom_commercial?: string
          pappers_nom?: string | null
          pappers_raw?: Json | null
          pappers_statut_actif?: boolean | null
          pappers_verified_at?: string | null
          pays?: string | null
          raison_sociale?: string | null
          siret?: string
          statut?: Database["public"]["Enums"]["agence_statut"]
          telephone?: string | null
          updated_at?: string
          validee_at?: string | null
          validee_par?: string | null
          ville?: string | null
        }
        Relationships: []
      }
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
          adresse: string | null
          code_postal: string | null
          contact_principal: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          notes: string | null
          pays: string | null
          site_web: string | null
          telephone: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
          user_id: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          contact_principal?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          notes?: string | null
          pays?: string | null
          site_web?: string | null
          telephone?: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          user_id: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          contact_principal?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          notes?: string | null
          pays?: string | null
          site_web?: string | null
          telephone?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          user_id?: string
          ville?: string | null
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
          condition_id: string | null
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
          condition_id?: string | null
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
          condition_id?: string | null
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
          agent_id: string | null
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
          agent_id?: string | null
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
          agent_id?: string | null
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
          agent_id: string | null
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
          agent_id?: string | null
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
          agent_id?: string | null
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
      demo_rdv_bookings: {
        Row: {
          created_at: string
          demo_request_id: string
          id: string
          notes_admin: string | null
          notes_prospect: string | null
          slot_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          demo_request_id: string
          id?: string
          notes_admin?: string | null
          notes_prospect?: string | null
          slot_id: string
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          demo_request_id?: string
          id?: string
          notes_admin?: string | null
          notes_prospect?: string | null
          slot_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_rdv_bookings_demo_request_id_fkey"
            columns: ["demo_request_id"]
            isOneToOne: false
            referencedRelation: "demo_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_rdv_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "demo_rdv_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_rdv_slots: {
        Row: {
          actif: boolean
          capacite: number
          created_at: string
          date_debut: string
          duree_minutes: number
          id: string
          updated_at: string
          visio_link: string | null
        }
        Insert: {
          actif?: boolean
          capacite?: number
          created_at?: string
          date_debut: string
          duree_minutes?: number
          id?: string
          updated_at?: string
          visio_link?: string | null
        }
        Update: {
          actif?: boolean
          capacite?: number
          created_at?: string
          date_debut?: string
          duree_minutes?: number
          id?: string
          updated_at?: string
          visio_link?: string | null
        }
        Relationships: []
      }
      demo_requests: {
        Row: {
          admin_notes: string | null
          agence_nom: string
          agence_siret: string | null
          agence_site_web: string | null
          agence_taille: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          email_domain: string
          id: string
          ip_address: string | null
          locked_ip: string | null
          message: string | null
          nom: string
          prenom: string
          refused_reason: string | null
          statut: string
          telephone: string
          updated_at: string
          user_agent: string | null
          video_first_viewed_at: string | null
          video_max_views: number
          video_token: string
          video_token_expires_at: string
          video_view_count: number
        }
        Insert: {
          admin_notes?: string | null
          agence_nom: string
          agence_siret?: string | null
          agence_site_web?: string | null
          agence_taille?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          email_domain: string
          id?: string
          ip_address?: string | null
          locked_ip?: string | null
          message?: string | null
          nom: string
          prenom: string
          refused_reason?: string | null
          statut?: string
          telephone: string
          updated_at?: string
          user_agent?: string | null
          video_first_viewed_at?: string | null
          video_max_views?: number
          video_token?: string
          video_token_expires_at?: string
          video_view_count?: number
        }
        Update: {
          admin_notes?: string | null
          agence_nom?: string
          agence_siret?: string | null
          agence_site_web?: string | null
          agence_taille?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          email_domain?: string
          id?: string
          ip_address?: string | null
          locked_ip?: string | null
          message?: string | null
          nom?: string
          prenom?: string
          refused_reason?: string | null
          statut?: string
          telephone?: string
          updated_at?: string
          user_agent?: string | null
          video_first_viewed_at?: string | null
          video_max_views?: number
          video_token?: string
          video_token_expires_at?: string
          video_view_count?: number
        }
        Relationships: []
      }
      demo_video_views: {
        Row: {
          blocked_reason: string | null
          completed: boolean
          created_at: string
          demo_request_id: string
          duration_watched_seconds: number | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          blocked_reason?: string | null
          completed?: boolean
          created_at?: string
          demo_request_id: string
          duration_watched_seconds?: number | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          blocked_reason?: string | null
          completed?: boolean
          created_at?: string
          demo_request_id?: string
          duration_watched_seconds?: number | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_video_views_demo_request_id_fkey"
            columns: ["demo_request_id"]
            isOneToOne: false
            referencedRelation: "demo_requests"
            referencedColumns: ["id"]
          },
        ]
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
          agent_id: string | null
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
          agent_id?: string | null
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
          agent_id?: string | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          agence_id: string | null
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string
          resolved: boolean
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          agence_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message: string
          resolved?: boolean
          source: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          agence_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          resolved?: boolean
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      fournisseur_conditions: {
        Row: {
          acompte_1_a_reservation: boolean
          acompte_2_a_reservation: boolean
          acompte_3_a_reservation: boolean
          conditions_annulation: Json
          created_at: string
          delai_acompte_1_jours: number | null
          delai_acompte_2_jours: number | null
          delai_acompte_3_jours: number | null
          delai_solde_jours: number | null
          devises_acceptees: string[]
          est_principale: boolean
          fournisseur_id: string
          id: string
          nom: string
          notes: string | null
          pct_acompte_1: number
          pct_acompte_2: number
          pct_acompte_3: number
          pct_solde: number
          solde_a_reservation: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          acompte_1_a_reservation?: boolean
          acompte_2_a_reservation?: boolean
          acompte_3_a_reservation?: boolean
          conditions_annulation?: Json
          created_at?: string
          delai_acompte_1_jours?: number | null
          delai_acompte_2_jours?: number | null
          delai_acompte_3_jours?: number | null
          delai_solde_jours?: number | null
          devises_acceptees?: string[]
          est_principale?: boolean
          fournisseur_id: string
          id?: string
          nom?: string
          notes?: string | null
          pct_acompte_1?: number
          pct_acompte_2?: number
          pct_acompte_3?: number
          pct_solde?: number
          solde_a_reservation?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          acompte_1_a_reservation?: boolean
          acompte_2_a_reservation?: boolean
          acompte_3_a_reservation?: boolean
          conditions_annulation?: Json
          created_at?: string
          delai_acompte_1_jours?: number | null
          delai_acompte_2_jours?: number | null
          delai_acompte_3_jours?: number | null
          delai_solde_jours?: number | null
          devises_acceptees?: string[]
          est_principale?: boolean
          fournisseur_id?: string
          id?: string
          nom?: string
          notes?: string | null
          pct_acompte_1?: number
          pct_acompte_2?: number
          pct_acompte_3?: number
          pct_solde?: number
          solde_a_reservation?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          cotation_id: string | null
          coverage_id: string
          created_at: string
          echeance_id: string | null
          facture_fournisseur_id: string | null
          id: string
          ligne_fournisseur_id: string | null
          montant_devise: number
          paiement_id: string | null
          statut: Database["public"]["Enums"]["fx_reservation_statut"]
          taux_change: number
          user_id: string
        }
        Insert: {
          cotation_id?: string | null
          coverage_id: string
          created_at?: string
          echeance_id?: string | null
          facture_fournisseur_id?: string | null
          id?: string
          ligne_fournisseur_id?: string | null
          montant_devise: number
          paiement_id?: string | null
          statut?: Database["public"]["Enums"]["fx_reservation_statut"]
          taux_change: number
          user_id: string
        }
        Update: {
          cotation_id?: string | null
          coverage_id?: string
          created_at?: string
          echeance_id?: string | null
          facture_fournisseur_id?: string | null
          id?: string
          ligne_fournisseur_id?: string | null
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
      support_messages: {
        Row: {
          agence_id: string | null
          contenu: string
          created_at: string
          from_user_id: string
          id: string
          is_from_admin: boolean
          lu_par_admin: boolean
          lu_par_user: boolean
          sujet: string
          thread_id: string
        }
        Insert: {
          agence_id?: string | null
          contenu: string
          created_at?: string
          from_user_id: string
          id?: string
          is_from_admin?: boolean
          lu_par_admin?: boolean
          lu_par_user?: boolean
          sujet: string
          thread_id?: string
        }
        Update: {
          agence_id?: string | null
          contenu?: string
          created_at?: string
          from_user_id?: string
          id?: string
          is_from_admin?: boolean
          lu_par_admin?: boolean
          lu_par_user?: boolean
          sujet?: string
          thread_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
          agence_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_super_admin: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean
          agence_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean
          agence_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_agence_id_fkey"
            columns: ["agence_id"]
            isOneToOne: false
            referencedRelation: "agences"
            referencedColumns: ["id"]
          },
        ]
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_my_agence_id: { Args: never; Returns: string }
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
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      agence_forfait: "solo" | "equipe" | "agence"
      agence_statut: "en_attente" | "validee" | "refusee" | "suspendue"
      app_role:
        | "administrateur"
        | "gestion"
        | "lecture_seule"
        | "comptable"
        | "agent"
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
        | "contact"
        | "fournisseur_condition"
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
      fx_reservation_statut:
        | "active"
        | "utilisee"
        | "annulee"
        | "reservee"
        | "engagee"
        | "liberee"
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
      agence_forfait: ["solo", "equipe", "agence"],
      agence_statut: ["en_attente", "validee", "refusee", "suspendue"],
      app_role: [
        "administrateur",
        "gestion",
        "lecture_seule",
        "comptable",
        "agent",
      ],
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
        "contact",
        "fournisseur_condition",
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
      fx_reservation_statut: [
        "active",
        "utilisee",
        "annulee",
        "reservee",
        "engagee",
        "liberee",
      ],
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
