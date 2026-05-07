import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getEmployeeByUserId, listEvaluations, updateEvaluation, type Evaluation } from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/mon-espace/evaluation")({
  component: () => (
    <RequireAuth>
      <MyEval />
    </RequireAuth>
  ),
});

function MyEval() {
  const [items, setItems] = useState<Evaluation[]>([]);
  const [active, setActive] = useState<Evaluation | null>(null);
  const [autoEval, setAutoEval] = useState("");

  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const e = await getEmployeeByUserId(user.id);
    if (e) {
      const evs = await listEvaluations(e.id);
      setItems(evs);
      const cur = evs.find((x) => x.statut === "a_completer") ?? evs[0] ?? null;
      setActive(cur);
      setAutoEval(cur?.auto_evaluation?.texte ?? "");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!active) return;
    try {
      await updateEvaluation(active.id, { auto_evaluation: { texte: autoEval }, statut: "auto_eval_faite" });
      toast.success("Auto-évaluation enregistrée");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="font-display text-3xl">Mon évaluation</h1>
      {!active ? (
        <Card className="p-10 text-center text-muted-foreground">Aucune campagne en cours</Card>
      ) : (
        <Card className="p-6 space-y-4">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Année</div>
            <div className="text-xl font-display">{active.annee}</div>
          </div>
          <div>
            <Label>Auto-évaluation</Label>
            <Textarea
              rows={10}
              value={autoEval}
              onChange={(e) => setAutoEval(e.target.value)}
              placeholder="Atteinte des objectifs, points forts, axes d'amélioration, formations souhaitées…"
            />
          </div>
          <Button onClick={save}>Enregistrer</Button>
        </Card>
      )}

      {items.length > 1 && (
        <Card className="p-0 overflow-hidden overflow-x-auto">
          <div className="p-4 border-b font-medium">Historique</div>
          <table className="w-full text-sm min-w-[640px]">
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2">{e.annee}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.statut}</td>
                  <td className="px-4 py-2 text-right">{e.note_globale ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
