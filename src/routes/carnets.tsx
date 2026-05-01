import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { BookOpen, Plus, Copy, Check, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/carnets")({
  component: () => (
    <RequireAuth>
      <CarnetsPage />
    </RequireAuth>
  ),
});

type Carnet = {
  id: string;
  token: string;
  titre: string;
  destination: string | null;
  date_debut: string | null;
  date_fin: string | null;
  statut: "brouillon" | "publie";
  dossier_id: string | null;
  client_id: string | null;
  intro_text: string | null;
  jours: any;
  created_at: string;
};

function CarnetsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Carnet[]>([]);
  const [dossiers, setDossiers] = useState<Array<{ id: string; titre: string; client_id: string | null }>>([]);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<Carnet | null>(null);

  const refetch = async () => {
    const { data } = await supabase.from("carnets").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Carnet[]);
  };

  useEffect(() => {
    refetch();
    supabase.from("dossiers").select("id,titre,client_id").order("created_at", { ascending: false }).then(({ data }) => setDossiers(data ?? []));
  }, []);

  const create = async (titre: string, dossierId: string, destination: string) => {
    if (!user) return;
    const dossier = dossiers.find((d) => d.id === dossierId);
    const { error } = await supabase.from("carnets").insert({
      user_id: user.id,
      titre,
      destination: destination || null,
      dossier_id: dossierId || null,
      client_id: dossier?.client_id ?? null,
      jours: [],
    });
    if (error) return toast.error(error.message);
    toast.success("Carnet créé");
    setOpen(false);
    refetch();
  };

  const togglePublish = async (c: Carnet) => {
    const newStatut = c.statut === "publie" ? "brouillon" : "publie";
    await supabase.from("carnets").update({ statut: newStatut }).eq("id", c.id);
    refetch();
  };

  const copy = (token: string) => {
    const url = `${window.location.origin}/carnet/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif flex items-center gap-2"><BookOpen className="w-6 h-6" />Carnets de voyage</h1>
          <p className="text-sm text-muted-foreground">Créez un carnet interactif pour vos clients (planning, photos, infos pratiques).</p>
        </div>
        <CarnetCreateDialog open={open} onOpenChange={setOpen} dossiers={dossiers} onCreate={create} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />Aucun carnet pour l'instant
              </TableCell></TableRow>
            )}
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.titre}</TableCell>
                <TableCell>{c.destination ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.date_debut ? formatDate(c.date_debut) : "—"} → {c.date_fin ? formatDate(c.date_fin) : "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.statut === "publie" ? "default" : "secondary"}>{c.statut === "publie" ? "Publié" : "Brouillon"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Éditer</Button>
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(c)}>
                    {c.statut === "publie" ? "Dépublier" : "Publier"}
                  </Button>
                  {c.statut === "publie" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => copy(c.token)}>
                        {copied === c.token ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}Lien
                      </Button>
                      <Button size="sm" variant="ghost" asChild><a href={`/carnet/${c.token}`} target="_blank" rel="noreferrer"><Eye className="w-3 h-3" /></a></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editing && <CarnetEditDialog carnet={editing} onClose={() => { setEditing(null); refetch(); }} />}
    </div>
  );
}

function CarnetCreateDialog({ open, onOpenChange, dossiers, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  dossiers: Array<{ id: string; titre: string; client_id: string | null }>;
  onCreate: (titre: string, dossierId: string, destination: string) => void;
}) {
  const [titre, setTitre] = useState("");
  const [destination, setDestination] = useState("");
  const [dossierId, setDossierId] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nouveau carnet</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Créer un carnet de voyage</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Titre</Label><Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Voyage de Marie au Japon" /></div>
          <div><Label>Destination</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
          <div>
            <Label>Dossier lié (optionnel)</Label>
            <Select value={dossierId} onValueChange={setDossierId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{dossiers.map((d) => <SelectItem key={d.id} value={d.id}>{d.titre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={() => onCreate(titre, dossierId, destination)} disabled={!titre.trim()}>Créer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CarnetEditDialog({ carnet, onClose }: { carnet: Carnet; onClose: () => void }) {
  const [titre, setTitre] = useState(carnet.titre);
  const [destination, setDestination] = useState(carnet.destination ?? "");
  const [intro, setIntro] = useState(carnet.intro_text ?? "");
  const [dateDebut, setDateDebut] = useState(carnet.date_debut ?? "");
  const [dateFin, setDateFin] = useState(carnet.date_fin ?? "");
  const [jours, setJours] = useState<Array<{ titre: string; lieu?: string; date?: string; description?: string }>>(
    Array.isArray(carnet.jours) ? carnet.jours : [],
  );

  const save = async () => {
    const { error } = await supabase.from("carnets").update({
      titre, destination: destination || null, intro_text: intro || null,
      date_debut: dateDebut || null, date_fin: dateFin || null, jours,
    }).eq("id", carnet.id);
    if (error) return toast.error(error.message);
    toast.success("Carnet enregistré");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Éditer « {carnet.titre} »</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Titre</Label><Input value={titre} onChange={(e) => setTitre(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Destination</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Du</Label><Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} /></div>
              <div><Label>Au</Label><Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} /></div>
            </div>
          </div>
          <div><Label>Introduction</Label><textarea className="w-full min-h-[80px] rounded-md border border-input bg-background p-2 text-sm" value={intro} onChange={(e) => setIntro(e.target.value)} /></div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label>Programme jour par jour</Label>
              <Button size="sm" variant="outline" onClick={() => setJours([...jours, { titre: `Jour ${jours.length + 1}` }])}>
                <Plus className="w-3 h-3 mr-1" />Jour
              </Button>
            </div>
            <div className="space-y-2">
              {jours.map((j, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Titre" value={j.titre} onChange={(e) => { const n = [...jours]; n[i] = { ...n[i], titre: e.target.value }; setJours(n); }} />
                    <Input placeholder="Lieu" value={j.lieu ?? ""} onChange={(e) => { const n = [...jours]; n[i] = { ...n[i], lieu: e.target.value }; setJours(n); }} />
                    <Input type="date" value={j.date ?? ""} onChange={(e) => { const n = [...jours]; n[i] = { ...n[i], date: e.target.value }; setJours(n); }} />
                  </div>
                  <textarea className="w-full min-h-[60px] rounded-md border border-input bg-background p-2 text-sm" placeholder="Description / activités…" value={j.description ?? ""} onChange={(e) => { const n = [...jours]; n[i] = { ...n[i], description: e.target.value }; setJours(n); }} />
                  <Button size="sm" variant="ghost" onClick={() => setJours(jours.filter((_, k) => k !== i))}>Supprimer</Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
