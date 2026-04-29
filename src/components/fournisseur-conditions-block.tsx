import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTable } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { DEVISES, type DeviseCode } from "@/lib/fx";
import {
  DEFAULT_CONDITION_VALUES,
  type FournisseurCondition,
  type CancelationTier,
} from "@/lib/fournisseur-conditions";
import { Plus, Trash2, ShieldCheck, ChevronDown, Save, Star } from "lucide-react";
import { toast } from "sonner";

type Props = {
  fournisseurId: string;
  canWrite: boolean;
};

type FormState = {
  nom: string;
  est_principale: boolean;
  devises_acceptees: DeviseCode[];
  pct_acompte_1: string;
  pct_acompte_2: string;
  pct_acompte_3: string;
  pct_solde: string;
  delai_acompte_1_jours: string;
  delai_acompte_2_jours: string;
  delai_acompte_3_jours: string;
  delai_solde_jours: string;
  acompte_1_a_reservation: boolean;
  acompte_2_a_reservation: boolean;
  acompte_3_a_reservation: boolean;
  solde_a_reservation: boolean;
  conditions_annulation: CancelationTier[];
  notes: string;
};

function toForm(c: FournisseurCondition): FormState {
  return {
    nom: c.nom,
    est_principale: c.est_principale,
    devises_acceptees: c.devises_acceptees as DeviseCode[],
    pct_acompte_1: String(c.pct_acompte_1),
    pct_acompte_2: String(c.pct_acompte_2),
    pct_acompte_3: String(c.pct_acompte_3),
    pct_solde: String(c.pct_solde),
    delai_acompte_1_jours: c.delai_acompte_1_jours?.toString() ?? "",
    delai_acompte_2_jours: c.delai_acompte_2_jours?.toString() ?? "",
    delai_acompte_3_jours: c.delai_acompte_3_jours?.toString() ?? "",
    delai_solde_jours: c.delai_solde_jours?.toString() ?? "",
    acompte_1_a_reservation: c.acompte_1_a_reservation ?? false,
    acompte_2_a_reservation: c.acompte_2_a_reservation ?? false,
    acompte_3_a_reservation: c.acompte_3_a_reservation ?? false,
    solde_a_reservation: c.solde_a_reservation ?? false,
    conditions_annulation: c.conditions_annulation ?? [],
    notes: c.notes ?? "",
  };
}

