import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Send, Plus } from "lucide-react";

export const Route = createFileRoute("/support")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
  },
  component: SupportPage,
});

type Msg = {
  id: string;
  thread_id: string;
  from_user_id: string;
  sujet: string;
  contenu: string;
  is_from_admin: boolean;
  lu_par_user: boolean;
  created_at: string;
};

type Thread = { thread_id: string; sujet: string; messages: Msg[]; last_msg_at: string; unread: number };

function SupportPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [newMode, setNewMode] = useState(false);
  const [newSujet, setNewSujet] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("support_messages").select("*").order("created_at", { ascending: true });
    if (!data) { setLoading(false); return; }
    const grouped = new Map<string, Msg[]>();
    data.forEach((m) => {
      const arr = grouped.get(m.thread_id) || [];
      arr.push(m as Msg);
      grouped.set(m.thread_id, arr);
    });
    const list: Thread[] = [];
    grouped.forEach((messages, thread_id) => {
      list.push({
        thread_id,
        sujet: messages[0].sujet,
        messages,
        last_msg_at: messages[messages.length - 1].created_at,
        unread: messages.filter((m) => m.is_from_admin && !m.lu_par_user).length,
      });
    });
    list.sort((a, b) => b.last_msg_at.localeCompare(a.last_msg_at));
    setThreads(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openThread = async (id: string) => {
    setActiveThread(id);
    setNewMode(false);
    const t = threads.find((x) => x.thread_id === id);
    if (t && t.unread > 0) {
      await supabase.from("support_messages").update({ lu_par_user: true }).eq("thread_id", id).eq("is_from_admin", true);
      load();
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeThread) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }
    const { data: profile } = await supabase.from("user_profiles").select("agence_id").eq("user_id", user.id).maybeSingle();
    const t = threads.find((x) => x.thread_id === activeThread)!;
    const { error } = await supabase.from("support_messages").insert({
      thread_id: activeThread,
      from_user_id: user.id,
      agence_id: profile?.agence_id || null,
      sujet: t.sujet,
      contenu: reply,
      is_from_admin: false,
      lu_par_admin: false,
      lu_par_user: true,
    });
    if (error) toast.error(error.message);
    else { toast.success("Message envoyé"); setReply(""); load(); }
    setSending(false);
  };

  const sendNew = async () => {
    if (!newSujet.trim() || !newMessage.trim()) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }
    const { data: profile } = await supabase.from("user_profiles").select("agence_id").eq("user_id", user.id).maybeSingle();
    const { error } = await supabase.from("support_messages").insert({
      from_user_id: user.id,
      agence_id: profile?.agence_id || null,
      sujet: newSujet,
      contenu: newMessage,
      is_from_admin: false,
      lu_par_admin: false,
      lu_par_user: true,
    });
    if (error) toast.error(error.message);
    else { toast.success("Message envoyé au support"); setNewSujet(""); setNewMessage(""); setNewMode(false); load(); }
    setSending(false);
  };

  const active = threads.find((t) => t.thread_id === activeThread);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-tight flex items-center gap-2">
              <MessageSquare className="h-7 w-7" /> Support
            </h1>
            <p className="text-muted-foreground mt-1">Contactez l'équipe FlowTravel</p>
          </div>
          <Button onClick={() => { setNewMode(true); setActiveThread(null); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Nouveau message
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 h-[70vh]">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-medium">Mes conversations</CardTitle>
            </CardHeader>
            <ScrollArea className="h-[calc(70vh-60px)]">
              <div className="divide-y">
                {threads.length === 0 && !loading && (
                  <div className="p-6 text-sm text-muted-foreground text-center">Aucune conversation.</div>
                )}
                {threads.map((t) => (
                  <button
                    key={t.thread_id}
                    onClick={() => openThread(t.thread_id)}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition ${activeThread === t.thread_id ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{t.sujet}</div>
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
            {newMode ? (
              <CardContent className="p-6 space-y-4">
                <CardTitle className="text-base">Nouveau message au support</CardTitle>
                <CardDescription>Décrivez votre besoin, on vous répond rapidement.</CardDescription>
                <div className="space-y-2">
                  <Label>Sujet</Label>
                  <Input value={newSujet} onChange={(e) => setNewSujet(e.target.value)} placeholder="Ex : Question sur ma facture" />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={6} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setNewMode(false)}>Annuler</Button>
                  <Button onClick={sendNew} disabled={sending || !newSujet.trim() || !newMessage.trim()}>
                    <Send className="h-4 w-4 mr-1.5" /> {sending ? "Envoi…" : "Envoyer"}
                  </Button>
                </div>
              </CardContent>
            ) : !active ? (
              <CardContent className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Sélectionnez une conversation ou créez-en une nouvelle.
              </CardContent>
            ) : (
              <>
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-base">{active.sujet}</CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {active.messages.map((m) => (
                      <div key={m.id} className={`flex ${m.is_from_admin ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.is_from_admin ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                          <div className="text-[10px] opacity-70 mb-1">
                            {m.is_from_admin ? "Support FlowTravel" : "Vous"} · {new Date(m.created_at).toLocaleString("fr-FR")}
                          </div>
                          <div className="whitespace-pre-wrap">{m.contenu}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="border-t p-3 space-y-2">
                  <Textarea
                    placeholder="Votre message…"
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
