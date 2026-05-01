import { createFileRoute, notFound } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { getPublicBulletin, signBulletin } from "@/server/bulletin-public.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Check, Eraser, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatEUR, formatDate } from "@/lib/format";

export const Route = createFileRoute("/bulletin/$token")({
  loader: async ({ params }) => {
    const res = await getPublicBulletin({ data: { token: params.token } });
    if (!res.ok) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    const titre = loaderData?.ok && loaderData.cotation?.titre ? loaderData.cotation.titre : "Bulletin d'inscription";
    return { meta: [{ title: `Bulletin — ${titre}` }, { name: "robots", content: "noindex, nofollow" }] };
  },
  component: BulletinPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-serif mb-3">Lien invalide ou expiré</h1>
        <p className="text-stone-600">Contactez votre conseiller pour obtenir un nouveau lien.</p>
      </div>
    </div>
  ),
});

function BulletinPage() {
  const data = Route.useLoaderData();
  if (!data.ok) return null;
  const { bulletin, cotation, client, agency } = data;
  const [signataireNom, setSignataireNom] = useState(client?.nom ?? bulletin.signataire_nom ?? "");
  const [signataireEmail, setSignataireEmail] = useState(client?.email ?? "");
  const [acceptCgv, setAcceptCgv] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(bulletin.statut === "signe");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#0B0B0B";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return {
      x: ((point.clientX - rect.left) / rect.width) * c.width,
      y: ((point.clientY - rect.top) / rect.height) * c.height,
    };
  };
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  };
  const end = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    hasInk.current = false;
  };

  const submit = async () => {
    if (!hasInk.current) {
      toast.error("Veuillez signer dans le cadre");
      return;
    }
    if (!signataireNom.trim()) {
      toast.error("Veuillez saisir votre nom complet");
      return;
    }
    if (!acceptCgv) {
      toast.error("Vous devez accepter les conditions");
      return;
    }
    setSubmitting(true);
    try {
      const dataUrl = canvasRef.current!.toDataURL("image/png");
      const res = await signBulletin({
        data: {
          token: bulletin.token,
          signature_data: dataUrl,
          signataire_nom: signataireNom,
          signataire_email: signataireEmail || undefined,
          conditions_acceptees: true,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Erreur lors de la signature");
        return;
      }
      setSigned(true);
      toast.success("Bulletin signé. Merci !");
    } finally {
      setSubmitting(false);
    }
  };

  if (signed) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-12 flex items-center justify-center">
        <Card className="max-w-lg w-full p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
            <Check className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-serif mb-2">Bulletin signé</h1>
          <p className="text-stone-600">
            Merci, votre bulletin d'inscription a bien été enregistré. Votre conseiller {agency?.agency_name ?? ""} vous recontactera très vite.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-stone-200 pb-4">
          <div>
            {agency?.logo_url && <img src={agency.logo_url} alt={agency.agency_name ?? ""} className="h-10 mb-2" />}
            <p className="text-xs uppercase tracking-widest text-stone-500">Bulletin d'inscription</p>
            <h1 className="text-2xl font-serif text-stone-900">{cotation?.titre ?? "Voyage sur-mesure"}</h1>
          </div>
          <FileText className="w-6 h-6 text-stone-400" />
        </header>

        <Card className="p-6 space-y-2">
          <h2 className="font-medium text-stone-900">Récapitulatif</h2>
          {cotation?.destination && <p className="text-sm text-stone-700"><strong>Destination :</strong> {cotation.destination}</p>}
          {cotation?.date_depart && <p className="text-sm text-stone-700"><strong>Dates :</strong> {formatDate(cotation.date_depart)} → {cotation.date_retour ? formatDate(cotation.date_retour) : ""}</p>}
          {cotation?.nombre_pax && <p className="text-sm text-stone-700"><strong>Voyageurs :</strong> {cotation.nombre_pax}</p>}
          {cotation?.prix_vente_ttc != null && <p className="text-sm text-stone-700"><strong>Montant TTC :</strong> {formatEUR(Number(cotation.prix_vente_ttc))}</p>}
        </Card>

        {(bulletin.conditions_text || agency?.cgv_text) && (
          <Card className="p-6">
            <h2 className="font-medium text-stone-900 mb-2">Conditions générales</h2>
            <div className="max-h-48 overflow-auto text-xs text-stone-600 whitespace-pre-wrap border border-stone-200 rounded p-3 bg-white">
              {bulletin.conditions_text || agency?.cgv_text}
            </div>
          </Card>
        )}

        <Card className="p-6 space-y-4">
          <h2 className="font-medium text-stone-900">Signature</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nom">Nom complet</Label>
              <Input id="nom" value={signataireNom} onChange={(e) => setSignataireNom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={signataireEmail} onChange={(e) => setSignataireEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Signez ci-dessous</Label>
            <div className="mt-1 border border-stone-300 rounded-md bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={180}
                className="w-full h-44 touch-none cursor-crosshair rounded-md"
                onMouseDown={start}
                onMouseMove={move}
                onMouseUp={end}
                onMouseLeave={end}
                onTouchStart={start}
                onTouchMove={move}
                onTouchEnd={end}
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clear} className="mt-2">
              <Eraser className="w-3 h-3 mr-1" /> Effacer
            </Button>
          </div>

          <label className="flex items-start gap-2 text-sm text-stone-700">
            <Checkbox checked={acceptCgv} onCheckedChange={(v) => setAcceptCgv(Boolean(v))} className="mt-0.5" />
            <span>J'ai lu et j'accepte les conditions générales de vente.</span>
          </label>

          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? "Envoi…" : "Signer le bulletin"}
          </Button>
        </Card>

        <p className="text-center text-xs text-stone-400">
          {agency?.legal_name ?? agency?.agency_name ?? ""} {agency?.siret ? `· SIRET ${agency.siret}` : ""}
        </p>
      </div>
    </main>
  );
}
