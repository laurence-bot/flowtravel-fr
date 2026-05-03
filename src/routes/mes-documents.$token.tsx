import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getPublicBulletinDocuments } from "@/server/bulletin-public.functions";
import { formatEUR, formatDate } from "@/lib/format";
import { FileText, CheckCircle2, Download } from "lucide-react";

export const Route = createFileRoute("/mes-documents/$token")({
  loader: async ({ params }) => {
    const r = await getPublicBulletinDocuments({ data: { token: params.token } });
    if (!r.ok) throw notFound();
    return r;
  },
  head: () => ({ meta: [{ title: "Mes documents" }] }),
  component: MesDocumentsPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 text-center">
      <div>
        <h1 className="text-3xl font-serif mb-2">Lien invalide</h1>
        <p className="text-stone-600">Contactez votre conseiller.</p>
      </div>
    </div>
  ),
});

const TYPE_LABEL: Record<string, string> = {
  acompte_1: "Facture d'acompte n°1",
  acompte_2: "Facture d'acompte n°2",
  solde: "Facture de solde",
  globale: "Facture",
};

function MesDocumentsPage() {
  const { bulletin, factures, agency, cotation } = Route.useLoaderData();
  const params = Route.useParams();

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {agency?.logo_url && (
          <img src={agency.logo_url} alt="" className="h-12 mb-8 object-contain" />
        )}

        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">
            Mes documents
          </div>
          <h1 className="font-serif text-3xl text-stone-900">
            {cotation?.titre ?? "Votre voyage"}
          </h1>
          {cotation?.date_depart && (
            <p className="text-sm text-stone-600 mt-1">
              Du {formatDate(cotation.date_depart)}
              {cotation.date_retour ? ` au ${formatDate(cotation.date_retour)}` : ""}
            </p>
          )}
        </div>

        {/* Bulletin */}
        <section className="bg-white border border-stone-200 rounded-md p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-medium text-lg">Bulletin d'inscription signé</h2>
              <p className="text-sm text-stone-600 mt-1">
                {bulletin.signed_at
                  ? `Signé le ${formatDate(bulletin.signed_at)}`
                  : "En attente de signature"}
              </p>
              <Link
                to="/bulletin/$token"
                params={{ token: params.token }}
                className="inline-flex items-center gap-2 mt-3 text-sm text-stone-900 underline underline-offset-4"
              >
                <FileText className="h-4 w-4" /> Voir le bulletin
              </Link>
            </div>
          </div>
        </section>

        {/* Factures */}
        <section className="bg-white border border-stone-200 rounded-md p-6">
          <h2 className="font-medium text-lg mb-4">Vos factures</h2>
          {factures.length === 0 ? (
            <p className="text-sm text-stone-500">Aucune facture disponible pour le moment.</p>
          ) : (
            <ul className="divide-y divide-stone-200">
              {factures.map((f: any) => (
                <li key={f.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{TYPE_LABEL[f.type_facture] ?? "Facture"}</div>
                    <div className="text-xs text-stone-500 font-mono">{f.numero}</div>
                    {f.date_echeance && (
                      <div className="text-xs text-stone-500">
                        Échéance : {formatDate(f.date_echeance)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium tabular-nums">
                      {formatEUR(Number(f.montant_ttc))}
                    </div>
                    <a
                      href={`/factures-clients/${f.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-stone-700 underline underline-offset-4 inline-flex items-center gap-1 mt-1"
                    >
                      <Download className="h-3 w-3" /> Télécharger
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-stone-500 mt-6 text-center">
          {agency?.agency_name ?? "Votre agence"} — lien personnel, ne le transférez pas.
        </p>
      </div>
    </div>
  );
}
