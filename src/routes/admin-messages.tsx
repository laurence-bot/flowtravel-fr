import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Send, User } from "lucide-react";

export const Route = createFileRoute("/admin-messages")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_profiles").select("is_super_admin").eq("user_id", session.user.id).maybeSingle();
    if (!data?.is_super_admin) throw redirect({ to: "/app" });
  },
  component: AdminMessagesPage,
});

type Msg = {
  id: string;
  thread_id: string;
  from_user_id: string;
  agence_id: string | null;
  sujet: string;
  contenu: string;
  is_from_admin: boolean;
  lu_par_admin: boolean;
  created_at: string;
};

type ThreadSummary = {
  thread_id: string;
  sujet: string;
  agence_nom: string;
  user_email: string;
  last_msg_at: string;
  unread: number;
  messages: Msg[];
};

function AdminMessagesPage() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: msgs } = await supabase.from("support_messages").select("*").order("created_at", { ascending: true });
    if (!msgs) { setLoading(false); return; }

    // Récupérer infos agences/users en batch
    const userIds = [...new Set(msgs.map((m) => m.from_user_id))];
    const agenceIds = [...new Set(msgs.map((m) => m.agence_id).filter(Boolean) as string[])];
    const [{ data: profiles }, { data: agences }] = await Promise.all([
      userIds.length ? supabase.from("user_profiles").select("user_id, email").in("user_id", userIds) : Promise.resolve({ data: [] as any[] }),
      agenceIds.length ? supabase.from("agences").select("id, nom_commercial").in("id", agenceIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.email]));
    const agenceMap = new Map((agences || []).map((a: any) => [a.id, a.nom_commercial]));

    const grouped = new Map<string, Msg[]>();
    msgs.forEach((m) => {
      const arr = grouped.get(m.thread_id) || [];
      arr.push(m as Msg);
      grouped.set(m.thread_id, arr);
    });

    const summaries: ThreadSummary[] = [];
    grouped.forEach((arr, thread_id) => {
      const first = arr[0];
      const last = arr[arr.length - 1];
      summaries.push({
        thread_id,
        sujet: first.sujet,
        agence_nom: first.agence_id ? agenceMap.get(first.agence_id) || "—" : "Sans agence",
        user_email: profileMap.get(first.from_user_id) || "Inconnu",
        last_msg_at: last.created_at,
        unread: arr.filter((m) => !m.lu_par_admin && !m.is_from_admin).length,
        messages: arr,
      });
    });
    summaries.sort((a, b) => b.last_msg_at.localeCompare(a.last_msg_at));
    setThreads(summaries);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openThread = async (threadId: string) => {
    setActiveThread(threadId);
    // Marquer comme lus
    const t = threads.find((x) => x.thread_id === threadId);
    if (t && t.unread > 0) {
      await supabase.from("support_messages").update({ lu_par_admin: true }).eq("thread_id", threadId).eq("is_from_admin", false);
      load();
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeThread) return;
    const t = threads.find((x) => x.thread_id === activeThread);
    if (!t) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }
    const { error } = await supabase.from("support_messages").insert({
      thread_id: activeThread,
      from_user_id: user.id,
      agence_id: t.messages[0].agence_id,
      sujet: t.sujet,
      contenu: reply,
      is_from_admin: true,
      lu_par_admin: true,
      lu_par_user: false,
    });
    if (error) { toast.error(error.message); }
    else { toast.success("Réponse envoyée"); setReply(""); load(); }
    setSending(false);
  };

  const active = threads.find((t) => t.thread_id === activeThread);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-light tracking-tight flex items-center gap-2">
            <MessageSquare className="h-7 w-7" /> Messagerie support
          </h1>
          <p className="text-muted-foreground mt-1">Conversations avec les agences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[70vh]">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-medium">{loading ? "Chargement…" : `${threads.length} conversation(s)`}</CardTitle>
            </CardHeader>
            <ScrollArea className="h-[calc(70vh-60px)]">
              <div className="divide-y">
                {threads.length === 0 && !loading && (
                  <div className="p-6 text-sm text-muted-foreground text-center">Aucun message pour le moment.</div>
                )}
                {threads.map((t) => (
                  <button
                    key={t.thread_id}
                    onClick={() => openThread(t.thread_id)}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition ${activeThread === t.thread_id ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{t.sujet}</div>
                        <div className="text-xs text-muted-foreground truncate mt-1">{t.agence_nom} · {t.user_email}</div>
                        <div className="text-[11px] text-muted-foreground mt-1">{new Date(t.last_msg_at).toLocaleString("fr-FR")}</div>
                      </div>
                      {t.unread > 0 && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{t.unread}</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>

          <Card className="flex flex-col overflow-hidden">
            {!active ? (
              <CardContent className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Sélectionnez une conversation
              </CardContent>
            ) : (
              <>
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-base">{active.sujet}</CardTitle>
                  <p className="text-xs text-muted-foreground">{active.agence_nom} · {active.user_email}</p>
                </CardHeader>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {active.messages.map((m) => (
                      <div key={m.id} className={`flex ${m.is_from_admin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.is_from_admin ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1">
                            <User className="h-3 w-3" />
                            {m.is_from_admin ? "Vous (Admin)" : "Agence"} · {new Date(m.created_at).toLocaleString("fr-FR")}
                          </div>
                          <div className="whitespace-pre-wrap">{m.contenu}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="border-t p-3 space-y-2">
                  <Textarea
                    placeholder="Votre réponse…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()} size="sm" className="ml-auto flex">
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {sending ? "Envoi…" : "Envoyer"}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
