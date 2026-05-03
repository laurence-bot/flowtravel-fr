import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getPublicPaymentInfo } from "@/server/payment-public.functions";
import { acceptPublicQuote } from "@/server/quote-public.functions";
import { themeStyle } from "@/lib/agency-theme";
import { formatEUR } from "@/lib/format";
import { computeAcompteClient } from "@/lib/cotations";
import { Building2, CreditCard, Copy, ExternalLink, Check, ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethodKey } from "@/lib/agency-settings";

export const Route = createFileRoute("/paiement/$token")({
  loader: async ({ params }) => {
    const res = await getPublicPaymentInfo({ data: { token: params.token } });
    if (!res.ok) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    const titre = loaderData?.ok ? loaderData.cotation.titre : "Paiement";
    return { meta: [{ title: `Paiement — ${titre}` }] };
  },
  component: PaymentPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-serif mb-3">Lien invalide</h1>
        <p className="text-stone-600">Contactez votre conseiller.</p>
      </div>
    </div>
  ),
});

function PaymentPage() {
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const { cotation, agency, contact, link } = data;
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(Boolean(link.accepted_at));
  const [selected, setSelected] = useState<PaymentMethodKey | null>(null);

  // On a besoin des lignes pour le calcul d'acompte. Pour rester léger, on
  // utilise prix_vente_ttc et un acompte par défaut 30 % si pas dispo.
  // (Le détail fin est calculable côté p/$token ; ici on affiche prix + acompte.)
  const acompte = Math.round(Number(cotation.prix_vente_ttc) * 0.30);
  const solde = Math.max(0, Number(cotation.prix_vente_ttc) - acompte);

  const methods = (agency?.payment_methods ?? []) as PaymentMethodKey[];
  const hasVirement = methods.includes("virement") && agency?.iban;
  const hasCb = methods.includes("lien_cb") && agency?.lien_paiement_cb;
  const hasAutre = methods.includes("autre") && agency?.instructions_paiement_autres;

  const handleConfirm = async () => {
    setConfirming(true);
    const r = await acceptPublicQuote({ data: { token: params.token } });
    setConfirming(false);
    if (r.ok) {
      setConfirmed(true);
      toast.success("Devis validé. Votre conseiller a été prévenu.");
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  return (
    <div style={themeStyle(agency)} className="min-h-screen bg-stone-50">
      <style>{`
        .brand-bg-primary { background-color: var(--brand-primary); }
        .brand-bg-signature { background-color: var(--brand-signature); }
        .brand-primary { color: var(--brand-primary); }
        .brand-signature { color: var(--brand-signature); }
        .brand-heading { font-family: var(--brand-font-heading); }
        .brand-border { border-color: var(--brand-ornament); }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          to="/p/$token"
          params={{ token: params.token }}
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au devis
        </Link>

        <div className="mb-8">
          <div className="brand-signature uppercase tracking-widest text-xs mb-2">
            Confirmation & paiement
          </div>
          <h1 className="brand-heading text-3xl md:text-4xl brand-primary font-light">
            {cotation.titre}
          </h1>
          {contact && (
            <p className="text-sm text-stone-600 mt-1">
              {contact.prenom} {contact.nom}
            </p>
          )}
        </div>

        {/* Récap */}
        <div className="bg-white border brand-border rounded-sm p-6 mb-6">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-sm text-stone-600">Prix total TTC</span>
            <span className="brand-heading text-2xl brand-primary">
              {formatEUR(Number(cotation.prix_vente_ttc))}
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-3 border-t brand-border">
            <span className="text-sm text-stone-600">Acompte à verser maintenant</span>
            <span className="brand-heading text-3xl brand-signature font-medium">
              {formatEUR(acompte)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-stone-500 mt-2">
            <span>Solde au départ</span>
            <span>{formatEUR(solde)}</span>
          </div>
        </div>

        {/* Moyens de paiement */}
        <h2 className="brand-heading text-xl brand-primary mb-3">Choisir un mode de paiement</h2>

        {methods.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm text-amber-900 flex gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              Votre agence ne nous a pas encore communiqué ses modes de paiement en ligne.
              Contactez votre conseiller{agency?.email ? ` à ${agency.email}` : ""}
              {agency?.phone ? ` ou au ${agency.phone}` : ""}.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {hasVirement && (
              <PaymentMethodCard
                active={selected === "virement"}
                onClick={() => setSelected("virement")}
                icon={<Building2 className="h-5 w-5" />}
                title="Virement bancaire"
                subtitle="Paiement sans frais. Confirmation sous 1 à 3 jours ouvrés."
              >
                <div className="space-y-2 text-sm">
                  {agency?.titulaire_compte && (
                    <Row label="Titulaire" value={agency.titulaire_compte} />
                  )}
                  {agency?.iban && (
                    <Row
                      label="IBAN"
                      value={agency.iban}
                      mono
                      onCopy={() => copy(agency.iban!, "IBAN")}
                    />
                  )}
                  {agency?.bic && (
                    <Row label="BIC" value={agency.bic} mono onCopy={() => copy(agency.bic!, "BIC")} />
                  )}
                  <Row
                    label="Référence"
                    value={`Acompte — ${cotation.titre}`}
                    onCopy={() => copy(`Acompte — ${cotation.titre}`, "Référence")}
                  />
                </div>
              </PaymentMethodCard>
            )}

            {hasCb && (
              <PaymentMethodCard
                active={selected === "lien_cb"}
                onClick={() => setSelected("lien_cb")}
                icon={<CreditCard className="h-5 w-5" />}
                title="Carte bancaire (lien sécurisé)"
                subtitle="Paiement immédiat via le lien sécurisé de notre banque."
              >
                <a
                  href={agency!.lien_paiement_cb!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brand-bg-signature text-white px-5 py-3 text-sm uppercase tracking-widest inline-flex items-center gap-2 hover:opacity-90"
                >
                  {agency?.lien_paiement_cb_libelle || "Payer par carte"}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </PaymentMethodCard>
            )}

            {hasAutre && (
              <PaymentMethodCard
                active={selected === "autre"}
                onClick={() => setSelected("autre")}
                icon={<Info className="h-5 w-5" />}
                title="Autres instructions"
              >
                <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700">
                  {agency!.instructions_paiement_autres}
                </pre>
              </PaymentMethodCard>
            )}
          </div>
        )}

        {/* Confirmation */}
        <div className="mt-8 bg-white border brand-border rounded-sm p-6">
          <p className="text-sm text-stone-600 mb-4">
            En cliquant sur <strong>« Je valide mon voyage »</strong>, vous acceptez le devis
            et confirmez votre intention d'effectuer le paiement de l'acompte selon le mode
            choisi. Votre conseiller sera prévenu et vous fera parvenir le bulletin
            d'inscription à signer dès réception du premier acompte.
          </p>
          <button
            onClick={handleConfirm}
            disabled={confirming || confirmed}
            className="brand-bg-signature text-white w-full py-4 text-sm uppercase tracking-widest font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {confirmed ? (
              <>
                <Check className="h-4 w-4" /> Voyage validé
              </>
            ) : confirming ? (
              "Validation…"
            ) : (
              "Je valide mon voyage"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white border rounded-sm transition-all ${
        active ? "brand-border shadow-md" : "border-stone-200"
      }`}
    >
      <button
        onClick={onClick}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className="brand-signature">{icon}</div>
        <div className="flex-1">
          <div className="font-medium brand-primary">{title}</div>
          {subtitle && <div className="text-xs text-stone-500 mt-0.5">{subtitle}</div>}
        </div>
        <div
          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
            active ? "brand-bg-signature border-transparent" : "border-stone-300"
          }`}
        >
          {active && <Check className="h-3 w-3 text-white" />}
        </div>
      </button>
      {active && <div className="px-4 pb-4 pt-1 border-t brand-border">{children}</div>}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-stone-500 text-xs uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="text-stone-400 hover:text-stone-700"
            title="Copier"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
