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
  ArrowRight,
  RotateCcw,
  Eye,
} from "lucide-react";
import {
  runQaScenario,
  cleanupQaData,
  QA_STEPS,
  getStepDetails,
  type QaStep,
  type QaState,
  type QaDetail,
} from "@/lib/qa-scenario";

export const Route = createFileRoute("/qa")({
  head: () => ({
    meta: [
      { title: "QA — Test rapide · Flow Travel" },
      { name: "description", content: "Page de démonstration : déroulez un scénario de vente étape par étape." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QaPage,
});

const DEMO_EMAIL = "demo2@flowtravel.test";
const DEMO_PASSWORD = "DemoFlow!2026";

function makeInitialSteps(): QaStep[] {
  return QA_STEPS.map((s) => ({
    key: s.key,
    label: s.label,
    description: s.description,
    viewRoute: s.viewRoute,
    status: "pending",
  }));
}

function QaPage() {
  const { session, user, signIn, signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [busy, setBusy] = useState(false);

  // Mode pas-à-pas
  const [steps, setSteps] = useState<QaStep[]>(makeInitialSteps());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [state] = useState<QaState>({});
  const [stepBusy, setStepBusy] = useState(false);
  const [details, setDetails] = useState<Record<string, QaDetail | null>>({});
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});

  // Mode automatique
  const [autoSteps, setAutoSteps] = useState<QaStep[]>([]);
  const [running, setRunning] = useState(false);

  const quickAuth = async () => {
    setBusy(true);
    let { error } = await signIn(email, password);
    if (error) {
      const { error: e2 } = await signUp(email, password);
      if (e2) {
        toast.error(e2.message);
        setBusy(false);
        return;
      }
      const { error: e3 } = await signIn(email, password);
      if (e3) {
        toast.message("Compte créé", {
          description: "Confirmez votre email puis revenez sur cette page.",
        });
        setBusy(false);
        return;
      }
    }
    toast.success("Connecté");
    setBusy(false);
  };

  const runOneStep = async () => {
    if (!user) return;
    const def = QA_STEPS[currentIdx];
    if (!def) return;
    setStepBusy(true);
    setSteps((prev) => {
      const copy = [...prev];
      copy[currentIdx] = { ...copy[currentIdx], status: "running" };
      return copy;
    });
    try {
      const detail = await def.run(user.id, state);
      setSteps((prev) => {
        const copy = [...prev];
        copy[currentIdx] = { ...copy[currentIdx], status: "ok", detail };
        return copy;
      });
      // Charge les détails de l'étape et les ouvre par défaut
      try {
        const d = await getStepDetails(def.key, state);
        setDetails((prev) => ({ ...prev, [def.key]: d }));
        setOpenDetails((prev) => ({ ...prev, [def.key]: true }));
      } catch {
        /* ignore */
      }
      toast.success(def.label.replace(/^\d+\.\s*/, ""), { description: detail });
      setCurrentIdx((i) => Math.min(i + 1, QA_STEPS.length));
    } catch (e) {
      setSteps((prev) => {
        const copy = [...prev];
        copy[currentIdx] = {
          ...copy[currentIdx],
          status: "ko",
          detail: (e as Error).message,
        };
        return copy;
      });
      toast.error("Étape échouée", { description: (e as Error).message });
    } finally {
      setStepBusy(false);
    }
  };

  const resetSteps = () => {
    setSteps(makeInitialSteps());
    setCurrentIdx(0);
    setDetails({});
    setOpenDetails({});
    Object.keys(state).forEach((k) => delete (state as any)[k]);
  };

  const launchAuto = async () => {
    if (!user) return;
    setRunning(true);
    setAutoSteps([]);
    try {
      await runQaScenario(user.id, setAutoSteps);
      toast.success("Scénario terminé");
    } catch (e) {
      toast.error("Étape échouée : " + (e as Error).message);
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
      resetSteps();
      setAutoSteps([]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const currentStep = QA_STEPS[currentIdx];
  const stepDone = currentIdx >= QA_STEPS.length;

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
                <Button variant="ghost" size="sm">Se connecter</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[color:var(--gold)] font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Démonstration interactive
          </div>
          <h1 className="font-display text-4xl mt-3">Tester Flow Travel étape par étape</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Connectez-vous, puis déroulez le scénario d'une vente complète à votre rythme.
            À chaque étape, ouvrez la page concernée pour voir le résultat dans l'application.
          </p>
        </div>

        {/* Auth */}
        <Card className="p-6 border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center text-sm font-semibold">
              0
            </div>
            <h2 className="font-display text-xl">Authentification</h2>
          </div>

          {session ? (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm">
              Connecté : <span className="font-medium">{user?.email}</span>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                quickAuth();
              }}
              className="space-y-3 max-w-md"
            >
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                Se connecter / créer le compte démo
              </Button>
            </form>
          )}
        </Card>

        {/* Mode pas-à-pas */}
        <Card className="p-6 border-border/60 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl">Mode pas à pas</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Lancez chaque étape une par une. Étape{" "}
                <span className="font-medium text-foreground">
                  {Math.min(currentIdx + 1, QA_STEPS.length)}
                </span>{" "}
                / {QA_STEPS.length}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetSteps} disabled={stepBusy}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Réinitialiser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={cleanup}
                disabled={!session || busy}
                title="Supprimer données [QA]"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Nettoyer
              </Button>
            </div>
          </div>

          {/* Carte de l'étape courante */}
          {!stepDone && currentStep && (
            <div className="rounded-lg border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5 p-5">
              <div className="text-xs uppercase tracking-widest text-[color:var(--gold)] font-semibold mb-2">
                Prochaine étape
              </div>
              <h3 className="font-display text-lg">{currentStep.label}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {currentStep.description}
              </p>
              <div className="flex gap-2 mt-4 flex-wrap">
                <Button onClick={runOneStep} disabled={!session || stepBusy}>
                  {stepBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  Lancer cette étape
                </Button>
                {currentIdx > 0 && steps[currentIdx - 1]?.viewRoute && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate({ to: steps[currentIdx - 1].viewRoute! as any })
                    }
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Voir le résultat précédent
                  </Button>
                )}
              </div>
            </div>
          )}

          {stepDone && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-5">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-5 w-5" /> Scénario terminé !
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Explorez librement l'application avec les données générées.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" onClick={() => navigate({ to: "/" })}>Dashboard</Button>
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/cotations" })}>Cotations</Button>
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/dossiers" })}>Dossiers</Button>
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/rapprochement" })}>Rapprochement</Button>
              </div>
            </div>
          )}

          {/* Liste de toutes les étapes */}
          <ul className="space-y-2">
            {steps.map((s, idx) => (
              <li
                key={s.key}
                className={`flex items-start gap-3 text-sm rounded-md p-3 border ${
                  idx === currentIdx && !stepDone
                    ? "border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5"
                    : "border-transparent"
                }`}
              >
                <span className="mt-0.5">
                  {s.status === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
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
                        ? "text-foreground font-medium"
                        : s.status === "ko"
                          ? "text-destructive font-medium"
                          : "text-foreground"
                    }
                  >
                    {s.label}
                  </div>
                  {s.detail && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {s.detail}
                    </div>
                  )}
                </div>
                {s.status === "ok" && s.viewRoute && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate({ to: s.viewRoute! as any })}
                    className="shrink-0 h-7 text-xs"
                  >
                    Voir <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {/* Mode auto */}
        <Card className="p-6 border-border/60">
          <h2 className="font-display text-xl mb-2">Ou tout lancer d'un coup</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Exécute les 13 étapes en ~5 secondes (mode démo rapide).
          </p>
          <Button onClick={launchAuto} disabled={!session || running} variant="outline">
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Lancer le scénario complet
          </Button>
          {autoSteps.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {autoSteps.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  {s.status === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  {s.status === "ko" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                  {s.status === "running" && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--gold)]" />
                  )}
                  {s.status === "pending" && (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                  <span className="text-muted-foreground">{s.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
