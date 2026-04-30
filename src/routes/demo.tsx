import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import {
  demoRequestSchema,
  extractEmailDomain,
  type DemoRequestInput,
} from "@/lib/demo-validation";
import { toast } from "sonner";
import { Shield, Eye, Clock, Lock } from "lucide-react";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
  head: () => ({
    meta: [
      { title: "Demander la démo — FlowTravel" },
      {
        name: "description",
        content:
          "Accédez à une démo confidentielle de FlowTravel. Réservée aux professionnels du voyage.",
      },
    ],
  }),
});

function DemoPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    agence_nom: "",
    agence_siret: "",
    agence_site_web: "",
    agence_taille: "",
    message: "",
    cgu_accepted: false,
  });

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = demoRequestSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const data: DemoRequestInput = parsed.data;

    setSubmitting(true);
    try {
      // Récupération IP/UA via API publique simple (best effort)
      let ip: string | null = null;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        if (r.ok) ip = (await r.json()).ip;
      } catch {
        /* noop */
      }

      const { data: created, error } = await supabase
        .from("demo_requests")
        .insert({
          prenom: data.prenom,
          nom: data.nom,
          email: data.email.toLowerCase(),
          email_domain: extractEmailDomain(data.email),
          telephone: data.telephone,
          agence_nom: data.agence_nom,
          agence_siret: data.agence_siret || null,
          agence_site_web: data.agence_site_web || null,
          agence_taille: data.agence_taille || null,
          message: data.message || null,
          ip_address: ip,
          user_agent: navigator.userAgent.slice(0, 400),
        })
        .select("video_token")
        .single();

      if (error) throw error;
      if (!created?.video_token) throw new Error("Token non généré");

      toast.success("Demande envoyée ! Accès à la démo en cours…");
      // Redirection directe vers le player (pas d'attente d'email pour cette V1)
      navigate({ to: "/demo/v/$token", params: { token: created.video_token } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Impossible d'envoyer la demande : ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/">
            <Logo variant="dark" />
          </Link>
          <Link
            to="/tarifs"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour aux tarifs
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-10 max-w-6xl mx-auto">
          {/* Colonne gauche : explication */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">
              <Shield className="h-3 w-3" />
              Démo confidentielle
            </div>
            <h1 className="font-display text-4xl md:text-5xl mt-5 text-foreground">
              Découvrez FlowTravel en exclusivité
            </h1>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Notre démo est réservée aux professionnels du voyage. Pour préserver la confidentialité
              de nos fonctionnalités exclusives, l'accès est encadré.
            </p>

            <div className="mt-8 space-y-4">
              {[
                {
                  i: <Eye className="h-5 w-5" />,
                  t: "Visionnage unique",
                  d: "Un seul visionnage autorisé, lié à votre adresse IP.",
                },
                {
                  i: <Clock className="h-5 w-5" />,
                  t: "Lien valable 48h",
                  d: "Le lien d'accès expire 48 heures après votre demande.",
                },
                {
                  i: <Lock className="h-5 w-5" />,
                  t: "Vidéo protégée",
                  d: "Watermark personnalisé, téléchargement et capture désactivés.",
                },
                {
                  i: <Shield className="h-5 w-5" />,
                  t: "RDV approfondi proposé",
                  d: "Après visionnage, réservez une démo personnalisée 30 min.",
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--gold)]/10 text-[color:var(--gold)] flex-shrink-0">
                    {item.i}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{item.t}</div>
                    <div className="text-sm text-muted-foreground">{item.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Colonne droite : formulaire */}
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input
                    id="prenom"
                    value={form.prenom}
                    onChange={(e) => setField("prenom", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input
                    id="nom"
                    value={form.nom}
                    onChange={(e) => setField("nom", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email professionnel *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@votreagence.com"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Les adresses gmail, yahoo, hotmail, etc. ne sont pas acceptées.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telephone">Téléphone *</Label>
                <Input
                  id="telephone"
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setField("telephone", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="agence_nom">Nom de votre agence *</Label>
                <Input
                  id="agence_nom"
                  value={form.agence_nom}
                  onChange={(e) => setField("agence_nom", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input
                    id="siret"
                    value={form.agence_siret}
                    onChange={(e) => setField("agence_siret", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="taille">Taille</Label>
                  <select
                    id="taille"
                    value={form.agence_taille}
                    onChange={(e) => setField("agence_taille", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">—</option>
                    <option value="1">1 personne</option>
                    <option value="2-5">2 à 5 personnes</option>
                    <option value="6-15">6 à 15 personnes</option>
                    <option value="16+">16+ personnes</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="site_web">Site web de l'agence</Label>
                <Input
                  id="site_web"
                  type="url"
                  placeholder="https://votreagence.com"
                  value={form.agence_site_web}
                  onChange={(e) => setField("agence_site_web", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message">Votre besoin (optionnel)</Label>
                <Textarea
                  id="message"
                  rows={3}
                  value={form.message}
                  onChange={(e) => setField("message", e.target.value)}
                />
              </div>

              <div className="flex items-start gap-2 pt-2">
                <Checkbox
                  id="cgu"
                  checked={form.cgu_accepted}
                  onCheckedChange={(v) => setField("cgu_accepted", v === true)}
                />
                <label htmlFor="cgu" className="text-xs text-muted-foreground leading-relaxed">
                  Je m'engage à ne pas enregistrer, capturer, diffuser ou reproduire le contenu de
                  la démo. Le non-respect est passible de poursuites. *
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Envoi…" : "Accéder à la démo"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Vos données sont confidentielles et ne sont pas partagées.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
