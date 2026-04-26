import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  type AuditAction,
  type AuditEntity,
} from "@/lib/audit";
import { ScrollText, Search } from "lucide-react";

export const Route = createFileRoute("/audit")({
  component: () => (
    <RequireAuth>
      <AuditPage />
    </RequireAuth>
  ),
});

interface AuditLogRow {
  id: string;
  user_id: string;
  entity_type: AuditEntity;
  entity_id: string | null;
  action: AuditAction;
  description: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

const ACTION_TONE: Record<AuditAction, string> = {
  create: "bg-[color:var(--revenue)]/10 text-[color:var(--revenue)] border-[color:var(--revenue)]/25",
  update: "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border-[color:var(--gold)]/25",
  delete: "bg-destructive/10 text-destructive border-destructive/25",
  validate: "bg-[color:var(--margin)]/12 text-[color:var(--margin)] border-[color:var(--margin)]/25",
  reject: "bg-muted text-muted-foreground border-transparent",
  import: "bg-[color:var(--cash)]/10 text-[color:var(--cash)] border-[color:var(--cash)]/25",
  export: "bg-secondary text-foreground border-border",
};

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function AuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<"all" | AuditEntity>("all");
  const [action, setAction] = useState<"all" | AuditAction>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (!error && data) setLogs(data as AuditLogRow[]);
        setLoading(false);
      });
  }, [user]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (entity !== "all" && l.entity_type !== entity) return false;
      if (action !== "all" && l.action !== action) return false;
      const d = l.created_at.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (q) {
        const needle = q.toLowerCase();
        const haystack = `${l.description} ${JSON.stringify(l.new_value ?? "")} ${JSON.stringify(l.old_value ?? "")}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [logs, entity, action, from, to, q]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Journal d'audit"
        description="Historique de toutes les actions importantes effectuées dans l'application."
      />

      <Card className="p-5 space-y-4 border-border/60">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label>Type d'entité</Label>
            <Select value={entity} onValueChange={(v) => setEntity(v as typeof entity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {(Object.keys(ENTITY_LABELS) as AuditEntity[]).map((e) => (
                  <SelectItem key={e} value={e}>{ENTITY_LABELS[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {(Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Du</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Au</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Dossier, contact, montant…"
                className="pl-8"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
          <span>
            <span className="font-semibold text-foreground tabular">{filtered.length}</span> entrée{filtered.length > 1 ? "s" : ""} sur {logs.length}
          </span>
          {(entity !== "all" || action !== "all" || from || to || q) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEntity("all");
                setAction("all");
                setFrom("");
                setTo("");
                setQ("");
              }}
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </Card>

      <Card className="border-border/60 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={logs.length === 0 ? "Aucune action enregistrée" : "Aucun résultat"}
            description={
              logs.length === 0
                ? "Les actions importantes (création, modification, validation…) seront tracées ici."
                : "Modifiez les filtres pour voir d'autres entrées."
            }
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((l) => (
              <li
                key={l.id}
                className="px-5 py-3.5 hover:bg-secondary/30 cursor-pointer transition-colors flex items-start gap-4"
                onClick={() => setSelected(l)}
              >
                <div className="text-[11px] tabular text-muted-foreground w-28 shrink-0 pt-0.5">
                  {formatDateTime(l.created_at)}
                </div>
                <Badge variant="outline" className={`${ACTION_TONE[l.action]} text-[10px] uppercase tracking-wider shrink-0`}>
                  {ACTION_LABELS[l.action]}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
                  {ENTITY_LABELS[l.entity_type]}
                </Badge>
                <div className="text-sm flex-1 min-w-0 truncate">{l.description}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Détail de l'action</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">{formatDateTime(selected.created_at)}</Field>
                <Field label="Action">
                  <Badge variant="outline" className={`${ACTION_TONE[selected.action]} text-[10px] uppercase tracking-wider`}>
                    {ACTION_LABELS[selected.action]}
                  </Badge>
                </Field>
                <Field label="Entité">{ENTITY_LABELS[selected.entity_type]}</Field>
                <Field label="ID entité">
                  <code className="text-[11px] text-muted-foreground">{selected.entity_id ?? "—"}</code>
                </Field>
              </div>
              <Field label="Description">{selected.description}</Field>
              {selected.old_value != null && (
                <Field label="Avant">
                  <pre className="text-[11px] bg-secondary/40 rounded-md p-3 overflow-auto max-h-48">
                    {JSON.stringify(selected.old_value, null, 2)}
                  </pre>
                </Field>
              )}
              {selected.new_value != null && (
                <Field label="Après">
                  <pre className="text-[11px] bg-secondary/40 rounded-md p-3 overflow-auto max-h-48">
                    {JSON.stringify(selected.new_value, null, 2)}
                  </pre>
                </Field>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}
