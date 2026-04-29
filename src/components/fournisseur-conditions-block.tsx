import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useTable } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { DEVISES, type DeviseCode } from "@/lib/fx";
import {
  DEFAULT_CONDITION,
  type FournisseurCondition,
  type CancelationTier,
} from "@/lib/fournisseur-conditions";
import { Plus, Trash2, Pencil, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";

type Props = {
  fournisseurId: string;
  canWrite: boolean;
};

type FormState = {
  nom_profil: string;
  est_defaut: boolean;
  devises_acceptees: DeviseCode[];
  pct_acompte_1: string;
  pct_acompte_2: string;
  pct_acompte_3: string;
  pct_solde: string;
  delai_acompte_1_jours: string;
  delai_acompte_2_jours: string;
  delai_acompte_3_jours: string;
  delai_solde_jours: string;
  conditions_annulation: CancelationTier[];
  notes: string;
};

function emptyForm(): FormState {
  return {
    nom_profil: DEFAULT_CONDITION.nom_profil,
    est_defaut: DEFAULT_CONDITION.est_defaut,
    devises_acceptees: [...DEFAULT_CONDITION.devises_acceptees],
    pct_acompte_1: String(DEFAULT_CONDITION.pct_acompte_1),
    pct_acompte_2: String(DEFAULT_CONDITION.pct_acompte_2),
    pct_acompte_3: String(DEFAULT_CONDITION.pct_acompte_3),
    pct_solde: String(DEFAULT_CONDITION.pct_solde),
    delai_acompte_1_jours: DEFAULT_CONDITION.delai_acompte_1_jours?.toString() ?? "",
    delai_acompte_2_jours: DEFAULT_CONDITION.delai_acompte_2_jours?.toString() ?? "",
    delai_acompte_3_jours: DEFAULT_CONDITION.delai_acompte_3_jours?.toString() ?? "",
    delai_solde_jours: DEFAULT_CONDITION.delai_solde_jours?.toString() ?? "",
    conditions_annulation: [...DEFAULT_CONDITION.conditions_annulation],
    notes: "",
  };
}

export function FournisseurConditionsBlock({ fournisseurId, canWrite }: Props) {
  const { user } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: all, refetch } = useTable<FournisseurCondition>("fournisseur_conditions" as any);

  const conditions = useMemo(
    () => all.filter((c) => c.fournisseur_id === fournisseurId),
    [all, fournisseurId],
  );

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setForm(emptyForm());
    }
  }, [open]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), est_defaut: conditions.length === 0 });
    setOpen(true);
  };

  const openEdit = (c: FournisseurCondition) => {
    setEditingId(c.id);
    setForm({
      nom_profil: c.nom_profil,
      est_defaut: c.est_defaut,
      devises_acceptees: c.devises_acceptees as DeviseCode[],
      pct_acompte_1: String(c.pct_acompte_1),
      pct_acompte_2: String(c.pct_acompte_2),
      pct_acompte_3: String(c.pct_acompte_3),
      pct_solde: String(c.pct_solde),
      delai_acompte_1_jours: c.delai_acompte_1_jours?.toString() ?? "",
      delai_acompte_2_jours: c.delai_acompte_2_jours?.toString() ?? "",
      delai_acompte_3_jours: c.delai_acompte_3_jours?.toString() ?? "",
      delai_solde_jours: c.delai_solde_jours?.toString() ?? "",
      conditions_annulation: c.conditions_annulation ?? [],
      notes: c.notes ?? "",
    });
    setOpen(true);
  };

  const toggleDevise = (code: DeviseCode) => {
    const cur = form.devises_acceptees;
    if (cur.includes(code)) {
      setForm({ ...form, devises_acceptees: cur.filter((d) => d !== code) });
    } else if (cur.length < 2) {
      setForm({ ...form, devises_acceptees: [...cur, code] });
    } else {
      toast.error("Maximum 2 devises par profil.");
    }
  };

  const addTier = () => {
    setForm({
      ...form,
      conditions_annulation: [...form.conditions_annulation, { jours_avant: 0, pct_penalite: 100 }],
    });
  };
  const removeTier = (idx: number) => {
    setForm({
      ...form,
      conditions_annulation: form.conditions_annulation.filter((_, i) => i !== idx),
    });
  };
  const updateTier = (idx: number, patch: Partial<CancelationTier>) => {
    setForm({
      ...form,
      conditions_annulation: form.conditions_annulation.map((t, i) =>
        i === idx ? { ...t, ...patch } : t,
      ),
    });
  };

  const submit = async () => {
    if (!user) return;
    if (!form.nom_profil.trim()) return toast.error("Nom du profil requis.");
    if (form.devises_acceptees.length === 0) return toast.error("Sélectionnez au moins une devise.");
    const total =
      Number(form.pct_acompte_1) +
      Number(form.pct_acompte_2) +
      Number(form.pct_acompte_3) +
      Number(form.pct_solde);
    if (Math.abs(total - 100) > 0.01) return toast.error("La somme des % doit faire 100 %.");

    setSubmitting(true);

    // Si est_defaut → on retire le flag des autres
    if (form.est_defaut) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("fournisseur_conditions")
        .update({ est_defaut: false })
        .eq("fournisseur_id", fournisseurId);
    }

    const payload = {
      user_id: user.id,
      fournisseur_id: fournisseurId,
      nom_profil: form.nom_profil.trim(),
      est_defaut: form.est_defaut,
      devises_acceptees: form.devises_acceptees,
      pct_acompte_1: Number(form.pct_acompte_1) || 0,
      pct_acompte_2: Number(form.pct_acompte_2) || 0,
      pct_acompte_3: Number(form.pct_acompte_3) || 0,
      pct_solde: Number(form.pct_solde) || 0,
      delai_acompte_1_jours: form.delai_acompte_1_jours ? Number(form.delai_acompte_1_jours) : null,
      delai_acompte_2_jours: form.delai_acompte_2_jours ? Number(form.delai_acompte_2_jours) : null,
      delai_acompte_3_jours: form.delai_acompte_3_jours ? Number(form.delai_acompte_3_jours) : null,
      delai_solde_jours: form.delai_solde_jours ? Number(form.delai_solde_jours) : null,
      conditions_annulation: form.conditions_annulation,
      notes: form.notes || null,
    };

    let err: string | null = null;
    let entityId: string | null = editingId;
    if (editingId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("fournisseur_conditions")
        .update(payload)
        .eq("id", editingId);
      err = error?.message ?? null;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("fournisseur_conditions")
        .insert(payload)
        .select()
        .single();
      err = error?.message ?? null;
      entityId = data?.id ?? null;
    }
    setSubmitting(false);
    if (err) return toast.error(err);

    await logAudit({
      userId: user.id,
      entity: "fournisseur_condition",
      entityId,
      action: editingId ? "update" : "create",
      description: `Profil "${form.nom_profil}" ${editingId ? "modifié" : "créé"}`,
    });
    toast.success("Profil enregistré.");
    setOpen(false);
    refetch();
  };

  const remove = async (c: FournisseurCondition) => {
    if (!user) return;
    if (!confirm(`Supprimer le profil "${c.nom_profil}" ?`)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("fournisseur_conditions")
      .delete()
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "fournisseur_condition",
      entityId: c.id,
      action: "delete",
      description: `Profil supprimé : ${c.nom_profil}`,
    });
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
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau profil
          </Button>
        )}
      </div>

      {conditions.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Aucun profil"
          description="Ajoutez les conditions commerciales pour pré-remplir automatiquement vos cotations."
        />
      ) : (
        <div className="divide-y divide-border/60">
          {conditions.map((c) => (
            <div key={c.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.nom_profil}</span>
                  {c.est_defaut && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Star className="h-3 w-3" /> par défaut
                    </Badge>
                  )}
                  {c.devises_acceptees.map((d) => (
                    <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-1.5">
                  Acomptes : {c.pct_acompte_1}/{c.pct_acompte_2}/{c.pct_acompte_3}/{c.pct_solde} %
                  {c.delai_solde_jours != null && (
                    <> · solde J-{c.delai_solde_jours}</>
                  )}
                </div>
                {c.conditions_annulation.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Annulation :{" "}
                    {c.conditions_annulation
                      .slice()
                      .sort((a, b) => b.jours_avant - a.jours_avant)
                      .map((t) => `J-${t.jours_avant}: ${t.pct_penalite}%`)
                      .join(" · ")}
                  </div>
                )}
                {c.notes && <div className="text-xs text-muted-foreground mt-1 italic">{c.notes}</div>}
              </div>
              {canWrite && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(c)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingId ? "Modifier le profil" : "Nouveau profil"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nom du profil *</Label>
                <Input
                  value={form.nom_profil}
                  onChange={(e) => setForm({ ...form, nom_profil: e.target.value })}
                  placeholder="Hôtel, Safari, Standard…"
                />
              </div>
              <div className="space-y-1.5 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.est_defaut}
                    onCheckedChange={(v) => setForm({ ...form, est_defaut: v === true })}
                  />
                  <span className="text-sm">Profil par défaut</span>
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
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Échéances de paiement
              </Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {(
                  [
                    ["pct_acompte_1", "delai_acompte_1_jours", "Acompte 1"],
                    ["pct_acompte_2", "delai_acompte_2_jours", "Acompte 2"],
                    ["pct_acompte_3", "delai_acompte_3_jours", "Acompte 3"],
                    ["pct_solde", "delai_solde_jours", "Solde"],
                  ] as const
                ).map(([pctK, delaiK, label]) => (
                  <div key={pctK}>
                    <Label className="text-xs">{label} %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form[pctK]}
                      onChange={(e) => setForm({ ...form, [pctK]: e.target.value } as FormState)}
                    />
                    <Label className="text-[10px] text-muted-foreground mt-1">Jours avant prestation</Label>
                    <Input
                      type="number"
                      value={form[delaiK]}
                      onChange={(e) => setForm({ ...form, [delaiK]: e.target.value } as FormState)}
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Les dates d'échéance seront calculées automatiquement à partir de la date de prestation.
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
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Conditions spécifiques, remarques…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
