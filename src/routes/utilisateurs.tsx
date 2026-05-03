import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type AppRole, isAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { RequireAuth } from "@/components/require-auth";
import { toast } from "sonner";
import { ShieldAlert, Users, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { inviteUser } from "@/server/users.functions";


export const Route = createFileRoute("/utilisateurs")({
  component: UtilisateursRoute,
});

function UtilisateursRoute() {
  return (
    <RequireAuth>
      <UtilisateursPage />
    </RequireAuth>
  );
}

type ProfileRow = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  actif: boolean;
  created_at: string;
};

type RoleRow = { user_id: string; role: AppRole };

const ROLE_TONE: Record<AppRole, string> = {
  administrateur: "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border-[color:var(--gold)]/30",
  agent: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

function UtilisateursPage() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("agent");
  const [inviting, setInviting] = useState(false);


  const refresh = async () => {
    setLoading(true);
    const [{ data: profs }, { data: rolesData }] = await Promise.all([
      supabase.from("user_profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setProfiles((profs ?? []) as ProfileRow[]);
    const map: Record<string, AppRole> = {};
    (rolesData as RoleRow[] | null)?.forEach((r) => { map[r.user_id] = r.role; });
    setRoles(map);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin(role)) refresh();
    else setLoading(false);
  }, [role]);

  if (roleLoading || loading) {
    return <div className="text-sm text-muted-foreground">Chargement…</div>;
  }

  if (!isAdmin(role)) {
    return (
      <div>
        <PageHeader title="Utilisateurs" description="Gestion des accès et des rôles" />
        <Card className="p-10 text-center">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display text-lg mb-1">Accès refusé</h3>
          <p className="text-sm text-muted-foreground">
            Seuls les administrateurs peuvent accéder à cette page.
          </p>
        </Card>
      </div>
    );
  }

  const changeRole = async (userId: string, newRole: AppRole) => {
    const oldRole = roles[userId];
    if (oldRole === newRole) return;
    if (userId === user?.id && oldRole === "administrateur" && newRole !== "administrateur") {
      const adminCount = Object.values(roles).filter((r) => r === "administrateur").length;
      if (adminCount <= 1) {
        toast.error("Impossible : vous êtes le dernier administrateur.");
        return;
      }
    }
    setSavingId(userId);
    // delete then insert (table contraint UNIQUE user_id, role)
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) { toast.error(delErr.message); setSavingId(null); return; }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) { toast.error(insErr.message); setSavingId(null); return; }
    setRoles({ ...roles, [userId]: newRole });
    await logAudit({
      userId: user?.id,
      entity: "compte",
      action: "update",
      entityId: userId,
      description: `Rôle modifié : ${ROLE_LABELS[oldRole] ?? "—"} → ${ROLE_LABELS[newRole]}`,
      oldValue: { role: oldRole },
      newValue: { role: newRole },
    });
    toast.success("Rôle mis à jour");
    setSavingId(null);
  };

  const toggleActif = async (p: ProfileRow) => {
    if (p.user_id === user?.id) {
      toast.error("Vous ne pouvez pas vous désactiver vous-même.");
      return;
    }
    setSavingId(p.user_id);
    const newActif = !p.actif;
    const { error } = await supabase
      .from("user_profiles")
      .update({ actif: newActif })
      .eq("user_id", p.user_id);
    if (error) { toast.error(error.message); setSavingId(null); return; }
    setProfiles(profiles.map((x) => x.user_id === p.user_id ? { ...x, actif: newActif } : x));
    await logAudit({
      userId: user?.id,
      entity: "compte",
      action: "update",
      entityId: p.user_id,
      description: `Utilisateur ${newActif ? "activé" : "désactivé"} : ${p.email}`,
      oldValue: { actif: p.actif },
      newValue: { actif: newActif },
    });
    toast.success(newActif ? "Utilisateur activé" : "Utilisateur désactivé");
    setSavingId(null);
  };

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description="Gérez les accès, rôles et activation des membres de votre équipe"
        action={
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Ajouter un utilisateur
          </Button>
        }
      />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
            <DialogDescription>
              Un email d'invitation lui sera envoyé pour définir son mot de passe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inv-name">Nom complet</Label>
              <Input id="inv-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="jean@agence.fr" />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>Annuler</Button>
            <Button
              disabled={inviting || !inviteEmail || !inviteName}
              onClick={async () => {
                setInviting(true);
                try {
                  await inviteUser({ data: { email: inviteEmail, full_name: inviteName, role: inviteRole } });
                  toast.success("Invitation envoyée");
                  setInviteOpen(false);
                  setInviteEmail(""); setInviteName(""); setInviteRole("agent");
                  await refresh();
                } catch (e: any) {
                  toast.error(e?.message ?? "Échec de l'invitation");
                } finally {
                  setInviting(false);
                }
              }}
            >
              {inviting ? "Envoi…" : "Envoyer l'invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Card className="p-5 mb-6">
        <h3 className="font-display text-base mb-3">Rôles disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
            <div key={r} className="flex items-start gap-3 p-3 rounded-md border border-border/60">
              <Badge variant="outline" className={ROLE_TONE[r]}>{ROLE_LABELS[r]}</Badge>
              <p className="text-xs text-muted-foreground flex-1">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          ))}
        </div>
      </Card>

      {profiles.length === 0 ? (
        <EmptyState icon={Users} title="Aucun utilisateur" description="Aucun compte n'est encore créé." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => {
                const currentRole = roles[p.user_id];
                const isMe = p.user_id === user?.id;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {p.full_name || p.email.split("@")[0]}
                        {isMe && <span className="text-xs text-muted-foreground ml-2">(vous)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={currentRole ?? ""}
                        onValueChange={(v) => changeRole(p.user_id, v as AppRole)}
                        disabled={savingId === p.user_id}
                      >
                        <SelectTrigger className="w-[170px]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(p.created_at), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={p.actif}
                          onCheckedChange={() => toggleActif(p)}
                          disabled={savingId === p.user_id || isMe}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        Les permissions sont également appliquées au niveau de la base de données (RLS) pour une sécurité maximale.
      </p>
    </div>
  );
}
