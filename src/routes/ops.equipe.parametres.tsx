import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { getHrSettings, upsertHrSettings, type HrSettings } from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/parametres")({
  component: ParametresEquipe,
});

function ParametresEquipe() {
  const [settings, setSettings] = useState<HrSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailComptable, setEmailComptable] = useState("");
  const [emailCC, setEmailCC] = useState("");
  const [jourEnvoi, setJourEnvoi] = useState(1);

  useEffect(() => {
    getHrSettings()
      .then((s) => {
        setSettings(s);
        if (s) {
          setEmailComptable(s.email_comptable ?? "");
          setEmailCC(s.email_comptable_cc ?? "");
          setJourEnvoi(s.jour_envoi_recap ?? 1);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await upsertHrSettings({
        email_comptable: emailComptable || null,
        email_comptable_cc: emailCC || null,
        jour_envoi_recap: jourEnvoi,
      });
      toast.success("Paramètres enregistrés");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l'équipe
      </Link>

      <PageHeader
        title="Paramètres RH"
        description="Configuration de l'envoi mensuel au comptable"
        action={<Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "…" : "Enregistrer"}</Button>}
      />

      <Card className="p-6 space-y-4 max-w-2xl">
        <h3 className="font-display text-lg">Email du comptable</h3>
        <p className="text-sm text-muted-foreground">
          Le récap mensuel (jours travaillés, congés, absences) sera envoyé automatiquement à cette adresse le jour défini de chaque mois pour les fiches de paie.
        </p>
        <div className="space-y-1.5">
          <Label>Email principal</Label>
          <Input type="email" placeholder="comptable@cabinet.fr" value={emailComptable} onChange={(e) => setEmailComptable(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email en copie (optionnel)</Label>
          <Input type="email" placeholder="" value={emailCC} onChange={(e) => setEmailCC(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Jour d'envoi du mois</Label>
          <Input type="number" min={1} max={28} value={jourEnvoi} onChange={(e) => setJourEnvoi(Number(e.target.value) || 1)} />
          <p className="text-xs text-muted-foreground">Le récap couvre toujours le mois précédent.</p>
        </div>
        {settings?.derniere_execution_at && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            Dernier envoi : {new Date(settings.derniere_execution_at).toLocaleString("fr-FR")}
          </p>
        )}
      </Card>

      <Card className="p-6 space-y-3 max-w-2xl border-dashed">
        <h3 className="font-display text-lg text-muted-foreground">Bientôt disponible</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Configuration des jours fériés</li>
          <li>Paramètres des notifications push</li>
          <li>Bouton "Envoyer le récap maintenant" (test)</li>
          <li>Modèles de contrats type</li>
        </ul>
      </Card>
    </div>
  );
}
