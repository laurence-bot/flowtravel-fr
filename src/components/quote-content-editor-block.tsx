import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ImagePicker } from "@/components/image-picker";
import { generateDayText } from "@/server/quote-day-text.functions";
import { generateQuoteIntro } from "@/server/quote-intro.functions";
import type { CotationJour } from "@/lib/quote-public";
import {
  ImageIcon,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wand2,
  X,
  Plane,
  RefreshCw,
} from "lucide-react";
import {
  buildItineraryFromFlights,
  pickReferenceFlight,
  type FlightOptionLite,
  type FlightSegmentLite,
} from "@/lib/itinerary-from-flights";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDate } from "@/lib/format";

const MAX_GALLERY = 4;

type Props = {
  cotationId: string;
  userId: string;
  canWrite: boolean;
  initialHeroUrl: string | null;
  initialStorytelling: string | null;
  initialInclus?: string | null;
  initialNonInclus?: string | null;
  titre?: string | null;
  destination?: string | null;
  paysDestination?: string | null;
  typeVoyage?: string | null;
  nombrePax?: number | null;
  dateDepart?: string | null;
  dateRetour?: string | null;
};

export function QuoteContentEditorBlock({
  cotationId,
  userId,
  canWrite,
  initialHeroUrl,
  initialStorytelling,
  initialInclus,
  initialNonInclus,
  titre,
  destination,
  paysDestination,
  typeVoyage,
  nombrePax,
  dateDepart,
  dateRetour,
}: Props) {
  const [heroUrl, setHeroUrl] = useState<string | null>(initialHeroUrl);
  const [storytelling, setStorytelling] = useState(initialStorytelling ?? "");
  const [inclus, setInclus] = useState(initialInclus ?? "");
  const [nonInclus, setNonInclus] = useState(initialNonInclus ?? "");
  const [savingHero, setSavingHero] = useState(false);
  const [jours, setJours] = useState<CotationJour[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [resyncLoading, setResyncLoading] = useState(false);
  const [hasFlights, setHasFlights] = useState(false);
  const [genIntroLoading, setGenIntroLoading] = useState(false);
  const callGenerateIntro = useServerFn(generateQuoteIntro);

  const handleGenerateIntro = async () => {
    setGenIntroLoading(true);
    try {
      const res = await callGenerateIntro({
        data: {
          titre: titre ?? null,
          destination: destination ?? null,
          paysDestination: paysDestination ?? null,
          typeVoyage: typeVoyage ?? null,
          nombrePax: nombrePax ?? null,
          dateDepart: dateDepart ?? null,
          dateRetour: dateRetour ?? null,
          jours: jours.map((j) => ({
            ordre: j.ordre,
            titre: j.titre,
            lieu: j.lieu,
            description: j.description,
          })),
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStorytelling(res.text);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("cotations")
        .update({ storytelling_intro: res.text })
        .eq("id", cotationId);
      if (error) toast.error(error.message);
      else toast.success("Introduction générée.");
    } finally {
      setGenIntroLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    loadJours();
    void checkFlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotationId]);

  const checkFlights = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("flight_options")
      .select("id", { count: "exact", head: true })
      .eq("cotation_id", cotationId);
    setHasFlights((count ?? 0) > 0);
  };

  const loadJours = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("cotation_jours")
      .select("*")
      .eq("cotation_id", cotationId)
      .order("ordre", { ascending: true });
    const rows = ((data as CotationJour[]) ?? []).map((j) => ({
      ...j,
      gallery_urls: Array.isArray(j.gallery_urls) ? j.gallery_urls : [],
      gallery_credits: Array.isArray(j.gallery_credits) ? j.gallery_credits : [],
    }));
    setJours(rows);
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
  };

  const saveInclus = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotations")
      .update({ inclus_text: inclus || null })
      .eq("id", cotationId);
    if (error) toast.error(error.message);
  };

  const saveNonInclus = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotations")
      .update({ non_inclus_text: nonInclus || null })
      .eq("id", cotationId);
    if (error) toast.error(error.message);
  };

  /** Date auto pour un jour donné (basée sur date_depart + index). */
  const computeAutoDate = (index: number): string | null => {
    if (!dateDepart) return null;
    const d = new Date(dateDepart);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + index);
    return d.toISOString().slice(0, 10);
  };

  const addJour = async () => {
    const ordre = jours.length > 0 ? Math.max(...jours.map((j) => j.ordre)) + 1 : 1;
    const autoDate = computeAutoDate(jours.length);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("cotation_jours")
      .insert({
        user_id: userId,
        cotation_id: cotationId,
        ordre,
        titre: `Jour ${ordre}`,
        date_jour: autoDate,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const row: CotationJour = {
      ...(data as CotationJour),
      gallery_urls: [],
      gallery_credits: [],
    };
    setJours([...jours, row]);
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

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = jours.findIndex((j) => j.id === active.id);
    const newIdx = jours.findIndex((j) => j.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(jours, oldIdx, newIdx).map((j, i) => ({
      ...j,
      ordre: i + 1,
    }));
    setJours(reordered);

    // Persist tous les nouveaux ordres en parallèle
    const updates = reordered.map((j) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("cotation_jours")
        .update({ ordre: j.ordre })
        .eq("id", j.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed) toast.error("Erreur lors du réordonnancement.");
  };

  /** A-t-on déjà du contenu utilisateur dans les jours ? */
  const joursHaveContent = (): boolean => {
    return jours.some(
      (j) =>
        (j.description && j.description.trim().length > 0) ||
        (j.image_url && j.image_url.length > 0) ||
        (j.gallery_urls && j.gallery_urls.length > 0) ||
        (j.lieu && j.lieu.trim().length > 0),
    );
  };

  const handleRegenClick = () => {
    if (!hasFlights) {
      toast.error("Aucun vol renseigné. Ajoutez d'abord les vols pour générer l'itinéraire.");
      return;
    }
    if (jours.length > 0 && joursHaveContent()) {
      setRegenOpen(true);
    } else {
      void runRegenerate();
    }
  };

  /** Resynchronise les dates de la cotation + des jours sur les vols, sans toucher aux contenus. */
  const resyncDatesFromFlights = async () => {
    setResyncLoading(true);
    try {
      const [volsRes, linkRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("flight_options")
          .select("*")
          .eq("cotation_id", cotationId)
          .order("created_at", { ascending: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("quote_public_links")
          .select("chosen_flight_option_id")
          .eq("cotation_id", cotationId)
          .maybeSingle(),
      ]);
      const vols = (volsRes.data ?? []) as FlightOptionLite[];
      if (vols.length === 0) {
        toast.error("Aucun vol renseigné.");
        return;
      }
      const chosenId = (linkRes.data?.chosen_flight_option_id ?? null) as string | null;
      const refVol = pickReferenceFlight(vols, chosenId);
      if (!refVol) {
        toast.error("Vol de référence introuvable.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: segs } = await (supabase as any)
        .from("flight_segments")
        .select("*")
        .eq("flight_option_id", refVol.id)
        .order("ordre", { ascending: true });
      const segments = (segs ?? []) as FlightSegmentLite[];

      // Date arrivée à destination = date_arrivee du dernier segment aller
      // Heuristique : on prend date_depart = 1er segment, date_retour = dernier segment
      const sorted = [...segments].sort((a, b) => a.ordre - b.ordre);
      const newDepart = sorted[0]?.date_depart ?? refVol.date_depart ?? null;
      const newRetour =
        sorted[sorted.length - 1]?.date_arrivee ?? refVol.date_retour ?? null;

      if (!newDepart || !newRetour) {
        toast.error("Dates de vol incomplètes.");
        return;
      }

      // 1. Mettre à jour la cotation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: cotErr } = await (supabase as any)
        .from("cotations")
        .update({ date_depart: newDepart, date_retour: newRetour })
        .eq("id", cotationId);
      if (cotErr) throw cotErr;

      // 2. Réaligner les date_jour des jours existants (en gardant ordre + contenu)
      const sortedJours = [...jours].sort((a, b) => a.ordre - b.ordre);
      const baseDate = new Date(newDepart);
      const updates = sortedJours.map((j, i) => {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);
        const newDateJour = d.toISOString().slice(0, 10);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (supabase as any)
          .from("cotation_jours")
          .update({ date_jour: newDateJour })
          .eq("id", j.id);
      });
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;

      toast.success("Dates resynchronisées sur les vols.");
      await loadJours();
    } catch (e) {
      console.error("[resync dates] erreur:", e);
      toast.error(e instanceof Error ? e.message : "Erreur de resynchronisation.");
    } finally {
      setResyncLoading(false);
    }
  };

  const runRegenerate = async () => {
    setRegenOpen(false);
    setRegenLoading(true);
    try {
      // 1. Charger vols + segments + lien public (pour vol choisi)
      const [volsRes, linkRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("flight_options")
          .select("*")
          .eq("cotation_id", cotationId)
          .order("created_at", { ascending: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("quote_public_links")
          .select("chosen_flight_option_id")
          .eq("cotation_id", cotationId)
          .maybeSingle(),
      ]);
      const vols = (volsRes.data ?? []) as FlightOptionLite[];
      if (vols.length === 0) {
        toast.error("Aucun vol trouvé.");
        return;
      }
      const chosenId = (linkRes.data?.chosen_flight_option_id ?? null) as string | null;
      const refVol = pickReferenceFlight(vols, chosenId);
      if (!refVol) {
        toast.error("Vol de référence introuvable.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: segs } = await (supabase as any)
        .from("flight_segments")
        .select("*")
        .eq("flight_option_id", refVol.id)
        .order("ordre", { ascending: true });
      const segments = (segs ?? []) as FlightSegmentLite[];
      if (segments.length === 0) {
        toast.error("Aucun segment de vol — saisissez les segments du vol d'abord.");
        return;
      }

      const generated = buildItineraryFromFlights(
        refVol,
        segments,
        dateDepart ?? null,
        dateRetour ?? null,
      );
      if (generated.length === 0) {
        toast.error("Impossible de calculer les dates depuis les vols.");
        return;
      }

      // 2. Effacer les jours existants
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: delErr } = await (supabase as any)
        .from("cotation_jours")
        .delete()
        .eq("cotation_id", cotationId);
      if (delErr) throw delErr;

      // 3. Insérer les nouveaux jours
      const payload = generated.map((g) => ({
        user_id: userId,
        cotation_id: cotationId,
        ordre: g.ordre,
        titre: g.titre,
        description: g.description,
        lieu: g.lieu,
        date_jour: g.date_jour,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (supabase as any)
        .from("cotation_jours")
        .insert(payload);
      if (insErr) throw insErr;

      toast.success(`${generated.length} jours générés depuis les vols.`);
      await loadJours();
    } catch (e) {
      console.error("[regen itinerary] erreur:", e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de la régénération.");
    } finally {
      setRegenLoading(false);
    }
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
          onChange={(url) => updateHero(url)}
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label htmlFor="storytelling">Introduction narrative (optionnel)</Label>
          {canWrite && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleGenerateIntro}
              disabled={genIntroLoading || jours.length === 0}
              title={
                jours.length === 0
                  ? "Rédigez d'abord le programme jour par jour"
                  : "Générer une phrase d'accroche à partir de votre programme"
              }
            >
              {genIntroLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Générer avec l'IA
            </Button>
          )}
        </div>
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label>Itinéraire jour par jour ({jours.length})</Label>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void resyncDatesFromFlights()}
                disabled={resyncLoading || !hasFlights}
                title="Aligne les dates de la cotation et des jours sur les vols"
              >
                {resyncLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Resynchroniser dates
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenClick}
                disabled={regenLoading || !hasFlights}
                title={
                  hasFlights
                    ? "Construit l'itinéraire à partir des vols saisis"
                    : "Ajoutez d'abord les vols pour activer cette option"
                }
              >
                {regenLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plane className="h-4 w-4 mr-1" />
                )}
                {jours.length === 0 ? "Générer depuis les vols" : "Régénérer depuis les vols"}
              </Button>
              <Button size="sm" variant="outline" onClick={addJour}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un jour
              </Button>
            </div>
          )}
        </div>
        {!hasFlights && jours.length === 0 && (
          <div className="text-xs text-muted-foreground bg-muted/50 border border-dashed rounded p-3 flex items-start gap-2">
            <Plane className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[color:var(--gold)]" />
            <div>
              <strong>Les vols définissent la structure du voyage.</strong> Saisissez d'abord
              vos vols (option vol + segments) puis cliquez sur <em>« Générer depuis les vols »</em>
              pour construire automatiquement le calendrier jour par jour.
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-6">Chargement…</div>
        ) : jours.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
            Aucun jour défini. Ajoutez-en pour construire l'itinéraire.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={jours.map((j) => j.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {jours.map((j, idx) => (
                  <SortableJour
                    key={j.id}
                    jour={j}
                    index={idx}
                    autoDate={computeAutoDate(idx)}
                    userId={userId}
                    cotationId={cotationId}
                    canWrite={canWrite}
                    destination={destination ?? null}
                    onUpdate={(patch) => updateJour(j.id, patch)}
                    onDelete={() => deleteJour(j.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* INCLUS / NON INCLUS */}
      <div className="grid md:grid-cols-2 gap-4 pt-2 border-t">
        <div className="space-y-2">
          <Label htmlFor="inclus">Ce qui est inclus</Label>
          <Textarea
            id="inclus"
            value={inclus}
            onChange={(e) => setInclus(e.target.value)}
            onBlur={saveInclus}
            placeholder={"• Vols internationaux\n• Hébergement en chambre double\n• Transferts privés\n• Guide francophone…"}
            rows={8}
            disabled={!canWrite}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="non-inclus">Ce qui n'est pas inclus</Label>
          <Textarea
            id="non-inclus"
            value={nonInclus}
            onChange={(e) => setNonInclus(e.target.value)}
            onBlur={saveNonInclus}
            placeholder={"• Visa et formalités\n• Assurance voyage\n• Pourboires\n• Dépenses personnelles…"}
            rows={8}
            disabled={!canWrite}
            className="text-sm"
          />
        </div>
      </div>

      {/* CONFIRMATION RÉGÉNÉRATION */}
      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-[color:var(--gold)]" />
              Régénérer l'itinéraire depuis les vols ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Des jours existent déjà avec du contenu (textes, photos, lieux). La régénération
              va <strong>supprimer tous les jours actuels</strong> et reconstruire un nouveau
              squelette à partir des dates de vol. Vos textes et images seront perdus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void runRegenerate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Régénérer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ============================================================
 *  Sortable item (un jour)
 * ============================================================ */

function SortableJour(props: {
  jour: CotationJour;
  index: number;
  autoDate: string | null;
  userId: string;
  cotationId: string;
  canWrite: boolean;
  destination: string | null;
  onUpdate: (patch: Partial<CotationJour>) => void;
  onDelete: () => void;
}) {
  const { jour } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: jour.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <JourEditor
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

function JourEditor({
  jour,
  index,
  autoDate,
  userId,
  cotationId,
  canWrite,
  destination,
  onUpdate,
  onDelete,
  dragHandleProps,
  isDragging,
}: {
  jour: CotationJour;
  index: number;
  autoDate: string | null;
  userId: string;
  cotationId: string;
  canWrite: boolean;
  destination: string | null;
  onUpdate: (patch: Partial<CotationJour>) => void;
  onDelete: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps: any;
  isDragging: boolean;
}) {
  const [titre, setTitre] = useState(jour.titre);
  const [lieu, setLieu] = useState(jour.lieu ?? "");
  const [description, setDescription] = useState(jour.description ?? "");
  const [date, setDate] = useState(jour.date_jour ?? "");
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generate = useServerFn(generateDayText);

  // Synchroniser état local si la prop change (drag → re-render)
  useEffect(() => {
    setTitre(jour.titre);
    setLieu(jour.lieu ?? "");
    setDescription(jour.description ?? "");
    setDate(jour.date_jour ?? "");
  }, [jour.id, jour.titre, jour.lieu, jour.description, jour.date_jour]);

  const displayDate = date || autoDate || "";

  const runGenerate = async (extra?: { hebergement?: string; activites?: string; ambiance?: string }) => {
    setGenerating(true);
    const r = await generate({
      data: {
        titre: titre || null,
        lieu: lieu || null,
        destination: destination || null,
        typeVoyage: null,
        hebergement: extra?.hebergement || null,
        activites: extra?.activites || null,
        ambiance: extra?.ambiance || null,
      },
    });
    setGenerating(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setDescription(r.text);
    onUpdate({ description: r.text });
    toast.success("Texte généré.");
  };

  const addToGallery = (url: string, credit: string | null) => {
    const newUrls = [...(jour.gallery_urls ?? []), url].slice(0, MAX_GALLERY);
    const newCredits = [...(jour.gallery_credits ?? []), credit ?? ""].slice(0, MAX_GALLERY);
    onUpdate({ gallery_urls: newUrls, gallery_credits: newCredits });
  };

  const removeFromGallery = (i: number) => {
    const newUrls = [...(jour.gallery_urls ?? [])];
    const newCredits = [...(jour.gallery_credits ?? [])];
    newUrls.splice(i, 1);
    newCredits.splice(i, 1);
    onUpdate({ gallery_urls: newUrls, gallery_credits: newCredits });
  };

  const galleryCount = jour.gallery_urls?.length ?? 0;
  const canAddMore = galleryCount < MAX_GALLERY;

  return (
    <div
      className={`border rounded-md bg-card/50 ${isDragging ? "shadow-lg ring-2 ring-primary/40" : ""}`}
    >
      {/* HEADER */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          {...dragHandleProps}
          disabled={!canWrite}
          className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Réordonner"
        >
          <GripVertical className="h-4 w-4" />
        </button>
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
        {displayDate && (
          <div className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(displayDate)}
          </div>
        )}
        {canWrite && (
          <>
            <Button size="icon" variant="ghost" onClick={() => setOpen(!open)} aria-label={open ? "Replier" : "Déplier"}>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} className="text-destructive" aria-label="Supprimer">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* CONTENT */}
      {open && (
        <div className="p-4 pt-0 grid md:grid-cols-[220px_1fr] gap-4 border-t">
          {/* COL GAUCHE : image + meta */}
          <div className="space-y-3 pt-4">
            <div>
              <Label className="text-xs">Photo principale</Label>
              <ImagePicker
                value={jour.image_url}
                onChange={(url, meta) =>
                  onUpdate({
                    image_url: url,
                    image_credit: url ? meta?.credit ?? null : null,
                  })
                }
                userId={userId}
                cotationId={cotationId}
                pathPrefix={`jour-${jour.id}`}
                buttonLabel="Image du jour"
                aspect="video"
                disabled={!canWrite}
              />
              {jour.image_credit && (
                <div className="text-[10px] text-muted-foreground mt-1 italic">
                  {jour.image_credit}
                </div>
              )}
            </div>

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
              <Label className="text-xs">
                Date {autoDate && !date && <span className="text-muted-foreground">(auto)</span>}
              </Label>
              <Input
                type="date"
                value={date || autoDate || ""}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => {
                  const newVal = date || null;
                  if (newVal !== (jour.date_jour ?? null)) onUpdate({ date_jour: newVal });
                }}
                disabled={!canWrite}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* COL DROITE : description + galerie */}
          <div className="pt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Description</Label>
                {canWrite && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => runGenerate()}
                      disabled={generating}
                    >
                      {generating ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1 text-[color:var(--gold)]" />
                      )}
                      {generating ? "Génération…" : "Générer le texte"}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setAiOpen(true)}
                      disabled={generating}
                      title="Affiner avec des détails"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() =>
                  description !== (jour.description ?? "") && onUpdate({ description: description || null })
                }
                placeholder="Décrivez le déroulé de la journée, les visites, les ambiances… ou cliquez sur ✨ Générer le texte."
                rows={6}
                disabled={!canWrite}
                className="text-sm"
              />
            </div>

            {/* GALERIE */}
            <div>
              <Label className="text-xs">
                Galerie secondaire ({galleryCount}/{MAX_GALLERY})
              </Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {(jour.gallery_urls ?? []).map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="relative aspect-square rounded overflow-hidden border bg-muted group"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => removeFromGallery(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Supprimer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {jour.gallery_credits?.[i] && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1 text-[8px] text-white truncate">
                        {jour.gallery_credits[i]}
                      </div>
                    )}
                  </div>
                ))}
                {canAddMore && canWrite && (
                  <GalleryAddSlot
                    userId={userId}
                    cotationId={cotationId}
                    jourId={jour.id}
                    onAdd={addToGallery}
                  />
                )}
              </div>
            </div>

            {/* HOTEL */}
            <HotelBlock
              jour={jour}
              canWrite={canWrite}
              userId={userId}
              cotationId={cotationId}
              onUpdate={onUpdate}
            />
          </div>
        </div>
      )}

      {/* MODALE IA "AFFINER" */}
      <AiRefineDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        generating={generating}
        onGenerate={async (extra) => {
          await runGenerate(extra);
          setAiOpen(false);
        }}
      />
    </div>
  );
}

/* ============================================================
 *  Slot d'ajout galerie (déclenche l'ImagePicker dans un Dialog)
 * ============================================================ */
function GalleryAddSlot({
  userId,
  cotationId,
  jourId,
  onAdd,
}: {
  userId: string;
  cotationId: string;
  jourId: string;
  onAdd: (url: string, credit: string | null) => void;
}) {
  const [tempUrl, setTempUrl] = useState<string | null>(null);

  return (
    <div className="aspect-square">
      <ImagePicker
        value={tempUrl}
        onChange={(url, meta) => {
          if (url) {
            onAdd(url, meta?.credit ?? null);
            setTempUrl(null);
          }
        }}
        userId={userId}
        cotationId={cotationId}
        pathPrefix={`jour-${jourId}-gal`}
        buttonLabel="+"
        aspect="square"
      />
    </div>
  );
}

/* ============================================================
 *  Modale "Affiner" (input guidé)
 * ============================================================ */
function AiRefineDialog({
  open,
  onOpenChange,
  generating,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  generating: boolean;
  onGenerate: (extra: { hebergement?: string; activites?: string; ambiance?: string }) => void;
}) {
  const [hebergement, setHebergement] = useState("");
  const [activites, setActivites] = useState("");
  const [ambiance, setAmbiance] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-[color:var(--gold)]" />
            Affiner la génération
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Hébergement</Label>
            <Input
              value={hebergement}
              onChange={(e) => setHebergement(e.target.value)}
              placeholder="ex: Riad Yasmine, en plein cœur de la médina"
            />
          </div>
          <div>
            <Label className="text-xs">Activités prévues</Label>
            <Textarea
              value={activites}
              onChange={(e) => setActivites(e.target.value)}
              placeholder="ex: visite des souks, hammam traditionnel, dîner sur les toits"
              rows={3}
            />
          </div>
          <div>
            <Label className="text-xs">Ambiance / mots-clés</Label>
            <Input
              value={ambiance}
              onChange={(e) => setAmbiance(e.target.value)}
              placeholder="ex: feutré, sensoriel, contemplatif"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generating}>
            Annuler
          </Button>
          <Button
            onClick={() =>
              onGenerate({
                hebergement: hebergement.trim() || undefined,
                activites: activites.trim() || undefined,
                ambiance: ambiance.trim() || undefined,
              })
            }
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Génération…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Générer</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
