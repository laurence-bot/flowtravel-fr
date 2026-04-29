import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ImagePicker } from "@/components/image-picker";
import type { CotationJour } from "@/lib/quote-public";
import {
  ImageIcon,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

type Props = {
  cotationId: string;
  userId: string;
  canWrite: boolean;
  initialHeroUrl: string | null;
  initialStorytelling: string | null;
};

export function QuoteContentEditorBlock({
  cotationId,
  userId,
  canWrite,
  initialHeroUrl,
  initialStorytelling,
}: Props) {
  const [heroUrl, setHeroUrl] = useState<string | null>(initialHeroUrl);
  const [storytelling, setStorytelling] = useState(initialStorytelling ?? "");
  const [savingHero, setSavingHero] = useState(false);
  const [jours, setJours] = useState<CotationJour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJours();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotationId]);

  const loadJours = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("cotation_jours")
      .select("*")
      .eq("cotation_id", cotationId)
      .order("ordre", { ascending: true });
    setJours((data as CotationJour[]) ?? []);
    setLoading(false);
  };

  const updateHero = async (url: string | null) => {
    setHeroUrl(url);
    setSavingHero(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotations")
      .update({ hero_image_url: url })
      .eq("id", cotationId);
    setSavingHero(false);
    if (error) toast.error(error.message);
    else toast.success("Image principale mise à jour.");
  };

  const saveStorytelling = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotations")
      .update({ storytelling_intro: storytelling || null })
      .eq("id", cotationId);
    if (error) toast.error(error.message);
    else toast.success("Introduction enregistrée.");
  };

  const addJour = async () => {
    const ordre = jours.length > 0 ? Math.max(...jours.map((j) => j.ordre)) + 1 : 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("cotation_jours")
      .insert({
        user_id: userId,
        cotation_id: cotationId,
        ordre,
        titre: `Jour ${ordre}`,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setJours([...jours, data as CotationJour]);
  };

  const updateJour = async (id: string, patch: Partial<CotationJour>) => {
    setJours((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotation_jours")
      .update(patch)
      .eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteJour = async (id: string) => {
    if (!confirm("Supprimer ce jour ?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("cotation_jours").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setJours((prev) => prev.filter((j) => j.id !== id));
  };

  const moveJour = async (id: string, direction: "up" | "down") => {
    const idx = jours.findIndex((j) => j.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= jours.length) return;
    const a = jours[idx];
    const b = jours[swapIdx];
    const newJours = [...jours];
    newJours[idx] = { ...b, ordre: a.ordre };
    newJours[swapIdx] = { ...a, ordre: b.ordre };
    setJours(newJours);
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("cotation_jours").update({ ordre: b.ordre }).eq("id", a.id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("cotation_jours").update({ ordre: a.ordre }).eq("id", b.id),
    ]);
  };

  return (
    <Card className="p-5 space-y-6">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-[color:var(--gold)]" />
        <h3 className="font-display text-lg">Contenu du devis web</h3>
        {savingHero && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* HERO */}
      <div className="space-y-2">
        <Label>Image principale (Hero)</Label>
        <ImagePicker
          value={heroUrl}
          onChange={updateHero}
          userId={userId}
          cotationId={cotationId}
          pathPrefix="hero"
          buttonLabel="Ajouter l'image principale du voyage"
          aspect="wide"
          disabled={!canWrite}
        />
      </div>

      {/* STORYTELLING */}
      <div className="space-y-2">
        <Label htmlFor="storytelling">Introduction narrative (optionnel)</Label>
        <Textarea
          id="storytelling"
          value={storytelling}
          onChange={(e) => setStorytelling(e.target.value)}
          onBlur={saveStorytelling}
          placeholder="Une phrase d'accroche poétique qui plante le décor du voyage…"
          rows={3}
          maxLength={500}
          disabled={!canWrite}
        />
        <div className="text-[10px] text-muted-foreground text-right">{storytelling.length}/500</div>
      </div>

      {/* JOURS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Itinéraire jour par jour ({jours.length})</Label>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={addJour}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un jour
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-6">Chargement…</div>
        ) : jours.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
            Aucun jour défini. Ajoutez-en pour construire l'itinéraire.
          </div>
        ) : (
          <div className="space-y-3">
            {jours.map((j, idx) => (
              <JourEditor
                key={j.id}
                jour={j}
                index={idx}
                total={jours.length}
                userId={userId}
                cotationId={cotationId}
                canWrite={canWrite}
                onUpdate={(patch) => updateJour(j.id, patch)}
                onDelete={() => deleteJour(j.id)}
                onMove={(dir) => moveJour(j.id, dir)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function JourEditor({
  jour,
  index,
  total,
  userId,
  cotationId,
  canWrite,
  onUpdate,
  onDelete,
  onMove,
}: {
  jour: CotationJour;
  index: number;
  total: number;
  userId: string;
  cotationId: string;
  canWrite: boolean;
  onUpdate: (patch: Partial<CotationJour>) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [titre, setTitre] = useState(jour.titre);
  const [lieu, setLieu] = useState(jour.lieu ?? "");
  const [description, setDescription] = useState(jour.description ?? "");
  const [date, setDate] = useState(jour.date_jour ?? "");
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-md p-3 bg-card/50">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
          J{index + 1}
        </div>
        <Input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          onBlur={() => titre !== jour.titre && onUpdate({ titre })}
          placeholder="Titre du jour"
          disabled={!canWrite}
          className="font-medium"
        />
        {canWrite && (
          <>
            <Button size="icon" variant="ghost" onClick={() => onMove("up")} disabled={index === 0}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onMove("down")} disabled={index === total - 1}>
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setOpen(!open)}>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {open && (
        <div className="mt-3 grid md:grid-cols-[200px_1fr] gap-4 pl-6">
          <div className="space-y-3">
            <ImagePicker
              value={jour.image_url}
              onChange={(url) => onUpdate({ image_url: url })}
              userId={userId}
              cotationId={cotationId}
              pathPrefix={`jour-${jour.id}`}
              buttonLabel="Image du jour"
              aspect="video"
              disabled={!canWrite}
            />
            <div>
              <Label className="text-xs">Lieu</Label>
              <Input
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                onBlur={() => lieu !== (jour.lieu ?? "") && onUpdate({ lieu: lieu || null })}
                placeholder="ex: Marrakech"
                disabled={!canWrite}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => date !== (jour.date_jour ?? "") && onUpdate({ date_jour: date || null })}
                disabled={!canWrite}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== (jour.description ?? "") && onUpdate({ description: description || null })
              }
              placeholder="Décrivez le déroulé de la journée, les visites, les ambiances…"
              rows={8}
              disabled={!canWrite}
              className="text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
