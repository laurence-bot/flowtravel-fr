import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useTable,
  type BankTransaction,
  type Paiement,
  type Dossier,
  type Contact,
  type Compte,
  BANQUE_LABELS,
} from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatEUR, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  suggestPaiementsForTransaction,
  scoreTone,
  type Suggestion,
} from "@/lib/reconciliation";
import {
  Link2,
  CheckCircle2,
  XCircle,
  EyeOff,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rapprochement")({
  component: () => (
    <RequireAuth>
      <RapprochementPage />
    </RequireAuth>
  ),
});

function RapprochementPage() {
  const { user } = useAuth();
  const { data: bankTx, refetch: refetchTx } = useTable<BankTransaction>("bank_transactions");
  const { data: paiements, refetch: refetchPaiements } = useTable<Paiement>("paiements");
  const { data: dossiers } = useTable<Dossier>("dossiers");
  const { data: contacts } = useTable<Contact>("contacts");
  const { data: comptes } = useTable<Compte>("comptes");

  const [busy, setBusy] = useState<string | null>(null);
  const [manualPick, setManualPick] = useState<Record<string, string>>({});

  const compteNom = (id: string) => comptes.find((c) => c.id === id)?.nom ?? "—";

  const aRapprocher = useMemo(
    () => bankTx.filter((t) => t.statut === "nouveau"),
    [bankTx],
  );

  const suggestionsByTx = useMemo(() => {
    const map = new Map<string, Suggestion[]>();
    for (const tx of aRapprocher) {
      map.set(tx.id, suggestPaiementsForTransaction(tx, paiements, dossiers, contacts));
    }
    return map;
  }, [aRapprocher, paiements, dossiers, contacts]);

  const totalSuggestions = useMemo(
    () => Array.from(suggestionsByTx.values()).reduce((s, l) => s + l.length, 0),
    [suggestionsByTx],
  );

  const paiementsNonRapproches = useMemo(
    () => paiements.filter((p) => p.statut_rapprochement !== "rapproche"),
    [paiements],
  );

  /**
   * Vérifie la cohérence sens bancaire ↔ type paiement.
   * Crédit ↔ paiement client, Débit ↔ paiement fournisseur.
   */
  function isCoherent(tx: BankTransaction, p: Paiement): boolean {
    return (
      (tx.sens === "credit" && p.type === "paiement_client") ||
      (tx.sens === "debit" && p.type === "paiement_fournisseur")
    );
  }

  async function validate(tx: BankTransaction, paiement: Paiement, score: number, reason: string) {
    if (!user) return;
    if (paiement.statut_rapprochement === "rapproche") {
      toast.error("Ce paiement est déjà rapproché");
      return;
    }
    if (tx.statut === "rapproche") {
      toast.error("Cette transaction est déjà rapprochée");
      return;
    }
    if (!isCoherent(tx, paiement)) {
      toast.error("Sens incohérent : un crédit doit correspondre à un paiement client, un débit à un paiement fournisseur.");
      return;
    }
    setBusy(tx.id);
    try {
      // 1. Insert rapprochement validé
      const { error: e1 } = await supabase.from("rapprochements").insert({
        user_id: user.id,
        bank_transaction_id: tx.id,
        paiement_id: paiement.id,
        score,
        statut: "valide",
        raison: reason,
        validated_at: new Date().toISOString(),
      });
      if (e1) throw e1;

      // 2. Marquer paiement comme rapproché
      const { error: e2 } = await supabase
        .from("paiements")
        .update({
          statut_rapprochement: "rapproche",
          bank_transaction_id: tx.id,
        })
        .eq("id", paiement.id);
      if (e2) throw e2;

      // 3. Marquer transaction comme rapprochée
      const { error: e3 } = await supabase
        .from("bank_transactions")
        .update({ statut: "rapproche" })
        .eq("id", tx.id);
      if (e3) throw e3;

      toast.success("Rapprochement validé");
      await Promise.all([refetchTx(), refetchPaiements()]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la validation";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function reject(tx: BankTransaction, paiement: Paiement, score: number, reason: string) {
    if (!user) return;
    setBusy(tx.id);
    try {
      const { error } = await supabase.from("rapprochements").insert({
        user_id: user.id,
        bank_transaction_id: tx.id,
        paiement_id: paiement.id,
        score,
        statut: "rejete",
        raison: reason,
      });
      if (error) throw error;
      toast.success("Suggestion rejetée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du rejet");
    } finally {
      setBusy(null);
    }
  }

  async function ignore(tx: BankTransaction) {
    if (!user) return;
    setBusy(tx.id);
    try {
      const { error } = await supabase
        .from("bank_transactions")
        .update({ statut: "ignore" })
        .eq("id", tx.id);
      if (error) throw error;
      toast.success("Transaction ignorée");
      await refetchTx();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Rapprochement bancaire"
        description="Liez automatiquement vos transactions bancaires aux paiements enregistrés."
      />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            À rapprocher
          </div>
          <div className="mt-2 text-xl font-semibold tabular">{aRapprocher.length}</div>
        </Card>
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Suggestions automatiques
          </div>
          <div className="mt-2 text-xl font-semibold tabular text-[color:var(--gold)]">
            {totalSuggestions}
          </div>
        </Card>
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Paiements en attente
          </div>
          <div className="mt-2 text-xl font-semibold tabular">{paiementsNonRapproches.length}</div>
        </Card>
      </section>

      {aRapprocher.length === 0 ? (
        <Card className="border-border/60">
          <EmptyState
            icon={CheckCircle2}
            title="Aucune transaction à rapprocher"
            description="Importez un relevé bancaire pour démarrer le rapprochement automatique."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {aRapprocher.map((tx) => {
            const suggestions = suggestionsByTx.get(tx.id) ?? [];
            const isCredit = tx.sens === "credit";
            return (
              <Card key={tx.id} className="border-border/60 overflow-hidden">
                {/* Header transaction */}
                <div className="px-5 py-4 border-b border-border/60 flex flex-wrap items-center gap-4 justify-between bg-secondary/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${
                        isCredit
                          ? "bg-[color:var(--revenue)]/10 text-[color:var(--revenue)]"
                          : "bg-[color:var(--cost)]/10 text-[color:var(--cost)]"
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{tx.libelle_original}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(tx.date)} · {compteNom(tx.compte_id)} ·{" "}
                        {BANQUE_LABELS[tx.source_banque as keyof typeof BANQUE_LABELS] ?? tx.source_banque}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`tabular text-lg font-semibold ${
                        isCredit ? "text-[color:var(--revenue)]" : "text-[color:var(--cost)]"
                      }`}
                    >
                      {isCredit ? "+" : "−"}
                      {formatEUR(tx.montant)}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => ignore(tx)}
                      disabled={busy === tx.id}
                    >
                      <EyeOff className="h-3.5 w-3.5 mr-1" />
                      Ignorer
                    </Button>
                  </div>
                </div>

                {/* Suggestions */}
                {suggestions.length > 0 ? (
                  <ul className="divide-y divide-border/60">
                    {suggestions.map((s) => {
                      const tone = scoreTone(s.score);
                      const reason = s.reasons.map((r) => r.label).join(" · ");
                      return (
                        <li key={s.paiement.id} className="px-5 py-4">
                          <div className="flex flex-wrap items-start gap-4 justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge
                                  variant="outline"
                                  className={
                                    tone === "high"
                                      ? "bg-[color:var(--margin)]/12 text-[color:var(--margin)] border-[color:var(--margin)]/25"
                                      : "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border-[color:var(--gold)]/25"
                                  }
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Score {Math.round(s.score)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(s.paiement.date)} · {formatEUR(s.paiement.montant)}
                                </span>
                              </div>
                              <div className="text-sm">
                                {s.contact?.nom ?? "Sans contact"}
                                {s.dossier && (
                                  <span className="text-muted-foreground"> · {s.dossier.titre}</span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1">{reason}</div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                onClick={() => validate(tx, s.paiement, s.score, reason)}
                                disabled={busy === tx.id}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Valider
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => reject(tx, s.paiement, s.score, reason)}
                                disabled={busy === tx.id}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Rejeter
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-5 py-4 text-sm text-muted-foreground">
                    Aucune suggestion automatique fiable.
                  </div>
                )}

                {/* Recherche manuelle */}
                <div className="px-5 py-3 bg-secondary/15 border-t border-border/60 flex flex-wrap items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Recherche manuelle :</span>
                  <div className="flex-1 min-w-[200px]">
                    <Select
                      value={manualPick[tx.id] ?? ""}
                      onValueChange={(v) => setManualPick((m) => ({ ...m, [tx.id]: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Choisir un paiement…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const expectedType = tx.sens === "credit" ? "paiement_client" : "paiement_fournisseur";
                          const candidats = paiementsNonRapproches.filter((p) => p.type === expectedType);
                          if (candidats.length === 0) {
                            return (
                              <div className="px-2 py-2 text-xs text-muted-foreground">
                                Aucun paiement {tx.sens === "credit" ? "client" : "fournisseur"} disponible.
                              </div>
                            );
                          }
                          return candidats.map((p) => {
                            const c = contacts.find((x) => x.id === p.personne_id);
                            return (
                              <SelectItem key={p.id} value={p.id}>
                                {formatDate(p.date)} — {formatEUR(p.montant)}
                                {c ? ` · ${c.nom}` : ""}
                              </SelectItem>
                            );
                          });
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!manualPick[tx.id] || busy === tx.id}
                    onClick={() => {
                      const p = paiements.find((x) => x.id === manualPick[tx.id]);
                      if (p) validate(tx, p, 100, "Rapprochement manuel");
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    Lier
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
