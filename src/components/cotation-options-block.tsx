import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTable, type Contact } from "@/hooks/use-data";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import {
  AlertTriangle,
  Mail,
  Plane,
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  Send,
  Layers,
  Upload,
  Sparkles,
} from "lucide-react";
import {
  FOURN_OPTION_STATUT_LABELS,
  FOURN_OPTION_STATUT_TONES,
  FLIGHT_OPTION_STATUT_LABELS,
  FLIGHT_OPTION_STATUT_TONES,
  buildFournisseurOptionEmail,
  buildFlightOptionEmail,
  deadlineUrgence,
  formatDeadline,
  formatTimeRemaining,
  type FournisseurOption,
  type FournisseurOptionStatut,
  type FlightOption,
  type FlightOptionStatut,
  type EmailDraft,
} from "@/lib/options";
import { EmailDraftModal } from "@/components/email-draft-modal";
import { FlightSegmentsDialog } from "@/components/flight-segments-dialog";
import { useAgencySettings } from "@/hooks/use-agency-settings";
import { appendSignature } from "@/lib/agency-settings";
import type { Cotation, CotationLigne } from "@/lib/cotations";
import { ligneCoutEur } from "@/lib/cotations";
import { formatEUR } from "@/lib/format";
import { DEVISES, type DeviseCode } from "@/lib/fx";

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-secondary text-muted-foreground border-border",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  muted: "bg-muted text-muted-foreground border-border",
};

type Props = {
  cot: Cotation;
  lignes: CotationLigne[];
  client: Contact | undefined;
  canWrite: boolean;
  onChange: () => void;
  /** Si un acompte client a été enregistré (sur le dossier issu de la cotation) */
  acompteClientRecu?: boolean;
};

