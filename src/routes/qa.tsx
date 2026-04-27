import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  PlayCircle,
  Trash2,
  LogIn,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { runQaScenario, cleanupQaData, type QaStep } from "@/lib/qa-scenario";

export const Route = createFileRoute("/qa")({
  head: () => ({
    meta: [
      { title: "QA — Test rapide · Flow Travel" },
      { name: "description", content: "Page de démonstration : connectez-vous et lancez un scénario complet de vente en un clic." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QaPage,
});

const DEMO_EMAIL = "demo@flowtravel.test";
const DEMO_PASSWORD = "DemoFlow!2026";

function QaPage() {
  const { session, user, signIn, signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<QaStep[]>([]);
  const [running, setRunning] = useState(false);

  const quickAuth = async () => {
    setBusy(true);
    // Tente connexion ; si échec, tente signup puis reconnexion.
    let { error } = await signIn(email, password);
    if (error) {
      const { error: e2 } = await signUp(email, password);
      if (e2) {
        toast.error(e2.message);
        setBusy(false);
        return;
      }
      // Si auto-confirm OFF, signUp ne donne pas de session immédiate.
      const { error: e3 } = await signIn(email, password);
      if (e3) {
        toast.message("Compte créé", {
          description:
            "Confirmez votre email puis revenez sur cette page pour vous connecter.",
        });
        setBusy(false);
        return;
      }
    }
    toast.success("Connecté");
    setBusy(false);
  };

  const launch = async () => {
    if (!user) return;
    setRunning(true);
    setSteps([]);
    try {
      await runQaScenario(user.id, setSteps);
      toast.success("Scénario terminé · explorez l'application !");
    } catch (e) {
      toast.error("Une étape a échoué : " + (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const cleanup = async () => {
    if (!user) return;
    if (!confirm("Supprimer toutes les données préfixées [QA] de ce compte ?")) return;
    setBusy(true);
    try {
      await cleanupQaData(user.id);
      toast.success("Données QA supprimées");
      setSteps([]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <header className="border-b border-border/40 bg-background/60 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            {session ? (
              <>
                <Link to="/">
                  <Button variant="outline" size="sm">
                    Ouvrir l'app <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  Déconnexion
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm">Se connecter normalement</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[color:var(--gold)] font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Démonstration rapide
          </div>
          <h1 className="font-display text-4xl mt-3">Tester Flow Travel en 30 secondes</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Connectez-vous avec un compte de démo, puis générez d'un clic un scénario complet :
            demande client, cotation multi-devises, options fournisseurs, acompte, dossier,
            checklist opérationnelle, paiements et transactions bancaires à rapprocher.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Étape 1 : auth */}
          <Card className="p-6 border-border/60">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <h2 className="font-display text-xl">Authentification</h2>
            </div>

            {session ? (
              <div className="space-y-3">
                <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm">
                  Connecté : <span className="font-medium">{user?.email}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vous pouvez maintenant lancer le scénario ou explorer librement l'application.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  quickAuth();
                }}
                className="space-y-3"
              >
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="demo@flowtravel.test"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <LogIn className="h-4 w-4 mr-2" />
                  )}
                  Se connecter / Créer le compte démo
                </Button>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Si le compte n'existe pas, il est créé automatiquement. Si la confirmation
                  email est activée, ouvrez le lien reçu puis revenez ici.
                </p>
              </form>
            )}
          </Card>

          {/* Étape 2 : scénario */}
          <Card className="p-6 border-border/60">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <h2 className="font-display text-xl">Scénario de vente complet</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              13 étapes automatisées, ~5 secondes. Toutes les données créées sont préfixées
              <code className="mx-1 px-1.5 py-0.5 rounded bg-secondary text-xs">[QA]</code>
              pour pouvoir être nettoyées en un clic.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={launch}
                disabled={!session || running}
                className="flex-1"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-2" />
                )}
                Lancer le scénario
              </Button>
              <Button
                variant="outline"
                onClick={cleanup}
                disabled={!session || busy || running}
                title="Supprimer les données [QA]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Progression */}
        {steps.length > 0 && (
          <Card className="p-6 border-border/60">
            <h3 className="font-display text-lg mb-4">Progression</h3>
            <ul className="space-y-2">
              {steps.map((s) => (
                <li key={s.key} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5">
                    {s.status === "ok" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    {s.status === "ko" && <XCircle className="h-4 w-4 text-destructive" />}
                    {s.status === "running" && (
                      <Loader2 className="h-4 w-4 animate-spin text-[color:var(--gold)]" />
                    )}
                    {s.status === "pending" && (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </span>
                  <div className="flex-1">
                    <div
                      className={
                        s.status === "ok"
                          ? "text-foreground"
                          : s.status === "ko"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {s.label}
                    </div>
                    {s.detail && (
                      <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                        {s.detail}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {steps.every((s) => s.status === "ok") && (
              <div className="mt-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Scénario terminé avec succès.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Explorez : Demandes, Cotations, Dossiers, Paiements, Rapprochement, Prévisions, Audit…
                </p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => navigate({ to: "/" })}>
                    Dashboard
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/cotations" })}>
                    Cotations
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/dossiers" })}>
                    Dossiers
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/rapprochement" })}>
                    Rapprochement
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Couverture */}
        <Card className="p-6 border-border/60">
          <h3 className="font-display text-lg mb-3">Ce que le scénario couvre</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
            {[
              "Demande client (Tanzanie, 4 pax, 12 000 €)",
              "Cotation multi-devises EUR + USD",
              "Couverture FX 10 000 USD @ 1.08",
              "Marge brute · TVA marge · marge nette",
              "Passage en option + auto-options",
              "Option vol Ethiopian Airlines",
              "Deadline expirée + alerte dashboard",
              "Acompte client 4 000 €",
              "Confirmation fournisseurs",
              "Transformation en dossier + factures",
              "Checklist opérationnelle (5 tâches)",
              "Transaction bancaire à rapprocher",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--gold)] mt-1 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
