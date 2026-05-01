import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR, formatDate } from "@/lib/format";
import { Heart, Download, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/mariages")({
  component: () => (
    <RequireAuth>
      <MariagesPage />
    </RequireAuth>
  ),
});

type Cotation = {
  id: string;
  titre: string;
  prix_vente_ttc: number | null;
  est_liste_mariage: boolean;
  mariage_titre: string | null;
  mariage_message: string | null;
  mariage_objectif: number | null;
};
type Contribution = {
  id: string;
  cotation_id: string;
  invite_prenom: string;
  invite_nom: string;
  invite_email: string | null;
  montant: number;
  message: string | null;
  statut: string;
  created_at: string;
  email_couple_envoye_at: string | null;
};

function MariagesPage() {
  const [cotations, setCotations] = useState<Cotation[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [link, setLink] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [editTitre, setEditTitre] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editObjectif, setEditObjectif] = useState<string>("");

  const refetchCotations = async () => {
    const { data } = await supabase.from("cotations").select("id,titre,prix_vente_ttc,est_liste_mariage,mariage_titre,mariage_message,mariage_objectif").order("created_at", { ascending: false });
    setCotations((data ?? []) as Cotation[]);
  };

  useEffect(() => { refetchCotations(); }, []);

  const current = cotations.find((c) => c.id === selected);

  useEffect(() => {
    if (!selected) {
      setContributions([]);
      setLink("");
      return;
    }
    supabase.from("mariage_contributions").select("*").eq("cotation_id", selected).order("created_at", { ascending: false }).then(({ data }) => setContributions((data ?? []) as Contribution[]));
    supabase.from("quote_public_links").select("token").eq("cotation_id", selected).gt("expires_at", new Date().toISOString()).maybeSingle().then(({ data }) => {
      if (data) setLink(`${window.location.origin}/mariage/${data.token}`);
      else setLink("");
    });
    if (current) {
      setEditTitre(current.mariage_titre ?? "");
      setEditMessage(current.mariage_message ?? "");
      setEditObjectif(current.mariage_objectif != null ? String(current.mariage_objectif) : "");
    }
  }, [selected, cotations]);

  const toggleListe = async (c: Cotation, val: boolean) => {
    await supabase.from("cotations").update({ est_liste_mariage: val }).eq("id", c.id);
    refetchCotations();
  };

  const saveDetails = async () => {
    if (!current) return;
    const { error } = await supabase.from("cotations").update({
      mariage_titre: editTitre || null,
      mariage_message: editMessage || null,
      mariage_objectif: editObjectif ? Number(editObjectif) : null,
    }).eq("id", current.id);
    if (error) return toast.error(error.message);
    toast.success("Détails enregistrés");
    refetchCotations();
  };

  const generateLink = async () => {
    if (!current) return;
    const { data: existing } = await supabase.from("quote_public_links").select("token").eq("cotation_id", current.id).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (existing) {
      setLink(`${window.location.origin}/mariage/${existing.token}`);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const { data, error } = await supabase.from("quote_public_links").insert({ cotation_id: current.id, user_id: user.id, token }).select().single();
    if (error) return toast.error(error.message);
    setLink(`${window.location.origin}/mariage/${data.token}`);
    toast.success("Lien généré");
  };

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const total = contributions.filter((c) => c.statut === "paye").reduce((s, c) => s + Number(c.montant), 0);
  const objectif = Number(current?.mariage_objectif ?? current?.prix_vente_ttc ?? 0);
  const pct = objectif > 0 ? Math.min(100, (total / objectif) * 100) : 0;

  const exportCsv = () => {
    const rows = [
      ["Date", "Prénom", "Nom", "Email", "Montant", "Message", "Statut"],
      ...contributions.map((c) => [formatDate(c.created_at), c.invite_prenom, c.invite_nom, c.invite_email ?? "", String(c.montant), c.message ?? "", c.statut]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contributions-mariage-${current?.titre ?? "liste"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-serif flex items-center gap-2"><Heart className="w-6 h-6 text-rose-400" />Voyages de noces</h1>
        <p className="text-sm text-muted-foreground">Activez la liste de mariage sur un devis et suivez les contributions des invités.</p>
      </div>

      <Card className="p-4">
        <Label>Devis</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger><SelectValue placeholder="Choisir un devis…" /></SelectTrigger>
          <SelectContent>
            {cotations.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.titre} {c.est_liste_mariage ? "💍" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {current && (
        <>
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium">Activer la liste de mariage</h2>
                <p className="text-xs text-muted-foreground">Une fois activée, vous pourrez générer le lien public à partager aux invités.</p>
              </div>
              <Switch checked={current.est_liste_mariage} onCheckedChange={(v) => toggleListe(current, v)} />
            </div>
            {current.est_liste_mariage && (
              <div className="space-y-3 pt-3 border-t">
                <div><Label>Titre affiché</Label><Input value={editTitre} onChange={(e) => setEditTitre(e.target.value)} placeholder="ex. Le voyage de noces de Marie & Jean" /></div>
                <div><Label>Message aux invités</Label><textarea className="w-full min-h-[80px] rounded-md border border-input bg-background p-2 text-sm" value={editMessage} onChange={(e) => setEditMessage(e.target.value)} /></div>
                <div><Label>Objectif (€)</Label><Input type="number" value={editObjectif} onChange={(e) => setEditObjectif(e.target.value)} placeholder={current.prix_vente_ttc ? String(current.prix_vente_ttc) : ""} /></div>
                <Button onClick={saveDetails} size="sm">Enregistrer</Button>
              </div>
            )}
          </Card>

          {current.est_liste_mariage && (
            <>
              <Card className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">Lien public à partager</h2>
                  {!link && <Button onClick={generateLink} size="sm">Générer le lien</Button>}
                </div>
                {link && (
                  <div className="flex gap-2">
                    <Input value={link} readOnly />
                    <Button onClick={copy} variant="outline">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button>
                    <Button asChild variant="ghost"><a href={link} target="_blank" rel="noreferrer">Ouvrir</a></Button>
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total reçu</span>
                  <span className="text-sm text-muted-foreground">/ {formatEUR(objectif)}</span>
                </div>
                <div className="text-3xl font-serif">{formatEUR(total)}</div>
                <Progress value={pct} className="mt-3" />
              </Card>

              <Card>
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="font-medium">Contributions ({contributions.length})</h2>
                  <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-3 h-3 mr-1" />Export CSV</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invité</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Email envoyé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contributions.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucune contribution</TableCell></TableRow>
                    )}
                    {contributions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{formatDate(c.created_at)}</TableCell>
                        <TableCell>{c.invite_prenom} {c.invite_nom}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.invite_email ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatEUR(Number(c.montant))}</TableCell>
                        <TableCell className="text-xs italic max-w-[200px] truncate">{c.message ?? "—"}</TableCell>
                        <TableCell>{c.email_couple_envoye_at ? <Badge variant="default">✓</Badge> : <Badge variant="secondary">—</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
