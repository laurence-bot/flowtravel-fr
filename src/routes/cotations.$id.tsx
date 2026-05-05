import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTable, type Contact, type Paiement } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePageWriteAccess } from "@/hooks/use-page-write-access";
import { useEditLock } from "@/hooks/use-edit-lock";
import { EditLockBanner } from "@/components/edit-lock-banner";
import { useAgents, agentLabel } from "@/hooks/use-agents";
import { formatEUR } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { logAudit } from "@/lib/audit";
import { tenterAjoutFournisseur } from "@/lib/dedup";
import { askDuplicate } from "@/lib/duplicate-confirm";
import {
  engageReservationsForCotation,
  reactivateReleasedReservationsForCotation,
  releaseReservationsForCotation,
} from "@/lib/fx-reservations";
import {
  COTATION_STATUT_LABELS,
  COTATION_STATUT_TONES,
  REGIME_TVA_LABELS,
  computeCotationFinance,
  computeAcompteClient,
  duplicateCotation,
  deleteCotation,
  ligneCoutEur,
  // transformerCotationEnDossier remplacé par RPC Postgres atomique
  type Cotation,
  type CotationLigne,
  type CotationLigneModeTarifaire,
  type CotationRegimeTva,
  type CotationStatut,
} from "@/lib/cotations";
import { ALL_COUNTRIES, isEUCountry, suggestRegimeTva } from "@/lib/countries";
import { DEVISES, type DeviseCode } from "@/lib/fx";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Users as UsersIcon,
  FileText,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { CotationOptionsBlock } from "@/components/cotation-options-block";
import { PublicQuoteLinkBlock } from "@/components/public-quote-link-block";
import { QuoteContentEditorBlock } from "@/components/quote-content-editor-block";
import { FxOptimizerBlock } from "@/components/fx-optimizer-block";
import { InlineFxCoveragePicker } from "@/components/inline-fx-coverage-picker";
import { MargeCalculator } from "@/components/marge-calculator";
import { useAgencySettings } from "@/hooks/use-agency-settings";
import { ProgramImportDialog } from "@/components/program-import-dialog";
import { useScrollRestore } from "@/hooks/use-scroll-restore";

export const Route = createFileRoute("/cotations/$id")({
  component: () => (
    <RequireAuth>
      <CotationDetailPage />
    </RequireAuth>
  ),
});

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-secondary text-muted-foreground border-border",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  primary: "bg-primary/15 text-primary border-primary/30",
  muted: "bg-muted text-muted-foreground border-border",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

const ligneSchema = z.object({
  nom_fournisseur: z.string().trim().min(1).max(200),
  prestation: z.string().trim().max(500).optional().or(z.literal("")),
  devise: z.string().min(3).max(3),
  montant_devise: z.number().min(0),
  taux_change_vers_eur: z.number().min(0),
  quantite: z.number().min(0.01),
  pct_acompte_1: z.number().min(0).max(100),
  pct_acompte_2: z.number().min(0).max(100),
  pct_acompte_3: z.number().min(0).max(100),
  pct_solde: z.number().min(0).max(100),
});

function CotationDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { canWrite: canWriteRole } = usePageWriteAccess();
  const editLock = useEditLock("cotation", id);
  const canWrite = canWriteRole && (editLock.isAlone || editLock.canEdit);
  const { agents } = useAgents();
  const navigate = useNavigate();
  const { settings: agencySettings } = useAgencySettings();
  const fxEnabled = !!agencySettings?.utilise_couvertures_fx;

  // Restaure la position de scroll au retour sur la page
  useScrollRestore(`cotation-${id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cotations, loading: cotationsLoading, refetch: refetchCot } = useTable<Cotation>("cotations" as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lignes, refetch: refetchLignes } = useTable<CotationLigne>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "cotation_lignes_fournisseurs" as any,
  );
  const { data: contacts, loading: contactsLoading } = useTable<Contact>("contacts");
  const { data: paiements, loading: paiementsLoading } = useTable<Paiement>("paiements");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fournisseurConditions } = useTable<any>("fournisseur_conditions" as any);

  const cot = cotations.find((c) => c.id === id);
  const lignesCot = useMemo(
    () => lignes.filter((l) => l.cotation_id === id),
    [lignes, id],
  );

  // Form édition générale
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<Partial<Cotation>>({});

  // Form ajout ligne
  const [addOpen, setAddOpen] = useState(false);
  const [submittingLigne, setSubmittingLigne] = useState(false);
  const [ligneForm, setLigneForm] = useState({
    nom_fournisseur: "",
    fournisseur_id: "",
    prestation: "",
    // payeur supprimé
    date_prestation: "",
    mode_tarifaire: "global" as CotationLigneModeTarifaire,
    quantite: "1",
    devise: "EUR" as DeviseCode,
    montant_devise: "0",
    taux_change_vers_eur: "1",
    couverture_id: "" as string | "",
    source_fx: "taux_du_jour" as "taux_du_jour" | "couverture" | "manuel",
    pct_acompte_1: "30",
    pct_acompte_2: "0",
    pct_acompte_3: "0",
    pct_solde: "70",
    date_acompte_1: "",
    date_acompte_2: "",
    date_acompte_3: "",
    date_solde: "",
  });

  // Dialog perte
  const [perteOpen, setPerteOpen] = useState(false);
  const [raisonPerte, setRaisonPerte] = useState("");

  // Dialog suppression
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialog nouvelle version
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [dupForm, setDupForm] = useState({
    versionLabel: "",
    newDateDepart: "",
    newDateRetour: "",
  });

  // URL signée du PDF fournisseur (générée à la demande)
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDeleting, setPdfDeleting] = useState(false);

  if (cotationsLoading || contactsLoading || paiementsLoading) {
    return <div className="text-muted-foreground text-sm">Chargement de la cotation…</div>;
  }

  if (!cot) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-2xl">Cotation introuvable</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/cotations">Retour</Link>
        </Button>
      </div>
    );
  }

  const fin = computeCotationFinance(cot, lignes);
  const acompteInfo = computeAcompteClient(cot, lignes);
  const client = contacts.find((c) => c.id === cot.client_id);
  const fournisseurs = contacts.filter((c) => c.type === "fournisseur");
  const acompteClientRecu = !!cot.dossier_id && paiements.some(
    (p) => p.dossier_id === cot.dossier_id && p.type === "paiement_client",
  );
  const tone = COTATION_STATUT_TONES[cot.statut];
  const isLocked =
    cot.statut === "transformee_en_dossier" ||
    cot.statut === "perdue" ||
    cot.statut === "archivee";

  const startEdit = () => {
    setEdit({
      titre: cot.titre,
      destination: cot.destination,
      pays_destination: cot.pays_destination,
      langue: cot.langue,
      date_depart: cot.date_depart,
      date_retour: cot.date_retour,
      nombre_pax: cot.nombre_pax,
      nombre_chambres: cot.nombre_chambres,
      prix_vente_ht: cot.prix_vente_ht,
      prix_vente_ttc: cot.prix_vente_ttc,
      prix_vente_usd: cot.prix_vente_usd,
      regime_tva: cot.regime_tva,
      taux_tva_marge: cot.taux_tva_marge,
      notes: cot.notes,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotations")
      .update(edit)
      .eq("id", cot.id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "update",
      description: `Cotation modifiée : ${cot.titre}`,
    });
    setEditing(false);
    toast.success("Cotation enregistrée.");
    refetchCot();
  };

  const reassignAgent = async (newAgentId: string) => {
    if (!user || !cot) return;
    const oldAgentId = cot.agent_id ?? null;
    if (newAgentId === oldAgentId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotations")
      .update({ agent_id: newAgentId })
      .eq("id", cot.id);
    if (error) return toast.error(error.message);
    const oldName = agentLabel(agents.find((a) => a.user_id === oldAgentId));
    const newName = agentLabel(agents.find((a) => a.user_id === newAgentId));
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "update",
      description: `Agent réassigné : ${oldName} → ${newName}`,
      oldValue: { agent_id: oldAgentId },
      newValue: { agent_id: newAgentId },
    });
    toast.success(`Agent : ${newName}`);
    refetchCot();
  };

  const ajouterLigne = async () => {
    if (!user) return;
    const parsed = ligneSchema.safeParse({
      nom_fournisseur: ligneForm.nom_fournisseur,
      prestation: ligneForm.prestation,
      devise: ligneForm.devise,
      montant_devise: Number(ligneForm.montant_devise) || 0,
      taux_change_vers_eur: Number(ligneForm.taux_change_vers_eur) || 1,
      quantite: Number(ligneForm.quantite) || 1,
      pct_acompte_1: Number(ligneForm.pct_acompte_1) || 0,
      pct_acompte_2: Number(ligneForm.pct_acompte_2) || 0,
      pct_acompte_3: Number(ligneForm.pct_acompte_3) || 0,
      pct_solde: Number(ligneForm.pct_solde) || 0,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const totalPct =
      parsed.data.pct_acompte_1 +
      parsed.data.pct_acompte_2 +
      parsed.data.pct_acompte_3 +
      parsed.data.pct_solde;
    if (Math.abs(totalPct - 100) > 0.01) {
      return toast.error("La somme des % doit faire 100%.");
    }
    // ---- Anti-doublons fournisseurs ----
    const dedup = tenterAjoutFournisseur(
      {
        fournisseur: parsed.data.nom_fournisseur,
        libelle: parsed.data.prestation || "",
        montant: parsed.data.montant_devise,
        devise: parsed.data.devise,
      },
      lignesCot.map((l: any) => ({
        id: l.id,
        fournisseur: l.nom_fournisseur ?? "",
        libelle: l.prestation ?? "",
        montant: Number(l.montant_devise) || 0,
        devise: l.devise ?? "",
      })),
    );
    let replaceId: string | null = null;
    if (dedup.action !== "OK") {
      const choice = await askDuplicate({ message: dedup.message ?? "Doublon détecté" });
      if (choice === "ANNULER" || choice === "IGNORER") {
        toast.message("Ligne non ajoutée (doublon).");
        return;
      }
      if (choice === "REMPLACER" && dedup.ligneExistante?.id) {
        replaceId = dedup.ligneExistante.id;
      }
    }
    setSubmittingLigne(true);
    if (replaceId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("cotation_lignes_fournisseurs")
        .delete()
        .eq("id", replaceId);
    }
    const montantEur = parsed.data.montant_devise * parsed.data.taux_change_vers_eur;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase as any)
      .from("cotation_lignes_fournisseurs")
      .insert({
        user_id: user.id,
        cotation_id: cot.id,
        fournisseur_id: ligneForm.fournisseur_id || null,
        nom_fournisseur: parsed.data.nom_fournisseur,
        payeur: null,
        prestation: parsed.data.prestation || null,
        date_prestation: ligneForm.date_prestation || null,
        mode_tarifaire: ligneForm.mode_tarifaire,
        quantite: parsed.data.quantite,
        devise: parsed.data.devise,
        montant_devise: parsed.data.montant_devise,
        taux_change_vers_eur: parsed.data.taux_change_vers_eur,
        montant_eur: montantEur,
        couverture_id: ligneForm.couverture_id || null,
        source_fx: ligneForm.source_fx,
        pct_acompte_1: parsed.data.pct_acompte_1,
        pct_acompte_2: parsed.data.pct_acompte_2,
        pct_acompte_3: parsed.data.pct_acompte_3,
        pct_solde: parsed.data.pct_solde,
        date_acompte_1: ligneForm.date_acompte_1 || null,
        date_acompte_2: ligneForm.date_acompte_2 || null,
        date_acompte_3: ligneForm.date_acompte_3 || null,
        date_solde: ligneForm.date_solde || null,
        ordre: lignesCot.length + 1,
      })
      .select()
      .single();
    setSubmittingLigne(false);
    if (error || !created) return toast.error(error?.message ?? "Erreur");
    await logAudit({
      userId: user.id,
      entity: "cotation_ligne",
      entityId: created.id,
      action: "create",
      description: `Ligne ajoutée : ${parsed.data.nom_fournisseur}`,
    });
    setAddOpen(false);
    setLigneForm({
      ...ligneForm,
      nom_fournisseur: "",
      prestation: "",
      montant_devise: "0",
      couverture_id: "",
      source_fx: "taux_du_jour",
    });
    refetchLignes();
    toast.success("Ligne ajoutée.");
  };

  const supprimerLigne = async (ligneId: string) => {
    if (!user) return;
    if (!confirm("Supprimer cette ligne ?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("cotation_lignes_fournisseurs")
      .delete()
      .eq("id", ligneId);
    await logAudit({
      userId: user.id,
      entity: "cotation_ligne",
      entityId: ligneId,
      action: "delete",
      description: "Ligne supprimée",
    });
    refetchLignes();
  };

  const valider = async () => {
    if (!user) return;
    if (lignesCot.length === 0)
      return toast.error("Ajoutez au moins une ligne fournisseur.");
    // archiver les autres versions du group
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("cotations")
      .update({ statut: "archivee" })
      .eq("group_id", cot.group_id)
      .neq("id", cot.id)
      .in("statut", ["brouillon", "envoyee", "validee"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("cotations")
      .update({ statut: "validee" })
      .eq("id", cot.id);
    // Engager définitivement les réservations FX liées (dossier confirmé)
    const engagement = await engageReservationsForCotation({ userId: user.id, cotationId: cot.id });
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "validate",
      description: `Cotation validée : ${cot.titre}${engagement.count > 0 ? ` — ${engagement.count} réservation(s) FX engagée(s)` : ""}`,
    });
    toast.success(
      engagement.count > 0
        ? `Cotation validée. ${engagement.count} réservation(s) de couverture engagée(s).`
        : "Cotation validée.",
    );
    refetchCot();
  };

  const marquerPerdue = async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("cotations")
      .update({ statut: "perdue", raison_perte: raisonPerte || null })
      .eq("id", cot.id);
    // Annulation automatique de toutes les options associées
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("fournisseur_options")
      .update({ statut: "annulee" })
      .eq("cotation_id", cot.id)
      .not("statut", "in", "(annulee,option_refusee)");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("flight_options")
      .update({ statut: "annulee" })
      .eq("cotation_id", cot.id)
      .neq("statut", "annulee");
    // Libérer les réservations FX (devis perdu, montants rendus disponibles)
    const liberation = await releaseReservationsForCotation({ userId: user.id, cotationId: cot.id });
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "reject",
      description: `Cotation perdue : ${cot.titre}${raisonPerte ? ` (${raisonPerte})` : ""} — options annulées${liberation.count > 0 ? `, ${liberation.count} réservation(s) FX libérée(s)` : ""}`,
    });
    setPerteOpen(false);
    setRaisonPerte("");
    toast.success(
      liberation.count > 0
        ? `Cotation perdue. ${liberation.count} réservation(s) FX libérée(s).`
        : "Cotation perdue. Options annulées — pensez à envoyer les emails d'annulation aux fournisseurs.",
    );
    refetchCot();
  };

  const rouvrirCotation = async () => {
    if (!user) return;
    if (
      !confirm(
        "Rouvrir cette cotation ? Le statut repassera en 'envoyée' et les réservations FX libérées seront restaurées si les couvertures ont encore du solde.",
      )
    )
      return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("cotations")
      .update({ statut: "envoyee", raison_perte: null })
      .eq("id", cot.id);
    const restoration = await reactivateReleasedReservationsForCotation({
      userId: user.id,
      cotationId: cot.id,
    });
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "update",
      description: `Cotation rouverte : ${cot.titre}${restoration.restored > 0 ? ` — ${restoration.restored} réservation(s) FX restaurée(s)` : ""}${restoration.skipped > 0 ? `, ${restoration.skipped} non restaurée(s) (solde insuffisant)` : ""}`,
    });
    if (restoration.skipped > 0) {
      toast.warning(
        `Cotation rouverte. ${restoration.restored} réservation(s) restaurée(s), ${restoration.skipped} ignorée(s) — solde de couverture insuffisant.`,
      );
    } else {
      toast.success(
        restoration.restored > 0
          ? `Cotation rouverte. ${restoration.restored} réservation(s) FX restaurée(s).`
          : "Cotation rouverte.",
      );
    }
    refetchCot();
  };

  const openDuplicateDialog = () => {
    setDupForm({
      versionLabel: "",
      newDateDepart: cot.date_depart ?? "",
      newDateRetour: cot.date_retour ?? "",
    });
    setDuplicateOpen(true);
  };

  const confirmDuplicate = async () => {
    if (!user) return;
    setDuplicating(true);
    const res = await duplicateCotation(user.id, cot, lignes, {
      versionLabel: dupForm.versionLabel || null,
      newDateDepart: dupForm.newDateDepart || null,
      newDateRetour: dupForm.newDateRetour || null,
    });
    setDuplicating(false);
    if (!res) return toast.error("Duplication impossible.");
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: res.id,
      action: "create",
      description: `Nouvelle version v${res.version_number}${dupForm.versionLabel ? ` (${dupForm.versionLabel})` : ""} de ${cot.titre}`,
    });
    toast.success(`Version v${res.version_number} créée.`);
    setDuplicateOpen(false);
    navigate({ to: "/cotations/$id", params: { id: res.id } });
  };

  const confirmDelete = async () => {
    if (!user) return;
    setDeleting(true);
    const res = await deleteCotation(cot.id, { hasDossier: !!cot.dossier_id });
    setDeleting(false);
    if (!res.ok) return toast.error(res.error);
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "delete",
      description: `Cotation supprimée : ${cot.titre}`,
    });
    toast.success("Cotation supprimée.");
    setDeleteOpen(false);
    navigate({ to: "/cotations" });
  };

  const openProgrammePdf = async () => {
    if (!cot.programme_pdf_url) return;
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("pdf-imports")
        .createSignedUrl(cot.programme_pdf_url, 300);
      if (error || !data?.signedUrl) {
        toast.error("Impossible d'ouvrir le document.");
        return;
      }
      setPdfSignedUrl(data.signedUrl);
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setPdfLoading(false);
    }
  };

  const deleteProgrammePdf = async () => {
    if (!cot.programme_pdf_url) return;
    if (!confirm("Supprimer le PDF importé de cette cotation ? Les jours et lignes déjà importés restent modifiables.")) return;
    setPdfDeleting(true);
    try {
      const { error: storageError } = await supabase.storage
        .from("pdf-imports")
        .remove([cot.programme_pdf_url]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("cotations")
        .update({ programme_pdf_url: null, programme_pdf_name: null })
        .eq("id", cot.id);
      if (error) return toast.error(error.message);
      if (storageError) toast.warning("PDF détaché de la cotation, mais le fichier source n'a pas pu être supprimé du stockage.");
      else toast.success("PDF importé supprimé.");
      refetchCot();
    } finally {
      setPdfDeleting(false);
    }
  };

  const transformer = async () => {
    if (!user) return;
    if (cot.statut !== "validee")
      return toast.error("La cotation doit être validée.");
    if (!cot.client_id) return toast.error("Client requis.");
    const { data: dossierId, error } = await (supabase as any).rpc(
      "transformer_cotation_en_dossier",
      { _cotation_id: cot.id },
    );
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "update",
      description: `Cotation transformée en dossier`,
      newValue: { dossier_id: dossierId },
    });
    toast.success("Dossier créé.");
    navigate({ to: "/dossiers/$id", params: { id: dossierId as string } });
  };

  return (
    <div className="space-y-6">
      <EditLockBanner lock={editLock} />
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/cotations">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour aux cotations
          </Link>
        </Button>
        <PageHeader
          title={cot.titre}
          numero={(cot as { numero?: string | null }).numero ?? null}
          description={`Version ${cot.version_number}${cot.version_label ? ` — ${cot.version_label}` : ""}${client ? ` · ${client.nom}` : ""}${cot.destination ? ` · ${cot.destination}` : ""}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {user && (
                <ProgramImportDialog
                  cotationId={cot.id}
                  userId={user.id}
                  canWrite={canWrite}
                  onImported={() => {
                    refetchLignes();
                    // Force le rechargement des jours (QuoteContentEditorBlock relit au mount)
                    window.location.reload();
                  }}
                />
              )}
              {user && (
                <Button asChild size="sm">
                  <a href="#devis-web-client">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Générer le lien client
                  </a>
                </Button>
              )}
              <Badge variant="outline" className={TONE_CLASS[tone]}>
                {COTATION_STATUT_LABELS[cot.statut]}
              </Badge>
            </div>
          }
        />
        <div className="mt-3 inline-flex items-center gap-2">
          <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Agent responsable :</span>
          <Select value={cot.agent_id ?? ""} onValueChange={reassignAgent} disabled={!canWrite}>
            <SelectTrigger className="h-7 w-[220px] text-xs"><SelectValue placeholder="Non assigné" /></SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.user_id} value={a.user_id}>
                  {agentLabel(a)}{a.user_id === user?.id ? " (moi)" : ""}{!a.actif ? " · inactif" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Devis web client (lien partageable) */}
      {user && (
        <PublicQuoteLinkBlock
          cotationId={cot.id}
          userId={user.id}
          canWrite={canWrite}
        />
      )}

      {/* Éditeur de contenu du devis web (hero + jours) */}
      {user && (
        <QuoteContentEditorBlock
          cotationId={cot.id}
          userId={user.id}
          canWrite={canWrite}
          initialHeroUrl={cot.hero_image_url ?? null}
          initialStorytelling={cot.storytelling_intro ?? null}
          initialInclus={cot.inclus_text ?? null}
          initialNonInclus={cot.non_inclus_text ?? null}
          titre={cot.titre ?? null}
          destination={cot.destination ?? null}
          paysDestination={cot.pays_destination ?? null}
          typeVoyage={(cot as { type_voyage?: string | null }).type_voyage ?? null}
          nombrePax={cot.nombre_pax ?? null}
          dateDepart={cot.date_depart ?? null}
          dateRetour={cot.date_retour ?? null}
          programmePdfUrl={cot.programme_pdf_url ?? null}
          programmePdfName={cot.programme_pdf_name ?? null}
          onDataChanged={() => {
            refetchCot();
            refetchLignes();
          }}
        />
      )}

      {/* Résumé financier */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Prix vente TTC
          </div>
          <div className="mt-1 text-lg font-semibold tabular text-[color:var(--revenue)]">
            {formatEUR(fin.prixVente)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Coût fournisseurs
          </div>
          <div className="mt-1 text-lg font-semibold tabular text-[color:var(--cost)]">
            {formatEUR(fin.coutTotal)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Marge brute
          </div>
          <div
            className={`mt-1 text-lg font-semibold tabular ${fin.margeBrute >= 0 ? "" : "text-destructive"}`}
          >
            {formatEUR(fin.margeBrute)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            TVA marge
          </div>
          <div className="mt-1 text-lg font-semibold tabular">
            {formatEUR(fin.tvaSurMarge)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {REGIME_TVA_LABELS[cot.regime_tva]}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Marge nette
          </div>
          <div
            className={`mt-1 text-lg font-semibold tabular ${fin.margeNette >= 0 ? "text-[color:var(--margin)]" : "text-destructive"}`}
          >
            {formatEUR(fin.margeNette)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {fin.margeNettePct.toFixed(1)}% du CA
      </div>

      {/* Acompte client à demander */}
      {acompteInfo.acompte > 0 && (
        <Card className="p-4 border-l-4 border-l-[color:var(--margin)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Acompte client à demander à la confirmation
              </div>
              <div className="mt-1 text-2xl font-semibold tabular text-[color:var(--margin)]">
                {formatEUR(acompteInfo.acompte)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                = {formatEUR(acompteInfo.acomptesFournisseurs)} acomptes fournisseurs
                {acompteInfo.partMarge > 0 && ` + ${formatEUR(acompteInfo.partMarge)} (50% de la marge)`}
              </div>
              {acompteInfo.margeNegative && (
                <div className="text-xs text-destructive mt-1">
                  ⚠ Marge négative : acompte limité au coût fournisseurs.
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Solde au départ
              </div>
              <div className="mt-1 text-lg font-medium tabular">
                {formatEUR(acompteInfo.solde)}
              </div>
            </div>
          </div>
        </Card>
      )}
        </Card>
      </div>

      {/* Alertes qualité */}
      {(() => {
        const alerts: { tone: "danger" | "warn"; msg: string }[] = [];
        if (fin.margeNette < 0) {
          alerts.push({ tone: "danger", msg: "Marge nette négative : la cotation est à perte." });
        } else if (fin.prixVente > 0 && fin.margeNettePct < 10) {
          alerts.push({ tone: "warn", msg: `Marge nette faible (${fin.margeNettePct.toFixed(1)}%).` });
        }
        const fxKo = lignesCot.filter(
          (l) => l.devise !== "EUR" && (!l.taux_change_vers_eur || l.taux_change_vers_eur <= 0),
        );
        if (fxKo.length > 0) {
          alerts.push({
            tone: "warn",
            msg: `${fxKo.length} ligne(s) en devise étrangère sans taux FX renseigné.`,
          });
        }
        if (alerts.length === 0) return null;
        return (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <Card
                key={i}
                className={`p-3 flex items-center gap-2 text-sm border ${
                  a.tone === "danger"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {a.msg}
              </Card>
            ))}
          </div>
        );
      })()}

      {canWrite && !isLocked && (
        <Card className="p-4 flex flex-wrap gap-2">
          {cot.statut !== "validee" && (
            <Button onClick={valider} variant="default">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Valider la cotation
            </Button>
          )}
          {cot.statut === "validee" && (
            <Button onClick={transformer} variant="default">
              <ArrowRight className="h-4 w-4 mr-2" /> Transformer en dossier
            </Button>
          )}
          <Button onClick={openDuplicateDialog} variant="outline">
            <Copy className="h-4 w-4 mr-2" /> Nouvelle version
          </Button>
          <Button
            onClick={() => setPerteOpen(true)}
            variant="outline"
            className="text-destructive hover:text-destructive"
          >
            <XCircle className="h-4 w-4 mr-2" /> Marquer comme perdue
          </Button>
          <Button
            onClick={() => setDeleteOpen(true)}
            variant="outline"
            className="text-destructive hover:text-destructive border-destructive/40"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Supprimer
          </Button>
        </Card>
      )}

      {canWrite && cot.statut === "perdue" && (
        <Card className="p-4 flex flex-wrap items-center gap-3 border-amber-500/40 bg-amber-500/5">
          <div className="text-sm text-muted-foreground flex-1 min-w-0">
            Cotation marquée comme perdue
            {cot.raison_perte ? ` (${cot.raison_perte})` : ""}. Le client revient&nbsp;?
            Tu peux la rouvrir — les réservations FX libérées seront restaurées
            si les couvertures ont encore du solde disponible.
          </div>
          <Button onClick={rouvrirCotation} variant="default" className="shrink-0">
            <RotateCcw className="h-4 w-4 mr-2" /> Rouvrir la cotation
          </Button>
        </Card>
      )}

      {/* Infos générales */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg">Informations générales</h3>
          {canWrite && !isLocked && !editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              Modifier
            </Button>
          )}
        </div>

        {!editing ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Info label="Destination" value={cot.destination ?? "—"} />
            <Info
              label="Pays"
              value={
                cot.pays_destination
                  ? `${cot.pays_destination} ${
                      isEUCountry(cot.pays_destination) ? "🇪🇺" : "🌍"
                    }`
                  : "—"
              }
            />
            <Info label="Langue" value={cot.langue ?? "—"} />
            <Info label="Pax" value={String(cot.nombre_pax)} />
            <Info label="Chambres" value={String(cot.nombre_chambres)} />
            <Info label="Date départ" value={cot.date_depart ?? "—"} />
            <Info label="Date retour" value={cot.date_retour ?? "—"} />
            <Info label="Prix HT" value={formatEUR(cot.prix_vente_ht)} />
            <Info label="Prix TTC" value={formatEUR(cot.prix_vente_ttc)} />
            <Info
              label="Régime TVA"
              value={
                REGIME_TVA_LABELS[cot.regime_tva] +
                (cot.pays_destination
                  ? isEUCountry(cot.pays_destination)
                    ? " (UE)"
                    : " (hors UE — 0 %)"
                  : "")
              }
            />
            <Info
              label="Taux TVA marge"
              value={
                cot.regime_tva === "hors_ue"
                  ? "0 % (hors UE)"
                  : `${cot.taux_tva_marge}%`
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Titre">
                <Input
                  value={edit.titre ?? ""}
                  onChange={(e) => setEdit({ ...edit, titre: e.target.value })}
                />
              </Field>
              <Field label="Destination (libre)">
                <Input
                  value={edit.destination ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, destination: e.target.value })
                  }
                />
              </Field>
              <Field label="Pays (pilote la TVA)">
                <Select
                  value={edit.pays_destination ?? "none"}
                  onValueChange={(v) => {
                    const pays = v === "none" ? null : v;
                    const regime = suggestRegimeTva(pays);
                    setEdit({
                      ...edit,
                      pays_destination: pays,
                      regime_tva: regime,
                      // taux à 0 si hors UE, sinon défaut 20 si actuellement 0
                      taux_tva_marge:
                        regime === "hors_ue"
                          ? 0
                          : (edit.taux_tva_marge ?? 0) > 0
                            ? edit.taux_tva_marge
                            : 20,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un pays" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">— Aucun —</SelectItem>
                    {ALL_COUNTRIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {isEUCountry(p) ? "🇪🇺" : "🌍"} {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Langue">
                <Input
                  value={edit.langue ?? ""}
                  onChange={(e) => setEdit({ ...edit, langue: e.target.value })}
                />
              </Field>
              <Field label="Pax">
                <Input
                  type="number"
                  value={edit.nombre_pax ?? 1}
                  onChange={(e) =>
                    setEdit({ ...edit, nombre_pax: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Chambres">
                <Input
                  type="number"
                  value={edit.nombre_chambres ?? 1}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      nombre_chambres: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Date départ">
                <Input
                  type="date"
                  value={edit.date_depart ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, date_depart: e.target.value })
                  }
                />
              </Field>
              <Field label="Date retour">
                <Input
                  type="date"
                  value={edit.date_retour ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, date_retour: e.target.value })
                  }
                />
              </Field>
              <div className="md:col-span-2">
                <MargeCalculator
                  coutTotal={fin.coutTotal}
                  regimeTva={(edit.regime_tva ?? "hors_ue") as "marge_ue" | "hors_ue"}
                  tauxTvaMarge={Number(edit.taux_tva_marge ?? 20)}
                  onApply={({ prixHt, prixTtc }) =>
                    setEdit({ ...edit, prix_vente_ht: prixHt, prix_vente_ttc: prixTtc })
                  }
                />
              </div>
              <Field label="Prix HT">
                <Input
                  type="number"
                  step="0.01"
                  value={edit.prix_vente_ht ?? 0}
                  onChange={(e) =>
                    setEdit({ ...edit, prix_vente_ht: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Prix TTC">
                <Input
                  type="number"
                  step="0.01"
                  value={edit.prix_vente_ttc ?? 0}
                  onChange={(e) =>
                    setEdit({ ...edit, prix_vente_ttc: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Régime TVA (auto selon pays)">
                <Select
                  value={edit.regime_tva ?? "hors_ue"}
                  onValueChange={(v) =>
                    setEdit({ ...edit, regime_tva: v as CotationRegimeTva })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hors_ue">Hors UE (pas de TVA)</SelectItem>
                    <SelectItem value="marge_ue">TVA sur marge (UE)</SelectItem>
                  </SelectContent>
                </Select>
                {edit.pays_destination && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {isEUCountry(edit.pays_destination)
                      ? `${edit.pays_destination} est dans l'UE → TVA sur marge applicable.`
                      : `${edit.pays_destination} est hors UE → exonéré (0 %).`}
                  </p>
                )}
              </Field>
              <Field label="Taux TVA marge (%)">
                <Input
                  type="number"
                  step="0.1"
                  value={edit.taux_tva_marge ?? 20}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      taux_tva_marge: Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(false)}>
                Annuler
              </Button>
              <Button onClick={saveEdit}>Enregistrer</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Document fournisseur importé (PDF source) */}
      {cot.programme_pdf_url && (
        <Card className="p-4 flex items-center justify-between gap-3 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                📎 {cot.programme_pdf_name ?? "Document fournisseur importé"}
              </div>
              <div className="text-xs text-muted-foreground">
                Source utilisée pour l'import automatique des étapes et lignes prix.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={openProgrammePdf} disabled={pdfLoading}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {pdfLoading ? "Ouverture…" : "Ouvrir le PDF"}
            </Button>
            {canWrite && !isLocked && (
              <Button
                variant="outline"
                size="sm"
                onClick={deleteProgrammePdf}
                disabled={pdfDeleting}
                className="text-destructive hover:text-destructive border-destructive/40"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {pdfDeleting ? "Suppression…" : "Supprimer"}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Lignes fournisseurs */}
      <Card className="overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <h3 className="font-display text-lg">Lignes fournisseurs</h3>
          {canWrite && !isLocked && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          )}
        </div>
        {lignesCot.length === 0 ? (
          <div className="p-10 text-sm text-muted-foreground text-center">
            Aucune ligne fournisseur.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Prestation</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Devise</TableHead>
                <TableHead className="text-right">Taux</TableHead>
                <TableHead className="text-right">EUR</TableHead>
                <TableHead className="text-right">Acomptes (% 1/2/3/Solde)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignesCot.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">
                    <div className="font-medium">{l.nom_fournisseur}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.prestation ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.mode_tarifaire === "par_personne" ? "/ pax" : "global"}
                  </TableCell>
                  <TableCell className="text-right tabular">{l.quantite}</TableCell>
                  <TableCell className="text-right tabular">
                    {l.devise} {l.montant_devise.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {l.taux_change_vers_eur.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatEUR(ligneCoutEur(l, cot.nombre_pax))}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular">
                    {l.pct_acompte_1}/{l.pct_acompte_2}/{l.pct_acompte_3}/{l.pct_solde}
                  </TableCell>
                  <TableCell>
                    {canWrite && !isLocked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => supprimerLigne(l.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Optimisation FX */}
      <FxOptimizerBlock
        cotationId={cot.id}
        lignes={lignesCot}
        nombrePax={cot.nombre_pax}
        canWrite={canWrite && !isLocked}
        onApplied={refetchLignes}
      />

      {/* Bloc Options & deadlines */}
      <CotationOptionsBlock
        cot={cot}
        lignes={lignesCot}
        client={client}
        canWrite={canWrite && !isLocked}
        onChange={refetchCot}
        acompteClientRecu={acompteClientRecu}
      />

      {/* Dialog ajout ligne */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle ligne fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Nom fournisseur *">
                <Input
                  value={ligneForm.nom_fournisseur}
                  onChange={(e) =>
                    setLigneForm({
                      ...ligneForm,
                      nom_fournisseur: e.target.value,
                    })
                  }
                  placeholder="Sélectionnez via 'Lier' ou tapez ici"
                />
              </Field>
              <Field label="Lier à un fournisseur">
                <Select
                  value={ligneForm.fournisseur_id}
                  onValueChange={(v) => {
                    const c = fournisseurs.find((x) => x.id === v);
                    // Cherche la condition principale du fournisseur (sinon la première)
                    const conds = fournisseurConditions.filter(
                      (fc: { fournisseur_id: string }) => fc.fournisseur_id === v,
                    );
                    const cond =
                      conds.find((fc: { est_principale: boolean }) => fc.est_principale) ??
                      conds[0];
                    const devisesAcc: string[] = cond?.devises_acceptees ?? [];
                    const nextDevise =
                      devisesAcc.length > 0 && devisesAcc.includes(ligneForm.devise)
                        ? ligneForm.devise
                        : (devisesAcc[0] as DeviseCode | undefined) ?? ligneForm.devise;
                    setLigneForm({
                      ...ligneForm,
                      fournisseur_id: v,
                      nom_fournisseur:
                        ligneForm.nom_fournisseur || c?.nom || "",
                      devise: nextDevise as DeviseCode,
                      pct_acompte_1: cond ? String(cond.pct_acompte_1 ?? 30) : ligneForm.pct_acompte_1,
                      pct_acompte_2: cond ? String(cond.pct_acompte_2 ?? 0) : ligneForm.pct_acompte_2,
                      pct_acompte_3: cond ? String(cond.pct_acompte_3 ?? 0) : ligneForm.pct_acompte_3,
                      pct_solde: cond ? String(cond.pct_solde ?? 70) : ligneForm.pct_solde,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {fournisseurs.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prestation">
                <Input
                  value={ligneForm.prestation}
                  onChange={(e) =>
                    setLigneForm({ ...ligneForm, prestation: e.target.value })
                  }
                />
              </Field>
              {/* Champ "payeur" supprimé : par défaut l'agence règle le fournisseur */}
              <Field label="Mode tarifaire">
                <Select
                  value={ligneForm.mode_tarifaire}
                  onValueChange={(v) =>
                    setLigneForm({
                      ...ligneForm,
                      mode_tarifaire: v as CotationLigneModeTarifaire,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="par_personne">Par personne</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quantité">
                <Input
                  type="number"
                  step="1"
                  value={ligneForm.quantite}
                  onChange={(e) =>
                    setLigneForm({ ...ligneForm, quantite: e.target.value })
                  }
                />
              </Field>
              <Field label="Devise">
                <Select
                  value={ligneForm.devise}
                  onValueChange={(v) =>
                    setLigneForm({
                      ...ligneForm,
                      devise: v as DeviseCode,
                      couverture_id: "",
                      source_fx: "taux_du_jour",
                      taux_change_vers_eur: v === "EUR" ? "1" : ligneForm.taux_change_vers_eur,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVISES.map((d) => (
                      <SelectItem key={d.code} value={d.code}>
                        {d.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Montant devise">
                <Input
                  type="number"
                  step="0.01"
                  value={ligneForm.montant_devise}
                  onChange={(e) =>
                    setLigneForm({
                      ...ligneForm,
                      montant_devise: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Taux → EUR">
                <Input
                  type="number"
                  step="0.0001"
                  value={ligneForm.taux_change_vers_eur}
                  onChange={(e) =>
                    setLigneForm({
                      ...ligneForm,
                      taux_change_vers_eur: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Date prestation">
                <Input
                  type="date"
                  value={ligneForm.date_prestation}
                  onChange={(e) =>
                    setLigneForm({
                      ...ligneForm,
                      date_prestation: e.target.value,
                    })
                  }
                />
              </Field>
            </div>

            {fxEnabled && (
              <InlineFxCoveragePicker
                devise={ligneForm.devise}
                montantDevise={
                  Number(ligneForm.montant_devise) *
                  Number(ligneForm.quantite || 1) *
                  (ligneForm.mode_tarifaire === "par_personne"
                    ? Math.max(1, cot.nombre_pax)
                    : 1)
                }
                selectedCoverageId={ligneForm.couverture_id || null}
                onPick={({ coverage, taux }) =>
                  setLigneForm({
                    ...ligneForm,
                    couverture_id: coverage.id,
                    source_fx: "couverture",
                    taux_change_vers_eur: String(taux),
                  })
                }
              />
            )}
            <div className="border-t pt-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Échéances (% du montant)
              </Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {(
                  [
                    ["pct_acompte_1", "Acompte 1", "date_acompte_1"],
                    ["pct_acompte_2", "Acompte 2", "date_acompte_2"],
                    ["pct_acompte_3", "Acompte 3", "date_acompte_3"],
                    ["pct_solde", "Solde", "date_solde"],
                  ] as const
                ).map(([k, label, dateKey]) => (
                  <div key={k}>
                    <Label className="text-xs">{label} %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={ligneForm[k]}
                      onChange={(e) =>
                        setLigneForm({ ...ligneForm, [k]: e.target.value })
                      }
                    />
                    <Input
                      type="date"
                      className="mt-1"
                      value={ligneForm[dateKey]}
                      onChange={(e) =>
                        setLigneForm({
                          ...ligneForm,
                          [dateKey]: e.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                La somme doit faire 100%.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Annuler
              </Button>
              <Button onClick={ajouterLigne} disabled={submittingLigne}>
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog perte */}
      <Dialog open={perteOpen} onOpenChange={setPerteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme perdue</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Raison (optionnel)</Label>
            <Textarea
              rows={3}
              value={raisonPerte}
              onChange={(e) => setRaisonPerte(e.target.value)}
              placeholder="Prix trop élevé, dates non disponibles…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPerteOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={marquerPerdue}>
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette cotation&nbsp;?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cette action est <strong>irréversible</strong>. Toutes les étapes,
              lignes prix fournisseurs, options de vols et liens publics liés
              seront supprimés.
            </p>
            {cot.dossier_id && (
              <p className="text-sm text-destructive">
                Cette cotation a déjà été transformée en dossier — la suppression est bloquée.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Annuler</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting || !!cot.dossier_id}>
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog nouvelle version */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle version de la cotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Nom de la version (optionnel)">
              <Input
                value={dupForm.versionLabel}
                onChange={(e) => setDupForm({ ...dupForm, versionLabel: e.target.value })}
                placeholder="ex. Premium, Court séjour, Sans vols…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date de départ">
                <Input type="date" value={dupForm.newDateDepart}
                  onChange={(e) => setDupForm({ ...dupForm, newDateDepart: e.target.value })} />
              </Field>
              <Field label="Date de retour">
                <Input type="date" value={dupForm.newDateRetour}
                  onChange={(e) => setDupForm({ ...dupForm, newDateRetour: e.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Si tu changes la date de départ, les dates des étapes, prestations
              et échéances fournisseurs seront décalées automatiquement du même
              nombre de jours.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDuplicateOpen(false)} disabled={duplicating}>Annuler</Button>
              <Button onClick={confirmDuplicate} disabled={duplicating}>
                {duplicating ? "Création…" : "Créer la version"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {(() => {
        const versions = cotations
          .filter((c) => c.group_id === cot.group_id)
          .sort((a, b) => b.version_number - a.version_number);
        if (versions.length <= 1) return null;
        return (
          <Card className="p-4">
            <h3 className="font-display text-lg mb-3">Historique des versions</h3>
            <ul className="space-y-2 text-sm">
              {versions.map((v) => {
                const f = computeCotationFinance(v, lignes);
                return (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-medium">v{v.version_number}</span>
                      <Badge
                        variant="outline"
                        className={`ml-2 ${TONE_CLASS[COTATION_STATUT_TONES[v.statut]]}`}
                      >
                        {COTATION_STATUT_LABELS[v.statut]}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground tabular">
                      {formatEUR(f.prixVente)} · marge {formatEUR(f.margeNette)}
                    </div>
                    {v.id !== cot.id && (
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/cotations/$id" params={{ id: v.id }}>
                          Voir
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })()}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

// silence unused var lint for CotationStatut import (kept for future use)
export type _kept = CotationStatut;
