import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/logo";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Adresse email invalide").max(255),
  password: z.string().min(6, "Mot de passe : 6 caractères minimum").max(72),
});

function AuthPage() {
  const { session, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState("signin");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app" });
  }, [session, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const fn = tab === "signin" ? signIn : signUp;
    const { error } = await fn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (tab === "signup") {
      toast.success("Compte créé. Vous pouvez vous connecter.");
      setTab("signin");
    } else {
      toast.success("Bienvenue sur FlowTravel");
      navigate({ to: "/app" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo variant="dark" showText={false} />
          <h1 className="font-display text-3xl mt-4 text-foreground">FlowTravel</h1>
          <p className="text-sm text-muted-foreground mt-1">Travel Operating System</p>
          <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--gold)] mt-2">
            Maison de gestion financière
          </p>
        </div>
        <Card className="p-7 shadow-sm border-border/70">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Créer un compte</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Connexion…" : "Se connecter"}
                </Button>
                <div className="text-center">
                  <Link
                    to="/mot-de-passe-oublie"
                    className="text-xs text-muted-foreground hover:text-[color:var(--gold)] transition-colors"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email2">Adresse email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Mot de passe</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-xs text-muted-foreground">6 caractères minimum.</p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Création…" : "Créer le compte"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Outil interne — chaque utilisateur ne voit que ses propres données.
        </p>
      </div>
    </div>
  );
}
