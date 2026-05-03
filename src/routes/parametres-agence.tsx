import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { agencySettingsSchema, type AgencySettings, type PaymentMethodKey, type CancelationTierAgence } from "@/lib/agency-settings";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { Building2, ImageIcon, Loader2, Upload, Trash2, ShieldAlert, PenLine, CreditCard, Receipt, Scale, Plus } from "lucide-react";

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

  // Bulletin / signature
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureNom, setSignatureNom] = useState("");

  // Paiement
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodKey[]>([]);
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [titulaireCompte, setTitulaireCompte] = useState("");
  const [lienPaiementCb, setLienPaiementCb] = useState("");
  const [lienPaiementCbLibelle, setLienPaiementCbLibelle] = useState("");
  const [instructionsPaiementAutres, setInstructionsPaiementAutres] = useState("");

  // Échéancier client
  const [pctAcompte1, setPctAcompte1] = useState(30);
  const [pctAcompte2, setPctAcompte2] = useState(0);
  const [pctSolde, setPctSolde] = useState(70);
  const [delaiAcompte2, setDelaiAcompte2] = useState<number | null>(null);
  const [delaiSolde, setDelaiSolde] = useState<number | null>(30);

  // Conditions annulation
  const [conditionsAnnulation, setConditionsAnnulation] = useState<CancelationTierAgence[]>([]);

  // Mentions légales
  const [garantInsolvabilite, setGarantInsolvabilite] = useState("");
  const [assureurRcPro, setAssureurRcPro] = useState("");
  const [numeroPoliceRc, setNumeroPoliceRc] = useState("");
  const [immatAtoutFrance, setImmatAtoutFrance] = useState("");
  const [numeroIata, setNumeroIata] = useState("");
  const [cgvText, setCgvText] = useState("");

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);

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
      setSignatureUrl(settings.signature_url);
      setSignatureNom(settings.signature_nom ?? settings.primary_contact_name ?? "");
      setPaymentMethods(Array.isArray(settings.payment_methods) ? settings.payment_methods : []);
      setIban(settings.iban ?? "");
      setBic(settings.bic ?? "");
      setTitulaireCompte(settings.titulaire_compte ?? "");
      setLienPaiementCb(settings.lien_paiement_cb ?? "");
      setLienPaiementCbLibelle(settings.lien_paiement_cb_libelle ?? "");
      setInstructionsPaiementAutres(settings.instructions_paiement_autres ?? "");
      setPctAcompte1(Number(settings.pct_acompte_client_1 ?? 30));
      setPctAcompte2(Number(settings.pct_acompte_client_2 ?? 0));
      setPctSolde(Number(settings.pct_solde_client ?? 70));
      setDelaiAcompte2(settings.delai_acompte_2_jours);
      setDelaiSolde(settings.delai_solde_jours);
      setConditionsAnnulation(Array.isArray(settings.conditions_annulation_agence) ? settings.conditions_annulation_agence : []);
      setGarantInsolvabilite(settings.garant_insolvabilite ?? "");
      setAssureurRcPro(settings.assureur_rc_pro ?? "");
      setNumeroPoliceRc(settings.numero_police_rc ?? "");
      setImmatAtoutFrance(settings.immat_atout_france ?? "");
      setNumeroIata(settings.numero_iata ?? "");
      setCgvText(settings.cgv_text ?? "");
    }
  }, [settings]);

  const update = (k: FieldKey, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const togglePayment = (key: PaymentMethodKey) => {
    setPaymentMethods((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  };

  const uploadImage = async (file: File, prefix: string): Promise<string | null> => {
    if (!user) return null;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le fichier doit faire moins de 2 Mo");
      return null;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Format d'image invalide");
      return null;
    }
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${prefix}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("agency-logos").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("agency-logos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "logo");
      if (url) {
        setLogoUrl(url);
        toast.success("Logo téléchargé");
      }
    } catch (err) {
      toast.error("Échec du téléchargement", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSig(true);
    try {
      const url = await uploadImage(file, "signature");
      if (url) {
        setSignatureUrl(url);
        toast.success("Signature téléchargée");
      }
    } catch (err) {
      toast.error("Échec du téléchargement", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploadingSig(false);
      e.target.value = "";
    }
  };

  const addCancelationTier = () => {
    setConditionsAnnulation((cur) => [...cur, { jours_avant: 30, pct_penalite: 50, par_personne: false }]);
  };

  const updateCancelationTier = (idx: number, patch: Partial<CancelationTierAgence>) => {
    setConditionsAnnulation((cur) => cur.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const removeCancelationTier = (idx: number) => {
    setConditionsAnnulation((cur) => cur.filter((_, i) => i !== idx));
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
    if (Math.abs(pctAcompte1 + pctAcompte2 + pctSolde - 100) > 0.01) {
      toast.error("La somme des pourcentages client doit faire 100 %");
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
        utilise_couvertures_fx: utiliseCouverturesFx,
        signature_url: signatureUrl,
        signature_nom: signatureNom || null,
        payment_methods: paymentMethods,
        iban: iban || null,
        bic: bic || null,
        titulaire_compte: titulaireCompte || null,
        lien_paiement_cb: lienPaiementCb || null,
        lien_paiement_cb_libelle: lienPaiementCbLibelle || null,
        instructions_paiement_autres: instructionsPaiementAutres || null,
        pct_acompte_client_1: pctAcompte1,
        pct_acompte_client_2: pctAcompte2,
        pct_solde_client: pctSolde,
        delai_acompte_2_jours: delaiAcompte2,
        delai_solde_jours: delaiSolde,
        conditions_annulation_agence: conditionsAnnulation,
        garant_insolvabilite: garantInsolvabilite || null,
        assureur_rc_pro: assureurRcPro || null,
        numero_police_rc: numeroPoliceRc || null,
        immat_atout_france: immatAtoutFrance || null,
        numero_iata: numeroIata || null,
        cgv_text: cgvText || null,
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
        entityId: (data as unknown as AgencySettings).id,
        action: settings ? "update" : "create",
        description: "Paramètres agence enregistrés",
      });
      await refresh();
      toast.success("Paramètres enregistrés");
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement", { description: err instanceof Error ? err.message : undefined });
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
        <PageHeader title="Paramètres agence" description="Personnalisez l'identité de votre agence" />
        <Card className="p-8 mt-6 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Cette page est réservée aux rôles Administrateur et Gestion.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/app" })}>
            Retour au tableau de bord
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres agence" description="Identité, paiements et conditions de vente." />

      {/* Logo */}
      <Card className="p-6">
        <h2 className="font-display text-lg mb-4 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[color:var(--gold)]" />
          Logo de l'agence
        </h2>
        <div className="flex items-start gap-6 flex-wrap">
          <div className="space-y-2">
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
          <div className="flex-1 min-w-[240px] space-y-3">
            <p className="text-sm text-muted-foreground">PNG/SVG transparent, max 2 Mo. Le logo apparaîtra sur le bulletin et la facture.</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex">
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                <Button type="button" variant="outline" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {logoUrl ? "Remplacer" : "Télécharger un logo"}
                  </span>
                </Button>
              </label>
              {logoUrl && (
                <Button type="button" variant="ghost" onClick={() => setLogoUrl(null)}>
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
              {errors[f.key] && <p className="text-xs text-destructive">{errors[f.key]}</p>}
            </div>
          ))}
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="address">Adresse</Label>
            <Textarea id="address" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="12 rue du Voyage, 75001 Paris" rows={2} />
          </div>
        </div>
      </Card>

      {/* Signature agent */}
      <Card className="p-6">
        <h2 className="font-display text-lg mb-2 flex items-center gap-2">
          <PenLine className="h-4 w-4 text-[color:var(--gold)]" />
          Signature pour les bulletins d'inscription
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          La signature image sera apposée automatiquement sur le bulletin envoyé au client (zone « Signature du détaillant »).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="signature_nom">Nom du signataire</Label>
            <Input id="signature_nom" value={signatureNom} onChange={(e) => setSignatureNom(e.target.value)} placeholder="Laurence Palandjian" />
          </div>
          <div className="space-y-1.5">
            <Label>Image de signature (PNG transparent)</Label>
            <div className="flex items-center gap-3">
              <div className="w-40 h-16 rounded border border-border bg-white flex items-center justify-center overflow-hidden">
                {signatureUrl ? (
                  <img src={signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">Aucune</span>
                )}
              </div>
              <label>
                <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} disabled={uploadingSig} />
                <Button type="button" variant="outline" size="sm" disabled={uploadingSig} asChild>
                  <span>
                    {uploadingSig ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Upload className="h-3 w-3 mr-2" />}
                    {signatureUrl ? "Remplacer" : "Téléverser"}
                  </span>
                </Button>
              </label>
              {signatureUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSignatureUrl(null)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Modes de paiement client */}
      <Card className="p-6">
        <h2 className="font-display text-lg mb-2 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-[color:var(--gold)]" />
          Modes de paiement acceptés (acompte client)
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Cochez les moyens de paiement proposés au client après validation du devis. Les instructions correspondantes s'afficheront sur la page de paiement.
        </p>
        <div className="space-y-4">
          {/* Virement */}
          <div className="border border-border rounded-md p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={paymentMethods.includes("virement")} onCheckedChange={() => togglePayment("virement")} />
              <span className="font-medium">Virement bancaire</span>
            </label>
            {paymentMethods.includes("virement") && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pl-6">
                <div>
                  <Label htmlFor="iban">IBAN</Label>
                  <Input id="iban" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="FR76 ..." />
                </div>
                <div>
                  <Label htmlFor="bic">BIC</Label>
                  <Input id="bic" value={bic} onChange={(e) => setBic(e.target.value)} placeholder="BNPAFRPP" />
                </div>
                <div>
                  <Label htmlFor="titulaire_compte">Titulaire</Label>
                  <Input id="titulaire_compte" value={titulaireCompte} onChange={(e) => setTitulaireCompte(e.target.value)} placeholder="SAS Mon Agence" />
                </div>
              </div>
            )}
          </div>

          {/* Lien CB */}
          <div className="border border-border rounded-md p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={paymentMethods.includes("lien_cb")} onCheckedChange={() => togglePayment("lien_cb")} />
              <span className="font-medium">Lien de paiement CB (banque)</span>
            </label>
            {paymentMethods.includes("lien_cb") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pl-6">
                <div>
                  <Label htmlFor="lien_cb">URL du lien de paiement</Label>
                  <Input id="lien_cb" value={lienPaiementCb} onChange={(e) => setLienPaiementCb(e.target.value)} placeholder="https://paiement.banque.fr/..." />
                </div>
                <div>
                  <Label htmlFor="lien_cb_libelle">Libellé du bouton</Label>
                  <Input id="lien_cb_libelle" value={lienPaiementCbLibelle} onChange={(e) => setLienPaiementCbLibelle(e.target.value)} placeholder="Payer par CB" />
                </div>
              </div>
            )}
          </div>

          {/* Autre */}
          <div className="border border-border rounded-md p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={paymentMethods.includes("autre")} onCheckedChange={() => togglePayment("autre")} />
              <span className="font-medium">Autres instructions</span>
            </label>
            {paymentMethods.includes("autre") && (
              <div className="mt-3 pl-6">
                <Label htmlFor="instr_autres">Texte libre (chèque, espèces en agence, ANCV…)</Label>
                <Textarea id="instr_autres" value={instructionsPaiementAutres} onChange={(e) => setInstructionsPaiementAutres(e.target.value)} rows={3} />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Échéancier client */}
      <Card className="p-6">
        <h2 className="font-display text-lg mb-2 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-[color:var(--gold)]" />
          Échéancier client par défaut
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Utilisé pour calculer l'acompte demandé sur le bulletin d'inscription. Total = 100 %.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>% Acompte 1 (à la réservation)</Label>
            <Input type="number" min={0} max={100} value={pctAcompte1} onChange={(e) => setPctAcompte1(Number(e.target.value))} />
          </div>
          <div>
            <Label>% Acompte 2 (intermédiaire)</Label>
            <Input type="number" min={0} max={100} value={pctAcompte2} onChange={(e) => setPctAcompte2(Number(e.target.value))} />
          </div>
          <div>
            <Label>% Solde</Label>
            <Input type="number" min={0} max={100} value={pctSolde} onChange={(e) => setPctSolde(Number(e.target.value))} />
          </div>
          <div>
            <Label>Délai acompte 2 (jours avant départ)</Label>
            <Input type="number" min={0} value={delaiAcompte2 ?? ""} onChange={(e) => setDelaiAcompte2(e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <Label>Délai solde (jours avant départ)</Label>
            <Input type="number" min={0} value={delaiSolde ?? ""} onChange={(e) => setDelaiSolde(e.target.value ? Number(e.target.value) : null)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Total : <strong>{pctAcompte1 + pctAcompte2 + pctSolde} %</strong>{" "}
          {Math.abs(pctAcompte1 + pctAcompte2 + pctSolde - 100) > 0.01 && (
            <span className="text-destructive">— doit faire 100 %</span>
          )}
        </p>
      </Card>

      {/* Conditions annulation */}
      <Card className="p-6">
        <h2 className="font-display text-lg mb-2 flex items-center gap-2">
          <Scale className="h-4 w-4 text-[color:var(--gold)]" />
          Conditions d'annulation agence
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Paliers affichés sur le bulletin (du plus loin au plus proche). Ex : 400 € + de 35 jrs / 50 % de 35 à 21 jrs / 75 % / 100 %.
        </p>
        <div className="space-y-2">
          {conditionsAnnulation.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Aucun palier défini.</p>
          )}
          {conditionsAnnulation.map((tier, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <Label className="text-xs">Jours avant départ ≤</Label>
                <Input type="number" min={0} value={tier.jours_avant} onChange={(e) => updateCancelationTier(i, { jours_avant: Number(e.target.value) })} />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">% pénalité</Label>
                <Input type="number" min={0} max={100} value={tier.pct_penalite ?? ""} onChange={(e) => updateCancelationTier(i, { pct_penalite: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Ou montant fixe (€)</Label>
                <Input type="number" min={0} value={tier.montant_eur ?? ""} onChange={(e) => updateCancelationTier(i, { montant_eur: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div className="col-span-2 flex items-center gap-1 pb-2">
                <Checkbox checked={!!tier.par_personne} onCheckedChange={(v) => updateCancelationTier(i, { par_personne: !!v })} />
                <span className="text-xs">/ pers.</span>
              </div>
              <div className="col-span-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCancelationTier(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addCancelationTier}>
            <Plus className="h-3 w-3 mr-1" /> Ajouter un palier
          </Button>
        </div>
      </Card>

      {/* Mentions légales */}
      <Card className="p-6">
        <h2 className="font-display text-lg mb-4">Mentions légales (bas du bulletin)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Immatriculation Atout France</Label>
            <Input value={immatAtoutFrance} onChange={(e) => setImmatAtoutFrance(e.target.value)} placeholder="IM075..." />
          </div>
          <div>
            <Label>Numéro IATA</Label>
            <Input value={numeroIata} onChange={(e) => setNumeroIata(e.target.value)} placeholder="20290012" />
          </div>
          <div>
            <Label>Garant insolvabilité</Label>
            <Input value={garantInsolvabilite} onChange={(e) => setGarantInsolvabilite(e.target.value)} placeholder="APST, Atradius..." />
          </div>
          <div>
            <Label>Assureur RC Pro</Label>
            <Input value={assureurRcPro} onChange={(e) => setAssureurRcPro(e.target.value)} placeholder="Hiscox, MMA..." />
          </div>
          <div className="md:col-span-2">
            <Label>N° police RC Pro</Label>
            <Input value={numeroPoliceRc} onChange={(e) => setNumeroPoliceRc(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Conditions générales de vente (CGV)</Label>
            <Textarea value={cgvText} onChange={(e) => setCgvText(e.target.value)} rows={6} placeholder="Texte affiché sur le bulletin que le client doit accepter avant signature." />
          </div>
        </div>
      </Card>

      {/* Couvertures FX */}
      <Card className="p-6">
        <h2 className="font-display text-lg mb-2">Couvertures de change (FX)</h2>
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={utiliseCouverturesFx} onCheckedChange={(v) => setUtiliseCouverturesFx(!!v)} className="mt-0.5" />
          <span className="text-sm">
            <strong>Mon agence utilise des couvertures FX</strong>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vous pourrez créer et réserver des couvertures (Ebury, iBanFirst…) depuis le menu Finance.
            </p>
          </span>
        </label>
      </Card>

      <div className="flex justify-end gap-3 sticky bottom-4">
        <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Enregistrer tous les paramètres
        </Button>
      </div>
    </div>
  );
}
