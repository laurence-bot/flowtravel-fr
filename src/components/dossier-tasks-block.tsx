import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePageWriteAccess } from "@/hooks/use-page-write-access";
import { logAudit } from "@/lib/audit";
import {
  PHASE_LABELS,
  PHASE_ORDER,
  PRIORITE_LABELS,
  PRIORITE_TONE,
  STATUT_LABELS,
  STATUT_TONE,
  ensureDefaultTasks,
  isEnRetard,
  sortByUrgence,
  type DossierTask,
  type TaskPhase,
  type TaskPriorite,
  type TaskStatut,
} from "@/lib/dossier-tasks";
import { CheckSquare, Plus, Pencil, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DossierTasksBlock({ dossierId }: { dossierId: string }) {
  const { user } = useAuth();
  const { canWrite } = usePageWriteAccess();
  const [tasks, setTasks] = useState<DossierTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DossierTask | null>(null);
  const [adding, setAdding] = useState(false);

  const refetch = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("dossier_tasks")
      .select("*")
      .eq("dossier_id", dossierId)
      .order("ordre", { ascending: true });
    setTasks((data ?? []) as DossierTask[]);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      // Auto-création de la checklist par défaut au premier rendu si vide
      await ensureDefaultTasks(user.id, dossierId);
      if (!cancelled) await refetch();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dossierId]);

  const grouped = useMemo(() => {
    const sorted = [...tasks].sort(sortByUrgence);
    const map = new Map<TaskPhase, DossierTask[]>();
    for (const t of sorted) {
      const arr = map.get(t.phase) ?? [];
      arr.push(t);
      map.set(t.phase, arr);
    }
    return map;
  }, [tasks]);

  const enRetard = tasks.filter(isEnRetard).length;
  const aFaire = tasks.filter((t) => t.statut !== "termine").length;
  const total = tasks.length;
  const done = total - aFaire;

  const toggleDone = async (t: DossierTask) => {
    if (!user) return;
    const newStatut: TaskStatut = t.statut === "termine" ? "a_faire" : "termine";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("dossier_tasks")
      .update({
        statut: newStatut,
        completed_at: newStatut === "termine" ? new Date().toISOString() : null,
      })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "dossier_task",
      entityId: t.id,
      action: newStatut === "termine" ? "validate" : "update",
      description: `Tâche ${newStatut === "termine" ? "terminée" : "rouverte"} : ${t.titre}`,
    });
    refetch();
  };

  const supprimer = async (t: DossierTask) => {
    if (!user) return;
    if (!confirm("Supprimer cette tâche ?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("dossier_tasks").delete().eq("id", t.id);
    await logAudit({
      userId: user.id,
      entity: "dossier_task",
      entityId: t.id,
      action: "delete",
      description: `Tâche supprimée : ${t.titre}`,
    });
    refetch();
  };

  return (
    <Card className="p-6 border-border/60">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="font-display text-xl flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
            Suivi opérationnel
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {done}/{total} tâches terminées
            {enRetard > 0 && (
              <span className="ml-2 text-destructive font-medium">
                · {enRetard} en retard
              </span>
            )}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Chargement…</p>
      ) : tasks.length === 0 ? (
        <div className="text-center py-10 px-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-3">
            <CheckSquare className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            Aucune tâche. Ajoutez la première étape de suivi.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {PHASE_ORDER.filter((p) => grouped.has(p)).map((phase) => (
            <div key={phase}>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                {PHASE_LABELS[phase]}
              </div>
              <ul className="space-y-1.5">
                {grouped.get(phase)!.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    canWrite={canWrite}
                    onToggle={() => toggleDone(t)}
                    onEdit={() => setEditing(t)}
                    onDelete={() => supprimer(t)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <TaskDialog
          dossierId={dossierId}
          task={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            refetch();
          }}
        />
      )}
    </Card>
  );
}

function TaskRow({
  task,
  canWrite,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: DossierTask;
  canWrite: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const late = isEnRetard(task);
  const done = task.statut === "termine";
  return (
    <li
      className={`group flex items-start gap-3 p-2.5 rounded-md border transition-colors ${
        done
          ? "border-emerald-500/20 bg-emerald-500/5"
          : late
            ? "border-destructive/30 bg-destructive/5"
            : "border-border/60 hover:bg-secondary/30"
      }`}
    >
      <Checkbox
        checked={done}
        onCheckedChange={onToggle}
        disabled={!canWrite}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}
          >
            {task.titre}
          </span>
          <Badge variant="outline" className={`text-[10px] ${STATUT_TONE[task.statut]}`}>
            {STATUT_LABELS[task.statut]}
          </Badge>
          {task.priorite !== "normale" && (
            <Badge variant="outline" className={`text-[10px] ${PRIORITE_TONE[task.priorite]}`}>
              {PRIORITE_LABELS[task.priorite]}
            </Badge>
          )}
          {late && (
            <span className="inline-flex items-center gap-1 text-[10px] text-destructive font-medium">
              <AlertTriangle className="h-3 w-3" /> En retard
            </span>
          )}
        </div>
        {(task.description || task.date_echeance) && (
          <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
            {task.date_echeance && <span>Échéance : {task.date_echeance}</span>}
            {task.description && <span className="truncate">{task.description}</span>}
          </div>
        )}
      </div>
      {canWrite && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}
    </li>
  );
}

function TaskDialog({
  dossierId,
  task,
  onClose,
  onSaved,
}: {
  dossierId: string;
  task: DossierTask | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    titre: task?.titre ?? "",
    description: task?.description ?? "",
    phase: (task?.phase ?? "avant") as TaskPhase,
    statut: (task?.statut ?? "a_faire") as TaskStatut,
    priorite: (task?.priorite ?? "normale") as TaskPriorite,
    date_echeance: task?.date_echeance ?? "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!form.titre.trim()) return toast.error("Titre requis.");
    setSaving(true);
    const payload = {
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      phase: form.phase,
      statut: form.statut,
      priorite: form.priorite,
      date_echeance: form.date_echeance || null,
      completed_at: form.statut === "termine" ? new Date().toISOString() : null,
    };
    if (task) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("dossier_tasks")
        .update(payload)
        .eq("id", task.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      await logAudit({
        userId: user.id,
        entity: "dossier_task",
        entityId: task.id,
        action: "update",
        description: `Tâche modifiée : ${payload.titre}`,
      });
      onSaved();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("dossier_tasks")
        .insert({ ...payload, user_id: user.id, dossier_id: dossierId, ordre: 999 })
        .select()
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      await logAudit({
        userId: user.id,
        entity: "dossier_task",
        entityId: data?.id,
        action: "create",
        description: `Tâche créée : ${payload.titre}`,
      });
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titre *</Label>
            <Input
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              placeholder="Vérifier les vols…"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phase</Label>
              <Select
                value={form.phase}
                onValueChange={(v) => setForm({ ...form, phase: v as TaskPhase })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHASE_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PHASE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorité</Label>
              <Select
                value={form.priorite}
                onValueChange={(v) => setForm({ ...form, priorite: v as TaskPriorite })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITE_LABELS) as TaskPriorite[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select
                value={form.statut}
                onValueChange={(v) => setForm({ ...form, statut: v as TaskStatut })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUT_LABELS) as TaskStatut[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Échéance</Label>
              <Input
                type="date"
                value={form.date_echeance}
                onChange={(e) => setForm({ ...form, date_echeance: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Enregistrement…" : task ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
