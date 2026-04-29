import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  getPublicQuote,
  acceptPublicQuote,
  requestCallback,
  requestModification,
  chooseFlightOption,
} from "@/server/quote-public.functions";
import { themeStyle } from "@/lib/agency-theme";
import { formatEUR, formatDate } from "@/lib/format";
import { computeCotationFinance, ligneEcheances, computeAcompteClient } from "@/lib/cotations";
import { formatRoutingForClient, iataToCity } from "@/lib/iata";
import { airlineName } from "@/lib/airlines";
import { Check, Phone, MessageSquare, MapPin, Calendar, Users, Sparkles, Plane, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/p/$token")({
  loader: async ({ params }) => {
    const res = await getPublicQuote({ data: { token: params.token } });
    if (!res.ok) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    if (!loaderData || !loaderData.ok) return { meta: [{ title: "Devis" }] };
    const titre = loaderData.cotation.titre;
    const agence = loaderData.agency?.agency_name ?? "Votre agence";
    return {
      meta: [
        { title: `${titre} — ${agence}` },
        { name: "description", content: `Découvrez votre voyage sur-mesure : ${titre}` },
        { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
        { property: "og:title", content: `${titre} — ${agence}` },
        { property: "og:description", content: `Découvrez votre voyage sur-mesure.` },
        ...(loaderData.cotation.hero_image_url
          ? [{ property: "og:image", content: loaderData.cotation.hero_image_url }]
          : []),
      ],
    };
  },
  component: PublicQuotePage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-serif mb-3">Lien invalide ou expiré</h1>
        <p className="text-stone-600">
          Ce devis n'est plus accessible. Contactez votre conseiller pour obtenir un nouveau lien.
        </p>
      </div>
    </div>
  ),
});

