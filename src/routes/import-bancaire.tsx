import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTable, type Compte, BANQUE_LABELS } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatEUR, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { parseBankCsv, type BankSource, type ParsedBankRow } from "@/lib/bank-import";
import { Upload, FileText, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/import-bancaire")({
  component: () => (
    <RequireAuth>
      <ImportBancairePage />
    </RequireAuth>
  ),
});

type BankTx = {
  id: string;
  date: string;
  libelle_original: string;
  montant: number;
  sens: "credit" | "debit";
  source_banque: BankSource;
  compte_id: string;
  statut: "nouveau" | "rapproche" | "ignore";
};

const SOURCE_LABELS: Record<BankSource, string> = {
  sg: "Société Générale",
  cic: "CIC",
  ebury: "Ebury",
};

function ImportBancairePage() {
  const { user } = useAuth();
  const { data: comptes } = useTable<Compte>("comptes");
  const { data: history, refetch: refetchHistory } = useTable<BankTx>("bank_transactions");

  const [compteId, setCompteId] = useState<string>("");
  const [forcedSource, setForcedSource] = useState<BankSource | "">("");
  const [parsed, setParsed] = useState<{
    rows: ParsedBankRow[];
    errors: string[];
    source: BankSource | null;
    fileName: string;
  } | null>(null);
  const [existingHashes, setExistingHashes] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    if (!compteId) {
      toast.error("Sélectionnez d'abord un compte.");
      return;
    }
    const text = await file.text();
    const result = parseBankCsv(text, forcedSource || undefined);
    setParsed({ ...result, fileName: file.name });

    // Charger les hashes existants pour ce compte pour calculer doublons
    if (user) {
      const hashes = result.rows.map((r) => r.hash_unique);
      if (hashes.length > 0) {
        const { data } = await supabase
          .from("bank_transactions")
          .select("hash_unique")
          .eq("compte_id", compteId)
          .in("hash_unique", hashes);
        setExistingHashes(new Set((data ?? []).map((d) => d.hash_unique)));
      } else {
        setExistingHashes(new Set());
      }
    }
  };

  const summary = useMemo(() => {
    if (!parsed) return null;
    const total = parsed.rows.length;
    const doublons = parsed.rows.filter((r) => existingHashes.has(r.hash_unique)).length;
    const aImporter = total - doublons;
    const credits = parsed.rows
      .filter((r) => !existingHashes.has(r.hash_unique) && r.sens === "credit")
      .reduce((s, r) => s + r.montant, 0);
    const debits = parsed.rows
      .filter((r) => !existingHashes.has(r.hash_unique) && r.sens === "debit")
      .reduce((s, r) => s + r.montant, 0);
    return { total, doublons, aImporter, credits, debits };
  }, [parsed, existingHashes]);

  const validerImport = async () => {
    if (!parsed || !user || !compteId || !parsed.source) return;
    const toInsert = parsed.rows
      .filter((r) => !existingHashes.has(r.hash_unique))
      .map((r) => ({
        user_id: user.id,
        compte_id: compteId,
        date: r.date,
        libelle_original: r.libelle_original,
        libelle_normalise: r.libelle_normalise,
        montant: r.montant,
        sens: r.sens,
        source_banque: parsed.source!,
        hash_unique: r.hash_unique,
      }));
    if (toInsert.length === 0) {
      toast.info("Aucune nouvelle transaction à importer.");
      return;
    }
    setImporting(true);
    const { error } = await supabase.from("bank_transactions").insert(toInsert);
    setImporting(false);
    if (error) return toast.error(error.message);
    const compteNom = comptes.find((c) => c.id === compteId)?.nom ?? "compte";
    await logAudit({
      userId: user.id,
      entity: "bank_transaction",
      action: "import",
      description: `${toInsert.length} transaction${toInsert.length > 1 ? "s" : ""} importée${toInsert.length > 1 ? "s" : ""} (${parsed.fileName} → ${compteNom})`,
      newValue: { fichier: parsed.fileName, source: parsed.source, compte: compteNom, lignes: toInsert.length },
    });
    toast.success(`${toInsert.length} transaction${toInsert.length > 1 ? "s" : ""} importée${toInsert.length > 1 ? "s" : ""}`);
    setParsed(null);
    setExistingHashes(new Set());
    if (fileRef.current) fileRef.current.value = "";
    refetchHistory();
  };

  const reset = () => {
    setParsed(null);
    setExistingHashes(new Set());
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Import bancaire"
        description="Importez vos relevés CSV (SG, CIC, Ebury) pour préparer le rapprochement"
      />

      {/* Zone import */}
      <Card className="border-border/60 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Compte concerné</Label>
            <Select value={compteId} onValueChange={setCompteId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un compte…" />
              </SelectTrigger>
              <SelectContent>
                {comptes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom} — {BANQUE_LABELS[c.banque]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Banque (optionnel — auto-détection)</Label>
            <Select value={forcedSource} onValueChange={(v) => setForcedSource(v as BankSource | "")}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-détection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sg">Société Générale</SelectItem>
                <SelectItem value="cic">CIC</SelectItem>
                <SelectItem value="ebury">Ebury</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fichier CSV</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              disabled={!compteId}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer file:font-medium disabled:opacity-50"
            />
          </div>
        </div>

        {comptes.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Aucun compte configuré</AlertTitle>
            <AlertDescription>
              Créez d'abord vos comptes dans la section "Comptes & Trésorerie" pour pouvoir y rattacher les transactions importées.
            </AlertDescription>
          </Alert>
        )}
      </Card>

      {/* Résumé + erreurs */}
      {parsed && (
        <>
          {parsed.errors.length > 0 && (
            <Alert variant={parsed.rows.length === 0 ? "destructive" : "default"}>
              <FileWarning className="h-4 w-4" />
              <AlertTitle>
                {parsed.rows.length === 0 ? "Import impossible" : `${parsed.errors.length} avertissement${parsed.errors.length > 1 ? "s" : ""}`}
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-2 text-xs space-y-1 max-h-32 overflow-auto">
                  {parsed.errors.slice(0, 8).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {parsed.errors.length > 8 && <li>… et {parsed.errors.length - 8} autres</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {summary && parsed.rows.length > 0 && (
            <Card className="border-border/60 p-6 space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-display text-lg">{parsed.fileName}</h2>
                    {parsed.source && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        {SOURCE_LABELS[parsed.source]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Prévisualisation avant import définitif
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset}>Annuler</Button>
                  <Button onClick={validerImport} disabled={importing || summary.aImporter === 0}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {importing ? "Import…" : `Valider (${summary.aImporter})`}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryTile label="Lignes détectées" value={`${summary.total}`} />
                <SummaryTile label="Doublons ignorés" value={`${summary.doublons}`} tone="muted" />
                <SummaryTile label="Total crédits" value={formatEUR(summary.credits)} tone="revenue" />
                <SummaryTile label="Total débits" value={formatEUR(summary.debits)} tone="cost" />
              </div>

              <div className="rounded-md border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableHead>Date</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Sens</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.slice(0, 50).map((r, i) => {
                      const dup = existingHashes.has(r.hash_unique);
                      return (
                        <TableRow key={i} className={dup ? "opacity-50" : ""}>
                          <TableCell className="tabular text-xs">{formatDate(r.date)}</TableCell>
                          <TableCell className="text-sm max-w-md truncate" title={r.libelle_original}>
                            {r.libelle_original}
                          </TableCell>
                          <TableCell className={`text-right tabular ${r.sens === "credit" ? "text-[color:var(--revenue)]" : "text-[color:var(--cost)]"}`}>
                            {r.sens === "credit" ? "+" : "−"}{formatEUR(r.montant)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {r.sens === "credit" ? "Crédit" : "Débit"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {dup ? (
                              <span className="text-xs text-muted-foreground">Doublon</span>
                            ) : (
                              <span className="text-xs text-[color:var(--revenue)]">Nouveau</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {parsed.rows.length > 50 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-secondary/20">
                    +{parsed.rows.length - 50} autres lignes non affichées
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Historique */}
      <Card className="border-border/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <h2 className="font-display text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            Transactions importées
          </h2>
          <span className="text-xs text-muted-foreground">{history.length} transaction{history.length > 1 ? "s" : ""}</span>
        </div>
        {history.length === 0 ? (
          <EmptyState
            icon={Upload}
            title="Aucune transaction importée"
            description="Sélectionnez un compte et téléversez un fichier CSV bancaire pour commencer."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead>Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead>Banque</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.slice(0, 100).map((tx) => {
                const compte = comptes.find((c) => c.id === tx.compte_id);
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="tabular text-xs">{formatDate(tx.date)}</TableCell>
                    <TableCell className="text-sm max-w-md truncate" title={tx.libelle_original}>
                      {tx.libelle_original}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{compte?.nom ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        {SOURCE_LABELS[tx.source_banque]}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right tabular ${tx.sens === "credit" ? "text-[color:var(--revenue)]" : "text-[color:var(--cost)]"}`}>
                      {tx.sens === "credit" ? "+" : "−"}{formatEUR(tx.montant)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={tx.statut === "rapproche" ? "default" : "secondary"}
                        className="text-[10px] uppercase tracking-wider"
                      >
                        {tx.statut === "rapproche" ? "Rapproché" : tx.statut === "ignore" ? "Ignoré" : "Nouveau"}
                      </Badge>
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

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "revenue" | "cost";
}) {
  const colorMap: Record<string, string> = {
    revenue: "var(--revenue)",
    cost: "var(--cost)",
    muted: "var(--muted-foreground)",
    default: "var(--foreground)",
  };
  const Icon = tone === "revenue" ? TrendingUp : tone === "cost" ? TrendingDown : null;
  return (
    <div className="rounded-md border border-border/60 bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" style={{ color: colorMap[tone] }} />}
        <div className="text-lg font-semibold tabular" style={{ color: colorMap[tone] }}>
          {value}
        </div>
      </div>
    </div>
  );
}
