import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/reinitialiser-mot-de-passe")({
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z
      .string()
      .min(8, "8 caractères minimum")
      .max(72, "72 caractères maximum")
      .regex(/[A-Z]/, "Au moins une majuscule")
      .regex(/[a-z]/, "Au moins une minuscule")
      .regex(/[0-9]/, "Au moins un chiffre"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm"],
  });

type LinkState = "checking" | "valid" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Le clic sur le lien email pose une session de récupération.
    // On écoute l'événement PASSWORD_RECOVERY puis on vérifie la présence d'une session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setLinkState("valid");
      }
    });

    // Vérification initiale
    supabase.auth.getSession().then(({ data }) => {
      // Si on a une session ET un fragment de type recovery dans l'URL, OK.
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const isRecovery = hash.includes("type=recovery");
      if (data.session) {
        setLinkState("valid");
      } else if (!isRecovery) {
        // Laisser un court délai au listener au cas où le hash est en cours de traitement
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            setLinkState(d2.session ? "valid" : "invalid");
          });
        }, 800);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { data: userBefore } = await supabase.auth.getUser();
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        toast.error("Impossible de réinitialiser le mot de passe", {
          description: error.message,
        });
        setSubmitting(false);
        return;
      }
      if (userBefore.user?.id) {
        await logAudit({
          userId: userBefore.user.id,
          entity: "agency_settings",
          action: "update",
          description: "Mot de passe réinitialisé",
        });
      }
      setDone(true);
      toast.success("Votre mot de passe a été réinitialisé.");
      // Déconnexion explicite pour forcer une nouvelle connexion propre
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/auth" }), 2500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo variant="dark" showText={false} />
          <h1 className="font-display text-3xl mt-4 text-foreground">
            Nouveau mot de passe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choisissez un mot de passe sécurisé pour votre compte FlowTravel.
          </p>
        </div>

        <Card className="p-7 shadow-sm border-border/70">
          {linkState === "checking" && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {linkState === "invalid" && (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm font-medium text-foreground">Lien expiré ou invalide</p>
              <p className="text-sm text-muted-foreground">
                Le lien de réinitialisation est expiré ou n'est plus valide. Veuillez en
                demander un nouveau.
              </p>
              <Link
                to="/mot-de-passe-oublie"
                className="inline-block text-xs text-[color:var(--gold)] hover:underline"
              >
                Demander un nouveau lien
              </Link>
            </div>
          )}

          {linkState === "valid" && done && (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Votre mot de passe a été réinitialisé.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirection vers la page de connexion…
              </p>
            </div>
          )}

          {linkState === "valid" && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  8 caractères minimum, dont une majuscule, une minuscule et un chiffre.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {submitting ? "Mise à jour…" : "Réinitialiser le mot de passe"}
              </Button>
              <div className="text-center pt-2">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-[color:var(--gold)] transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </Card>

        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-6">
          Powered by Flow Travel
        </p>
      </div>
    </div>
  );
}
