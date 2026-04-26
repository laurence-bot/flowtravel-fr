import { Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { AppLayout } from "./app-layout";
import { canAccessRoute } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading, signOut } = useAuth();
  const { role, actif, loading: roleLoading } = useRole();
  const location = useLocation();

  if (authLoading || (session && roleLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
        Chargement…
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" />;

  if (!actif) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="p-10 text-center max-w-md">
          <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
          <h3 className="font-display text-lg mb-2">Compte désactivé</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Votre compte a été désactivé. Contactez un administrateur.
          </p>
          <button onClick={() => signOut()} className="text-sm underline text-muted-foreground">
            Se déconnecter
          </button>
        </Card>
      </div>
    );
  }

  if (!canAccessRoute(role, location.pathname)) {
    return (
      <AppLayout>
        <Card className="p-10 text-center">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display text-lg mb-1">Accès refusé</h3>
          <p className="text-sm text-muted-foreground">
            Votre rôle ne vous permet pas d'accéder à cette page.
          </p>
        </Card>
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}
