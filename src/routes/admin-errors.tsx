import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ExternalLink, Trash2, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/admin-errors")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_profiles").select("is_super_admin").eq("user_id", session.user.id).maybeSingle();
    if (!data?.is_super_admin) throw redirect({ to: "/app" });
  },
  component: AdminErrorsPage,
});

type ErrorRow = {
  id: string;
  user_id: string | null;
  agence_id: string | null;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  context: any;
  url: string | null;
  resolved: boolean;
  created_at: string;
};

function AdminErrorsPage() {
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [filter, setFilter] = useState<"unresolved" | "all" | "resolved">("unresolved");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("error_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "unresolved") q = q.eq("resolved", false);
    if (filter === "resolved") q = q.eq("resolved", true);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setErrors((data || []) as ErrorRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const toggleResolved = async (id: string, current: boolean) => {
    const { error } = await supabase.from("error_logs").update({ resolved: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(current ? "Marquée non résolue" : "Marquée résolue"); load(); }
  };

  const markAllResolved = async () => {
    const { error } = await supabase
      .from("error_logs")
      .update({ resolved: true })
      .eq("resolved", false);
    if (error) toast.error(error.message);
    else { toast.success("Toutes les erreurs ont été marquées résolues"); load(); }
  };

  const deleteAllResolved = async () => {
    const { error } = await supabase
      .from("error_logs")
      .delete()
      .eq("resolved", true);
    if (error) toast.error(error.message);
    else { toast.success("Erreurs résolues supprimées"); load(); }
  };

  const deleteAll = async () => {
    const { error } = await supabase
      .from("error_logs")
      .delete()
      .not("id", "is", null);
    if (error) toast.error(error.message);
    else { toast.success("Toutes les erreurs ont été supprimées"); load(); }
  };

  const deleteOne = async (id: string) => {
    const { error } = await supabase.from("error_logs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Erreur supprimée"); load(); }
  };

  const levelBadge = (level: string) => {
    if (level === "error") return <Badge variant="destructive">Error</Badge>;
    if (level === "warning") return <Badge className="bg-amber-500 hover:bg-amber-500/90">Warning</Badge>;
    return <Badge variant="secondary">Info</Badge>;
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-light tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-7 w-7" /> Journal d'erreurs
            </h1>
            <p className="text-muted-foreground mt-1">Erreurs remontées depuis les espaces des agences</p>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="unresolved">Non résolues</TabsTrigger>
              <TabsTrigger value="resolved">Résolues</TabsTrigger>
              <TabsTrigger value="all">Toutes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={loading || errors.length === 0}>
                <CheckCheck className="h-4 w-4 mr-1" /> Tout marquer résolu
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Marquer toutes les erreurs comme résolues ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Toutes les erreurs non résolues seront marquées comme résolues.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={markAllResolved}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={loading}>
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer les résolues
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer toutes les erreurs résolues ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAllResolved}>Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={loading}>
                <Trash2 className="h-4 w-4 mr-1" /> Tout supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer TOUTES les erreurs ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Toutes les entrées du journal seront définitivement supprimées (résolues et non résolues). Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Tout supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{loading ? "Chargement…" : `${errors.length} erreur(s)`}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {errors.length === 0 && !loading && (
              <div className="p-12 text-center text-muted-foreground text-sm">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
                Aucune erreur — tout fonctionne bien.
              </div>
            )}
            <div className="divide-y">
              {errors.map((e) => {
                const isOpen = expanded === e.id;
                return (
                  <div key={e.id} className="p-4 hover:bg-muted/30 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {levelBadge(e.level)}
                          <Badge variant="outline" className="text-[10px]">{e.source}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("fr-FR")}</span>
                        </div>
                        <button onClick={() => setExpanded(isOpen ? null : e.id)} className="text-left w-full">
                          <div className="font-mono text-sm mt-1 break-all">{e.message}</div>
                          {e.url && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> {e.url}
                            </div>
                          )}
                        </button>
                        {isOpen && (
                          <div className="mt-3 space-y-2 text-xs">
                            {e.stack && (
                              <pre className="bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">{e.stack}</pre>
                            )}
                            {e.context && (
                              <pre className="bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">{JSON.stringify(e.context, null, 2)}</pre>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Button size="sm" variant={e.resolved ? "ghost" : "outline"} onClick={() => toggleResolved(e.id, e.resolved)}>
                          {e.resolved ? "Résolue" : "Marquer résolue"}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteOne(e.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