function PublicQuotePage() {
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const [accepted, setAccepted] = useState(Boolean(data.link.accepted_at));
  const [callbackSent, setCallbackSent] = useState(Boolean(data.link.callback_requested_at));
  const [showModifModal, setShowModifModal] = useState(false);
  const [modifMsg, setModifMsg] = useState("");
  const [modifSent, setModifSent] = useState(Boolean(data.link.modification_requested_at));
  const [submitting, setSubmitting] = useState(false);
  const [chosenFlightId, setChosenFlightId] = useState<string | null>(
    (data.link as { chosen_flight_option_id?: string | null }).chosen_flight_option_id ?? null,
  );

  const { cotation, lignes, jours, vols, agency, contact } = data;
  const segments = (data as { segments?: Array<{
    id: string;
    flight_option_id: string;
    ordre: number;
    compagnie: string | null;
    numero_vol: string | null;
    aeroport_depart: string;
    date_depart: string | null;
    heure_depart: string | null;
    aeroport_arrivee: string;
    date_arrivee: string | null;
    heure_arrivee: string | null;
    duree_escale_minutes: number | null;
    notes: string | null;
  }> }).segments ?? [];
  const fin = computeCotationFinance(cotation, lignes);
  const acompteInfo = computeAcompteClient(cotation, lignes);
  const pricePerPax = cotation.nombre_pax > 0 ? fin.prixVente / cotation.nombre_pax : 0;

  // Échéancier consolidé
  const echeancier = lignes.flatMap((l: any) =>
    ligneEcheances(l).map((e) => ({
      type: e.type,
      date: e.date_echeance,
      montant_eur: (e.montant_devise * (l.taux_change_vers_eur || 1)) || 0,
    })),
  );

  // Hébergements = lignes prestation contenant "hôtel" / "hotel" / "lodge" / "camp" / "hébergement"
  const hebergements = lignes.filter((l: any) => {
    const p = (l.prestation || "").toLowerCase();
    return /hôtel|hotel|lodge|camp|riad|resort|h[eé]bergement|villa|maison/.test(p);
  });

  const handleAccept = async () => {
    setSubmitting(true);
    const r = await acceptPublicQuote({ data: { token: params.token } });
    setSubmitting(false);
    if (r.ok) {
      setAccepted(true);
      toast.success("Merci ! Votre conseiller a été prévenu.");
    } else toast.error(r.error || "Erreur");
  };

  const handleCallback = async () => {
    setSubmitting(true);
    const r = await requestCallback({ data: { token: params.token } });
    setSubmitting(false);
    if (r.ok) {
      setCallbackSent(true);
      toast.success("Demande envoyée. Votre conseiller vous rappelle au plus vite.");
    } else toast.error(r.error || "Erreur");
  };

  const handleModif = async () => {
    if (!modifMsg.trim()) return;
    setSubmitting(true);
    const r = await requestModification({ data: { token: params.token, message: modifMsg } });
    setSubmitting(false);
    if (r.ok) {
      setModifSent(true);
      setShowModifModal(false);
      toast.success("Demande de modification envoyée.");
    } else toast.error(r.error || "Erreur");
  };

  const handleChooseFlight = async (flightOptionId: string) => {
    setSubmitting(true);
    const r = await chooseFlightOption({ data: { token: params.token, flightOptionId } });
    setSubmitting(false);
    if (r.ok) {
      setChosenFlightId(flightOptionId);
      toast.success("Votre choix de vol a bien été transmis.");
    } else toast.error(r.error || "Erreur");
  };

  return (
    <div
      style={themeStyle(agency)}
      className="min-h-screen pb-24 md:pb-0"
    >
      <style>{`
        .brand-bg { background-color: var(--brand-background); }
        .brand-primary { color: var(--brand-primary); }
        .brand-signature { color: var(--brand-signature); }
        .brand-ornament { color: var(--brand-ornament); }
        .brand-bg-signature { background-color: var(--brand-signature); }
        .brand-bg-primary { background-color: var(--brand-primary); }
        .brand-bg-muted { background-color: var(--brand-muted); }
        .brand-border-ornament { border-color: var(--brand-ornament); }
        .brand-heading { font-family: var(--brand-font-heading); }
        .brand-body { font-family: var(--brand-font-body); }
      `}</style>

      <div className="brand-bg brand-body">
        {/* HERO */}
        <section className="relative h-[85vh] min-h-[600px] w-full overflow-hidden">
          {cotation.hero_image_url ? (
            <img
              src={cotation.hero_image_url}
              alt={cotation.titre}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />

          {/* Header agence */}
          <div className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6 text-white">
            <div className="flex items-center gap-3">
              {(agency?.logo_dark_url || agency?.logo_url) && (
                <img
                  src={agency.logo_dark_url || agency.logo_url || ""}
                  alt={agency.agency_name || ""}
                  className="h-12 md:h-16 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                />
              )}
              {agency?.agency_name && (
                <div className="brand-heading text-xl md:text-2xl font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  {agency.agency_name}
                </div>
              )}
            </div>
            {agency?.brand_baseline && (
              <div className="hidden md:block text-xs uppercase tracking-[0.25em] opacity-80">
                {agency.brand_baseline}
              </div>
            )}
          </div>

          {/* Contenu hero */}
          <div className="relative z-10 flex flex-col justify-end h-[calc(85vh-104px)] min-h-[496px] px-6 md:px-12 pb-16 md:pb-24 text-white max-w-5xl">
            {contact?.nom && (
              <div className="text-xs md:text-sm uppercase tracking-[0.3em] opacity-80 mb-4">
                Pour {contact.nom}
              </div>
            )}
            <h1 className="brand-heading text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] mb-6">
              {cotation.titre}
            </h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm md:text-base opacity-95 mb-8">
              {cotation.destination && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {cotation.destination}
                </span>
              )}
              {cotation.date_depart && (
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(cotation.date_depart)}
                  {cotation.date_retour && ` → ${formatDate(cotation.date_retour)}`}
                </span>
              )}
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {cotation.nombre_pax} voyageur{cotation.nombre_pax > 1 ? "s" : ""}
              </span>
            </div>

            {/* Prix dans le hero */}
            <div className="flex items-baseline gap-6 mb-8">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-70 mb-1">Total</div>
                <div className="brand-heading text-4xl md:text-5xl font-light">
                  {formatEUR(fin.prixVente)}
                </div>
              </div>
              {cotation.nombre_pax > 1 && (
                <div>
                  <div className="text-xs uppercase tracking-widest opacity-70 mb-1">Par personne</div>
                  <div className="brand-heading text-2xl md:text-3xl font-light">
                    {formatEUR(pricePerPax)}
                  </div>
                </div>
              )}
            </div>

            {/* CTA hero */}
            <div className="hidden md:flex flex-wrap gap-3">
              <ActionButtons
                accepted={accepted}
                callbackSent={callbackSent}
                modifSent={modifSent}
                submitting={submitting}
                onAccept={handleAccept}
                onCallback={handleCallback}
                onModif={() => setShowModifModal(true)}
                variant="hero"
              />
            </div>
          </div>
        </section>

        {/* STORYTELLING */}
        {(cotation.storytelling_intro || agency?.brand_signature_quote) && (
          <section className="px-6 md:px-12 py-20 md:py-32 max-w-3xl mx-auto text-center">
            {agency?.brand_signature_quote && (
              <div className="brand-signature uppercase tracking-[0.3em] text-xs mb-8">
                {agency.brand_signature_quote}
              </div>
            )}
            {cotation.storytelling_intro && (
              <p className="brand-heading text-2xl md:text-3xl font-light leading-relaxed brand-primary">
                {cotation.storytelling_intro}
              </p>
            )}
            <div className="brand-bg-signature h-px w-16 mx-auto mt-12 opacity-40" />
          </section>
        )}

        {/* CONTENU + BUDGET STICKY */}
        <div className="px-6 md:px-12 max-w-7xl mx-auto grid md:grid-cols-[1fr_360px] gap-12 md:gap-16 py-16">
          <div className="min-w-0">
            {/* ITINÉRAIRE */}
            {jours.length > 0 && (
              <section className="mb-20">
                <SectionTitle eyebrow="Jour par jour" title="Votre itinéraire" />
                <div className="space-y-8">
                  {jours.map((j: any, idx: number) => (
                    <article
                      key={j.id}
                      className="grid md:grid-cols-[180px_1fr] gap-6 group"
                    >
                      <div className="md:border-l-2 brand-border-ornament md:pl-6">
                        <div className="brand-signature text-sm uppercase tracking-widest mb-1">
                          Jour {idx + 1}
                        </div>
                        {j.date_jour && (
                          <div className="text-xs text-stone-500">{formatDate(j.date_jour)}</div>
                        )}
                        {j.lieu && (
                          <div className="text-sm brand-primary mt-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {j.lieu}
                          </div>
                        )}
                      </div>
                      <div>
                        {j.image_url && (
                          <img
                            src={j.image_url}
                            alt={j.titre}
                            className="w-full aspect-[16/9] object-cover rounded-sm mb-4"
                          />
                        )}
                        <h3 className="brand-heading text-2xl md:text-3xl font-light brand-primary mb-3">
                          {j.titre}
                        </h3>
                        {j.description && (
                          <p className="text-stone-700 leading-relaxed whitespace-pre-line">
                            {j.description}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* HÉBERGEMENTS */}
            {hebergements.length > 0 && (
              <section className="mb-20">
                <SectionTitle eyebrow="Vos adresses" title="Hébergements" />
                <div className="grid sm:grid-cols-2 gap-6">
                  {hebergements.map((h: any) => (
                    <div key={h.id} className="brand-bg-muted p-6 rounded-sm">
                      <div className="brand-heading text-xl brand-primary mb-2">
                        {h.nom_fournisseur}
                      </div>
                      {h.prestation && (
                        <div className="text-sm text-stone-600">{h.prestation}</div>
                      )}
                      {h.date_prestation && (
                        <div className="text-xs text-stone-500 mt-2">
                          {formatDate(h.date_prestation)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* VOLS */}
            {vols.length > 0 && (
              <section className="mb-20">
                <SectionTitle eyebrow="Aérien" title="Vos options de vol" />
                <div className="grid gap-4">
                  {vols.map((v: any) => {
                    const isChosen = chosenFlightId === v.id;
                    const volSegments = segments
                      .filter((s) => s.flight_option_id === v.id)
                      .sort((a, b) => a.ordre - b.ordre);
                    return (
                      <div
                        key={v.id}
                        className={`brand-bg-muted p-6 rounded-sm border-2 transition-all ${
                          isChosen ? "brand-border-ornament" : "border-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <Plane className="h-5 w-5 brand-signature shrink-0" />
                            <div>
                              <div className="brand-heading text-xl brand-primary">
                                {airlineName(v.compagnie)}
                              </div>
                              {v.numero_vol && (
                                <div className="text-xs text-stone-500 font-mono">
                                  Vol {v.numero_vol}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="brand-heading text-2xl brand-primary font-light">
                              {formatEUR(Number(v.prix) || 0)}
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-stone-500">
                              par personne
                            </div>
                          </div>
                        </div>

                        {volSegments.length > 0 ? (
                          <div className="space-y-4 mb-3">
                            {volSegments.map((seg, idx) => {
                              const fmtShort = (d: string | null) =>
                                d
                                  ? new Intl.DateTimeFormat("fr-FR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "2-digit",
                                    }).format(new Date(d))
                                  : "";
                              return (
                                <div key={seg.id}>
                                  <div className="flex items-baseline gap-2 brand-primary text-base font-medium mb-1.5">
                                    <span>{iataToCity(seg.aeroport_depart)}</span>
                                    <span className="text-stone-400">→</span>
                                    <span>{iataToCity(seg.aeroport_arrivee)}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-6 text-sm text-stone-700">
                                    <div>
                                      <div className="text-[10px] uppercase tracking-widest text-stone-500">
                                        Départ
                                      </div>
                                      <div className="tabular-nums">
                                        {fmtShort(seg.date_depart)}
                                        {seg.heure_depart && (
                                          <span className="ml-2 font-medium">
                                            {seg.heure_depart.slice(0, 5)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] uppercase tracking-widest text-stone-500">
                                        Arrivée
                                      </div>
                                      <div className="tabular-nums">
                                        {fmtShort(seg.date_arrivee)}
                                        {seg.heure_arrivee && (
                                          <span className="ml-2 font-medium">
                                            {seg.heure_arrivee.slice(0, 5)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {(() => {
                                    if (idx >= volSegments.length - 1) return null;
                                    const next = volSegments[idx + 1];
                                    // 1. Calcul auto à partir des dates/heures
                                    let mins: number | null = null;
                                    if (
                                      seg.date_arrivee &&
                                      seg.heure_arrivee &&
                                      next.date_depart &&
                                      next.heure_depart
                                    ) {
                                      const arr = new Date(
                                        `${seg.date_arrivee}T${seg.heure_arrivee}`,
                                      ).getTime();
                                      const dep = new Date(
                                        `${next.date_depart}T${next.heure_depart}`,
                                      ).getTime();
                                      const diff = Math.round((dep - arr) / 60000);
                                      if (diff > 0 && diff < 60 * 48) mins = diff;
                                    }
                                    // 2. Fallback sur la valeur saisie manuellement
                                    if (mins == null && seg.duree_escale_minutes) {
                                      mins = seg.duree_escale_minutes;
                                    }
                                    if (!mins) return null;
                                    const h = Math.floor(mins / 60);
                                    const m = mins % 60;
                                    return (
                                      <div className="text-xs text-stone-500 italic mt-2 pl-3 border-l-2 border-stone-300">
                                        Escale {h}h{String(m).padStart(2, "0")} à{" "}
                                        {iataToCity(seg.aeroport_arrivee)}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-stone-700 mb-3 whitespace-pre-line leading-relaxed">
                            {formatRoutingForClient(v.routing)}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-600">
                          {volSegments.length === 0 && v.date_depart && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Aller : {formatDate(v.date_depart)}
                              {v.heure_depart && ` · ${v.heure_depart.slice(0, 5)}`}
                            </span>
                          )}
                          {volSegments.length === 0 && v.date_retour && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Retour : {formatDate(v.date_retour)}
                              {v.heure_retour && ` · ${v.heure_retour.slice(0, 5)}`}
                            </span>
                          )}
                          {v.deadline_option_date && (
                            <span className="flex items-center gap-1 text-stone-500">
                              <Clock className="h-3 w-3" />
                              Option valable jusqu'au {formatDate(v.deadline_option_date)}
                            </span>
                          )}
                        </div>
                        {v.notes && (
                          <div className="text-xs text-stone-600 italic mt-2">{v.notes}</div>
                        )}
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => handleChooseFlight(v.id)}
                            disabled={submitting || isChosen}
                            className={`px-5 py-2 text-xs uppercase tracking-widest transition-all disabled:opacity-60 flex items-center gap-2 ${
                              isChosen
                                ? "brand-bg-signature text-white cursor-default"
                                : "border brand-border-ornament brand-primary hover:brand-bg-signature hover:text-white"
                            }`}
                          >
                            {isChosen ? (
                              <>
                                <Check className="h-3.5 w-3.5" /> Vol choisi
                              </>
                            ) : (
                              "Choisir cette option"
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* INCLUS / NON INCLUS */}
            {(cotation.inclus_text || cotation.non_inclus_text) && (
              <section className="mb-20">
                <SectionTitle eyebrow="Détail" title="Ce qui est inclus" />
                <div className="grid md:grid-cols-2 gap-8">
                  {cotation.inclus_text && (
                    <div>
                      <h3 className="brand-heading text-xl brand-signature mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Inclus
                      </h3>
                      <div className="text-sm text-stone-700 whitespace-pre-line leading-relaxed">
                        {cotation.inclus_text}
                      </div>
                    </div>
                  )}
                  {cotation.non_inclus_text && (
                    <div>
                      <h3 className="brand-heading text-xl text-stone-500 mb-3">
                        Non inclus
                      </h3>
                      <div className="text-sm text-stone-600 whitespace-pre-line leading-relaxed">
                        {cotation.non_inclus_text}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Footer agence */}
            <footer className="border-t brand-border-ornament pt-8 mt-16 text-center text-sm text-stone-600">
              <div className="brand-heading text-2xl brand-primary mb-2">
                {agency?.agency_name || ""}
              </div>
              {agency?.brand_baseline && (
                <div className="uppercase tracking-widest text-xs brand-signature mb-4">
                  {agency.brand_baseline}
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-stone-500">
                {agency?.email && <span>{agency.email}</span>}
                {agency?.phone && <span>{agency.phone}</span>}
                {agency?.website && <span>{agency.website}</span>}
              </div>
            </footer>
          </div>

          {/* BUDGET STICKY */}
          <aside className="md:sticky md:top-8 md:self-start">
            <div className="brand-bg-muted rounded-sm p-6 md:p-8">
              <div className="brand-signature uppercase tracking-widest text-xs mb-4">
                Votre voyage
              </div>
              <div className="brand-heading text-4xl font-light brand-primary mb-1">
                {formatEUR(fin.prixVente)}
              </div>
              <div className="text-sm text-stone-600 mb-6">
                {cotation.nombre_pax > 1 && `soit ${formatEUR(pricePerPax)} / personne`}
              </div>

              {acompteInfo.acompte > 0 && (
                <div className="border-t brand-border-ornament pt-4 mb-6">
                  <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                    À verser à la confirmation
                  </div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm text-stone-600">Acompte</span>
                    <span className="brand-heading text-2xl brand-signature font-medium">
                      {formatEUR(acompteInfo.acompte)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-stone-600">
                    <span>Solde au départ</span>
                    <span>{formatEUR(acompteInfo.solde)}</span>
                  </div>
                </div>
              )}

              {echeancier.length > 0 && (
                <div className="border-t brand-border-ornament pt-4 mb-6">
                  <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                    Échéancier
                  </div>
                  <div className="space-y-2 text-sm">
                    {echeancier.map((e: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="capitalize text-stone-600">
                          {e.type.replace("_", " ")}
                          {e.date && ` — ${formatDate(e.date)}`}
                        </span>
                        <span className="brand-primary font-medium">
                          {formatEUR(e.montant_eur)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="hidden md:flex flex-col gap-2">
                <ActionButtons
                  accepted={accepted}
                  callbackSent={callbackSent}
                  modifSent={modifSent}
                  submitting={submitting}
                  onAccept={handleAccept}
                  onCallback={handleCallback}
                  onModif={() => setShowModifModal(true)}
                  variant="sidebar"
                />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* CTA BAR MOBILE FIXE */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden brand-bg border-t brand-border-ornament p-3 flex gap-2 shadow-2xl">
        <ActionButtons
          accepted={accepted}
          callbackSent={callbackSent}
          modifSent={modifSent}
          submitting={submitting}
          onAccept={handleAccept}
          onCallback={handleCallback}
          onModif={() => setShowModifModal(true)}
          variant="mobile"
        />
      </div>

      {/* MODAL MODIFICATION */}
      {showModifModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="brand-bg rounded-sm max-w-lg w-full p-8">
            <h3 className="brand-heading text-2xl brand-primary mb-2">
              Demander une modification
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              Décrivez ce que vous souhaitez ajuster. Votre conseiller vous recontactera.
            </p>
            <textarea
              value={modifMsg}
              onChange={(e) => setModifMsg(e.target.value)}
              rows={5}
              className="w-full p-3 border brand-border-ornament rounded-sm bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-signature)]"
              placeholder="Par exemple : nous aimerions ajouter 2 nuits à Zanzibar…"
              maxLength={2000}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setShowModifModal(false)}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900"
              >
                Annuler
              </button>
              <button
                onClick={handleModif}
                disabled={submitting || !modifMsg.trim()}
                className="brand-bg-signature text-white px-6 py-2 text-sm uppercase tracking-widest disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-10">
      <div className="brand-signature uppercase tracking-[0.3em] text-xs mb-3">{eyebrow}</div>
      <h2 className="brand-heading text-3xl md:text-4xl font-light brand-primary">{title}</h2>
      <div className="brand-bg-signature h-px w-12 mt-4 opacity-40" />
    </div>
  );
}

type ActionsProps = {
  accepted: boolean;
  callbackSent: boolean;
  modifSent: boolean;
  submitting: boolean;
  onAccept: () => void;
  onCallback: () => void;
  onModif: () => void;
  variant: "hero" | "sidebar" | "mobile";
};

function ActionButtons(p: ActionsProps) {
  const isMobile = p.variant === "mobile";
  const isHero = p.variant === "hero";
  const baseAccept = isHero
    ? "bg-white text-black hover:bg-white/90"
    : "brand-bg-signature text-white hover:opacity-90";
  const baseSecondary = isHero
    ? "border border-white/40 text-white hover:bg-white/10 backdrop-blur-sm"
    : "border brand-border-ornament brand-primary hover:brand-bg-muted";

  return (
    <>
      <button
        onClick={p.onAccept}
        disabled={p.accepted || p.submitting}
        className={`${baseAccept} px-6 py-3 text-sm uppercase tracking-widest font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isMobile ? "flex-1" : ""}`}
      >
        {p.accepted ? (
          <>
            <Check className="h-4 w-4" /> {isMobile ? "Validé" : "Voyage validé"}
          </>
        ) : (
          <>{isMobile ? "Valider" : "Valider mon voyage"}</>
        )}
      </button>
      {!isMobile && (
        <button
          onClick={p.onModif}
          disabled={p.modifSent || p.submitting}
          className={`${baseSecondary} px-6 py-3 text-sm uppercase tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2`}
        >
          <MessageSquare className="h-4 w-4" />
          {p.modifSent ? "Demande envoyée" : "Modifier"}
        </button>
      )}
      <button
        onClick={p.onCallback}
        disabled={p.callbackSent || p.submitting}
        className={`${baseSecondary} ${isMobile ? "px-3" : "px-6"} py-3 text-sm uppercase tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2`}
      >
        <Phone className="h-4 w-4" />
        {!isMobile && (p.callbackSent ? "Rappel demandé" : "Être rappelé")}
      </button>
      {isMobile && (
        <button
          onClick={p.onModif}
          disabled={p.modifSent || p.submitting}
          className={`${baseSecondary} px-3 py-3 text-sm transition-all disabled:opacity-60`}
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      )}
    </>
  );
}
