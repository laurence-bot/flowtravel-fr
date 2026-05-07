import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTable, type Contact } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { usePageWriteAccess } from "@/hooks/use-page-write-access";
import { useEditLock } from "@/hooks/use-edit-lock";
import { EditLockBanner } from "@/components/edit-lock-banner";
import { useAgents, agentLabel } from "@/hooks/use-agents";
import { formatEUR, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { logAudit } from "@/lib/audit";
import { DEMANDE_STATUT_LABELS, DEMANDE_CANAL_LABELS, type Demande, type DemandeStatut } from "@/lib/demandes";
import { StatutPill } from "@/routes/demandes";
import {
  ArrowLeft,
  Mail,
  Phone,
  Save,
  Sparkles,
  XCircle,
  RefreshCw,
  PlayCircle,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/mariages")({
  component: () => (
    <RequireAuth>
      <DemandeDetail />
    </RequireAuth>
  ),
});

function DemandeDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agenceId } = useRole();
  const { canWrite: canWriteRole } = usePageWriteAccess();
  const editLock = useEditLock("demande", id);
  const canWrite = canWriteRole && (editLock.isAlone || editLock.canEdit);
  const { agents } = useAgents();
  const { data: contacts, loading: contactsLoading, refetch: refetchContacts } = useTable<Contact>("contacts");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: demandes, loading: demandesLoading, refetch } = useTable<Demande>("demandes" as any);

  const demande = demandes.find((d) => d.id === id);

  const [notes, setNotes] = useState("");
  const [perteOpen, setPerteOpen] = useState(false);
  const [raisonPerte, setRaisonPerte] = useState("");
  const [transformOpen, setTransformOpen] = useState(false);
  const [transformTitre, setTransformTitre] = useState("");

  useEffect(() => {
    if (demande) {
      setNotes(demande.notes ?? "");
      setTransformTitre(demande.destination ? `Voyage ${demande.destination}` : `Voyage ${demande.nom_client}`);
    }
  }, [demande]);

  if (demandesLoading || contactsLoading) {
    return <div className="text-muted-foreground text-sm">Chargement de la demande…</div>;
  }

  if (!demande) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Demande introuvable.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/demandes">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Link>
        </Button>
      </div>
    );
  }

  const client = contacts.find((c) => c.id === demande.client_id);

  const updateStatut = async (statut: DemandeStatut, raison?: string) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("demandes")
      .update({
        statut,
        raison_perte: statut === "perdue" ? (raison ?? null) : null,
        dernier_contact_at: new Date().toISOString(),
      })
      .eq("id", demande.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      userId: user.id,
      entity: "demande",
      entityId: demande.id,
      action: "update",
      description: `Statut → ${DEMANDE_STATUT_LABELS[statut]}`,
    });
    toast.success("Statut mis à jour.");
    refetch();
  };

  const remettreEnCoursSiCotationSupprimee = async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linked, error: linkedError } = await (supabase as any)
      .from("cotations")
      .select("id")
      .eq("demande_id", demande.id)
      .limit(1);
    if (linkedError) return toast.error(linkedError.message);
    if ((linked ?? []).length > 0) {
      toast.error("Une cotation existe encore pour cette demande.");
      return;
    }
    await updateStatut("en_cours");
  };

  const saveNotes = async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("demandes")
      .update({ notes, dernier_contact_at: new Date().toISOString() })
      .eq("id", demande.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Notes enregistrées.");
    refetch();
  };

  const creerClient = async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase as any)
      .from("contacts")
      .insert({
        user_id: user.id,
        agence_id: agenceId ?? null,
        nom: demande.nom_client,
        type: "client",
        email: demande.email,
        telephone: demande.telephone,
      })
      .select()
      .single();
    if (error || !created) {
      toast.error(error?.message ?? "Erreur");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("demandes").update({ client_id: created.id }).eq("id", demande.id);
    toast.success("Client créé et associé.");
    refetchContacts();
    refetch();
  };

  const transformer = async () => {
    if (!user) return;
    let clientId = demande.client_id;
    // crée le client si nécessaire
    if (!clientId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: c, error: e1 } = await (supabase as any)
        .from("contacts")
        .insert({
          user_id: user.id,
          agence_id: agenceId ?? null,
          nom: demande.nom_client,
          type: "client",
          email: demande.email,
          telephone: demande.telephone,
        })
        .select()
        .single();
      if (e1 || !c) {
        toast.error(e1?.message ?? "Création client impossible");
        return;
      }
      clientId = c.id;
    }
    // crée la cotation pré-remplie
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cot, error: e2 } = await (supabase as any)
      .from("cotations")
      .insert({
        user_id: user.id,
        client_id: clientId,
        titre: transformTitre || `Voyage ${demande.nom_client}`,
        destination: demande.destination,
        date_depart: demande.date_depart_souhaitee,
        date_retour: demande.date_retour_souhaitee,
        nombre_pax: demande.nombre_pax,
        prix_vente_ttc: demande.budget ?? 0,
        statut: "brouillon",
        demande_id: demande.id,
      })
      .select()
      .single();
    if (e2 || !cot) {
      toast.error(e2?.message ?? "Création cotation impossible");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("demandes")
      .update({
        statut: "transformee_en_cotation",
        client_id: clientId,
        dernier_contact_at: new Date().toISOString(),
      })
      .eq("id", demande.id);
    await logAudit({
      userId: user.id,
      entity: "demande",
      entityId: demande.id,
      action: "update",
      description: `Demande transformée en cotation : ${cot.titre}`,
      newValue: { cotation_id: cot.id },
    });
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cot.id,
      action: "create",
      description: `Cotation créée depuis demande : ${cot.titre}`,
    });
    toast.success("Cotation créée.");
    setTransformOpen(false);
    navigate({ to: "/cotations/$id", params: { id: cot.id } });
  };

  const reassignAgent = async (newAgentId: string) => {
    if (!user || !demande) return;
    const oldAgentId = demande.agent_id ?? null;
    if (newAgentId === oldAgentId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("demandes").update({ agent_id: newAgentId }).eq("id", demande.id);
    if (error) return toast.error(error.message);
    const oldName = agentLabel(agents.find((a) => a.user_id === oldAgentId));
    const newName = agentLabel(agents.find((a) => a.user_id === newAgentId));
    await logAudit({
      userId: user.id,
      entity: "demande" as any,
      entityId: demande.id,
      action: "update",
      description: `Agent réassigné : ${oldName} → ${newName}`,
      oldValue: { agent_id: oldAgentId },
      newValue: { agent_id: newAgentId },
    });
    toast.success(`Agent : ${newName}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <EditLockBanner lock={editLock} />
      <PageHeader
        title={demande.nom_client}
        numero={(demande as { numero?: string | null }).numero ?? null}
        description={`Demande créée le ${formatDate(demande.created_at)} · canal ${DEMANDE_CANAL_LABELS[demande.canal]}`}
        action={
          <div className="flex items-center gap-2">
            <StatutPill statut={demande.statut} />
            <Button asChild variant="outline" size="sm">
              <Link to="/demandes">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Link>
            </Button>
          </div>
        }
      />

      <div className="inline-flex items-center gap-2">
        <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Agent responsable :</span>
        <Select value={demande.agent_id ?? ""} onValueChange={reassignAgent} disabled={!canWrite}>
          <SelectTrigger className="h-7 w-[220px] text-xs">
            <SelectValue placeholder="Non assigné" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.user_id} value={a.user_id}>
                {agentLabel(a)}
                {a.user_id === user?.id ? " (moi)" : ""}
                {!a.actif ? " · inactif" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Infos client */}
        <Card className="p-5 space-y-3">
          <h3 className="font-display text-lg">Client</h3>
          <div className="text-sm space-y-2">
            <div className="font-medium">{demande.nom_client}</div>
            {demande.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> {demande.email}
              </div>
            )}
            {demande.telephone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {demande.telephone}
              </div>
            )}
          </div>
          {client ? (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/contacts/$id" params={{ id: client.id }}>
                Voir la fiche client
              </Link>
            </Button>
          ) : (
            canWrite && (
              <Button onClick={creerClient} variant="outline" size="sm" className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Créer le client
              </Button>
            )
          )}
        </Card>

        {/* Voyage */}
        <Card className="p-5 space-y-2 md:col-span-2">
          <h3 className="font-display text-lg">Détails du voyage</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Destination</div>
              <div className="font-medium">{demande.destination ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pax</div>
              <div className="font-medium">{demande.nombre_pax}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Dates</div>
              <div className="font-medium">
                {demande.date_depart_souhaitee
                  ? `${demande.date_depart_souhaitee}${demande.date_retour_souhaitee ? ` → ${demande.date_retour_souhaitee}` : ""}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Budget</div>
              <div className="font-medium">{demande.budget ? formatEUR(demande.budget) : "—"}</div>
            </div>
          </div>
          {demande.message_client && (
            <div className="pt-2">
              <div className="text-xs text-muted-foreground mb-1">Message du client</div>
              <div className="text-sm bg-secondary/40 rounded-md p-3 whitespace-pre-wrap">{demande.message_client}</div>
            </div>
          )}
        </Card>
      </div>

      {/* Suivi & Notes */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Suivi</h3>
          <div className="text-xs text-muted-foreground">
            Dernier contact : {demande.dernier_contact_at ? formatDate(demande.dernier_contact_at) : "—"}
          </div>
        </div>
        <Textarea
          rows={5}
          placeholder="Notes de suivi, échanges, relances…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!canWrite}
        />
        {canWrite && (
          <Button onClick={saveNotes} variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Enregistrer
          </Button>
        )}
        {demande.statut === "perdue" && demande.raison_perte && (
          <div className="text-sm bg-destructive/5 border border-destructive/20 rounded-md p-3">
            <span className="font-medium">Raison de perte : </span>
            {demande.raison_perte}
          </div>
        )}
      </Card>

      {canWrite && demande.statut === "transformee_en_cotation" && (
        <Card className="p-5 space-y-3 border-orange-500/30 bg-orange-500/5">
          <h3 className="font-display text-lg">Statut bloqué</h3>
          <p className="text-sm text-muted-foreground">
            Si la cotation liée a été supprimée, cette action remet la demande en cours.
          </p>
          <Button variant="outline" size="sm" onClick={remettreEnCoursSiCotationSupprimee}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Remettre en cours
          </Button>
        </Card>
      )}

      {/* Actions */}
      {canWrite && demande.statut !== "transformee_en_cotation" && (
        <Card className="p-5 space-y-3">
          <h3 className="font-display text-lg">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {demande.statut !== "en_cours" && (
              <Button variant="outline" size="sm" onClick={() => updateStatut("en_cours")}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Marquer en cours
              </Button>
            )}
            {demande.statut !== "a_relancer" && (
              <Button variant="outline" size="sm" onClick={() => updateStatut("a_relancer")}>
                <RefreshCw className="h-4 w-4 mr-2" />À relancer
              </Button>
            )}
            <Dialog open={perteOpen} onOpenChange={setPerteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  Marquer perdue
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Raison de perte</DialogTitle>
                </DialogHeader>
                <Textarea
                  rows={3}
                  placeholder="Prix trop élevé, délai trop court…"
                  value={raisonPerte}
                  onChange={(e) => setRaisonPerte(e.target.value)}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPerteOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={async () => {
                      await updateStatut("perdue", raisonPerte);
                      setPerteOpen(false);
                    }}
                  >
                    Confirmer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={transformOpen} onOpenChange={setTransformOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Créer une cotation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transformer en cotation</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Une cotation pré-remplie sera créée à partir des informations de cette demande.
                    {!demande.client_id && " Le client sera créé automatiquement s'il n'existe pas encore."}
                  </p>
                  <div>
                    <Label>Titre de la cotation</Label>
                    <Input value={transformTitre} onChange={(e) => setTransformTitre(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransformOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={transformer}>Créer la cotation</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      )}
    </div>
  );
}