export function FournisseurConditionsBlock({ fournisseurId, canWrite }: Props) {
  const { user } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: all, refetch } = useTable<FournisseurCondition>("fournisseur_conditions" as any);

  const conditions = useMemo(
    () =>
      all
        .filter((c) => c.fournisseur_id === fournisseurId)
        .sort((a, b) => Number(b.est_principale) - Number(a.est_principale)),
    [all, fournisseurId],
  );

  const createNew = async () => {
    if (!user) return;
    const isFirst = conditions.length === 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("fournisseur_conditions").insert({
      user_id: user.id,
      fournisseur_id: fournisseurId,
      ...DEFAULT_CONDITION_VALUES,
      nom: isFirst ? "Standard" : "Nouvelle condition",
      est_principale: isFirst,
    });
    if (error) return toast.error(error.message);
    toast.success(isFirst ? "Condition créée." : "Nouvelle condition ajoutée.");
    refetch();
  };

  return (
    <Card className="border-border/60 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Conditions commerciales
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Devises acceptées · acomptes · délais · pénalités d'annulation
          </p>
        </div>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={createNew}>
            <Plus className="h-4 w-4 mr-1" />
            {conditions.length === 0 ? "Définir les conditions" : "Ajouter une condition"}
          </Button>
        )}
      </div>

      {conditions.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Aucune condition définie. Cliquez sur « Définir les conditions » pour démarrer.
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {conditions.map((c, idx) => (
            <ConditionRow
              key={c.id}
              condition={c}
              defaultOpen={idx === 0 && conditions.length === 1}
              canWrite={canWrite}
              onChanged={refetch}
              fournisseurId={fournisseurId}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ConditionRow({
  condition,
  defaultOpen,
  canWrite,
  onChanged,
  fournisseurId,
}: {
  condition: FournisseurCondition;
  defaultOpen: boolean;
  canWrite: boolean;
  onChanged: () => void;
  fournisseurId: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState<FormState>(toForm(condition));
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(toForm(condition));
    setDirty(false);
  }, [condition.id, condition.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const toggleDevise = (code: DeviseCode) => {
    const cur = form.devises_acceptees;
    if (cur.includes(code)) {
      if (cur.length === 1) return toast.error("Au moins une devise requise.");
      update("devises_acceptees", cur.filter((d) => d !== code));
    } else if (cur.length < 2) {
      update("devises_acceptees", [...cur, code]);
    } else {
      toast.error("Maximum 2 devises.");
    }
  };

  const addTier = () =>
    update("conditions_annulation", [
      ...form.conditions_annulation,
      { jours_avant: 30, pct_penalite: 50 },
    ]);
  const removeTier = (idx: number) =>
    update(
      "conditions_annulation",
      form.conditions_annulation.filter((_, i) => i !== idx),
    );
  const updateTier = (idx: number, patch: Partial<CancelationTier>) =>
    update(
      "conditions_annulation",
      form.conditions_annulation.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    );

  const save = async () => {
    if (!user) return;
    if (!form.nom.trim()) return toast.error("Nom requis.");
    const total =
      Number(form.pct_acompte_1) +
      Number(form.pct_acompte_2) +
      Number(form.pct_acompte_3) +
      Number(form.pct_solde);
    if (Math.abs(total - 100) > 0.01) return toast.error("La somme des % doit faire 100 %.");

    setSubmitting(true);

    // Si on coche "principale", retirer le flag des autres
    if (form.est_principale && !condition.est_principale) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("fournisseur_conditions")
        .update({ est_principale: false })
        .eq("fournisseur_id", fournisseurId);
    }

    const payload = {
      nom: form.nom.trim(),
      est_principale: form.est_principale,
      devises_acceptees: form.devises_acceptees,
      pct_acompte_1: Number(form.pct_acompte_1) || 0,
      pct_acompte_2: Number(form.pct_acompte_2) || 0,
      pct_acompte_3: Number(form.pct_acompte_3) || 0,
      pct_solde: Number(form.pct_solde) || 0,
      delai_acompte_1_jours: form.delai_acompte_1_jours ? Number(form.delai_acompte_1_jours) : null,
      delai_acompte_2_jours: form.delai_acompte_2_jours ? Number(form.delai_acompte_2_jours) : null,
      delai_acompte_3_jours: form.delai_acompte_3_jours ? Number(form.delai_acompte_3_jours) : null,
      delai_solde_jours: form.delai_solde_jours ? Number(form.delai_solde_jours) : null,
      acompte_1_a_reservation: form.acompte_1_a_reservation,
      acompte_2_a_reservation: form.acompte_2_a_reservation,
      acompte_3_a_reservation: form.acompte_3_a_reservation,
      solde_a_reservation: form.solde_a_reservation,
      conditions_annulation: form.conditions_annulation,
      notes: form.notes || null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("fournisseur_conditions")
      .update(payload)
      .eq("id", condition.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);

    await logAudit({
      userId: user.id,
      entity: "fournisseur_condition",
      entityId: condition.id,
      action: "update",
      description: `Condition "${form.nom}" mise à jour`,
    });
    toast.success("Enregistré.");
    setDirty(false);
    onChanged();
  };

  const remove = async () => {
    if (!user) return;
    if (!confirm(`Supprimer la condition "${condition.nom}" ?`)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("fournisseur_conditions")
      .delete()
      .eq("id", condition.id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "fournisseur_condition",
      entityId: condition.id,
      action: "delete",
      description: `Condition supprimée : ${condition.nom}`,
    });
    onChanged();
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full p-4 flex items-center justify-between gap-3 hover:bg-secondary/30 transition-colors text-left">
          <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
            <span className="font-medium">{condition.nom}</span>
            {condition.est_principale && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Star className="h-3 w-3" /> principale
              </Badge>
            )}
            {condition.devises_acceptees.map((d) => (
              <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
            ))}
            <span className="text-xs text-muted-foreground">
              {condition.pct_acompte_1}/{condition.pct_acompte_2}/{condition.pct_acompte_3}/{condition.pct_solde}%
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <fieldset disabled={!canWrite} className="p-4 pt-0 space-y-4 border-t border-border/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={form.nom} onChange={(e) => update("nom", e.target.value)} placeholder="Standard, Safari…" />
            </div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.est_principale}
                  onChange={(e) => update("est_principale", e.target.checked)}
                />
                Condition principale
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Devises acceptées (1 ou 2)</Label>
            <div className="flex flex-wrap gap-1.5">
              {DEVISES.map((d) => {
                const sel = form.devises_acceptees.includes(d.code);
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => toggleDevise(d.code)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      sel
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border hover:bg-secondary/70"
                    }`}
                  >
                    {d.code}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Échéances de paiement</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {(
                [
                  ["pct_acompte_1", "delai_acompte_1_jours", "acompte_1_a_reservation", "Acompte 1"],
                  ["pct_acompte_2", "delai_acompte_2_jours", "acompte_2_a_reservation", "Acompte 2"],
                  ["pct_acompte_3", "delai_acompte_3_jours", "acompte_3_a_reservation", "Acompte 3"],
                  ["pct_solde", "delai_solde_jours", "solde_a_reservation", "Solde"],
                ] as const
              ).map(([pctK, delaiK, resK, label]) => {
                const aReservation = form[resK];
                return (
                  <div key={pctK} className="border border-border/50 rounded-md p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-medium">{label}</Label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className={aReservation ? "text-muted-foreground" : ""}>J-X</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={aReservation}
                          onClick={() => update(resK, !aReservation)}
                          className={`relative w-8 h-4 rounded-full transition-colors ${
                            aReservation ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-background transition-transform ${
                              aReservation ? "translate-x-4" : ""
                            }`}
                          />
                        </button>
                        <span className={!aReservation ? "text-muted-foreground" : ""}>Réservation</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">%</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={form[pctK]}
                          onChange={(e) => update(pctK, e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">
                          {aReservation ? "À la réservation" : "Jours avant prestation"}
                        </Label>
                        <Input
                          type="number"
                          value={aReservation ? "" : form[delaiK]}
                          onChange={(e) => update(delaiK, e.target.value)}
                          placeholder={aReservation ? "—" : "ex: 30"}
                          disabled={aReservation}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              « À la réservation » = dû dès la confirmation de la cotation. « J-X » = X jours avant la prestation.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Conditions d'annulation
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addTier}>
                <Plus className="h-3 w-3 mr-1" /> Tranche
              </Button>
            </div>
            <div className="space-y-2">
              {form.conditions_annulation.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Aucune tranche définie.</p>
              )}
              {form.conditions_annulation.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">À J-</span>
                  <Input
                    type="number"
                    className="w-24"
                    value={t.jours_avant}
                    onChange={(e) => updateTier(i, { jours_avant: Number(e.target.value) || 0 })}
                  />
                  <span className="text-xs text-muted-foreground">jours →</span>
                  <Input
                    type="number"
                    className="w-24"
                    value={t.pct_penalite}
                    onChange={(e) => updateTier(i, { pct_penalite: Number(e.target.value) || 0 })}
                  />
                  <span className="text-xs text-muted-foreground">% retenus</span>
                  <Button variant="ghost" size="sm" onClick={() => removeTier(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Conditions spécifiques, remarques…"
            />
          </div>

          {canWrite && (
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer cette condition
              </Button>
              {dirty && (
                <Button size="sm" onClick={save} disabled={submitting}>
                  <Save className="h-4 w-4 mr-1" /> {submitting ? "Enregistrement…" : "Enregistrer"}
                </Button>
              )}
            </div>
          )}
        </fieldset>
      </CollapsibleContent>
    </Collapsible>
  );
}
