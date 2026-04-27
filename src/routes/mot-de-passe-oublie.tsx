import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { ArrowLeft, MailCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().trim().email("Adresse email invalide").max(255),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      // Toujours afficher le même message — ne jamais révéler l'existence de l'email.
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
      });
      // Audit non bloquant : on n'a pas d'user.id (utilisateur non connecté), on log via l'email.
      if (!error) {
        // best-effort : récupérer l'éventuel user_id côté profil pour un audit propre
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("user_id")
          .eq("email", parsed.data.email.toLowerCase())
          .maybeSingle();
        if (profile?.user_id) {
          await logAudit({
            userId: profile.user_id,
            entity: "agency_settings",
            action: "update",
            description: "Demande de réinitialisation du mot de passe",
          });
        }
      }
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo variant="dark" showText={false} />
          <h1 className="font-display text-3xl mt-4 text-foreground">Mot de passe oublié</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recevez un lien sécurisé pour réinitialiser votre mot de passe.
          </p>
        </div>

        <Card className="p-7 shadow-sm border-border/70">
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <MailCheck className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm text-foreground font-medium">Email envoyé</p>
              <p className="text-sm text-muted-foreground">
                Si un compte existe avec cet email, un lien de réinitialisation vient d'être
                envoyé. Vérifiez votre boîte de réception et vos spams.
              </p>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-[color:var(--gold)] transition-colors mt-4"
              >
                <ArrowLeft className="h-3 w-3" />
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@agence.com"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {submitting ? "Envoi…" : "Envoyer le lien de réinitialisation"}
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
