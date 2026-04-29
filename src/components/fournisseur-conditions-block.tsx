import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTable } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { DEVISES, type DeviseCode } from "@/lib/fx";
import { Plus, Trash2, ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";

type Props = {
  fournisseurId: string;
  canWrite: boolean;
};

type CancelationTier = { jours_avant: number; pct_penalite: number };

type ContactRow = {
  id: string;
  devises_acceptees: string[] | null;
  pct_acompte_1: number | null;
  pct_acompte_2: number | null;
  pct_acompte_3: number | null;
  pct_solde: number | null;
  delai_acompte_1_jours: number | null;
  delai_acompte_2_jours: number | null;
  delai_acompte_3_jours: number | null;
  delai_solde_jours: number | null;
  conditions_annulation: CancelationTier[] | null;
  conditions_notes: string | null;
};

type FormState = {
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
  conditions_notes: string;
};

const EMPTY: FormState = {
  devises_acceptees: ["EUR"],
  pct_acompte_1: "30",
  pct_acompte_2: "0",
  pct_acompte_3: "0",
  pct_solde: "70",
  delai_acompte_1_jours: "",
  delai_acompte_2_jours: "",
  delai_acompte_3_jours: "",
  delai_solde_jours: "30",
  conditions_annulation: [],
  conditions_notes: "",
};

function fromContact(c: ContactRow | undefined): FormState {
  if (!c) return EMPTY;
  return {
    devises_acceptees: ((c.devises_acceptees ?? ["EUR"]) as DeviseCode[]),
    pct_acompte_1: String(c.pct_acompte_1 ?? 30),
    pct_acompte_2: String(c.pct_acompte_2 ?? 0),
    pct_acompte_3: String(c.pct_acompte_3 ?? 0),
    pct_solde: String(c.pct_solde ?? 70),
    delai_acompte_1_jours: c.delai_acompte_1_jours?.toString() ?? "",
    delai_acompte_2_jours: c.delai_acompte_2_jours?.toString() ?? "",
    delai_acompte_3_jours: c.delai_acompte_3_jours?.toString() ?? "",
    delai_solde_jours: c.delai_solde_jours?.toString() ?? "",
    conditions_annulation: c.conditions_annulation ?? [],
    conditions_notes: c.conditions_notes ?? "",
  };
}

export function FournisseurConditionsBlock({ fournisseurId, canWrite }: Props) {
  const { user } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contacts, refetch } = useTable<ContactRow>("contacts" as any);
  const contact = contacts.find((c) => c.id === fournisseurId);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(fromContact(contact));
    setDirty(false);
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const total =
      Number(form.pct_acompte_1) +
      Number(form.pct_acompte_2) +
      Number(form.pct_acompte_3) +
      Number(form.pct_solde);
    if (Math.abs(total - 100) > 0.01) return toast.error("La somme des % doit faire 100 %.");

    setSubmitting(true);
    const payload = {
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
      conditions_notes: form.conditions_notes || null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("contacts")
      .update(payload)
      .eq("id", fournisseurId);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "contact",
      entityId: fournisseurId,
      action: "update",
      description: "Conditions commerciales mises à jour",
    });
    toast.success("Conditions enregistrées.");
    setDirty(false);
    refetch();
  };

  return (
    <Card className="border-border/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Conditions commerciales
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Devises · acomptes · délais · pénalités d'annulation
          </p>
        </div>
        {canWrite && dirty && (
          <Button size="sm" onClick={save} disabled={submitting}>
            <Save className="h-4 w-4 mr-1" /> Enregistrer
          </Button>
        )}
      </div>

      <fieldset disabled={!canWrite} className="space-y-4">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
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
                  onChange={(e) => update(pctK, e.target.value)}
                />
                <Label className="text-[10px] text-muted-foreground mt-1">Jours avant</Label>
                <Input
                  type="number"
                  value={form[delaiK]}
                  onChange={(e) => update(delaiK, e.target.value)}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Les dates d'échéance sont calculées à partir de la date de prestation.
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
            value={form.conditions_notes}
            onChange={(e) => update("conditions_notes", e.target.value)}
            placeholder="Conditions spécifiques, remarques…"
          />
        </div>

        {canWrite && dirty && (
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={submitting}>
              <Save className="h-4 w-4 mr-1" /> {submitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        )}
      </fieldset>
    </Card>
  );
}
