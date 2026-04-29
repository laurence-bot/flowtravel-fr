import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { ContactEditDialog } from "@/components/contact-edit-dialog";
import { FournisseurConditionsBlock } from "@/components/fournisseur-conditions-block";
import { usePageWriteAccess } from "@/hooks/use-page-write-access";
import { Pencil, Globe, MapPin, User as UserIcon, StickyNote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useTable,
  type Contact,
  type Dossier,
  type Paiement,
  type Facture,
} from "@/hooks/use-data";

import {
  computeClientCotationStats,
  COTATION_STATUT_LABELS,
  COTATION_STATUT_TONES,
  computeCotationFinance,
  type Cotation,
  type CotationLigne,
} from "@/lib/cotations";
import {
  DEMANDE_STATUT_LABELS, DEMANDE_STATUT_TONES,
  type Demande, type DemandeStatut,
} from "@/lib/demandes";
import { formatEUR, formatPercent, formatDate } from "@/lib/format";
import { computeDossierFinance } from "@/lib/finance";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  ArrowLeft,
  Mail,
  Phone,
  FolderOpen,
  Wallet,
  Receipt,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CalendarClock,
  Inbox,
} from "lucide-react";

export const Route = createFileRoute("/contacts/$id")({
  component: () => (
    <RequireAuth>
      <ContactDetail />
    </RequireAuth>
  ),
});

function KpiCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "revenue" | "cost" | "margin" | "cash";
  hint?: string;
}) {
  const colorVar = tone ? `var(--${tone})` : undefined;
  return (
    <Card className="p-5 border-border/60 relative overflow-hidden">
      {colorVar && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ backgroundColor: colorVar }}
        />
      )}
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular" style={tone ? { color: colorVar } : undefined}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function ContactDetail() {
  const { id } = Route.useParams();
  const { data: contacts, loading } = useTable<Contact>("contacts");
  const { data: dossiers, loading: dossiersLoading } = useTable<Dossier>("dossiers");
  const { data: paiements, loading: paiementsLoading } = useTable<Paiement>("paiements");
  const { data: factures, loading: facturesLoading } = useTable<Facture>("factures_fournisseurs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cotations, loading: cotationsLoading } = useTable<Cotation>("cotations" as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cotLignes, loading: cotLignesLoading } = useTable<CotationLigne>("cotation_lignes_fournisseurs" as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: demandes, loading: demandesLoading } = useTable<Demande>("demandes" as any);

  const contact = contacts.find((c) => c.id === id);

  if (loading || dossiersLoading || paiementsLoading || facturesLoading || cotationsLoading || cotLignesLoading || demandesLoading) {
    return <div className="text-muted-foreground text-sm">Chargement…</div>;
  }
  if (!contact) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-2xl">Contact introuvable</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/contacts">Retour aux contacts</Link>
        </Button>
      </div>
    );
  }

  const isClient = contact.type === "client";

  // Dossiers liés
  const dossiersClient = dossiers.filter((d) => d.client_id === contact.id);
  const facturesFournisseur = factures.filter((f) => f.fournisseur_id === contact.id);
  const dossiersFournIds = new Set(facturesFournisseur.map((f) => f.dossier_id).filter(Boolean) as string[]);
  const dossiersFournisseur = dossiers.filter((d) => dossiersFournIds.has(d.id));

  // Paiements liés
  const paiementsClient = paiements.filter(
    (p) => p.personne_id === contact.id && p.type === "paiement_client",
  );
  const paiementsFournisseur = paiements.filter(
    (p) => p.personne_id === contact.id && p.type === "paiement_fournisseur",
  );

  // KPIs CLIENT
  const ca = dossiersClient.reduce((s, d) => s + Number(d.prix_vente || 0), 0);
  const totalEncaisse = paiementsClient.reduce((s, p) => s + Number(p.montant || 0), 0);
  const margeNette = dossiersClient.reduce(
    (s, d) => s + computeDossierFinance(d, paiements, factures).margeNette,
    0,
  );
  const resteAEncaisser = dossiersClient.reduce(
    (s, d) => s + computeDossierFinance(d, paiements, factures).resteAEncaisser,
    0,
  );

  // KPIs FOURNISSEUR
  const totalFacture = facturesFournisseur.reduce((s, f) => s + Number(f.montant || 0), 0);
  const totalPaye = paiementsFournisseur.reduce((s, p) => s + Number(p.montant || 0), 0);
  const resteAPayer = Math.max(0, totalFacture - totalPaye);
  const facturesNonPayees = facturesFournisseur.filter((f) => !f.paye);

  // Alertes
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in14 = new Date(today);
  in14.setDate(in14.getDate() + 14);
  const alertes: { tone: "danger" | "warn" | "info"; label: string }[] = [];

  if (isClient) {
    if (resteAEncaisser > 1000)
      alertes.push({
        tone: resteAEncaisser > 5000 ? "danger" : "warn",
        label: `Reste à encaisser : ${formatEUR(resteAEncaisser)}`,
      });
    const dossiersMargeFaible = dossiersClient.filter((d) => {
      const fin = computeDossierFinance(d, paiements, factures);
      return fin.prixVente > 0 && fin.margeNettePct < 5;
    });
    if (dossiersMargeFaible.length > 0)
      alertes.push({
        tone: "warn",
        label: `${dossiersMargeFaible.length} dossier(s) à marge faible`,
      });
    const paiementsNonRapprClient = paiementsClient.filter(
      (p) => p.statut_rapprochement === "non_rapproche",
    );
    if (paiementsNonRapprClient.length > 0)
      alertes.push({
        tone: "info",
        label: `${paiementsNonRapprClient.length} paiement(s) non rapproché(s)`,
      });
  } else {
    const facturesProches = facturesNonPayees.filter((f) => {
      if (!f.date_echeance) return false;
      const due = new Date(f.date_echeance);
      return due <= in14;
    });
    if (facturesProches.length > 0) {
      const enRetard = facturesProches.filter((f) => new Date(f.date_echeance!) < today);
      alertes.push({
        tone: enRetard.length > 0 ? "danger" : "warn",
        label: `${facturesProches.length} facture(s) à payer sous 14j${enRetard.length > 0 ? ` (${enRetard.length} en retard)` : ""}`,
      });
    }
    if (resteAPayer > 0)
      alertes.push({
        tone: "info",
        label: `Reste à payer : ${formatEUR(resteAPayer)}`,
      });
    const paiementsNonRapprFourn = paiementsFournisseur.filter(
      (p) => p.statut_rapprochement === "non_rapproche",
    );
    if (paiementsNonRapprFourn.length > 0)
      alertes.push({
        tone: "info",
        label: `${paiementsNonRapprFourn.length} paiement(s) non rapproché(s)`,
      });
  }

  // Timeline (chronologique décroissante)
  type TimelineEvent = {
    date: string;
    type: "dossier" | "paiement" | "facture";
    label: string;
    detail: string;
    montant?: number;
    tone?: "revenue" | "cost" | "neutral";
    href?: { to: string; params?: Record<string, string> };
  };
  const timeline: TimelineEvent[] = [];

  const dossiersAll = isClient ? dossiersClient : dossiersFournisseur;
  for (const d of dossiersAll) {
    timeline.push({
      date: d.created_at,
      type: "dossier",
      label: `Dossier créé · ${d.titre}`,
      detail: `Prix de vente ${formatEUR(d.prix_vente)}`,
      tone: "neutral",
      href: { to: "/dossiers/$id", params: { id: d.id } },
    });
  }
  const paiementsAll = isClient ? paiementsClient : paiementsFournisseur;
  for (const p of paiementsAll) {
    const dossier = dossiers.find((d) => d.id === p.dossier_id);
    timeline.push({
      date: p.date,
      type: "paiement",
      label: isClient ? "Encaissement client" : "Paiement fournisseur",
      detail: `${dossier?.titre ?? "—"} · ${p.methode}${p.statut_rapprochement === "non_rapproche" ? " · non rapproché" : ""}`,
      montant: Number(p.montant),
      tone: isClient ? "revenue" : "cost",
    });
  }
  if (!isClient) {
    for (const f of facturesFournisseur) {
      const dossier = dossiers.find((d) => d.id === f.dossier_id);
      timeline.push({
        date: f.date_echeance ?? new Date().toISOString(),
        type: "facture",
        label: `Facture ${f.paye ? "payée" : "à payer"}`,
        detail: `${dossier?.titre ?? "—"}${f.date_echeance ? ` · échéance ${formatDate(f.date_echeance)}` : ""}`,
        montant: Number(f.montant),
        tone: "cost",
      });
    }
  }
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/contacts">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour aux contacts
          </Link>
        </Button>
        <PageHeader
          title={contact.nom}
          description={isClient ? "Fiche client" : "Fiche fournisseur"}
          action={
            <Badge variant={isClient ? "default" : "secondary"}>
              {isClient ? "Client" : "Fournisseur"}
            </Badge>
          }
        />
      </div>

      {/* Infos générales */}
      <Card className="p-5 border-border/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Email</div>
            <div className="mt-1 inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="hover:underline">
                  {contact.email}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Téléphone</div>
            <div className="mt-1 inline-flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {contact.telephone ? (
                <a href={`tel:${contact.telephone}`} className="hover:underline">
                  {contact.telephone}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Alertes */}
      {alertes.length > 0 && (
        <Card className="p-4 border-border/60">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-[color:var(--gold)] mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-2">
              {alertes.map((a, i) => (
                <span
                  key={i}
                  className={`text-[11px] uppercase tracking-wider px-2 py-1 rounded border ${
                    a.tone === "danger"
                      ? "bg-destructive/12 text-destructive border-destructive/30"
                      : a.tone === "warn"
                        ? "bg-[color:var(--gold)]/12 text-[color:var(--gold)] border-[color:var(--gold)]/30"
                        : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* KPIs */}
      {isClient ? (
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Dossiers" value={String(dossiersClient.length)} hint="Liés à ce client" />
          <KpiCard label="Chiffre d'affaires" value={formatEUR(ca)} tone="revenue" />
          <KpiCard label="Total encaissé" value={formatEUR(totalEncaisse)} tone="cash" />
          <KpiCard
            label="Reste à encaisser"
            value={formatEUR(resteAEncaisser)}
            hint={ca > 0 ? `${formatPercent((totalEncaisse / ca) * 100, 0)} reçu` : undefined}
          />
          <KpiCard
            label="Marge nette générée"
            value={formatEUR(margeNette)}
            tone="margin"
            hint={ca > 0 ? `${formatPercent((margeNette / ca) * 100)} du CA` : undefined}
          />
        </section>
      ) : (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Dossiers concernés"
            value={String(dossiersFournisseur.length)}
            hint={`${facturesFournisseur.length} facture(s)`}
          />
          <KpiCard label="Total facturé" value={formatEUR(totalFacture)} tone="cost" />
          <KpiCard label="Total payé" value={formatEUR(totalPaye)} tone="cash" />
          <KpiCard
            label="Reste à payer"
            value={formatEUR(resteAPayer)}
            hint={`${facturesNonPayees.length} non payée(s)`}
          />
        </section>
      )}

      {/* Demandes (clients uniquement) */}
      {isClient && (() => {
        const mesDemandes = demandes.filter((d) => d.client_id === contact.id);
        const enCours = mesDemandes.filter((d) => d.statut === "nouvelle" || d.statut === "en_cours" || d.statut === "a_relancer");
        const transformees = mesDemandes.filter((d) => d.statut === "transformee_en_cotation");
        const perdues = mesDemandes.filter((d) => d.statut === "perdue");
        const TONE_CLASS: Record<string, string> = {
          neutral: "bg-secondary text-muted-foreground border-border",
          info: "bg-blue-500/15 text-blue-700 border-blue-500/30",
          warning: "bg-orange-500/15 text-orange-700 border-orange-500/30",
          success: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
          danger: "bg-destructive/15 text-destructive border-destructive/30",
        };
        return (
          <section>
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              Demandes
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <KpiCard label="En cours" value={String(enCours.length)} />
              <KpiCard label="Transformées" value={String(transformees.length)} tone="margin" />
              <KpiCard label="Perdues" value={String(perdues.length)} />
            </div>
            <Card className="border-border/60 overflow-hidden">
              {mesDemandes.length === 0 ? (
                <EmptyState icon={Inbox} title="Aucune demande"
                  description="Aucune demande n'est associée à ce client." />
              ) : (
                <ul className="divide-y divide-border/60">
                  {mesDemandes.map((d) => (
                    <li key={d.id}>
                      <Link to="/demandes/$id" params={{ id: d.id }}
                        className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-secondary/40 transition-colors">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{d.destination ?? "Sans destination"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(d.created_at)} · {d.nombre_pax} pax
                            {d.budget ? ` · ${formatEUR(d.budget)}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant="outline" className={TONE_CLASS[DEMANDE_STATUT_TONES[d.statut]]}>
                            {DEMANDE_STATUT_LABELS[d.statut]}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        );
      })()}

      {/* Cotations (clients uniquement) */}
      {isClient && (() => {
        const stats = computeClientCotationStats(contact.id, cotations, cotLignes);
        // dernières versions
        const byGroup = new Map<string, Cotation>();
        for (const c of cotations.filter((c) => c.client_id === contact.id)) {
          const cur = byGroup.get(c.group_id);
          if (!cur || c.version_number > cur.version_number) byGroup.set(c.group_id, c);
        }
        const lastCotations = Array.from(byGroup.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        return (
          <section>
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              Cotations
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <KpiCard label="En cours" value={String(stats.enCours + stats.envoyees)} hint={`${stats.enCours} brouillon · ${stats.envoyees} envoyée(s)`} />
              <KpiCard label="Validées" value={String(stats.validees)} tone="margin" />
              <KpiCard label="Perdues" value={String(stats.perdues)} />
              <KpiCard
                label="Taux transformation"
                value={stats.tauxTransformation > 0 ? `${stats.tauxTransformation.toFixed(0)}%` : "—"}
                hint={`${stats.transformees} transformée(s)`}
              />
              <KpiCard
                label="Marge potentielle"
                value={formatEUR(stats.margePotentielle)}
                tone="margin"
                hint={`Total devis ${formatEUR(stats.montantTotal)}`}
              />
            </div>
            <Card className="border-border/60 overflow-hidden">
              {lastCotations.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="Aucune cotation"
                  description="Créez une cotation pour ce client depuis la page Cotations."
                />
              ) : (
                <ul className="divide-y divide-border/60">
                  {lastCotations.map((c) => {
                    const f = computeCotationFinance(c, cotLignes);
                    const tone = COTATION_STATUT_TONES[c.statut];
                    const cls =
                      tone === "success" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" :
                      tone === "danger" ? "bg-destructive/15 text-destructive border-destructive/30" :
                      tone === "info" ? "bg-blue-500/15 text-blue-700 border-blue-500/30" :
                      tone === "primary" ? "bg-primary/15 text-primary border-primary/30" :
                      "bg-secondary text-muted-foreground border-border";
                    return (
                      <li key={c.id}>
                        <Link
                          to="/cotations/$id"
                          params={{ id: c.id }}
                          className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-secondary/40 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {c.titre} <span className="text-xs text-muted-foreground">v{c.version_number}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {c.destination ?? "—"} · prix {formatEUR(f.prixVente)} · marge {formatEUR(f.margeNette)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Badge variant="outline" className={cls}>
                              {COTATION_STATUT_LABELS[c.statut]}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        );
      })()}

      {/* Dossiers liés */}
      <section>
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          Dossiers liés
        </h2>
        <Card className="border-border/60 overflow-hidden">
          {dossiersAll.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Aucun dossier"
              description={isClient ? "Aucun dossier n'est associé à ce client." : "Aucun dossier n'est associé à ce fournisseur."}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {dossiersAll.map((d) => {
                const fin = computeDossierFinance(d, paiements, factures);
                return (
                  <li key={d.id}>
                    <Link
                      to="/dossiers/$id"
                      params={{ id: d.id }}
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.titre}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatEUR(fin.prixVente)} · marge nette{" "}
                          <span className={fin.margeNette >= 0 ? "text-[color:var(--margin)]" : "text-destructive"}>
                            {formatEUR(fin.margeNette)}
                          </span>
                          {fin.prixVente > 0 && ` · ${formatPercent(fin.margeNettePct)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {d.statut === "confirme" ? "Confirmé" : d.statut === "cloture" ? "Clôturé" : "Brouillon"}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Paiements */}
      <section>
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          {isClient ? "Encaissements clients" : "Paiements fournisseurs"}
        </h2>
        <Card className="border-border/60 overflow-hidden">
          {paiementsAll.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Aucun paiement"
              description="Aucun mouvement enregistré pour ce contact."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {paiementsAll.map((p) => {
                const dossier = dossiers.find((d) => d.id === p.dossier_id);
                return (
                  <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {dossier?.titre ?? "Sans dossier"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 capitalize flex items-center gap-2">
                        {formatDate(p.date)} · {p.methode}
                        {p.statut_rapprochement === "non_rapproche" && (
                          <Badge variant="outline" className="text-[10px] border-[color:var(--gold)]/40 text-[color:var(--gold)]">
                            Non rapproché
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div
                      className={`tabular font-medium ${
                        isClient ? "text-[color:var(--revenue)]" : "text-[color:var(--cost)]"
                      }`}
                    >
                      {isClient ? "+" : "−"}
                      {formatEUR(p.montant)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Factures fournisseur */}
      {!isClient && (
        <section>
          <h2 className="font-display text-xl mb-4 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Factures
          </h2>
          <Card className="border-border/60 overflow-hidden">
            {facturesFournisseur.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Aucune facture"
                description="Aucune facture enregistrée pour ce fournisseur."
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {facturesFournisseur.map((f) => {
                  const dossier = dossiers.find((d) => d.id === f.dossier_id);
                  const enRetard = !f.paye && f.date_echeance && new Date(f.date_echeance) < today;
                  return (
                    <li key={f.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {dossier?.titre ?? "Sans dossier"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-2">
                          {f.date_echeance && (
                            <>
                              <CalendarClock className="h-3 w-3" />
                              {formatDate(f.date_echeance)}
                            </>
                          )}
                          {enRetard && (
                            <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                              En retard
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={f.paye ? "default" : "outline"} className="text-[10px]">
                          {f.paye ? "Payée" : "À payer"}
                        </Badge>
                        <div className="tabular font-medium text-[color:var(--cost)]">
                          {formatEUR(f.montant)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      )}

      {/* Historique */}
      <section>
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          Historique
        </h2>
        <Card className="border-border/60 overflow-hidden">
          {timeline.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Aucun événement"
              description="L'activité de ce contact apparaîtra ici."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {timeline.slice(0, 30).map((e, i) => {
                const Icon =
                  e.type === "dossier" ? FolderOpen :
                  e.type === "facture" ? Receipt :
                  e.tone === "revenue" ? TrendingUp : TrendingDown;
                const iconColor =
                  e.tone === "revenue" ? "text-[color:var(--revenue)]" :
                  e.tone === "cost" ? "text-[color:var(--cost)]" :
                  "text-muted-foreground";
                const content = (
                  <div className="px-5 py-3 flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0 ${iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {formatDate(e.date)} · {e.detail}
                      </div>
                    </div>
                    {typeof e.montant === "number" && (
                      <div
                        className={`tabular text-sm font-medium shrink-0 ${
                          e.tone === "revenue"
                            ? "text-[color:var(--revenue)]"
                            : e.tone === "cost"
                              ? "text-[color:var(--cost)]"
                              : ""
                        }`}
                      >
                        {e.tone === "revenue" ? "+" : e.tone === "cost" ? "−" : ""}
                        {formatEUR(e.montant)}
                      </div>
                    )}
                  </div>
                );
                return (
                  <li key={i} className="hover:bg-secondary/40 transition-colors">
                    {e.href ? (
                      <Link to={e.href.to} params={e.href.params as { id: string }}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Marge récap pour clients */}
      {isClient && dossiersClient.length > 0 && (
        <Card className="p-5 border-border/60 bg-secondary/30">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <PiggyBank className="h-3.5 w-3.5" />
            Synthèse rentabilité
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">CA</div>
              <div className="tabular font-semibold text-base">{formatEUR(ca)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Marge nette</div>
              <div className={`tabular font-semibold text-base ${margeNette < 0 ? "text-destructive" : "text-[color:var(--margin)]"}`}>
                {formatEUR(margeNette)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Taux marge nette</div>
              <div className="tabular font-semibold text-base">
                {ca > 0 ? formatPercent((margeNette / ca) * 100) : "—"}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
