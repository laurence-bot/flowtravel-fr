import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { Calendar, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/demo/rdv/$token")({
  component: DemoRdvPage,
  head: () => ({
    meta: [
      { title: "Réserver une démo personnalisée — FlowTravel" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

type DemoRequest = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  agence_nom: string;
  video_token_expires_at: string;
};

type Slot = {
  id: string;
  date_debut: string;
  duree_minutes: number;
  capacite: number;
  visio_link: string | null;
};

function DemoRdvPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [demo, setDemo] = useState<DemoRequest | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookedCounts, setBookedCounts] = useState<Record<string, number>>({});
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: dr } = await supabase
          .from("demo_requests")
          .select(
            "id, prenom, nom, email, agence_nom, video_token_expires_at"
          )
          .eq("video_token", token)
          .maybeSingle();

        if (!dr || new Date(dr.video_token_expires_at).getTime() < Date.now()) {
          toast.error("Lien invalide ou expiré");
          navigate({ to: "/demo" });
          return;
        }
        setDemo(dr as DemoRequest);

        const { data: slotsData } = await supabase
          .from("demo_rdv_slots")
          .select("id, date_debut, duree_minutes, capacite, visio_link")
          .eq("actif", true)
          .gt("date_debut", new Date().toISOString())
          .order("date_debut", { ascending: true })
          .limit(30);

        const list = (slotsData ?? []) as Slot[];
        setSlots(list);

        if (list.length > 0) {
          const { data: bookings } = await supabase
            .from("demo_rdv_bookings")
            .select("slot_id")
            .in(
              "slot_id",
              list.map((s) => s.id)
            )
            .eq("statut", "confirme");
          const counts: Record<string, number> = {};
          (bookings ?? []).forEach((b: { slot_id: string }) => {
            counts[b.slot_id] = (counts[b.slot_id] ?? 0) + 1;
          });
          setBookedCounts(counts);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token, navigate]);

  const handleBook = async () => {
    if (!demo || !selectedSlot) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("demo_rdv_bookings").insert({
        demo_request_id: demo.id,
        slot_id: selectedSlot,
        notes_prospect: notes || null,
      });
      if (error) throw error;

      await supabase
        .from("demo_requests")
        .update({ statut: "rdv_pris" })
        .eq("id", demo.id);

      setConfirmed(true);
      toast.success("Votre RDV est confirmé !");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Erreur";
      toast.error(`Réservation impossible : ${m}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Chargement…</div>
      </div>
    );
  }

  if (confirmed && demo) {
    const slot = slots.find((s) => s.id === selectedSlot);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-lg w-full p-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-[color:var(--gold)] mx-auto mb-4" />
          <h1 className="font-display text-3xl text-foreground mb-3">RDV confirmé !</h1>
          <p className="text-muted-foreground mb-6">
            Merci {demo.prenom}. Nous avons hâte d'échanger avec vous le{" "}
            <strong className="text-foreground">
              {slot && new Date(slot.date_debut).toLocaleString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </strong>
            .
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Une confirmation avec le lien de visio vous sera envoyée à {demo.email}.
          </p>
          <Button asChild>
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/">
            <Logo variant="dark" />
          </Link>
          <Link
            to="/demo/v/$token"
            params={{ token }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Retour à la démo
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10">
          <Calendar className="h-10 w-10 text-[color:var(--gold)] mx-auto mb-3" />
          <h1 className="font-display text-4xl text-foreground">
            Réservez votre démo personnalisée
          </h1>
          <p className="text-muted-foreground mt-3">
            30 minutes en visio pour découvrir FlowTravel selon vos cas d'usage.
          </p>
        </div>

        {slots.length === 0 ? (
          <Card className="p-8 text-center">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Aucun créneau disponible pour le moment. Nous vous recontacterons rapidement à{" "}
              <strong>{demo?.email}</strong>.
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="space-y-2 mb-6">
              <Label>Choisissez un créneau *</Label>
              <div className="grid sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {slots.map((s) => {
                  const booked = bookedCounts[s.id] ?? 0;
                  const full = booked >= s.capacite;
                  const isSelected = selectedSlot === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={full}
                      onClick={() => setSelectedSlot(s.id)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10"
                          : full
                            ? "border-border/50 opacity-50 cursor-not-allowed"
                            : "border-border hover:border-[color:var(--gold)]/50"
                      }`}
                    >
                      <div className="text-sm font-medium text-foreground">
                        {new Date(s.date_debut).toLocaleString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.duree_minutes} min · {full ? "Complet" : "Disponible"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <Label htmlFor="notes">Sujets à aborder (optionnel)</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex : intégration avec mon outil comptable, gestion FX, formation équipe…"
              />
            </div>

            <Button
              onClick={handleBook}
              disabled={!selectedSlot || submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? "Réservation…" : "Confirmer le RDV"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
