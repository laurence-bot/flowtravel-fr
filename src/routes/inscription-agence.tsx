import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { CheckCircle2, FileText, Loader2, ShieldCheck, Upload } from "lucide-react";

export const Route = createFileRoute("/inscription-agence")({
  component: InscriptionAgencePage,
});

// --- Validation ---
const immatRegex = /^IM\d{9}$/i;
const siretRegex = /^\d{14}$/;

const sirenRegex = /^\d{9}$/;

const formSchema = z
  .object({
    nom_commercial: z.string().trim().min(2, "Nom de l'agence requis").max(150),
    raison_sociale: z.string().trim().max(150).optional().or(z.literal("")),
    immat_atout_france: z
      .string()
      .trim()
      .toUpperCase()
      .regex(immatRegex, "Format attendu : IM + 9 chiffres (ex: IM075100001)"),
    siret: z
      .string()
      .trim()
      .regex(siretRegex, "Le SIRET doit contenir exactement 14 chiffres"),
    est_etablissement_secondaire: z.boolean().default(false),
    siren_siege: z.string().trim().optional().or(z.literal("")),
    email_contact: z.string().trim().email("Email invalide").max(255),
    telephone: z.string().trim().max(30).optional().or(z.literal("")),
    adresse: z.string().trim().max(255).optional().or(z.literal("")),
    ville: z.string().trim().max(100).optional().or(z.literal("")),
    code_postal: z.string().trim().max(15).optional().or(z.literal("")),
    admin_full_name: z.string().trim().min(2, "Nom du gérant requis").max(150),
    password: z.string().min(8, "Mot de passe : 8 caractères minimum").max(72),
  })
  .refine(
    (d) => !d.est_etablissement_secondaire || sirenRegex.test(d.siren_siege ?? ""),
    {
      message: "SIREN du siège requis (9 chiffres) pour un établissement secondaire",
      path: ["siren_siege"],
    },
  );

type FormData = z.infer<typeof formSchema>;

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

type DocSlot = "atout_france" | "kbis" | "piece_identite";
const DOC_LABELS: Record<DocSlot, string> = {
  atout_france: "Attestation ATOUT FRANCE",
  kbis: "Extrait Kbis (moins de 3 mois)",
  piece_identite: "Pièce d'identité du gérant",
};

const STORAGE_KEY = "inscription_agence_state_v1";

const EMPTY_FORM: FormData = {
  nom_commercial: "",
  raison_sociale: "",
  immat_atout_france: "",
  siret: "",
  est_etablissement_secondaire: false,
  siren_siege: "",
  email_contact: "",
  telephone: "",
  adresse: "",
  ville: "",
  code_postal: "",
  admin_full_name: "",
  password: "",
};

function loadPersisted(): { step: 1 | 2 | 3; form: FormData } {
  if (typeof window === "undefined") return { step: 1, form: EMPTY_FORM };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { step: 1, form: EMPTY_FORM };
    const parsed = JSON.parse(raw) as { step?: number; form?: Partial<FormData> };
    const s = parsed.step === 2 || parsed.step === 3 ? parsed.step : 1;
    return { step: s as 1 | 2 | 3, form: { ...EMPTY_FORM, ...(parsed.form ?? {}) } };
  } catch {
    return { step: 1, form: EMPTY_FORM };
  }
}

