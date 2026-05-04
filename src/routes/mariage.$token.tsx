import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { getMariagePublic, submitMariageContribution } from "@/server/mariage-public.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Heart, Gift, Check } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@/lib/format";

export const Route = createFileRoute("/mariage/$token")({
  loader: async ({ params }) => {
    const res = await getMariagePublic({ data: { token: params.token } });
    if (!res.ok) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    const titre = loaderData?.ok ? (loaderData.cotation.mariage_titre || loaderData.cotation.titre) : "Liste de mariage";
    return { meta: [{ title: titre }, { name: "robots", content: "noindex" }] };
  },
  component: MariagePublicPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-serif mb-3">Liste indisponible</h1>
        <p className="text-stone-600">Ce lien n'est pas valide ou la liste de mariage n'est pas activée.</p>
      </div>
    </div>
  ),
});

function MariagePublicPage() {
  const data = Route.useLoaderData();
  if (!data.ok) return null;
  const { cotation, contributions, total, agency } = data;
  const objectif = Number(cotation.mariage_objectif ?? cotation.prix_vente_ttc ?? 0);
  const pct = objectif > 0 ? Math.min(100, (total / objectif) * 100) : 0;

  const [step, setStep] = useState<"form" | "done">("form");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [montant, setMontant] = useState<string>("100");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const m = Number(montant);
    if (!prenom.trim() || !nom.trim()) return toast.error("Prénom et nom requis");
    if (!Number.isFinite(m) || m <= 0) return toast.error("Montant invalide");
    setSubmitting(true);
    try {
      const res = await submitMariageContribution({
        data: {
          token: window.location.pathname.split("/").pop() ?? "",
          invite_prenom: prenom,
          invite_nom: nom,
          invite_email: email || undefined,
          montant: m,
          message: message || undefined,
        },
      });
      if (!res.ok) return toast.error(res.error ?? "Erreur");
      setStep("done");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50">
      {cotation.hero_image_url && (
        <div className="relative h-72 w-full overflow-hidden">
          <img src={cotation.hero_image_url} alt={cotation.titre} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/70 to-transparent" />
          <div className="absolute bottom-6 left-0 right-0 text-center text-white">
            <Heart className="w-8 h-8 mx-auto mb-2 fill-white" />
            <h1 className="text-4xl font-serif">{cotation.mariage_titre || cotation.titre}</h1>
            {cotation.destination && <p className="text-sm mt-1 opacity-90">Voyage de noces · {cotation.destination}</p>}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {!cotation.hero_image_url && (
          <header className="text-center space-y-2">
            <Heart className="w-10 h-10 mx-auto text-rose-400 fill-rose-200" />
            <h1 className="text-4xl font-serif">{cotation.mariage_titre || cotation.titre}</h1>
            {cotation.destination && <p className="text-stone-500">Voyage de noces · {cotation.destination}</p>}
          </header>
        )}

        {cotation.mariage_message && (
          <Card className="p-6 text-center italic text-stone-700">« {cotation.mariage_message} »</Card>
        )}

        <Card className="p-6">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm text-stone-500">Cagnotte</span>
            <span className="text-sm text-stone-500">Objectif {formatEUR(objectif)}</span>
          </div>
          <div className="text-3xl font-serif text-stone-900">{formatEUR(total)}</div>
          <Progress value={pct} className="mt-3" />
          <div className="text-xs text-stone-500 mt-2">{contributions.length} contribution{contributions.length > 1 ? "s" : ""}</div>
        </Card>

        {step === "form" ? (
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-serif flex items-center gap-2"><Gift className="w-5 h-5" />Participer à la cagnotte</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prénom *</Label><Input value={prenom} onChange={(e) => setPrenom(e.target.value)} /></div>
              <div><Label>Nom *</Label><Input value={nom} onChange={(e) => setNom(e.target.value)} /></div>
            </div>
            <div><Label>Email (pour le reçu)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div>
              <Label>Montant (€) *</Label>
              <div className="flex gap-2 mt-1">
                {[50, 100, 200, 500].map((v) => (
                  <Button key={v} type="button" variant={montant === String(v) ? "default" : "outline"} size="sm" onClick={() => setMontant(String(v))}>{v} €</Button>
                ))}
                <Input type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div>
              <Label>Petit mot pour les mariés</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background p-2 text-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tous nos vœux de bonheur…"
              />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? "Envoi…" : `Offrir ${formatEUR(Number(montant) || 0)}`}
            </Button>
            <p className="text-xs text-center text-stone-400">Paiement sécurisé · contribution traitée par {agency?.agency_name ?? "votre agence"}</p>
          </Card>
        ) : (
          <Card className="p-8 text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Check className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-serif">Merci {prenom} !</h2>
            <p className="text-stone-600">Votre contribution a bien été enregistrée. Les mariés seront ravis.</p>
          </Card>
        )}

        {contributions.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-serif mb-3">Contributions récentes</h2>
            <div className="space-y-3">
              {contributions.slice(0, 20).map((c: { invite_prenom?: string | null; invite_nom?: string | null; message?: string | null; montant?: number | string | null }, i: number) => (
                <div key={i} className="flex items-start justify-between border-b border-stone-100 pb-2 last:border-0">
                  <div>
                    <div className="font-medium text-stone-800">{c.invite_prenom} {c.invite_nom}</div>
                    {c.message && <div className="text-xs italic text-stone-500 mt-0.5">« {c.message} »</div>}
                  </div>
                  <div className="text-rose-600 font-medium">{formatEUR(Number(c.montant))}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