export function CotationOptionsBlock({ cot, lignes, client, canWrite, onChange, acompteClientRecu }: Props) {
  const { user } = useAuth();
  const { data: foAll, refetch: refetchFo } = useTable<FournisseurOption>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "fournisseur_options" as any,
  );
  const { data: flAll, refetch: refetchFl } = useTable<FlightOption>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "flight_options" as any,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: segAll } = useTable<{ id: string; flight_option_id: string }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "flight_segments" as any,
  );

  const fournisseurOptions = useMemo(
    () => foAll.filter((o) => o.cotation_id === cot.id),
    [foAll, cot.id],
  );
  const flightOptions = useMemo(
    () => flAll.filter((o) => o.cotation_id === cot.id),
    [flAll, cot.id],
  );

  // Email draft modal
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [draftMeta, setDraftMeta] = useState<{
    entity: "fournisseur_option" | "flight_option";
    entityId: string;
    kind: string;
  } | null>(null);

  const { settings: agency } = useAgencySettings();

  const openDraft = (
    title: string,
    d: EmailDraft,
    meta: { entity: "fournisseur_option" | "flight_option"; entityId: string; kind: string },
  ) => {
    setDraftTitle(title);
    setDraft({ ...d, body: appendSignature(d.body, agency) });
    setDraftMeta(meta);
    setDraftOpen(true);
  };

  const onDraftSent = (final: EmailDraft) => {
    if (!user || !draftMeta) return;
    void logAudit({
      userId: user.id,
      entity: draftMeta.entity,
      entityId: draftMeta.entityId,
      action: "update",
      description: `Email généré : ${draftMeta.kind} → ${final.to || "(sans destinataire)"}`,
      newValue: { subject: final.subject },
    });
  };

  // -------------------- Fournisseur option actions --------------------
  const [foAddOpen, setFoAddOpen] = useState(false);
  const [foForm, setFoForm] = useState({
    nom_fournisseur: "",
    email_fournisseur: "",
    prestation: "",
    ligne_fournisseur_id: "",
    deadline_option_date: "",
    deadline_option_time: "18:00",
    notes: "",
  });

  const ajouterOption = async () => {
    if (!user) return;
    if (!foForm.nom_fournisseur.trim()) return toast.error("Nom fournisseur requis.");
    const ligne = lignes.find((l) => l.id === foForm.ligne_fournisseur_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase as any)
      .from("fournisseur_options")
      .insert({
        user_id: user.id,
        cotation_id: cot.id,
        ligne_fournisseur_id: foForm.ligne_fournisseur_id || null,
        fournisseur_id: ligne?.fournisseur_id ?? null,
        nom_fournisseur: foForm.nom_fournisseur.trim(),
        email_fournisseur: foForm.email_fournisseur.trim() || null,
        prestation: foForm.prestation.trim() || ligne?.prestation || null,
        statut: "a_demander",
        deadline_option_date: foForm.deadline_option_date || null,
        deadline_option_time: foForm.deadline_option_time || null,
        notes: foForm.notes.trim() || null,
      })
      .select()
      .single();
    if (error || !created) return toast.error(error?.message ?? "Erreur");
    await logAudit({
      userId: user.id,
      entity: "fournisseur_option",
      entityId: created.id,
      action: "create",
      description: `Option fournisseur créée : ${created.nom_fournisseur}`,
    });
    setFoAddOpen(false);
    setFoForm({
      nom_fournisseur: "",
      email_fournisseur: "",
      prestation: "",
      ligne_fournisseur_id: "",
      deadline_option_date: "",
      deadline_option_time: "18:00",
      notes: "",
    });
    refetchFo();
    onChange();
    toast.success("Option ajoutée.");
  };

  const generateLignesEnOptions = async () => {
    if (!user) return;
    if (lignes.length === 0) return toast.error("Aucune ligne fournisseur.");
    const existing = new Set(fournisseurOptions.map((o) => o.ligne_fournisseur_id));
    const toCreate = lignes.filter((l) => !existing.has(l.id));
    if (toCreate.length === 0) {
      return toast.info("Toutes les lignes ont déjà une option.");
    }
    const fournisseurs = await getFournisseurContacts();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("fournisseur_options").insert(
      toCreate.map((l) => {
        const c = fournisseurs.find((x) => x.id === l.fournisseur_id);
        return {
          user_id: user.id,
          cotation_id: cot.id,
          ligne_fournisseur_id: l.id,
          fournisseur_id: l.fournisseur_id,
          nom_fournisseur: l.nom_fournisseur,
          email_fournisseur: c?.email ?? null,
          prestation: l.prestation,
          statut: "a_demander" as const,
        };
      }),
    );
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "update",
      description: `Passage en option : ${toCreate.length} option(s) fournisseur créée(s)`,
    });
    refetchFo();
    onChange();
    toast.success(`${toCreate.length} option(s) créée(s).`);
  };

  const passerEnOption = async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("cotations")
      .update({ statut: "en_option" })
      .eq("id", cot.id);
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "update",
      description: `Cotation passée en option`,
    });
    await generateLignesEnOptions();
  };

  const getFournisseurContacts = async (): Promise<Contact[]> => {
    const { data } = await supabase.from("contacts").select("*").eq("type", "fournisseur");
    return (data ?? []) as Contact[];
  };

  const updateOption = async (
    id: string,
    patch: Partial<FournisseurOption>,
    desc: string,
  ) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("fournisseur_options")
      .update(patch)
      .eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "fournisseur_option",
      entityId: id,
      action: "update",
      description: desc,
    });
    refetchFo();
  };

  const deleteOption = async (id: string) => {
    if (!user) return;
    if (!confirm("Supprimer cette option ?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("fournisseur_options").delete().eq("id", id);
    await logAudit({
      userId: user.id,
      entity: "fournisseur_option",
      entityId: id,
      action: "delete",
      description: "Option fournisseur supprimée",
    });
    refetchFo();
  };

  const genererEmailFo = (
    o: FournisseurOption,
    kind:
      | "demande_option_fournisseur"
      | "confirmation_fournisseur"
      | "annulation_option_fournisseur",
  ) => {
    const ligne = lignes.find((l) => l.id === o.ligne_fournisseur_id);
    const montantEur = ligne ? formatEUR(ligneCoutEur(ligne, cot.nombre_pax)) : undefined;
    const d = buildFournisseurOptionEmail(kind, {
      cot,
      client,
      option: o,
      ligne,
      montantEurDisplay: montantEur,
    });
    openDraft(`Email — ${o.nom_fournisseur}`, d, {
      entity: "fournisseur_option",
      entityId: o.id,
      kind,
    });
  };

  // -------------------- Actions en lot --------------------
  const confirmerToutesOptions = async () => {
    if (!user) return;
    const aConfirmer = fournisseurOptions.filter(
      (o) => o.statut === "option_confirmee" || o.statut === "demandee",
    );
    if (aConfirmer.length === 0) return toast.info("Aucune option à confirmer.");
    if (!confirm(`Marquer ${aConfirmer.length} option(s) comme confirmée(s) ? Vous pourrez ensuite générer les emails de confirmation.`)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("fournisseur_options")
      .update({ statut: "confirmee" })
      .in("id", aConfirmer.map((o) => o.id));
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "validate",
      description: `${aConfirmer.length} option(s) fournisseur confirmée(s) suite à acompte client`,
    });
    refetchFo();
    toast.success(`${aConfirmer.length} option(s) confirmée(s).`);
  };

  const annulerToutesOptions = async () => {
    if (!user) return;
    const aAnnuler = fournisseurOptions.filter((o) => o.statut !== "annulee" && o.statut !== "option_refusee");
    const flAnnuler = flightOptions.filter((f) => f.statut !== "annulee");
    if (aAnnuler.length === 0 && flAnnuler.length === 0) return toast.info("Aucune option active à annuler.");
    if (!confirm(`Annuler ${aAnnuler.length} option(s) fournisseur et ${flAnnuler.length} option(s) vol ?`)) return;
    if (aAnnuler.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("fournisseur_options").update({ statut: "annulee" }).in("id", aAnnuler.map((o) => o.id));
    }
    if (flAnnuler.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("flight_options").update({ statut: "annulee" }).in("id", flAnnuler.map((f) => f.id));
    }
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "reject",
      description: `${aAnnuler.length + flAnnuler.length} option(s) annulée(s)`,
    });
    refetchFo();
    refetchFl();
    toast.success("Options annulées. Générez les emails d'annulation pour informer les fournisseurs.");
  };

  // -------------------- Flight options --------------------
  const [flAddOpen, setFlAddOpen] = useState(false);
  const [segmentsOpenFor, setSegmentsOpenFor] = useState<{
    id: string;
    compagnie: string;
    date_depart?: string | null;
    heure_depart?: string | null;
    date_retour?: string | null;
    heure_retour?: string | null;
  } | null>(null);
  const [flEmailTo, setFlEmailTo] = useState("");
  const [flForm, setFlForm] = useState({
    compagnie: "",
    routing: "",
    numero_vol: "",
    date_depart: "",
    heure_depart: "",
    date_retour: "",
    heure_retour: "",
    prix: "0",
    devise: "EUR" as DeviseCode,
    deadline_option_date: "",
    deadline_option_time: "18:00",
    notes: "",
  });

  const ajouterFlight = async () => {
    if (!user) return;
    if (!flForm.compagnie.trim() || !flForm.routing.trim()) {
      return toast.error("Compagnie et routing requis.");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase as any)
      .from("flight_options")
      .insert({
        user_id: user.id,
        cotation_id: cot.id,
        compagnie: flForm.compagnie.trim(),
        routing: flForm.routing.trim(),
        numero_vol: flForm.numero_vol.trim() || null,
        date_depart: flForm.date_depart || null,
        heure_depart: flForm.heure_depart || null,
        date_retour: flForm.date_retour || null,
        heure_retour: flForm.heure_retour || null,
        prix: Number(flForm.prix) || 0,
        devise: flForm.devise,
        deadline_option_date: flForm.deadline_option_date || null,
        deadline_option_time: flForm.deadline_option_time || null,
        statut: "en_option" as const,
        notes: flForm.notes.trim() || null,
      })
      .select()
      .single();
    if (error || !created) return toast.error(error?.message ?? "Erreur");
    await logAudit({
      userId: user.id,
      entity: "flight_option",
      entityId: created.id,
      action: "create",
      description: `Option vol créée : ${created.compagnie} ${created.routing}`,
    });
    setFlAddOpen(false);
    setFlForm({
      compagnie: "",
      routing: "",
      numero_vol: "",
      date_depart: "",
      heure_depart: "",
      date_retour: "",
      heure_retour: "",
      prix: "0",
      devise: "EUR",
      deadline_option_date: "",
      deadline_option_time: "18:00",
      notes: "",
    });
    refetchFl();
    toast.success("Option vol ajoutée.");
  };

  const updateFlight = async (id: string, patch: Partial<FlightOption>, desc: string) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("flight_options")
      .update(patch)
      .eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "flight_option",
      entityId: id,
      action: "update",
      description: desc,
    });
    refetchFl();
  };

  const deleteFlight = async (id: string) => {
    if (!user) return;
    if (!confirm("Supprimer cette option vol ?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("flight_options").delete().eq("id", id);
    await logAudit({
      userId: user.id,
      entity: "flight_option",
      entityId: id,
      action: "delete",
      description: "Option vol supprimée",
    });
    refetchFl();
  };

  // ----- Import capture d'écran : crée un vol + ses segments en un clic -----
  const flImportInputRef = useRef<HTMLInputElement | null>(null);
  const [flImporting, setFlImporting] = useState(false);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Lecture image impossible"));
      reader.readAsDataURL(file);
    });

  const importerVolDepuisCapture = async (file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("Image trop lourde (max 8 Mo).");
    setFlImporting(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const { data, error } = await supabase.functions.invoke("extract-flights", {
        body: { imageDataUrl },
      });
      if (error) throw error;
      const extracted = (data?.segments ?? []) as Array<{
        compagnie?: string;
        numero_vol?: string;
        aeroport_depart?: string;
        aeroport_arrivee?: string;
        date_depart?: string;
        heure_depart?: string;
        date_arrivee?: string;
        heure_arrivee?: string;
      }>;
      if (extracted.length === 0) {
        toast.warning("Aucun vol détecté sur cette image.");
        return;
      }
      const first = extracted[0];
      const last = extracted[extracted.length - 1];
      const compagnie = (first.compagnie || "").toUpperCase().trim() || "—";
      const routing = extracted
        .map((s, i) =>
          i === 0
            ? `${(s.aeroport_depart || "").toUpperCase()} → ${(s.aeroport_arrivee || "").toUpperCase()}`
            : `→ ${(s.aeroport_arrivee || "").toUpperCase()}`,
        )
        .join(" ");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created, error: errFl } = await (supabase as any)
        .from("flight_options")
        .insert({
          user_id: user.id,
          cotation_id: cot.id,
          compagnie,
          routing,
          numero_vol: null,
          date_depart: first.date_depart || null,
          heure_depart: first.heure_depart || null,
          date_retour: last.date_arrivee || null,
          heure_retour: last.heure_arrivee || null,
          prix: 0,
          devise: "EUR",
          statut: "en_option" as const,
        })
        .select()
        .single();
      if (errFl || !created) throw errFl ?? new Error("Création vol impossible.");

      const segPayload = extracted.map((seg, i) => ({
        user_id: user.id,
        flight_option_id: created.id,
        ordre: i + 1,
        compagnie: (seg.compagnie || compagnie || "").toUpperCase().trim() || null,
        numero_vol: seg.numero_vol?.toUpperCase().trim() || null,
        aeroport_depart: (seg.aeroport_depart || "").toUpperCase().trim(),
        aeroport_arrivee: (seg.aeroport_arrivee || "").toUpperCase().trim(),
        date_depart: seg.date_depart || null,
        heure_depart: seg.heure_depart || null,
        date_arrivee: seg.date_arrivee || null,
        heure_arrivee: seg.heure_arrivee || null,
        duree_escale_minutes: null,
        notes: null,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: errSeg } = await (supabase as any).from("flight_segments").insert(segPayload);
      if (errSeg) throw errSeg;

      await logAudit({
        userId: user.id,
        entity: "flight_option",
        entityId: created.id,
        action: "create",
        description: `Vol créé via import capture : ${compagnie} ${routing} (${segPayload.length} segment(s))`,
      });
      refetchFl();
      onChange();
      toast.success(`Vol créé avec ${segPayload.length} segment(s).`);
    } catch (e) {
      console.error("[import vol depuis capture]", e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse de l'image.");
    } finally {
      setFlImporting(false);
      if (flImportInputRef.current) flImportInputRef.current.value = "";
    }
  };

  const genererEmailFlight = (
    f: FlightOption,
    kind: "demande_option_vol" | "confirmation_vol" | "annulation_option_vol",
  ) => {
    const d = buildFlightOptionEmail(kind, { cot, client, flight: f, to: flEmailTo });
    openDraft(`Email — ${f.compagnie} ${f.routing}`, d, {
      entity: "flight_option",
      entityId: f.id,
      kind,
    });
  };

  // -------------------- Alertes globales --------------------
  const alerts: { tone: "danger" | "warn"; msg: string }[] = [];
  const allDeadlines = [
    ...fournisseurOptions
      .filter((o) => o.statut === "demandee" || o.statut === "option_confirmee")
      .map((o) => ({
        urg: deadlineUrgence(o.deadline_option_date, o.deadline_option_time),
        label: o.nom_fournisseur,
      })),
    ...flightOptions
      .filter((f) => f.statut === "en_option")
      .map((f) => ({
        urg: deadlineUrgence(f.deadline_option_date, f.deadline_option_time),
        label: `${f.compagnie} ${f.routing}`,
      })),
  ];
  const expired = allDeadlines.filter((d) => d.urg === "expired");
  const critical = allDeadlines.filter((d) => d.urg === "critical");
  if (expired.length > 0) {
    alerts.push({
      tone: "danger",
      msg: `${expired.length} option(s) avec deadline dépassée : ${expired.map((d) => d.label).join(", ")}`,
    });
  }
  if (critical.length > 0) {
    alerts.push({
      tone: "warn",
      msg: `${critical.length} option(s) expirent dans moins de 24 h : ${critical.map((d) => d.label).join(", ")}`,
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-lg">Options &amp; deadlines</h3>
          <p className="text-xs text-muted-foreground">
            Suivi des options fournisseurs et vols, avec emails prêts à envoyer.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2 flex-wrap">
            {cot.statut !== "en_option" &&
              cot.statut !== "transformee_en_dossier" &&
              cot.statut !== "perdue" &&
              cot.statut !== "annulee" && (
                <Button size="sm" variant="default" onClick={passerEnOption}>
                  <Send className="h-4 w-4 mr-1" /> Passer en option
                </Button>
              )}
            {acompteClientRecu && fournisseurOptions.length > 0 && (
              <Button size="sm" variant="default" onClick={confirmerToutesOptions} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmer fournisseurs (acompte reçu)
              </Button>
            )}
            {(cot.statut === "perdue" || cot.statut === "annulee") &&
              (fournisseurOptions.some((o) => o.statut !== "annulee" && o.statut !== "option_refusee") ||
                flightOptions.some((f) => f.statut !== "annulee")) && (
                <Button size="sm" variant="destructive" onClick={annulerToutesOptions}>
                  <XCircle className="h-4 w-4 mr-1" /> Annuler toutes les options
                </Button>
              )}
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="px-4 pt-4 space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-sm p-2 rounded border ${
                a.tone === "danger"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {acompteClientRecu && fournisseurOptions.some((o) => o.statut !== "confirmee" && o.statut !== "annulee") && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 text-sm p-2 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Acompte client reçu — confirmez les fournisseurs et envoyez-leur les emails de confirmation.
          </div>
        </div>
      )}

      {/* Options fournisseurs */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">
            Options fournisseurs
          </h4>
          {canWrite && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={generateLignesEnOptions}>
                Générer depuis lignes
              </Button>
              <Button size="sm" onClick={() => setFoAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            </div>
          )}
        </div>

        {fournisseurOptions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Aucune option fournisseur.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Prestation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Restant</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fournisseurOptions.map((o) => {
                const urg = deadlineUrgence(o.deadline_option_date, o.deadline_option_time);
                const tone = FOURN_OPTION_STATUT_TONES[o.statut];
                return (
                  <TableRow key={o.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{o.nom_fournisseur}</div>
                      {o.email_fournisseur && (
                        <div className="text-xs text-muted-foreground">{o.email_fournisseur}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.prestation ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TONE_CLASS[tone]}>
                        {FOURN_OPTION_STATUT_LABELS[o.statut]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDeadline(o.deadline_option_date, o.deadline_option_time)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span
                        className={
                          urg === "expired"
                            ? "text-destructive font-medium"
                            : urg === "critical"
                              ? "text-amber-600 dark:text-amber-400 font-medium"
                              : "text-muted-foreground"
                        }
                      >
                        {formatTimeRemaining(o.deadline_option_date, o.deadline_option_time)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => genererEmailFo(o, "demande_option_fournisseur")}
                          title="Générer email demande"
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                        {canWrite && (
                          <>
                            <Select
                              value={o.statut}
                              onValueChange={(v) =>
                                updateOption(
                                  o.id,
                                  { statut: v as FournisseurOptionStatut },
                                  `Statut → ${FOURN_OPTION_STATUT_LABELS[v as FournisseurOptionStatut]}`,
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-[150px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(
                                  Object.keys(
                                    FOURN_OPTION_STATUT_LABELS,
                                  ) as FournisseurOptionStatut[]
                                ).map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {FOURN_OPTION_STATUT_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => genererEmailFo(o, "confirmation_fournisseur")}
                              title="Email confirmation"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => genererEmailFo(o, "annulation_option_fournisseur")}
                              title="Email annulation"
                            >
                              <XCircle className="h-3 w-3 text-destructive" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteOption(o.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Options vols */}
      <div className="p-4 border-t space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Plane className="h-4 w-4" /> Options vols
          </h4>
          {canWrite && (
            <div className="flex items-center gap-2">
              <input
                ref={flImportInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importerVolDepuisCapture(f);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => flImportInputRef.current?.click()}
                disabled={flImporting}
                title="Importer une capture d'écran (Amadeus, GDS, mail compagnie…)"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {flImporting ? "Analyse…" : "Importer capture"}
              </Button>
              <Button size="sm" onClick={() => setFlAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter un vol
              </Button>
            </div>
          )}
        </div>

        {flightOptions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Aucune option vol.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Email destinataire vols :</Label>
              <Input
                type="email"
                value={flEmailTo}
                onChange={(e) => setFlEmailTo(e.target.value)}
                placeholder="contact@compagnie.com"
                className="h-8 text-sm"
              />
            </div>
            <div className="text-xs text-muted-foreground bg-muted/40 border border-dashed rounded px-3 py-2">
              💡 <strong>1 option = 1 vol complet (aller-retour ou aller simple).</strong> Pour un vol avec escale(s), créez UNE seule option puis cliquez sur <strong>« Segments »</strong> pour saisir chaque tronçon (MRS→ADD, ADD→WDH…) avec ses horaires et durées d'escale.
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vol</TableHead>
                  <TableHead>Routing</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flightOptions.map((f) => {
                  const urg = deadlineUrgence(f.deadline_option_date, f.deadline_option_time);
                  const tone = FLIGHT_OPTION_STATUT_TONES[f.statut];
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{f.compagnie}</div>
                        {f.numero_vol && (
                          <div className="text-xs text-muted-foreground">{f.numero_vol}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{f.routing}</TableCell>
                      <TableCell className="text-xs">
                        {f.date_depart ?? "—"}
                        {f.heure_depart ? ` ${f.heure_depart.slice(0, 5)}` : ""}
                        {f.date_retour ? ` → ${f.date_retour}` : ""}
                      </TableCell>
                      <TableCell className="text-right tabular text-sm">
                        {f.prix} {f.devise}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TONE_CLASS[tone]}>
                          {FLIGHT_OPTION_STATUT_LABELS[f.statut]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{formatDeadline(f.deadline_option_date, f.deadline_option_time)}</div>
                        <div
                          className={
                            urg === "expired"
                              ? "text-destructive font-medium"
                              : urg === "critical"
                                ? "text-amber-600 dark:text-amber-400 font-medium"
                                : "text-muted-foreground"
                          }
                        >
                          {formatTimeRemaining(f.deadline_option_date, f.deadline_option_time)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => genererEmailFlight(f, "demande_option_vol")}
                            title="Email demande"
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                          {(() => {
                            const segCount = segAll.filter((s) => s.flight_option_id === f.id).length;
                            return (
                              <Button
                                size="sm"
                                variant={segCount > 0 ? "default" : "outline"}
                                onClick={() =>
                                  setSegmentsOpenFor({
                                    id: f.id,
                                    compagnie: f.compagnie,
                                    date_depart: f.date_depart,
                                    heure_depart: f.heure_depart,
                                    date_retour: f.date_retour,
                                    heure_retour: f.heure_retour,
                                  })
                                }
                                title={segCount > 0 ? `${segCount} segment(s) - éditer` : "Détailler les segments / escales"}
                                className="h-8 gap-1 text-xs"
                              >
                                <Layers className="h-3 w-3" />
                                {segCount > 0 ? `${segCount} seg.` : "Segments"}
                              </Button>
                            );
                          })()}
                          {canWrite && (
                            <>
                              <Select
                                value={f.statut}
                                onValueChange={(v) =>
                                  updateFlight(
                                    f.id,
                                    { statut: v as FlightOptionStatut },
                                    `Statut vol → ${FLIGHT_OPTION_STATUT_LABELS[v as FlightOptionStatut]}`,
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 w-[120px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(
                                    Object.keys(
                                      FLIGHT_OPTION_STATUT_LABELS,
                                    ) as FlightOptionStatut[]
                                  ).map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {FLIGHT_OPTION_STATUT_LABELS[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => genererEmailFlight(f, "confirmation_vol")}
                                title="Email confirmation"
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => genererEmailFlight(f, "annulation_option_vol")}
                                title="Email annulation"
                              >
                                <XCircle className="h-3 w-3 text-destructive" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteFlight(f.id)}
                                title="Supprimer"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </div>

      {/* Add fournisseur option */}
      <Dialog open={foAddOpen} onOpenChange={setFoAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle option fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Lier à une ligne fournisseur</Label>
              <Select
                value={foForm.ligne_fournisseur_id || "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    setFoForm({ ...foForm, ligne_fournisseur_id: "" });
                    return;
                  }
                  const l = lignes.find((x) => x.id === v);
                  setFoForm({
                    ...foForm,
                    ligne_fournisseur_id: v,
                    nom_fournisseur: l?.nom_fournisseur ?? foForm.nom_fournisseur,
                    prestation: l?.prestation ?? foForm.prestation,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune (option libre)</SelectItem>
                  {lignes.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nom_fournisseur} — {l.prestation ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nom fournisseur *</Label>
                <Input
                  value={foForm.nom_fournisseur}
                  onChange={(e) => setFoForm({ ...foForm, nom_fournisseur: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Email fournisseur</Label>
                <Input
                  type="email"
                  value={foForm.email_fournisseur}
                  onChange={(e) => setFoForm({ ...foForm, email_fournisseur: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Prestation</Label>
                <Input
                  value={foForm.prestation}
                  onChange={(e) => setFoForm({ ...foForm, prestation: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Deadline date</Label>
                <Input
                  type="date"
                  value={foForm.deadline_option_date}
                  onChange={(e) =>
                    setFoForm({ ...foForm, deadline_option_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Heure</Label>
                <Input
                  type="time"
                  value={foForm.deadline_option_time}
                  onChange={(e) =>
                    setFoForm({ ...foForm, deadline_option_time: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  rows={2}
                  value={foForm.notes}
                  onChange={(e) => setFoForm({ ...foForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFoAddOpen(false)}>
                Annuler
              </Button>
              <Button onClick={ajouterOption}>Ajouter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add flight */}
      <Dialog open={flAddOpen} onOpenChange={setFlAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle option vol</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Compagnie *</Label>
                <Input
                  value={flForm.compagnie}
                  onChange={(e) => setFlForm({ ...flForm, compagnie: e.target.value })}
                  placeholder="Air France"
                />
              </div>
              <div>
                <Label className="text-xs">Routing *</Label>
                <Input
                  value={flForm.routing}
                  onChange={(e) => setFlForm({ ...flForm, routing: e.target.value })}
                  placeholder="CDG → JFK → CDG"
                />
              </div>
              <div>
                <Label className="text-xs">N° vol</Label>
                <Input
                  value={flForm.numero_vol}
                  onChange={(e) => setFlForm({ ...flForm, numero_vol: e.target.value })}
                  placeholder="AF006"
                />
              </div>
              <div>
                <Label className="text-xs">Prix total ({cot.nombre_pax} pax)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={flForm.prix}
                    onChange={(e) => setFlForm({ ...flForm, prix: e.target.value })}
                  />
                  <Select
                    value={flForm.devise}
                    onValueChange={(v) => setFlForm({ ...flForm, devise: v as DeviseCode })}
                  >
                    <SelectTrigger className="w-[100px]">
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
                </div>
              </div>
              <div>
                <Label className="text-xs">Date départ</Label>
                <Input
                  type="date"
                  value={flForm.date_depart}
                  onChange={(e) => setFlForm({ ...flForm, date_depart: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Heure départ</Label>
                <Input
                  type="time"
                  value={flForm.heure_depart}
                  onChange={(e) => setFlForm({ ...flForm, heure_depart: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Date retour</Label>
                <Input
                  type="date"
                  value={flForm.date_retour}
                  onChange={(e) => setFlForm({ ...flForm, date_retour: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Heure retour</Label>
                <Input
                  type="time"
                  value={flForm.heure_retour}
                  onChange={(e) => setFlForm({ ...flForm, heure_retour: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Deadline option date</Label>
                <Input
                  type="date"
                  value={flForm.deadline_option_date}
                  onChange={(e) =>
                    setFlForm({ ...flForm, deadline_option_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Deadline heure</Label>
                <Input
                  type="time"
                  value={flForm.deadline_option_time}
                  onChange={(e) =>
                    setFlForm({ ...flForm, deadline_option_time: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  rows={2}
                  value={flForm.notes}
                  onChange={(e) => setFlForm({ ...flForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFlAddOpen(false)}>
                Annuler
              </Button>
              <Button onClick={ajouterFlight}>Ajouter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EmailDraftModal
        open={draftOpen}
        onOpenChange={setDraftOpen}
        title={draftTitle}
        draft={draft}
        onSent={onDraftSent}
      />

      {segmentsOpenFor && (
        <FlightSegmentsDialog
          open={!!segmentsOpenFor}
          onOpenChange={(v) => !v && setSegmentsOpenFor(null)}
          flightOptionId={segmentsOpenFor.id}
          defaultCompagnie={segmentsOpenFor.compagnie}
          defaultDateDepart={segmentsOpenFor.date_depart ?? null}
          defaultHeureDepart={segmentsOpenFor.heure_depart ?? null}
          defaultDateRetour={segmentsOpenFor.date_retour ?? null}
          defaultHeureRetour={segmentsOpenFor.heure_retour ?? null}
          canWrite={canWrite}
        />
      )}
    </Card>
  );
}
