import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTable, type Contact, type Dossier, type Paiement, type Facture } from "@/hooks/use-data";
import { useAgents, agentLabel } from "@/hooks/use-agents";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatEUR, formatPercent, formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/fx";
import { computeDossierFinance, paiementEUR, factureEUR } from "@/lib/finance";
import { FxFieldGroup, fxValueToDb, emptyFxValue, type FxFieldValue } from "@/components/fx-field-group";
import { StatutBadge } from "@/components/statut-badge";
import { ArrowLeft, Trash2, User, Receipt, ArrowDownLeft, ArrowUpRight, Plus, Users as UsersIcon, FileSignature, Mail } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { DossierTasksBlock } from "@/components/dossier-tasks-block";
import { triggerBulletinAfterAcompte } from "@/server/bulletin-trigger.functions";

export const Route = createFileRoute("/dossiers/$id")({
  component: () => (
    <RequireAuth>
      <DossierDetail />
    </RequireAuth>
  ),
});

function DossierDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { data: contacts } = useTable<Contact>("contacts");
  const { data: paiements } = useTable<Paiement>("paiements");
  const { data: factures, refetch: refetchFactures } = useTable<Facture>("factures_fournisseurs");
  const { agents } = useAgents();

  const reassignAgent = async (newAgentId: string) => {
    if (!dossier) return;
    const oldAgentId = dossier.agent_id;
    if (oldAgentId === newAgentId) return;
    const { error } = await supabase.from("dossiers").update({ agent_id: newAgentId }).eq("id", dossier.id);
    if (error) return toast.error(error.message);
    const oldName = agentLabel(agents.find((a) => a.user_id === oldAgentId));
    const newName = agentLabel(agents.find((a) => a.user_id === newAgentId));
    setDossier({ ...dossier, agent_id: newAgentId });
    await logAudit({
      userId: user?.id,
      entity: "dossier",
      action: "update",
      entityId: dossier.id,
      description: `Agent responsable : ${oldName} → ${newName}`,
      oldValue: { agent_id: oldAgentId },
      newValue: { agent_id: newAgentId },
    });
    toast.success(`Dossier réassigné à ${newName}`);
  };

  const [cotationId, setCotationId] = useState<string | null>(null);
  const [bulletinExists, setBulletinExists] = useState<{ token: string; statut: string } | null>(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    supabase.from("dossiers").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) setNotFound(true);
      else setDossier(data as Dossier);
    });
    // Récupère la cotation associée + un éventuel bulletin
    supabase.from("cotations").select("id").eq("dossier_id", id).maybeSingle().then(({ data }) => {
      if (data?.id) {
        setCotationId(data.id);
        supabase
          .from("bulletins")
          .select("token,statut")
          .eq("cotation_id", data.id)
          .in("statut", ["a_signer", "signe"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: b }) => setBulletinExists(b ?? null));
      }
    });
  }, [id]);

  const handleTriggerBulletin = async () => {
    if (!cotationId) {
      toast.error("Aucune cotation associée à ce dossier");
      return;
    }
    setTriggering(true);
    try {
      const r = await triggerBulletinAfterAcompte({ data: { cotationId, sendEmail: true } });
      if (r.ok) {
        setBulletinExists({ token: r.token, statut: "a_signer" });
        toast.success(
          r.emailSent
            ? "Bulletin généré et envoyé au client par email."
            : "Bulletin généré (email non envoyé : email client manquant).",
        );
      } else {
        toast.error(r.error ?? "Erreur");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setTriggering(false);
    }
  };

  if (notFound) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-2xl">Dossier introuvable</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dossiers">Retour aux dossiers</Link>
        </Button>
      </div>
    );
  }
  if (!dossier) return <div className="text-muted-foreground text-sm">Chargement du dossier…</div>;

  const client = contacts.find((c) => c.id === dossier.client_id);
  const paiementsDossier = paiements.filter((p) => p.dossier_id === dossier.id);
  const facturesDossier = factures.filter((f) => f.dossier_id === dossier.id);
  const f = computeDossierFinance(dossier, paiements, factures);

  const paiementsClients = paiementsDossier.filter((p) => p.type === "paiement_client");
  const paiementsFournisseurs = paiementsDossier.filter((p) => p.type === "paiement_fournisseur");

  const supprimer = async () => {
    if (!dossier) return;
    if (!confirm("Supprimer ce dossier ? Cette action est irréversible.")) return;
    const { error } = await supabase.from("dossiers").delete().eq("id", dossier.id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user?.id,
      entity: "dossier",
      action: "delete",
      entityId: dossier.id,
      description: `Dossier supprimé : ${dossier.titre}`,
      oldValue: dossier,
    });
    toast.success("Dossier supprimé");
    navigate({ to: "/dossiers" });
  };

  return (
    <div className="space-y-8">
      <Link to="/dossiers" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
        <ArrowLeft className="h-4 w-4" />
        Retour aux dossiers
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl md:text-4xl text-foreground">{dossier.titre}</h1>
            <StatutBadge statut={dossier.statut} />
          </div>
          <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            {client?.nom ?? "Aucun client associé"}
          </p>
          <div className="mt-3 inline-flex items-center gap-2">
            <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Agent :</span>
            <Select value={dossier.agent_id ?? ""} onValueChange={reassignAgent}>
              <SelectTrigger className="h-7 w-[200px] text-xs"><SelectValue placeholder="Non assigné" /></SelectTrigger>
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
        <Button variant="outline" size="sm" onClick={supprimer}>
          <Trash2 className="h-4 w-4 mr-2" />
          Supprimer
        </Button>
      </header>

      {/* KPIs financiers */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Prix de vente</div>
          <div className="mt-2 text-2xl font-semibold tabular">{formatEUR(f.prixVente)}</div>
        </Card>
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Coût total</div>
          <div className="mt-2 text-2xl font-semibold tabular text-[color:var(--cost)]">{formatEUR(f.coutTotal)}</div>
        </Card>
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Marge</div>
          <div className={`mt-2 text-2xl font-semibold tabular ${f.marge >= 0 ? "text-[color:var(--margin)]" : "text-destructive"}`}>
            {formatEUR(f.marge)}
          </div>
          {f.prixVente > 0 && (
            <div className="text-xs text-muted-foreground mt-1">{formatPercent(f.margePct)} du CA</div>
          )}
        </Card>
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Reste à encaisser</div>
          <div className="mt-2 text-2xl font-semibold tabular">{formatEUR(f.resteAEncaisser)}</div>
          <div className="text-xs text-muted-foreground mt-1">Reste à payer fourn. : {formatEUR(f.resteAPayerFournisseur)}</div>
        </Card>
      </section>

      {/* TVA sur marge — régime des agences de voyages */}
      <Card className="p-6 border-border/60">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-xl">TVA sur marge</h2>
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Taux appliqué : {f.tauxTva.toFixed(1).replace(".0", "")} %
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Prix de vente</div>
            <div className="tabular font-medium mt-1">{formatEUR(f.prixVente)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Coûts fournisseurs</div>
            <div className="tabular font-medium mt-1 text-[color:var(--cost)]">{formatEUR(f.coutTotal)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Marge brute</div>
            <div className={`tabular font-medium mt-1 ${f.margeBrute >= 0 ? "" : "text-destructive"}`}>
              {formatEUR(f.margeBrute)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">TVA sur marge</div>
            <div className="tabular font-medium mt-1 text-[color:var(--cost)]">−{formatEUR(f.tvaSurMarge)}</div>
          </div>
          <div className="col-span-2 md:col-span-2">
            <div className="text-xs text-muted-foreground">Marge nette (après TVA)</div>
            <div className={`tabular text-lg font-semibold mt-1 ${f.margeNette >= 0 ? "text-[color:var(--margin)]" : "text-destructive"}`}>
              {formatEUR(f.margeNette)}
              {f.prixVente > 0 && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  ({formatPercent(f.margeNettePct)} du CA)
                </span>
              )}
            </div>
          </div>
        </div>
        {f.margeBrute <= 0 && (
          <p className="text-[11px] text-muted-foreground mt-4">
            Marge brute nulle ou négative : la TVA sur marge ne s'applique pas.
          </p>
        )}
      </Card>

      {/* Résumé financier + Factures */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-border/60">
          <h2 className="font-display text-xl">Résumé financier</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">Total encaissé client</dt>
              <dd className="tabular text-[color:var(--revenue)] font-medium">+{formatEUR(f.encaisseClient)}</dd>
            </div>
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">Total payé fournisseurs</dt>
              <dd className="tabular text-[color:var(--cost)] font-medium">−{formatEUR(f.payeFournisseur)}</dd>
            </div>
            <div className="flex justify-between items-center pt-1">
              <dt className="font-medium">Solde de trésorerie du dossier</dt>
              <dd className="tabular text-lg font-semibold">{formatEUR(f.soldeTresorerie)}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-6 border-border/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-display text-xl flex items-center gap-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              Factures fournisseurs
            </h2>
            <NewFactureDialog
              dossierId={dossier.id}
              userId={user?.id}
              fournisseurs={contacts.filter((c) => c.type === "fournisseur")}
              onDone={refetchFactures}
            />
          </div>
          {facturesDossier.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">Aucune facture liée à ce dossier.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border/60">
              {facturesDossier.map((fact) => {
                const fournisseur = contacts.find((c) => c.id === fact.fournisseur_id);
                return (
                  <li key={fact.id}>
                    <Link
                      to="/factures/$id"
                      params={{ id: fact.id }}
                      className="py-3 flex justify-between items-start text-sm hover:bg-secondary/30 -mx-2 px-2 rounded-md transition-colors"
                    >
                      <div>
                        <div className="font-medium">{fournisseur?.nom ?? "Fournisseur"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Échéance : {formatDate(fact.date_echeance)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular font-medium">{formatEUR(factureEUR(fact))}</div>
                        {fact.devise !== "EUR" && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {formatMoney(fact.montant_devise ?? 0, fact.devise)} @ {Number(fact.taux_change).toFixed(4)}
                          </div>
                        )}
                        <Badge variant={fact.paye ? "default" : "outline"} className="mt-1 text-[10px]">
                          {fact.paye ? "Payée" : "À payer"}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Suivi opérationnel */}
      <DossierTasksBlock dossierId={dossier.id} />

      {/* Bulletin d'inscription */}
      {cotationId && (
        <Card className="p-5 border-border/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <FileSignature className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-display text-base">Bulletin d'inscription</h3>
                {bulletinExists ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {bulletinExists.statut === "signe"
                      ? "✓ Bulletin signé par le client."
                      : "Bulletin envoyé au client — en attente de signature."}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dès le 1ᵉʳ acompte reçu, déclenchez l'envoi du bulletin pré-signé au client
                    pour signature en ligne.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {bulletinExists && (
                <Button asChild size="sm" variant="outline">
                  <a href={`/bulletin/${bulletinExists.token}`} target="_blank" rel="noopener noreferrer">
                    Voir le lien
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleTriggerBulletin}
                disabled={triggering || bulletinExists?.statut === "signe"}
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                {bulletinExists ? "Renvoyer au client" : "Acompte 1 reçu — Envoyer le bulletin"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Paiements clients & fournisseurs */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaiementBloc
          title="Paiements clients"
          icon={<ArrowDownLeft className="h-5 w-5 text-[color:var(--revenue)]" />}
          paiements={paiementsClients}
          contacts={contacts}
          variant="entrant"
        />
        <PaiementBloc
          title="Paiements fournisseurs"
          icon={<ArrowUpRight className="h-5 w-5 text-[color:var(--cost)]" />}
          paiements={paiementsFournisseurs}
          contacts={contacts}
          variant="sortant"
        />
      </section>
    </div>
  );
}

function PaiementBloc({
  title,
  icon,
  paiements,
  contacts,
  variant,
}: {
  title: string;
  icon: React.ReactNode;
  paiements: Paiement[];
  contacts: Contact[];
  variant: "entrant" | "sortant";
}) {
  const total = paiements.reduce((s, p) => s + paiementEUR(p), 0);
  const colorClass = variant === "entrant" ? "text-[color:var(--revenue)]" : "text-[color:var(--cost)]";
  const sign = variant === "entrant" ? "+" : "−";
  return (
    <Card className="border-border/60 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
        <h2 className="font-display text-lg flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <div className={`tabular font-medium ${colorClass}`}>
          {sign}
          {formatEUR(total)}
        </div>
      </div>
      {paiements.length === 0 ? (
        <p className="text-sm text-muted-foreground px-6 py-8 text-center">Aucun mouvement.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30 hover:bg-secondary/30">
              <TableHead>Date</TableHead>
              <TableHead>Personne</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paiements.map((p) => {
              const personne = contacts.find((c) => c.id === p.personne_id);
              return (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{formatDate(p.date)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{personne?.nom ?? "—"}</TableCell>
                  <TableCell className="capitalize text-sm text-muted-foreground">{p.methode}</TableCell>
                  <TableCell className={`text-right tabular font-medium ${colorClass}`}>
                    <div>{sign}{formatEUR(paiementEUR(p))}</div>
                    {p.devise !== "EUR" && (
                      <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                        {formatMoney(p.montant_devise ?? 0, p.devise)} @ {Number(p.taux_change).toFixed(4)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

const factureSchema = z.object({
  fournisseur_id: z.string().uuid().optional().or(z.literal("")),
  date_echeance: z.string().optional(),
});

function NewFactureDialog({
  dossierId, userId, fournisseurs, onDone,
}: {
  dossierId: string;
  userId?: string;
  fournisseurs: Contact[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fournisseur_id: "",
    date_echeance: "",
  });
  const [fx, setFx] = useState<FxFieldValue>(emptyFxValue());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const parsed = factureSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const fxDb = fxValueToDb(fx);
    if (!(fxDb.montant_devise > 0)) {
      toast.error("Montant invalide");
      return;
    }
    setSaving(true);
    const { data: inserted, error } = await supabase.from("factures_fournisseurs").insert({
      user_id: userId,
      dossier_id: dossierId,
      fournisseur_id: parsed.data.fournisseur_id || null,
      date_echeance: parsed.data.date_echeance || null,
      paye: false,
      ...fxDb,
    }).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit({
      userId,
      entity: "facture_fournisseur",
      entityId: inserted?.id,
      action: "create",
      description: `Facture fournisseur ${formatMoney(fxDb.montant_devise, fxDb.devise)}${fxDb.devise !== "EUR" ? ` (${formatEUR(fxDb.montant_eur)})` : ""}`,
      newValue: inserted,
    });
    toast.success("Facture créée");
    setOpen(false);
    setForm({ fournisseur_id: "", date_echeance: "" });
    setFx(emptyFxValue());
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1.5" />
          Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nouvelle facture fournisseur</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Fournisseur</Label>
            <Select value={form.fournisseur_id} onValueChange={(v) => setForm({ ...form, fournisseur_id: v })}>
              <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
              <SelectContent>
                {fournisseurs.length === 0 && (
                  <div className="px-2 py-2 text-sm text-muted-foreground">Aucun fournisseur.</div>
                )}
                {fournisseurs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <FxFieldGroup value={fx} onChange={setFx} amountLabel="Montant facture" />

          <div className="space-y-2">
            <Label>Date d'échéance</Label>
            <Input
              type="date"
              value={form.date_echeance}
              onChange={(e) => setForm({ ...form, date_echeance: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Enregistrement…" : "Créer la facture"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
