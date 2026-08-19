import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useTable, type Dossier } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { FileLock2, FolderLock, Upload, ExternalLink, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/documents")({
  component: () => (
    <RequireAuth>
      <DocumentsPage />
    </RequireAuth>
  ),
});

const CATEGORIES = {
  dossier_voyage: "Dossier de voyage",
  facture_fournisseur: "Facture fournisseur",
  facture_client: "Facture client",
  comptabilite: "Comptabilité",
  fiscalite: "Fiscalité",
  banque: "Banque",
  credit_assurance: "Crédit & assurance",
  juridique: "Juridique",
  social_rh: "Social & RH",
  correspondance: "Correspondance",
  autre: "Autre",
} as const;

const ENTITES = {
  la_voyagerie: "La Voyagerie",
  bespoke: "Bespoke Southern France DMC",
  personnel: "Personnel / dirigeante",
} as const;

type CategorieDocument = keyof typeof CATEGORIES;
type EntiteDocument = keyof typeof ENTITES;

type DocumentSecurise = {
  id: string;
  dossier_id: string | null;
  entite: EntiteDocument;
  categorie: CategorieDocument;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  content_hash: string | null;
  date_document: string | null;
  notes: string | null;
  created_at: string;
};

const ACCEPT = ".pdf,.csv,.xlsx,.xls,.zip,.png,.jpg,.jpeg";

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-140);
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function DocumentsPage() {
  const { user } = useAuth();
  const { agenceId } = useRole();
  const { data: dossiers } = useTable<Dossier>("dossiers");
  const { data: documents, loading, refetch } = useTable<DocumentSecurise>("documents_securises");
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [categorie, setCategorie] = useState<CategorieDocument>("dossier_voyage");
  const [entite, setEntite] = useState<EntiteDocument>("la_voyagerie");
  const [dossierId, setDossierId] = useState("");
  const [dateDocument, setDateDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategorie, setFilterCategorie] = useState<"all" | CategorieDocument>("all");

  const filtered = useMemo(() => documents.filter((doc) => {
    if (filterCategorie !== "all" && doc.categorie !== filterCategorie) return false;
    const dossier = dossiers.find((d) => d.id === doc.dossier_id);
    const haystack = `${doc.file_name} ${doc.notes ?? ""} ${dossier?.titre ?? ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [documents, dossiers, filterCategorie, search]);

  const uploadFiles = async () => {
    if (!user || files.length === 0) return;
    if ((categorie === "dossier_voyage" || categorie === "facture_fournisseur") && !dossierId) {
      toast.error("Choisissez le dossier afin d'éviter un document non rattaché.");
      return;
    }
    setUploading(true);
    let imported = 0;
    let duplicates = 0;
    try {
      for (const file of files) {
        const hash = await sha256(file);
        const existing = documents.find((d) => d.content_hash === hash && (d.dossier_id ?? "") === dossierId);
        if (existing) {
          duplicates += 1;
          continue;
        }
        const path = `${user.id}/${entite}/${categorie}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("documents-securises").upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
        if (uploadError) throw uploadError;

        const { error: insertError } = await (supabase as any).from("documents_securises").insert({
          user_id: user.id,
          agence_id: agenceId ?? null,
          dossier_id: dossierId || null,
          entite,
          categorie,
          file_name: file.name,
          storage_path: path,
          mime_type: file.type || null,
          file_size: file.size,
          content_hash: hash,
          date_document: dateDocument || null,
          notes: notes.trim() || null,
        });
        if (insertError) {
          await supabase.storage.from("documents-securises").remove([path]);
          if (insertError.code === "23505") {
            duplicates += 1;
            continue;
          }
          throw insertError;
        }
        imported += 1;
      }
      toast.success(`${imported} document(s) classé(s)${duplicates ? ` · ${duplicates} doublon(s) ignoré(s)` : ""}`);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      setNotes("");
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec du téléversement");
    } finally {
      setUploading(false);
    }
  };

  const openDocument = async (doc: DocumentSecurise) => {
    const { data, error } = await supabase.storage.from("documents-securises").createSignedUrl(doc.storage_path, 120);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Document inaccessible");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const dossierLabel = (id: string | null) => dossiers.find((d) => d.id === id)?.titre ?? "Document général";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents sécurisés"
        description="Coffre privé pour les dossiers voyages, la comptabilité, les banques et le juridique"
      />

      <Card className="p-5 border-emerald-500/25 bg-emerald-500/5">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5" />
          <div>
            <div className="font-medium">Stockage privé et rattachement explicite</div>
            <p className="text-xs text-muted-foreground mt-1">
              Aucun document ne crée de dossier. Les factures fournisseurs et documents de voyage exigent un dossier existant ; les doublons exacts sont bloqués.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-border/60 space-y-5">
        <div className="flex items-center gap-2">
          <FolderLock className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-xl">Classer de nouveaux documents</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Entité</Label>
            <Select value={entite} onValueChange={(v: EntiteDocument) => setEntite(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ENTITES).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={categorie} onValueChange={(v: CategorieDocument) => setCategorie(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CATEGORIES).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dossier lié</Label>
            <Select value={dossierId || "none"} onValueChange={(v) => setDossierId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun · document général</SelectItem>
                {dossiers.map((d) => <SelectItem key={d.id} value={d.id}>{d.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Date du document</Label>
            <Input type="date" value={dateDocument} onChange={(e) => setDateDocument(e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel" />
          </div>
        </div>
        <div className="rounded-md border border-dashed border-border p-5">
          <Input ref={inputRef} type="file" multiple accept={ACCEPT} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <p className="text-xs text-muted-foreground mt-2">PDF, CSV, Excel, ZIP ou image · 50 Mo maximum par fichier.</p>
          {files.length > 0 && <p className="text-sm font-medium mt-2">{files.length} fichier(s) sélectionné(s)</p>}
        </div>
        <Button onClick={uploadFiles} disabled={uploading || files.length === 0}>
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Classement en cours…" : "Téléverser et classer"}
        </Button>
      </Card>

      <Card className="border-border/60 overflow-hidden">
        <div className="p-5 border-b border-border/60 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un document ou un dossier…" />
          </div>
          <Select value={filterCategorie} onValueChange={(v) => setFilterCategorie(v as "all" | CategorieDocument)}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {Object.entries(CATEGORIES).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {loading ? <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Classement</TableHead><TableHead>Dossier</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Accès</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground"><FileLock2 className="h-7 w-7 mx-auto mb-2 opacity-50" />Aucun document</TableCell></TableRow>}
              {filtered.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell><div className="font-medium max-w-[360px] truncate">{doc.file_name}</div><div className="text-[10px] text-muted-foreground">{doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} Mo` : ""}</div></TableCell>
                  <TableCell><Badge variant="outline">{ENTITES[doc.entite]}</Badge><div className="text-xs text-muted-foreground mt-1">{CATEGORIES[doc.categorie]}</div></TableCell>
                  <TableCell className="text-sm">{dossierLabel(doc.dossier_id)}</TableCell>
                  <TableCell className="text-sm">{formatDate(doc.date_document ?? doc.created_at)}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openDocument(doc)}><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Ouvrir</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
