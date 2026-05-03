import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useAgencySettings } from "@/hooks/use-agency-settings";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { agencySettingsSchema, type AgencySettings } from "@/lib/agency-settings";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { Building2, ImageIcon, Loader2, Upload, Trash2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/parametres-agence")({
  component: () => (
    <RequireAuth>
      <ParametresAgencePage />
    </RequireAuth>
  ),
});

const FIELDS = [
  { key: "agency_name", label: "Nom commercial de l'agence", placeholder: "Flow Travel Agency" },
  { key: "legal_name", label: "Raison sociale", placeholder: "SAS Flow Travel" },
  { key: "primary_contact_name", label: "Contact principal", placeholder: "Prénom Nom" },
  { key: "email", label: "Email", placeholder: "contact@agence.com", type: "email" },
  { key: "phone", label: "Téléphone", placeholder: "+33 1 23 45 67 89" },
  { key: "website", label: "Site web", placeholder: "https://agence.com" },
  { key: "city", label: "Ville", placeholder: "Paris" },
  { key: "country", label: "Pays", placeholder: "France" },
  { key: "siret", label: "SIRET", placeholder: "123 456 789 00012" },
  { key: "vat_number", label: "Numéro de TVA", placeholder: "FR12345678901" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"] | "address";

function ParametresAgencePage() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const { settings, refresh } = useAgencySettings();
  const navigate = useNavigate();

  const [form, setForm] = useState<Record<FieldKey, string>>({
    agency_name: "",
    legal_name: "",
    primary_contact_name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    country: "",
    siret: "",
    vat_number: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [utiliseCouverturesFx, setUtiliseCouverturesFx] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canEdit = role === "administrateur";

  useEffect(() => {
    if (settings) {
      setForm({
        agency_name: settings.agency_name ?? "",
        legal_name: settings.legal_name ?? "",
        primary_contact_name: settings.primary_contact_name ?? "",
        email: settings.email ?? "",
        phone: settings.phone ?? "",
        website: settings.website ?? "",
        address: settings.address ?? "",
        city: settings.city ?? "",
        country: settings.country ?? "",
        siret: settings.siret ?? "",
        vat_number: settings.vat_number ?? "",
      });
      setLogoUrl(settings.logo_url);
      setUtiliseCouverturesFx(!!settings.utilise_couvertures_fx);
    }
  }, [settings]);

  const update = (k: FieldKey, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le logo doit faire moins de 2 Mo");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Format d'image invalide");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("agency-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("agency-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success("Logo téléchargé");
    } catch (err) {
      toast.error("Échec du téléchargement", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
  };

  const handleSave = async () => {
    if (!user) return;
    const result = agencySettingsSchema.safeParse(form);
    if (!result.success) {
      const errs: Partial<Record<FieldKey, string>> = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as FieldKey;
        if (k) errs[k] = issue.message;
      }
      setErrors(errs);
      toast.error("Vérifiez les champs en erreur");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        agency_name: form.agency_name || null,
        legal_name: form.legal_name || null,
        primary_contact_name: form.primary_contact_name || null,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        address: form.address || null,
        city: form.city || null,
        country: form.country || null,
        siret: form.siret || null,
        vat_number: form.vat_number || null,
        logo_url: logoUrl,
      };
      const { error, data } = await supabase
        .from("agency_settings")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      await logAudit({
        userId: user.id,
        entity: "agency_settings",
        entityId: (data as AgencySettings).id,
        action: settings ? "update" : "create",
        description: "Paramètres agence enregistrés",
        newValue: payload,
        oldValue: settings ?? undefined,
      });
      await refresh();
      toast.success("Paramètres enregistrés");
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div>
        <PageHeader title="Paramètres agence" description="Personnalisez l&#39;identité de votre agence" />
        <Card className="p-8 mt-6 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Cette page est réservée aux rôles Administrateur et Gestion.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/app" })}>
            Retour au tableau de bord
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres agence"
        description="Personnalisez l&#39;identité de votre agence — Flow Travel reste le socle premium."
      />

      {/* Logo */}
      <Card className="p-6">
        <h2 className="font-display text-lg mb-4 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[color:var(--gold)]" />
          Logo de l'agence
        </h2>
        <div className="flex items-start gap-6 flex-wrap">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Original</p>
            <div className="w-32 h-32 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo agence" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center text-xs text-muted-foreground px-2">
                  <Building2 className="mx-auto h-6 w-6 mb-1 opacity-50" />
                  Aucun logo
                </div>
              )}
            </div>
          </div>

          {logoUrl && (
            <>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sur fond clair</p>
                <div className="w-32 h-32 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden">
                  <img src={logoUrl} alt="Aperçu fond clair" className="max-w-[80%] max-h-[80%] object-contain" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">En-tête sidebar</p>
                <div className="w-32 h-32 rounded-lg border border-border bg-[oklch(0.97_0.012_80)] flex items-center justify-center overflow-hidden">
                  <img src={logoUrl} alt="Aperçu sidebar" className="max-w-[75%] max-h-[75%] object-contain" />
                </div>
              </div>
            </>
          )}

          <div className="flex-1 min-w-[240px] space-y-3">
            <p className="text-sm text-muted-foreground">
              Format conseillé : PNG/SVG sur fond transparent, ratio carré, poids max 2 Mo.
              Le bloc d'en-tête de la sidebar s'adapte automatiquement à votre identité visuelle —
              votre logo n'est jamais altéré.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                />
                <Button type="button" variant="outline" disabled={uploading} asChild>
                  <span>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {logoUrl ? "Remplacer" : "Télécharger un logo"}
                  </span>
                </Button>
              </label>
              {logoUrl && (
                <Button type="button" variant="ghost" onClick={removeLogo}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Retirer
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Informations */}
      <Card className="p-6">
        <h2 className="font-display text-lg mb-4">Informations de l'agence</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type={"type" in f ? f.type : "text"}
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
              {errors[f.key] && (
                <p className="text-xs text-destructive">{errors[f.key]}</p>
              )}
            </div>
          ))}
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="address">Adresse</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="12 rue du Voyage, 75001 Paris"
              rows={2}
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Powered by Flow Travel
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </Card>
    </div>
  );
}
