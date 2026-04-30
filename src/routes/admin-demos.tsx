import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { Calendar, Plus, Trash2, Eye, Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/admin-demos")({
  component: AdminDemosPage,
});

type DemoRequest = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  agence_nom: string;
  agence_siret: string | null;
  agence_site_web: string | null;
  agence_taille: string | null;
  message: string | null;
  statut: string;
  video_view_count: number;
  video_first_viewed_at: string | null;
  created_at: string;
  ip_address: string | null;
};

type Slot = {
  id: string;
  date_debut: string;
  duree_minutes: number;
  capacite: number;
  visio_link: string | null;
  actif: boolean;
};

type Booking = {
  id: string;
  demo_request_id: string;
  slot_id: string;
  statut: string;
  notes_prospect: string | null;
  created_at: string;
};

const STATUT_COLORS: Record<string, string> = {
  en_attente: "bg-muted text-muted-foreground",
  approuve: "bg-blue-500/15 text-blue-700",
  refuse: "bg-destructive/15 text-destructive",
  visionne: "bg-amber-500/15 text-amber-700",
  rdv_pris: "bg-[color:var(--gold)]/15 text-[color:var(--gold)]",
  converti: "bg-emerald-500/15 text-emerald-700",
};

function AdminDemosPage() {
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "administrateur";
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotDuration, setNewSlotDuration] = useState(30);
  const [newSlotLink, setNewSlotLink] = useState("");

  const load = async () => {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      supabase.from("demo_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("demo_rdv_slots").select("*").order("date_debut", { ascending: true }),
      supabase.from("demo_rdv_bookings").select("*").order("created_at", { ascending: false }),
    ]);
    setRequests((r1.data ?? []) as DemoRequest[]);
    setSlots((r2.data ?? []) as Slot[]);
    setBookings((r3.data ?? []) as Booking[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const updateStatut = async (id: string, statut: string) => {
    const { error } = await supabase
      .from("demo_requests")
      .update({ statut })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Statut mis à jour");
      load();
    }
  };

  const addSlot = async () => {
    if (!newSlotDate) return toast.error("Date requise");
    const { error } = await supabase.from("demo_rdv_slots").insert({
      date_debut: new Date(newSlotDate).toISOString(),
      duree_minutes: newSlotDuration,
      visio_link: newSlotLink || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Créneau ajouté");
      setNewSlotDate("");
      setNewSlotLink("");
      load();
    }
  };

  const deleteSlot = async (id: string) => {
    const { error } = await supabase.from("demo_rdv_slots").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  if (roleLoading) return null;
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-8">Accès réservé aux administrateurs.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Pipeline démos commerciales"
        description="Gérez les demandes de démo, créneaux RDV et conversions"
      />

      <Tabs defaultValue="requests" className="px-6">
        <TabsList>
          <TabsTrigger value="requests">
            Demandes ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="slots">Créneaux ({slots.length})</TabsTrigger>
          <TabsTrigger value="bookings">RDV ({bookings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-6 space-y-3">
          {loading && <p className="text-muted-foreground">Chargement…</p>}
          {!loading && requests.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              Aucune demande pour le moment.
            </Card>
          )}
          {requests.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-foreground">
                      {r.prenom} {r.nom}
                    </h3>
                    <Badge className={STATUT_COLORS[r.statut] ?? ""}>{r.statut}</Badge>
                    {r.video_view_count > 0 && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {r.video_view_count} vue(s)
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-foreground font-medium">{r.agence_nom}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {r.email}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {r.telephone}
                    </span>
                    {r.agence_siret && <span>SIRET : {r.agence_siret}</span>}
                    {r.agence_site_web && (
                      <a
                        href={r.agence_site_web}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[color:var(--gold)] hover:underline truncate"
                      >
                        {r.agence_site_web}
                      </a>
                    )}
                    {r.agence_taille && <span>Équipe : {r.agence_taille}</span>}
                    {r.ip_address && <span>IP : {r.ip_address}</span>}
                  </div>
                  {r.message && (
                    <p className="mt-2 text-sm text-foreground/80 italic border-l-2 border-border pl-3">
                      "{r.message}"
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    Reçu le {new Date(r.created_at).toLocaleString("fr-FR")}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => updateStatut(r.id, "approuve")}>
                    Approuver
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatut(r.id, "converti")}>
                    Converti
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => updateStatut(r.id, "refuse")}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="slots" className="mt-6 space-y-3">
          <Card className="p-5">
            <h3 className="font-semibold mb-3 inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Ajouter un créneau
            </h3>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <Label>Date & heure</Label>
                <Input
                  type="datetime-local"
                  value={newSlotDate}
                  onChange={(e) => setNewSlotDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  value={newSlotDuration}
                  onChange={(e) => setNewSlotDuration(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Lien visio</Label>
                <Input
                  placeholder="https://meet.google.com/…"
                  value={newSlotLink}
                  onChange={(e) => setNewSlotLink(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addSlot} className="w-full">
                  Ajouter
                </Button>
              </div>
            </div>
          </Card>

          {slots.map((s) => (
            <Card key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[color:var(--gold)]" />
                  {new Date(s.date_debut).toLocaleString("fr-FR")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {s.duree_minutes} min ·{" "}
                  {bookings.filter((b) => b.slot_id === s.id).length}/{s.capacite} réservé(s)
                  {s.visio_link && ` · ${s.visio_link}`}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteSlot(s.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="bookings" className="mt-6 space-y-3">
          {bookings.map((b) => {
            const req = requests.find((r) => r.id === b.demo_request_id);
            const slot = slots.find((s) => s.id === b.slot_id);
            return (
              <Card key={b.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">
                      {req?.prenom} {req?.nom} — {req?.agence_nom}
                    </div>
                    <div className="text-sm text-muted-foreground">{req?.email}</div>
                    {slot && (
                      <div className="text-sm mt-1">
                        📅 {new Date(slot.date_debut).toLocaleString("fr-FR")} ({slot.duree_minutes}{" "}
                        min)
                      </div>
                    )}
                    {b.notes_prospect && (
                      <p className="text-sm italic mt-2 border-l-2 border-border pl-3">
                        "{b.notes_prospect}"
                      </p>
                    )}
                  </div>
                  <Badge>{b.statut}</Badge>
                </div>
              </Card>
            );
          })}
          {bookings.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              Aucune réservation pour le moment.
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
