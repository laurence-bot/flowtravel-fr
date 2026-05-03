import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface AgentNotification {
  id: string;
  type: string;
  titre: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AgentNotification[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("agent_notifications")
      .select("id,type,titre,message,link,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as AgentNotification[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`agent_notifs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    const interval = setInterval(load, 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter((i) => !i.read_at).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase
      .from("agent_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    load();
  };

  const markOne = async (id: string) => {
    await supabase
      .from("agent_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    load();
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-full border bg-card hover:bg-muted transition"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-red-600 rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-[360px] max-w-[92vw] rounded-md border bg-card shadow-xl">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  onClick={markAllRead}
                >
                  <Check className="h-3 w-3" /> Tout marquer comme lu
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                  Aucune notification.
                </div>
              ) : (
                items.map((n) => {
                  const content = (
                    <div
                      className={cn(
                        "px-3 py-2 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer",
                        !n.read_at && "bg-muted/30",
                      )}
                      onClick={() => {
                        if (!n.read_at) markOne(n.id);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read_at && (
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{n.titre}</div>
                          {n.message && (
                            <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  return n.link ? (
                    <Link key={n.id} to={n.link as any}>{content}</Link>
                  ) : (
                    <div key={n.id}>{content}</div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
