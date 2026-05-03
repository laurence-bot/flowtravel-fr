import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Bell, Check, CheckCheck, Trash2, Filter } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  component: () => (
    <RequireAuth>
      <AppLayout>
        <NotificationsPage />
      </AppLayout>
    </RequireAuth>
  ),
});

interface Notif {
  id: string;
  type: string;
  titre: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  dossier_id: string | null;
  cotation_id: string | null;
  bulletin_id: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  devis_valide: "Devis validé",
  acompte_paye: "Acompte payé",
  bulletin_signe: "Bulletin signé",
};

type Filter = "all" | "unread" | string;

function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("agent_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data ?? []) as Notif[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notifs-page:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const types = useMemo(() => {
    const s = new Set(items.map((i) => i.type));
    return Array.from(s);
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((i) => !i.read_at);
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  const unreadCount = items.filter((i) => !i.read_at).length;

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase
      .from("agent_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    toast.success("Toutes les notifications marquées comme lues");
    load();
  };

  const markOne = async (id: string, currentlyRead: boolean) => {
    await supabase
      .from("agent_notifications")
      .update({ read_at: currentlyRead ? null : new Date().toISOString() })
      .eq("id", id);
    load();
  };

  const deleteOne = async (id: string) => {
    await supabase.from("agent_notifications").delete().eq("id", id);
    load();
  };

  const deleteAllRead = async () => {
    if (!user) return;
    if (!confirm("Supprimer toutes les notifications déjà lues ?")) return;
    await supabase
      .from("agent_notifications")
      .delete()
      .eq("user_id", user.id)
      .not("read_at", "is", null);
    toast.success("Notifications lues supprimées");
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Historique de toutes vos alertes : validations devis, paiements, signatures…"
        icon={Bell}
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Tout marquer comme lu
          </Button>
          <Button variant="outline" size="sm" onClick={deleteAllRead}>
            <Trash2 className="h-4 w-4 mr-2" />
            Vider les lues
          </Button>
        </div>
      </PageHeader>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Toutes ({items.length})
        </FilterChip>
        <FilterChip active={filter === "unread"} onClick={() => setFilter("unread")}>
          Non lues ({unreadCount})
        </FilterChip>
        {types.map((t) => (
          <FilterChip key={t} active={filter === t} onClick={() => setFilter(t)}>
            {TYPE_LABELS[t] ?? t} ({items.filter((i) => i.type === t).length})
          </FilterChip>
        ))}
      </div>

      {/* Liste */}
      <Card className="divide-y">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucune notification {filter !== "all" && "dans cette catégorie"}.
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={cn(
                "px-4 py-3 hover:bg-muted/40 transition flex items-start gap-3",
                !n.read_at && "bg-muted/20",
              )}
            >
              {!n.read_at ? (
                <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />
              ) : (
                <span className="mt-2 h-2 w-2 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {TYPE_LABELS[n.type] ?? n.type}
                  </Badge>
                  <span className="text-sm font-medium">{n.titre}</span>
                </div>
                {n.message && (
                  <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })} ·{" "}
                  {format(new Date(n.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {n.link && (
                  <Link to={n.link as any}>
                    <Button variant="outline" size="sm">
                      Ouvrir
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markOne(n.id, Boolean(n.read_at))}
                  title={n.read_at ? "Marquer comme non lu" : "Marquer comme lu"}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteOne(n.id)}
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs border transition",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
