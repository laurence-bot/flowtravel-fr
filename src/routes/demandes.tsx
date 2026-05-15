import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTable, type Contact } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { usePageWriteAccess } from "@/hooks/use-page-write-access";
import { formatEUR, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { logAudit } from "@/lib/audit";
import {
  DEMANDE_STATUT_LABELS,
  DEMANDE_STATUT_TONES,
  DEMANDE_CANAL_LABELS,
  isSansReponse,
  joursDepuisContact,
  type Demande,
  type DemandeStatut,
  type DemandeCanal,
} from "@/lib/demandes";
import { Inbox, Plus, ChevronRight, AlertTriangle, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/demandes")({
  component: DemandesRoute,
});

function DemandesRoute() {
  const location = useLocation();
  if (location.pathname !== "/demandes") return <Outlet />;
  return (
    <RequireAuth>
      <DemandesPage />
    </RequireAuth>
  );
}

const newSchema = z.object({
  nom_client: z.string().trim().min(1, "Nom requis").max(150),
  client_id: z.string().uuid().optional().or(z.literal("")),
  email: z.string().trim().email("Email invalide").max(200).optional().or(z.literal("")),
  telephone: z.string().trim().max(40).optional().or(z.literal("")),
  canal: z.enum(["email", "telephone", "site_web", "whatsapp", "recommandation", "autre"]),
  destination: z.string().trim().max(200).optional().or(z.literal("")),
  date_depart_souhaitee: z.string().optional().or(z.literal("")),
  date_retour_souhaitee: z.string().optional().or(z.literal("")),
  budget: z.string().optional(),
  nombre_pax: z.number().min(1).max(999),
  message_client: z.string().trim().max(4000).optional().or(z.literal("")),
});

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-secondary text-muted-foreground border-border",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  warning: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
};

// Sentinelle pour l'option "Aucun client" du <Select> (les Select shadcn n'acceptent pas "" en value).
const NO_CLIENT = "__none__";

export function StatutPill({ statut }: { statut: DemandeStatut }) {
  return (
    <Badge variant="outline" className={TONE_CLASS[DEMANDE_STATUT_TONES[statut]]}>
      {DEMANDE_STATUT_LABELS[statut]}
    </Badge>
  );
}

const EMPTY_FORM = {
  nom_client: "",
  client_id: "",
  email: "",
  telephone: "",
  canal: "email" as DemandeCanal,
  destination: "",
  date_depart_souhaitee: "",
  date_retour_souhaitee: "",
  budget: "",
  nombre_pax: "1",
  message_client: "",
  creer_client: false,
};

