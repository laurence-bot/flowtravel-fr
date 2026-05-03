import { createFileRoute, useParams, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/contrat-signer/$token")({ component: ContractSign });

function ContractSign() {
  const { token } = useParams({ from: "/contrat-signer/$token" });
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    supabase.from("hr_contracts").select("*").eq("token", token).maybeSingle()
      .then(({ data }) => { if (!data) throw notFound(); setContract(data); setSigned(data.statut === "signe"); })
      .finally(() => setLoading(false));
  }, [token]);

  const sign = async () => {
    if (!nom) { toast.error("Nom requis"); return; }
    const c = canvasRef.current!;
    const dataUrl = c.toDataURL("image/png");
    const { error } = await supabase.from("hr_contracts").update({
      signature_data: dataUrl, signataire_nom: nom, signed_at: new Date().toISOString(), statut: "signe",
    }).eq("token", token);
    if (error) return toast.error(error.message);
    setSigned(true); toast.success("Signé !");
  };

  if (loading) return <div className="p-10 text-center">Chargement…</div>;
  if (!contract) return <div className="p-10 text-center">Lien invalide.</div>;

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <Card className="max-w-3xl mx-auto p-8 space-y-6">
        <h1 className="font-display text-2xl">{contract.titre}</h1>
        {contract.contenu_html && <div className="prose max-w-none text-sm" dangerouslySetInnerHTML={{ __html: contract.contenu_html }} />}
        {signed ? (
          <p className="text-green-700 text-center py-6">✓ Document signé</p>
        ) : (
          <>
            <div><label className="text-xs uppercase">Nom du signataire</label><Input value={nom} onChange={(e) => setNom(e.target.value)} /></div>
            <div>
              <label className="text-xs uppercase">Signature</label>
              <canvas ref={canvasRef} width={500} height={150} className="border rounded bg-white w-full"
                onMouseDown={(e) => { drawing.current = true; const ctx = canvasRef.current!.getContext("2d")!; const r = canvasRef.current!.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top); }}
                onMouseMove={(e) => { if (!drawing.current) return; const ctx = canvasRef.current!.getContext("2d")!; const r = canvasRef.current!.getBoundingClientRect(); ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke(); }}
                onMouseUp={() => { drawing.current = false; }} onMouseLeave={() => { drawing.current = false; }}
              />
            </div>
            <Button onClick={sign} className="w-full">Signer</Button>
          </>
        )}
      </Card>
    </div>
  );
}
