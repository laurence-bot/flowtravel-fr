import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import {
  useTable,
  type Paiement,
  type Dossier,
  type Contact,
  type Compte,
  type Facture,
  type BankTransaction,
  BANQUE_LABELS,
} from "@/hooks/use-data";
import { computeTvaMarge } from "@/lib/finance";
import { formatEUR } from "@/lib/format";
import {
  buildCSV,
  downloadCSV,
  formatDateFR,
  formatNumberFR,
} from "@/lib/csv-export";
import {
  FileDown,
  Eye,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Percent,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/export")({
  component: () => (
    <RequireAuth>
      <ExportPage />
    </RequireAuth>
  ),
});

type DataType = "paiements_clients" | "paiements_fournisseurs" | "factures" | "tva_marge";
type StatutFiltre = "tous" | "rapproche" | "non_rapproche";

function ExportPage() {
  const { data: paiements } = useTable<Paiement>("paiements");
  const { data: dossiers } = useTable<Dossier>("dossiers");
  const { data: contacts } = useTable<Contact>("contacts");
  const { data: comptes } = useTable<Compte>("comptes");
  const { data: factures } = useTable<Facture>("factures_fournisseurs");
  const { data: bankTx } = useTable<BankTransaction>("bank_transactions");

  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [type, setType] = useState<DataType>("paiements_clients");
  const [statut, setStatut] = useState<StatutFiltre>("tous");
  const [compteId, setCompteId] = useState<string>("tous");
  const [dossierId, setDossierId] = useState<string>("tous");
  const [previewMode, setPreviewMode] = useState(false);

  const dossierMap = useMemo(() => new Map(dossiers.map((d) => [d.id, d])), [dossiers]);
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const compteMap = useMemo(() => new Map(comptes.map((c) => [c.id, c])), [comptes]);
  const bankTxMap = useMemo(() => new Map(bankTx.map((b) => [b.id, b])), [bankTx]);

  const inPeriod = (date: string) => {
    if (dateDebut && date < dateDebut) return false;
    if (dateFin && date > dateFin) return false;
    return true;
  };

  // Filtres communs paiements
  const filteredPaiementsClients = useMemo(
    () =>
      paiements.filter(
        (p) =>
          p.type === "paiement_client" &&
          inPeriod(p.date) &&
          (statut === "tous" || p.statut_rapprochement === statut) &&
          (compteId === "tous" || p.compte_id === compteId) &&
          (dossierId === "tous" || p.dossier_id === dossierId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paiements, dateDebut, dateFin, statut, compteId, dossierId],
  );

  const filteredPaiementsFournisseurs = useMemo(
    () =>
      paiements.filter(
        (p) =>
          p.type === "paiement_fournisseur" &&
          inPeriod(p.date) &&
          (statut === "tous" || p.statut_rapprochement === statut) &&
          (compteId === "tous" || p.compte_id === compteId) &&
          (dossierId === "tous" || p.dossier_id === dossierId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paiements, dateDebut, dateFin, statut, compteId, dossierId],
  );

  const filteredFactures = useMemo(
    () =>
      factures.filter((f) => {
        if (dateDebut && f.date_echeance && f.date_echeance < dateDebut) return false;
        if (dateFin && f.date_echeance && f.date_echeance > dateFin) return false;
        if (dossierId !== "tous" && f.dossier_id !== dossierId) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [factures, dateDebut, dateFin, dossierId],
  );

  const filteredDossiersTva = useMemo(
    () => (dossierId === "tous" ? dossiers : dossiers.filter((d) => d.id === dossierId)),
    [dossiers, dossierId],
  );

  // Totaux résumé global (toujours sur la période)
  const totalEncaisse = filteredPaiementsClients.reduce((s, p) => s + Number(p.montant), 0);
  const totalDecaisse = filteredPaiementsFournisseurs.reduce((s, p) => s + Number(p.montant), 0);
  const tvaTotale = filteredDossiersTva.reduce((s, d) => s + computeTvaMarge(d).tvaSurMarge, 0);
  const margeNetteTotale = filteredDossiersTva.reduce(
    (s, d) => s + computeTvaMarge(d).margeNette,
    0,
  );

  const nbNonRapproches =
    filteredPaiementsClients.filter((p) => p.statut_rapprochement !== "rapproche").length +
    filteredPaiementsFournisseurs.filter((p) => p.statut_rapprochement !== "rapproche").length;
  const nbFacturesNonPayees = filteredFactures.filter((f) => !f.paye).length;

  // Construction CSV selon type
  const buildExport = (): { filename: string; csv: string; rows: number } => {
    if (type === "paiements_clients") {
      const headers = [
        "Type",
        "Date",
        "Dossier",
        "Client",
        "Montant",
        "Compte",
        "Banque",
        "Méthode",
        "Statut rapprochement",
        "Transaction bancaire",
      ];
      const rows = filteredPaiementsClients.map((p) => {
        const d = p.dossier_id ? dossierMap.get(p.dossier_id) : null;
        const c = p.personne_id ? contactMap.get(p.personne_id) : null;
        const cpt = p.compte_id ? compteMap.get(p.compte_id) : null;
        const bt = p.bank_transaction_id ? bankTxMap.get(p.bank_transaction_id) : null;
        return [
          "Encaissement client",
          formatDateFR(p.date),
          d?.titre ?? "",
          c?.nom ?? "",
          formatNumberFR(p.montant),
          cpt?.nom ?? "",
          cpt ? BANQUE_LABELS[cpt.banque] : "",
          p.methode,
          p.statut_rapprochement === "rapproche" ? "Rapproché" : "Non rapproché",
          bt?.libelle_original ?? "",
        ];
      });
      return {
        filename: `encaissements_clients_${Date.now()}.csv`,
        csv: buildCSV(headers, rows),
        rows: rows.length,
      };
    }
    if (type === "paiements_fournisseurs") {
      const headers = [
        "Type",
        "Date",
        "Dossier",
        "Fournisseur",
        "Montant",
        "Compte",
        "Banque",
        "Méthode",
        "Statut rapprochement",
        "Transaction bancaire",
      ];
      const rows = filteredPaiementsFournisseurs.map((p) => {
        const d = p.dossier_id ? dossierMap.get(p.dossier_id) : null;
        const c = p.personne_id ? contactMap.get(p.personne_id) : null;
        const cpt = p.compte_id ? compteMap.get(p.compte_id) : null;
        const bt = p.bank_transaction_id ? bankTxMap.get(p.bank_transaction_id) : null;
        return [
          "Décaissement fournisseur",
          formatDateFR(p.date),
          d?.titre ?? "",
          c?.nom ?? "",
          formatNumberFR(p.montant),
          cpt?.nom ?? "",
          cpt ? BANQUE_LABELS[cpt.banque] : "",
          p.methode,
          p.statut_rapprochement === "rapproche" ? "Rapproché" : "Non rapproché",
          bt?.libelle_original ?? "",
        ];
      });
      return {
        filename: `decaissements_fournisseurs_${Date.now()}.csv`,
        csv: buildCSV(headers, rows),
        rows: rows.length,
      };
    }
    if (type === "factures") {
      const headers = [
        "Date échéance",
        "Dossier",
        "Fournisseur",
        "Montant",
        "Statut",
      ];
      const rows = filteredFactures.map((f) => {
        const d = f.dossier_id ? dossierMap.get(f.dossier_id) : null;
        const c = f.fournisseur_id ? contactMap.get(f.fournisseur_id) : null;
        return [
          formatDateFR(f.date_echeance),
          d?.titre ?? "",
          c?.nom ?? "",
          formatNumberFR(f.montant),
          f.paye ? "Payée" : "Non payée",
        ];
      });
      return {
        filename: `factures_fournisseurs_${Date.now()}.csv`,
        csv: buildCSV(headers, rows),
        rows: rows.length,
      };
    }
    // tva_marge
    const headers = [
      "Dossier",
      "Statut",
      "Prix de vente",
      "Coûts fournisseurs",
      "Marge brute",
      "Taux TVA (%)",
      "TVA sur marge",
      "Marge nette",
    ];
    const rows = filteredDossiersTva.map((d) => {
      const t = computeTvaMarge(d);
      return [
        d.titre,
        d.statut,
        formatNumberFR(d.prix_vente),
        formatNumberFR(d.cout_total),
        formatNumberFR(t.margeBrute),
        formatNumberFR(t.tauxTva, 2),
        formatNumberFR(t.tvaSurMarge),
        formatNumberFR(t.margeNette),
      ];
    });
    return {
      filename: `tva_sur_marge_${Date.now()}.csv`,
      csv: buildCSV(headers, rows),
      rows: rows.length,
    };
  };

  const currentRowsCount =
    type === "paiements_clients"
      ? filteredPaiementsClients.length
      : type === "paiements_fournisseurs"
      ? filteredPaiementsFournisseurs.length
      : type === "factures"
      ? filteredFactures.length
      : filteredDossiersTva.length;

  const handleDownload = () => {
    if (currentRowsCount === 0) {
      toast.error("Aucune donnée à exporter pour ces filtres.");
      return;
    }
    const { filename, csv, rows } = buildExport();
    downloadCSV(filename, csv);
    toast.success(`${rows} ligne${rows > 1 ? "s" : ""} exportée${rows > 1 ? "s" : ""}.`);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Export comptable"
        description="Préparez et téléchargez vos données financières au format CSV (compatible Excel)."
      />

      {/* Résumé global */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Encaissements"
          value={formatEUR(totalEncaisse)}
          icon={TrendingUp}
          tone="revenue"
        />
        <SummaryCard
          label="Décaissements"
          value={formatEUR(totalDecaisse)}
          icon={TrendingDown}
          tone="cost"
        />
        <SummaryCard
          label="TVA sur marge"
          value={formatEUR(tvaTotale)}
          icon={Percent}
          tone="cash"
        />
        <SummaryCard
          label="Marge nette"
          value={formatEUR(margeNetteTotale)}
          icon={Wallet}
          tone="margin"
        />
      </div>

      {/* Filtres */}
      <Card className="p-6 space-y-5">
        <h2 className="font-display text-lg">Filtres</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Type de données</Label>
            <Select value={type} onValueChange={(v) => setType(v as DataType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paiements_clients">Paiements clients</SelectItem>
                <SelectItem value="paiements_fournisseurs">Paiements fournisseurs</SelectItem>
                <SelectItem value="factures">Factures fournisseurs</SelectItem>
                <SelectItem value="tva_marge">TVA sur marge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date de début</Label>
            <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Date de fin</Label>
            <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Dossier</Label>
            <Select value={dossierId} onValueChange={setDossierId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les dossiers</SelectItem>
                {dossiers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.titre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(type === "paiements_clients" || type === "paiements_fournisseurs") && (
            <>
              <div className="space-y-1.5">
                <Label>Compte bancaire</Label>
                <Select value={compteId} onValueChange={setCompteId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous les comptes</SelectItem>
                    {comptes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut rapprochement</Label>
                <Select value={statut} onValueChange={(v) => setStatut(v as StatutFiltre)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous</SelectItem>
                    <SelectItem value="rapproche">Rapprochés</SelectItem>
                    <SelectItem value="non_rapproche">Non rapprochés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular">{currentRowsCount}</span>{" "}
            ligne{currentRowsCount > 1 ? "s" : ""} prête{currentRowsCount > 1 ? "s" : ""} à exporter
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreviewMode((v) => !v)}>
              <Eye className="h-4 w-4 mr-2" />
              {previewMode ? "Masquer l’aperçu" : "Prévisualiser"}
            </Button>
            <Button onClick={handleDownload} disabled={currentRowsCount === 0}>
              <FileDown className="h-4 w-4 mr-2" />
              Télécharger CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* Alertes */}
      {(nbNonRapproches > 0 || nbFacturesNonPayees > 0) && (
        <Card className="p-4 border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[color:var(--gold)] shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <div className="font-medium text-foreground">Données à vérifier</div>
              {nbNonRapproches > 0 && (
                <div className="text-muted-foreground">
                  {nbNonRapproches} paiement{nbNonRapproches > 1 ? "s" : ""} non rapproché{nbNonRapproches > 1 ? "s" : ""} sur la période.
                </div>
              )}
              {nbFacturesNonPayees > 0 && (
                <div className="text-muted-foreground">
                  {nbFacturesNonPayees} facture{nbFacturesNonPayees > 1 ? "s" : ""} fournisseur non payée{nbFacturesNonPayees > 1 ? "s" : ""}.
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Prévisualisation */}
      {previewMode && (
        <Card className="overflow-hidden">
          <Tabs value={type} onValueChange={(v) => setType(v as DataType)}>
            <div className="px-4 pt-4">
              <TabsList>
                <TabsTrigger value="paiements_clients">Clients</TabsTrigger>
                <TabsTrigger value="paiements_fournisseurs">Fournisseurs</TabsTrigger>
                <TabsTrigger value="factures">Factures</TabsTrigger>
                <TabsTrigger value="tva_marge">TVA marge</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="paiements_clients" className="m-0">
              <PreviewClients
                items={filteredPaiementsClients}
                dossierMap={dossierMap}
                contactMap={contactMap}
                compteMap={compteMap}
              />
            </TabsContent>
            <TabsContent value="paiements_fournisseurs" className="m-0">
              <PreviewFournisseurs
                items={filteredPaiementsFournisseurs}
                dossierMap={dossierMap}
                contactMap={contactMap}
                compteMap={compteMap}
              />
            </TabsContent>
            <TabsContent value="factures" className="m-0">
              <PreviewFactures
                items={filteredFactures}
                dossierMap={dossierMap}
                contactMap={contactMap}
              />
            </TabsContent>
            <TabsContent value="tva_marge" className="m-0">
              <PreviewTva items={filteredDossiersTva} />
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "revenue" | "cost" | "margin" | "cash";
}) {
  const colorVar = `var(--${tone})`;
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: colorVar }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-xl font-semibold tabular text-foreground">{value}</div>
        </div>
        <div
          className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in oklab, ${colorVar} 12%, transparent)`, color: colorVar }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function PreviewClients({
  items,
  dossierMap,
  contactMap,
  compteMap,
}: {
  items: Paiement[];
  dossierMap: Map<string, Dossier>;
  contactMap: Map<string, Contact>;
  compteMap: Map<string, Compte>;
}) {
  if (items.length === 0) {
    return <EmptyState icon={FileDown} title="Aucun encaissement" description="Aucun paiement client ne correspond aux filtres." />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Dossier</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Compte</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Rapprochement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.slice(0, 50).map((p) => {
            const d = p.dossier_id ? dossierMap.get(p.dossier_id) : null;
            const c = p.personne_id ? contactMap.get(p.personne_id) : null;
            const cpt = p.compte_id ? compteMap.get(p.compte_id) : null;
            return (
              <TableRow key={p.id}>
                <TableCell className="tabular">{formatDateFR(p.date)}</TableCell>
                <TableCell>{d?.titre ?? "—"}</TableCell>
                <TableCell>{c?.nom ?? "—"}</TableCell>
                <TableCell>{cpt?.nom ?? "—"}</TableCell>
                <TableCell className="text-right tabular text-[color:var(--revenue)] font-medium">
                  {formatEUR(p.montant)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={p.statut_rapprochement === "rapproche" ? "bg-[color:var(--margin)]/10 text-[color:var(--margin)] border-[color:var(--margin)]/20" : ""}>
                    {p.statut_rapprochement === "rapproche" ? "Rapproché" : "En attente"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {items.length > 50 && (
        <div className="px-4 py-3 text-xs text-muted-foreground border-t">
          Aperçu limité à 50 lignes — l’export contiendra l’intégralité ({items.length}).
        </div>
      )}
    </div>
  );
}

function PreviewFournisseurs({
  items,
  dossierMap,
  contactMap,
  compteMap,
}: {
  items: Paiement[];
  dossierMap: Map<string, Dossier>;
  contactMap: Map<string, Contact>;
  compteMap: Map<string, Compte>;
}) {
  if (items.length === 0) {
    return <EmptyState icon={FileDown} title="Aucun décaissement" description="Aucun paiement fournisseur ne correspond aux filtres." />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Dossier</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead>Compte</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Rapprochement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.slice(0, 50).map((p) => {
            const d = p.dossier_id ? dossierMap.get(p.dossier_id) : null;
            const c = p.personne_id ? contactMap.get(p.personne_id) : null;
            const cpt = p.compte_id ? compteMap.get(p.compte_id) : null;
            return (
              <TableRow key={p.id}>
                <TableCell className="tabular">{formatDateFR(p.date)}</TableCell>
                <TableCell>{d?.titre ?? "—"}</TableCell>
                <TableCell>{c?.nom ?? "—"}</TableCell>
                <TableCell>{cpt?.nom ?? "—"}</TableCell>
                <TableCell className="text-right tabular text-[color:var(--cost)] font-medium">
                  {formatEUR(p.montant)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={p.statut_rapprochement === "rapproche" ? "bg-[color:var(--margin)]/10 text-[color:var(--margin)] border-[color:var(--margin)]/20" : ""}>
                    {p.statut_rapprochement === "rapproche" ? "Rapproché" : "En attente"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {items.length > 50 && (
        <div className="px-4 py-3 text-xs text-muted-foreground border-t">
          Aperçu limité à 50 lignes — l’export contiendra l’intégralité ({items.length}).
        </div>
      )}
    </div>
  );
}

function PreviewFactures({
  items,
  dossierMap,
  contactMap,
}: {
  items: Facture[];
  dossierMap: Map<string, Dossier>;
  contactMap: Map<string, Contact>;
}) {
  if (items.length === 0) {
    return <EmptyState icon={FileDown} title="Aucune facture" description="Aucune facture fournisseur ne correspond aux filtres." />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Échéance</TableHead>
            <TableHead>Dossier</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.slice(0, 50).map((f) => {
            const d = f.dossier_id ? dossierMap.get(f.dossier_id) : null;
            const c = f.fournisseur_id ? contactMap.get(f.fournisseur_id) : null;
            return (
              <TableRow key={f.id}>
                <TableCell className="tabular">{formatDateFR(f.date_echeance)}</TableCell>
                <TableCell>{d?.titre ?? "—"}</TableCell>
                <TableCell>{c?.nom ?? "—"}</TableCell>
                <TableCell className="text-right tabular">{formatEUR(f.montant)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={f.paye ? "bg-[color:var(--margin)]/10 text-[color:var(--margin)] border-[color:var(--margin)]/20" : "bg-[color:var(--gold)]/10 text-[color:var(--gold)] border-[color:var(--gold)]/20"}>
                    {f.paye ? "Payée" : "Non payée"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PreviewTva({ items }: { items: Dossier[] }) {
  if (items.length === 0) {
    return <EmptyState icon={FileDown} title="Aucun dossier" description="Aucun dossier ne correspond aux filtres." />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dossier</TableHead>
            <TableHead className="text-right">Prix vente</TableHead>
            <TableHead className="text-right">Coûts</TableHead>
            <TableHead className="text-right">Marge brute</TableHead>
            <TableHead className="text-right">TVA marge</TableHead>
            <TableHead className="text-right">Marge nette</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.slice(0, 50).map((d) => {
            const t = computeTvaMarge(d);
            return (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.titre}</TableCell>
                <TableCell className="text-right tabular">{formatEUR(d.prix_vente)}</TableCell>
                <TableCell className="text-right tabular">{formatEUR(d.cout_total)}</TableCell>
                <TableCell className="text-right tabular">{formatEUR(t.margeBrute)}</TableCell>
                <TableCell className="text-right tabular text-[color:var(--cash)]">{formatEUR(t.tvaSurMarge)}</TableCell>
                <TableCell className="text-right tabular text-[color:var(--margin)] font-medium">{formatEUR(t.margeNette)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
