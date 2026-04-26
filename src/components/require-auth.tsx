import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "./app-layout";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
        Chargement…
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" />;
  return <AppLayout>{children}</AppLayout>;
}
