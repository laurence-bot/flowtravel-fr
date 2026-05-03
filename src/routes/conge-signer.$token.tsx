import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/conge-signer/$token")({ component: LeaveSign });

function LeaveSign() {
  const { token } = useParams({ from: "/conge-signer/$token" });
  const [abs, setAbs] = useState<any>(null);
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    supabase.from("hr_absences").select("*").eq("token", token).maybeSingle()
      .then(({ data }) => { setAbs(data); setSigned(data?.statut === "signee"); });
  }, [token]);

  const sign = async () => {
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    const { error } = await supabase.from("hr_absences").update({
      signature_data: dataUrl, signed_at: new Date().toISOString(), statut: "signee",
    }).eq("token", token);
    if (error) return toast.error(error.message);
    setSigned(true); toast.success("Signé");
  };

  if (!abs) return <div className="p-10 text-center">Chargement…</div>;
  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <Card className="max-w-xl mx-auto p-8 space-y-5">
        <h1 className="font-display text-2xl">Confirmation congé</h1>
        <p>Du <strong>{abs.date_debut}</strong> au <strong>{abs.date_fin}</strong> ({abs.nb_jours ?? "—"} jours)</p>
        {signed ? <p className="text-green-700 text-center">✓ Confirmé</p> : (
          <>
            <canvas ref={canvasRef} width={500} height={150} className="border rounded bg-white w-full"
              onMouseDown={(e) => { drawing.current = true; const ctx = canvasRef.current!.getContext("2d")!; const r = canvasRef.current!.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top); }}
              onMouseMove={(e) => { if (!drawing.current) return; const ctx = canvasRef.current!.getContext("2d")!; const r = canvasRef.current!.getBoundingClientRect(); ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke(); }}
              onMouseUp={() => { drawing.current = false; }} onMouseLeave={() => { drawing.current = false; }} />
            <Button onClick={sign} className="w-full">Confirmer & signer</Button>
          </>
        )}
      </Card>
    </div>
  );
}