function DemandesPage() {
  const { user } = useAuth();
  const { agenceId } = useRole();
  const { canWrite } = usePageWriteAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: demandes, loading, refetch } = useTable<Demande>("demandes" as any);
  const { data: contacts } = useTable<Contact>("contacts");
  const clients = useMemo(
    () =>
      contacts
        .filter((c) => c.type === "client")
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" })),
    [contacts],
  );
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  /**
   * Sélection d'un client existant : on hydrate automatiquement nom, email et téléphone
   * à partir de la fiche contact. Désélection : on remet à zéro ces trois champs
   * (sinon on garderait des données fantômes du client précédent).
   * "creer_client" est forcé à false dès qu'un client existant est choisi.
   */
  const handleSelectClient = (value: string) => {
    if (value === NO_CLIENT || !value) {
      setForm((f) => ({
        ...f,
        client_id: "",
        nom_client: "",
        email: "",
        telephone: "",
      }));
      return;
    }
    const client = clientsById.get(value);
    if (!client) return;
    setForm((f) => ({
      ...f,
      client_id: client.id,
      nom_client: client.nom,
      email: client.email ?? "",
      telephone: client.telephone ?? "",
      creer_client: false,
    }));
  };

  const [fStatut, setFStatut] = useState<string>("tous");
  const [fCanal, setFCanal] = useState<string>("tous");
  const [fDest, setFDest] = useState<string>("");
  const [fDate, setFDate] = useState<string>("");

  const filtered = useMemo(
    () =>
      demandes.filter((d) => {
        if (fStatut !== "tous" && d.statut !== fStatut) return false;
        if (fCanal !== "tous" && d.canal !== fCanal) return false;
        if (fDest.trim() && !(d.destination ?? "").toLowerCase().includes(fDest.toLowerCase())) return false;
        if (fDate && (!d.date_depart_souhaitee || d.date_depart_souhaitee < fDate)) return false;
        return true;
      }),
    [demandes, fStatut, fCanal, fDest, fDate],
  );

  const alertes = demandes.filter((d) => isSansReponse(d) || d.statut === "a_relancer").length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = newSchema.safeParse({
      ...form,
      nombre_pax: Number(form.nombre_pax) || 1,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);

    // Si on demande de créer un nouveau client, on insère d'abord le contact.
    let clientId: string | null = parsed.data.client_id || null;
    if (form.creer_client && !clientId) {
      const { data: createdContact, error: errContact } = await supabase
        .from("contacts")
        .insert({
          user_id: user.id,
          agence_id: agenceId ?? null,
          type: "client",
          nom: parsed.data.nom_client,
          email: parsed.data.email || null,
          telephone: parsed.data.telephone || null,
        })
        .select()
        .single();
      if (errContact || !createdContact) {
        setSubmitting(false);
        toast.error(errContact?.message ?? "Création du client impossible.");
        return;
      }
      clientId = createdContact.id;
      await logAudit({
        userId: user.id,
        entity: "contact",
        entityId: createdContact.id,
        action: "create",
        description: `Client créé depuis demande : ${parsed.data.nom_client}`,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase as any)
      .from("demandes")
      .insert({
        user_id: user.id,
        nom_client: parsed.data.nom_client,
        client_id: clientId, // ← LIEN avec la fiche client (était oublié)
        email: parsed.data.email || null,
        telephone: parsed.data.telephone || null,
        canal: parsed.data.canal,
        destination: parsed.data.destination || null,
        date_depart_souhaitee: parsed.data.date_depart_souhaitee || null,
        date_retour_souhaitee: parsed.data.date_retour_souhaitee || null,
        budget: parsed.data.budget ? Number(parsed.data.budget) : null,
        nombre_pax: parsed.data.nombre_pax,
        message_client: parsed.data.message_client || null,
        statut: "nouvelle",
      })
      .select()
      .single();
    setSubmitting(false);
    if (error || !created) {
      toast.error(error?.message ?? "Création impossible.");
      return;
    }
    await logAudit({
      userId: user.id,
      entity: "demande",
      entityId: created.id,
      action: "create",
      description: `Demande créée : ${parsed.data.nom_client}`,
    });
    setOpen(false);
    setForm(EMPTY_FORM);
    toast.success(form.creer_client && !parsed.data.client_id ? "Demande et client créés." : "Demande créée.");
    refetch();
  };

  // Quand le dialog se ferme (croix, Échap, clic extérieur), on reset le formulaire
  // pour éviter de garder l'état d'une demande abandonnée.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setForm(EMPTY_FORM);
  };

  const selectedClient = form.client_id ? clientsById.get(form.client_id) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes"
        description="Gestion des demandes entrantes : du prospect à la cotation."
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Nouvelle demande
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouvelle demande</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Client existant en PREMIER : si choisi, il remplit auto les champs ci-dessous */}
                    <div className="col-span-2">
                      <Label>Client existant</Label>
                      <Select
                        value={form.client_id || NO_CLIENT}
                        onValueChange={handleSelectClient}
                        disabled={form.creer_client}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              form.creer_client ? "Nouveau client" : "Optionnel — sélectionner un client existant"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_CLIENT}>— Aucun (saisie manuelle) —</SelectItem>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nom}
                              {c.email ? ` · ${c.email}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedClient && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Fiche client liée — les champs ci-dessous sont pré-remplis et restent modifiables pour cette
                          demande.
                        </p>
                      )}
                    </div>

                    <div>
                      <Label>Nom du contact *</Label>
                      <Input
                        value={form.nom_client}
                        onChange={(e) => setForm({ ...form, nom_client: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>

                    <div className="col-span-2 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <Checkbox
                        id="creer-client"
                        checked={form.creer_client}
                        disabled={!!form.client_id}
                        onCheckedChange={(c) =>
                          setForm({
                            ...form,
                            creer_client: c === true,
                            client_id: c === true ? "" : form.client_id,
                          })
                        }
                      />
                      <Label htmlFor="creer-client" className="cursor-pointer text-sm font-normal">
                        Créer aussi le contact dans ma base clients
                        <span className="block text-xs text-muted-foreground">
                          Le nom, email et téléphone saisis ci-dessus seront utilisés pour créer un nouveau client.
                        </span>
                      </Label>
                    </div>

                    <div>
                      <Label>Téléphone</Label>
                      <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                    </div>
                    <div>
                      <Label>Canal</Label>
                      <Select value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v as DemandeCanal })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(DEMANDE_CANAL_LABELS) as DemandeCanal[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {DEMANDE_CANAL_LABELS[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Destination</Label>
                      <Input
                        value={form.destination}
                        onChange={(e) => setForm({ ...form, destination: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Date départ</Label>
                      <Input
                        type="date"
                        value={form.date_depart_souhaitee}
                        onChange={(e) => setForm({ ...form, date_depart_souhaitee: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Date retour</Label>
                      <Input
                        type="date"
                        value={form.date_retour_souhaitee}
                        onChange={(e) => setForm({ ...form, date_retour_souhaitee: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Budget (€)</Label>
                      <Input
                        type="number"
                        value={form.budget}
                        onChange={(e) => setForm({ ...form, budget: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Nombre de pax</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.nombre_pax}
                        onChange={(e) => setForm({ ...form, nombre_pax: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Message du client</Label>
                    <Textarea
                      rows={4}
                      value={form.message_client}
                      onChange={(e) => setForm({ ...form, message_client: e.target.value })}
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Création…" : "Créer la demande"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {alertes > 0 && (
        <Card className="p-4 border-orange-500/30 bg-orange-500/5 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <div className="text-sm">
            <span className="font-medium">{alertes} demande(s)</span> en attente de relance ou sans réponse depuis 5
            jours.
          </div>
        </Card>
      )}

      {/* KPIs pipeline */}
      {demandes.length > 0 &&
        (() => {
          const total = demandes.length;
          const nouvelles = demandes.filter((d) => d.statut === "nouvelle").length;
          const enCours = demandes.filter((d) => d.statut === "en_cours" || d.statut === "a_relancer").length;
          const transformees = demandes.filter((d) => d.statut === "transformee_en_cotation").length;
          const perdues = demandes.filter((d) => d.statut === "perdue").length;
          const tauxConversion = total > 0 ? Math.round((transformees / total) * 100) : 0;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Nouvelles</span>
                  <Inbox className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-semibold tabular-nums">{nouvelles}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{enCours} en cours</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Transformées</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-semibold tabular-nums text-emerald-600">{transformees}</div>
                <div className="text-xs text-muted-foreground mt-0.5">sur {total} demandes</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Taux conversion</span>
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                </div>
                <div
                  className={`text-2xl font-semibold tabular-nums ${tauxConversion >= 30 ? "text-emerald-600" : tauxConversion >= 15 ? "text-amber-600" : "text-red-500"}`}
                >
                  {tauxConversion}%
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">demande → cotation</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Perdues</span>
                  <XCircle className="h-4 w-4 text-red-400" />
                </div>
                <div className="text-2xl font-semibold tabular-nums text-muted-foreground">{perdues}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {total > 0 ? Math.round((perdues / total) * 100) : 0}% du total
                </div>
              </Card>
            </div>
          );
        })()}

      <Card className="p-4 grid md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Statut</Label>
          <Select value={fStatut} onValueChange={setFStatut}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {(Object.keys(DEMANDE_STATUT_LABELS) as DemandeStatut[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {DEMANDE_STATUT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Canal</Label>
          <Select value={fCanal} onValueChange={setFCanal}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {(Object.keys(DEMANDE_CANAL_LABELS) as DemandeCanal[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {DEMANDE_CANAL_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Destination</Label>
          <Input placeholder="Filtrer…" value={fDest} onChange={(e) => setFDest(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Départ après le</Label>
          <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-sm text-muted-foreground text-center">Chargement…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Aucune demande"
            description="Créez votre première demande pour démarrer le suivi commercial."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créée</TableHead>
                <TableHead>Dernier contact</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const alerte = isSansReponse(d);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.nom_client}
                      {d.email && <div className="text-xs text-muted-foreground">{d.email}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.destination ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.date_depart_souhaitee
                        ? `${d.date_depart_souhaitee}${d.date_retour_souhaitee ? ` → ${d.date_retour_souhaitee}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular">{d.budget ? formatEUR(d.budget) : "—"}</TableCell>
                    <TableCell className="text-xs">{DEMANDE_CANAL_LABELS[d.canal]}</TableCell>
                    <TableCell>
                      <StatutPill statut={d.statut} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {alerte ? (
                        <span className="text-orange-600 font-medium">{joursDepuisContact(d)}j sans réponse</span>
                      ) : d.dernier_contact_at ? (
                        formatDate(d.dernier_contact_at)
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/demandes/$id" params={{ id: d.id }}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
