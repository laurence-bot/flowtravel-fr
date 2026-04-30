import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Inbox, AlertTriangle, MessageSquare, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin-dashboard")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_profiles").select("is_super_admin").eq("user_id", session.user.id).maybeSingle();
    if (!data?.is_super_admin) throw redirect({ to: "/app" });
  },
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const [stats, setStats] = useState({
    agencesEnAttente: 0,
    agencesValidees: 0,
    agentsTotal: 0,
    messagesNonLus: 0,
    erreursNonResolues: 0,
    erreurs24h: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [pa, pv, ag, mn, en, e24] = await Promise.all([
        supabase.from("agences").select("*", { count: "exact", head: true }).eq("statut", "en_attente"),
        supabase.from("agences").select("*", { count: "exact", head: true }).eq("statut", "validee"),
        supabase.from("user_profiles").select("*", { count: "exact", head: true }).eq("actif", true),
        supabase.from("support_messages").select("*", { count: "exact", head: true }).eq("lu_par_admin", false).eq("is_from_admin", false),
        supabase.from("error_logs").select("*", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("error_logs").select("*", { count: "exact", head: true }).gte("created_at", since).eq("resolved", false),
      ]);
      setStats({
        agencesEnAttente: pa.count || 0,
        agencesValidees: pv.count || 0,
        agentsTotal: ag.count || 0,
        messagesNonLus: mn.count || 0,
        erreursNonResolues: en.count || 0,
        erreurs24h: e24.count || 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { title: "Agences en attente", value: stats.agencesEnAttente, icon: Inbox, link: "/admin-agences", color: "text-amber-600", urgent: stats.agencesEnAttente > 0 },
    { title: "Agences validées", value: stats.agencesValidees, icon: ShieldCheck, link: "/admin-agences", color: "text-emerald-600" },
    { title: "Utilisateurs actifs", value: stats.agentsTotal, icon: Users, link: "/utilisateurs", color: "text-blue-600" },
    { title: "Messages non lus", value: stats.messagesNonLus, icon: MessageSquare, link: "/admin-messages", color: "text-violet-600", urgent: stats.messagesNonLus > 0 },
    { title: "Erreurs non résolues", value: stats.erreursNonResolues, icon: AlertTriangle, link: "/admin-errors", color: "text-rose-600", urgent: stats.erreursNonResolues > 0 },
    { title: "Erreurs (24h, non résolues)", value: stats.erreurs24h, icon: AlertTriangle, link: "/admin-errors", color: "text-orange-600" },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Espace Super-Admin</h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble de la plateforme FlowTravel</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link key={c.title} to={c.link}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-light">{loading ? "—" : c.value}</div>
                    {c.urgent && c.value > 0 && <Badge variant="destructive" className="mb-1">Action requise</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Accès rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link to="/admin-agences" className="p-4 rounded-lg border hover:bg-muted/50 transition text-sm">Validation agences</Link>
            <Link to="/admin-messages" className="p-4 rounded-lg border hover:bg-muted/50 transition text-sm">Messagerie support</Link>
            <Link to="/admin-errors" className="p-4 rounded-lg border hover:bg-muted/50 transition text-sm">Journal d'erreurs</Link>
            <Link to="/admin-demos" className="p-4 rounded-lg border hover:bg-muted/50 transition text-sm">Démos prospects</Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
