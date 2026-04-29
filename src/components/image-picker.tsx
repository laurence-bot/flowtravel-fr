import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { searchUnsplash, generateAiImage } from "@/server/quote-images.functions";
import { Upload, Search, Sparkles, Link2, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  userId: string;
  cotationId: string;
  /** Préfixe de stockage : "hero" | "jour-{id}" etc. */
  pathPrefix: string;
  /** Texte du bouton si pas d'image */
  buttonLabel?: string;
  /** Aspect ratio de l'aperçu */
  aspect?: "video" | "square" | "wide";
  disabled?: boolean;
};

const BUCKET = "quote-images";

export function ImagePicker({
  value,
  onChange,
  userId,
  cotationId,
  pathPrefix,
  buttonLabel = "Choisir une image",
  aspect = "video",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const aspectClass =
    aspect === "square" ? "aspect-square" : aspect === "wide" ? "aspect-[21/9]" : "aspect-video";

  return (
    <div className="space-y-2">
      {value ? (
        <div className={`relative group ${aspectClass} w-full rounded-md overflow-hidden border bg-muted`}>
          <img src={value} alt="" className="w-full h-full object-cover" />
          {!disabled && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                Remplacer
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onChange(null)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={`${aspectClass} w-full rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/40 hover:bg-muted hover:border-muted-foreground/60 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <ImageIcon className="h-6 w-6" />
          <span className="text-sm">{buttonLabel}</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choisir une image</DialogTitle>
          </DialogHeader>
          <PickerTabs
            userId={userId}
            cotationId={cotationId}
            pathPrefix={pathPrefix}
            onPick={(url) => {
              onChange(url);
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PickerTabs({
  userId,
  cotationId,
  pathPrefix,
  onPick,
}: {
  userId: string;
  cotationId: string;
  pathPrefix: string;
  onPick: (url: string) => void;
}) {
  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-1.5" />Upload</TabsTrigger>
        <TabsTrigger value="unsplash"><Search className="h-4 w-4 mr-1.5" />Unsplash</TabsTrigger>
        <TabsTrigger value="ai"><Sparkles className="h-4 w-4 mr-1.5" />IA</TabsTrigger>
        <TabsTrigger value="url"><Link2 className="h-4 w-4 mr-1.5" />URL</TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-4">
        <UploadPanel userId={userId} cotationId={cotationId} pathPrefix={pathPrefix} onPick={onPick} />
      </TabsContent>
      <TabsContent value="unsplash" className="mt-4">
        <UnsplashPanel userId={userId} cotationId={cotationId} pathPrefix={pathPrefix} onPick={onPick} />
      </TabsContent>
      <TabsContent value="ai" className="mt-4">
        <AiPanel userId={userId} cotationId={cotationId} pathPrefix={pathPrefix} onPick={onPick} />
      </TabsContent>
      <TabsContent value="url" className="mt-4">
        <UrlPanel onPick={onPick} />
      </TabsContent>
    </Tabs>
  );
}

/** Upload un blob vers le bucket et retourne l'URL publique. */
async function uploadBlob(
  blob: Blob,
  userId: string,
  cotationId: string,
  pathPrefix: string,
  ext: string,
): Promise<string> {
  const path = `${userId}/${cotationId}/${pathPrefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: blob.type || `image/${ext}`,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function UploadPanel({
  userId,
  cotationId,
  pathPrefix,
  onPick,
}: {
  userId: string;
  cotationId: string;
  pathPrefix: string;
  onPick: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image trop lourde (max 10 Mo).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Format non supporté.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const url = await uploadBlob(file, userId, cotationId, pathPrefix, ext);
      onPick(url);
      toast.success("Image uploadée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
      className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {busy ? (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Upload en cours…</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Upload className="h-8 w-8" />
          <div className="font-medium text-foreground">Glissez une image ou cliquez</div>
          <div className="text-xs">JPG, PNG, WebP — max 10 Mo</div>
        </div>
      )}
    </div>
  );
}

function UnsplashPanel({
  userId,
  cotationId,
  pathPrefix,
  onPick,
}: {
  userId: string;
  cotationId: string;
  pathPrefix: string;
  onPick: (url: string) => void;
}) {
  const search = useServerFn(searchUnsplash);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [results, setResults] = useState<
    Array<{ id: string; url: string; thumb: string; full: string; alt: string; author: string; authorUrl: string; photoUrl: string }>
  >([]);

  const doSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    const r = await search({ data: { query: query.trim() } });
    setBusy(false);
    if (r.ok) setResults(r.results);
    else toast.error(r.error);
  };

  const importImage = async (img: typeof results[number]) => {
    setImporting(img.id);
    try {
      const res = await fetch(img.full);
      const blob = await res.blob();
      const url = await uploadBlob(blob, userId, cotationId, pathPrefix, "jpg");
      onPick(url);
      toast.success("Image importée depuis Unsplash.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'import.");
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          doSearch();
        }}
        className="flex gap-2"
      >
        <Input
          placeholder="ex: Marrakech medina, savane Tanzanie, Bali rizières…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" disabled={busy || !query.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      {results.length === 0 && !busy && (
        <div className="text-sm text-muted-foreground text-center py-8">
          Recherchez parmi des millions de photos professionnelles gratuites.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {results.map((img) => (
          <button
            key={img.id}
            type="button"
            disabled={!!importing}
            onClick={() => importImage(img)}
            className="relative aspect-video rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all disabled:opacity-50"
          >
            <img src={img.thumb} alt={img.alt} className="w-full h-full object-cover" />
            {importing === img.id && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-[10px] text-white text-left">
              © {img.author}
            </div>
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <div className="text-[10px] text-muted-foreground text-center">
          Photos via Unsplash — usage gratuit avec crédit aux auteurs.
        </div>
      )}
    </div>
  );
}

function AiPanel({
  userId,
  cotationId,
  pathPrefix,
  onPick,
}: {
  userId: string;
  cotationId: string;
  pathPrefix: string;
  onPick: (url: string) => void;
}) {
  const generate = useServerFn(generateAiImage);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const doGenerate = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    const r = await generate({ data: { prompt: prompt.trim() } });
    if (!r.ok) {
      setBusy(false);
      toast.error(r.error);
      return;
    }
    try {
      // r.dataUrl est une data URL base64 → convertir en blob et uploader
      const res = await fetch(r.dataUrl);
      const blob = await res.blob();
      const url = await uploadBlob(blob, userId, cotationId, pathPrefix, "png");
      onPick(url);
      toast.success("Image générée et enregistrée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'enregistrement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Décrivez l'image souhaitée</label>
        <Textarea
          placeholder="ex: Coucher de soleil sur les dunes du désert d'Erg Chebbi, atmosphère dorée et paisible, voyageur en silhouette…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxLength={1000}
        />
        <div className="text-[10px] text-muted-foreground mt-1">
          Plus la description est précise, meilleur sera le résultat. Format paysage 16:9.
        </div>
      </div>
      <Button onClick={doGenerate} disabled={busy || !prompt.trim()} className="w-full">
        {busy ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Génération en cours (≈10s)…</>
        ) : (
          <><Sparkles className="h-4 w-4 mr-2" />Générer l'image</>
        )}
      </Button>
    </div>
  );
}

function UrlPanel({ onPick }: { onPick: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const valid = /^https?:\/\/.+\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(url) || /^https?:\/\/(images\.unsplash|cdn\.|.*\.cloudinary)/i.test(url);
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">URL d'une image</label>
        <Input
          placeholder="https://exemple.com/photo.jpg"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      {url && (
        <div className="aspect-video rounded-md overflow-hidden border bg-muted">
          <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")} />
        </div>
      )}
      <Button onClick={() => onPick(url)} disabled={!url || !valid} className="w-full">
        Utiliser cette URL
      </Button>
      {url && !valid && (
        <div className="text-xs text-warning">L'URL ne semble pas pointer vers une image.</div>
      )}
    </div>
  );
}