function InscriptionAgencePage() {
  const navigate = useNavigate();
  const initial = typeof window !== "undefined" ? loadPersisted() : { step: 1 as const, form: EMPTY_FORM };
  const [step, setStep] = useState<1 | 2 | 3>(initial.step);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState<FormData>(initial.form);

  // Persiste step + form (pas les Files, non sérialisables)
  // pour résister à un éventuel remount du composant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, form }));
    } catch {
      /* ignore quota */
    }
  }, [step, form]);

  const [files, setFiles] = useState<Record<DocSlot, File | null>>({
    atout_france: null,
    kbis: null,
    piece_identite: null,
  });

  const update = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleFile = (slot: DocSlot, file: File | null) => {
    if (!file) {
      setFiles((p) => ({ ...p, [slot]: null }));
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Format accepté : PDF, JPG, PNG ou WEBP");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Fichier trop volumineux (max 8 Mo)");
      return;
    }
    setFiles((p) => ({ ...p, [slot]: file }));
  };

  const goToStep2 = () => {
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setStep(2);
  };

  const goToStep3 = () => {
    if (!files.atout_france || !files.kbis || !files.piece_identite) {
      toast.error("Les 3 documents sont obligatoires");
      return;
    }
    setStep(3);
  };

  const submit = async () => {
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      setStep(1);
      return;
    }
    if (!files.atout_france || !files.kbis || !files.piece_identite) {
      toast.error("Documents manquants");
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload les 3 docs sous /pending/<uuid>/...
      const folderToken = crypto.randomUUID();
      const uploadOne = async (slot: DocSlot, file: File) => {
        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `pending/${folderToken}/${slot}.${ext}`;
        const { error } = await supabase.storage
          .from("agence-documents")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw new Error(`${DOC_LABELS[slot]} : ${error.message}`);
        return path;
      };

      const [pAtout, pKbis, pPid] = await Promise.all([
        uploadOne("atout_france", files.atout_france),
        uploadOne("kbis", files.kbis),
        uploadOne("piece_identite", files.piece_identite),
      ]);

      // 2. Insertion de l'agence (statut = en_attente, admin_user_id = null pour l'instant)
      const { error: insErr } = await supabase.from("agences").insert({
        nom_commercial: parsed.data.nom_commercial,
        raison_sociale: parsed.data.raison_sociale || parsed.data.nom_commercial,
        immat_atout_france: parsed.data.immat_atout_france.toUpperCase(),
        siret: parsed.data.siret,
        email_contact: parsed.data.email_contact,
        telephone: parsed.data.telephone || null,
        adresse: parsed.data.adresse || null,
        ville: parsed.data.ville || null,
        code_postal: parsed.data.code_postal || null,
        admin_full_name: parsed.data.admin_full_name,
        statut: "en_attente",
        forfait: "solo",
        max_agents: 1,
        doc_atout_france_url: pAtout,
        doc_kbis_url: pKbis,
        doc_piece_identite_url: pPid,
      });

      if (insErr) {
        throw new Error(insErr.message.includes("duplicate") || insErr.code === "23505"
          ? "Ce numéro d'immatriculation ATOUT FRANCE est déjà enregistré."
          : insErr.message);
      }

      // 3. (Le compte utilisateur sera créé à la validation par le super-admin —
      // on mémorise juste le mot de passe souhaité côté serveur via signUp inactif ?
      // → Approche choisie : on crée le compte auth tout de suite, mais le profil
      //    sera lié à l'agence + activé seulement à la validation. Simplifié dans le Lot 2.)

      setDone(true);
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      toast.success("Demande envoyée. Nous revenons vers vous sous 24-48h.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
        <Card className="max-w-lg w-full p-10 text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[color:var(--gold)]/10 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-[color:var(--gold)]" />
            </div>
          </div>
          <h1 className="font-display text-2xl">Demande envoyée</h1>
          <p className="text-sm text-muted-foreground">
            Notre équipe va vérifier votre dossier (ATOUT FRANCE, Kbis, pièce d'identité).
            Vous recevrez un email à <strong>{form.email_contact}</strong> sous 24 à 48 heures
            ouvrées avec le lien d'activation de votre compte administrateur.
          </p>
          <div className="pt-4">
            <Button onClick={() => navigate({ to: "/auth" })} variant="outline">
              Retour à la connexion
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo variant="dark" showText={false} />
          <h1 className="font-display text-3xl mt-4 text-foreground">Créer un compte agence</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            FlowTravel est réservé aux agences immatriculées ATOUT FRANCE.
            Votre dossier sera vérifié sous 24-48h ouvrées.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  step >= n
                    ? "bg-[color:var(--gold)] text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {n}
              </div>
              {n < 3 && (
                <div
                  className={`w-12 h-px ${step > n ? "bg-[color:var(--gold)]" : "bg-border"}`}
                />
              )}
            </div>
          ))}
        </div>

        <Card className="p-7">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-medium text-lg flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[color:var(--gold)]" />
                  Informations de l'agence
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Toutes les informations doivent correspondre à votre Kbis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nom commercial *</Label>
                  <Input
                    value={form.nom_commercial}
                    onChange={(e) => update("nom_commercial", e.target.value)}
                    placeholder="Nom de votre agence"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Raison sociale</Label>
                  <Input
                    value={form.raison_sociale}
                    onChange={(e) => update("raison_sociale", e.target.value)}
                    placeholder="Si différente du nom commercial"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Immatriculation ATOUT FRANCE *</Label>
                  <Input
                    value={form.immat_atout_france}
                    onChange={(e) =>
                      update("immat_atout_france", e.target.value.toUpperCase())
                    }
                    placeholder="IM075100001"
                    maxLength={11}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Format : IM + 9 chiffres
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>SIRET *</Label>
                  <Input
                    value={form.siret}
                    onChange={(e) =>
                      update("siret", e.target.value.replace(/\D/g, "").slice(0, 14))
                    }
                    placeholder="14 chiffres"
                    maxLength={14}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Adresse</Label>
                  <Input
                    value={form.adresse}
                    onChange={(e) => update("adresse", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Code postal</Label>
                  <Input
                    value={form.code_postal}
                    onChange={(e) => update("code_postal", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Ville</Label>
                  <Input
                    value={form.ville}
                    onChange={(e) => update("ville", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input
                    value={form.telephone}
                    onChange={(e) => update("telephone", e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t pt-5 space-y-4">
                <h3 className="font-medium text-sm">Compte administrateur</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nom complet du gérant *</Label>
                    <Input
                      value={form.admin_full_name}
                      onChange={(e) => update("admin_full_name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email professionnel *</Label>
                    <Input
                      type="email"
                      value={form.email_contact}
                      onChange={(e) => update("email_contact", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Mot de passe *</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="8 caractères minimum"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Link
                  to="/auth"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Retour à la connexion
                </Link>
                <Button onClick={goToStep2}>Continuer</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-medium text-lg flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[color:var(--gold)]" />
                  Justificatifs
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPG, PNG ou WEBP — 8 Mo maximum par fichier.
                </p>
              </div>

              {(Object.keys(DOC_LABELS) as DocSlot[]).map((slot) => (
                <div key={slot} className="space-y-2">
                  <Label>{DOC_LABELS[slot]} *</Label>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor={`file-${slot}`}
                      className="flex-1 cursor-pointer border border-dashed border-border rounded-md px-4 py-3 hover:border-[color:var(--gold)] transition-colors flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground truncate">
                        {files[slot]?.name || "Choisir un fichier…"}
                      </span>
                    </label>
                    <input
                      id={`file-${slot}`}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => handleFile(slot, e.target.files?.[0] || null)}
                    />
                    {files[slot] && (
                      <CheckCircle2 className="w-5 h-5 text-[color:var(--gold)] shrink-0" />
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ← Retour
                </Button>
                <Button onClick={goToStep3}>Continuer</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-medium text-lg">Récapitulatif</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Vérifiez vos informations avant envoi.
                </p>
              </div>

              <div className="space-y-3 text-sm bg-muted/40 rounded-md p-4">
                <Row label="Agence" value={form.nom_commercial} />
                <Row label="ATOUT FRANCE" value={form.immat_atout_france} />
                <Row label="SIRET" value={form.siret} />
                <Row label="Gérant" value={form.admin_full_name} />
                <Row label="Email" value={form.email_contact} />
                <Row
                  label="Documents"
                  value={`${
                    [files.atout_france, files.kbis, files.piece_identite].filter(Boolean).length
                  } / 3 envoyés`}
                />
              </div>

              <div className="rounded-md border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 p-4 text-xs text-foreground/80">
                En soumettant cette demande, vous acceptez que FlowTravel vérifie
                votre immatriculation auprès du registre ATOUT FRANCE et de
                l'INSEE/Pappers. Aucun accès à la plateforme ne sera ouvert
                tant que la vérification n'est pas validée.
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>
                  ← Retour
                </Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Envoi en cours…
                    </>
                  ) : (
                    "Envoyer ma demande"
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}
