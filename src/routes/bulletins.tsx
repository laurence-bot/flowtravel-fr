import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, Copy, Check, FileSignature } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bulletins")({
  component: () => (
    <RequireAuth>
      <BulletinsPage />
    </RequireAuth>
  ),
});

type Bulletin = {
  id: string;
  token: string;
  statut: "a_signer" | "signe" | "annule";
  signataire_nom: string | null;
  signed_at: string | null;
  cotation_id: string | null;
  client_id: string | null;
  created_at: string;
  expires_at: string;
};

function BulletinsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Bulletin[]>([]);
  const [cotations, setCotations] = useState<Array<{ id: string; titre: string; client_id: string | null; dossier_id: string | null }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; nom: string }>>([]);
  const [open, setOpen] = useState(false);
  const [cotationId, setCotationId] = useState("");
  const [conditions, setConditions] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const refetch = async () => {
    const { data } = await supabase.from("bulletins").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Bulletin[]);
  };

  useEffect(() => {
    refetch();
    supabase.from("cotations").select("id,titre,client_id,dossier_id").order("created_at", { ascending: false }).then(({ data }) => setCotations(data ?? []));
    supabase.from("contacts").select("id,nom").then(({ data }) => setContacts(data ?? []));
  }, []);

  const create = async () => {
    if (!user) return;
    const cotation = cotations.find((c) => c.id === cotationId);
    const { data, error } = await supabase
      .from("bulletins")
      .insert({
        user_id: user.id,
        cotation_id: cotationId || null,
        client_id: cotation?.client_id ?? null,
        dossier_id: cotation?.dossier_id ?? null,
        conditions_text: conditions || null,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bulletin créé");
    setOpen(false);
    setCotationId("");
    setConditions("");
    refetch();
    const url = `${window.location.origin}/bulletin/${data.token}`;
    navigator.clipboard.writeText(url);
    toast.message("Lien copié dans le presse-papier");
  };

  const copy = (token: string) => {
    const url = `${window.location.origin}/bulletin/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  const cotationLabel = (id: string | null) => cotations.find((c) => c.id === id)?.titre ?? "—";
  const clientLabel = (id: string | null) => contacts.find((c) => c.id === id)?.nom ?? "—";

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Bulletins d'inscription</h1>
          <p className="text-sm text-muted-foreground">Envoyez un lien à votre client pour signature digitale.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouveau bulletin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un bulletin</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Devis lié</Label>
                <Select value={cotationId} onValueChange={setCotationId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un devis…" /></SelectTrigger>
                  <SelectContent>
                    {cotations.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.titre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conditions (optionnel)</Label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background p-2 text-sm"
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="Texte des conditions générales spécifiques à ce bulletin (sinon les CGV de l'agence sont utilisées)."
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create}>Créer et copier le lien</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Devis</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Signé le</TableHead>
              <TableHead>Expire</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                <FileSignature className="w-8 h-8 mx-auto mb-2 opacity-50" />Aucun bulletin pour l'instant
              </TableCell></TableRow>
            )}
            {list.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{cotationLabel(b.cotation_id)}</TableCell>
                <TableCell>{b.signataire_nom ?? clientLabel(b.client_id)}</TableCell>
                <TableCell>
                  <Badge variant={b.statut === "signe" ? "default" : b.statut === "annule" ? "destructive" : "secondary"}>
                    {b.statut === "signe" ? "Signé" : b.statut === "annule" ? "Annulé" : "À signer"}
                  </Badge>
                </TableCell>
                <TableCell>{b.signed_at ? formatDate(b.signed_at) : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(b.expires_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => copy(b.token)}>
                    {copied === b.token ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Copier le lien
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`/bulletin/${b.token}`} target="_blank" rel="noreferrer">Ouvrir</a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
