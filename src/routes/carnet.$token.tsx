import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { MapPin, Calendar } from "lucide-react";
import { formatDate } from "@/lib/format";

const adminClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const getCarnet = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const sb = adminClient();
    const { data: carnet } = await sb
      .from("carnets")
      .select("*")
      .eq("token", data.token)
      .eq("statut", "publie")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!carnet) return { ok: false as const };
    const { data: agency } = await sb
      .from("agency_settings")
      .select("agency_name,logo_url")
      .eq("user_id", carnet.user_id)
      .maybeSingle();
    return { ok: true as const, carnet, agency };
  });

export const Route = createFileRoute("/carnet/$token")({
  loader: async ({ params }) => {
    const res = await getCarnet({ data: { token: params.token } });
    if (!res.ok) throw notFound();
    return res;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.ok ? loaderData.carnet.titre : "Carnet de voyage" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CarnetPublicPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-serif mb-3">Carnet indisponible</h1>
        <p className="text-stone-600">Ce lien n'est plus valide.</p>
      </div>
    </div>
  ),
});

function CarnetPublicPage() {
  const data = Route.useLoaderData();
  if (!data.ok) return null;
  const { carnet, agency } = data;
  const jours: Array<{ titre: string; lieu?: string; date?: string; description?: string }> = Array.isArray(carnet.jours) ? carnet.jours : [];

  return (
    <main className="min-h-screen bg-stone-50">
      {carnet.hero_image_url ? (
        <div className="relative h-80 w-full overflow-hidden">
          <img src={carnet.hero_image_url} alt={carnet.titre} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 to-transparent" />
          <div className="absolute bottom-8 left-0 right-0 text-center text-white px-4">
            <p className="text-xs uppercase tracking-widest opacity-80">Carnet de voyage</p>
            <h1 className="text-5xl font-serif mt-2">{carnet.titre}</h1>
            {carnet.destination && <p className="mt-2 opacity-90 flex items-center justify-center gap-1"><MapPin className="w-4 h-4" />{carnet.destination}</p>}
          </div>
        </div>
      ) : (
        <header className="text-center py-12 px-4">
          <p className="text-xs uppercase tracking-widest text-stone-500">Carnet de voyage</p>
          <h1 className="text-5xl font-serif mt-2 text-stone-900">{carnet.titre}</h1>
          {carnet.destination && <p className="mt-2 text-stone-500 flex items-center justify-center gap-1"><MapPin className="w-4 h-4" />{carnet.destination}</p>}
        </header>
      )}

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {(carnet.date_debut || carnet.date_fin) && (
          <div className="text-center text-stone-600 flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" />
            {carnet.date_debut ? formatDate(carnet.date_debut) : ""} → {carnet.date_fin ? formatDate(carnet.date_fin) : ""}
          </div>
        )}

        {carnet.intro_text && (
          <Card className="p-6 italic text-stone-700 text-center">{carnet.intro_text}</Card>
        )}

        {jours.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-serif text-stone-900">Programme</h2>
            {jours.map((j, i) => (
              <Card key={i} className="p-6">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-serif text-xl">{j.titre}</h3>
                  {j.date && <span className="text-xs text-stone-500">{formatDate(j.date)}</span>}
                </div>
                {j.lieu && <p className="text-sm text-stone-500 flex items-center gap-1 mb-2"><MapPin className="w-3 h-3" />{j.lieu}</p>}
                {j.description && <p className="text-stone-700 whitespace-pre-wrap">{j.description}</p>}
              </Card>
            ))}
          </section>
        )}

        <footer className="text-center text-xs text-stone-400 pt-8">
          {agency?.agency_name ? `Carnet préparé par ${agency.agency_name}` : ""}
        </footer>
      </div>
    </main>
  );
}
